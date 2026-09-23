import { ConflictException } from '@nestjs/common';
import {
  LineDirection,
  LineDirectionMode,
  PassengerType,
  Prisma,
  ReservationStatus,
  RideStatus,
  RideType,
  StationCategory,
  UserRole
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AccessTokenPayload } from '../../src/auth/auth.types';
import { realignDriftedSchedules } from '../../src/invariants/checks/schedule-matches-route';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  acquireScheduleLockShared,
  reservationWriteTransaction,
  scheduleEditTransaction
} from '../../src/prisma/schedule-lock';
import { ReservationsService } from '../../src/reservations/reservations.service';
import { RidesService } from '../../src/rides/rides.service';

/**
 * The schedule lock against a real Postgres.
 *
 * Every e2e spec mocks Prisma, and a mock cannot say whether two transactions
 * wait for each other. These run the real services against a migrated database
 * (`DATABASE_URL`), each test on a tenant of its own.
 */

/** Long enough that a transaction which was going to finish would have. */
const STILL_WAITING_MS = 400;

type Deferred = { promise: Promise<void>; resolve: () => void };

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

async function isStillPending(promise: Promise<unknown>): Promise<boolean> {
  const pending = Symbol('pending');
  const outcome = await Promise.race([
    promise.then(
      () => 'settled',
      () => 'settled'
    ),
    new Promise((done) => setTimeout(() => done(pending), STILL_WAITING_MS))
  ]);

  return outcome === pending;
}

