import { findReservationsWithInactivePassenger, reservationPassengerActive } from './passenger-active';
import { InvariantContext } from '../invariant.types';

const prismaMock = {
  reservation: { findMany: jest.fn() },
  ride: { findMany: jest.fn() }
};

const ctx = {
  tenantId: 'tenant-1',
  actorId: 'admin-1',
  prisma: prismaMock,
  windowDays: 30
} as unknown as InvariantContext;

const dateInDays = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const travelDate = dateInDays(7);

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
    isActive: true,
    departureStationId: 'station-bg',
    arrivalStationId: 'station-su',
    intermediateStops: []
  },
  daySchedules: [
    {
      dayOfWeek: travelDate.getUTCDay(),
      stationTimes: [
        { orderIndex: 0, time: '07:30' },
        { orderIndex: 1, time: '10:45' }
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
  passenger: {
    id: 'passenger-1',
    firstName: 'Marko',
    lastName: 'Markovic',
    phone: '+381601234567',
    isActive: true
  },
  ...overrides
});

describe('reservation.passengerActive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.ride.findMany.mockResolvedValue([rideWith()]);
  });

  it('leaves a reservation for an active passenger alone', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([reservation()]);

    const { items, scannedReservationCount } = await findReservationsWithInactivePassenger(ctx);

    expect(items).toEqual([]);
    expect(scannedReservationCount).toBe(1);
  });

  it('flags a reservation belonging to a deactivated passenger', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ passenger: { ...reservation().passenger, isActive: false } })
    ]);

    const { items } = await findReservationsWithInactivePassenger(ctx);

    expect(items).toEqual([
      expect.objectContaining({ reservationId: 'res-1', passengerId: 'passenger-1' })
    ]);
  });

  it('reports it as a critical violation, unrepaired', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ passenger: { ...reservation().passenger, isActive: false } })
    ]);

    const result = await reservationPassengerActive.check(ctx);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].canRepair).toBe(false);
    expect(result.violations[0].summary).toContain('deaktiviran');
    expect(reservationPassengerActive.repair).toBeUndefined();
  });
});
