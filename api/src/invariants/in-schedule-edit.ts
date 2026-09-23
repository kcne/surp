import { Prisma } from '@prisma/client';
import { scheduleEditTransaction } from '../prisma/schedule-lock';
import { InvariantContext } from './invariant.types';

/**
 * Runs a repair's reads and writes as a schedule edit.
 *
 * From the maintenance endpoint a repair gets a root client, and opens its own
 * transaction under the tenant's exclusive schedule lock, so the rows it plans
 * against cannot change under it. Inside a guarded write it is handed the
 * guard's transaction, which already holds that lock.
 */
export function inScheduleEdit<T>(
  ctx: InvariantContext,
  work: (ctx: InvariantContext) => Promise<T>
): Promise<T> {
  if (!('$transaction' in ctx.prisma)) {
    return work(ctx);
  }

  return scheduleEditTransaction(ctx.prisma, ctx.tenantId, (tx: Prisma.TransactionClient) =>
    // A fresh context: checks cache the window they read against the context
    // they were given, and this one must be read under the lock.
    work({ ...ctx, prisma: tx })
  );
}
