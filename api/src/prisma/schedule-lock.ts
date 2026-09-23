import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * The one lock every writer that depends on a tenant's schedule agrees on.
 *
 * Reservation writers take it shared: two bookings never wait on each other
 * here, only on the per-departure lock that follows it. Anything that changes
 * what the schedule materializes, or rewrites reservations wholesale — a
 * guarded edit, a repair, realignment — takes it exclusive. The edit therefore
 * waits for bookings already in flight, then runs alone: its before and after
 * scans see every committed booking, and no booking can start until it commits.
 *
 * This only works at READ COMMITTED. Under SERIALIZABLE the snapshot is taken
 * by the first statement, before an advisory lock has finished waiting, so a
 * transaction that locks and then reads still reads the world as it was before
 * the holder committed.
 *
 * Postgres queues a new shared request behind a waiting exclusive one, so a
 * steady stream of bookings cannot starve an edit.
 *
 * Keys use the two-integer form, which Postgres keeps apart from the one-bigint
 * form the per-departure locks use, so the two can never collide.
 */
const TENANT_SCHEDULE_LOCK_NAMESPACE = 27_001;

/**
 * How long a reservation writer waits for a schedule edit before giving up.
 *
 * A starting figure: the rehearsal on a restored backup measures how long the
 * largest tenant's guarded edit holds the lock, and this is tuned from that.
 */
export const RESERVATION_LOCK_TIMEOUT_MS = 10_000;

const LOCK_NOT_AVAILABLE = '55P03';

// Spelled out rather than read from `Prisma.TransactionIsolationLevel`, which
// is the same string, so scripts that stub the client can still load this.
const READ_COMMITTED = 'ReadCommitted' as const satisfies Prisma.TransactionIsolationLevel;

/** Room for the lock wait plus the work behind it. */
const RESERVATION_WRITE_OPTIONS = {
  isolationLevel: READ_COMMITTED,
  maxWait: 5_000,
  timeout: RESERVATION_LOCK_TIMEOUT_MS + 20_000
};

const SCHEDULE_EDIT_OPTIONS = {
  isolationLevel: READ_COMMITTED,
  maxWait: 5_000,
  timeout: 30_000
};

export type ScheduleLockRoot = {
  $transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      isolationLevel?: Prisma.TransactionIsolationLevel;
      maxWait?: number;
      timeout?: number;
    }
  ): Promise<T>;
};

/**
 * The refusal a booking gets when an edit held the schedule for longer than it
 * was willing to wait. Nothing was written and nothing is retried behind the
 * operator's back: they are told to try again.
 */
export function scheduleBeingUpdated(): ConflictException {
  return new ConflictException({
    code: 'SCHEDULE_BEING_UPDATED',
    retryable: true,
    message: 'Red voznje se upravo azurira. Pokusajte ponovo za nekoliko sekundi.'
  });
}

/**
 * Takes the tenant's schedule lock shared, waiting at most `timeoutMs`.
 *
 * Call it before the transaction reads anything it will decide on: under READ
 * COMMITTED every later statement then sees whatever an edit committed while
 * this one waited.
 */
export async function acquireScheduleLockShared(
  tx: Prisma.TransactionClient,
  tenantId: string,
  timeoutMs = RESERVATION_LOCK_TIMEOUT_MS
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('lock_timeout', ${`${timeoutMs}ms`}, true)`;

  try {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(${TENANT_SCHEDULE_LOCK_NAMESPACE}::integer, hashtext(${tenantId}))`;
  } catch (error) {
    if (isLockTimeout(error)) {
      throw scheduleBeingUpdated();
    }

    throw error;
  }

  // The timeout is for this wait only. Row locks taken later in the booking
  // keep whatever the database is configured with.
  await tx.$executeRaw`SET LOCAL lock_timeout TO DEFAULT`;
}

/**
 * Shared locks on several tenants, for a writer whose batch spans them. Sorted,
 * so two such writers cannot each hold what the other is waiting for.
 */
export async function acquireScheduleLocksShared(
  tx: Prisma.TransactionClient,
  tenantIds: readonly string[]
): Promise<void> {
  for (const tenantId of [...new Set(tenantIds)].sort()) {
    await acquireScheduleLockShared(tx, tenantId);
  }
}

/** Takes the tenant's schedule lock exclusive, waiting as long as it takes. */
export async function acquireScheduleLockExclusive(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TENANT_SCHEDULE_LOCK_NAMESPACE}::integer, hashtext(${tenantId}))`;
}

/** A transaction for anything that writes reservations. */
export function reservationWriteTransaction<T>(
  prisma: ScheduleLockRoot,
  tenantId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await acquireScheduleLockShared(tx, tenantId);

    return work(tx);
  }, RESERVATION_WRITE_OPTIONS);
}

/**
 * A transaction for anything that changes what the schedule materializes, or
 * rewrites reservations as a maintenance operation.
 */
export function scheduleEditTransaction<T>(
  prisma: ScheduleLockRoot,
  tenantId: string,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { timeout?: number } = {}
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await acquireScheduleLockExclusive(tx, tenantId);

      return work(tx);
    },
    { ...SCHEDULE_EDIT_OPTIONS, ...options }
  );
}

/**
 * Whether Postgres gave up waiting for a lock. Prisma reports a failed raw
 * statement with the database's own code in `meta.code`, and repeats it in the
 * message; either is enough.
 */
export function isLockTimeout(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const { meta, message } = error as { meta?: { code?: unknown }; message?: unknown };

  return (
    meta?.code === LOCK_NOT_AVAILABLE ||
    (typeof message === 'string' && message.includes(LOCK_NOT_AVAILABLE))
  );
}
