import {
  ORPHAN_REASON_ADVICE,
  ORPHAN_REASON_LABELS,
  classifyReservation,
  findOffRouteStationIds,
  resolveSeatNumber,
  type OrphanReason,
  type ReservationToCheck,
  type RideDayInstances
} from './orphaned-reservations';

const reservation = (overrides: Partial<ReservationToCheck> = {}): ReservationToCheck => ({
  id: 'reservation-1',
  rideId: 'ride-1',
  travelDate: '2026-09-15',
  rideDepartureTime: '07:45',
  rideArrivalTime: '23:00',
  seatNumber: 12,
  departureStationId: 'station-agencija',
  arrivalStationId: 'station-novi-sad',
  ...overrides
});

const instance = (departureTime: string, arrivalTime: string) => ({
  departureTime,
  arrivalTime,
  source: 'BASE' as const
});

/** A day whose base run stands at the reservation's own departure time. */
const day = (overrides: Partial<RideDayInstances> = {}): RideDayInstances => ({
  rideIsActive: true,
  instances: [instance('07:45', '23:00')],
  baseInstance: { runs: true, departureTime: '07:45', arrivalTime: '23:00' },
  skippedByException: false,
  ...overrides
});

/** A day that materializes nothing, for the reason given. */
const emptyDay = (overrides: Partial<RideDayInstances>): RideDayInstances =>
  day({ instances: [], ...overrides });

describe('classifyReservation', () => {
  it('leaves a reservation alone when an instance departs at its stored time', () => {
    expect(classifyReservation(reservation(), day())).toBeNull();
  });

  it('points a reservation at the only instance of the day when the departure time moved', () => {
    // Prepending a station to the route makes that station's time the instance
    // departure, which is what strands reservations booked before the edit.
    const result = classifyReservation(
      reservation(),
      day({
        instances: [instance('07:30', '23:00')],
        baseInstance: { runs: true, departureTime: '07:30', arrivalTime: '23:00' }
      })
    );

    expect(result).toEqual({
      reason: 'DEPARTURE_TIME_MOVED',
      targetDepartureTime: '07:30',
      targetArrivalTime: '23:00'
    });
  });

  it('refuses to guess when the day carries more than one instance', () => {
    const result = classifyReservation(
      reservation(),
      day({ instances: [instance('07:30', '23:00'), instance('14:00', '05:00')] })
    );

    expect(result).toEqual({
      reason: 'AMBIGUOUS_INSTANCE',
      targetDepartureTime: null,
      targetArrivalTime: null
    });
  });

  it('names an inactive ride as the cause ahead of the empty day it produces', () => {
    const result = classifyReservation(
      reservation(),
      emptyDay({ rideIsActive: false, baseInstance: { runs: false, gap: 'WEEKDAY_NOT_SCHEDULED' } })
    );

    expect(result?.reason).toBe('RIDE_NOT_ACTIVE');
  });

  // Every case below used to arrive as one undifferentiated NO_INSTANCE, which
  // told an agency that the bus does not run without telling it what to do.
  it('separates a travel date that fell outside the recurring period', () => {
    const result = classifyReservation(
      reservation(),
      emptyDay({ baseInstance: { runs: false, gap: 'DATE_OUTSIDE_RANGE' } })
    );

    expect(result?.reason).toBe('DATE_OUTSIDE_RANGE');
  });

  it('separates a weekday that was dropped from the schedule', () => {
    const result = classifyReservation(
      reservation(),
      emptyDay({ baseInstance: { runs: false, gap: 'WEEKDAY_NOT_SCHEDULED' } })
    );

    expect(result?.reason).toBe('WEEKDAY_NOT_SCHEDULED');
  });

  it('separates a schedule whose first or last station lost its time', () => {
    const result = classifyReservation(
      reservation(),
      emptyDay({ baseInstance: { runs: false, gap: 'SCHEDULE_TIME_MISSING' } })
    );

    expect(result?.reason).toBe('SCHEDULE_TIME_MISSING');
  });

  it('separates a date somebody marked as not running', () => {
    const result = classifyReservation(reservation(), emptyDay({ skippedByException: true }));

    expect(result?.reason).toBe('SKIPPED_BY_EXCEPTION');
  });

  it('recognises the deleted extra departure by the time the reservation still holds', () => {
    // Moving a single day to another time is a SKIP plus an ADDITIONAL. Delete
    // the ADDITIONAL and the day empties out, leaving these passengers holding
    // 14:00 — a time the base schedule never produced.
    const result = classifyReservation(
      reservation({ rideDepartureTime: '14:00' }),
      emptyDay({ skippedByException: true })
    );

    expect(result?.reason).toBe('EXTRA_DEPARTURE_REMOVED');
  });

  it('prefers the reason the ride itself gives over a skip on a day it never ran', () => {
    // A SKIP on a weekday the ride does not run explains nothing: putting the
    // weekday back is the action, not deleting the exception.
    const result = classifyReservation(
      reservation(),
      emptyDay({
        skippedByException: true,
        baseInstance: { runs: false, gap: 'WEEKDAY_NOT_SCHEDULED' }
      })
    );

    expect(result?.reason).toBe('WEEKDAY_NOT_SCHEDULED');
  });
});

describe('orphan reason texts', () => {
  const reasons: OrphanReason[] = [
    'DEPARTURE_TIME_MOVED',
    'AMBIGUOUS_INSTANCE',
    'RIDE_NOT_ACTIVE',
    'DATE_OUTSIDE_RANGE',
    'WEEKDAY_NOT_SCHEDULED',
    'SCHEDULE_TIME_MISSING',
    'SKIPPED_BY_EXCEPTION',
    'EXTRA_DEPARTURE_REMOVED'
  ];

  // A reason nobody wrote a sentence for is a row in the report that names a
  // cause and then says nothing about what to do with it.
  it.each(reasons)('tells the agency what to do about %s', (reason) => {
    expect(ORPHAN_REASON_LABELS[reason]?.length).toBeGreaterThan(0);
    expect(ORPHAN_REASON_ADVICE[reason]?.length).toBeGreaterThan(0);
  });
});

describe('resolveSeatNumber', () => {
  it('keeps the original seat when it is still free', () => {
    expect(resolveSeatNumber(12, new Set([1, 2, 3]), 48)).toBe(12);
  });

  it('takes the lowest free seat when the original was sold again', () => {
    // The seat looked free while the reservation was invisible, so a later
    // booking could take it.
    expect(resolveSeatNumber(12, new Set([1, 3, 12]), 48)).toBe(2);
  });

  it('refuses a seat beyond capacity even when nothing occupies it', () => {
    expect(resolveSeatNumber(60, new Set([1]), 48)).toBe(2);
  });

  it('returns null when the instance is genuinely full', () => {
    const full = new Set(Array.from({ length: 48 }, (_, index) => index + 1));

    expect(resolveSeatNumber(12, full, 48)).toBeNull();
  });
});

describe('findOffRouteStationIds', () => {
  it('finds nothing when both stations are still on the route', () => {
    const route = new Set(['station-agencija', 'station-novi-sad', 'station-nis']);

    expect(findOffRouteStationIds(reservation(), route)).toEqual([]);
  });

  it('names a station the route no longer calls at', () => {
    const route = new Set(['station-montenegro', 'station-novi-sad']);

    expect(findOffRouteStationIds(reservation(), route)).toEqual(['station-agencija']);
  });
});
