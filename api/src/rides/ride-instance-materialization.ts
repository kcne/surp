import { RideExceptionType, RideType } from '@prisma/client';

/**
 * Ride instances are never stored. A ride plus a date is turned into zero or
 * more instances on read, and a reservation is joined back to one of them by
 * `rideId : travelDate : rideDepartureTime`. That makes the times produced here
 * the identity of an instance, so every reader has to derive them the same way
 * — a second implementation that drifts would hide reservations rather than
 * merely disagree.
 */

export interface MaterializationSchedule {
  dayOfWeek: number;
  stationTimes: Array<{ orderIndex: number; time: string | null }>;
}

export interface MaterializationException {
  type: RideExceptionType;
  departureTime: string | null;
  arrivalTime: string | null;
}

export interface MaterializationRide {
  type: RideType;
  recurringStartDate: Date | null;
  recurringEndDate: Date | null;
  oneTimeDate: Date | null;
  oneTimeDepartureTime: string | null;
  oneTimeArrivalTime: string | null;
  daySchedules: MaterializationSchedule[];
}

export interface MaterializedInstanceTimes {
  departureTime: string;
  arrivalTime: string;
  source: 'BASE' | 'ADDITIONAL';
}

/**
 * Why a ride's base run produces no instance on a date.
 *
 * A date that materializes nothing looks identical from the outside whatever
 * the cause, but an agency can only act once it knows which one it is facing:
 * a weekday dropped from the schedule is a decision somebody has to make,
 * while a missing station time is a field somebody has to fill in.
 */
export type BaseInstanceGap =
  /** The date falls outside the period the ride runs in at all. */
  | 'DATE_OUTSIDE_RANGE'
  /** The ride runs, but carries no schedule for this day of the week. */
  | 'WEEKDAY_NOT_SCHEDULED'
  /** The day is scheduled, but its first or last station carries no time. */
  | 'SCHEDULE_TIME_MISSING';

export type BaseInstanceOutcome =
  | { runs: true; departureTime: string; arrivalTime: string }
  | { runs: false; gap: BaseInstanceGap };

export function formatDateOnly(value: Date | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.toISOString().slice(0, 10);
}

export function utcDateOf(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function dayOfWeekOf(dateString: string): number {
  return utcDateOf(dateString).getUTCDay();
}

/**
 * Produces the instance times a ride runs at on one date.
 *
 * `exceptionsForDate` must already be narrowed to `targetDate`: a SKIP there
 * removes the base instance entirely, and each ADDITIONAL adds one.
 */
/**
 * Decides whether a ride's own schedule runs on a date, and says why not when
 * it does not.
 *
 * Exceptions are deliberately not consulted here: this answers what the ride
 * itself says about the date, which is what both the materializer and the
 * reachability check need before they can interpret a SKIP sitting on top of
 * it.
 */
export function baseInstanceForDate(
  ride: MaterializationRide,
  targetDate: string,
  targetDayOfWeek: number
): BaseInstanceOutcome {
  if (ride.type === RideType.ONE_TIME) {
    if (formatDateOnly(ride.oneTimeDate) !== targetDate) {
      return { runs: false, gap: 'DATE_OUTSIDE_RANGE' };
    }

    if (!ride.oneTimeDepartureTime || !ride.oneTimeArrivalTime) {
      return { runs: false, gap: 'SCHEDULE_TIME_MISSING' };
    }

    return {
      runs: true,
      departureTime: ride.oneTimeDepartureTime,
      arrivalTime: ride.oneTimeArrivalTime
    };
  }

  // A recurring ride without a start date has no period to run in, so no date
  // is inside it.
  if (!ride.recurringStartDate) {
    return { runs: false, gap: 'DATE_OUTSIDE_RANGE' };
  }

  const startDate = formatDateOnly(ride.recurringStartDate)!;
  const endDate = formatDateOnly(ride.recurringEndDate) ?? null;

  if (targetDate < startDate || (endDate && targetDate > endDate)) {
    return { runs: false, gap: 'DATE_OUTSIDE_RANGE' };
  }

  const daySchedule = ride.daySchedules.find((entry) => entry.dayOfWeek === targetDayOfWeek);

  if (!daySchedule) {
    return { runs: false, gap: 'WEEKDAY_NOT_SCHEDULED' };
  }

  const orderedStationTimes = [...daySchedule.stationTimes].sort(
    (left, right) => left.orderIndex - right.orderIndex
  );

  // The route's own order decides the instance times: the first station's time
  // is the departure and the last station's is the arrival. Reordering a route
  // therefore renames every instance on it.
  const departureTime = orderedStationTimes[0]?.time ?? null;
  const arrivalTime = orderedStationTimes[orderedStationTimes.length - 1]?.time ?? null;

  if (!departureTime || !arrivalTime) {
    return { runs: false, gap: 'SCHEDULE_TIME_MISSING' };
  }

  return { runs: true, departureTime, arrivalTime };
}

/**
 * Produces the instance times a ride runs at on one date.
 *
 * `exceptionsForDate` must already be narrowed to `targetDate`: a SKIP there
 * removes the base instance entirely, and each ADDITIONAL adds one.
 */
export function materializeInstanceTimesForDate(
  ride: MaterializationRide,
  exceptionsForDate: MaterializationException[],
  targetDate: string,
  targetDayOfWeek: number
): MaterializedInstanceTimes[] {
  const base = baseInstanceForDate(ride, targetDate, targetDayOfWeek);
  const baseInstances: MaterializedInstanceTimes[] = base.runs
    ? [{ departureTime: base.departureTime, arrivalTime: base.arrivalTime, source: 'BASE' }]
    : [];

  const hasSkip = exceptionsForDate.some((item) => item.type === RideExceptionType.SKIP);
  const additionalInstances = exceptionsForDate
    .filter((item) => item.type === RideExceptionType.ADDITIONAL)
    .filter((item) => Boolean(item.departureTime && item.arrivalTime))
    .map((item) => ({
      departureTime: item.departureTime!,
      arrivalTime: item.arrivalTime!,
      source: 'ADDITIONAL' as const
    }));

  return [...(hasSkip ? [] : baseInstances), ...additionalInstances];
}
