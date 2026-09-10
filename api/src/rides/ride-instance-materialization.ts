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
export function materializeInstanceTimesForDate(
  ride: MaterializationRide,
  exceptionsForDate: MaterializationException[],
  targetDate: string,
  targetDayOfWeek: number
): MaterializedInstanceTimes[] {
  const baseInstances: MaterializedInstanceTimes[] = [];

  if (ride.type === RideType.RECURRING && ride.recurringStartDate) {
    const startDate = formatDateOnly(ride.recurringStartDate)!;
    const endDate = formatDateOnly(ride.recurringEndDate) ?? null;
    const dateInRange = targetDate >= startDate && (!endDate || targetDate <= endDate);

    const daySchedule = ride.daySchedules.find((entry) => entry.dayOfWeek === targetDayOfWeek);
    const orderedStationTimes = daySchedule
      ? [...daySchedule.stationTimes].sort((left, right) => left.orderIndex - right.orderIndex)
      : [];

    // The route's own order decides the instance times: the first station's
    // time is the departure and the last station's is the arrival. Reordering
    // a route therefore renames every instance on it.
    const departureTime = orderedStationTimes[0]?.time ?? null;
    const arrivalTime = orderedStationTimes[orderedStationTimes.length - 1]?.time ?? null;

    if (dateInRange && departureTime && arrivalTime) {
      baseInstances.push({ departureTime, arrivalTime, source: 'BASE' });
    }
  }

  if (ride.type === RideType.ONE_TIME) {
    const oneTimeDate = formatDateOnly(ride.oneTimeDate) ?? null;

    if (oneTimeDate === targetDate && ride.oneTimeDepartureTime && ride.oneTimeArrivalTime) {
      baseInstances.push({
        departureTime: ride.oneTimeDepartureTime,
        arrivalTime: ride.oneTimeArrivalTime,
        source: 'BASE'
      });
    }
  }

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
