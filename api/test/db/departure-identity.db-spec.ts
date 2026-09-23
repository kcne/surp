import {
  DepartureKind,
  LineDirection,
  LineDirectionMode,
  Prisma,
  RideExceptionType,
  RideStatus,
  RideType,
  StationCategory
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { findDriftedSchedules } from '../../src/invariants/checks/schedule-matches-route';
import { NO_CONSENT, ProspectiveWriteConsent } from '../../src/invariants/prospective-write';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RidesService } from '../../src/rides/rides.service';
import { Seeded, dateOnly, removeTenant, seedTenant } from './db-fixtures';

/**
 * Departure identity against a real Postgres (#27 §1, §2).
 *
 * The constraints live in the database so that no application path can get
 * around them, which is also why a mocked Prisma cannot test them. The
 * service tests then show that schedule edits keep the rows those
 * constraints point at. Under the old delete-and-recreate, both weekday tests
 * fail on the RESTRICT foreign key instead.
 */

type Identity = {
  departureKind: DepartureKind | null;
  rideDayScheduleId?: string | null;
  rideExceptionId?: string | null;
};

/** Seat `seatNumber` on the seeded 09:00 departure, carrying `identity`. */
function reservationData(
  seeded: Seeded,
  identity: Identity,
  seatNumber: number,
  times: { departure: string; arrival: string } = { departure: '09:00', arrival: '11:00' }
): Prisma.ReservationUncheckedCreateInput {
  return {
    tenantId: seeded.auth.tenantId,
    rideId: seeded.rideId,
    passengerId: seeded.passengerId,
    travelDate: new Date(`${seeded.travelDate}T00:00:00.000Z`),
    rideDepartureTime: times.departure,
    rideArrivalTime: times.arrival,
    seatNumber,
    departureStationId: seeded.stations.first,
    arrivalStationId: seeded.stations.last,
    createdById: seeded.auth.sub,
    updatedById: seeded.auth.sub,
    departureKind: identity.departureKind,
    rideDayScheduleId: identity.rideDayScheduleId ?? null,
    rideExceptionId: identity.rideExceptionId ?? null
  };
}

/**
 * Runs a guarded write, and when it is refused, answers with the token it
 * was given, the way an operator pressing "save anyway" does.
 */
async function answeringRefusal<T>(
  write: (consent: ProspectiveWriteConsent) => Promise<T>
): Promise<T> {
  try {
    return await write(NO_CONSENT);
  } catch (error) {
    const token = (error as { response?: { confirmationToken?: unknown } }).response
      ?.confirmationToken;

    if (typeof token !== 'string') {
      throw error;
    }

    return write({ confirmationTokens: [token], repairTokens: [] });
  }
}

function weekdayAt(seeded: Seeded, dayOfWeek: number, departure: string, arrival = '11:00') {
  return {
    dayOfWeek,
    stationTimes: [
      { stationId: seeded.stations.first, orderIndex: 0, time: departure },
      { stationId: seeded.stations.last, orderIndex: 1, time: arrival }
    ]
  };
}

