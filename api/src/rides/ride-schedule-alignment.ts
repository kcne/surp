import { Prisma } from '@prisma/client';
import { withCreateAudit } from '../prisma/audit-write.helper';

/**
 * A ride day schedule must mirror its line route exactly — `validateDaySchedules`
 * rejects any other shape. Changing a line's stops therefore invalidates every
 * stored schedule on that line: ride instances keep materializing from the
 * stale first and last station times, but the ride can no longer be updated,
 * because an update revalidates the stored schedule against the new route.
 *
 * These helpers are the single definition of "aligned" and of how to repair a
 * schedule, shared by the line update path, the maintenance endpoint and the
 * offline backfill script.
 */

export type ScheduleAlignmentDbClient = Prisma.TransactionClient;

export interface RouteShapedLine {
  departureStationId: string;
  arrivalStationId: string;
  intermediateStops: Array<{ stationId: string; orderIndex: number }>;
}

export interface ScheduleStationTime {
  stationId: string;
  orderIndex: number;
  time: string | null;
}

/** Station ids along a line, in travel order. */
export function routeStationIdsOf(line: RouteShapedLine): string[] {
  const intermediateIds = [...line.intermediateStops]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((stop) => stop.stationId);

  return [line.departureStationId, ...intermediateIds, line.arrivalStationId];
}

/**
 * An empty schedule carries no times and is always considered aligned; there is
 * nothing to preserve and nothing that would fail validation.
 */
export function isScheduleAlignedToRoute(
  stationTimes: ScheduleStationTime[],
  routeStationIds: string[]
): boolean {
  if (stationTimes.length === 0) {
    return true;
  }

  const ordered = [...stationTimes].sort((left, right) => left.orderIndex - right.orderIndex);

  return (
    ordered.length === routeStationIds.length &&
    ordered.every((stationTime, index) => stationTime.stationId === routeStationIds[index])
  );
}

export interface ScheduleDriftDetail {
  addedStationIds: string[];
  removedStationIds: string[];
  /**
   * Surviving stops the route moved past one another. Their times are carried
   * over as-is, so after a reorder the schedule can read out of sequence —
   * 08:00, 11:00, 09:00 — with every value a real one nobody flagged.
   */
  reorderedStationIds: string[];
}

/**
 * The stops that have to move to turn `before` into `after`: everything
 * outside a longest common subsequence of the two orders. Exact rather than
 * heuristic, and the lists are a handful of stops long.
 */
function findReorderedStationIds(before: string[], after: string[]): string[] {
  const lengths: number[][] = Array.from({ length: before.length + 1 }, () =>
    new Array<number>(after.length + 1).fill(0)
  );

  for (let left = before.length - 1; left >= 0; left -= 1) {
    for (let right = after.length - 1; right >= 0; right -= 1) {
      lengths[left][right] =
        before[left] === after[right]
          ? lengths[left + 1][right + 1] + 1
          : Math.max(lengths[left + 1][right], lengths[left][right + 1]);
    }
  }

  const kept = new Set<string>();
  let left = 0;
  let right = 0;

  while (left < before.length && right < after.length) {
    if (before[left] === after[right]) {
      kept.add(before[left]);
      left += 1;
      right += 1;
    } else if (lengths[left + 1][right] >= lengths[left][right + 1]) {
      left += 1;
    } else {
      right += 1;
    }
  }

  return before.filter((stationId) => !kept.has(stationId));
}

