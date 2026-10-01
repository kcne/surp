import { NotFoundException } from '@nestjs/common';
import { DepartureSource } from '@prisma/client';
import { DeparturesService } from '../../src/departures/departures.service';
import { syncDepartures } from '../../src/departures/departure-sync';
import { SYSTEM_ACTOR_ID } from '../../src/departures/system-actor';
import { PrismaService } from '../../src/prisma/prisma.service';
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
  let seeded: Seeded;
  let other: Seeded;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    departures = new DeparturesService(prisma);
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
});
