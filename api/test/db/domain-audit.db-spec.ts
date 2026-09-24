import { AuditEventType, RideExceptionType, RideType } from '@prisma/client';
import { NO_CONSENT } from '../../src/invariants/prospective-write';
import { LinesService } from '../../src/lines/lines.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RidesService } from '../../src/rides/rides.service';
import { removeTenant, Seeded, seedTenant } from './db-fixtures';

/**
 * The domain audit hook against a real Postgres.
 *
 * The hook attributes each write from the row the write returns. Services
 * narrow that row with `select`, and a mocked Prisma returns whatever the test
 * hands it, so only a real database shows what the hook actually receives.
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

  it('returns only the fields the caller selected', async () => {
    const created = await prisma.$transaction((tx) =>
      tx.rideException.create({
        data: {
          tenantId: seeded.auth.tenantId,
          rideId: seeded.rideId,
          exceptionDate: new Date(`${seeded.otherTravelDate}T00:00:00.000Z`),
          type: RideExceptionType.SKIP,
          createdById: seeded.auth.sub,
          updatedById: seeded.auth.sub
        },
        select: { id: true, type: true }
      })
    );

    expect(Object.keys(created).sort()).toEqual(['id', 'type']);
  });
});