describe('departure identity (real database)', () => {
  let prisma: PrismaService;
  let rides: RidesService;
  let seeded: Seeded;
  const extraTenants: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
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

    for (const tenantId of extraTenants.splice(0)) {
      await removeTenant(prisma, tenantId);
    }
  });

  async function additionalOn(target: Seeded, departureTime = '15:00') {
    return prisma.rideException.create({
      data: {
        tenantId: target.auth.tenantId,
        rideId: target.rideId,
        exceptionDate: new Date(`${target.travelDate}T00:00:00.000Z`),
        type: RideExceptionType.ADDITIONAL,
        departureTime,
        arrivalTime: '16:30',
        createdById: target.auth.sub,
        updatedById: target.auth.sub
      }
    });
  }

  describe('the schema', () => {
    it('accepts a legacy row and each kind in its own shape', async () => {
      const exception = await additionalOn(seeded);
      const shapes: Identity[] = [
        { departureKind: null },
        { departureKind: DepartureKind.RECURRING_BASE, rideDayScheduleId: seeded.scheduleId },
        { departureKind: DepartureKind.ONE_TIME_BASE },
        { departureKind: DepartureKind.ADDITIONAL, rideExceptionId: exception.id }
      ];

      for (const [index, identity] of shapes.entries()) {
        await expect(
          prisma.reservation.create({ data: reservationData(seeded, identity, index + 1) })
        ).resolves.toEqual(expect.objectContaining({ departureKind: identity.departureKind }));
      }
    });

    it('rejects every other combination of kind and departure', async () => {
      const exception = await additionalOn(seeded);
      const invalid: Identity[] = [
        { departureKind: null, rideDayScheduleId: seeded.scheduleId },
        { departureKind: null, rideExceptionId: exception.id },
        { departureKind: DepartureKind.RECURRING_BASE },
        {
          departureKind: DepartureKind.RECURRING_BASE,
          rideDayScheduleId: seeded.scheduleId,
          rideExceptionId: exception.id
        },
        { departureKind: DepartureKind.ONE_TIME_BASE, rideDayScheduleId: seeded.scheduleId },
        { departureKind: DepartureKind.ONE_TIME_BASE, rideExceptionId: exception.id },
        { departureKind: DepartureKind.ADDITIONAL },
        { departureKind: DepartureKind.ADDITIONAL, rideDayScheduleId: seeded.scheduleId }
      ];

      for (const identity of invalid) {
        await expect(
          prisma.reservation.create({ data: reservationData(seeded, identity, 1) })
        ).rejects.toThrow(/Reservation_departure_identity_check/);
      }

      await expect(
        prisma.reservation.count({ where: { tenantId: seeded.auth.tenantId } })
      ).resolves.toBe(0);
    });

    it("rejects a departure that belongs to another of the tenant's rides", async () => {
      const otherRideId = randomUUID();
      await prisma.ride.create({
        data: {
          id: otherRideId,
          tenantId: seeded.auth.tenantId,
          lineId: seeded.lineId,
          name: 'Other ride',
          capacity: 48,
          type: RideType.RECURRING,
          status: RideStatus.ACTIVE,
          recurringStartDate: new Date(`${seeded.travelDate}T00:00:00.000Z`),
          createdById: seeded.auth.sub,
          updatedById: seeded.auth.sub
        }
      });
      const otherSchedule = await prisma.rideDaySchedule.create({
        data: {
          tenantId: seeded.auth.tenantId,
          rideId: otherRideId,
          dayOfWeek: 1,
          createdById: seeded.auth.sub,
          updatedById: seeded.auth.sub
        }
      });
      const otherException = await additionalOn({ ...seeded, rideId: otherRideId });

      await expect(
        prisma.reservation.create({
          data: reservationData(
            seeded,
            { departureKind: DepartureKind.RECURRING_BASE, rideDayScheduleId: otherSchedule.id },
            1
          )
        })
      ).rejects.toThrow(/Reservation_rideDayScheduleId_rideId_tenantId_fkey/);
      await expect(
        prisma.reservation.create({
          data: reservationData(
            seeded,
            { departureKind: DepartureKind.ADDITIONAL, rideExceptionId: otherException.id },
            1
          )
        })
      ).rejects.toThrow(/Reservation_rideExceptionId_rideId_tenantId_fkey/);
    });

    it("rejects a departure that belongs to another tenant's ride", async () => {
      const foreign = await seedTenant(prisma);
      extraTenants.push(foreign.auth.tenantId);
      const foreignException = await additionalOn(foreign);

      await expect(
        prisma.reservation.create({
          data: reservationData(
            seeded,
            { departureKind: DepartureKind.RECURRING_BASE, rideDayScheduleId: foreign.scheduleId },
            1
          )
        })
      ).rejects.toThrow(/Reservation_rideDayScheduleId_rideId_tenantId_fkey/);
      await expect(
        prisma.reservation.create({
          data: reservationData(
            seeded,
            { departureKind: DepartureKind.ADDITIONAL, rideExceptionId: foreignException.id },
            1
          )
        })
      ).rejects.toThrow(/Reservation_rideExceptionId_rideId_tenantId_fkey/);
    });

    it('refuses to delete a departure that a reservation names', async () => {
      const exception = await additionalOn(seeded);
      await prisma.reservation.create({
        data: reservationData(
          seeded,
          { departureKind: DepartureKind.RECURRING_BASE, rideDayScheduleId: seeded.scheduleId },
          1
        )
      });
      await prisma.reservation.create({
        data: reservationData(
          seeded,
          { departureKind: DepartureKind.ADDITIONAL, rideExceptionId: exception.id },
          2
        )
      });

      await expect(
        prisma.rideDaySchedule.delete({ where: { id: seeded.scheduleId } })
      ).rejects.toThrow(/Reservation_rideDayScheduleId_rideId_tenantId_fkey/);
      await expect(prisma.rideException.delete({ where: { id: exception.id } })).rejects.toThrow(
        /Reservation_rideExceptionId_rideId_tenantId_fkey/
      );
    });

    it('never retires a SKIP', async () => {
      const skip = await prisma.rideException.create({
        data: {
          tenantId: seeded.auth.tenantId,
          rideId: seeded.rideId,
          exceptionDate: new Date(`${seeded.otherTravelDate}T00:00:00.000Z`),
          type: RideExceptionType.SKIP,
          createdById: seeded.auth.sub,
          updatedById: seeded.auth.sub
        }
      });

      await expect(
        prisma.rideException.update({ where: { id: skip.id }, data: { retiredAt: new Date() } })
      ).rejects.toThrow(/RideException_retiredAt_additional_check/);
    });
  });

  describe('schedule edits', () => {
    const travelWeekday = () => new Date(`${seeded.travelDate}T00:00:00.000Z`).getUTCDay();

    async function instancesOnTravelDate() {
      const { items } = await rides.listInstancesByDate(seeded.auth, { date: seeded.travelDate });
      return items.filter((item) => item.rideId === seeded.rideId);
    }

    it('keeps a weekday through a time change, a drop and a restore', async () => {
      const weekday = travelWeekday();
      const otherWeekday = (weekday + 1) % 7;
      await prisma.reservation.create({
        data: reservationData(
          seeded,
          { departureKind: DepartureKind.RECURRING_BASE, rideDayScheduleId: seeded.scheduleId },
          1
        )
      });

      // A new first-stop time. The old code deleted the row here, which the
      // reservation's RESTRICT foreign key now refuses.
      await answeringRefusal((consent) =>
        rides.replaceDayTimes(
          seeded.auth,
          seeded.rideId,
          [weekdayAt(seeded, weekday, '09:30')],
          consent
        )
      );

      let rows = await prisma.rideDaySchedule.findMany({
        where: { rideId: seeded.rideId },
        include: { stationTimes: { orderBy: { orderIndex: 'asc' } } }
      });
      expect(rows).toEqual([
        expect.objectContaining({ id: seeded.scheduleId, dayOfWeek: weekday, retiredAt: null })
      ]);
      expect(rows[0].stationTimes.map((entry) => entry.time)).toEqual(['09:30', '11:00']);

      // Dropped: retired, not deleted, and no longer running.
      await answeringRefusal((consent) =>
        rides.replaceDayTimes(
          seeded.auth,
          seeded.rideId,
          [weekdayAt(seeded, otherWeekday, '09:30')],
          consent
        )
      );

      const dropped = await prisma.rideDaySchedule.findUniqueOrThrow({
        where: { id: seeded.scheduleId }
      });
      expect(dropped.retiredAt).toBeInstanceOf(Date);
      await expect(instancesOnTravelDate()).resolves.toEqual([]);
      await expect(rides.getById(seeded.auth, seeded.rideId)).resolves.toEqual(
        expect.objectContaining({
          daySchedules: [expect.objectContaining({ dayOfWeek: otherWeekday })]
        })
      );

      // Back again: the same row returns, and no second one is created.
      await answeringRefusal((consent) =>
        rides.replaceDayTimes(
          seeded.auth,
          seeded.rideId,
          [weekdayAt(seeded, weekday, '09:00'), weekdayAt(seeded, otherWeekday, '09:30')],
          consent
        )
      );

      rows = await prisma.rideDaySchedule.findMany({
        where: { rideId: seeded.rideId },
        include: { stationTimes: true },
        orderBy: { dayOfWeek: 'asc' }
      });
      expect(rows).toHaveLength(2);
      expect(rows.find((row) => row.dayOfWeek === weekday)).toEqual(
        expect.objectContaining({ id: seeded.scheduleId, retiredAt: null })
      );
      await expect(instancesOnTravelDate()).resolves.toEqual([
        expect.objectContaining({ departureTime: '09:00', source: 'BASE' })
      ]);
    });

    it('retires the weekdays of a ride made one-time, and restores them when it is recurring again', async () => {
      const weekday = travelWeekday();
      await prisma.reservation.create({
        data: reservationData(
          seeded,
          { departureKind: DepartureKind.RECURRING_BASE, rideDayScheduleId: seeded.scheduleId },
          1
        )
      });

      await answeringRefusal((consent) =>
        rides.update(seeded.auth, seeded.rideId, {
          type: RideType.ONE_TIME,
          recurringStartDate: null as never,
          oneTimeDate: seeded.otherTravelDate,
          oneTimeDepartureTime: '09:00',
          oneTimeArrivalTime: '11:00',
          daySchedules: [],
          confirmationTokens: [...consent.confirmationTokens]
        })
      );

      await expect(
        prisma.rideDaySchedule.findUniqueOrThrow({ where: { id: seeded.scheduleId } })
      ).resolves.toEqual(expect.objectContaining({ retiredAt: expect.any(Date) }));

      await rides.update(seeded.auth, seeded.rideId, {
        type: RideType.RECURRING,
        recurringStartDate: dateOnly(new Date(`${seeded.travelDate}T00:00:00.000Z`)),
        oneTimeDate: null as never,
        oneTimeDepartureTime: null as never,
        oneTimeArrivalTime: null as never,
        daySchedules: [weekdayAt(seeded, weekday, '09:00')]
      });

      await expect(
        prisma.rideDaySchedule.findMany({ where: { rideId: seeded.rideId } })
      ).resolves.toEqual([expect.objectContaining({ id: seeded.scheduleId, retiredAt: null })]);
    });

    it('does not report a retired weekday as drift after the ride moves to another line', async () => {
      const weekday = travelWeekday();
      const otherWeekday = (weekday + 1) % 7;
      await rides.replaceDayTimes(seeded.auth, seeded.rideId, [
        weekdayAt(seeded, weekday, '09:00'),
        weekdayAt(seeded, otherWeekday, '09:00')
      ]);
      await rides.replaceDayTimes(seeded.auth, seeded.rideId, [
        weekdayAt(seeded, otherWeekday, '09:00')
      ]);

      // A second line through a third station, so the retired weekday's
      // stations no longer describe the ride's route.
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
      const otherLineId = randomUUID();
      await prisma.line.create({
        data: {
          id: otherLineId,
          tenantId: seeded.auth.tenantId,
          name: 'Other line',
          departureStationId: seeded.stations.first,
          arrivalStationId: middle,
          directionMode: LineDirectionMode.SINGLE,
          direction: LineDirection.OUTBOUND,
          isActive: true,
          createdById: seeded.auth.sub,
          updatedById: seeded.auth.sub
        }
      });

      await rides.update(seeded.auth, seeded.rideId, {
        lineId: otherLineId,
        daySchedules: [
          {
            dayOfWeek: otherWeekday,
            stationTimes: [
              { stationId: seeded.stations.first, orderIndex: 0, time: '09:00' },
              { stationId: middle, orderIndex: 1, time: '10:00' }
            ]
          }
        ]
      });

      const { drifted } = await findDriftedSchedules({
        tenantId: seeded.auth.tenantId,
        actorId: seeded.auth.sub,
        prisma,
        windowDays: 30
      });
      expect(drifted).toEqual([]);
    });

    it('edits an additional departure in place, then retires it, and a re-created one is new', async () => {
      const created = await rides.addException(seeded.auth, seeded.rideId, {
        date: seeded.travelDate,
        type: RideExceptionType.ADDITIONAL,
        departureTime: '15:00',
        arrivalTime: '16:30'
      });
      const linked = await prisma.reservation.create({
        data: reservationData(
          seeded,
          { departureKind: DepartureKind.ADDITIONAL, rideExceptionId: created.id },
          1,
          { departure: '15:00', arrival: '16:30' }
        )
      });
      // Shares the old time but names nothing: a legacy row, which an edit must
      // not guess at moving.
      const legacy = await prisma.reservation.create({
        data: reservationData(seeded, { departureKind: null }, 2, {
          departure: '15:00',
          arrival: '16:30'
        })
      });

      const edited = await answeringRefusal((consent) =>
        rides.updateException(seeded.auth, seeded.rideId, created.id, {
          departureTime: '15:30',
          arrivalTime: '17:00',
          confirmationTokens: [...consent.confirmationTokens]
        })
      );

      expect(edited).toEqual(
        expect.objectContaining({ id: created.id, departureTime: '15:30', arrivalTime: '17:00' })
      );
      await expect(
        prisma.reservation.findUniqueOrThrow({ where: { id: linked.id } })
      ).resolves.toEqual(
        expect.objectContaining({ rideDepartureTime: '15:30', rideArrivalTime: '17:00' })
      );
      await expect(
        prisma.reservation.findUniqueOrThrow({ where: { id: legacy.id } })
      ).resolves.toEqual(
        expect.objectContaining({ rideDepartureTime: '15:00', rideArrivalTime: '16:30' })
      );

      await answeringRefusal((consent) =>
        rides.removeException(seeded.auth, seeded.rideId, created.id, consent)
      );

      await expect(
        prisma.rideException.findUniqueOrThrow({ where: { id: created.id } })
      ).resolves.toEqual(expect.objectContaining({ retiredAt: expect.any(Date) }));
      await expect(rides.getById(seeded.auth, seeded.rideId)).resolves.toEqual(
        expect.objectContaining({ exceptions: [] })
      );
      expect((await instancesOnTravelDate()).map((item) => item.source)).toEqual(['BASE']);

      // A retired departure is gone for every exception operation.
      await expect(
        rides.updateException(seeded.auth, seeded.rideId, created.id, {
          departureTime: '18:00',
          arrivalTime: '19:30'
        })
      ).rejects.toThrow('Ride exception not found');
      await expect(rides.removeException(seeded.auth, seeded.rideId, created.id)).rejects.toThrow(
        'Ride exception not found'
      );

      const recreated = await rides.addException(seeded.auth, seeded.rideId, {
        date: seeded.travelDate,
        type: RideExceptionType.ADDITIONAL,
        departureTime: '15:30',
        arrivalTime: '17:00'
      });
      expect(recreated.id).not.toBe(created.id);
    });

    it('refuses to move an additional departure onto the times of another', async () => {
      const first = await rides.addException(seeded.auth, seeded.rideId, {
        date: seeded.travelDate,
        type: RideExceptionType.ADDITIONAL,
        departureTime: '15:00',
        arrivalTime: '16:30'
      });
      await rides.addException(seeded.auth, seeded.rideId, {
        date: seeded.travelDate,
        type: RideExceptionType.ADDITIONAL,
        departureTime: '18:00',
        arrivalTime: '19:30'
      });

      await expect(
        rides.updateException(seeded.auth, seeded.rideId, first.id, {
          departureTime: '18:00',
          arrivalTime: '19:30'
        })
      ).rejects.toThrow('Additional exception with the same date and times already exists');
    });
  });
});
