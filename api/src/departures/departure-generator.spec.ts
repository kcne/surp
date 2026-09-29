import { RideStatus, RideType } from '@prisma/client';
import {
  GeneratorRide,
  extraKey,
  generateDepartures,
  linePathStops,
  planExtra,
  scheduleKey
} from './departure-generator';

// 5 October 2026 is a Monday.
const MONDAY = '2026-10-05';
const TUESDAY = '2026-10-06';

function recurringRide(overrides: Partial<GeneratorRide> = {}): GeneratorRide {
  return {
    id: 'ride-1',
    lineId: 'line-1',
    capacity: 48,
    status: RideStatus.ACTIVE,
    type: RideType.RECURRING,
    recurringStartDate: new Date('2026-01-01T00:00:00Z'),
    recurringEndDate: null,
    oneTimeDate: null,
    oneTimeDepartureTime: null,
    oneTimeArrivalTime: null,
    line: {
      isActive: true,
      departureStationId: 'st-a',
      arrivalStationId: 'st-c',
      intermediateStops: [{ stationId: 'st-b', orderIndex: 0, isBoarding: false, isDropoff: true }]
    },
    daySchedules: [
      {
        dayOfWeek: 1,
        stationTimes: [
          { stationId: 'st-c', orderIndex: 2, time: '11:00' },
          { stationId: 'st-a', orderIndex: 0, time: '09:00' },
          { stationId: 'st-b', orderIndex: 1, time: '10:00' }
        ]
      }
    ],
    ...overrides
  };
}

describe('generateDepartures', () => {
  it('produces one timetable departure per scheduled weekday, keyed by ride and date', () => {
    const planned = generateDepartures([recurringRide()], MONDAY, TUESDAY);

    expect(planned).toHaveLength(1);
    expect(planned[0]).toMatchObject({
      key: scheduleKey('ride-1', MONDAY),
      source: 'SCHEDULE',
      serviceDate: MONDAY,
      lineId: 'line-1',
      departureTime: '09:00',
      arrivalTime: '11:00',
      capacity: 48,
      rideExceptionId: null
    });
    expect(planned[0].cancellation).toBeUndefined();
  });

  it('copies stops in route order, with booking flags', () => {
    const [departure] = generateDepartures([recurringRide()], MONDAY, MONDAY);

    expect(departure.stops).toEqual([
      { stationId: 'st-a', orderIndex: 0, time: '09:00', isBoarding: true, isDropoff: false },
      // The line stop's own flags, not the default.
      { stationId: 'st-b', orderIndex: 1, time: '10:00', isBoarding: false, isDropoff: true },
      { stationId: 'st-c', orderIndex: 2, time: '11:00', isBoarding: false, isDropoff: true }
    ]);
  });

  it('keeps an intermediate stop without a time, and defaults its flags when the line has none', () => {
    const ride = recurringRide({
      line: { ...recurringRide().line, intermediateStops: [] },
      daySchedules: [
        {
          dayOfWeek: 1,
          stationTimes: [
            { stationId: 'st-a', orderIndex: 0, time: '09:00' },
            { stationId: 'st-b', orderIndex: 1, time: null },
            { stationId: 'st-c', orderIndex: 2, time: '11:00' }
          ]
        }
      ]
    });

    const [departure] = generateDepartures([ride], MONDAY, MONDAY);

    expect(departure.stops[1]).toEqual({
      stationId: 'st-b',
      orderIndex: 1,
      time: null,
      isBoarding: true,
      isDropoff: true
    });
  });

  it('produces nothing when the first or last stop has no time', () => {
    const ride = recurringRide({
      daySchedules: [
        {
          dayOfWeek: 1,
          stationTimes: [
            { stationId: 'st-a', orderIndex: 0, time: null },
            { stationId: 'st-c', orderIndex: 1, time: '11:00' }
          ]
        }
      ]
    });

    expect(generateDepartures([ride], MONDAY, MONDAY)).toEqual([]);
  });

  it('produces nothing for a draft or inactive ride, or a ride on an inactive line', () => {
    const rides = [
      recurringRide({ id: 'draft', status: RideStatus.DRAFT }),
      recurringRide({ id: 'inactive', status: RideStatus.INACTIVE }),
      recurringRide({ id: 'line-off', line: { ...recurringRide().line, isActive: false } })
    ];

    expect(generateDepartures(rides, MONDAY, TUESDAY)).toEqual([]);
  });

  it('respects the recurring date range', () => {
    const ride = recurringRide({ recurringEndDate: new Date('2026-10-04T00:00:00Z') });

    expect(generateDepartures([ride], MONDAY, TUESDAY)).toEqual([]);
  });

  it('gives a one-time ride the whole line path, timed only at its ends', () => {
    const ride = recurringRide({
      type: RideType.ONE_TIME,
      recurringStartDate: null,
      oneTimeDate: new Date(`${TUESDAY}T00:00:00Z`),
      oneTimeDepartureTime: '07:00',
      oneTimeArrivalTime: '08:30',
      daySchedules: []
    });

    const planned = generateDepartures([ride], MONDAY, TUESDAY);

    expect(planned).toHaveLength(1);
    expect(planned[0]).toMatchObject({ serviceDate: TUESDAY, departureTime: '07:00' });
    expect(planned[0].stops).toEqual([
      { stationId: 'st-a', orderIndex: 0, time: '07:00', isBoarding: true, isDropoff: false },
      { stationId: 'st-b', orderIndex: 1, time: null, isBoarding: false, isDropoff: true },
      { stationId: 'st-c', orderIndex: 2, time: '08:30', isBoarding: false, isDropoff: true }
    ]);
  });
});

