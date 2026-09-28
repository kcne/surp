import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DepartureSource, RideExceptionType } from '@prisma/client';
import { indexLinkableDepartures } from '../../src/departures/departure-link';
import { syncDepartures } from '../../src/departures/departure-sync';
import { SYSTEM_ACTOR_ID } from '../../src/departures/system-actor';
import { InternalSandboxService } from '../../src/internal-sandbox/internal-sandbox.service';
import {
  classifyDepartureLinks,
  reservationDepartureLinked
} from '../../src/invariants/checks/reservation-departure-linked';
import { reservationReachable } from '../../src/invariants/checks/reservation-reachable';
import { InvariantContext } from '../../src/invariants/invariant.types';
import { guardProspectiveWrite, NO_CONSENT } from '../../src/invariants/prospective-write';
import { PrismaService } from '../../src/prisma/prisma.service';
import { scheduleEditTransaction } from '../../src/prisma/schedule-lock';
import { ReservationsService } from '../../src/reservations/reservations.service';
import { RidesService } from '../../src/rides/rides.service';
import { removeTenant, Seeded, seedTenant } from './db-fixtures';

/**
 * Bookings linking to their stored departure (#27, PR 1b), against a real
 * Postgres: the link a booking writes, what the timetable does to a linked
 * departure, the repair that rewrites a reservation's time, and the check.
 */

