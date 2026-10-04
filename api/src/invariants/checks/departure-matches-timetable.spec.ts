import { DepartureSyncPlan, planDepartureSync } from '../../departures/departure-sync';
import { PlannedDeparture, scheduleKey } from '../../departures/departure-generator';
import { InvariantContext } from '../invariant.types';
import { departureMatchesTimetable } from './departure-matches-timetable';

jest.mock('../../departures/departure-sync', () => ({ planDepartureSync: jest.fn() }));

function planned(serviceDate: string): PlannedDeparture {
  return {
    key: scheduleKey('ride-1', serviceDate),
    source: 'SCHEDULE',
    rideId: 'ride-1',
    serviceDate,
    lineId: 'line-1',
    departureTime: '09:00',
    arrivalTime: '11:00',
    capacity: 48,
    rideExceptionId: null,
    stops: []
  };
}

function plan(creates: PlannedDeparture[]): DepartureSyncPlan {
  return {
    window: { from: '2026-09-27', to: '2027-09-27' },
    timezone: 'Europe/Belgrade',
    configuredTimezone: null,
    timezoneInvalid: false,
    plannedCount: creates.length,
    creates,
    updates: [],
    drops: [],
    deletes: []
  };
}

describe('departure.matchesTimetable', () => {
  const ctx = { prisma: {}, tenantId: 'tenant-1' } as unknown as InvariantContext;

  it('reports a missing departure, but not one on the day the nightly job has yet to add', async () => {
    jest
      .mocked(planDepartureSync)
      .mockResolvedValue(plan([planned('2027-09-26'), planned('2027-09-27')]));

    const { violations } = await departureMatchesTimetable.check(ctx);

    expect(violations.map((violation) => violation.subjectId)).toEqual([
      scheduleKey('ride-1', '2027-09-26')
    ]);
    expect(violations[0].detail).toMatchObject({ reason: 'MISSING' });
  });
});
