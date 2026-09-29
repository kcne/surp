import { DepartureSource, RideExceptionType } from '@prisma/client';
import { findExceptionMismatches } from './departure-matches-exceptions';

const DATE = new Date('2026-10-05T00:00:00Z');

function skip() {
  return {
    id: 'exc-1',
    rideId: 'ride-1',
    exceptionDate: DATE,
    type: RideExceptionType.SKIP,
    departureTime: null,
    arrivalTime: null
  };
}

function scheduled(cancelledAt: Date | null) {
  return {
    id: 'dep-1',
    rideId: 'ride-1',
    serviceDate: DATE,
    source: DepartureSource.SCHEDULE,
    departureTime: '09:00',
    arrivalTime: '11:00',
    cancelledAt,
    rideExceptionId: null
  };
}

describe('findExceptionMismatches', () => {
  it('reports a SKIP whose stored timetable departure is not cancelled', () => {
    expect(
      findExceptionMismatches({ exceptions: [skip()], departures: [scheduled(null)] })
    ).toEqual([
      expect.objectContaining({ detail: expect.objectContaining({ reason: 'SKIP_NOT_APPLIED' }) })
    ]);
  });

  it('is quiet about a SKIP with no timetable departure stored, which the sync applies on creation', () => {
    expect(findExceptionMismatches({ exceptions: [skip()], departures: [] })).toEqual([]);
  });

  it('is quiet about a SKIP on its cancelled departure', () => {
    expect(
      findExceptionMismatches({ exceptions: [skip()], departures: [scheduled(new Date())] })
    ).toEqual([]);
  });
});
