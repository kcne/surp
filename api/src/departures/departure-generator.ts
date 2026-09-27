import { RideExceptionType, RideStatus, RideType } from '@prisma/client';
import {
  MaterializationRide,
  baseInstanceForDate,
  dayOfWeekOf
} from '../rides/ride-instance-materialization';
import { addDays } from './agency-date';

/**
 * What the timetable says should run, as departures.
 *
 * A pure function of the timetable: the sync compares its output with the
 * stored rows, and `departure.matchesTimetable` reports any difference, so the
 * two can only agree if they call the same code. `baseInstanceForDate` stays
 * the one rule for whether a ride runs on a date and at what times.
 */

export interface GeneratorStationTime {
  stationId: string;
  orderIndex: number;
  time: string | null;
}

export interface GeneratorRide extends MaterializationRide {
  id: string;
  lineId: string;
  capacity: number;
  status: RideStatus;
  line: {
    isActive: boolean;
    departureStationId: string;
    arrivalStationId: string;
    intermediateStops: Array<{ stationId: string; isBoarding: boolean; isDropoff: boolean }>;
  };
  daySchedules: Array<{ dayOfWeek: number; stationTimes: GeneratorStationTime[] }>;
}

export interface GeneratorException {
  id: string;
  rideId: string;
  /** `YYYY-MM-DD`. */
  exceptionDate: string;
  type: RideExceptionType;
  departureTime: string | null;
  arrivalTime: string | null;
  createdAt: Date;
  createdById: string | null;
  updatedById: string | null;
}

export interface PlannedStop {
  stationId: string;
  orderIndex: number;
  time: string | null;
  isBoarding: boolean;
  isDropoff: boolean;
}

export interface PlannedCancellation {
  at: Date;
  by: string;
}

export interface PlannedDeparture {
  /** `schedule:<rideId>:<date>` or `extra:<rideExceptionId>`. */
  key: string;
  source: 'SCHEDULE' | 'EXTRA';
  rideId: string;
  /** `YYYY-MM-DD`. */
  serviceDate: string;
  lineId: string;
  departureTime: string;
  arrivalTime: string;
  capacity: number;
  rideExceptionId: string | null;
  /**
   * Until PR 3, a SKIP exception is how a person cancels a date, so it is
   * mirrored as the cancellation, credited to whoever wrote the SKIP.
   */
  cancellation: PlannedCancellation | null;
  stops: PlannedStop[];
}

export function scheduleKey(rideId: string, serviceDate: string): string {
  return `schedule:${rideId}:${serviceDate}`;
}

export function extraKey(rideExceptionId: string): string {
  return `extra:${rideExceptionId}`;
}

/** Only an ACTIVE ride on an active line has departures. */
export function rideRuns(ride: Pick<GeneratorRide, 'status' | 'line'>): boolean {
  return ride.status === RideStatus.ACTIVE && ride.line.isActive;
}

/**
 * The flags booking already applies (`routeBoardingDropoffSets`): the first
 * stop is boarding only, the last drop-off only, and a stop in between keeps
 * its line stop's flags.
 */
function stopFlags(
  ride: GeneratorRide,
  stationId: string,
  position: number,
  count: number
): Pick<PlannedStop, 'isBoarding' | 'isDropoff'> {
  if (position === 0) {
    return { isBoarding: true, isDropoff: false };
  }

  if (position === count - 1) {
    return { isBoarding: false, isDropoff: true };
  }

  const lineStop = ride.line.intermediateStops.find((stop) => stop.stationId === stationId);

  return { isBoarding: lineStop?.isBoarding ?? true, isDropoff: lineStop?.isDropoff ?? true };
}

/** Only the line's endpoints are known for a one-time ride or an extra bus. */
function endpointStops(
  ride: GeneratorRide,
  departureTime: string,
  arrivalTime: string
): PlannedStop[] {
  return [
    {
      stationId: ride.line.departureStationId,
      orderIndex: 0,
      time: departureTime,
      isBoarding: true,
      isDropoff: false
    },
    {
      stationId: ride.line.arrivalStationId,
      orderIndex: 1,
      time: arrivalTime,
      isBoarding: false,
      isDropoff: true
    }
  ];
}

