import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DepartureSource, RideExceptionType } from '@prisma/client';
import { indexLinkableDepartures } from '../../src/departures/departure-link';
import { syncDepartures } from '../../src/departures/departure-sync';
import { insertExtraDeparture } from '../../src/departures/departure-operations';
import { SYSTEM_ACTOR_ID } from '../../src/departures/system-actor';
import { InternalSandboxService } from '../../src/internal-sandbox/internal-sandbox.service';
import {
  classifyDepartureLinks,
  reservationDepartureLinked
} from '../../src/invariants/checks/reservation-departure-linked';
import { reservationReachable } from '../../src/invariants/checks/reservation-reachable';
import { InvariantContext } from '../../src/invariants/invariant.types';
import {
  guardProspectiveWrite,
  NO_CONSENT,
  PROSPECTIVE_INVARIANTS
} from '../../src/invariants/prospective-write';
import { PrismaService } from '../../src/prisma/prisma.service';
import { scheduleEditTransaction } from '../../src/prisma/schedule-lock';
import { ReservationsService } from '../../src/reservations/reservations.service';
import { RidesService } from '../../src/rides/rides.service';
import { removeTenant, Seeded, seedTenant } from './db-fixtures';

/**
 * Bookings linking to their stored departure (#27, PR 1b and 3b), against a
 * real Postgres: the link a booking writes, what the timetable does to a
 * linked departure and its passengers' time copies, the repair, and the check.
 */

