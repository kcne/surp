import { RideExceptionType, RideType } from '@prisma/client';
import {
  dayOfWeekOf,
  materializeInstanceTimesForDate,
  type MaterializationRide
} from './ride-instance-materialization';

const recurringRide = (overrides: Partial<MaterializationRide> = {}): MaterializationRide => ({
  type: RideType.RECURRING,
  recurringStartDate: new Date('2026-01-01T00:00:00.000Z'),
  recurringEndDate: null,
  oneTimeDate: null,
  oneTimeDepartureTime: null,
  oneTimeArrivalTime: null,
  daySchedules: [
    {
      dayOfWeek: 2,
      stationTimes: [
        { orderIndex: 0, time: '07:45' },
        { orderIndex: 1, time: '17:00' },
        { orderIndex: 2, time: '23:00' }
      ]
    }
  ],
  ...overrides
});

// 2026-09-15 is a Tuesday, matching dayOfWeek 2 above.
const TUESDAY = '2026-09-15';

describe('materializeInstanceTimesForDate', () => {
  it('takes the first and last station times of the matching day schedule', () => {
    const result = materializeInstanceTimesForDate(
      recurringRide(),
      [],
      TUESDAY,
      dayOfWeekOf(TUESDAY)
    );

    expect(result).toEqual([{ departureTime: '07:45', arrivalTime: '23:00', source: 'BASE' }]);
  });

  it('renames the instance when a station is prepended to the route', () => {
    // The stranding mechanism itself: an earlier first station makes the whole
    // instance depart at a time no existing reservation stores.
    const result = materializeInstanceTimesForDate(
      recurringRide({
        daySchedules: [
          {
            dayOfWeek: 2,
            stationTimes: [
              { orderIndex: 0, time: '07:30' },
              { orderIndex: 1, time: '07:45' },
              { orderIndex: 2, time: '23:00' }
            ]
          }
        ]
      }),
      [],
      TUESDAY,
      dayOfWeekOf(TUESDAY)
    );

    expect(result[0].departureTime).toBe('07:30');
  });

  it('produces nothing when the first station has no time yet', () => {
    const result = materializeInstanceTimesForDate(
      recurringRide({
        daySchedules: [
          {
            dayOfWeek: 2,
            stationTimes: [
              { orderIndex: 0, time: null },
              { orderIndex: 1, time: '23:00' }
            ]
          }
        ]
      }),
      [],
      TUESDAY,
      dayOfWeekOf(TUESDAY)
    );

    expect(result).toEqual([]);
  });

  it('ignores a weekday the ride does not run on', () => {
    const wednesday = '2026-09-16';

    expect(
      materializeInstanceTimesForDate(recurringRide(), [], wednesday, dayOfWeekOf(wednesday))
    ).toEqual([]);
  });

  it('stops at the end of the recurring range', () => {
    const result = materializeInstanceTimesForDate(
      recurringRide({ recurringEndDate: new Date('2026-09-01T00:00:00.000Z') }),
      [],
      TUESDAY,
      dayOfWeekOf(TUESDAY)
    );

    expect(result).toEqual([]);
  });

  it('drops the base instance on a SKIP exception', () => {
    const result = materializeInstanceTimesForDate(
      recurringRide(),
      [{ type: RideExceptionType.SKIP, departureTime: null, arrivalTime: null }],
      TUESDAY,
      dayOfWeekOf(TUESDAY)
    );

    expect(result).toEqual([]);
  });

  it('adds an ADDITIONAL exception alongside the base instance', () => {
    const result = materializeInstanceTimesForDate(
      recurringRide(),
      [{ type: RideExceptionType.ADDITIONAL, departureTime: '14:00', arrivalTime: '05:00' }],
      TUESDAY,
      dayOfWeekOf(TUESDAY)
    );

    expect(result).toEqual([
      { departureTime: '07:45', arrivalTime: '23:00', source: 'BASE' },
      { departureTime: '14:00', arrivalTime: '05:00', source: 'ADDITIONAL' }
    ]);
  });

  it('materializes a one-time ride only on its own date', () => {
    const oneTime: MaterializationRide = {
      type: RideType.ONE_TIME,
      recurringStartDate: null,
      recurringEndDate: null,
      oneTimeDate: new Date('2026-09-15T00:00:00.000Z'),
      oneTimeDepartureTime: '09:00',
      oneTimeArrivalTime: '18:00',
      daySchedules: []
    };

    expect(materializeInstanceTimesForDate(oneTime, [], TUESDAY, dayOfWeekOf(TUESDAY))).toEqual([
      { departureTime: '09:00', arrivalTime: '18:00', source: 'BASE' }
    ]);
    expect(
      materializeInstanceTimesForDate(oneTime, [], '2026-09-16', dayOfWeekOf('2026-09-16'))
    ).toEqual([]);
  });
});
