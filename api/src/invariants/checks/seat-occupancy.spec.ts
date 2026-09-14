import { findOverbookedInstances } from './instance-not-overbooked';
import { findSeatClashes } from './seat-unique';
import { findSeatsOverCapacity } from './seat-within-capacity';
import { InvariantContext } from '../invariant.types';

const prismaMock = {
  reservation: { findMany: jest.fn() },
  ride: { findMany: jest.fn() },
  station: { findMany: jest.fn() }
};

/**
 * A fresh context per test, because that is what one is: the three checks share
 * the occupancy scan they build against a context, so reusing one across tests
 * would hand the second test the first one's data. `InvariantsService` mints one
 * per request for the same reason.
 */
const contextFor = () =>
  ({
    tenantId: 'tenant-1',
    actorId: 'admin-1',
    prisma: prismaMock,
    windowDays: 30
  }) as unknown as InvariantContext;

let ctx: InvariantContext;

// Travel dates are pinned relative to today so the window always contains them,
// whenever the suite runs.
const dateInDays = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const travelDate = dateInDays(7);
const travelDateString = travelDate.toISOString().slice(0, 10);

// Beograd (0) - Novi Sad (1) - Subotica (2), leaving at 07:30.
const rideWith = (overrides: Record<string, unknown> = {}) => ({
  id: 'ride-1',
  name: 'Beograd - Subotica',
  capacity: 38,
  status: 'ACTIVE',
  type: 'RECURRING',
  recurringStartDate: dateInDays(-90),
  recurringEndDate: null,
  oneTimeDate: null,
  oneTimeDepartureTime: null,
  oneTimeArrivalTime: null,
  line: {
    name: 'Beograd - Subotica',
    departureStationId: 'station-bg',
    arrivalStationId: 'station-su',
    intermediateStops: [{ stationId: 'station-ns' }]
  },
  daySchedules: [
    {
      dayOfWeek: travelDate.getUTCDay(),
      stationTimes: [
        { orderIndex: 0, time: '07:30' },
        { orderIndex: 1, time: '09:00' },
        { orderIndex: 2, time: '10:45' }
      ]
    }
  ],
  exceptions: [],
  ...overrides
});

let nextId = 0;

const reservation = (overrides: Record<string, unknown> = {}) => ({
  id: `res-${(nextId += 1)}`,
  rideId: 'ride-1',
  travelDate,
  rideDepartureTime: '07:30',
  rideArrivalTime: '10:45',
  seatNumber: 12,
  departureStationId: 'station-bg',
  arrivalStationId: 'station-su',
  passenger: { firstName: 'Marko', lastName: 'Markovic', phone: '+381601234567' },
  ...overrides
});

beforeEach(() => {
  jest.clearAllMocks();
  nextId = 0;
  ctx = contextFor();
  prismaMock.ride.findMany.mockResolvedValue([rideWith()]);
  prismaMock.station.findMany.mockResolvedValue([
    { id: 'station-bg', name: 'Beograd' },
    { id: 'station-ns', name: 'Novi Sad' },
    { id: 'station-su', name: 'Subotica' }
  ]);
});

