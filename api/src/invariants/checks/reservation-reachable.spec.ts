import { ORPHAN_NO_FREE_SEAT_ADVICE } from './orphaned-reservations';
import { buildOrphanReport, repairOrphanedReservations } from './reservation-reachable';
import { InvariantContext } from '../invariant.types';

/**
 * Moved here from the maintenance service spec when #24 replaced the four
 * settings cards with one page. `orphaned-reservations.spec.ts` covers the
 * classification rules in isolation; these cover the scan and the repair as
 * they run against the database.
 */

const prismaMock = {
  ride: { findMany: jest.fn() },
  reservation: { findMany: jest.fn(), update: jest.fn() },
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

// Travel dates are pinned relative to today so the 30-day window always
// contains them, whenever the suite runs.
const dateInDays = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const travelDate = dateInDays(7);

// The line gained a new first station at 07:30; the old head departed at
// 07:45, which is what every reservation below still stores.
const strandedRide = {
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
        { orderIndex: 1, time: '07:45' },
        { orderIndex: 2, time: '23:00' }
      ]
    }
  ],
  exceptions: []
};

const reservation = (id: string, seatNumber: number, departureTime: string) => ({
  id,
  rideId: 'ride-1',
  travelDate,
  rideDepartureTime: departureTime,
  rideArrivalTime: '23:00',
  seatNumber,
  departureStationId: 'station-a',
  arrivalStationId: 'station-b',
  passenger: { firstName: 'Marko', lastName: 'Markovic', phone: '+381601234567' }
});

const skippedRide = {
  ...strandedRide,
  exceptions: [{ exceptionDate: travelDate, type: 'SKIP', departureTime: null, arrivalTime: null }]
};

