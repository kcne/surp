import { RideStatus, RideType } from '@prisma/client';
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
 *
 * Operator decisions are not part of it (#27, PR 3a). A cancellation or an
 * extra bus is written on the departure by the person who decides it, and the
 * sync never sets, clears or removes one.
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
    intermediateStops: Array<{
      stationId: string;
      orderIndex: number;
      isBoarding: boolean;
      isDropoff: boolean;
    }>;
  };
  daySchedules: Array<{ dayOfWeek: number; stationTimes: GeneratorStationTime[] }>;
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
  /** `schedule:<rideId>:<date>`, or `extra:<departureId>` for a stored extra. */
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
   * Never produced by the generator. Set by the sync only when it creates a
   * departure on a date that already has a SKIP.
   */
  cancellation?: PlannedCancellation | null;
  /**
   * Set only on an extra bus the sync inserts for an ADDITIONAL whose ride
   * does not run: it is stored dropped and comes back with the ride.
   */
  timetableDropped?: boolean;
  stops: PlannedStop[];
}

export function scheduleKey(rideId: string, serviceDate: string): string {
  return `schedule:${rideId}:${serviceDate}`;
}

export function extraKey(departureId: string): string {
  return `extra:${departureId}`;
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
  ride: Pick<GeneratorRide, 'line'>,
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

/**
 * The whole line path, for a one-time ride or an extra bus: they have no day
 * schedule, but booking checks a station pair against the whole line, so the
 * stored stops must hold every stop it accepts. Only the ends have a time.
 */
export function linePathStops(
  ride: Pick<GeneratorRide, 'line'>,
  departureTime: string,
  arrivalTime: string
): PlannedStop[] {
  const middle = [...ride.line.intermediateStops].sort(
    (left, right) => left.orderIndex - right.orderIndex
  );
  const path = [
    ride.line.departureStationId,
    ...middle.map((stop) => stop.stationId),
    ride.line.arrivalStationId
  ];

  return path.map((stationId, position) => ({
    stationId,
    orderIndex: position,
    time: position === 0 ? departureTime : position === path.length - 1 ? arrivalTime : null,
    ...stopFlags(ride, stationId, position, path.length)
  }));
}

function scheduleStops(
  ride: GeneratorRide,
  dayOfWeek: number,
  departureTime: string,
  arrivalTime: string
): PlannedStop[] {
  if (ride.type === RideType.ONE_TIME) {
    return linePathStops(ride, departureTime, arrivalTime);
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

/**
 * Every `SCHEDULE` departure the timetable produces from `from` to `to`, both
 * included. Extra buses are not produced: they exist because someone added
 * one, and only `planExtra` shapes them.
 */
export function generateDepartures(
  rides: readonly GeneratorRide[],
  from: string,
  to: string
): PlannedDeparture[] {
  const planned: PlannedDeparture[] = [];

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
        stops: scheduleStops(ride, dayOfWeek, base.departureTime, base.arrivalTime)
      });
    }
  }

  return planned;
}

export interface ExtraInput {
  /** Keys the plan; the stored departure's ID, or the exception's for a new one. */
  keyId: string;
  serviceDate: string;
  departureTime: string;
  arrivalTime: string;
  capacity: number;
  rideExceptionId: string | null;
}

/**
 * An extra bus as its ride shapes it. Its times and capacity are the caller's
 * to give; its line and stops follow the ride, and it runs only while the
 * ride does (`dropped`).
 */
export function planExtra(
  ride: GeneratorRide,
  extra: ExtraInput
): { departure: PlannedDeparture; dropped: boolean } {
  return {
    departure: {
      key: extraKey(extra.keyId),
      source: 'EXTRA',
      rideId: ride.id,
      serviceDate: extra.serviceDate,
      lineId: ride.lineId,
      departureTime: extra.departureTime,
      arrivalTime: extra.arrivalTime,
      capacity: extra.capacity,
      rideExceptionId: extra.rideExceptionId,
      stops: linePathStops(ride, extra.departureTime, extra.arrivalTime)
    },
    dropped: !rideRuns(ride)
  };
}