function scheduleStops(
  ride: GeneratorRide,
  dayOfWeek: number,
  departureTime: string,
  arrivalTime: string
): PlannedStop[] {
  if (ride.type === RideType.ONE_TIME) {
    return endpointStops(ride, departureTime, arrivalTime);
  }

  const schedule = ride.daySchedules.find((entry) => entry.dayOfWeek === dayOfWeek)!;
  const ordered = [...schedule.stationTimes].sort(
    (left, right) => left.orderIndex - right.orderIndex
  );

  return ordered.map((entry, position) => ({
    stationId: entry.stationId,
    orderIndex: entry.orderIndex,
    time: entry.time,
    ...stopFlags(ride, entry.stationId, position, ordered.length)
  }));
}

function cancellationOf(skip: GeneratorException | undefined): PlannedCancellation | null {
  const by = skip?.updatedById ?? skip?.createdById;

  return skip && by ? { at: skip.createdAt, by } : null;
}

/**
 * Every departure the timetable produces from `from` to `to`, both included.
 *
 * `exceptions` may hold any dates; only those inside the window are used.
 */
export function generateDepartures(
  rides: readonly GeneratorRide[],
  exceptions: readonly GeneratorException[],
  from: string,
  to: string
): PlannedDeparture[] {
  const planned: PlannedDeparture[] = [];
  const exceptionsByRideDate = new Map<string, GeneratorException[]>();

  exceptions
    .filter((exception) => exception.exceptionDate >= from && exception.exceptionDate <= to)
    .forEach((exception) => {
      const key = `${exception.rideId}:${exception.exceptionDate}`;
      exceptionsByRideDate.set(key, [...(exceptionsByRideDate.get(key) ?? []), exception]);
    });

  for (const ride of rides) {
    if (!rideRuns(ride)) {
      continue;
    }

    for (let date = from; date <= to; date = addDays(date, 1)) {
      const dayOfWeek = dayOfWeekOf(date);
      const base = baseInstanceForDate(ride, date, dayOfWeek);

      if (!base.runs) {
        continue;
      }

      const skip = (exceptionsByRideDate.get(`${ride.id}:${date}`) ?? []).find(
        (exception) => exception.type === RideExceptionType.SKIP
      );

      planned.push({
        key: scheduleKey(ride.id, date),
        source: 'SCHEDULE',
        rideId: ride.id,
        serviceDate: date,
        lineId: ride.lineId,
        departureTime: base.departureTime,
        arrivalTime: base.arrivalTime,
        capacity: ride.capacity,
        rideExceptionId: null,
        cancellation: cancellationOf(skip),
        stops: scheduleStops(ride, dayOfWeek, base.departureTime, base.arrivalTime)
      });
    }
  }

  const ridesById = new Map(rides.map((ride) => [ride.id, ride]));

  // The same filter the materializer applies: an ADDITIONAL without both
  // times produces no instance. A SKIP never removes an extra bus.
  for (const extras of exceptionsByRideDate.values()) {
    for (const exception of extras) {
      const ride = ridesById.get(exception.rideId);

      if (
        !ride ||
        !rideRuns(ride) ||
        exception.type !== RideExceptionType.ADDITIONAL ||
        !exception.departureTime ||
        !exception.arrivalTime
      ) {
        continue;
      }

      planned.push({
        key: extraKey(exception.id),
        source: 'EXTRA',
        rideId: ride.id,
        serviceDate: exception.exceptionDate,
        lineId: ride.lineId,
        departureTime: exception.departureTime,
        arrivalTime: exception.arrivalTime,
        capacity: ride.capacity,
        rideExceptionId: exception.id,
        cancellation: null,
        stops: endpointStops(ride, exception.departureTime, exception.arrivalTime)
      });
    }
  }

  return planned;
}