describe('departure links (real database)', () => {
  let prisma: PrismaService;
  let rides: RidesService;
  let reservations: ReservationsService;
  let seeded: Seeded;
  const syncSwitch = process.env.DEPARTURES_SYNC_ENABLED;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    rides = new RidesService(prisma);
    reservations = new ReservationsService(prisma);
  });

  afterAll(async () => {
    if (syncSwitch === undefined) {
      delete process.env.DEPARTURES_SYNC_ENABLED;
    } else {
      process.env.DEPARTURES_SYNC_ENABLED = syncSwitch;
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    process.env.DEPARTURES_SYNC_ENABLED = 'true';
    seeded = await seedTenant(prisma);
    await prisma.$transaction((tx) =>
      syncDepartures(tx, { tenantId: seeded.auth.tenantId, actorId: SYSTEM_ACTOR_ID })
    );
  });

  afterEach(async () => {
    await removeTenant(prisma, seeded.auth.tenantId);
  });

  function book(seatNumber: number, rideDepartureTime = '09:00') {
    return reservations.create(seeded.auth, {
      rideId: seeded.rideId,
      passengerId: seeded.passengerId,
      travelDate: seeded.travelDate,
      rideDepartureTime,
      rideArrivalTime: '11:00',
      seatNumber,
      departureStationId: seeded.stations.first,
      arrivalStationId: seeded.stations.last
    });
  }

  function departuresOnTravelDate() {
    return prisma.departure.findMany({
      where: { rideId: seeded.rideId, serviceDate: new Date(seeded.travelDate) },
      select: { id: true, source: true, departureTime: true, timetableDroppedAt: true }
    });
  }

  function linkOf(reservationId: string) {
    return prisma.reservation
      .findUniqueOrThrow({ where: { id: reservationId }, select: { departureId: true } })
      .then((row) => row.departureId);
  }

  function context(): InvariantContext {
    return {
      tenantId: seeded.auth.tenantId,
      actorId: seeded.auth.sub,
      prisma,
      windowDays: 30
    };
  }

  /** The token an operator sends back to ask for the repair they were offered. */
  async function repairTokenOf(refused: Promise<unknown>): Promise<string> {
    const error = await refused.then(
      () => {
        throw new Error('expected the write to be refused');
      },
      (reason: unknown) => reason
    );
    expect(error).toBeInstanceOf(ConflictException);

    return ((error as ConflictException).getResponse() as { confirmationToken: string })
      .confirmationToken;
  }

  it('links a booking to its timetable departure', async () => {
    const [departure] = await departuresOnTravelDate();

    const reservation = await book(1);

    expect(await linkOf(reservation.id)).toBe(departure.id);
  });

  it('leaves a booking unlinked when an extra bus leaves at the same time', async () => {
    await rides.addException(seeded.auth, seeded.rideId, {
      date: seeded.travelDate,
      type: RideExceptionType.ADDITIONAL,
      departureTime: '09:00',
      arrivalTime: '11:00'
    });
    expect(await departuresOnTravelDate()).toHaveLength(2);

    const reservation = await book(1);

    expect(reservation.seatNumber).toBe(1);
    expect(await linkOf(reservation.id)).toBeNull();
  });

  it('links a booking to an extra bus that leaves at its own time', async () => {
    await rides.addException(seeded.auth, seeded.rideId, {
      date: seeded.travelDate,
      type: RideExceptionType.ADDITIONAL,
      departureTime: '15:00',
      arrivalTime: '17:00'
    });
    const extra = (await departuresOnTravelDate()).find(
      (departure) => departure.source === DepartureSource.EXTRA
    )!;

    const reservation = await book(1, '15:00');

    expect(await linkOf(reservation.id)).toBe(extra.id);
  });

  it('still links a booking on a cancelled date, and the check lists the passenger', async () => {
    await rides.addException(seeded.auth, seeded.rideId, {
      date: seeded.travelDate,
      type: RideExceptionType.SKIP
    });
    const [departure] = await departuresOnTravelDate();

    const reservation = await book(1);

    expect(await linkOf(reservation.id)).toBe(departure.id);
    const { violations } = await reservationDepartureLinked.check(context());
    expect(violations).toEqual([
      expect.objectContaining({
        subjectId: reservation.id,
        detail: expect.objectContaining({ reason: 'NOT_RUNNING', cancelled: true })
      })
    ]);
  });

  it('keeps the link when the timetable drops a booked departure, and reports it', async () => {
    const [departure] = await departuresOnTravelDate();
    const reservation = await book(1);

    // The reservation guard asks first; the edit here answers as confirmed.
    await scheduleEditTransaction(
      prisma,
      { tenantId: seeded.auth.tenantId, actorId: seeded.auth.sub },
      (tx) => tx.rideDaySchedule.deleteMany({ where: { rideId: seeded.rideId } })
    );

    const [dropped] = await departuresOnTravelDate();
    expect(dropped.id).toBe(departure.id);
    expect(dropped.timetableDroppedAt).toBeInstanceOf(Date);
    expect(await linkOf(reservation.id)).toBe(departure.id);

    const { violations } = await reservationDepartureLinked.check(context());
    expect(violations).toEqual([
      expect.objectContaining({
        subjectId: reservation.id,
        detail: expect.objectContaining({ reason: 'NOT_RUNNING', timetableDropped: true })
      })
    ]);
  });

  it('leaves a booking unlinked before the sync is on, when an extra may have no row yet', async () => {
    delete process.env.DEPARTURES_SYNC_ENABLED;
    // With the sync off, an extra at the timetable bus's time is not stored,
    // so the timetable bus is the only match and linking would guess wrong.
    await rides.addException(seeded.auth, seeded.rideId, {
      date: seeded.travelDate,
      type: RideExceptionType.ADDITIONAL,
      departureTime: '09:00',
      arrivalTime: '11:00'
    });
    expect(await departuresOnTravelDate()).toHaveLength(1);

    const reservation = await book(1);

    expect(await linkOf(reservation.id)).toBeNull();
  });

  describe('the reservation.reachable repair', () => {
    it('keeps the link when an operator repairs during the edit that moved the bus', async () => {
      const [departure] = await departuresOnTravelDate();
      const reservation = await book(1);
      const scope = { tenantId: seeded.auth.tenantId, actorId: seeded.auth.sub };
      const moveFirstStop = (tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0]) =>
        tx.rideDayScheduleStationTime.updateMany({
          where: { rideDayScheduleId: seeded.scheduleId, orderIndex: 0 },
          data: { time: '08:30' }
        });
      const token = await repairTokenOf(
        guardProspectiveWrite(prisma, scope, [reservationReachable], NO_CONSENT, moveFirstStop)
      );

      await guardProspectiveWrite(
        prisma,
        scope,
        [reservationReachable],
        { confirmationTokens: [], repairTokens: [token] },
        moveFirstStop
      );

      const repaired = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        select: { departureId: true, rideDepartureTime: true }
      });
      expect(repaired).toEqual({ departureId: departure.id, rideDepartureTime: '08:30' });
      expect(await departuresOnTravelDate()).toEqual([
        expect.objectContaining({ id: departure.id, departureTime: '08:30' })
      ]);
    });

    it('moves the link to the timetable bus when an extra is removed with a repair, and deletes the extra', async () => {
      const [timetableBus] = await departuresOnTravelDate();
      const exception = await rides.addException(seeded.auth, seeded.rideId, {
        date: seeded.travelDate,
        type: RideExceptionType.ADDITIONAL,
        departureTime: '15:00',
        arrivalTime: '17:00'
      });
      const reservation = await book(1, '15:00');
      expect(await linkOf(reservation.id)).not.toBe(timetableBus.id);
      const token = await repairTokenOf(
        rides.removeException(seeded.auth, seeded.rideId, exception.id)
      );

      await rides.removeException(seeded.auth, seeded.rideId, exception.id, {
        confirmationTokens: [],
        repairTokens: [token]
      });

      const repaired = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        select: { departureId: true, rideDepartureTime: true }
      });
      expect(repaired).toEqual({ departureId: timetableBus.id, rideDepartureTime: '09:00' });
      // Dropped by the sync before the repair while it still had a passenger,
      // then deleted by the sync at the end once it had none.
      expect(await departuresOnTravelDate()).toEqual([
        expect.objectContaining({ id: timetableBus.id, source: DepartureSource.SCHEDULE })
      ]);
    });

    it('keeps the link when it moves a reservation to the new time of the same bus', async () => {
      const [departure] = await departuresOnTravelDate();
      const reservation = await book(1);

      await scheduleEditTransaction(
        prisma,
        { tenantId: seeded.auth.tenantId, actorId: seeded.auth.sub },
        (tx) =>
          tx.rideDayScheduleStationTime.updateMany({
            where: { rideDayScheduleId: seeded.scheduleId, orderIndex: 0 },
            data: { time: '08:30' }
          })
      );
      expect((await departuresOnTravelDate())[0]).toMatchObject({
        id: departure.id,
        departureTime: '08:30'
      });

      await reservationReachable.repair!(context());

      const repaired = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        select: { departureId: true, rideDepartureTime: true }
      });
      expect(repaired).toEqual({ departureId: departure.id, rideDepartureTime: '08:30' });
    });

    it('moves the link to the extra bus when that is the departure it moves the reservation onto', async () => {
      const [timetableBus] = await departuresOnTravelDate();
      const reservation = await book(1);
      await rides.addException(seeded.auth, seeded.rideId, {
        date: seeded.travelDate,
        type: RideExceptionType.ADDITIONAL,
        departureTime: '15:00',
        arrivalTime: '17:00'
      });
      await scheduleEditTransaction(
        prisma,
        { tenantId: seeded.auth.tenantId, actorId: seeded.auth.sub },
        (tx) => tx.rideDaySchedule.deleteMany({ where: { rideId: seeded.rideId } })
      );
      const extra = (await departuresOnTravelDate()).find(
        (departure) => departure.source === DepartureSource.EXTRA
      )!;
      expect(await linkOf(reservation.id)).toBe(timetableBus.id);

      await reservationReachable.repair!(context());

      const repaired = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        select: { departureId: true, rideDepartureTime: true }
      });
      expect(repaired).toEqual({ departureId: extra.id, rideDepartureTime: '15:00' });
    });
  });

  describe('reservation.departureLinked', () => {
    it('is quiet for linked bookings on running departures', async () => {
      await book(1);
      await book(2);

      const result = await reservationDepartureLinked.check(context());

      expect(result).toEqual({ violations: [], scannedCount: 2 });
    });

    it('reports a link to the wrong bus, and unlinked bookings on either side of the cutoff', async () => {
      await rides.addException(seeded.auth, seeded.rideId, {
        date: seeded.travelDate,
        type: RideExceptionType.ADDITIONAL,
        departureTime: '15:00',
        arrivalTime: '17:00'
      });
      const extra = (await departuresOnTravelDate()).find(
        (departure) => departure.source === DepartureSource.EXTRA
      )!;
      const wrong = await book(1);
      await prisma.reservation.update({ where: { id: wrong.id }, data: { departureId: extra.id } });
      const unlinked = await book(2);
      await prisma.reservation.update({ where: { id: unlinked.id }, data: { departureId: null } });

      const rows = await prisma.reservation.findMany({
        where: { tenantId: seeded.auth.tenantId },
        select: {
          id: true,
          rideId: true,
          travelDate: true,
          rideDepartureTime: true,
          departureId: true,
          createdAt: true,
          passenger: { select: { firstName: true, lastName: true } },
          departure: {
            select: { timetableDroppedAt: true, cancelledAt: true }
          }
        }
      });
      const departures = await prisma.departure.findMany({
        where: { tenantId: seeded.auth.tenantId },
        select: { id: true, rideId: true, serviceDate: true, departureTime: true }
      });
      const index = indexLinkableDepartures(departures);
      const reasons = (requiredFrom: Date) =>
        classifyDepartureLinks(rows, index, requiredFrom)
          .map((violation) => [violation.subjectId, violation.detail.reason])
          .sort();

      expect(reasons(new Date(0))).toEqual(
        [
          [wrong.id, 'WRONG_LINK'],
          [unlinked.id, 'LINKABLE_UNLINKED']
        ].sort()
      );
      // Booked before linking went live: the backfill's, not reported.
      expect(reasons(new Date(Date.now() + 86_400_000))).toEqual([[wrong.id, 'WRONG_LINK']]);
    });
  });

  it('links the sandbox reset’s reservations the way a booking would', async () => {
    const sandbox = new InternalSandboxService(prisma, {
      get: () => 'sandbox-password'
    } as unknown as ConfigService);

    await sandbox.reset();
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { slug: 'sandbox-demo' },
      select: { id: true }
    });

    try {
      const future = await prisma.reservation.findMany({
        where: { tenantId: tenant.id, travelDate: { gte: new Date(seeded.travelDate) } },
        select: { departureId: true }
      });
      expect(future.length).toBeGreaterThan(0);
      expect(future.every((row) => row.departureId !== null)).toBe(true);

      const { violations } = await reservationDepartureLinked.check({
        ...context(),
        tenantId: tenant.id
      });
      expect(violations).toEqual([]);
    } finally {
      // Resetting again clears it the way it clears itself, then the tenant goes.
      await prisma.$transaction((tx) =>
        (sandbox as unknown as {
          clearTenantData(tx: unknown, tenantId: string): Promise<unknown>;
        }).clearTenantData(tx, tenant.id)
      );
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });
});
