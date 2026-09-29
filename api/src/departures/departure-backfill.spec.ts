import { DepartureSource, ReservationStatus } from '@prisma/client';
import {
  BackfillInput,
  BackfillReservation,
  BackfillStoredDeparture,
  computeDepartureBackfill,
  countDepartureBackfill,
  legacyArrival
} from './departure-backfill';
import { PlannedDeparture, scheduleKey } from './departure-generator';

const today = '2026-09-28';
const past = '2026-09-10';
const future = '2026-10-05';

function reservation(
  overrides: Partial<BackfillReservation> & { id: string }
): BackfillReservation {
  return {
    rideId: 'ride-1',
    travelDate: past,
    rideDepartureTime: '09:00',
    rideArrivalTime: '11:00',
    seatNumber: 1,
    status: ReservationStatus.ACTIVE,
    createdAt: new Date('2026-09-01T08:00:00.000Z'),
    ...overrides
  };
}

function stored(
  overrides: Partial<BackfillStoredDeparture> & { id: string }
): BackfillStoredDeparture {
  return {
    source: DepartureSource.SCHEDULE,
    rideId: 'ride-1',
    serviceDate: future,
    departureTime: '09:00',
    rideExceptionId: null,
    capacity: 48,
    ...overrides
  };
}

function planned(overrides: Partial<PlannedDeparture> = {}): PlannedDeparture {
  const rideId = overrides.rideId ?? 'ride-1';
  const serviceDate = overrides.serviceDate ?? past;

  return {
    key: scheduleKey(rideId, serviceDate),
    source: 'SCHEDULE',
    rideId,
    serviceDate,
    lineId: 'line-1',
    departureTime: '09:00',
    arrivalTime: '11:00',
    capacity: 48,
    rideExceptionId: null,
    cancellation: null,
    stops: [],
    ...overrides
  };
}

function plan(input: Partial<BackfillInput>) {
  let next = 0;

  return computeDepartureBackfill({
    agencyDate: today,
    reservations: [],
    stored: [],
    history: [],
    rides: [{ id: 'ride-1', lineId: 'line-1', capacity: 48 }],
    newId: () => `new-${++next}`,
    ...input
  });
}

