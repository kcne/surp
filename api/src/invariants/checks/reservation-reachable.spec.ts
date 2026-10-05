import { buildOrphanReport, reservationReachable } from './reservation-reachable';
import { InvariantContext } from '../invariant.types';

/**
 * `orphaned-reservations.spec.ts` covers the classification rules in
 * isolation; these cover the scan as it reads reservations and the departures
 * they are on.
 */

const prismaMock = {
  tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: null }) },
  ride: { findMany: jest.fn() },
  reservation: { findMany: jest.fn() },
  station: { findMany: jest.fn() },
  departure: { findMany: jest.fn() }
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

// Travel dates are pinned relative to today so the 30-day window always
// contains them, whenever the suite runs.
const dateInDays = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const travelDate = dateInDays(7);

const ride = (overrides: Record<string, unknown> = {}) => ({
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
        { orderIndex: 0, time: '07:45' },
        { orderIndex: 1, time: '12:00' },
        { orderIndex: 2, time: '23:00' }
      ]
    }
  ],
  ...overrides
});

const departure = (overrides: Record<string, unknown> = {}) => ({
  id: 'departure-1',
  source: 'SCHEDULE',
  departureTime: '07:45',
  arrivalTime: '23:00',
  capacity: 48,
  cancelledAt: null,
  timetableDroppedAt: null,
  stops: [
    { stationId: 'station-a', isBoarding: true, isDropoff: false },
    { stationId: 'station-c', isBoarding: true, isDropoff: true },
    { stationId: 'station-b', isBoarding: false, isDropoff: true }
  ],
  ...overrides
});

const reservation = (overrides: Record<string, unknown> = {}) => ({
  id: 'res-1',
  rideId: 'ride-1',
  departureId: 'departure-1',
  travelDate,
  rideDepartureTime: '07:45',
  rideArrivalTime: '23:00',
  seatNumber: 12,
  departureStationId: 'station-a',
  arrivalStationId: 'station-b',
  passenger: { firstName: 'Marko', lastName: 'Markovic', phone: '+381601234567' },
  ...overrides
});

function given({
  rides = [ride()],
  departures = [departure()],
  reservations = [reservation()]
}: {
  rides?: unknown[];
  departures?: unknown[];
  reservations?: unknown[];
} = {}) {
  prismaMock.ride.findMany.mockResolvedValue(rides);
  prismaMock.departure.findMany.mockResolvedValue(departures);
  prismaMock.reservation.findMany.mockResolvedValue(reservations);
}

describe('reservation.reachable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.station.findMany.mockResolvedValue([
      { id: 'station-a', name: 'Bar' },
      { id: 'station-b', name: 'Novi Sad' },
      { id: 'station-c', name: 'Podgorica' }
    ]);
  });

  it('is quiet while the departure runs, whatever the timetable says of the day', async () => {
    // The weekday left the schedule, but the sync has not dropped this bus.
    given({ rides: [ride({ daySchedules: [] })] });

    const report = await buildOrphanReport(ctx);

    expect(report.scannedReservationCount).toBe(1);
    expect(report.items).toEqual([]);
  });

  it('lists a passenger on a cancelled departure, with nothing to repair', async () => {
    given({ departures: [departure({ cancelledAt: new Date() })] });

    const result = await reservationReachable.check(ctx);

    expect(result.violations).toEqual([
      expect.objectContaining({
        subjectId: 'res-1',
        summary: `Marko Markovic, ${travelDate.toISOString().slice(0, 10)}, polazak 07:45: polazak je otkazan.`,
        canRepair: false,
        detail: expect.objectContaining({ reason: 'DEPARTURE_CANCELLED' })
      })
    ]);
  });

  it('names the weekday the timetable dropped the departure for', async () => {
    given({
      rides: [ride({ daySchedules: [] })],
      departures: [departure({ timetableDroppedAt: new Date() })]
    });

    const report = await buildOrphanReport(ctx);

    expect(report.items.map((item) => item.reason)).toEqual(['WEEKDAY_NOT_SCHEDULED']);
  });

  it('names an inactive ride ahead of its schedule', async () => {
    given({
      rides: [ride({ status: 'INACTIVE' })],
      departures: [departure({ timetableDroppedAt: new Date() })]
    });

    const report = await buildOrphanReport(ctx);

    expect(report.items.map((item) => item.reason)).toEqual(['RIDE_NOT_ACTIVE']);
  });

  it('reads stations against the stops the departure stored', async () => {
    // station-c is still on the line, but this departure was stored without it.
    given({
      departures: [
        departure({
          cancelledAt: new Date(),
          stops: [
            { stationId: 'station-a', isBoarding: true, isDropoff: false },
            { stationId: 'station-b', isBoarding: false, isDropoff: true }
          ]
        })
      ],
      reservations: [reservation({ arrivalStationId: 'station-c' })]
    });

    const report = await buildOrphanReport(ctx);

    expect(report.items[0].offRouteStationNames).toEqual(['Podgorica']);
  });

  it('offers no repair: the passenger is on the right bus, and the bus is not going', () => {
    expect(reservationReachable.repair).toBeUndefined();
    expect(reservationReachable.assessRepair).toBeUndefined();
    expect(reservationReachable.repairMessage).toBeUndefined();
  });

  it("fails loudly when a reservation's departure was not loaded", async () => {
    // The foreign key makes this impossible in the database, so it is a bug in
    // the load, not drift to report.
    given({ departures: [] });

    await expect(buildOrphanReport(ctx)).rejects.toThrow(
      'Departure departure-1 of reservation res-1 was not loaded'
    );
  });
});
