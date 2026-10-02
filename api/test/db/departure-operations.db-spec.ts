import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DepartureSource, ReservationStatus, RideExceptionType } from '@prisma/client';
import { insertExtraDeparture } from '../../src/departures/departure-operations';
import { syncDepartures } from '../../src/departures/departure-sync';
import { DeparturesService } from '../../src/departures/departures.service';
import { SYSTEM_ACTOR_ID } from '../../src/departures/system-actor';
import { departureMatchesExceptions } from '../../src/invariants/checks/departure-matches-exceptions';
import { departureMatchesTimetable } from '../../src/invariants/checks/departure-matches-timetable';
import { buildOrphanReport } from '../../src/invariants/checks/reservation-reachable';
import { InvariantContext } from '../../src/invariants/invariant.types';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RidesService } from '../../src/rides/rides.service';
import { removeTenant, Seeded, seedTenant } from './db-fixtures';

/**
 * Departure operations against a real Postgres (#27, PR 3d): cancelling and
 * restoring a departure, and adding, editing and deleting an extra bus. Every
 * operation also keeps the exception rows the ride screen reads, so both
 * departure checks stay clean after each one.
 */

describe('departure operations (real database)', () => {
  let prisma: PrismaService;
  let departures: DeparturesService;
  let rides: RidesService;
  let seeded: Seeded;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    departures = new DeparturesService(prisma);
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

  function context(): InvariantContext {
    return { tenantId: seeded.auth.tenantId, actorId: seeded.auth.sub, prisma, windowDays: 30 };
  }

  async function expectChecksClean(): Promise<void> {
    expect((await departureMatchesTimetable.check(context())).violations).toEqual([]);
    expect((await departureMatchesExceptions.check(context())).violations).toEqual([]);
  }

  function scheduled() {
    return prisma.departure.findFirstOrThrow({
      where: {
        rideId: seeded.rideId,
        serviceDate: new Date(seeded.travelDate),
        source: DepartureSource.SCHEDULE
      }
    });
  }

  function exceptionsOnTravelDate() {
    return prisma.rideException.findMany({
      where: { rideId: seeded.rideId, exceptionDate: new Date(seeded.travelDate) },
      select: { id: true, type: true, departureTime: true, arrivalTime: true }
    });
  }

  function addExtra(overrides: Partial<{ departureTime: string; arrivalTime: string; capacity: number }> = {}) {
    return departures.createExtra(seeded.auth, {
      rideId: seeded.rideId,
      serviceDate: seeded.travelDate,
      departureTime: '15:00',
      arrivalTime: '17:00',
      ...overrides
    });
  }

  function book(
    departureId: string,
    {
      time = '09:00',
      seatNumber = 1,
      status = ReservationStatus.ACTIVE
    }: { time?: string; seatNumber?: number; status?: ReservationStatus } = {}
  ) {
    return prisma.reservation.create({
      data: {
        tenantId: seeded.auth.tenantId,
        rideId: seeded.rideId,
        passengerId: seeded.passengerId,
        travelDate: new Date(seeded.travelDate),
        rideDepartureTime: time,
        rideArrivalTime: time === '09:00' ? '11:00' : '17:00',
        seatNumber,
        departureStationId: seeded.stations.first,
        arrivalStationId: seeded.stations.last,
        departureId,
        status,
        cancelledAt: status === ReservationStatus.CANCELLED ? new Date() : null,
        createdById: seeded.auth.sub,
        updatedById: seeded.auth.sub
      }
    });
  }

  async function refusalOf(refused: Promise<unknown>): Promise<unknown> {
    return refused.then(
      () => {
        throw new Error('expected the write to be refused');
      },
      (reason: unknown) => reason
    );
  }

  function responseOf(refusal: unknown) {
    expect(refusal).toBeInstanceOf(ConflictException);

    return (refusal as ConflictException).getResponse() as {
      code?: string;
      invariant?: string;
      confirmationToken: string;
    };
  }

  function confirmed(token: string) {
    return { confirmationTokens: [token] };
  }

  describe('cancel and restore a timetable departure', () => {
    it('cancels an unbooked departure without asking, with its SKIP, and restores both', async () => {
      const departure = await scheduled();

      const cancelled = await departures.cancel(seeded.auth, departure.id, {});

      expect(cancelled).toMatchObject({
        id: departure.id,
        cancelledById: seeded.auth.sub,
        cancelledAt: expect.any(Date)
      });
      expect(await exceptionsOnTravelDate()).toEqual([
        expect.objectContaining({ type: RideExceptionType.SKIP })
      ]);
      await expectChecksClean();

      const restored = await departures.restore(seeded.auth, departure.id);

      expect(restored).toMatchObject({ cancelledAt: null, cancelledById: null });
      expect(await exceptionsOnTravelDate()).toEqual([]);
      await expectChecksClean();
    });

    it('asks before cancelling a booked departure, and leaves its passengers ACTIVE', async () => {
      const departure = await scheduled();
      const reservation = await book(departure.id);

      const response = responseOf(await refusalOf(departures.cancel(seeded.auth, departure.id, {})));

      expect(response).toMatchObject({
        code: 'WOULD_BREAK_RESERVATIONS',
        invariant: 'reservation.reachable'
      });
      // Refused, so nothing was written.
      expect((await scheduled()).cancelledAt).toBeNull();
      expect(await exceptionsOnTravelDate()).toEqual([]);

      await departures.cancel(seeded.auth, departure.id, confirmed(response.confirmationToken));

      expect((await scheduled()).cancelledAt).toEqual(expect.any(Date));
      expect(
        await prisma.reservation.findUniqueOrThrow({
          where: { id: reservation.id },
          select: { status: true, departureId: true }
        })
      ).toEqual({ status: ReservationStatus.ACTIVE, departureId: departure.id });
      await expectChecksClean();
    });

    it('completes a date whose SKIP was saved without its cancellation, without a second SKIP', async () => {
      const departure = await scheduled();
      await prisma.rideException.create({
        data: {
          tenantId: seeded.auth.tenantId,
          rideId: seeded.rideId,
          exceptionDate: new Date(seeded.travelDate),
          type: RideExceptionType.SKIP,
          createdById: seeded.auth.sub,
          updatedById: seeded.auth.sub
        }
      });

      await departures.cancel(seeded.auth, departure.id, {});

      expect(await exceptionsOnTravelDate()).toHaveLength(1);
      await expectChecksClean();
    });

    it('refuses to cancel twice, or to restore a running departure', async () => {
      const departure = await scheduled();

      expect(
        await refusalOf(departures.restore(seeded.auth, departure.id))
      ).toBeInstanceOf(ConflictException);

      await departures.cancel(seeded.auth, departure.id, {});

      expect(
        await refusalOf(departures.cancel(seeded.auth, departure.id, {}))
      ).toBeInstanceOf(ConflictException);
    });

    it('keeps the cancellation through a timetable edit', async () => {
      const departure = await scheduled();
      await departures.cancel(seeded.auth, departure.id, {});

      await rides.update(seeded.auth, seeded.rideId, { capacity: 30 });

      expect(await scheduled()).toMatchObject({
        id: departure.id,
        capacity: 30,
        cancelledById: seeded.auth.sub
      });
      await expectChecksClean();
    });

    it('cancels the timetable bus on a date that also has an extra, which keeps running', async () => {
      const extra = await addExtra();
      const departure = await scheduled();

      await departures.cancel(seeded.auth, departure.id, {});

      expect(await exceptionsOnTravelDate()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: RideExceptionType.SKIP }),
          expect.objectContaining({ type: RideExceptionType.ADDITIONAL, departureTime: '15:00' })
        ])
      );
      expect((await departures.getById(seeded.auth, extra.id)).cancelledAt).toBeNull();
      await expectChecksClean();
    });
  });

  describe('extra buses', () => {
    it('adds an extra with its ADDITIONAL, its own capacity and the whole line path', async () => {
      const extra = await addExtra({ capacity: 20 });

      expect(extra).toMatchObject({
        source: DepartureSource.EXTRA,
        serviceDate: seeded.travelDate,
        departureTime: '15:00',
        arrivalTime: '17:00',
        capacity: 20,
        cancelledAt: null,
        stops: [
          expect.objectContaining({ stationId: seeded.stations.first, time: '15:00' }),
          expect.objectContaining({ stationId: seeded.stations.last, time: '17:00' })
        ]
      });
      const [additional] = await exceptionsOnTravelDate();
      expect(additional).toMatchObject({
        type: RideExceptionType.ADDITIONAL,
        departureTime: '15:00',
        arrivalTime: '17:00'
      });
      expect(
        (await prisma.departure.findUniqueOrThrow({ where: { id: extra.id } })).rideExceptionId
      ).toBe(additional.id);
      await expectChecksClean();

      // The ride's capacity is not the extra's.
      await rides.update(seeded.auth, seeded.rideId, { capacity: 30 });
      expect((await departures.getById(seeded.auth, extra.id)).capacity).toBe(20);
      await expectChecksClean();
    });

    it("starts an extra at its ride's capacity when none is given", async () => {
      expect((await addExtra()).capacity).toBe(48);
    });

    it('adds an extra on a date whose timetable bus is cancelled', async () => {
      await departures.cancel(seeded.auth, (await scheduled()).id, {});

      await addExtra();

      await expectChecksClean();
    });

    it('refuses an extra at the time of another departure, a date outside the window, and an unknown ride', async () => {
      expect(responseOf(await refusalOf(addExtra({ departureTime: '09:00' })))).toMatchObject({
        code: 'DEPARTURE_TIME_TAKEN'
      });
      expect(
        await refusalOf(
          departures.createExtra(seeded.auth, {
            rideId: seeded.rideId,
            serviceDate: '2020-01-06',
            departureTime: '15:00',
            arrivalTime: '17:00'
          })
        )
      ).toBeInstanceOf(BadRequestException);
      expect(
        await refusalOf(
          departures.createExtra(seeded.auth, {
            rideId: seeded.rideId,
            serviceDate: '2026-02-30',
            departureTime: '15:00',
            arrivalTime: '17:00'
          })
        )
      ).toBeInstanceOf(BadRequestException);
      expect(await refusalOf(addExtra({ arrivalTime: '15:00' }))).toBeInstanceOf(
        BadRequestException
      );
      expect(
        await refusalOf(
          departures.createExtra(seeded.auth, {
            rideId: 'no-such-ride',
            serviceDate: seeded.travelDate,
            departureTime: '15:00',
            arrivalTime: '17:00'
          })
        )
      ).toBeInstanceOf(NotFoundException);
      expect(await exceptionsOnTravelDate()).toEqual([]);
    });

    it('cancels an extra by taking its ADDITIONAL away, and restores it with a new one', async () => {
      const extra = await addExtra();

      await departures.cancel(seeded.auth, extra.id, {});

      expect(
        await prisma.departure.findUniqueOrThrow({
          where: { id: extra.id },
          select: { cancelledById: true, rideExceptionId: true }
        })
      ).toEqual({ cancelledById: seeded.auth.sub, rideExceptionId: null });
      expect(await exceptionsOnTravelDate()).toEqual([]);
      await expectChecksClean();

      const restored = await departures.restore(seeded.auth, extra.id);

      expect(restored).toMatchObject({ id: extra.id, cancelledAt: null, departureTime: '15:00' });
      const [additional] = await exceptionsOnTravelDate();
      expect(additional).toMatchObject({
        type: RideExceptionType.ADDITIONAL,
        departureTime: '15:00',
        arrivalTime: '17:00'
      });
      expect(
        (await prisma.departure.findUniqueOrThrow({ where: { id: extra.id } })).rideExceptionId
      ).toBe(additional.id);
      await expectChecksClean();
    });

    it('refuses to restore an extra whose time another departure has taken', async () => {
      const extra = await addExtra();
      await departures.cancel(seeded.auth, extra.id, {});
      // A pair stored before PR 3a, the only way left to take the time.
      await prisma.$transaction(async (tx) => {
        const exception = await tx.rideException.create({
          data: {
            tenantId: seeded.auth.tenantId,
            rideId: seeded.rideId,
            exceptionDate: new Date(seeded.travelDate),
            type: RideExceptionType.ADDITIONAL,
            departureTime: '15:00',
            arrivalTime: '16:00',
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
            departureTime: '15:00',
            arrivalTime: '16:00'
          },
          { allowSameTime: true }
        );
      });

      expect(responseOf(await refusalOf(departures.restore(seeded.auth, extra.id)))).toMatchObject({
        code: 'DEPARTURE_TIME_TAKEN'
      });
      expect((await departures.getById(seeded.auth, extra.id)).cancelledAt).not.toBeNull();
    });

    it('moves an unbooked extra and resizes it, with its stops and its ADDITIONAL', async () => {
      const extra = await addExtra();

      const edited = await departures.updateExtra(seeded.auth, extra.id, {
        departureTime: '16:00',
        arrivalTime: '18:30',
        capacity: 30
      });

      expect(edited).toMatchObject({
        departureTime: '16:00',
        arrivalTime: '18:30',
        capacity: 30,
        stops: [
          expect.objectContaining({ time: '16:00' }),
          expect.objectContaining({ time: '18:30' })
        ]
      });
      expect(await exceptionsOnTravelDate()).toEqual([
        expect.objectContaining({ departureTime: '16:00', arrivalTime: '18:30' })
      ]);
      await expectChecksClean();

      // A timetable write keeps the operator's times and capacity.
      await rides.update(seeded.auth, seeded.rideId, { capacity: 40 });
      expect(await departures.getById(seeded.auth, extra.id)).toMatchObject({
        departureTime: '16:00',
        capacity: 30
      });
    });

    it('asks before moving a booked extra, then moves its reservations with it', async () => {
      const extra = await addExtra();
      const reservation = await book(extra.id, { time: '15:00' });

      const response = responseOf(
        await refusalOf(departures.updateExtra(seeded.auth, extra.id, { departureTime: '16:00' }))
      );

      expect(response).toMatchObject({
        code: 'WOULD_BREAK_RESERVATIONS',
        invariant: 'reservation.departureTimeKept'
      });
      expect((await departures.getById(seeded.auth, extra.id)).departureTime).toBe('15:00');

      await departures.updateExtra(seeded.auth, extra.id, {
        departureTime: '16:00',
        ...confirmed(response.confirmationToken)
      });

      expect(
        await prisma.reservation.findUniqueOrThrow({
          where: { id: reservation.id },
          select: { rideDepartureTime: true, rideArrivalTime: true, departureId: true }
        })
      ).toEqual({ rideDepartureTime: '16:00', rideArrivalTime: '17:00', departureId: extra.id });
      await expectChecksClean();
    });

    it('asks before cutting an extra under a booked seat', async () => {
      const extra = await addExtra();
      await book(extra.id, { time: '15:00', seatNumber: 40 });

      const response = responseOf(
        await refusalOf(departures.updateExtra(seeded.auth, extra.id, { capacity: 30 }))
      );

      expect(response).toMatchObject({
        code: 'WOULD_BREAK_RESERVATIONS',
        invariant: 'reservation.seatWithinCapacity'
      });
      expect((await departures.getById(seeded.auth, extra.id)).capacity).toBe(48);

      // Raising it never asks.
      expect((await departures.updateExtra(seeded.auth, extra.id, { capacity: 60 })).capacity).toBe(
        60
      );
    });

    it('refuses to move an extra onto the time of another departure', async () => {
      const extra = await addExtra();

      expect(
        responseOf(
          await refusalOf(departures.updateExtra(seeded.auth, extra.id, { departureTime: '09:00' }))
        )
      ).toMatchObject({ code: 'DEPARTURE_TIME_TAKEN' });
      expect(
        await refusalOf(
          departures.updateExtra(seeded.auth, extra.id, { departureTime: '17:00' })
        )
      ).toBeInstanceOf(BadRequestException);
    });

    it('deletes an unbooked extra with its ADDITIONAL', async () => {
      const extra = await addExtra();

      const deleted = await departures.deleteExtra(seeded.auth, extra.id);

      expect(deleted).toMatchObject({ id: extra.id, departureTime: '15:00' });
      expect(await prisma.departure.findUnique({ where: { id: extra.id } })).toBeNull();
      expect(await exceptionsOnTravelDate()).toEqual([]);
      await expectChecksClean();
    });

    it('refuses to delete an extra a cancelled reservation still references', async () => {
      const extra = await addExtra();
      await book(extra.id, { time: '15:00', status: ReservationStatus.CANCELLED });

      expect(responseOf(await refusalOf(departures.deleteExtra(seeded.auth, extra.id)))).toMatchObject(
        { code: 'DEPARTURE_HAS_RESERVATIONS' }
      );
      expect(await prisma.departure.findUnique({ where: { id: extra.id } })).not.toBeNull();
      expect(await exceptionsOnTravelDate()).toHaveLength(1);
    });

    it('refuses to edit or delete a timetable departure', async () => {
      const departure = await scheduled();

      expect(
        await refusalOf(departures.updateExtra(seeded.auth, departure.id, { capacity: 30 }))
      ).toBeInstanceOf(ConflictException);
      expect(await refusalOf(departures.deleteExtra(seeded.auth, departure.id))).toBeInstanceOf(
        ConflictException
      );
    });
  });

  describe('the exception endpoints, as wrappers', () => {
    it('accepts a SKIP and an ADDITIONAL on one date, in either order', async () => {
      await rides.addException(seeded.auth, seeded.rideId, {
        date: seeded.travelDate,
        type: RideExceptionType.SKIP
      });
      await rides.addException(seeded.auth, seeded.rideId, {
        date: seeded.travelDate,
        type: RideExceptionType.ADDITIONAL,
        departureTime: '15:00',
        arrivalTime: '17:00'
      });

      expect((await scheduled()).cancelledAt).not.toBeNull();
      await expectChecksClean();
    });

    it('lets the ride screen undo what the departure endpoints did', async () => {
      const departure = await scheduled();
      await departures.cancel(seeded.auth, departure.id, {});
      const extra = await addExtra();
      const exceptions = await exceptionsOnTravelDate();

      for (const exception of exceptions) {
        await rides.removeException(seeded.auth, seeded.rideId, exception.id);
      }

      expect((await scheduled()).cancelledAt).toBeNull();
      expect(await prisma.departure.findUnique({ where: { id: extra.id } })).toBeNull();
      await expectChecksClean();
    });
  });

  describe('an extra and its ride capacity', () => {
    it("moves an extra still at its ride's capacity with the ride, and keeps a resized one", async () => {
      const copied = await addExtra();
      const viaRideScreen = await rides.addException(seeded.auth, seeded.rideId, {
        date: seeded.travelDate,
        type: RideExceptionType.ADDITIONAL,
        departureTime: '18:00',
        arrivalTime: '20:00'
      });
      const resized = await addExtra({
        departureTime: '21:00',
        arrivalTime: '23:00',
        capacity: 20
      });

      expect(viaRideScreen.capacity).toBe(48);

      await rides.update(seeded.auth, seeded.rideId, { capacity: 60 });

      const extras = await prisma.departure.findMany({
        where: { rideId: seeded.rideId, source: DepartureSource.EXTRA },
        select: { departureTime: true, capacity: true },
        orderBy: { departureTime: 'asc' }
      });
      expect(extras).toEqual([
        { departureTime: '15:00', capacity: 60 },
        { departureTime: '18:00', capacity: 60 },
        { departureTime: '21:00', capacity: 20 }
      ]);
      expect((await departures.getById(seeded.auth, copied.id)).capacity).toBe(60);
      expect((await departures.getById(seeded.auth, resized.id)).capacity).toBe(20);
      await expectChecksClean();
    });

    it("asks before a ride's capacity cut strands a seat on an extra that follows it", async () => {
      const extra = await addExtra();
      await book(extra.id, { time: '15:00', seatNumber: 45 });

      const response = responseOf(
        await refusalOf(rides.update(seeded.auth, seeded.rideId, { capacity: 40 }))
      );

      expect(response).toMatchObject({
        code: 'WOULD_BREAK_RESERVATIONS',
        invariant: 'reservation.seatWithinCapacity'
      });
      expect((await departures.getById(seeded.auth, extra.id)).capacity).toBe(48);
    });

    it("reports an extra's own capacity on the ride's exceptions", async () => {
      await addExtra({ capacity: 20 });

      const ride = await rides.getById(seeded.auth, seeded.rideId);

      expect(ride.exceptions).toEqual([
        expect.objectContaining({ type: RideExceptionType.ADDITIONAL, capacity: 20 })
      ]);
    });

    it("re-seats an orphan moving onto an extra within the extra's capacity, not the ride's", async () => {
      await departures.cancel(seeded.auth, (await scheduled()).id, {});
      await addExtra({ capacity: 20 });
      // A row with no departure at a time the date no longer has, so the
      // repair would move it onto the extra, the date's only bus.
      const orphan = await prisma.reservation.create({
        data: {
          tenantId: seeded.auth.tenantId,
          rideId: seeded.rideId,
          passengerId: seeded.passengerId,
          travelDate: new Date(seeded.travelDate),
          rideDepartureTime: '07:00',
          rideArrivalTime: '09:00',
          seatNumber: 35,
          departureStationId: seeded.stations.first,
          arrivalStationId: seeded.stations.last,
          status: ReservationStatus.ACTIVE,
          createdById: seeded.auth.sub,
          updatedById: seeded.auth.sub
        }
      });

      const report = await buildOrphanReport(context());
      const item = report.items.find((candidate) => candidate.reservationId === orphan.id);

      expect(item).toMatchObject({ targetDepartureTime: '15:00', canRepair: true });
      expect(item!.targetSeatNumber).toBeLessThanOrEqual(20);
    });
  });

  describe('an ADDITIONAL two extras share, stored before PR 3a', () => {
    async function sharedPair() {
      return prisma.$transaction(async (tx) => {
        const exception = await tx.rideException.create({
          data: {
            tenantId: seeded.auth.tenantId,
            rideId: seeded.rideId,
            exceptionDate: new Date(seeded.travelDate),
            type: RideExceptionType.ADDITIONAL,
            departureTime: '15:00',
            arrivalTime: '17:00',
            createdById: seeded.auth.sub,
            updatedById: seeded.auth.sub
          }
        });
        const scope = {
          tenantId: seeded.auth.tenantId,
          rideId: seeded.rideId,
          actorId: seeded.auth.sub
        };
        const extra = {
          rideExceptionId: exception.id,
          serviceDate: new Date(seeded.travelDate),
          departureTime: '15:00',
          arrivalTime: '17:00'
        };
        const first = await insertExtraDeparture(tx, scope, extra, { allowSameTime: true });
        const second = await insertExtraDeparture(tx, scope, extra, { allowSameTime: true });

        return { exceptionId: exception.id, first: first.id, second: second.id };
      });
    }

    it('stays while the other extra runs, when one is cancelled or deleted', async () => {
      const pair = await sharedPair();

      await departures.cancel(seeded.auth, pair.first, {});

      expect(
        await prisma.rideException.findUnique({ where: { id: pair.exceptionId } })
      ).not.toBeNull();
      expect(
        (await prisma.departure.findUniqueOrThrow({ where: { id: pair.second } })).rideExceptionId
      ).toBe(pair.exceptionId);

      await departures.deleteExtra(seeded.auth, pair.first);

      expect(
        await prisma.rideException.findUnique({ where: { id: pair.exceptionId } })
      ).not.toBeNull();

      await departures.deleteExtra(seeded.auth, pair.second);

      expect(await prisma.rideException.findUnique({ where: { id: pair.exceptionId } })).toBeNull();
    });
  });

  describe('an ADDITIONAL with no stored extra', () => {
    async function strayAdditional() {
      return prisma.rideException.create({
        data: {
          tenantId: seeded.auth.tenantId,
          rideId: seeded.rideId,
          exceptionDate: new Date(seeded.travelDate),
          type: RideExceptionType.ADDITIONAL,
          departureTime: '15:00',
          arrivalTime: '17:00',
          createdById: seeded.auth.sub,
          updatedById: seeded.auth.sub
        }
      });
    }

    it('holds its time against a restored, created or moved extra', async () => {
      const extra = await addExtra();
      await departures.cancel(seeded.auth, extra.id, {});
      await strayAdditional();

      expect(responseOf(await refusalOf(departures.restore(seeded.auth, extra.id)))).toMatchObject({
        code: 'DEPARTURE_TIME_TAKEN'
      });
      expect(responseOf(await refusalOf(addExtra()))).toMatchObject({
        code: 'DEPARTURE_TIME_TAKEN'
      });

      const other = await addExtra({ departureTime: '18:00', arrivalTime: '20:00' });

      expect(
        responseOf(
          await refusalOf(departures.updateExtra(seeded.auth, other.id, { departureTime: '15:00' }))
        )
      ).toMatchObject({ code: 'DEPARTURE_TIME_TAKEN' });
      expect(
        (await exceptionsOnTravelDate()).filter((row) => row.departureTime === '15:00')
      ).toHaveLength(1);
    });
  });

  describe('every operation', () => {
    it('refuses a LEGACY departure, a past date and another tenant', async () => {
      const legacy = await prisma.departure.create({
        data: {
          tenantId: seeded.auth.tenantId,
          rideId: seeded.rideId,
          lineId: seeded.lineId,
          serviceDate: new Date(seeded.travelDate),
          source: DepartureSource.LEGACY,
          departureTime: '06:00',
          arrivalTime: '08:00',
          capacity: 48,
          createdById: SYSTEM_ACTOR_ID,
          updatedById: SYSTEM_ACTOR_ID
        }
      });
      expect(await refusalOf(departures.cancel(seeded.auth, legacy.id, {}))).toBeInstanceOf(
        ConflictException
      );

      const past = await prisma.departure.create({
        data: {
          tenantId: seeded.auth.tenantId,
          rideId: seeded.rideId,
          lineId: seeded.lineId,
          serviceDate: new Date('2020-01-06'),
          source: DepartureSource.EXTRA,
          departureTime: '15:00',
          arrivalTime: '17:00',
          capacity: 48,
          createdById: SYSTEM_ACTOR_ID,
          updatedById: SYSTEM_ACTOR_ID
        }
      });
      expect(await refusalOf(departures.cancel(seeded.auth, past.id, {}))).toBeInstanceOf(
        BadRequestException
      );
      expect(await refusalOf(departures.deleteExtra(seeded.auth, past.id))).toBeInstanceOf(
        BadRequestException
      );

      const other = await seedTenant(prisma);

      try {
        const departure = await scheduled();

        const attempts = [
          () => departures.cancel(other.auth, departure.id, {}),
          () => departures.restore(other.auth, departure.id),
          () => departures.updateExtra(other.auth, departure.id, { capacity: 30 }),
          () => departures.deleteExtra(other.auth, departure.id),
          () =>
            departures.createExtra(other.auth, {
              rideId: seeded.rideId,
              serviceDate: seeded.travelDate,
              departureTime: '15:00',
              arrivalTime: '17:00'
            })
        ];

        for (const attempt of attempts) {
          expect(await refusalOf(attempt())).toBeInstanceOf(NotFoundException);
        }
      } finally {
        await removeTenant(prisma, other.auth.tenantId);
      }

      expect((await scheduled()).cancelledAt).toBeNull();
    });
  });
});
