import { findReservationsOffRoute, reservationStationsOnRoute } from './stations-on-route';
import { InvariantContext } from '../invariant.types';

const prismaMock = {
  reservation: { findMany: jest.fn() },
  ride: { findMany: jest.fn() },
  station: { findMany: jest.fn() }
};

const ctx = {
  tenantId: 'tenant-1',
  actorId: 'admin-1',
  prisma: prismaMock,
  windowDays: 30
} as unknown as InvariantContext;

// Travel dates are pinned relative to today so the window always contains them,
// whenever the suite runs.
const dateInDays = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const travelDate = dateInDays(7);

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

describe('reservation.stationsOnRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.ride.findMany.mockResolvedValue([rideWith()]);
    prismaMock.station.findMany.mockResolvedValue([
      { id: 'station-bg', name: 'Beograd' },
      { id: 'station-ns', name: 'Novi Sad' },
      { id: 'station-su', name: 'Subotica' }
    ]);
  });

  it('leaves a reservation whose stations are both on the route alone', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([reservation()]);

    const { items, scannedReservationCount } = await findReservationsOffRoute(ctx);

    expect(items).toEqual([]);
    expect(scannedReservationCount).toBe(1);
  });

  it('names the station a route edit removed', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ departureStationId: 'station-removed' })
    ]);

    const { items } = await findReservationsOffRoute(ctx);

    expect(items).toEqual([
      expect.objectContaining({
        reservationId: 'res-1',
        offRouteStationNames: ['station-removed']
      })
    ]);
  });

  it('names both stations when neither is on the route any more', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ departureStationId: 'station-removed', arrivalStationId: 'station-gone' })
    ]);

    const { items } = await findReservationsOffRoute(ctx);

    expect(items[0].offRouteStationNames).toEqual(['station-removed', 'station-gone']);
  });

  it('reports it as a critical violation, unrepaired', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ departureStationId: 'station-removed' })
    ]);

    const result = await reservationStationsOnRoute.check(ctx);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].canRepair).toBe(false);
    expect(result.violations[0].summary).toContain('station-removed');
    expect(reservationStationsOnRoute.repair).toBeUndefined();
  });
});
