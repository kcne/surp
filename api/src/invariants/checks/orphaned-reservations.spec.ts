import {
  ORPHAN_REASON_ADVICE,
  ORPHAN_REASON_LABELS,
  classifyLinkedReservation,
  findOffRouteStationIds,
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

/** A day whose base run stands. */
const day = (overrides: Partial<RideDayInstances> = {}): RideDayInstances => ({
  rideIsActive: true,
  baseInstance: { runs: true, departureTime: '07:45', arrivalTime: '23:00' },
  ...overrides
});

describe('classifyLinkedReservation (#27, PR 3b)', () => {
  const running = { source: 'SCHEDULE' as const, cancelledAt: null, timetableDroppedAt: null };

  it('is reachable while its departure runs, whatever the timetable says of the day', () => {
    expect(classifyLinkedReservation(running, day())).toBeNull();
    expect(
      classifyLinkedReservation(
        running,
        day({ baseInstance: { runs: false, gap: 'WEEKDAY_NOT_SCHEDULED' } })
      )
    ).toBeNull();
  });

  it('names a cancelled departure', () => {
    expect(classifyLinkedReservation({ ...running, cancelledAt: new Date() }, day())).toEqual({
      reason: 'DEPARTURE_CANCELLED'
    });
  });

  it('names why the timetable dropped the departure', () => {
    const dropped = { ...running, timetableDroppedAt: new Date() };

    expect(
      classifyLinkedReservation(
        dropped,
        day({ baseInstance: { runs: false, gap: 'WEEKDAY_NOT_SCHEDULED' } })
      )?.reason
    ).toBe('WEEKDAY_NOT_SCHEDULED');
    expect(classifyLinkedReservation(dropped, day({ rideIsActive: false }))?.reason).toBe(
      'RIDE_NOT_ACTIVE'
    );
    // The ride runs that day, so what dropped it is not the schedule.
    expect(classifyLinkedReservation(dropped, day())?.reason).toBe('DEPARTURE_DROPPED');
  });

  it('does not blame the weekly schedule for a dropped extra bus', () => {
    expect(
      classifyLinkedReservation(
        { source: 'EXTRA', cancelledAt: null, timetableDroppedAt: new Date() },
        day({ baseInstance: { runs: false, gap: 'WEEKDAY_NOT_SCHEDULED' } })
      )?.reason
    ).toBe('DEPARTURE_DROPPED');
  });
});

describe('orphan reason texts', () => {
  const reasons: OrphanReason[] = [
    'RIDE_NOT_ACTIVE',
    'DATE_OUTSIDE_RANGE',
    'WEEKDAY_NOT_SCHEDULED',
    'SCHEDULE_TIME_MISSING',
    'DEPARTURE_CANCELLED',
    'DEPARTURE_DROPPED'
  ];

  // A reason nobody wrote a sentence for is a row in the report that names a
  // cause and then says nothing about what to do with it.
  it.each(reasons)('tells the agency what to do about %s', (reason) => {
    expect(ORPHAN_REASON_LABELS[reason]?.length).toBeGreaterThan(0);
    expect(ORPHAN_REASON_ADVICE[reason]?.length).toBeGreaterThan(0);
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