interface Seeded {
  auth: AccessTokenPayload;
  lineId: string;
  scheduleId: string;
  rideId: string;
  passengerId: string;
  travelDate: string;
  otherTravelDate: string;
  stations: { first: string; last: string };
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A tenant with one weekly 09:00 ride of 48 seats and one passenger. */
async function seedTenant(prisma: PrismaService): Promise<Seeded> {
  const tenantId = randomUUID();
  const actorId = randomUUID();
  const suffix = tenantId.slice(0, 8);
  const travel = new Date();
  travel.setUTCHours(0, 0, 0, 0);
  travel.setUTCDate(travel.getUTCDate() + 7);
  const otherTravel = new Date(travel);
  otherTravel.setUTCDate(otherTravel.getUTCDate() + 7);
  const recurringStartDate = new Date(travel);
  recurringStartDate.setUTCDate(recurringStartDate.getUTCDate() - 30);

  await prisma.tenant.create({ data: { id: tenantId, slug: `db-${suffix}`, name: `DB ${suffix}` } });
  await prisma.user.create({
    data: {
      id: actorId,
      tenantId,
      username: `db-admin-${suffix}`,
      email: `db-admin-${suffix}@example.test`,
      passwordHash: 'not-used',
      role: UserRole.ADMIN,
      isActive: true
    }
  });

  const [first, last] = [randomUUID(), randomUUID()];
  await prisma.station.createMany({
    data: [
      { id: first, name: `First ${suffix}` },
      { id: last, name: `Last ${suffix}` }
    ].map((station) => ({
      ...station,
      tenantId,
      address: 'Test Street',
      category: StationCategory.BUS_STOP,
      isActive: true,
      createdById: actorId,
      updatedById: actorId
    }))
  });

  const lineId = randomUUID();
  await prisma.line.create({
    data: {
      id: lineId,
      tenantId,
      name: `Line ${suffix}`,
      departureStationId: first,
      arrivalStationId: last,
      directionMode: LineDirectionMode.SINGLE,
      direction: LineDirection.OUTBOUND,
      isActive: true,
      createdById: actorId,
      updatedById: actorId
    }
  });

  const rideId = randomUUID();
  await prisma.ride.create({
    data: {
      id: rideId,
      tenantId,
      lineId,
      name: `Ride ${suffix}`,
      capacity: 48,
      type: RideType.RECURRING,
      status: RideStatus.ACTIVE,
      recurringStartDate,
      createdById: actorId,
      updatedById: actorId
    }
  });

  const scheduleId = randomUUID();
  await prisma.rideDaySchedule.create({
    data: {
      id: scheduleId,
      tenantId,
      rideId,
      dayOfWeek: travel.getUTCDay(),
      createdById: actorId,
      updatedById: actorId
    }
  });
  await prisma.rideDayScheduleStationTime.createMany({
    data: [
      { stationId: first, orderIndex: 0, time: '09:00' },
      { stationId: last, orderIndex: 1, time: '11:00' }
    ].map((entry) => ({
      ...entry,
      tenantId,
      rideDayScheduleId: scheduleId,
      createdById: actorId,
      updatedById: actorId
    }))
  });

  const passengerId = randomUUID();
  await prisma.passenger.create({
    data: {
      id: passengerId,
      tenantId,
      firstName: 'Test',
      lastName: 'Passenger',
      phone: `+3816${Math.floor(Math.random() * 1e8)}`,
      passengerType: PassengerType.ADULT,
      isActive: true,
      createdById: actorId,
      updatedById: actorId
    }
  });

  return {
    auth: { sub: actorId, tenantId, role: UserRole.ADMIN, username: `db-admin-${suffix}` },
    lineId,
    scheduleId,
    rideId,
    passengerId,
    travelDate: dateOnly(travel),
    otherTravelDate: dateOnly(otherTravel),
    stations: { first, last }
  };
}

/**
 * Tables a seeded tenant writes to, children first. Deleted with raw SQL so
 * the audit extension does not record the cleanup as edits.
 */
const TENANT_TABLES = [
  'AuditEvent',
  'Reservation',
  'Passenger',
  'RideDayScheduleStationTime',
  'RideDaySchedule',
  'RideException',
  'Ride',
  'LineStop',
  'Line',
  'Station',
  'RefreshSession',
  'User'
] as const;

/**
 * Some of these tests deliberately leave a confirmed breakage behind, which the
 * integrity report would find on the next run against the same database.
 */
async function removeTenant(prisma: PrismaService, tenantId: string): Promise<void> {
  for (const table of TENANT_TABLES) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "tenantId" = $1`, tenantId);
  }

  await prisma.$executeRawUnsafe(`DELETE FROM "Tenant" WHERE "id" = $1`, tenantId);
}

function booking(seeded: Seeded, seatNumber: number, travelDate = seeded.travelDate) {
  return {
    rideId: seeded.rideId,
    passengerId: seeded.passengerId,
    travelDate,
    rideDepartureTime: '09:00',
    rideArrivalTime: '11:00',
    seatNumber,
    departureStationId: seeded.stations.first,
    arrivalStationId: seeded.stations.last
  };
}

describe('tenant schedule lock (real database)', () => {
  let prisma: PrismaService;
  let reservations: ReservationsService;
  let rides: RidesService;
  let seeded: Seeded;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    reservations = new ReservationsService(prisma);
    rides = new RidesService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    seeded = await seedTenant(prisma);
  });

  afterEach(async () => {
    await removeTenant(prisma, seeded.auth.tenantId);
  });

  /** Holds a reservation writer's shared lock open until `release`. */
  function holdBooking(write: (tx: Prisma.TransactionClient) => Promise<unknown>) {
    const acquired = deferred();
    const release = deferred();
    const done = reservationWriteTransaction(prisma, seeded.auth.tenantId, async (tx) => {
      await write(tx);
      acquired.resolve();
      await release.promise;
    });

    return { acquired: acquired.promise, release: release.resolve, done };
  }

  /** Holds a schedule edit's exclusive lock open until `release`. */
  function holdEdit(write: (tx: Prisma.TransactionClient) => Promise<unknown>) {
    const acquired = deferred();
    const release = deferred();
    const done = scheduleEditTransaction(prisma, seeded.auth.tenantId, async (tx) => {
      await write(tx);
      acquired.resolve();
      await release.promise;
    });

    return { acquired: acquired.promise, release: release.resolve, done };
  }

  it('makes a guarded edit wait for a booking in flight, then measure it', async () => {
    // Seat 40 is being sold while capacity is lowered to 30. Before the lock,
    // the edit's scan could miss the uncommitted booking and strand it.
    const inFlight = holdBooking((tx) =>
      tx.reservation.create({
        data: {
          ...booking(seeded, 40),
          travelDate: new Date(`${seeded.travelDate}T00:00:00.000Z`),
          tenantId: seeded.auth.tenantId,
          status: ReservationStatus.ACTIVE,
          groupId: randomUUID(),
          createdById: seeded.auth.sub,
          updatedById: seeded.auth.sub
        }
      })
    );
    await inFlight.acquired;

    const edit = rides.update(seeded.auth, seeded.rideId, { capacity: 30 });

    expect(await isStillPending(edit)).toBe(true);

    inFlight.release();
    await inFlight.done;

    await expect(edit).rejects.toMatchObject({
      response: {
        code: 'WOULD_BREAK_RESERVATIONS',
        invariant: 'reservation.seatWithinCapacity',
        affectedCount: 1
      }
    });
  });

  it('makes a booking wait for a schedule edit, then read what it committed', async () => {
    const edit = holdEdit((tx) => tx.ride.update({ where: { id: seeded.rideId }, data: { capacity: 30 } }));
    await edit.acquired;

    const sale = reservations.create(seeded.auth, booking(seeded, 40));

    expect(await isStillPending(sale)).toBe(true);

    edit.release();
    await edit.done;

    // Seat 40 no longer exists on a 30-seat bus, and the booking knows it
    // because it read the ride after the edit committed.
    await expect(sale).rejects.toThrow('Seat number exceeds ride capacity');
    await expect(
      prisma.reservation.count({ where: { tenantId: seeded.auth.tenantId } })
    ).resolves.toBe(0);
  });

  it('does not make bookings on different departures wait for each other', async () => {
    const first = holdBooking(async () => undefined);
    await first.acquired;

    await expect(
      reservations.create(seeded.auth, booking(seeded, 5, seeded.otherTravelDate))
    ).resolves.toMatchObject({ seatNumber: 5 });

    first.release();
    await first.done;
  });

  it('queues new bookings behind a waiting edit, so a busy counter cannot starve it', async () => {
    const order: string[] = [];
    const first = holdBooking(async () => undefined);
    await first.acquired;

    const edit = rides
      .update(seeded.auth, seeded.rideId, { capacity: 40 })
      .then(() => order.push('edit'));
    expect(await isStillPending(edit)).toBe(true);

    const later = reservations
      .create(seeded.auth, booking(seeded, 7, seeded.otherTravelDate))
      .then(() => order.push('later booking'));
    expect(await isStillPending(later)).toBe(true);

    first.release();
    await Promise.all([first.done, edit, later]);

    expect(order).toEqual(['edit', 'later booking']);
  });

  it('gives up with a retryable 409 when an edit holds the schedule too long', async () => {
    const edit = holdEdit(async () => undefined);
    await edit.acquired;

    const attempt = prisma.$transaction((tx) =>
      acquireScheduleLockShared(tx, seeded.auth.tenantId, 200)
    );

    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toMatchObject({
      response: { code: 'SCHEDULE_BEING_UPDATED', retryable: true }
    });

    edit.release();
    await edit.done;
  });

  it('makes a plain ride delete wait for a booking in flight, then refuse', async () => {
    const inFlight = holdBooking((tx) =>
      tx.reservation.create({
        data: {
          ...booking(seeded, 3),
          travelDate: new Date(`${seeded.travelDate}T00:00:00.000Z`),
          tenantId: seeded.auth.tenantId,
          status: ReservationStatus.ACTIVE,
          groupId: randomUUID(),
          createdById: seeded.auth.sub,
          updatedById: seeded.auth.sub
        }
      })
    );
    await inFlight.acquired;

    const removal = rides.remove(seeded.auth, seeded.rideId);

    expect(await isStillPending(removal)).toBe(true);

    inFlight.release();
    await inFlight.done;

    // Counted after the booking committed, so the ride is not retired under it.
    await expect(removal).rejects.toBeInstanceOf(ConflictException);
    await expect(
      prisma.ride.findUniqueOrThrow({ where: { id: seeded.rideId }, select: { status: true } })
    ).resolves.toEqual({ status: RideStatus.ACTIVE });
  });

  it('keeps an edit that landed while a realign repair waited for the lock', async () => {
    // A stop is added to the route behind the schedule's back, so the schedule
    // drifts and the repair has something to plan.
    const middle = randomUUID();
    await prisma.station.create({
      data: {
        id: middle,
        tenantId: seeded.auth.tenantId,
        name: `Middle ${middle.slice(0, 8)}`,
        address: 'Test Street',
        category: StationCategory.BUS_STOP,
        isActive: true,
        createdById: seeded.auth.sub,
        updatedById: seeded.auth.sub
      }
    });
    await prisma.lineStop.create({
      data: {
        tenantId: seeded.auth.tenantId,
        lineId: seeded.lineId,
        stationId: middle,
        orderIndex: 1,
        isBoarding: true,
        isDropoff: true,
        createdById: seeded.auth.sub,
        updatedById: seeded.auth.sub
      }
    });

    // An operator's edit aligns the schedule with times of their own, and is
    // still uncommitted when the repair scans.
    const edit = holdEdit(async (tx) => {
      await tx.rideDayScheduleStationTime.deleteMany({
        where: { rideDayScheduleId: seeded.scheduleId }
      });
      await tx.rideDayScheduleStationTime.createMany({
        data: [
          { stationId: seeded.stations.first, orderIndex: 0, time: '07:00' },
          { stationId: middle, orderIndex: 1, time: '07:40' },
          { stationId: seeded.stations.last, orderIndex: 2, time: '08:30' }
        ].map((entry) => ({
          ...entry,
          tenantId: seeded.auth.tenantId,
          rideDayScheduleId: seeded.scheduleId,
          createdById: seeded.auth.sub,
          updatedById: seeded.auth.sub
        }))
      });
    });
    await edit.acquired;

    const repair = realignDriftedSchedules({
      tenantId: seeded.auth.tenantId,
      actorId: seeded.auth.sub,
      prisma,
      windowDays: 30
    });

    expect(await isStillPending(repair)).toBe(true);

    edit.release();
    await edit.done;

    await expect(repair).resolves.toMatchObject({ drifted: [] });
    const times = await prisma.rideDayScheduleStationTime.findMany({
      where: { rideDayScheduleId: seeded.scheduleId },
      orderBy: { orderIndex: 'asc' },
      select: { time: true }
    });
    expect(times.map((entry) => entry.time)).toEqual(['07:00', '07:40', '08:30']);
  });

  it('refuses a confirmation whose affected set changed after it was shown', async () => {
    await reservations.create(seeded.auth, booking(seeded, 40));

    const shown = await rides.update(seeded.auth, seeded.rideId, { capacity: 30 }).then(
      () => {
        throw new Error('expected a refusal');
      },
      (error: { response: { confirmationToken: string; affectedCount: number } }) => error.response
    );
    expect(shown.affectedCount).toBe(1);

    // A second passenger is sold a seat the smaller bus will not have.
    await reservations.create(seeded.auth, booking(seeded, 45));

    const again = await rides
      .update(seeded.auth, seeded.rideId, { capacity: 30, confirmationTokens: [shown.confirmationToken] })
      .then(
        () => {
          throw new Error('expected a second refusal');
        },
        (error: { response: { confirmationToken: string; affectedCount: number } }) => error.response
      );
    expect(again.affectedCount).toBe(2);
    expect(again.confirmationToken).not.toBe(shown.confirmationToken);
    await expect(
      prisma.ride.findUniqueOrThrow({ where: { id: seeded.rideId }, select: { capacity: true } })
    ).resolves.toEqual({ capacity: 48 });

    // Answering what is true now goes through.
    await expect(
      rides.update(seeded.auth, seeded.rideId, { capacity: 30, confirmationTokens: [again.confirmationToken] })
    ).resolves.toMatchObject({ capacity: 30 });
  });
});