describe('reservation.reachable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.station.findMany.mockResolvedValue([]);
    prismaMock.ride.findMany.mockResolvedValue([strandedRide]);
  });

  it('points stranded reservations at the instance that replaced their departure time', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([reservation('res-1', 12, '07:45')]);

    const report = await buildOrphanReport(ctx);

    expect(report.scannedReservationCount).toBe(1);
    expect(report.orphanedCount).toBe(1);
    expect(report.repairableCount).toBe(1);
    expect(report.seatChangeCount).toBe(0);
    expect(report.items[0]).toEqual(
      expect.objectContaining({
        reason: 'DEPARTURE_TIME_MOVED',
        currentDepartureTime: '07:45',
        targetDepartureTime: '07:30',
        targetArrivalTime: '23:00',
        seatNumber: 12,
        targetSeatNumber: 12,
        canRepair: true
      })
    );
  });

  it('leaves reservations already sitting on a live instance alone', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([reservation('res-1', 12, '07:30')]);

    const report = await buildOrphanReport(ctx);

    expect(report.scannedReservationCount).toBe(1);
    expect(report.orphanedCount).toBe(0);
  });

  it('moves a stranded reservation off a seat a visible passenger now holds', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      // Sold after the route changed, so it is visible and owns seat 12.
      reservation('res-visible', 12, '07:30'),
      reservation('res-stranded', 12, '07:45')
    ]);

    const report = await buildOrphanReport(ctx);

    expect(report.orphanedCount).toBe(1);
    expect(report.seatChangeCount).toBe(1);
    expect(report.items[0]).toEqual(
      expect.objectContaining({ reservationId: 'res-stranded', targetSeatNumber: 1 })
    );
  });

  it('lets every orphan that can keep its seat do so before reseating the rest', async () => {
    // A single pass would hand seat 1 to res-b, evicting res-a from a seat it
    // could have kept and cascading one collision into two moves.
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation('res-visible', 5, '07:30'),
      reservation('res-a', 1, '07:45'),
      reservation('res-b', 5, '07:45')
    ]);

    const report = await buildOrphanReport(ctx);

    const seatOf = (id: string) =>
      report.items.find((item) => item.reservationId === id)?.targetSeatNumber;

    expect(seatOf('res-a')).toBe(1);
    expect(seatOf('res-b')).toBe(2);
    expect(report.seatChangeCount).toBe(1);
  });

  it('refuses to guess when the travel date carries more than one departure', async () => {
    prismaMock.ride.findMany.mockResolvedValue([
      {
        ...strandedRide,
        exceptions: [
          {
            exceptionDate: travelDate,
            type: 'ADDITIONAL',
            departureTime: '14:00',
            arrivalTime: '05:00'
          }
        ]
      }
    ]);
    prismaMock.reservation.findMany.mockResolvedValue([reservation('res-1', 12, '07:45')]);

    const report = await buildOrphanReport(ctx);

    expect(report.items[0]).toEqual(
      expect.objectContaining({
        reason: 'AMBIGUOUS_INSTANCE',
        targetDepartureTime: null,
        canRepair: false
      })
    );
    expect(report.repairableCount).toBe(0);
  });

  // The advice sentence for a moved departure describes what the repair will
  // do, and the repair declines when the only departure left is full. Showing
  // that sentence there would promise a button that is refusing to act.
  it('tells the agency the bus is full rather than promising a repair', async () => {
    prismaMock.ride.findMany.mockResolvedValue([{ ...strandedRide, capacity: 1 }]);
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation('res-visible', 1, '07:30'),
      reservation('res-stranded', 1, '07:45')
    ]);

    const report = await buildOrphanReport(ctx);
    const stranded = report.items.find((item) => item.reservationId === 'res-stranded');

    expect(stranded).toEqual(
      expect.objectContaining({
        reason: 'DEPARTURE_TIME_MOVED',
        targetDepartureTime: '07:30',
        targetSeatNumber: null,
        canRepair: false,
        reasonAdvice: ORPHAN_NO_FREE_SEAT_ADVICE
      })
    );
  });

  it('says somebody marked the date as not running, rather than that no bus exists', async () => {
    prismaMock.ride.findMany.mockResolvedValue([skippedRide]);
    // 07:30 is what the ride's own schedule produces, so the skip is the only
    // thing standing between this reservation and its departure.
    prismaMock.reservation.findMany.mockResolvedValue([reservation('res-1', 12, '07:30')]);

    const report = await buildOrphanReport(ctx);

    expect(report.items[0]).toEqual(
      expect.objectContaining({
        reason: 'SKIPPED_BY_EXCEPTION',
        reasonLabel: 'Upisano je da se tog dana ne vozi',
        canRepair: false
      })
    );
    expect(report.items[0].reasonAdvice.length).toBeGreaterThan(0);
  });

  it('separates a deleted extra departure by the time the reservation still holds', async () => {
    prismaMock.ride.findMany.mockResolvedValue([skippedRide]);
    // 07:45 is a time the base schedule never produced, so this passenger was
    // booked onto an extra departure that has since been deleted.
    prismaMock.reservation.findMany.mockResolvedValue([reservation('res-1', 12, '07:45')]);

    const report = await buildOrphanReport(ctx);

    expect(report.items[0]).toEqual(
      expect.objectContaining({ reason: 'EXTRA_DEPARTURE_REMOVED', canRepair: false })
    );
  });

  it('names the weekday dropped from the schedule as its own cause', async () => {
    prismaMock.ride.findMany.mockResolvedValue([{ ...strandedRide, daySchedules: [] }]);
    prismaMock.reservation.findMany.mockResolvedValue([reservation('res-1', 12, '07:45')]);

    const report = await buildOrphanReport(ctx);

    expect(report.items[0]).toEqual(
      expect.objectContaining({ reason: 'WEEKDAY_NOT_SCHEDULED', canRepair: false })
    );
  });

  it('names a travel date past a shortened recurring period', async () => {
    prismaMock.ride.findMany.mockResolvedValue([
      { ...strandedRide, recurringEndDate: dateInDays(1) }
    ]);
    prismaMock.reservation.findMany.mockResolvedValue([reservation('res-1', 12, '07:45')]);

    const report = await buildOrphanReport(ctx);

    expect(report.items[0]).toEqual(
      expect.objectContaining({ reason: 'DATE_OUTSIDE_RANGE', canRepair: false })
    );
  });

  it('writes the new departure time and seat, and skips what it cannot place', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation('res-visible', 12, '07:30'),
      reservation('res-stranded', 12, '07:45')
    ]);

    const result = await repairOrphanedReservations(ctx);

    expect(result.repairedCount).toBe(1);
    expect(result.seatChangedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(prismaMock.reservation.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res-stranded' },
        data: expect.objectContaining({
          rideDepartureTime: '07:30',
          rideArrivalTime: '23:00',
          seatNumber: 1,
          updatedById: 'admin-1'
        })
      })
    );
  });

  it('leaves unrelated pre-existing orphans untouched during a prospective repair', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation('res-old', 8, '07:45'),
      reservation('res-new', 12, '07:45')
    ]);

    const result = await repairOrphanedReservations(ctx, new Set(['res-new']));

    expect(result.repairedCount).toBe(1);
    expect(prismaMock.reservation.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'res-new' } })
    );
  });

  it('does not let an unrelated orphan claim the only seat in a scoped repair', async () => {
    prismaMock.ride.findMany.mockResolvedValue([{ ...strandedRide, capacity: 1 }]);
    prismaMock.reservation.findMany.mockResolvedValue([
      reservation('res-old', 1, '07:45'),
      reservation('res-new', 1, '07:45')
    ]);

    const fullReport = await buildOrphanReport(ctx);
    const selectedCtx = { ...ctx };
    const selectedReport = await buildOrphanReport(selectedCtx, new Set(['res-new']));

    expect(fullReport.items.find((item) => item.reservationId === 'res-new')?.canRepair).toBe(false);
    expect(selectedReport.items.find((item) => item.reservationId === 'res-new')).toEqual(
      expect.objectContaining({ canRepair: true, targetSeatNumber: 1 })
    );

    await repairOrphanedReservations({ ...ctx }, new Set(['res-new']));
    expect(prismaMock.reservation.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'res-new' } })
    );
  });

  it('touches nothing when no single instance can claim the orphans', async () => {
    prismaMock.ride.findMany.mockResolvedValue([
      { ...strandedRide, status: 'INACTIVE', daySchedules: [] }
    ]);
    prismaMock.reservation.findMany.mockResolvedValue([reservation('res-1', 12, '07:45')]);

    const result = await repairOrphanedReservations(ctx);

    expect(result.repairedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(result.items[0].reason).toBe('RIDE_NOT_ACTIVE');
    expect(prismaMock.reservation.update).not.toHaveBeenCalled();
  });
});