describe('reservation.seatUnique', () => {
  it('reports two passengers holding one seat over the same stretch', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation(),
      reservation({
        seatNumber: 12,
        departureStationId: 'station-ns',
        passenger: { firstName: 'Ana', lastName: 'Anic', phone: '+381602222222' }
      })
    ]);

    const { items } = await findSeatClashes(ctx);

    expect(items).toEqual([
      expect.objectContaining({
        seatNumber: 12,
        reservationId: 'res-2',
        passengerName: 'Ana Anic',
        segmentLabel: 'Novi Sad - Subotica',
        otherReservationId: 'res-1',
        otherPassengerName: 'Marko Markovic',
        otherSegmentLabel: 'Beograd - Subotica'
      })
    ]);
  });

  // The reason a plain UNIQUE constraint on (instance, seat) would be wrong:
  // one seat legitimately carries two passengers on one run, as long as the
  // first is off the bus before the second gets on.
  it('leaves one seat sold twice on disjoint legs alone', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ seatNumber: 12, departureStationId: 'station-bg', arrivalStationId: 'station-ns' }),
      reservation({
        seatNumber: 12,
        departureStationId: 'station-ns',
        arrivalStationId: 'station-su',
        passenger: { firstName: 'Ana', lastName: 'Anic', phone: '+381602222222' }
      })
    ]);

    const { items, scannedReservationCount } = await findSeatClashes(ctx);

    expect(items).toEqual([]);
    expect(scannedReservationCount).toBe(2);
  });

  it('leaves different seats alone', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ seatNumber: 12 }),
      reservation({ seatNumber: 13 })
    ]);

    await expect(findSeatClashes(ctx)).resolves.toMatchObject({ items: [] });
  });

  // #14: the route edit moved the departure from 07:30 to 07:45, so the older
  // reservation kept a time the app no longer shows, took a different advisory
  // lock, and the seat was sold again. Both are on one bus; only a check that
  // resolves the stale time onto the current departure can see it.
  it('sees through a departure time the route edit moved', async () => {
    prismaMock.ride.findMany.mockResolvedValue([
      rideWith({
        daySchedules: [
          {
            dayOfWeek: travelDate.getUTCDay(),
            stationTimes: [
              { orderIndex: 0, time: '07:45' },
              { orderIndex: 1, time: '09:15' },
              { orderIndex: 2, time: '11:00' }
            ]
          }
        ]
      })
    ]);
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ seatNumber: 12, rideDepartureTime: '07:30' }),
      reservation({
        seatNumber: 12,
        rideDepartureTime: '07:45',
        passenger: { firstName: 'Ana', lastName: 'Anic', phone: '+381602222222' }
      })
    ]);

    const { items } = await findSeatClashes(ctx);

    expect(items).toEqual([
      expect.objectContaining({
        seatNumber: 12,
        departureTime: '07:45',
        fromDriftedTime: true
      })
    ]);
  });

  it('reports all three clashes when three passengers hold one seat', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ seatNumber: 12 }),
      reservation({ seatNumber: 12 }),
      reservation({ seatNumber: 12 })
    ]);

    const { items } = await findSeatClashes(ctx);

    expect(items).toHaveLength(3);
  });

  // A station dropped from the line leaves reservations naming it unplaceable,
  // so their segment is assumed to be the whole route and overlaps everything.
  // The clash is worth reporting, but the agency has to be told the deonica was
  // assumed — otherwise the two station names on the row name a route that no
  // longer exists and the finding looks like a plain double-booking.
  it('says so when a removed station forced the segment to be assumed', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ seatNumber: 12, arrivalStationId: 'station-ns' }),
      reservation({
        seatNumber: 12,
        departureStationId: 'station-gone',
        passenger: { firstName: 'Ana', lastName: 'Anic', phone: '+381602222222' }
      })
    ]);

    const { items } = await findSeatClashes(ctx);

    expect(items).toEqual([expect.objectContaining({ seatNumber: 12, segmentAssumed: true })]);
  });

  it('leaves segmentAssumed off when both segments are on the route', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ seatNumber: 12 }),
      reservation({ seatNumber: 12 })
    ]);

    const { items } = await findSeatClashes(ctx);

    expect(items).toEqual([expect.objectContaining({ segmentAssumed: false })]);
  });

  it('keeps two departures on the same day apart', async () => {
    prismaMock.ride.findMany.mockResolvedValue([
      rideWith({
        exceptions: [
          {
            exceptionDate: travelDate,
            type: 'ADDITIONAL',
            departureTime: '15:00',
            arrivalTime: '18:15'
          }
        ]
      })
    ]);
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ seatNumber: 12, rideDepartureTime: '07:30' }),
      reservation({ seatNumber: 12, rideDepartureTime: '15:00', rideArrivalTime: '18:15' })
    ]);

    await expect(findSeatClashes(ctx)).resolves.toMatchObject({ items: [] });
  });
});

