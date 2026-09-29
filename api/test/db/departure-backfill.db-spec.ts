import { DepartureSource, ReservationStatus, RideExceptionType } from '@prisma/client';
import {
  BackfillRefused,
  backfillDepartures,
  backfillWrites,
  countDepartureBackfill,
  planDepartureBackfill
} from '../../src/departures/departure-backfill';
import { planDepartureSync, syncDepartures } from '../../src/departures/departure-sync';
import { SYSTEM_ACTOR_ID } from '../../src/departures/system-actor';
import { departureMatchesTimetable } from '../../src/invariants/checks/departure-matches-timetable';
import { reservationDepartureLinked } from '../../src/invariants/checks/reservation-departure-linked';
import { InvariantContext } from '../../src/invariants/invariant.types';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ScheduleLockRoot } from '../../src/prisma/schedule-lock';
import { ReservationsService } from '../../src/reservations/reservations.service';
import { dateOnly, removeTenant, Seeded, seedTenant } from './db-fixtures';

/**
 * `departures:backfill` (#27, PR 2) against a real Postgres: the history it
 * writes, the links, LEGACY departures, what it refuses, and what the sync and
 * the checks make of the result.
 *
 * The seeded ride runs weekly at 09:00 from 30 days before its travel date,
 * which is a week from today. The same weekday two, three and four weeks back
 * are past timetable dates; one week back is today.
 */

