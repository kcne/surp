import { DepartureSource, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatDateOnly } from '../rides/ride-instance-materialization';

/**
 * Which stored departure a reservation belongs to, from the times it carries.
 *
 * Until PR 3 a booking names its departure by `rideId`, `travelDate` and
 * `rideDepartureTime`, so linking has to match on those. The rule is the one
 * the backfill (PR 2) and PR 3's old-tab handling use: the same ride, date and
 * exact departure time, among `SCHEDULE` and `EXTRA` departures, and exactly
 * one of them. Anything else is no match. Two buses leaving at the same time
 * (allowed since PR 4c) are the case this refuses to guess at: a wrong link
 * would count seats on the wrong bus.
 *
 * Whether the departure runs is not part of the match. A booking on a dropped
 * or cancelled departure is still on that departure, and the check lists it.
 */

type Db = PrismaService | Prisma.TransactionClient;

export const LINKABLE_SOURCES: readonly DepartureSource[] = [
  DepartureSource.SCHEDULE,
  DepartureSource.EXTRA
];

export interface DepartureLinkInput {
  tenantId: string;
  rideId: string;
  travelDate: Date;
  departureTime: string;
}

export async function resolveDepartureLink(
  db: Db,
  input: DepartureLinkInput
): Promise<string | null> {
  const candidates = await departureLinkCandidates(db, input);

  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * The IDs of up to two departures the times match: none, the one, or two to
 * show that the match is not unique.
 */
export async function departureLinkCandidates(
  db: Db,
  input: DepartureLinkInput
): Promise<string[]> {
  const candidates = await db.departure.findMany({
    where: {
      tenantId: input.tenantId,
      rideId: input.rideId,
      serviceDate: input.travelDate,
      departureTime: input.departureTime,
      source: { in: [...LINKABLE_SOURCES] }
    },
    select: { id: true },
    // Two are enough to know the match is not unique.
    take: 2
  });

  return candidates.map((candidate) => candidate.id);
}

export function departureLinkKey(rideId: string, serviceDate: Date, departureTime: string): string {
  return `${rideId}:${formatDateOnly(serviceDate)}:${departureTime}`;
}

/**
 * The same rule over many rows at once, for the check and the sandbox reset.
 * Maps each link key to the ID of its only departure, or to null when several
 * departures share it.
 */
export function indexLinkableDepartures(
  departures: ReadonlyArray<{
    id: string;
    rideId: string;
    serviceDate: Date;
    departureTime: string;
  }>
): Map<string, string | null> {
  const index = new Map<string, string | null>();

  for (const departure of departures) {
    const key = departureLinkKey(departure.rideId, departure.serviceDate, departure.departureTime);
    index.set(key, index.has(key) ? null : departure.id);
  }

  return index;
}

export function uniqueDepartureMatch(
  index: ReadonlyMap<string, string | null>,
  rideId: string,
  travelDate: Date,
  departureTime: string
): string | null {
  return index.get(departureLinkKey(rideId, travelDate, departureTime)) ?? null;
}
