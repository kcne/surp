import { assertDecisionDate } from '../../departures/departure-operations';
import { guardProspectiveWrite, NO_CONSENT, PROSPECTIVE_INVARIANTS } from '../prospective-write';
import { loadReservationWindow } from './reservation-window';

describe('agency date in reservation guards', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-02T00:30:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  function fixture(timezone = 'America/New_York') {
    const date = new Date('2026-10-01');
    const departure = {
      id: 'departure-1', source: 'EXTRA', departureTime: '21:00', arrivalTime: '23:00',
      capacity: 48, cancelledAt: null as Date | null, timetableDroppedAt: null,
      stops: [
        { stationId: 'a', isBoarding: true, isDropoff: false },
        { stationId: 'b', isBoarding: false, isDropoff: true }
      ]
    };
    const reservation = {
      id: 'reservation-1', rideId: 'ride-1', departureId: departure.id, travelDate: date,
      rideDepartureTime: '21:00', rideArrivalTime: '23:00', seatNumber: 40,
      departureStationId: 'a', arrivalStationId: 'b',
      passenger: { id: 'passenger-1', firstName: 'Test', lastName: 'Passenger', phone: '', isActive: true }
    };
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone }) },
      reservation: {
        findMany: jest.fn(async ({ where }: { where: { travelDate: { gte: Date; lte: Date } } }) =>
          date >= where.travelDate.gte && date <= where.travelDate.lte ? [reservation] : [])
      },
      ride: { findMany: jest.fn().mockResolvedValue([{
        id: 'ride-1', name: 'Test ride', capacity: 48, status: 'ACTIVE', type: 'ONE_TIME',
        oneTimeDate: date, oneTimeDepartureTime: '21:00', oneTimeArrivalTime: '23:00',
        recurringStartDate: null, recurringEndDate: null, daySchedules: [], exceptions: [],
        line: { name: 'Test line', isActive: true, departureStationId: 'a', arrivalStationId: 'b', intermediateStops: [] }
      }]) },
      departure: { findMany: jest.fn(async () => [departure]) },
      station: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const prisma = { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) };
    return { date, departure, tx, prisma };
  }

  it('includes agency today when UTC has advanced, and uses the same decision boundary', async () => {
    const { date, tx } = fixture();
    await assertDecisionDate(tx as never, 'tenant-1', date);
    const window = await loadReservationWindow({ tenantId: 'tenant-1', actorId: 'admin-1', windowDays: 30, prisma: tx as never });
    expect(window.windowStartDate).toBe('2026-10-01');
    expect(window.reservations).toHaveLength(1);
  });

  it.each([
    ['cancel', PROSPECTIVE_INVARIANTS.departureCancel, { cancelledAt: new Date('2026-10-02') }, 'reservation.reachable'],
    ['retime', PROSPECTIVE_INVARIANTS.extraUpdate, { departureTime: '22:00' }, 'reservation.departureTimeKept'],
    ['shrink', PROSPECTIVE_INVARIANTS.extraUpdate, { capacity: 30 }, 'reservation.seatWithinCapacity']
  ])('asks before %s on a booked agency-today bus', async (_operation, invariants, changes, invariant) => {
    const { prisma, departure } = fixture();
    await expect(guardProspectiveWrite(
      prisma as never, { tenantId: 'tenant-1', actorId: 'admin-1', changesTimetable: false },
      invariants, NO_CONSENT, async () => { Object.assign(departure, changes); }
    )).rejects.toMatchObject({
      response: { code: 'WOULD_BREAK_RESERVATIONS', invariant, affectedCount: 1 }
    });
  });

  it('excludes agency yesterday after local midnight', async () => {
    const { tx } = fixture('Europe/Belgrade');
    const window = await loadReservationWindow({ tenantId: 'tenant-1', actorId: 'admin-1', windowDays: 30, prisma: tx as never });
    expect(window.windowStartDate).toBe('2026-10-02');
    expect(window.reservations).toEqual([]);
  });
});
