import { findInvalidSegments, reservationSegmentValid } from './segment-valid';
import { InvariantContext } from '../invariant.types';

const prismaMock = {
  reservation: { findMany: jest.fn() },
  ride: { findMany: jest.fn() },
  station: { findMany: jest.fn() }
};

// A context per test, not per file: checks sharing one context share one load
// of the reservation window, so reusing it across tests would answer the second
// test from the first one's rows.
let ctx: InvariantContext;

beforeEach(() => {
  ctx = {
    tenantId: 'tenant-1',
    actorId: 'admin-1',
    prisma: prismaMock,
    windowDays: 30
  } as unknown as InvariantContext;
});

// Travel dates are pinned relative to today so the window always contains them,
// whenever the suite runs.
const dateInDays = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const travelDate = dateInDays(7);

// Beograd (0) - Novi Sad (1) - Subotica (2), leaving at 07:30. Novi Sad boards
// and drops off by default, matching a freshly created line stop.
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
    intermediateStops: [{ stationId: 'station-ns', isBoarding: true, isDropoff: true }]
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

const reservation = (overrides: Record<string, unknown> = {}) => ({
  id: 'res-1',
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

describe('reservation.segmentValid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.ride.findMany.mockResolvedValue([rideWith()]);
    prismaMock.station.findMany.mockResolvedValue([
      { id: 'station-bg', name: 'Beograd' },
      { id: 'station-ns', name: 'Novi Sad' },
      { id: 'station-su', name: 'Subotica' }
    ]);
  });

  it('leaves a reservation whose segment still reads correctly alone', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([reservation()]);

    const { items, scannedReservationCount } = await findInvalidSegments(ctx);

    expect(items).toEqual([]);
    expect(scannedReservationCount).toBe(1);
  });

  // Acceptance: turning off isBoarding at a stop with an existing reservation
  // produces a violation. Novi Sad boarded passengers when this ticket was
  // sold; the line has since been edited to stop boarding there.
  it('reports a departure station a route edit turned into drop-off-only', async () => {
    prismaMock.ride.findMany.mockResolvedValue([
      rideWith({
        line: {
          name: 'Beograd - Subotica',
          departureStationId: 'station-bg',
          arrivalStationId: 'station-su',
          intermediateStops: [{ stationId: 'station-ns', isBoarding: false, isDropoff: true }]
        }
      })
    ]);
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ departureStationId: 'station-ns', arrivalStationId: 'station-su' })
    ]);

    const { items } = await findInvalidSegments(ctx);

    expect(items).toEqual([
      expect.objectContaining({
        reservationId: 'res-1',
        departureNotBoarding: true,
        orderReversed: false,
        arrivalNotDropoff: false
      })
    ]);
  });

  it('reports an arrival station a route edit turned into boarding-only', async () => {
    prismaMock.ride.findMany.mockResolvedValue([
      rideWith({
        line: {
          name: 'Beograd - Subotica',
          departureStationId: 'station-bg',
          arrivalStationId: 'station-su',
          intermediateStops: [{ stationId: 'station-ns', isBoarding: true, isDropoff: false }]
        }
      })
    ]);
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ departureStationId: 'station-bg', arrivalStationId: 'station-ns' })
    ]);

    const { items } = await findInvalidSegments(ctx);

    expect(items).toEqual([
      expect.objectContaining({ reservationId: 'res-1', arrivalNotDropoff: true, orderReversed: false })
    ]);
  });

  it('reports a segment a route reordering put backwards', async () => {
    // Novi Sad now numbers after Subotica: the line was reversed, and the
    // stored departure/arrival ids no longer sit in that order.
    prismaMock.ride.findMany.mockResolvedValue([
      rideWith({
        line: {
          name: 'Subotica - Beograd',
          departureStationId: 'station-su',
          arrivalStationId: 'station-bg',
          intermediateStops: [{ stationId: 'station-ns', isBoarding: true, isDropoff: true }]
        }
      })
    ]);
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ departureStationId: 'station-bg', arrivalStationId: 'station-ns' })
    ]);

    const { items } = await findInvalidSegments(ctx);

    expect(items).toEqual([expect.objectContaining({ reservationId: 'res-1', orderReversed: true })]);
  });

  // A station missing from the route entirely is reservation.stationsOnRoute's
  // finding: order and role cannot be judged for a station this route no
  // longer has, so reporting it here too would double-count the same
  // passenger under a heading that understates the problem.
  it('says nothing about a reservation whose station is off the route', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ departureStationId: 'station-removed' })
    ]);

    const { items } = await findInvalidSegments(ctx);

    expect(items).toEqual([]);
  });

  it('reports it as a critical violation, unrepaired', async () => {
    prismaMock.ride.findMany.mockResolvedValue([
      rideWith({
        line: {
          name: 'Beograd - Subotica',
          departureStationId: 'station-bg',
          arrivalStationId: 'station-su',
          intermediateStops: [{ stationId: 'station-ns', isBoarding: false, isDropoff: true }]
        }
      })
    ]);
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ departureStationId: 'station-ns', arrivalStationId: 'station-su' })
    ]);

    const result = await reservationSegmentValid.check(ctx);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].canRepair).toBe(false);
    expect(result.violations[0].summary).toContain('ukrcavanje');
    expect(reservationSegmentValid.repair).toBeUndefined();
  });
});
