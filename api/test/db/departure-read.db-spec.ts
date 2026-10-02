import { NotFoundException } from '@nestjs/common';
import { DepartureSource, ReservationStatus } from '@prisma/client';
import { DeparturesService } from '../../src/departures/departures.service';
import { syncDepartures } from '../../src/departures/departure-sync';
import { SYSTEM_ACTOR_ID } from '../../src/departures/system-actor';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ReservationsService } from '../../src/reservations/reservations.service';
import { dateOnly, removeTenant, Seeded, seedTenant } from './db-fixtures';

/**
 * `GET /departures` against a real Postgres (#27, PR 3c): what is stored is
 * what is read, past and LEGACY rows included, and only the caller's tenant.
 */

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return dateOnly(shifted);
}

describe('departure reads (real database)', () => {
  let prisma: PrismaService;
  let departures: DeparturesService;
  let reservations: ReservationsService;
  let seeded: Seeded;
  let other: Seeded;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    departures = new DeparturesService(prisma);
    reservations = new ReservationsService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    seeded = await seedTenant(prisma);
    other = await seedTenant(prisma);

    for (const tenant of [seeded, other]) {
      await prisma.$transaction((tx) =>
        syncDepartures(tx, { tenantId: tenant.auth.tenantId, actorId: SYSTEM_ACTOR_ID })
      );
    }
  });

  afterEach(async () => {
    await removeTenant(prisma, seeded.auth.tenantId);
    await removeTenant(prisma, other.auth.tenantId);
  });

  async function storeDeparture(data: {
    source: DepartureSource;
    serviceDate: string;
    departureTime: string;
    arrivalTime: string;
  }): Promise<string> {
    const departure = await prisma.departure.create({
      data: {
        tenantId: seeded.auth.tenantId,
        rideId: seeded.rideId,
        lineId: seeded.lineId,
        serviceDate: new Date(data.serviceDate),
        source: data.source,
        departureTime: data.departureTime,
        arrivalTime: data.arrivalTime,
        capacity: 48,
        createdById: SYSTEM_ACTOR_ID,
        updatedById: SYSTEM_ACTOR_ID,
        // A LEGACY departure stores no route. The stops of any other go in last
        // first, so the read has to order them.
        stops: {
          create: (data.source === DepartureSource.LEGACY
            ? []
            : [
                { stationId: seeded.stations.last, orderIndex: 1, time: data.arrivalTime, isBoarding: false, isDropoff: true },
                { stationId: seeded.stations.first, orderIndex: 0, time: data.departureTime, isBoarding: true, isDropoff: false }
              ]
          ).map((stop) => ({
            ...stop,
            tenantId: seeded.auth.tenantId,
            createdById: SYSTEM_ACTOR_ID,
            updatedById: SYSTEM_ACTOR_ID
          }))
        }
      }
    });

    return departure.id;
  }

  it('reads past, LEGACY, extra and cancelled departures, ordered by date and time', async () => {
    const pastDate = shiftDate(seeded.travelDate, -21);
    const legacyId = await storeDeparture({
      source: DepartureSource.LEGACY,
      serviceDate: pastDate,
      departureTime: '08:15',
      arrivalTime: '10:15'
    });
    const extraId = await storeDeparture({
      source: DepartureSource.EXTRA,
      serviceDate: seeded.travelDate,
      departureTime: '07:00',
      arrivalTime: '09:00'
    });
    const scheduled = await prisma.departure.findFirstOrThrow({
      where: { rideId: seeded.rideId, serviceDate: new Date(seeded.travelDate), source: DepartureSource.SCHEDULE }
    });
    await prisma.departure.update({
      where: { id: scheduled.id },
      data: { cancelledAt: new Date(), cancelledById: seeded.auth.sub }
    });

    // The weekly ride also runs today, a week before its travel date.
    const today = shiftDate(seeded.travelDate, -7);
    const todays = await prisma.departure.findFirstOrThrow({
      where: { rideId: seeded.rideId, serviceDate: new Date(today) }
    });

    const result = await departures.list(seeded.auth, { from: pastDate, to: seeded.travelDate });

    expect(result.items.map((item) => [item.id, item.serviceDate, item.departureTime, item.source])).toEqual([
      [legacyId, pastDate, '08:15', DepartureSource.LEGACY],
      [todays.id, today, '09:00', DepartureSource.SCHEDULE],
      [extraId, seeded.travelDate, '07:00', DepartureSource.EXTRA],
      [scheduled.id, seeded.travelDate, '09:00', DepartureSource.SCHEDULE]
    ]);
    expect(result.items[3]).toMatchObject({ cancelledById: seeded.auth.sub, capacity: 48 });
    expect(result.items[3].cancelledAt).toBeInstanceOf(Date);
    expect(result.items[3].stops).toEqual([
      expect.objectContaining({ stationId: seeded.stations.first, orderIndex: 0, time: '09:00', isBoarding: true }),
      expect.objectContaining({ stationId: seeded.stations.last, orderIndex: 1, time: '11:00', isDropoff: true })
    ]);
    expect(result.items[3].stops[0].stationName).toMatch(/^First /);
    expect(result.items[0].stops).toEqual([]);
    expect(result.items[2].stops.map((stop) => [stop.stationId, stop.orderIndex])).toEqual([
      [seeded.stations.first, 0],
      [seeded.stations.last, 1]
    ]);
  });

  it('includes both ends of the range and nothing outside it', async () => {
    const result = await departures.list(seeded.auth, {
      from: seeded.travelDate,
      to: seeded.otherTravelDate
    });

    expect(result.items.map((item) => item.serviceDate)).toEqual([seeded.travelDate, seeded.otherTravelDate]);

    const inside = await departures.list(seeded.auth, {
      from: shiftDate(seeded.travelDate, 1),
      to: shiftDate(seeded.otherTravelDate, -1)
    });
    expect(inside.items).toEqual([]);
  });

  it('never reads another tenant, by list, by filter or by id', async () => {
    const own = await departures.list(seeded.auth, { from: seeded.travelDate, to: seeded.travelDate });
    expect(own.items.map((item) => item.rideId)).toEqual([seeded.rideId]);

    const foreignRide = await departures.list(seeded.auth, {
      from: seeded.travelDate,
      to: seeded.travelDate,
      rideId: other.rideId
    });
    expect(foreignRide.items).toEqual([]);

    const foreign = await prisma.departure.findFirstOrThrow({ where: { tenantId: other.auth.tenantId } });
    await expect(departures.getById(seeded.auth, foreign.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(departures.getById(other.auth, foreign.id)).resolves.toMatchObject({ id: foreign.id });
  });

  it('filters by ride', async () => {
    const byRide = await departures.list(seeded.auth, {
      from: seeded.travelDate,
      to: seeded.travelDate,
      rideId: seeded.rideId
    });
    expect(byRide.items.map((item) => item.rideId)).toEqual([seeded.rideId]);
  });

  it('filters by line', async () => {
    const byLine = await departures.list(seeded.auth, {
      from: seeded.travelDate,
      to: seeded.travelDate,
      lineId: seeded.lineId
    });
    expect(byLine.items).toHaveLength(1);

    const otherLine = await departures.list(seeded.auth, {
      from: seeded.travelDate,
      to: seeded.travelDate,
      lineId: other.lineId
    });
    expect(otherLine.items).toEqual([]);
  });

  function book(
    departureId: string,
    { seatNumber, status = ReservationStatus.ACTIVE }: { seatNumber: number; status?: ReservationStatus }
  ) {
    return prisma.reservation.create({
      data: {
        tenantId: seeded.auth.tenantId,
        rideId: seeded.rideId,
        passengerId: seeded.passengerId,
        travelDate: new Date(seeded.travelDate),
        rideDepartureTime: '09:00',
        rideArrivalTime: '11:00',
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

  it('counts ACTIVE reservations and seats left by departureId, in the list and by id (#27, PR 4a)', async () => {
    const scheduled = await prisma.departure.findFirstOrThrow({
      where: { rideId: seeded.rideId, serviceDate: new Date(seeded.travelDate), source: DepartureSource.SCHEDULE }
    });
    // An extra at the same date carries a reservation whose time copy says
    // 09:00: it is counted on the extra it references, not by its time.
    const extraId = await storeDeparture({
      source: DepartureSource.EXTRA,
      serviceDate: seeded.travelDate,
      departureTime: '07:00',
      arrivalTime: '09:00'
    });
    await book(scheduled.id, { seatNumber: 1 });
    await book(scheduled.id, { seatNumber: 2 });
    await book(scheduled.id, { seatNumber: 3, status: ReservationStatus.CANCELLED });
    await book(extraId, { seatNumber: 1 });

    const result = await departures.list(seeded.auth, { from: seeded.travelDate, to: seeded.travelDate });

    expect(
      result.items.map((item) => [item.id, item.capacity, item.activeReservationCount, item.availableSeats])
    ).toEqual([
      [extraId, 48, 1, 47],
      [scheduled.id, 48, 2, 46]
    ]);
    await expect(departures.getById(seeded.auth, scheduled.id)).resolves.toMatchObject({
      activeReservationCount: 2,
      availableSeats: 46
    });
  });

  it('never reports fewer than 0 seats left on a departure booked over its capacity', async () => {
    const scheduled = await prisma.departure.findFirstOrThrow({
      where: { rideId: seeded.rideId, serviceDate: new Date(seeded.travelDate), source: DepartureSource.SCHEDULE }
    });
    await prisma.departure.update({ where: { id: scheduled.id }, data: { capacity: 1 } });
    await book(scheduled.id, { seatNumber: 1 });
    await book(scheduled.id, { seatNumber: 2 });

    await expect(departures.getById(seeded.auth, scheduled.id)).resolves.toMatchObject({
      capacity: 1,
      activeReservationCount: 2,
      availableSeats: 0
    });
  });

  it('lists the reservations of one departure by departureId, whatever their time copies say', async () => {
    const scheduled = await prisma.departure.findFirstOrThrow({
      where: { rideId: seeded.rideId, serviceDate: new Date(seeded.travelDate), source: DepartureSource.SCHEDULE }
    });
    const extraId = await storeDeparture({
      source: DepartureSource.EXTRA,
      serviceDate: seeded.travelDate,
      departureTime: '07:00',
      arrivalTime: '09:00'
    });
    const onScheduled = await book(scheduled.id, { seatNumber: 1 });
    const cancelled = await book(scheduled.id, { seatNumber: 2, status: ReservationStatus.CANCELLED });
    const onExtra = await book(extraId, { seatNumber: 1 });

    const byDeparture = await reservations.list(seeded.auth, { departureId: scheduled.id });
    expect(byDeparture.items.map((item) => item.id).sort()).toEqual([onScheduled.id, cancelled.id].sort());
    expect(byDeparture.total).toBe(2);

    const activeOnExtra = await reservations.list(seeded.auth, {
      departureId: extraId,
      status: ReservationStatus.ACTIVE
    });
    expect(activeOnExtra.items.map((item) => item.id)).toEqual([onExtra.id]);

    const foreign = await reservations.list(other.auth, { departureId: scheduled.id });
    expect(foreign.items).toEqual([]);
  });
});