describe('computeDepartureBackfill', () => {
  it('links a unique stored match at any date or status', () => {
    const result = plan({
      reservations: [
        reservation({ id: 'future-active', travelDate: future }),
        reservation({
          id: 'future-cancelled',
          travelDate: future,
          status: ReservationStatus.CANCELLED
        })
      ],
      stored: [stored({ id: 'timetable' })]
    });

    expect(result.links).toEqual([
      { reservationId: 'future-active', departureId: 'timetable', via: 'EXISTING' },
      { reservationId: 'future-cancelled', departureId: 'timetable', via: 'EXISTING' }
    ]);
    expect(result.historyCreates).toEqual([]);
    expect(result.legacyCreates).toEqual([]);
  });

  it('writes the past departures reservations match, and only those', () => {
    const matched = planned();
    const result = plan({
      reservations: [reservation({ id: 'r1' })],
      history: [
        matched,
        // Another date nobody booked, and another time on the booked date.
        planned({ serviceDate: '2026-09-11' }),
        planned({ rideId: 'ride-2', departureTime: '07:00' })
      ]
    });

    expect(result.historyCreates).toEqual([{ id: 'new-1', departure: matched }]);
    expect(result.links).toEqual([{ reservationId: 'r1', departureId: 'new-1', via: 'HISTORY' }]);
  });

  it('leaves a stored past departure as it is and links to it', () => {
    const result = plan({
      reservations: [reservation({ id: 'r1' })],
      stored: [stored({ id: 'kept', serviceDate: past })],
      history: [planned()]
    });

    expect(result.historyCreates).toEqual([]);
    expect(result.links).toEqual([{ reservationId: 'r1', departureId: 'kept', via: 'EXISTING' }]);
  });

  it('does not write the generator’s departures for today or later', () => {
    const result = plan({
      reservations: [reservation({ id: 'r1', travelDate: today })],
      history: [planned({ serviceDate: today })]
    });

    expect(result.historyCreates).toEqual([]);
    expect(result.reported).toEqual([
      expect.objectContaining({ reservationId: 'r1', reason: 'NO_DEPARTURE', futureActive: true })
    ]);
  });

  it('puts past and cancelled rows without a departure on LEGACY, and reports future active ones', () => {
    const result = plan({
      reservations: [
        reservation({ id: 'past', rideDepartureTime: '08:15' }),
        reservation({
          id: 'cancelled',
          travelDate: future,
          rideDepartureTime: '08:15',
          status: ReservationStatus.CANCELLED
        }),
        reservation({ id: 'active', travelDate: future, rideDepartureTime: '08:15' })
      ]
    });

    expect(
      result.legacyCreates.map((legacy) => [legacy.serviceDate, legacy.reservationIds])
    ).toEqual([
      [past, ['past']],
      [future, ['cancelled']]
    ]);
    expect(result.links.map((link) => [link.reservationId, link.via])).toEqual([
      ['past', 'LEGACY'],
      ['cancelled', 'LEGACY']
    ]);
    expect(result.reported).toEqual([
      expect.objectContaining({
        reservationId: 'active',
        reason: 'NO_DEPARTURE',
        futureActive: true
      })
    ]);
    expect(countDepartureBackfill(result).legacyCreatedFuture).toBe(1);
  });

  it('builds a LEGACY departure from what was sold', () => {
    const [legacy] = plan({
      reservations: [
        reservation({ id: 'r1', rideDepartureTime: '08:15', rideArrivalTime: '10:20' })
      ]
    }).legacyCreates;

    expect(legacy).toEqual({
      id: 'new-1',
      rideId: 'ride-1',
      serviceDate: past,
      departureTime: '08:15',
      arrivalTime: '10:20',
      lineId: 'line-1',
      capacity: 48,
      reservationIds: ['r1'],
      arrivalTimesDisagree: [],
      duplicateSeats: []
    });
  });

  it('reuses a stored LEGACY departure for the same ride, date and time', () => {
    const result = plan({
      reservations: [reservation({ id: 'r1', rideDepartureTime: '08:15' })],
      stored: [
        stored({
          id: 'legacy',
          source: DepartureSource.LEGACY,
          serviceDate: past,
          departureTime: '08:15'
        })
      ]
    });

    expect(result.legacyCreates).toEqual([]);
    expect(result.legacyReused).toEqual([
      { id: 'legacy', reservationIds: ['r1'], seatsAboveCapacity: [], duplicateSeats: [] }
    ]);
    expect(result.links).toEqual([{ reservationId: 'r1', departureId: 'legacy', via: 'LEGACY' }]);
  });

  it('never links to a LEGACY departure when a timetable bus matches', () => {
    const result = plan({
      reservations: [reservation({ id: 'r1' })],
      stored: [
        stored({ id: 'legacy', source: DepartureSource.LEGACY, serviceDate: past }),
        stored({ id: 'timetable', serviceDate: past })
      ]
    });

    expect(result.links).toEqual([
      { reservationId: 'r1', departureId: 'timetable', via: 'EXISTING' }
    ]);
  });

  it('gives a past ride-date that sold two times one timetable and one LEGACY departure', () => {
    const result = plan({
      reservations: [
        reservation({ id: 'on-time' }),
        reservation({ id: 'old-time', rideDepartureTime: '08:30', seatNumber: 2 })
      ],
      history: [planned()]
    });

    expect(result.historyCreates).toHaveLength(1);
    expect(result.legacyCreates.map((legacy) => legacy.departureTime)).toEqual(['08:30']);
    expect(result.links.map((link) => [link.reservationId, link.via])).toEqual([
      ['on-time', 'HISTORY'],
      ['old-time', 'LEGACY']
    ]);
  });

  it('reports a row that matches several departures at any date, and never puts it on LEGACY', () => {
    const extra = planned({
      key: 'extra:exception-1',
      source: 'EXTRA',
      rideExceptionId: 'exception-1'
    });
    const result = plan({
      reservations: [
        reservation({ id: 'past' }),
        reservation({ id: 'future', travelDate: future })
      ],
      stored: [stored({ id: 'bus-a' }), stored({ id: 'bus-b' })],
      history: [planned(), extra]
    });

    expect(result.legacyCreates).toEqual([]);
    expect(result.reported).toEqual([
      expect.objectContaining({
        reservationId: 'past',
        reason: 'SEVERAL_DEPARTURES',
        futureActive: false,
        candidateIds: ['new-1', 'new-2']
      }),
      expect.objectContaining({
        reservationId: 'future',
        reason: 'SEVERAL_DEPARTURES',
        futureActive: true,
        candidateIds: ['bus-a', 'bus-b']
      })
    ]);
  });

  it('links a row matching several departures to the one staff chose', () => {
    const result = plan({
      reservations: [reservation({ id: 'r1', travelDate: future })],
      stored: [stored({ id: 'bus-a' }), stored({ id: 'bus-b' })],
      manualLinks: [{ reservationId: 'r1', departureId: 'bus-b' }]
    });

    expect(result.links).toEqual([{ reservationId: 'r1', departureId: 'bus-b', via: 'MANUAL' }]);
    expect(result.reported).toEqual([]);
    expect(result.invalidManualLinks).toEqual([]);
  });

  it('refuses a manual link to a departure the reservation does not match', () => {
    const result = plan({
      reservations: [reservation({ id: 'r1', travelDate: future })],
      stored: [
        stored({ id: 'bus-a' }),
        stored({ id: 'bus-b' }),
        stored({ id: 'other-time', departureTime: '15:00' })
      ],
      manualLinks: [
        { reservationId: 'r1', departureId: 'other-time' },
        { reservationId: 'already-linked', departureId: 'bus-a' },
        { reservationId: 'r1', departureId: 'bus-a' },
        { reservationId: 'r1', departureId: 'bus-b' }
      ]
    });

    expect(result.invalidManualLinks.map((link) => [link.reservationId, link.departureId])).toEqual(
      [
        ['r1', 'other-time'],
        ['already-linked', 'bus-a'],
        ['r1', 'bus-b']
      ]
    );
    expect(result.links).toEqual([{ reservationId: 'r1', departureId: 'bus-a', via: 'MANUAL' }]);
  });

  it('treats a manual link an earlier run applied as done', () => {
    const result = plan({
      reservations: [],
      stored: [stored({ id: 'bus-a' }), stored({ id: 'bus-b' })],
      manualLinks: [
        { reservationId: 'done', departureId: 'bus-b' },
        { reservationId: 'moved', departureId: 'bus-b' },
        { reservationId: 'elsewhere', departureId: 'bus-a' }
      ],
      linked: [
        { reservationId: 'done', departureId: 'bus-b' },
        { reservationId: 'moved', departureId: 'bus-a' }
      ]
    });

    expect(result.manualLinksDone).toBe(1);
    expect(result.links).toEqual([]);
    expect(result.invalidManualLinks).toEqual([
      expect.objectContaining({
        reservationId: 'moved',
        problem: 'the reservation is already linked to another departure'
      }),
      expect.objectContaining({
        reservationId: 'elsewhere',
        problem: 'the reservation is not in this tenant'
      })
    ]);
  });

  it('reports, without changing, a reused LEGACY departure a seat does not fit on', () => {
    const result = plan({
      reservations: [
        reservation({ id: 'r1', rideDepartureTime: '08:15', seatNumber: 52 }),
        reservation({ id: 'r2', rideDepartureTime: '08:15', seatNumber: 7 })
      ],
      stored: [
        stored({
          id: 'legacy',
          source: DepartureSource.LEGACY,
          serviceDate: past,
          departureTime: '08:15',
          capacity: 48
        })
      ],
      legacySeats: [{ departureId: 'legacy', seatNumber: 7 }]
    });

    expect(result.legacyReused).toEqual([
      {
        id: 'legacy',
        reservationIds: ['r1', 'r2'],
        seatsAboveCapacity: [52],
        duplicateSeats: [7]
      }
    ]);
    expect(countDepartureBackfill(result)).toEqual(
      expect.objectContaining({ legacyDuplicateSeats: 1, legacyReusedOverCapacity: 1 })
    );
  });

  it('raises a LEGACY departure’s capacity to the highest seat sold on it', () => {
    const [legacy] = plan({
      reservations: [
        reservation({ id: 'r1', rideDepartureTime: '08:15', seatNumber: 52 }),
        reservation({ id: 'r2', rideDepartureTime: '08:15', seatNumber: 3 })
      ]
    }).legacyCreates;

    expect(legacy.capacity).toBe(52);
  });

  it('lists seats sold twice among a LEGACY key’s active reservations', () => {
    const [legacy] = plan({
      reservations: [
        reservation({ id: 'r1', rideDepartureTime: '08:15', seatNumber: 4 }),
        reservation({ id: 'r2', rideDepartureTime: '08:15', seatNumber: 4 }),
        reservation({
          id: 'r3',
          rideDepartureTime: '08:15',
          seatNumber: 5,
          status: ReservationStatus.CANCELLED
        }),
        reservation({ id: 'r4', rideDepartureTime: '08:15', seatNumber: 5 })
      ]
    }).legacyCreates;

    expect(legacy.duplicateSeats).toEqual([4]);
  });

  it('proposes nothing when every reservation is linked', () => {
    const result = plan({ stored: [stored({ id: 'timetable' })], history: [planned()] });

    expect(countDepartureBackfill(result)).toEqual(
      expect.objectContaining({ historyCreated: 0, legacyCreated: 0, legacyReused: 0 })
    );
    expect(result.links).toEqual([]);
  });
});

describe('legacyArrival', () => {
  const sold = (id: string, rideArrivalTime: string, minute: number) =>
    reservation({ id, rideArrivalTime, createdAt: new Date(Date.UTC(2026, 8, 1, 8, minute)) });

  it('takes the arrival time most reservations were sold with', () => {
    expect(
      legacyArrival([sold('a', '11:00', 0), sold('b', '11:30', 1), sold('c', '11:30', 2)])
    ).toEqual({
      chosen: '11:30',
      all: ['11:00', '11:30']
    });
  });

  it('breaks a tie by the earliest sale, not by the later time, across midnight', () => {
    // A 22:00 bus: 00:10 is later than 23:50, and ordering the text would say
    // otherwise. The earliest sale decides.
    expect(legacyArrival([sold('late', '23:50', 5), sold('early', '00:10', 1)]).chosen).toBe(
      '00:10'
    );
    expect(legacyArrival([sold('late', '00:10', 5), sold('early', '23:50', 1)]).chosen).toBe(
      '23:50'
    );
  });
});
