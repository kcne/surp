import { reservationArrivalCurrent, scanForStaleArrivalTimes } from './reservation-arrival-current';
import { InvariantContext } from '../invariant.types';

const prismaMock = {
  reservation: { findMany: jest.fn(), update: jest.fn() },
  ride: { findMany: jest.fn() }
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

// The last station was moved from 23:00 to 22:15. The departure time is
// untouched, so every reservation here is still perfectly visible.
const ride = {
  id: 'ride-1',
  name: 'Istanbul - Novi Sad',
  capacity: 48,
  status: 'ACTIVE',
  type: 'RECURRING',
  recurringStartDate: dateInDays(-90),
  recurringEndDate: null,
  oneTimeDate: null,
  oneTimeDepartureTime: null,
  oneTimeArrivalTime: null,
  line: {
    name: 'Montenegro - Novi Sad',
    departureStationId: 'station-a',
    arrivalStationId: 'station-b',
    intermediateStops: [{ stationId: 'station-c' }]
  },
  daySchedules: [
    {
      dayOfWeek: travelDate.getUTCDay(),
      stationTimes: [
        { orderIndex: 0, time: '07:30' },
        { orderIndex: 1, time: '17:00' },
        { orderIndex: 2, time: '22:15' }
      ]
    }
  ],
  exceptions: []
};

const reservation = (overrides: Record<string, unknown> = {}) => ({
  id: 'res-1',
  rideId: 'ride-1',
  travelDate,
  rideDepartureTime: '07:30',
  rideArrivalTime: '23:00',
  seatNumber: 12,
  departureStationId: 'station-a',
  arrivalStationId: 'station-b',
  passenger: { firstName: 'Marko', lastName: 'Markovic', phone: '+381601234567' },
  ...overrides
});

describe('reservation.arrivalTimeCurrent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.ride.findMany.mockResolvedValue([ride]);
  });

  it('finds the reservation still quoting the old arrival time', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([reservation()]);

    const scan = await scanForStaleArrivalTimes(ctx);

    expect(scan.scannedCount).toBe(1);
    expect(scan.items).toEqual([
      expect.objectContaining({
        reservationId: 'res-1',
        departureTime: '07:30',
        storedArrivalTime: '23:00',
        currentArrivalTime: '22:15'
      })
    ]);
  });

  it('leaves a reservation whose arrival time still matches alone', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([reservation({ rideArrivalTime: '22:15' })]);

    const scan = await scanForStaleArrivalTimes(ctx);

    expect(scan.items).toEqual([]);
  });

  // An unreachable reservation has no instance to compare against, and it is
  // already reported — loudly — by reservation.reachable.
  it('says nothing about a reservation no instance reaches', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation({ rideDepartureTime: '07:45' })
    ]);

    const scan = await scanForStaleArrivalTimes(ctx);

    expect(scan.items).toEqual([]);
  });

  it('reports the stale copy as a warning the agency can act on', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([reservation()]);

    const result = await reservationArrivalCurrent.check(ctx);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].canRepair).toBe(true);
    expect(result.violations[0].summary).toContain('22:15');
  });

  it('refreshes the stored copy from the schedule it was copied from', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([reservation()]);

    const outcome = await reservationArrivalCurrent.repair!(ctx);

    expect(outcome).toEqual({ repairedCount: 1, skippedCount: 0 });
    expect(prismaMock.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res-1' },
        data: expect.objectContaining({ rideArrivalTime: '22:15', updatedById: 'admin-1' })
      })
    );
  });

  it('writes nothing when every arrival time is current', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([reservation({ rideArrivalTime: '22:15' })]);

    const outcome = await reservationArrivalCurrent.repair!(ctx);

    expect(outcome.repairedCount).toBe(0);
    expect(prismaMock.reservation.update).not.toHaveBeenCalled();
  });
});
