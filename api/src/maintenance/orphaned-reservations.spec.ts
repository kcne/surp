import {
  classifyReservation,
  findOffRouteStationIds,
  resolveSeatNumber,
  type ReservationToCheck
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

describe('classifyReservation', () => {
  it('leaves a reservation alone when an instance departs at its stored time', () => {
    const result = classifyReservation(reservation(), {
      rideIsActive: true,
      instances: [instance('07:45', '23:00')]
    });

    expect(result).toBeNull();
  });

  it('points a reservation at the only instance of the day when the departure time moved', () => {
    // Prepending a station to the route makes that station's time the instance
    // departure, which is what strands reservations booked before the edit.
    const result = classifyReservation(reservation(), {
      rideIsActive: true,
      instances: [instance('07:30', '23:00')]
    });

    expect(result).toEqual({
      reason: 'DEPARTURE_TIME_MOVED',
      targetDepartureTime: '07:30',
      targetArrivalTime: '23:00'
    });
  });

  it('refuses to guess when the day carries more than one instance', () => {
    const result = classifyReservation(reservation(), {
      rideIsActive: true,
      instances: [instance('07:30', '23:00'), instance('14:00', '05:00')]
    });

    expect(result).toEqual({
      reason: 'AMBIGUOUS_INSTANCE',
      targetDepartureTime: null,
      targetArrivalTime: null
    });
  });

  it('reports a day that materializes nothing', () => {
    const result = classifyReservation(reservation(), { rideIsActive: true, instances: [] });

    expect(result?.reason).toBe('NO_INSTANCE');
  });

  it('names an inactive ride as the cause ahead of the empty day it produces', () => {
    const result = classifyReservation(reservation(), { rideIsActive: false, instances: [] });

    expect(result?.reason).toBe('RIDE_NOT_ACTIVE');
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