describe('linePathStops', () => {
  it('orders middle stops by their line order, whatever order they come in', () => {
    const ride = recurringRide({
      line: {
        ...recurringRide().line,
        intermediateStops: [
          { stationId: 'st-y', orderIndex: 1, isBoarding: true, isDropoff: false },
          { stationId: 'st-x', orderIndex: 0, isBoarding: true, isDropoff: true }
        ]
      }
    });

    expect(linePathStops(ride, '06:00', '09:00')).toEqual([
      { stationId: 'st-a', orderIndex: 0, time: '06:00', isBoarding: true, isDropoff: false },
      { stationId: 'st-x', orderIndex: 1, time: null, isBoarding: true, isDropoff: true },
      { stationId: 'st-y', orderIndex: 2, time: null, isBoarding: true, isDropoff: false },
      { stationId: 'st-c', orderIndex: 3, time: '09:00', isBoarding: false, isDropoff: true }
    ]);
  });

  it('is the two ends alone on a line without middle stops', () => {
    const ride = recurringRide({ line: { ...recurringRide().line, intermediateStops: [] } });

    expect(linePathStops(ride, '06:00', '09:00').map((stop) => stop.stationId)).toEqual([
      'st-a',
      'st-c'
    ]);
  });
});

describe('planExtra', () => {
  const extra = {
    keyId: 'dep-9',
    serviceDate: MONDAY,
    departureTime: '15:00',
    arrivalTime: '17:30',
    capacity: 20,
    rideExceptionId: 'exc-9'
  };

  it("keeps the operator's times and capacity, and takes line and stops from the ride", () => {
    const { departure, dropped } = planExtra(recurringRide({ lineId: 'line-2' }), extra);

    expect(dropped).toBe(false);
    expect(departure).toMatchObject({
      key: extraKey('dep-9'),
      source: 'EXTRA',
      lineId: 'line-2',
      departureTime: '15:00',
      arrivalTime: '17:30',
      capacity: 20,
      rideExceptionId: 'exc-9'
    });
    expect(departure.stops.map((stop) => [stop.stationId, stop.time])).toEqual([
      ['st-a', '15:00'],
      ['st-b', null],
      ['st-c', '17:30']
    ]);
  });

  it('is dropped while its ride or line does not run', () => {
    expect(planExtra(recurringRide({ status: RideStatus.INACTIVE }), extra).dropped).toBe(true);
    expect(
      planExtra(recurringRide({ line: { ...recurringRide().line, isActive: false } }), extra)
        .dropped
    ).toBe(true);
  });
});