describe('departure links (real database)', () => {
  let prisma: PrismaService;
  let rides: RidesService;
  let reservations: ReservationsService;
  let seeded: Seeded;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    rides = new RidesService(prisma);
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

  function book(
    seatNumber: number,
    rideDepartureTime = '09:00',
    rideArrivalTime = '11:00',
    departureId?: string
  ) {
    return reservations.create(seeded.auth, {
      rideId: seeded.rideId,
      passengerId: seeded.passengerId,
      travelDate: seeded.travelDate,
      rideDepartureTime,
      rideArrivalTime,
      seatNumber,
      departureStationId: seeded.stations.first,
      arrivalStationId: seeded.stations.last,
      ...(departureId ? { departureId } : {})
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

  /** The refusal a guarded write answers with, for its token and what it offers. */
  async function refusalOf(
    refused: Promise<unknown>
  ): Promise<{ invariant: string; confirmationToken: string; repairable: boolean }> {
    const error = await refused.then(
      () => {
        throw new Error('expected the write to be refused');
      },
      (reason: unknown) => reason
    );
    expect(error).toBeInstanceOf(ConflictException);

    return (error as ConflictException).getResponse() as {
      invariant: string;
      confirmationToken: string;
      repairable: boolean;
    };
  }

  it('links a booking to its timetable departure', async () => {
    const [departure] = await departuresOnTravelDate();

    const reservation = await book(1);

    expect(await linkOf(reservation.id)).toBe(departure.id);
    expect(reservation.departureId).toBe(departure.id);
  });

  it('refuses an old tab when an extra bus leaves at the same time, and books either by departureId', async () => {
    const extraId = await prisma.$transaction(async (tx) => {
      const exception = await tx.rideException.create({
        data: {
          tenantId: seeded.auth.tenantId,
          rideId: seeded.rideId,
          exceptionDate: new Date(seeded.travelDate),
          type: RideExceptionType.ADDITIONAL,
          departureTime: '09:00',
          arrivalTime: '11:00',
          createdById: seeded.auth.sub,
          updatedById: seeded.auth.sub
        }
      });
      await insertExtraDeparture(
        tx,
        { tenantId: seeded.auth.tenantId, rideId: seeded.rideId, actorId: seeded.auth.sub },
        {
          rideExceptionId: exception.id,
          serviceDate: new Date(seeded.travelDate),
          departureTime: '09:00',
          arrivalTime: '11:00'
        }
      );

      return (await tx.departure.findFirstOrThrow({
        where: { rideExceptionId: exception.id },
        select: { id: true }
      })).id;
    });
    expect(await departuresOnTravelDate()).toHaveLength(2);

    await expect(book(1)).rejects.toMatchObject({
      response: { code: 'DEPARTURE_NOT_FOUND', message: expect.stringContaining('vise polazaka u 09:00') }
    });

    const onExtra = await book(1, '09:00', '11:00', extraId);
    expect(await linkOf(onExtra.id)).toBe(extraId);
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

    const reservation = await book(1, '15:00', '17:00');

    expect(await linkOf(reservation.id)).toBe(extra.id);
  });

  it('refuses a booking on a cancelled date', async () => {
    await rides.addException(seeded.auth, seeded.rideId, {
      date: seeded.travelDate,
      type: RideExceptionType.SKIP
    });

    await expect(book(1)).rejects.toMatchObject({
      response: { code: 'DEPARTURE_NOT_RUNNING' }
    });
  });

  it('keeps the link when the timetable drops a booked departure, and reservation.reachable lists it', async () => {
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

    expect((await reservationDepartureLinked.check(context())).violations).toEqual([]);
    expect((await reservationReachable.check(context())).violations).toEqual([
      expect.objectContaining({
        subjectId: reservation.id,
        canRepair: false,
        detail: expect.objectContaining({ reason: 'WEEKDAY_NOT_SCHEDULED' })
      })
    ]);
  });

  describe('a booked departure whose time changes (#27, PR 3b)', () => {
    const scope = () => ({ tenantId: seeded.auth.tenantId, actorId: seeded.auth.sub });
    const moveFirstStop = (tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0]) =>
      tx.rideDayScheduleStationTime.updateMany({
        where: { rideDayScheduleId: seeded.scheduleId, orderIndex: 0 },
        data: { time: '08:30' }
      });

    it('moves the time copies with the bus, so reservation.reachable has nothing to repair', async () => {
      const [departure] = await departuresOnTravelDate();
      const reservation = await book(1);

      await scheduleEditTransaction(prisma, scope(), moveFirstStop);

      expect(
        await prisma.reservation.findUniqueOrThrow({
          where: { id: reservation.id },
          select: { departureId: true, rideDepartureTime: true, rideArrivalTime: true, updatedById: true }
        })
      ).toEqual({
        departureId: departure.id,
        rideDepartureTime: '08:30',
        rideArrivalTime: '11:00',
        updatedById: seeded.auth.sub
      });
      expect((await reservationReachable.check(context())).violations).toEqual([]);
    });

    it('asks before the edit, and repairs nothing when confirmed', async () => {
      const [departure] = await departuresOnTravelDate();
      const reservation = await book(1);
      const refusal = await refusalOf(
        guardProspectiveWrite(prisma, scope(), PROSPECTIVE_INVARIANTS.rideUpdate, NO_CONSENT, moveFirstStop)
      );
      expect(refusal).toMatchObject({ invariant: 'reservation.departureTimeKept', repairable: false });
      expect((await departuresOnTravelDate())[0].departureTime).toBe('09:00');

      await guardProspectiveWrite(
        prisma,
        scope(),
        PROSPECTIVE_INVARIANTS.rideUpdate,
        { confirmationTokens: [refusal.confirmationToken], repairTokens: [] },
        moveFirstStop
      );

      expect(
        await prisma.reservation.findUniqueOrThrow({
          where: { id: reservation.id },
          select: { departureId: true, rideDepartureTime: true, seatNumber: true }
        })
      ).toEqual({ departureId: departure.id, rideDepartureTime: '08:30', seatNumber: 1 });
    });

    it('does not ask when the edit moves an unbooked departure', async () => {
      await expect(
        guardProspectiveWrite(prisma, scope(), PROSPECTIVE_INVARIANTS.rideUpdate, NO_CONSENT, moveFirstStop)
      ).resolves.not.toThrow();
    });

    it('refuses a tab that still shows the old time', async () => {
      const [departure] = await departuresOnTravelDate();
      await scheduleEditTransaction(prisma, scope(), moveFirstStop);

      await expect(book(1)).rejects.toMatchObject({ response: { code: 'DEPARTURE_NOT_FOUND' } });
      await expect(book(1, '09:00', '11:00', departure.id)).rejects.toMatchObject({
        response: { code: 'DEPARTURE_CHANGED' }
      });
      await expect(book(1, '08:30', '11:00', departure.id)).resolves.toMatchObject({
        departureId: departure.id
      });
    });
  });

  describe('reservation.reachable', () => {
    it('lists a passenger whose bus the timetable dropped, and moves them nowhere', async () => {
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

      const { violations } = await reservationReachable.check(context());

      expect(violations).toEqual([
        expect.objectContaining({
          subjectId: reservation.id,
          canRepair: false,
          detail: expect.objectContaining({ reason: 'WEEKDAY_NOT_SCHEDULED' })
        })
      ]);
      expect(reservationReachable.repair).toBeUndefined();
      expect(
        await prisma.reservation.findUniqueOrThrow({
          where: { id: reservation.id },
          select: { departureId: true, rideDepartureTime: true }
        })
      ).toEqual({ departureId: timetableBus.id, rideDepartureTime: '09:00' });
    });

    it('asks before a booked extra is removed, and a confirmation cancels it with its passenger on it', async () => {
      const exception = await rides.addException(seeded.auth, seeded.rideId, {
        date: seeded.travelDate,
        type: RideExceptionType.ADDITIONAL,
        departureTime: '15:00',
        arrivalTime: '17:00'
      });
      const extra = (await departuresOnTravelDate()).find(
        (departure) => departure.source === DepartureSource.EXTRA
      )!;
      const reservation = await book(1, '15:00', '17:00');
      const refusal = await refusalOf(rides.removeException(seeded.auth, seeded.rideId, exception.id));
      expect(refusal).toMatchObject({ invariant: 'reservation.reachable', repairable: false });

      await rides.removeException(seeded.auth, seeded.rideId, exception.id, {
        confirmationTokens: [refusal.confirmationToken],
        repairTokens: []
      });

      expect(await linkOf(reservation.id)).toBe(extra.id);
      expect(
        await prisma.departure.findUniqueOrThrow({
          where: { id: extra.id },
          select: { cancelledAt: true, cancelledById: true }
        })
      ).toEqual({ cancelledAt: expect.any(Date), cancelledById: seeded.auth.sub });
      expect((await reservationReachable.check(context())).violations).toEqual([
        expect.objectContaining({
          subjectId: reservation.id,
          detail: expect.objectContaining({ reason: 'DEPARTURE_CANCELLED' })
        })
      ]);
    });
  });

  describe('reservation.departureLinked', () => {
    it('is quiet for linked bookings on running departures', async () => {
      await book(1);
      await book(2);

      const result = await reservationDepartureLinked.check(context());

      expect(result).toEqual({ violations: [], scannedCount: 2 });
    });

    it('reports a link to the wrong bus', async () => {
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

      const rows = await prisma.reservation.findMany({
        where: { tenantId: seeded.auth.tenantId },
        select: {
          id: true,
          rideId: true,
          travelDate: true,
          rideDepartureTime: true,
          departureId: true,
          passenger: { select: { firstName: true, lastName: true } },
          departure: { select: { source: true, departureTime: true } }
        }
      });
      const departures = await prisma.departure.findMany({
        where: { tenantId: seeded.auth.tenantId },
        select: { id: true, rideId: true, serviceDate: true, departureTime: true }
      });
      const index = indexLinkableDepartures(departures);
      const reasons = classifyDepartureLinks(rows, index)
        .map((violation) => [violation.subjectId, violation.detail.reason])
        .sort();

      expect(reasons).toEqual([[wrong.id, 'WRONG_LINK']]);
    });
  });

  it('refuses a reservation without a departure (PR 5)', async () => {
    const booked = await book(1);

    await expect(
      prisma.$executeRaw`UPDATE "Reservation" SET "departureId" = NULL WHERE id = ${booked.id}`
    ).rejects.toThrow(/Code: `23502`/);
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

      const { violations } = await reservationDepartureLinked.check({
        ...context(),
        tenantId: tenant.id
      });
      expect(violations).toEqual([]);
    } finally {
      // Resetting again clears it the way it clears itself, then the tenant goes.
      await prisma.$transaction((tx) =>
        (
          sandbox as unknown as {
            clearTenantData(tx: unknown, tenantId: string): Promise<unknown>;
          }
        ).clearTenantData(tx, tenant.id)
      );
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });
});
