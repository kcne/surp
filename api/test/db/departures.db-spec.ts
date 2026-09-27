import {
  AuditEventType,
  DepartureSource,
  Prisma,
  RideExceptionType,
  RideStatus
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { DepartureNightlyService } from '../../src/departures/departure-nightly.service';
import { syncDepartures } from '../../src/departures/departure-sync';
import { SYSTEM_ACTOR_ID } from '../../src/departures/system-actor';
import { PassengersService } from '../../src/passengers/passengers.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { scheduleEditTransaction } from '../../src/prisma/schedule-lock';
import { RidesService } from '../../src/rides/rides.service';
import { dateOnly, removeTenant, Seeded, seedTenant } from './db-fixtures';

/**
 * Stored departures against a real Postgres (#27, PR 1a): the constraints the
 * migration adds, and the sync every timetable write runs, driven through the
 * real services.
 */

/** Long enough that a transaction which was going to finish would have. */
const STILL_WAITING_MS = 400;

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

function daysFromToday(days: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

describe('departures (real database)', () => {
  let prisma: PrismaService;
  let rides: RidesService;
  let passengers: PassengersService;
  let seeded: Seeded;
  const syncSwitch = process.env.DEPARTURES_SYNC_ENABLED;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    rides = new RidesService(prisma);
    passengers = new PassengersService(prisma);
  });

  beforeEach(() => {
    // As production runs once the first fill is done.
    process.env.DEPARTURES_SYNC_ENABLED = 'true';
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
    seeded = await seedTenant(prisma);
    // The first fill, as `departures:sync --apply` does it.
    await prisma.$transaction((tx) =>
      syncDepartures(tx, { tenantId: seeded.auth.tenantId, actorId: SYSTEM_ACTOR_ID })
    );
  });

  afterEach(async () => {
    await removeTenant(prisma, seeded.auth.tenantId);
  });

  function editor() {
    return { tenantId: seeded.auth.tenantId, actorId: seeded.auth.sub };
  }

  function onTravelDate(select: Prisma.DepartureSelect = { id: true }) {
    return prisma.departure.findMany({
      where: { rideId: seeded.rideId, serviceDate: new Date(seeded.travelDate) },
      select
    });
  }

  async function linkReservation(departureId: string): Promise<void> {
    await prisma.reservation.create({
      data: {
        tenantId: seeded.auth.tenantId,
        rideId: seeded.rideId,
        passengerId: seeded.passengerId,
        travelDate: new Date(seeded.travelDate),
        rideDepartureTime: '09:00',
        rideArrivalTime: '11:00',
        seatNumber: 1,
        departureStationId: seeded.stations.first,
        arrivalStationId: seeded.stations.last,
        departureId,
        createdById: seeded.auth.sub,
        updatedById: seeded.auth.sub
      }
    });
  }

  describe('the first fill', () => {
    it('writes one departure per scheduled weekday for a year, with its stops, as the system actor', async () => {
      const departures = await prisma.departure.findMany({
        where: { tenantId: seeded.auth.tenantId },
        include: { stops: { orderBy: { orderIndex: 'asc' } } }
      });

      // One weekday a week over 366 days is 52 or 53 dates.
      expect(departures.length).toBeGreaterThanOrEqual(52);
      expect(departures.length).toBeLessThanOrEqual(53);

      const [onTravel] = departures.filter(
        (departure) => dateOnly(departure.serviceDate) === seeded.travelDate
      );
      expect(onTravel).toMatchObject({
        source: DepartureSource.SCHEDULE,
        lineId: seeded.lineId,
        departureTime: '09:00',
        arrivalTime: '11:00',
        capacity: 48,
        createdById: SYSTEM_ACTOR_ID,
        cancelledAt: null,
        timetableDroppedAt: null
      });
      expect(onTravel.stops.map((stop) => [stop.stationId, stop.time])).toEqual([
        [seeded.stations.first, '09:00'],
        [seeded.stations.last, '11:00']
      ]);

      const audited = await prisma.auditEvent.count({
        where: {
          tenantId: seeded.auth.tenantId,
          entityType: 'Departure',
          actorUserId: SYSTEM_ACTOR_ID
        }
      });
      expect(audited).toBe(departures.length);
    });

    it('is idempotent', async () => {
      const counts = await prisma.$transaction((tx) =>
        syncDepartures(tx, { tenantId: seeded.auth.tenantId, actorId: SYSTEM_ACTOR_ID })
      );

      expect(counts).toEqual({ created: 0, updated: 0, dropped: 0, deleted: 0 });
    });
  });

  describe('constraints', () => {
    it('allows one timetable departure per ride and date', async () => {
      await expect(
        prisma.departure.create({
          data: {
            tenantId: seeded.auth.tenantId,
            rideId: seeded.rideId,
            serviceDate: new Date(seeded.travelDate),
            source: DepartureSource.SCHEDULE,
            lineId: seeded.lineId,
            departureTime: '13:00',
            arrivalTime: '15:00',
            capacity: 10,
            createdById: seeded.auth.sub
          }
        })
      ).rejects.toThrow();
    });

    it('allows an extra bus at the same time as the timetable one', async () => {
      await expect(
        prisma.departure.create({
          data: {
            tenantId: seeded.auth.tenantId,
            rideId: seeded.rideId,
            serviceDate: new Date(seeded.travelDate),
            source: DepartureSource.EXTRA,
            lineId: seeded.lineId,
            departureTime: '09:00',
            arrivalTime: '11:00',
            capacity: 10,
            createdById: seeded.auth.sub
          }
        })
      ).resolves.toBeDefined();
    });

    it('refuses a half-recorded cancellation, zero capacity and a malformed time', async () => {
      const [departure] = await onTravelDate();

      for (const data of [
        { cancelledAt: new Date() },
        { cancelledById: seeded.auth.sub },
        { capacity: 0 },
        { departureTime: '9:00' },
        { arrivalTime: '24:00' }
      ]) {
        await expect(
          prisma.departure.update({ where: { id: departure.id }, data })
        ).rejects.toThrow(/check constraint/i);
      }
    });

    it('refuses a reservation whose ride or date disagrees with its departure', async () => {
      const [departure] = await onTravelDate();
      const otherDate = await prisma.departure.findFirstOrThrow({
        where: { rideId: seeded.rideId, serviceDate: new Date(seeded.otherTravelDate) }
      });

      await expect(linkReservation(otherDate.id)).rejects.toThrow(/foreign key/i);
      await expect(linkReservation(departure.id)).resolves.toBeUndefined();
    });

    it('refuses to delete a departure a reservation points at', async () => {
      const [departure] = await onTravelDate();
      await linkReservation(departure.id);

      await expect(prisma.departure.delete({ where: { id: departure.id } })).rejects.toThrow(
        /foreign key/i
      );
    });
  });

  describe('sync inside timetable writes', () => {
    it('updates departures in place on a timetable edit, credited to the editor', async () => {
      const [before] = await onTravelDate();

      await rides.update(seeded.auth, seeded.rideId, { capacity: 40 });

      const [after] = await onTravelDate({ id: true, capacity: true, updatedById: true });
      expect(after).toEqual({ id: before.id, capacity: 40, updatedById: seeded.auth.sub });
    });

    it('keeps departure IDs when a route is reordered and rewrites their stops (#14)', async () => {
      const [before] = await onTravelDate();
      const middle = randomUUID();
      await prisma.station.create({
        data: {
          id: middle,
          tenantId: seeded.auth.tenantId,
          name: `Middle ${middle.slice(0, 8)}`,
          address: 'Test Street',
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
          orderIndex: 0,
          isBoarding: false,
          isDropoff: true,
          createdById: seeded.auth.sub,
          updatedById: seeded.auth.sub
        }
      });

      await rides.replaceDayTimes(seeded.auth, seeded.rideId, [
        {
          dayOfWeek: new Date(seeded.travelDate).getUTCDay(),
          stationTimes: [
            { stationId: seeded.stations.first, orderIndex: 0, time: '09:00' },
            { stationId: middle, orderIndex: 1, time: '10:00' },
            { stationId: seeded.stations.last, orderIndex: 2, time: '11:00' }
          ]
        }
      ]);

      const [after] = await onTravelDate({
        id: true,
        updatedById: true,
        stops: {
          select: {
            stationId: true,
            time: true,
            isBoarding: true,
            isDropoff: true,
            createdById: true
          },
          orderBy: { orderIndex: 'asc' }
        }
      });
      expect(after.id).toBe(before.id);
      expect(after.stops).toEqual([
        {
          stationId: seeded.stations.first,
          time: '09:00',
          isBoarding: true,
          isDropoff: false,
          createdById: seeded.auth.sub
        },
        {
          stationId: middle,
          time: '10:00',
          isBoarding: false,
          isDropoff: true,
          createdById: seeded.auth.sub
        },
        {
          stationId: seeded.stations.last,
          time: '11:00',
          isBoarding: false,
          isDropoff: true,
          createdById: seeded.auth.sub
        }
      ]);
      // Only the stops changed, so the departure row itself is not rewritten.
      expect(after.updatedById).toBe(SYSTEM_ACTOR_ID);
    });

    it('deletes departures of a dropped weekday that nothing references, and brings them back', async () => {
      const dayOfWeek = new Date(seeded.travelDate).getUTCDay();

      await rides.replaceDayTimes(seeded.auth, seeded.rideId, []);
      expect(await prisma.departure.count({ where: { rideId: seeded.rideId } })).toBe(0);

      await rides.replaceDayTimes(seeded.auth, seeded.rideId, [
        {
          dayOfWeek,
          stationTimes: [
            { stationId: seeded.stations.first, orderIndex: 0, time: '09:00' },
            { stationId: seeded.stations.last, orderIndex: 1, time: '11:00' }
          ]
        }
      ]);
      expect(await onTravelDate()).toHaveLength(1);
    });

    it('credits the departures and stops an edit deletes to the editor, not to their last writer', async () => {
      await rides.replaceDayTimes(seeded.auth, seeded.rideId, []);

      const deletes = await prisma.auditEvent.groupBy({
        by: ['entityType', 'actorUserId'],
        where: { tenantId: seeded.auth.tenantId, type: AuditEventType.DOMAIN_DELETE },
        _count: { _all: true }
      });
      const byEntity = Object.fromEntries(
        deletes.map((group) => [`${group.entityType}:${group.actorUserId}`, group._count._all])
      );

      // Every departure and every one of its two stops was last written by
      // the first fill's system actor; the delete is still the editor's.
      expect(byEntity[`Departure:${seeded.auth.sub}`]).toBeGreaterThanOrEqual(52);
      expect(byEntity[`DepartureStop:${seeded.auth.sub}`]).toBe(
        2 * byEntity[`Departure:${seeded.auth.sub}`]
      );
      expect(byEntity[`Departure:${SYSTEM_ACTOR_ID}`]).toBeUndefined();
      expect(byEntity[`DepartureStop:${SYSTEM_ACTOR_ID}`]).toBeUndefined();
    });

    it('rolls the timetable write back when the sync refuses what it would write', async () => {
      // A time the API would refuse, written past it: the departure CHECK is
      // the last line, and it takes the edit down with it.
      const edit = scheduleEditTransaction(prisma, editor(), (tx) =>
        tx.rideDayScheduleStationTime.updateMany({
          where: { tenantId: seeded.auth.tenantId, stationId: seeded.stations.first },
          data: { time: '9:00' }
        })
      );

      await expect(edit).rejects.toThrow(/Departure_departureTime_format/);
      const times = await prisma.rideDayScheduleStationTime.findMany({
        where: { tenantId: seeded.auth.tenantId, stationId: seeded.stations.first },
        select: { time: true }
      });
      expect(times).toEqual([{ time: '09:00' }]);
      const [departure] = await onTravelDate({ departureTime: true });
      expect(departure.departureTime).toBe('09:00');
    });

    it('leaves departures alone on a passenger edit, which the generator does not read', async () => {
      // Drift the passenger edit would repair if it synced.
      await prisma.departure.updateMany({
        where: { rideId: seeded.rideId },
        data: { capacity: 3 }
      });

      await passengers.update(seeded.auth, seeded.passengerId, { firstName: 'Mila' });

      const [departure] = await onTravelDate({ capacity: true });
      expect(departure.capacity).toBe(3);
    });

    it('keeps a referenced departure the timetable drops, and restores it with the same ID', async () => {
      const [departure] = await onTravelDate();
      await linkReservation(departure.id);
      const dayOfWeek = new Date(seeded.travelDate).getUTCDay();

      // The reservation guard asks first; the edit here answers as confirmed.
      await scheduleEditTransaction(prisma, editor(), (tx) =>
        tx.rideDaySchedule.deleteMany({ where: { rideId: seeded.rideId } })
      );

      const [dropped] = await onTravelDate({ id: true, timetableDroppedAt: true });
      expect(dropped.id).toBe(departure.id);
      expect(dropped.timetableDroppedAt).toBeInstanceOf(Date);
      // Only the referenced one survives.
      expect(await prisma.departure.count({ where: { rideId: seeded.rideId } })).toBe(1);

      await rides.replaceDayTimes(seeded.auth, seeded.rideId, [
        {
          dayOfWeek,
          stationTimes: [
            { stationId: seeded.stations.first, orderIndex: 0, time: '09:00' },
            { stationId: seeded.stations.last, orderIndex: 1, time: '11:00' }
          ]
        }
      ]);

      const [restored] = await onTravelDate({ id: true, timetableDroppedAt: true });
      expect(restored).toEqual({ id: departure.id, timetableDroppedAt: null });
    });

    it('drops future departures when the ride is deactivated and brings them back on reactivation', async () => {
      await rides.update(seeded.auth, seeded.rideId, { status: RideStatus.INACTIVE });
      expect(await prisma.departure.count({ where: { rideId: seeded.rideId } })).toBe(0);

      await rides.update(seeded.auth, seeded.rideId, { status: RideStatus.ACTIVE });
      expect(await onTravelDate()).toHaveLength(1);
    });

    it('mirrors a SKIP as a cancellation that survives timetable edits, and clears it with the SKIP', async () => {
      const skip = await rides.addException(seeded.auth, seeded.rideId, {
        date: seeded.travelDate,
        type: RideExceptionType.SKIP
      });

      const cancelledFields = { cancelledAt: true, cancelledById: true };
      const [cancelled] = await onTravelDate(cancelledFields);
      expect(cancelled.cancelledById).toBe(seeded.auth.sub);
      expect(cancelled.cancelledAt).toBeInstanceOf(Date);

      await rides.update(seeded.auth, seeded.rideId, { capacity: 30 });
      expect(await onTravelDate(cancelledFields)).toEqual([cancelled]);

      await rides.removeException(seeded.auth, seeded.rideId, skip.id);
      expect(await onTravelDate(cancelledFields)).toEqual([
        { cancelledAt: null, cancelledById: null }
      ]);
    });

    it('turns an ADDITIONAL into an extra bus and removes it with the exception', async () => {
      const extra = await rides.addException(seeded.auth, seeded.rideId, {
        date: seeded.travelDate,
        type: RideExceptionType.ADDITIONAL,
        departureTime: '09:00',
        arrivalTime: '11:00'
      });

      const sources = await onTravelDate({ source: true, rideExceptionId: true });
      expect(sources).toEqual(
        expect.arrayContaining([
          { source: DepartureSource.SCHEDULE, rideExceptionId: null },
          { source: DepartureSource.EXTRA, rideExceptionId: extra.id }
        ])
      );

      await rides.removeException(seeded.auth, seeded.rideId, extra.id);
      expect(await onTravelDate({ source: true })).toEqual([{ source: DepartureSource.SCHEDULE }]);
    });

    it('moves future departures to a new line and leaves past ones with the line and stops they ran', async () => {
      const past = await prisma.departure.create({
        data: {
          tenantId: seeded.auth.tenantId,
          rideId: seeded.rideId,
          serviceDate: daysFromToday(-3),
          source: DepartureSource.SCHEDULE,
          lineId: seeded.lineId,
          departureTime: '09:00',
          arrivalTime: '11:00',
          capacity: 48,
          createdById: seeded.auth.sub,
          stops: {
            create: [
              {
                tenantId: seeded.auth.tenantId,
                stationId: seeded.stations.first,
                orderIndex: 0,
                time: '09:00',
                isBoarding: true,
                isDropoff: false,
                createdById: seeded.auth.sub
              }
            ]
          }
        }
      });
      const newLineId = randomUUID();
      await prisma.line.create({
        data: {
          id: newLineId,
          tenantId: seeded.auth.tenantId,
          name: `Other ${newLineId.slice(0, 8)}`,
          departureStationId: seeded.stations.first,
          arrivalStationId: seeded.stations.last,
          isActive: true,
          createdById: seeded.auth.sub,
          updatedById: seeded.auth.sub
        }
      });

      await rides.update(seeded.auth, seeded.rideId, { lineId: newLineId });

      const [future] = await onTravelDate({ lineId: true });
      expect(future.lineId).toBe(newLineId);
      const kept = await prisma.departure.findUniqueOrThrow({
        where: { id: past.id },
        include: { stops: true }
      });
      expect(kept.lineId).toBe(seeded.lineId);
      expect(kept.updatedAt).toEqual(past.updatedAt);
      expect(kept.stops).toHaveLength(1);
    });
  });

  describe('before DEPARTURES_SYNC_ENABLED is set', () => {
    beforeEach(() => {
      delete process.env.DEPARTURES_SYNC_ENABLED;
    });

    it('lets a timetable edit through without writing departures', async () => {
      await rides.update(seeded.auth, seeded.rideId, { capacity: 40 });

      const [departure] = await onTravelDate({ capacity: true, updatedById: true });
      expect(departure).toEqual({ capacity: 48, updatedById: SYSTEM_ACTOR_ID });
    });

    it('does not run the nightly job', async () => {
      await prisma.departure.deleteMany({
        where: { rideId: seeded.rideId, serviceDate: new Date(seeded.otherTravelDate) }
      });

      await new DepartureNightlyService(prisma).runScheduled();

      expect(
        await prisma.departure.count({
          where: { rideId: seeded.rideId, serviceDate: new Date(seeded.otherTravelDate) }
        })
      ).toBe(0);
    });
  });

  describe('the nightly job', () => {
    function nightly() {
      return new DepartureNightlyService(prisma);
    }

    it('adds only what is missing', async () => {
      await prisma.departure.deleteMany({
        where: { rideId: seeded.rideId, serviceDate: new Date(seeded.otherTravelDate) }
      });
      const [kept] = await onTravelDate();

      const outcomes = await nightly().run();
      const mine = outcomes.find((outcome) => outcome.tenantId === seeded.auth.tenantId)!;

      expect(mine.counts).toEqual({ created: 1, updated: 0, dropped: 0, deleted: 0 });
      expect(await onTravelDate()).toEqual([kept]);
      const added = await prisma.departure.findFirstOrThrow({
        where: { rideId: seeded.rideId, serviceDate: new Date(seeded.otherTravelDate) }
      });
      expect(added.createdById).toBe(SYSTEM_ACTOR_ID);
    });

    it('waits for an edit that holds the schedule, and does not bring back what it removed', async () => {
      let releaseEdit!: () => void;
      const editHolds = new Promise<void>((resolve) => {
        releaseEdit = resolve;
      });
      let editStarted!: () => void;
      const started = new Promise<void>((resolve) => {
        editStarted = resolve;
      });

      const edit = scheduleEditTransaction(prisma, editor(), async (tx) => {
        await tx.rideDaySchedule.deleteMany({ where: { rideId: seeded.rideId } });
        editStarted();
        await editHolds;
      });
      await started;

      const night = nightly().run();
      expect(await isStillPending(night)).toBe(true);

      releaseEdit();
      await edit;
      const outcomes = await night;

      expect(outcomes.find((outcome) => outcome.tenantId === seeded.auth.tenantId)!.counts).toEqual(
        {
          created: 0,
          updated: 0,
          dropped: 0,
          deleted: 0
        }
      );
      expect(await prisma.departure.count({ where: { rideId: seeded.rideId } })).toBe(0);
    });
  });
});
