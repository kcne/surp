import { Prisma } from '@prisma/client';
import { withCreateAudit } from '../prisma/audit-write.helper';

/**
 * A BOTH pair describes one physical route travelled in two directions, so the
 * two lines should carry the same intermediate stops in opposite order. Their
 * endpoints may legitimately differ — a route can return from a different
 * terminus than it departs to — so only the intermediate stops are compared.
 */

export interface PairedRouteLine {
  id: string;
  departureStationId: string;
  arrivalStationId: string;
  intermediateStops: Array<{ stationId: string; orderIndex: number }>;
}

export function orderedStopIds(line: PairedRouteLine): string[] {
  return [...line.intermediateStops]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((stop) => stop.stationId);
}

/** True when every element of `needle` appears in `haystack`, in order. */
export function isSubsequence(needle: string[], haystack: string[]): boolean {
  let cursor = 0;

  for (const value of haystack) {
    if (cursor < needle.length && needle[cursor] === value) {
      cursor += 1;
    }
  }

  return cursor === needle.length;
}

export type PairRouteMerge =
  | { merged: string[]; conflict?: undefined }
  | { merged?: undefined; conflict: string };

/**
 * Reconciles the two directions of a pair into one stop order.
 *
 * Only merges when one side's stops are a subsequence of the other's, i.e. the
 * difference is purely stops missing from one direction. That is what a missed
 * sync looks like, and the richer side is then the correct answer.
 *
 * When each side holds stops the other lacks, or holds them in a different
 * relative order, the routes genuinely disagree. There is no safe way to guess
 * which is intended, so the conflict is reported and nothing is written.
 */
export function mergePairedRoutes(
  forwardStopIds: string[],
  oppositeStopIdsReversed: string[]
): PairRouteMerge {
  if (isSubsequence(oppositeStopIdsReversed, forwardStopIds)) {
    return { merged: forwardStopIds };
  }

  if (isSubsequence(forwardStopIds, oppositeStopIdsReversed)) {
    return { merged: oppositeStopIdsReversed };
  }

  return {
    conflict:
      'Smerovi imaju razlicit redosled stanica, ne samo stanice koje nedostaju — uskladite ih rucno'
  };
}

/**
 * Stops for one direction, taken from the merged order and filtered so that a
 * stop never repeats that line's own departure or arrival station.
 */
export function stopsForDirection(
  line: PairedRouteLine,
  mergedStopIds: string[],
  reverse: boolean
): Array<{ stationId: string; orderIndex: number }> {
  const ordered = reverse ? [...mergedStopIds].reverse() : mergedStopIds;

  return ordered
    .filter(
      (stationId) =>
        stationId !== line.departureStationId && stationId !== line.arrivalStationId
    )
    .map((stationId, index) => ({ stationId, orderIndex: index + 1 }));
}

export async function writeLineStopsTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  lineId: string,
  actorId: string,
  stops: Array<{ stationId: string; orderIndex: number }>
): Promise<void> {
  await tx.lineStop.deleteMany({
    where: {
      lineId,
      tenantId
    }
  });

  if (!stops.length) {
    return;
  }

  await tx.lineStop.createMany({
    data: stops.map((stop) =>
      withCreateAudit(
        {
          tenantId,
          lineId,
          stationId: stop.stationId,
          orderIndex: stop.orderIndex
        },
        actorId
      )
    )
  });
}

/** Every station on a line's route, endpoints included. */
export function fullRouteStationIds(line: PairedRouteLine): string[] {
  return [line.departureStationId, ...orderedStopIds(line), line.arrivalStationId];
}

/**
 * Termini of `line` that appear nowhere on `other`'s route.
 *
 * A return ticket swaps the outbound leg's two stations and looks for them on
 * the opposite direction's route (`buildReturnRequests`). A terminus missing
 * from the other direction therefore makes a return ticket impossible for every
 * passenger travelling to or from it, and the booking screen rejects it with a
 * message about the chosen stations rather than about the route setup.
 *
 * Unlike a missing intermediate stop this is never auto-repaired: putting a
 * terminus onto the other direction means deciding where along that route the
 * bus calls at it, which the data cannot answer.
 */
export function unreachableTermini(line: PairedRouteLine, other: PairedRouteLine): string[] {
  const otherRoute = new Set(fullRouteStationIds(other));

  return [line.departureStationId, line.arrivalStationId].filter(
    (stationId) => !otherRoute.has(stationId)
  );
}
