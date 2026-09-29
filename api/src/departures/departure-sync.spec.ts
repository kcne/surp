import { DepartureSource, RideStatus, RideType } from '@prisma/client';
import { GeneratorRide, generateDepartures, linePathStops } from './departure-generator';
import { StoredDeparture, diffDepartures } from './departure-sync';

// 5 October 2026 is a Monday.
const MONDAY = '2026-10-05';

function ride(overrides: Partial<GeneratorRide> = {}): GeneratorRide {
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
      intermediateStops: [{ stationId: 'st-b', orderIndex: 0, isBoarding: true, isDropoff: true }]
    },
    daySchedules: [
      {
        dayOfWeek: 1,
        stationTimes: [
          { stationId: 'st-a', orderIndex: 0, time: '09:00' },
          { stationId: 'st-c', orderIndex: 1, time: '11:00' }
        ]
      }
    ],
    ...overrides
  };
}

/** A stored row that is exactly what `generateDepartures` plans for the ride. */
function stored(overrides: Partial<StoredDeparture> = {}): StoredDeparture {
  const [planned] = generateDepartures([ride()], MONDAY, MONDAY);

  return {
    id: 'dep-1',
    source: DepartureSource.SCHEDULE,
    rideId: 'ride-1',
    serviceDate: MONDAY,
    lineId: 'line-1',
    departureTime: '09:00',
    arrivalTime: '11:00',
    capacity: 48,
    timetableDroppedAt: null,
    cancelledAt: null,
    cancelledById: null,
    rideExceptionId: null,
    stops: planned.stops,
    referenceCount: 0,
    ...overrides
  };
}

function extra(overrides: Partial<StoredDeparture> = {}): StoredDeparture {
  return stored({
    id: 'extra-1',
    source: DepartureSource.EXTRA,
    departureTime: '15:00',
    arrivalTime: '17:00',
    capacity: 20,
    rideExceptionId: 'exc-1',
    stops: linePathStops(ride(), '15:00', '17:00'),
    ...overrides
  });
}

const cancelled = { cancelledAt: new Date('2026-09-20T08:00:00Z'), cancelledById: 'user-1' };

function diff(rides: GeneratorRide[], rows: StoredDeparture[]) {
  return diffDepartures(generateDepartures(rides, MONDAY, MONDAY), rows, rides);
}

describe('diffDepartures', () => {
  it('leaves an operator cancellation alone', () => {
    expect(diff([ride()], [stored(cancelled)])).toEqual({
      creates: [],
      updates: [],
      drops: [],
      deletes: [],
      conflicts: []
    });
  });

  it('never plans a change to a cancellation on a timetable edit', () => {
    const { updates } = diff([ride({ capacity: 30 })], [stored(cancelled)]);

    expect(updates).toHaveLength(1);
    expect(updates[0].fields).toEqual(['capacity']);
  });

  it('deletes an unreferenced departure the timetable no longer produces', () => {
    const plan = diff([ride({ daySchedules: [] })], [stored()]);

    expect(plan.deletes.map((row) => row.id)).toEqual(['dep-1']);
    expect(plan.drops).toEqual([]);
  });

  it('drops, never deletes, a cancelled departure the timetable no longer produces', () => {
    const plan = diff([ride({ daySchedules: [] })], [stored(cancelled)]);

    expect(plan.drops.map((row) => row.id)).toEqual(['dep-1']);
    expect(plan.deletes).toEqual([]);
  });

  it('brings a dropped departure back without touching its cancellation', () => {
    const { updates } = diff(
      [ride()],
      [stored({ ...cancelled, timetableDroppedAt: new Date('2026-09-21T08:00:00Z') })]
    );

    expect(updates).toEqual([
      expect.objectContaining({ dropped: false, fields: ['timetableDroppedAt'] })
    ]);
  });

  it('never creates an extra, and never deletes one', () => {
    const plan = diff([ride({ daySchedules: [] })], [extra()]);

    expect(plan.creates).toEqual([]);
    expect(plan.deletes).toEqual([]);
    expect(plan.drops).toEqual([]);
    expect(plan.updates).toEqual([]);
  });

  it('drops an extra while its ride or line does not run, and brings it back after', () => {
    for (const off of [
      ride({ status: RideStatus.INACTIVE }),
      ride({ line: { ...ride().line, isActive: false } })
    ]) {
      const { updates, deletes } = diff([off], [extra()]);

      expect(deletes).toEqual([]);
      expect(updates).toEqual([
        expect.objectContaining({ dropped: true, fields: ['timetableDroppedAt'] })
      ]);
    }

    const { updates } = diff([ride()], [extra({ timetableDroppedAt: new Date() })]);
    expect(updates).toEqual([
      expect.objectContaining({ dropped: false, fields: ['timetableDroppedAt'] })
    ]);
  });

  it("keeps an extra on its ride's line and stops, but its own times and capacity", () => {
    const moved = ride({
      lineId: 'line-2',
      capacity: 60,
      line: { ...ride().line, intermediateStops: [] }
    });

    const { updates } = diff([moved], [extra()]);

    expect(updates).toHaveLength(1);
    expect(updates[0].fields).toEqual(['lineId', 'stops']);
    expect(updates[0].planned).toMatchObject({
      lineId: 'line-2',
      departureTime: '15:00',
      arrivalTime: '17:00',
      capacity: 20
    });
  });

  it('rewrites the stops of a one-time departure stored with its ends only', () => {
    const oneTime = ride({
      type: RideType.ONE_TIME,
      recurringStartDate: null,
      oneTimeDate: new Date(`${MONDAY}T00:00:00Z`),
      oneTimeDepartureTime: '09:00',
      oneTimeArrivalTime: '11:00',
      daySchedules: []
    });
    const endsOnly = stored({
      stops: [
        { stationId: 'st-a', orderIndex: 0, time: '09:00', isBoarding: true, isDropoff: false },
        { stationId: 'st-c', orderIndex: 1, time: '11:00', isBoarding: false, isDropoff: true }
      ]
    });

    const { updates } = diff([oneTime], [endsOnly]);

    expect(updates).toHaveLength(1);
    expect(updates[0].fields).toEqual(['stops']);
    expect(updates[0].planned.stops.map((stop) => stop.stationId)).toEqual([
      'st-a',
      'st-b',
      'st-c'
    ]);
  });

  it('keeps an extra orphaned before PR 3a dropped, though its ride runs', () => {
    const orphan = extra({
      rideExceptionId: null,
      timetableDroppedAt: new Date('2026-09-21T08:00:00Z'),
      referenceCount: 1
    });

    expect(diff([ride()], [orphan]).updates).toEqual([]);
  });

  it("reports a timetable departure it would write at an extra's time", () => {
    const atNine = extra({
      departureTime: '09:00',
      stops: linePathStops(ride(), '09:00', '17:00')
    });

    expect(diff([ride()], [atNine]).conflicts).toEqual([
      expect.objectContaining({ extraId: 'extra-1', create: true })
    ]);

    const movedOnto = diff([ride()], [stored({ departureTime: '08:00' }), atNine]);
    expect(movedOnto.conflicts).toEqual([
      expect.objectContaining({ extraId: 'extra-1', create: false })
    ]);
  });

  it('does not report a same-time pair that is already stored', () => {
    const atNine = extra({
      departureTime: '09:00',
      stops: linePathStops(ride(), '09:00', '17:00')
    });

    const plan = diff([ride({ capacity: 30 })], [stored(), atNine]);

    expect(plan.updates).toHaveLength(1);
    expect(plan.conflicts).toEqual([]);
  });
});