describe('departures:backfill (real database)', () => {
  let prisma: PrismaService;
  let reservations: ReservationsService;
  let seeded: Seeded;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    reservations = new ReservationsService(prisma);
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

  function weeksBefore(weeks: number): string {
    const date = new Date(seeded.travelDate);
    date.setUTCDate(date.getUTCDate() - 7 * weeks);

    return dateOnly(date);
  }

  /** A reservation as it was saved before PR 1b: no departure link. */
  function sold({
    travelDate,
    departureTime = '09:00',
    arrivalTime = '11:00',
    seatNumber = 1,
    status = ReservationStatus.ACTIVE
  }: {
    travelDate: string;
    departureTime?: string;
    arrivalTime?: string;
    seatNumber?: number;
    status?: ReservationStatus;
  }) {
    return prisma.reservation.create({
      data: {
        tenantId: seeded.auth.tenantId,
        rideId: seeded.rideId,
        passengerId: seeded.passengerId,
        travelDate: new Date(travelDate),
        rideDepartureTime: departureTime,
        rideArrivalTime: arrivalTime,
        seatNumber,
        status,
        cancelledAt: status === ReservationStatus.CANCELLED ? new Date() : null,
        departureStationId: seeded.stations.first,
        arrivalStationId: seeded.stations.last,
        createdById: seeded.auth.sub,
        updatedById: seeded.auth.sub
      },
      select: { id: true }
    });
  }

  function linkOf(reservationId: string) {
    return prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      select: {
        departureId: true,
        updatedById: true,
        departure: { select: { source: true, serviceDate: true, departureTime: true } }
      }
    });
  }

  function departuresOf(date: string) {
    return prisma.departure.findMany({
      where: { tenantId: seeded.auth.tenantId, serviceDate: new Date(date) },
      select: {
        id: true,
        source: true,
        departureTime: true,
        arrivalTime: true,
        capacity: true,
        cancelledAt: true,
        createdById: true,
        _count: { select: { stops: true } }
      },
      orderBy: { departureTime: 'asc' }
    });
  }

  function context(): InvariantContext {
    return { tenantId: seeded.auth.tenantId, actorId: seeded.auth.sub, prisma, windowDays: 30 };
  }

  it('writes nothing in a dry run', async () => {
    const past = weeksBefore(2);
    const reservation = await sold({ travelDate: past });
    const before = await prisma.departure.count({ where: { tenantId: seeded.auth.tenantId } });

    const plan = await planDepartureBackfill(prisma, seeded.auth.tenantId);

    expect(countDepartureBackfill(plan)).toEqual(
      expect.objectContaining({ historyCreated: 1, legacyCreated: 0 })
    );
    expect(await prisma.departure.count({ where: { tenantId: seeded.auth.tenantId } })).toBe(
      before
    );
    expect((await linkOf(reservation.id)).departureId).toBeNull();
  });

  it('links past and future reservations, writes the history they need, and proposes nothing on a re-run', async () => {
    const past = weeksBefore(2);
    const onTimetable = await sold({ travelDate: past });
    const future = await sold({ travelDate: seeded.travelDate });
    const [futureDeparture] = await departuresOf(seeded.travelDate);

    const plan = await backfillDepartures(prisma, seeded.auth.tenantId);

    expect(countDepartureBackfill(plan)).toEqual(
      expect.objectContaining({
        historyCreated: 1,
        legacyCreated: 0,
        linked: { EXISTING: 1, HISTORY: 1, LEGACY: 0, MANUAL: 0 }
      })
    );
    expect(await linkOf(future.id)).toMatchObject({ departureId: futureDeparture.id });

    const [history] = await departuresOf(past);
    expect(history).toMatchObject({
      source: DepartureSource.SCHEDULE,
      departureTime: '09:00',
      createdById: SYSTEM_ACTOR_ID,
      _count: { stops: 2 }
    });
    expect(await linkOf(onTimetable.id)).toMatchObject({
      departureId: history.id,
      updatedById: SYSTEM_ACTOR_ID
    });

    // Only the date a reservation needed: four weeks back has none.
    expect(await departuresOf(weeksBefore(4))).toEqual([]);

    const again = await planDepartureBackfill(prisma, seeded.auth.tenantId);
    expect(backfillWrites(again)).toBe(false);
  });

  it('credits the link to the system actor in the audit', async () => {
    const reservation = await sold({ travelDate: weeksBefore(3) });

    await backfillDepartures(prisma, seeded.auth.tenantId);

    const events = await prisma.auditEvent.findMany({
      where: { tenantId: seeded.auth.tenantId, entityId: reservation.id },
      select: { actorUserId: true, metadata: true },
      orderBy: { createdAt: 'asc' }
    });
    expect(events.at(-1)).toMatchObject({
      actorUserId: SYSTEM_ACTOR_ID,
      metadata: { action: 'update', changes: { departureId: expect.any(Object) } }
    });
  });

  it('gives a past date that sold two times one timetable and one LEGACY departure', async () => {
    const past = weeksBefore(2);
    const onTime = await sold({ travelDate: past });
    const oldTime = await sold({
      travelDate: past,
      departureTime: '08:30',
      arrivalTime: '10:30',
      seatNumber: 60
    });

    await backfillDepartures(prisma, seeded.auth.tenantId);

    const departures = await departuresOf(past);
    expect(departures).toEqual([
      expect.objectContaining({
        source: DepartureSource.LEGACY,
        departureTime: '08:30',
        arrivalTime: '10:30',
        // The ride has 48 seats; seat 60 was sold.
        capacity: 60,
        createdById: SYSTEM_ACTOR_ID,
        _count: { stops: 0 }
      }),
      expect.objectContaining({ source: DepartureSource.SCHEDULE, departureTime: '09:00' })
    ]);
    expect((await linkOf(oldTime.id)).departureId).toBe(departures[0].id);
    expect((await linkOf(onTime.id)).departureId).toBe(departures[1].id);
  });

  it('reuses a LEGACY departure across runs, and the database refuses a second one', async () => {
    const past = weeksBefore(3);
    const first = await sold({ travelDate: past, departureTime: '08:30' });
    await backfillDepartures(prisma, seeded.auth.tenantId);
    const [legacy] = await departuresOf(past).then((rows) =>
      rows.filter((row) => row.source === DepartureSource.LEGACY)
    );

    const second = await sold({ travelDate: past, departureTime: '08:30', seatNumber: 2 });
    const plan = await backfillDepartures(prisma, seeded.auth.tenantId);

    expect(countDepartureBackfill(plan)).toEqual(
      expect.objectContaining({ legacyCreated: 0, legacyReused: 1 })
    );
    expect((await linkOf(first.id)).departureId).toBe(legacy.id);
    expect((await linkOf(second.id)).departureId).toBe(legacy.id);

    await expect(
      prisma.departure.create({
        data: {
          tenantId: seeded.auth.tenantId,
          rideId: seeded.rideId,
          serviceDate: new Date(past),
          source: DepartureSource.LEGACY,
          lineId: seeded.lineId,
          departureTime: '08:30',
          arrivalTime: '10:30',
          capacity: 48,
          createdById: SYSTEM_ACTOR_ID,
          updatedById: SYSTEM_ACTOR_ID
        }
      })
    ).rejects.toThrow(/Unique constraint/);
  });

  it('holds the composite foreign key on a LEGACY link', async () => {
    const reservation = await sold({ travelDate: weeksBefore(3), departureTime: '08:30' });
    await backfillDepartures(prisma, seeded.auth.tenantId);

    // The link carries the ride and date, so the reservation cannot move away
    // from its departure's date.
    await expect(
      prisma.reservation.update({
        where: { id: reservation.id },
        data: { travelDate: new Date(weeksBefore(2)) }
      })
    ).rejects.toThrow();
  });

  it('links a past booking on a cancelled date to the cancelled departure', async () => {
    const past = weeksBefore(2);
    await prisma.rideException.create({
      data: {
        tenantId: seeded.auth.tenantId,
        rideId: seeded.rideId,
        exceptionDate: new Date(past),
        type: RideExceptionType.SKIP,
        createdById: seeded.auth.sub,
        updatedById: seeded.auth.sub
      }
    });
    const reservation = await sold({ travelDate: past });

    await backfillDepartures(prisma, seeded.auth.tenantId);

    const [departure] = await departuresOf(past);
    expect(departure.source).toBe(DepartureSource.SCHEDULE);
    expect(departure.cancelledAt).toBeInstanceOf(Date);
    expect((await linkOf(reservation.id)).departureId).toBe(departure.id);
  });

  it('reports a past booking that two buses share, and links it to the bus staff chose', async () => {
    const past = weeksBefore(2);
    await prisma.rideException.create({
      data: {
        tenantId: seeded.auth.tenantId,
        rideId: seeded.rideId,
        exceptionDate: new Date(past),
        type: RideExceptionType.ADDITIONAL,
        departureTime: '09:00',
        arrivalTime: '11:00',
        createdById: seeded.auth.sub,
        updatedById: seeded.auth.sub
      }
    });
    const reservation = await sold({ travelDate: past });

    const dryRun = await planDepartureBackfill(prisma, seeded.auth.tenantId);
    expect(dryRun.reported).toEqual([
      expect.objectContaining({
        reservationId: reservation.id,
        reason: 'SEVERAL_DEPARTURES',
        futureActive: false
      })
    ]);
    expect(dryRun.legacyCreates).toEqual([]);

    // Staff can only choose between stored rows, so the first run writes the
    // two history departures and leaves the booking unlinked.
    await backfillDepartures(prisma, seeded.auth.tenantId);
    expect((await linkOf(reservation.id)).departureId).toBeNull();
    const extra = (await departuresOf(past)).find(
      (departure) => departure.source === DepartureSource.EXTRA
    )!;

    const manualLinks = [{ reservationId: reservation.id, departureId: extra.id }];
    await backfillDepartures(prisma, seeded.auth.tenantId, { manualLinks });

    expect((await linkOf(reservation.id)).departureId).toBe(extra.id);

    // The same file again: the link is done, not refused.
    const rerun = await backfillDepartures(prisma, seeded.auth.tenantId, { manualLinks });
    expect(rerun.manualLinksDone).toBe(1);
    expect(rerun.invalidManualLinks).toEqual([]);
    expect(backfillWrites(rerun)).toBe(false);
  });

  it('refuses an invalid manual link and writes nothing', async () => {
    const past = weeksBefore(2);
    const reservation = await sold({ travelDate: past });
    const [future] = await departuresOf(seeded.travelDate);

    await expect(
      backfillDepartures(prisma, seeded.auth.tenantId, {
        manualLinks: [{ reservationId: reservation.id, departureId: future.id }]
      })
    ).rejects.toBeInstanceOf(BackfillRefused);

    expect(await departuresOf(past)).toEqual([]);
    expect((await linkOf(reservation.id)).departureId).toBeNull();
  });

  it('refuses while stored departures are out of step with the timetable', async () => {
    const reservation = await sold({ travelDate: seeded.travelDate });
    await prisma.departure.updateMany({
      where: { rideId: seeded.rideId, serviceDate: new Date(seeded.otherTravelDate) },
      data: { arrivalTime: '12:00' }
    });

    await expect(backfillDepartures(prisma, seeded.auth.tenantId)).rejects.toThrow(/out of step/);
    expect((await linkOf(reservation.id)).departureId).toBeNull();
  });

  it('leaves the sync and the checks quiet about history and LEGACY rows', async () => {
    await sold({ travelDate: weeksBefore(2) });
    await sold({ travelDate: weeksBefore(3), departureTime: '08:30' });
    // A cancelled booking whose time the timetable does not produce: a LEGACY
    // departure dated in the future.
    await sold({
      travelDate: seeded.travelDate,
      departureTime: '07:00',
      status: ReservationStatus.CANCELLED
    });

    const plan = await backfillDepartures(prisma, seeded.auth.tenantId);
    expect(countDepartureBackfill(plan).legacyCreatedFuture).toBe(1);

    const sync = await planDepartureSync(prisma, seeded.auth.tenantId);
    expect([sync.creates, sync.updates, sync.drops, sync.deletes]).toEqual([[], [], [], []]);
    expect((await departureMatchesTimetable.check(context())).violations).toEqual([]);
    expect((await reservationDepartureLinked.check(context())).violations).toEqual([]);
  });

  it('reports a future active booking without a departure, and the check lists it', async () => {
    const reservation = await sold({ travelDate: seeded.travelDate, departureTime: '07:00' });

    const plan = await backfillDepartures(prisma, seeded.auth.tenantId);

    expect(plan.reported).toEqual([
      expect.objectContaining({
        reservationId: reservation.id,
        reason: 'NO_DEPARTURE',
        futureActive: true
      })
    ]);
    expect((await linkOf(reservation.id)).departureId).toBeNull();
    expect((await reservationDepartureLinked.check(context())).violations).toEqual([
      expect.objectContaining({
        subjectId: reservation.id,
        detail: expect.objectContaining({ reason: 'NO_UNIQUE_MATCH' })
      })
    ]);
  });

  it('makes a booking made during the backfill wait for its lock, then link', async () => {
    const past = await sold({ travelDate: weeksBefore(2) });
    const [departure] = await departuresOf(seeded.travelDate);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let applied!: () => void;
    const holding = new Promise<void>((resolve) => (applied = resolve));
    // Keeps the backfill's transaction open, lock held, once it has applied.
    const gated: ScheduleLockRoot = {
      $transaction: (work, options) =>
        prisma.$transaction(async (tx) => {
          const result = await work(tx);
          applied();
          await gate;

          return result;
        }, options)
    };

    const backfill = backfillDepartures(gated, seeded.auth.tenantId);
    await holding;

    let bookingSettled = false;
    const booking = reservations
      .create(seeded.auth, {
        rideId: seeded.rideId,
        passengerId: seeded.passengerId,
        travelDate: seeded.travelDate,
        rideDepartureTime: '09:00',
        rideArrivalTime: '11:00',
        seatNumber: 2,
        departureStationId: seeded.stations.first,
        arrivalStationId: seeded.stations.last
      })
      .finally(() => {
        bookingSettled = true;
      });

    await waitForLockWaiter();
    expect(bookingSettled).toBe(false);

    release();
    await backfill;
    const created = await booking;

    expect((await linkOf(created.id)).departureId).toBe(departure.id);
    expect((await linkOf(past.id)).departureId).not.toBeNull();
    expect(backfillWrites(await planDepartureBackfill(prisma, seeded.auth.tenantId))).toBe(false);
  });

  /** Until some transaction is waiting on an advisory lock, for at most 5 s. */
  async function waitForLockWaiter(): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const [{ waiting }] = await prisma.$queryRaw<Array<{ waiting: number }>>`
        SELECT count(*)::int AS waiting FROM pg_locks WHERE locktype = 'advisory' AND NOT granted`;

      if (waiting > 0) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error('No transaction started waiting on the schedule lock');
  }
});
