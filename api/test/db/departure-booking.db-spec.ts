import { ConflictException } from '@nestjs/common';
import { Prisma, RideExceptionType } from '@prisma/client';
import { lockDepartures } from '../../src/departures/departure-lock';
import { syncDepartures } from '../../src/departures/departure-sync';
import { SYSTEM_ACTOR_ID } from '../../src/departures/system-actor';
import { PrismaService } from '../../src/prisma/prisma.service';
import { reservationWriteTransaction, scheduleEditTransaction } from '../../src/prisma/schedule-lock';
import { ReservationsService } from '../../src/reservations/reservations.service';
import { RidesService } from '../../src/rides/rides.service';
import { removeTenant, Seeded, seedTenant } from './db-fixtures';

/**
 * Booking by departure against a real Postgres (#27, PR 3b): the departure
 * row lock every seat writer waits on, and a booking racing a schedule edit.
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

describe('booking by departure (real database)', () => {
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
    await prisma.$transaction((tx) =>
      syncDepartures(tx, { tenantId: seeded.auth.tenantId, actorId: SYSTEM_ACTOR_ID })
    );
  });

  afterEach(async () => {
    await removeTenant(prisma, seeded.auth.tenantId);
  });

  function book(seatNumber: number, overrides: Record<string, unknown> = {}) {
    return reservations.create(seeded.auth, {
      rideId: seeded.rideId,
      passengerId: seeded.passengerId,
      travelDate: seeded.travelDate,
      rideDepartureTime: '09:00',
      rideArrivalTime: '11:00',
      seatNumber,
      departureStationId: seeded.stations.first,
      arrivalStationId: seeded.stations.last,
      ...overrides
    });
  }

  async function departureAt(departureTime: string): Promise<string> {
    const departure = await prisma.departure.findFirstOrThrow({
      where: { rideId: seeded.rideId, serviceDate: new Date(seeded.travelDate), departureTime },
      select: { id: true }
    });

    return departure.id;
  }

  /** A seat writer that holds a departure's row lock until `release`. */
  function holdDeparture(departureId: string) {
    const acquired = deferred();
    const release = deferred();
    const done = reservationWriteTransaction(prisma, seeded.auth.tenantId, async (tx) => {
      await lockDepartures(tx, [departureId]);
      acquired.resolve();
      await release.promise;
    });

    return { acquired: acquired.promise, release: release.resolve, done };
  }

  /** A schedule edit that holds the exclusive lock until `release`. */
  function holdEdit(write: (tx: Prisma.TransactionClient) => Promise<unknown>) {
    const acquired = deferred();
    const release = deferred();
    const done = scheduleEditTransaction(
      prisma,
      { tenantId: seeded.auth.tenantId, actorId: seeded.auth.sub },
      async (tx) => {
        await write(tx);
        acquired.resolve();
        await release.promise;
      }
    );

    return { acquired: acquired.promise, release: release.resolve, done };
  }

  it('makes a booking wait for another writer on the same bus', async () => {
    const holder = holdDeparture(await departureAt('09:00'));
    await holder.acquired;

    const booking = book(1);

    expect(await isStillPending(booking)).toBe(true);

    holder.release();
    await holder.done;
    await expect(booking).resolves.toMatchObject({ seatNumber: 1 });
  });

  it('does not make a booking wait for a writer on another bus of the same ride and date', async () => {
    await rides.addException(seeded.auth, seeded.rideId, {
      date: seeded.travelDate,
      type: RideExceptionType.ADDITIONAL,
      departureTime: '15:00',
      arrivalTime: '17:00'
    });
    const holder = holdDeparture(await departureAt('15:00'));
    await holder.acquired;

    try {
      await expect(book(1)).resolves.toMatchObject({ seatNumber: 1 });
    } finally {
      holder.release();
      await holder.done;
    }
  });

  it('sells a seat once when two bookings for it arrive together', async () => {
    const outcomes = await Promise.allSettled([book(7), book(7)]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const [refused] = outcomes.filter(
      (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected'
    );
    expect(refused.reason).toBeInstanceOf(ConflictException);
    expect((refused.reason as Error).message).toBe('Seat is already booked for this route segment');
    expect(await prisma.reservation.count({ where: { tenantId: seeded.auth.tenantId } })).toBe(1);
  });

  it('holds the seat of a reservation whose time copy drifted', async () => {
    // A row written before the sync kept copies in step (#14): same bus,
    // another time on it.
    const first = await book(3);
    await prisma.reservation.update({ where: { id: first.id }, data: { rideDepartureTime: '08:45' } });

    await expect(book(3)).rejects.toThrow('Seat is already booked for this route segment');
  });

  it('makes a booking wait for an edit that drops its departure, then refuses it', async () => {
    // Already booked, so the sync keeps the departure on record, dropped,
    // rather than deleting it.
    await book(2);
    const departureId = await departureAt('09:00');
    const edit = holdEdit((tx) => tx.ride.update({ where: { id: seeded.rideId }, data: { status: 'INACTIVE' } }));
    await edit.acquired;

    const booking = book(1, { departureId });

    expect(await isStillPending(booking)).toBe(true);

    edit.release();
    await edit.done;
    await expect(booking).rejects.toMatchObject({ response: { code: 'DEPARTURE_NOT_RUNNING' } });
  });

  it('refuses a booking whose unbooked departure an edit deleted meanwhile', async () => {
    const departureId = await departureAt('09:00');
    await scheduleEditTransaction(
      prisma,
      { tenantId: seeded.auth.tenantId, actorId: seeded.auth.sub },
      (tx) => tx.rideDaySchedule.deleteMany({ where: { rideId: seeded.rideId } })
    );

    await expect(book(1, { departureId })).rejects.toMatchObject({
      response: { code: 'DEPARTURE_NOT_FOUND' }
    });
  });

  it('asks before a ride edit lowers capacity under a sold seat, counted on the departure', async () => {
    await book(40);

    await expect(rides.update(seeded.auth, seeded.rideId, { capacity: 30 })).rejects.toMatchObject({
      response: { code: 'WOULD_BREAK_RESERVATIONS', invariant: 'reservation.seatWithinCapacity' }
    });
  });

  it('refuses a date past the stored window', async () => {
    const far = new Date();
    far.setUTCDate(far.getUTCDate() + 400);

    await expect(book(1, { travelDate: far.toISOString().slice(0, 10) })).rejects.toMatchObject({
      status: 400
    });
  });
});
