import { DepartureSource, RideExceptionType, RideStatus, RideType } from '@prisma/client';
import { GeneratorRide, generateDepartures, linePathStops } from './departure-generator';
import { StoredDeparture, diffDepartures } from './departure-sync';
import { ExceptionRecord } from './exception-records';

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
    rideExceptionId: 'exc-1',
    stops: linePathStops(ride(), '15:00', '17:00'),
    ...overrides
  });
}

const cancelled = { cancelledAt: new Date('2026-09-20T08:00:00Z'), cancelledById: 'user-1' };

function exception(overrides: Partial<ExceptionRecord> = {}): ExceptionRecord {
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

function additional(overrides: Partial<ExceptionRecord> = {}): ExceptionRecord {
  return exception({
    type: RideExceptionType.ADDITIONAL,
    departureTime: '15:00',
    arrivalTime: '17:00',
    ...overrides
  });
}

function diff(rides: GeneratorRide[], rows: StoredDeparture[], exceptions: ExceptionRecord[] = []) {
  return diffDepartures(generateDepartures(rides, MONDAY, MONDAY), rows, rides, exceptions);
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
      capacity: 48
    });
  });

  it('keeps the capacity an operator gave an extra, with or without its ADDITIONAL', () => {
    const resized = extra({ capacity: 20 });
    const cancelledOrphan = extra({
      ...cancelled,
      id: 'extra-2',
      rideExceptionId: null,
      capacity: 20
    });

    expect(diff([ride({ capacity: 60 })], [resized, cancelledOrphan]).updates).toEqual([]);
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

    // The extra keeps its own capacity.
    expect(plan.updates.map((update) => update.fields)).toEqual([['capacity']]);
    expect(plan.conflicts).toEqual([]);
  });

  describe('decisions stored only as an exception row', () => {
    it('applies the SKIP of a date to the timetable departure it creates', () => {
      const { creates } = diff([ride()], [], [exception()]);

      expect(creates).toEqual([
        expect.objectContaining({
          source: 'SCHEDULE',
          cancellation: { at: new Date('2026-09-20T08:00:00Z'), by: 'user-1' }
        })
      ]);
    });

    it('never reads a SKIP for a stored departure', () => {
      const plan = diff([ride()], [stored()], [exception()]);

      expect(plan.creates).toEqual([]);
      expect(plan.updates).toEqual([]);
    });

    it('creates the extra bus of an ADDITIONAL that has none, dropped while its ride does not run', () => {
      const running = diff([ride()], [stored()], [additional()]);

      expect(running.creates).toEqual([
        expect.objectContaining({
          source: 'EXTRA',
          rideExceptionId: 'exc-1',
          departureTime: '15:00',
          capacity: 48,
          timetableDropped: false
        })
      ]);
      expect(running.creates[0].stops.map((stop) => stop.stationId)).toEqual([
        'st-a',
        'st-b',
        'st-c'
      ]);

      const inactive = diff([ride({ status: RideStatus.INACTIVE })], [], [additional()]);
      expect(inactive.creates).toEqual([
        expect.objectContaining({ source: 'EXTRA', timetableDropped: true })
      ]);
    });

    it('leaves an ADDITIONAL alone when its extra is stored, or when it has no times', () => {
      expect(diff([ride()], [stored(), extra()], [additional()]).creates).toEqual([]);
      expect(
        diff([ride()], [stored()], [additional({ departureTime: null, arrivalTime: null })])
          .creates
      ).toEqual([]);
    });

    it('does not count an extra it creates at the timetable time as a conflict', () => {
      const plan = diff([ride()], [], [additional({ departureTime: '09:00' })]);

      expect(plan.creates.map((created) => created.source)).toEqual(['SCHEDULE', 'EXTRA']);
      expect(plan.conflicts).toEqual([]);
    });
  });
});
