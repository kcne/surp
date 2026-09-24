import { AuditEventType, RideExceptionType, RideStatus, RideType } from '@prisma/client';
import { NO_CONSENT } from '../../src/invariants/prospective-write';
import { LinesService } from '../../src/lines/lines.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RidesService } from '../../src/rides/rides.service';
import { removeTenant, Seeded, seedTenant } from './db-fixtures';

/**
 * The domain audit triggers against a real Postgres.
 *
 * Every e2e spec mocks Prisma, so only a real database runs the triggers. These
 * cover the writes the old Prisma hook got wrong: ones that return a narrowed
 * row, ones that return relations, nested writes, and writes rolled back.
 */
describe('domain audit (real database)', () => {
  let prisma: PrismaService;
  let rides: RidesService;
  let lines: LinesService;
  let seeded: Seeded;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    rides = new RidesService(prisma);
    lines = new LinesService(prisma);
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

  function auditEventsFor(entityType: string, entityId: string) {
    return prisma.auditEvent.findMany({
      where: { tenantId: seeded.auth.tenantId, entityType, entityId },
      orderBy: { createdAt: 'asc' }
    });
  }

  function changesOf(event: {
    metadata: unknown;
  }): Record<string, { before: unknown; after: unknown }> {
    return (event.metadata as { changes: Record<string, { before: unknown; after: unknown }> })
      .changes;
  }

  it('creates a ride and records the whole row it created', async () => {
    const created = await rides.create(seeded.auth, {
      lineId: seeded.lineId,
      name: 'Audited ride',
      capacity: 30,
      type: RideType.ONE_TIME,
      oneTimeDate: seeded.travelDate,
      oneTimeDepartureTime: '14:00',
      oneTimeArrivalTime: '16:00'
    });

    const [event] = await auditEventsFor('Ride', created.id);
    expect(event).toMatchObject({
      type: AuditEventType.DOMAIN_CREATE,
      actorUserId: seeded.auth.sub
    });
    expect(changesOf(event)).toMatchObject({
      lineId: { after: seeded.lineId },
      name: { after: 'Audited ride' },
      capacity: { after: 30 },
      oneTimeDepartureTime: { after: '14:00' }
    });
  });

  it('cancels one date of a ride', async () => {
    const created = await rides.addException(seeded.auth, seeded.rideId, {
      date: seeded.travelDate,
      type: RideExceptionType.SKIP
    });

    expect(created).toMatchObject({ type: RideExceptionType.SKIP });
    const [event] = await auditEventsFor('RideException', created.id);
    expect(event).toMatchObject({
      type: AuditEventType.DOMAIN_CREATE,
      actorUserId: seeded.auth.sub
    });
    expect(changesOf(event)).toMatchObject({
      rideId: { after: seeded.rideId },
      type: { after: RideExceptionType.SKIP }
    });
  });

  it('adds and removes an additional departure', async () => {
    const created = await rides.addException(seeded.auth, seeded.rideId, {
      date: seeded.travelDate,
      type: RideExceptionType.ADDITIONAL,
      departureTime: '18:00',
      arrivalTime: '20:00'
    });

    await rides.removeException(seeded.auth, seeded.rideId, created.id, NO_CONSENT);

    const events = await auditEventsFor('RideException', created.id);
    expect(events.map((event) => event.type)).toEqual([
      AuditEventType.DOMAIN_CREATE,
      AuditEventType.DOMAIN_DELETE
    ]);
    expect(changesOf(events[0])).toMatchObject({
      rideId: { after: seeded.rideId },
      departureTime: { after: '18:00' },
      arrivalTime: { after: '20:00' }
    });
  });

  it('creates a line', async () => {
    const created = await lines.create(seeded.auth, {
      name: 'Audited line',
      departureStationId: seeded.stations.first,
      arrivalStationId: seeded.stations.last
    });

    const [event] = await auditEventsFor('Line', created.id);
    expect(event).toMatchObject({
      type: AuditEventType.DOMAIN_CREATE,
      actorUserId: seeded.auth.sub
    });
    expect(changesOf(event)).toMatchObject({ name: { after: 'Audited line' } });
  });

  it('records only the columns an update changed, not the relations it returned', async () => {
    await rides.remove(seeded.auth, seeded.rideId);

    const updates = (await auditEventsFor('Ride', seeded.rideId)).filter(
      (event) => event.type === AuditEventType.DOMAIN_UPDATE
    );
    expect(updates).toHaveLength(1);
    expect(changesOf(updates[0])).toEqual({ status: { before: 'ACTIVE', after: 'INACTIVE' } });
  });

  it('records the station times written inside a day schedule', async () => {
    const created = await rides.create(seeded.auth, {
      lineId: seeded.lineId,
      capacity: 30,
      type: RideType.RECURRING,
      recurringStartDate: seeded.travelDate,
      daySchedules: [
        {
          dayOfWeek: 1,
          stationTimes: [
            { stationId: seeded.stations.first, orderIndex: 0, time: '07:00' },
            { stationId: seeded.stations.last, orderIndex: 1, time: '09:00' }
          ]
        }
      ]
    });

    const events = await prisma.auditEvent.findMany({
      where: {
        tenantId: seeded.auth.tenantId,
        entityType: 'RideDayScheduleStationTime',
        type: AuditEventType.DOMAIN_CREATE,
        createdAt: { gte: new Date(created.createdAt) }
      }
    });
    expect(events.map((event) => changesOf(event).time)).toEqual(
      expect.arrayContaining([{ after: '07:00' }, { after: '09:00' }])
    );
  });

  it('leaves no record of a write that was rolled back', async () => {
    const before = await auditEventsFor('Ride', seeded.rideId);

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.ride.update({
          where: { id: seeded.rideId },
          data: { capacity: 12, updatedById: seeded.auth.sub }
        });
        throw new Error('rolled back');
      })
    ).rejects.toThrow('rolled back');

    expect(await auditEventsFor('Ride', seeded.rideId)).toHaveLength(before.length);
  });

  it('records a write made with raw SQL', async () => {
    await prisma.$executeRaw`UPDATE "Ride" SET "status" = 'INACTIVE' WHERE "id" = ${seeded.rideId}`;

    const [latest] = (await auditEventsFor('Ride', seeded.rideId)).reverse();
    expect(latest).toMatchObject({ type: AuditEventType.DOMAIN_UPDATE });
    expect(changesOf(latest)).toEqual({
      status: { before: RideStatus.ACTIVE, after: RideStatus.INACTIVE }
    });
  });

  it('refuses a write it cannot attribute to a user', async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO "RideException" ("id", "tenantId", "rideId", "exceptionDate", "type", "updatedAt")
        VALUES (gen_random_uuid()::text, ${seeded.auth.tenantId}, ${seeded.rideId},
                ${new Date(`${seeded.otherTravelDate}T00:00:00.000Z`)}, 'SKIP', now())`
    ).rejects.toThrow(/Cannot audit RideException/);
  });
});
