import { RideExceptionType, RideStatus, RideType } from '@prisma/client';
import {
  GeneratorException,
  GeneratorRide,
  extraKey,
  generateDepartures,
  scheduleKey
} from './departure-generator';
import { SYSTEM_ACTOR_ID } from './system-actor';

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
      intermediateStops: [{ stationId: 'st-b', isBoarding: false, isDropoff: true }]
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

function exception(overrides: Partial<GeneratorException>): GeneratorException {
  return {
    id: 'exc-1',
    rideId: 'ride-1',
    exceptionDate: MONDAY,
    type: RideExceptionType.SKIP,
    departureTime: null,
    arrivalTime: null,
    createdAt: new Date('2026-09-20T08:00:00Z'),
    createdById: 'user-1',
    updatedById: 'user-1',
    ...overrides
  };
}

describe('generateDepartures', () => {
  it('produces one timetable departure per scheduled weekday, keyed by ride and date', () => {
    const planned = generateDepartures([recurringRide()], [], MONDAY, TUESDAY);

    expect(planned).toHaveLength(1);
    expect(planned[0]).toMatchObject({
      key: scheduleKey('ride-1', MONDAY),
      source: 'SCHEDULE',
      serviceDate: MONDAY,
      lineId: 'line-1',
      departureTime: '09:00',
      arrivalTime: '11:00',
      capacity: 48,
      cancellation: null,
      rideExceptionId: null
    });
  });

  it('copies stops in route order, with booking flags', () => {
    const [departure] = generateDepartures([recurringRide()], [], MONDAY, MONDAY);

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

    const [departure] = generateDepartures([ride], [], MONDAY, MONDAY);

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

    expect(generateDepartures([ride], [], MONDAY, MONDAY)).toEqual([]);
  });

  it('produces nothing for a draft or inactive ride, or a ride on an inactive line', () => {
    const rides = [
      recurringRide({ id: 'draft', status: RideStatus.DRAFT }),
      recurringRide({ id: 'inactive', status: RideStatus.INACTIVE }),
      recurringRide({ id: 'line-off', line: { ...recurringRide().line, isActive: false } })
    ];
    const extras = rides.map((ride) =>
      exception({
        id: `extra-${ride.id}`,
        rideId: ride.id,
        type: RideExceptionType.ADDITIONAL,
        departureTime: '15:00',
        arrivalTime: '17:00'
      })
    );

    expect(generateDepartures(rides, extras, MONDAY, TUESDAY)).toEqual([]);
  });

  it('respects the recurring date range', () => {
    const ride = recurringRide({ recurringEndDate: new Date('2026-10-04T00:00:00Z') });

    expect(generateDepartures([ride], [], MONDAY, TUESDAY)).toEqual([]);
  });

  it('mirrors a SKIP as a cancellation credited to its author, and keeps the departure', () => {
    const [departure] = generateDepartures(
      [recurringRide()],
      [exception({ createdById: 'creator', updatedById: 'editor' })],
      MONDAY,
      MONDAY
    );

    expect(departure.cancellation).toEqual({
      at: new Date('2026-09-20T08:00:00Z'),
      by: 'editor'
    });
  });

  it('still cancels the date for a SKIP with no author, credited to the system actor', () => {
    const [departure] = generateDepartures(
      [recurringRide()],
      [exception({ createdById: null, updatedById: null })],
      MONDAY,
      MONDAY
    );

    expect(departure.cancellation).toEqual({
      at: new Date('2026-09-20T08:00:00Z'),
      by: SYSTEM_ACTOR_ID
    });
  });

  it('turns an ADDITIONAL into an extra bus with endpoint stops, unaffected by a SKIP', () => {
    const planned = generateDepartures(
      [recurringRide()],
      [
        exception({ id: 'skip' }),
        exception({
          id: 'extra',
          type: RideExceptionType.ADDITIONAL,
          departureTime: '09:00',
          arrivalTime: '11:30'
        })
      ],
      MONDAY,
      MONDAY
    );

    const extra = planned.find((departure) => departure.source === 'EXTRA')!;
    expect(extra).toMatchObject({
      key: extraKey('extra'),
      rideExceptionId: 'extra',
      departureTime: '09:00',
      arrivalTime: '11:30',
      cancellation: null
    });
    expect(extra.stops).toEqual([
      { stationId: 'st-a', orderIndex: 0, time: '09:00', isBoarding: true, isDropoff: false },
      { stationId: 'st-c', orderIndex: 1, time: '11:30', isBoarding: false, isDropoff: true }
    ]);
    // An extra at the same time as the timetable bus is a second bus.
    expect(planned.filter((departure) => departure.source === 'SCHEDULE')).toHaveLength(1);
  });

  it('ignores an ADDITIONAL without both times, as the materializer does', () => {
    const planned = generateDepartures(
      [recurringRide()],
      [
        exception({ type: RideExceptionType.ADDITIONAL, departureTime: '15:00', arrivalTime: null })
      ],
      MONDAY,
      MONDAY
    );

    expect(planned.map((departure) => departure.source)).toEqual(['SCHEDULE']);
  });

  it('ignores exceptions outside the window', () => {
    const planned = generateDepartures(
      [recurringRide()],
      [
        exception({
          exceptionDate: '2026-10-12',
          type: RideExceptionType.ADDITIONAL,
          departureTime: '15:00',
          arrivalTime: '17:00'
        })
      ],
      MONDAY,
      TUESDAY
    );

    expect(planned.map((departure) => departure.source)).toEqual(['SCHEDULE']);
  });

  it('gives a one-time ride its first and last stop only', () => {
    const ride = recurringRide({
      type: RideType.ONE_TIME,
      recurringStartDate: null,
      oneTimeDate: new Date(`${TUESDAY}T00:00:00Z`),
      oneTimeDepartureTime: '07:00',
      oneTimeArrivalTime: '08:30',
      daySchedules: []
    });

    const planned = generateDepartures([ride], [], MONDAY, TUESDAY);

    expect(planned).toHaveLength(1);
    expect(planned[0]).toMatchObject({ serviceDate: TUESDAY, departureTime: '07:00' });
    expect(planned[0].stops.map((stop) => stop.stationId)).toEqual(['st-a', 'st-c']);
  });
});
