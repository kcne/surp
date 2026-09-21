import { AuditEventType, Prisma } from '@prisma/client';

const TRACKED_MODELS = new Set([
  'Line',
  'LineStop',
  'RideDaySchedule',
  'RideDayScheduleStationTime',
  'Ride',
  'RideException',
  'Reservation'
]);

const MUTATING_OPERATIONS = new Set([
  'create',
  'update',
  'delete',
  'upsert',
  'createMany',
  'updateMany',
  'deleteMany'
]);

type RecordValue = Record<string, unknown>;

/**
 * Records the small, useful part of a domain write.  This deliberately sits at
 * Prisma's boundary: service methods do not need to remember a second write
 * whenever a route, timetable or reservation changes.
 *
 * `updatedById`/`createdById` are already required by the domain write helpers,
 * so the hook can attribute a row without introducing request-scoped state.
 */
export const domainAuditExtension = Prisma.defineExtension((prisma) =>
  prisma.$extends({
    name: 'domain-audit',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TRACKED_MODELS.has(model) || !MUTATING_OPERATIONS.has(operation)) {
            return query(args);
          }

          const delegate = (prisma as unknown as Record<string, unknown>)[lowerFirst(model)] as {
            findUnique: (input: RecordValue) => Promise<RecordValue | null>;
            findMany: (input: RecordValue) => Promise<RecordValue[]>;
          };
          const input = args as RecordValue;
          const before = await recordsBefore(delegate, operation, input);
          const result = await query(args);
          const after = recordsAfter(operation, input, result);

          await Promise.all(
            auditEntries(model, operation, before, after, input).map((entry) =>
              prisma.auditEvent.create({ data: entry })
            )
          );

          return result;
        }
      }
    }
  })
);

async function recordsBefore(
  delegate: { findUnique: (input: RecordValue) => Promise<RecordValue | null>; findMany: (input: RecordValue) => Promise<RecordValue[]> },
  operation: string,
  args: RecordValue
): Promise<RecordValue[]> {
  if (operation === 'create' || operation === 'createMany') return [];

  if (operation === 'update' || operation === 'delete' || operation === 'upsert') {
    const row = await delegate.findUnique({ where: args.where as RecordValue });
    return row ? [row] : [];
  }

  return delegate.findMany({ where: (args.where as RecordValue | undefined) ?? {} });
}

function recordsAfter(operation: string, args: RecordValue, result: unknown): RecordValue[] {
  if (operation === 'delete' || operation === 'deleteMany') return [];
  if (operation === 'createMany') return arrayOf(args.data);
  if (operation === 'updateMany') return [];
  if (operation === 'upsert') return [asRecord(result)];
  if (operation === 'create' || operation === 'update') return [asRecord(result)];
  return [];
}

function auditEntries(
  model: string,
  operation: string,
  before: RecordValue[],
  after: RecordValue[],
  args: RecordValue
): Prisma.AuditEventCreateManyInput[] {
  if (operation === 'updateMany') {
    return before.map((row) => entryFor(model, 'update', row, applyData(row, args.data)));
  }

  if (operation === 'deleteMany') return before.map((row) => entryFor(model, 'delete', row, undefined));

  if (operation === 'createMany') return after.map((row) => entryFor(model, 'create', undefined, row));

  if (operation === 'delete') return before.map((row) => entryFor(model, 'delete', row, undefined));

  const previous = before[0];
  const current = after[0];
  if (!current) return [];
  return [entryFor(model, previous ? 'update' : 'create', previous, current)];
}

function entryFor(
  model: string,
  action: 'create' | 'update' | 'delete',
  before?: RecordValue,
  after?: RecordValue
): Prisma.AuditEventCreateManyInput {
  const current = after ?? before!;
  const actorUserId = stringField(after, 'updatedById') ?? stringField(after, 'createdById') ?? stringField(before, 'updatedById') ?? stringField(before, 'createdById');
  const tenantId = stringField(current, 'tenantId');

  if (!actorUserId || !tenantId) {
    throw new Error(`Cannot audit ${model}: tenantId and an audit actor are required`);
  }

  const changes = changedFields(before, after);
  return {
    tenantId,
    actorUserId,
    entityType: model,
    entityId: stringField(current, 'id'),
    type:
      action === 'create'
        ? AuditEventType.DOMAIN_CREATE
        : action === 'delete'
          ? AuditEventType.DOMAIN_DELETE
          : AuditEventType.DOMAIN_UPDATE,
    metadata: { action, changes } as Prisma.InputJsonValue
  };
}

function changedFields(before?: RecordValue, after?: RecordValue): RecordValue {
  const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: RecordValue = {};

  for (const field of fields) {
    if (['id', 'tenantId', 'createdAt', 'updatedAt', 'createdById', 'updatedById'].includes(field)) continue;
    const previous = before?.[field];
    const current = after?.[field];
    if (!sameValue(previous, current)) changes[field] = { before: jsonValue(previous), after: jsonValue(current) };
  }

  return changes;
}

function applyData(row: RecordValue, data: unknown): RecordValue {
  const next = { ...row };
  for (const [field, value] of Object.entries(asRecord(data))) {
    next[field] = isRecord(value) && 'set' in value ? value.set : value;
  }
  return next;
}

function jsonValue(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(jsonValue(left)) === JSON.stringify(jsonValue(right));
}

function arrayOf(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.map(asRecord) : [asRecord(value)];
}

function asRecord(value: unknown): RecordValue {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringField(record: RecordValue | undefined, field: string): string | undefined {
  const value = record?.[field];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