describe('reservation.seatWithinCapacity', () => {
  it('reports a seat the bus no longer has', async () => {
    prismaMock.ride.findMany.mockResolvedValue([rideWith({ capacity: 30 })]);
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ seatNumber: 30 }),
      reservation({ seatNumber: 31 })
    ]);

    const { items } = await findSeatsOverCapacity(ctx);

    expect(items).toEqual([
      expect.objectContaining({ reservationId: 'res-2', seatNumber: 31, capacity: 30 })
    ]);
  });

  it('says nothing when every seat fits', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([reservation({ seatNumber: 38 })]);

    await expect(findSeatsOverCapacity(ctx)).resolves.toMatchObject({ items: [] });
  });
});

describe('instance.notOverbooked', () => {
  it('reports the busiest leg of an overfull departure', async () => {
    prismaMock.ride.findMany.mockResolvedValue([rideWith({ capacity: 2 })]);
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ seatNumber: 1, arrivalStationId: 'station-ns' }),
      reservation({ seatNumber: 2, arrivalStationId: 'station-ns' }),
      reservation({ seatNumber: 3, arrivalStationId: 'station-ns' })
    ]);

    const { items, scannedInstanceCount } = await findOverbookedInstances(ctx);

    expect(scannedInstanceCount).toBe(1);
    expect(items).toEqual([
      expect.objectContaining({
        travelDate: travelDateString,
        departureTime: '07:30',
        capacity: 2,
        legLabel: 'Beograd - Novi Sad',
        passengerCount: 3,
        excessCount: 1
      })
    ]);
  });

  // Capacity is a count per leg, not per run: a two-seat bus carries four
  // passengers over this route without ever having three aboard at once.
  it('leaves a bus that fills and empties along the way alone', async () => {
    prismaMock.ride.findMany.mockResolvedValue([rideWith({ capacity: 2 })]);
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ seatNumber: 1, arrivalStationId: 'station-ns' }),
      reservation({ seatNumber: 2, arrivalStationId: 'station-ns' }),
      reservation({ seatNumber: 1, departureStationId: 'station-ns' }),
      reservation({ seatNumber: 2, departureStationId: 'station-ns' })
    ]);

    await expect(findOverbookedInstances(ctx)).resolves.toMatchObject({ items: [] });
  });

  it('counts reservations split across a moved departure time together', async () => {
    prismaMock.ride.findMany.mockResolvedValue([
      rideWith({
        capacity: 1,
        daySchedules: [
          {
            dayOfWeek: travelDate.getUTCDay(),
            stationTimes: [
              { orderIndex: 0, time: '07:45' },
              { orderIndex: 1, time: '09:15' },
              { orderIndex: 2, time: '11:00' }
            ]
          }
        ]
      })
    ]);
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ seatNumber: 1, rideDepartureTime: '07:30' }),
      reservation({ seatNumber: 2, rideDepartureTime: '07:45' })
    ]);

    const { items } = await findOverbookedInstances(ctx);

    expect(items).toEqual([
      expect.objectContaining({ departureTime: '07:45', passengerCount: 2, excessCount: 1 })
    ]);
  });
});

describe('the scan the three checks share', () => {
  // The point of building the occupancy once is that the three checks cannot
  // disagree about who shares a bus. Three separate loads would also mean three
  // full window queries per report.
  it('queries the window once for all three checks on one context', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([reservation({ seatNumber: 12 })]);

    await findSeatClashes(ctx);
    await findSeatsOverCapacity(ctx);
    await findOverbookedInstances(ctx);

    expect(prismaMock.reservation.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.ride.findMany).toHaveBeenCalledTimes(1);
  });

  it('does not carry a scan across to a new context', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([reservation({ seatNumber: 12 })]);
    await findSeatClashes(ctx);

    prismaMock.ride.findMany.mockResolvedValue([rideWith({ capacity: 5 })]);
    prismaMock.reservation.findMany.mockResolvedValue([reservation({ seatNumber: 40 })]);

    await expect(findSeatsOverCapacity(contextFor())).resolves.toMatchObject({
      items: [expect.objectContaining({ seatNumber: 40, capacity: 5 })]
    });
  });
});
