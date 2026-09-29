import { Prisma } from '@prisma/client';

/**
 * Row-locks departures, in ID order, for a transaction that writes their
 * reservations (#27, PR 3b).
 *
 * This replaces the per-departure advisory lock keyed on
 * `rideId : travelDate : rideDepartureTime`. That key was a time copy, so a
 * route edit that moved the time split one bus into two locking domains and a
 * seat could be sold twice (#14, #18). The departure row is the bus itself, so
 * every writer of its seats waits on the same lock whatever time it carries.
 *
 * Callers hold the tenant's schedule lock shared first, and take these after
 * it: a schedule edit holds it exclusive and never waits on a departure row,
 * so the two cannot deadlock. The ID order is what keeps two writers that
 * touch several departures, a round trip or a passenger merge, from each
 * holding one the other is waiting for.
 */
export async function lockDepartures(
  tx: Prisma.TransactionClient,
  departureIds: Iterable<string | null | undefined>
): Promise<void> {
  const ids = [...new Set([...departureIds].filter((id): id is string => Boolean(id)))].sort();

  if (ids.length === 0) {
    return;
  }

  // Postgres locks rows as the sort hands them over, so ORDER BY is the lock order.
  await tx.$queryRaw`SELECT id FROM "Departure" WHERE id = ANY(${ids}::text[]) ORDER BY id FOR UPDATE`;
}
