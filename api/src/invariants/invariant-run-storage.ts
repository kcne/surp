import { Prisma } from '@prisma/client';
import { InvariantResultDto } from './dto/invariant.response.dto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Invariant snapshots contain operational passenger details. Ninety days keeps
 * enough evidence for investigation without turning every nightly repetition
 * into permanent passenger history.
 */
export const INVARIANT_RUN_RETENTION_DAYS = 90;

/** Remove expired snapshots before adding another one. */
export async function pruneExpiredInvariantRuns(
  prisma: PrismaService,
  tenantId?: string,
  now = new Date()
): Promise<void> {
  const cutoff = new Date(now.getTime() - INVARIANT_RUN_RETENTION_DAYS * 86_400_000);

  await prisma.invariantRun.deleteMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      createdAt: { lt: cutoff }
    }
  });
}

/**
 * Phone numbers and email addresses are useful while a check is running, but
 * are not needed to identify the same violation on a later run. Keep them out
 * of the historical JSON snapshot.
 */
export function invariantResultsForStorage(results: InvariantResultDto[]): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(results, (key, value) =>
      /(?:phone|email)$/i.test(key) ? undefined : value
    )
  ) as Prisma.InputJsonValue;
}