export function describeScheduleDrift(
  stationTimes: ScheduleStationTime[],
  routeStationIds: string[]
): ScheduleDriftDetail {
  const scheduleStationIds = new Set(stationTimes.map((stationTime) => stationTime.stationId));
  const routeSet = new Set(routeStationIds);

  const orderedScheduleIds = [...stationTimes]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((stationTime) => stationTime.stationId);

  // Only stops on both sides can have been reordered; added and removed ones
  // are already reported on their own.
  const survivingScheduleOrder = orderedScheduleIds.filter((stationId) => routeSet.has(stationId));
  const survivingRouteOrder = routeStationIds.filter((stationId) =>
    scheduleStationIds.has(stationId)
  );

  return {
    addedStationIds: routeStationIds.filter((stationId) => !scheduleStationIds.has(stationId)),
    removedStationIds: orderedScheduleIds.filter((stationId) => !routeSet.has(stationId)),
    reorderedStationIds: findReorderedStationIds(survivingScheduleOrder, survivingRouteOrder),
  };
}

/** Minutes added per stop when only a preceding or following time is known. */
export const DEFAULT_STOP_INTERVAL_MINUTES = 15;

const MINUTES_PER_DAY = 24 * 60;

function toMinutes(time: string): number | null {
  const match = time.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function toTimeString(minutes: number): string {
  const normalized = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const remainder = normalized % 60;

  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export interface AlignedStationTime {
  stationId: string;
  orderIndex: number;
  time: string | null;
  /** True when the time was derived rather than carried over from the schedule. */
  isEstimated: boolean;
}

/**
 * Builds the station times for a route, preserving what the schedule already
 * knows and estimating the rest.
 *
 * A blank time is not harmless: `listInstancesByDate` reads a ride's departure
 * and arrival from the first and last station time, and skips the ride entirely
 * when either is null. A stop added at the head or tail of a route would
 * therefore silently stop the ride from appearing at all.
 *
 * Estimation rules, applied per run of consecutive unknown stops:
 *  - between two known times, spread the run evenly across the gap;
 *  - after a known time only, add 15 minutes per stop;
 *  - before a known time only, subtract 15 minutes per stop.
 * A schedule with no known times at all is left alone — there is nothing to
 * anchor an estimate to.
 *
 * Estimates are a starting point for the operator, not a claim about the real
 * timetable, so callers surface how many were filled in.
 */
export function buildAlignedStationTimes(
  routeStationIds: string[],
  existingStationTimes: ScheduleStationTime[]
): AlignedStationTime[] {
  const timeByStationId = new Map(
    existingStationTimes.map((stationTime) => [stationTime.stationId, stationTime.time])
  );

  const knownMinutes = routeStationIds.map((stationId) => {
    const time = timeByStationId.get(stationId);
    return time ? toMinutes(time) : null;
  });

  const resolved: Array<number | null> = [...knownMinutes];

  for (let index = 0; index < resolved.length; index += 1) {
    if (knownMinutes[index] !== null) {
      continue;
    }

    // Extend to the end of this run of unknown stops.
    let runEnd = index;
    while (runEnd + 1 < resolved.length && knownMinutes[runEnd + 1] === null) {
      runEnd += 1;
    }

    const runLength = runEnd - index + 1;
    const previous = index > 0 ? resolved[index - 1] : null;
    const nextKnownIndex = runEnd + 1 < resolved.length ? runEnd + 1 : -1;
    const next = nextKnownIndex === -1 ? null : knownMinutes[nextKnownIndex];

    if (previous !== null && next !== null) {
      // Overnight legs wrap past midnight, so keep the gap positive.
      const span = next >= previous ? next - previous : next + MINUTES_PER_DAY - previous;
      const step = span / (runLength + 1);

      for (let offset = 0; offset < runLength; offset += 1) {
        resolved[index + offset] = Math.round(previous + step * (offset + 1));
      }
    } else if (previous !== null) {
      for (let offset = 0; offset < runLength; offset += 1) {
        resolved[index + offset] = previous + DEFAULT_STOP_INTERVAL_MINUTES * (offset + 1);
      }
    } else if (next !== null) {
      for (let offset = 0; offset < runLength; offset += 1) {
        resolved[index + offset] = next - DEFAULT_STOP_INTERVAL_MINUTES * (runLength - offset);
      }
    }

    index = runEnd;
  }

  return routeStationIds.map((stationId, index) => {
    const existing = timeByStationId.get(stationId) ?? null;
    const minutes = resolved[index];

    return {
      stationId,
      orderIndex: index,
      time: existing ?? (minutes === null ? null : toTimeString(minutes)),
      isEstimated: existing === null && minutes !== null
    };
  });
}

export interface DayScheduleRealignInput {
  rideDayScheduleId: string;
  stationTimes: ScheduleStationTime[];
  routeStationIds: string[];
}

export interface ScheduleRealignOutcome {
  realignedScheduleCount: number;
  estimatedTimeCount: number;
  /** Schedules whose surviving stops changed order, so their times may now read out of sequence. */
  reorderedScheduleIds: string[];
}

/**
 * Rewrites day schedules so they mirror their route. Stations that survive the
 * change keep their times, matched by station id; stations new to a route get
 * no time, for an operator to fill in from the schedule screen.
 *
 * The rows are replaced wholesale rather than patched in place: both
 * (schedule, station) and (schedule, orderIndex) are unique, so shifting stops
 * one by one would collide partway through.
 *
 * Every schedule is rewritten in two statements regardless of how many there
 * are. A per-schedule pair of round-trips runs inside the caller's transaction,
 * and a line with enough rides would blow its timeout and roll the route change
 * back with it.
 */
export async function realignDaySchedulesTx(
  tx: ScheduleAlignmentDbClient,
  input: {
    tenantId: string;
    actorId: string;
    schedules: DayScheduleRealignInput[];
  }
): Promise<ScheduleRealignOutcome> {
  if (input.schedules.length === 0) {
    return { realignedScheduleCount: 0, estimatedTimeCount: 0, reorderedScheduleIds: [] };
  }

  const rows: Array<{
    tenantId: string;
    rideDayScheduleId: string;
    stationId: string;
    orderIndex: number;
    time: string | null;
  }> = [];

  let estimatedTimeCount = 0;
  const reorderedScheduleIds: string[] = [];

  for (const schedule of input.schedules) {
    const aligned = buildAlignedStationTimes(schedule.routeStationIds, schedule.stationTimes);
    estimatedTimeCount += aligned.filter((stationTime) => stationTime.isEstimated).length;

    const { reorderedStationIds } = describeScheduleDrift(
      schedule.stationTimes,
      schedule.routeStationIds
    );

    if (reorderedStationIds.length > 0) {
      reorderedScheduleIds.push(schedule.rideDayScheduleId);
    }

    aligned.forEach((stationTime) => {
      rows.push({
        tenantId: input.tenantId,
        rideDayScheduleId: schedule.rideDayScheduleId,
        stationId: stationTime.stationId,
        orderIndex: stationTime.orderIndex,
        time: stationTime.time,
      });
    });
  }

  await tx.rideDayScheduleStationTime.deleteMany({
    where: {
      rideDayScheduleId: {
        in: input.schedules.map((schedule) => schedule.rideDayScheduleId),
      },
      tenantId: input.tenantId,
    },
  });

  await tx.rideDayScheduleStationTime.createMany({
    data: rows.map((row) => withCreateAudit(row, input.actorId)),
  });

  return {
    realignedScheduleCount: input.schedules.length,
    estimatedTimeCount,
    reorderedScheduleIds,
  };
}

/** Single-schedule convenience over {@link realignDaySchedulesTx}. */
export async function realignDayScheduleTx(
  tx: ScheduleAlignmentDbClient,
  input: {
    tenantId: string;
    rideDayScheduleId: string;
    stationTimes: ScheduleStationTime[];
    routeStationIds: string[];
    actorId: string;
  }
): Promise<ScheduleRealignOutcome> {
  return realignDaySchedulesTx(tx, {
    tenantId: input.tenantId,
    actorId: input.actorId,
    schedules: [
      {
        rideDayScheduleId: input.rideDayScheduleId,
        stationTimes: input.stationTimes,
        routeStationIds: input.routeStationIds,
      },
    ],
  });
}
