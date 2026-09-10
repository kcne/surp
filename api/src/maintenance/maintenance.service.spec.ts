import { UserRole } from '@prisma/client';
import { MaintenanceService } from './maintenance.service';

describe('MaintenanceService', () => {
  const prismaMock = {
    $transaction: jest.fn(),
    line: { findMany: jest.fn() },
    station: { findMany: jest.fn() },
    ride: { findMany: jest.fn() },
    reservation: { findMany: jest.fn(), update: jest.fn() }
  };

  const pairedLines = [
    {
      id: 'line-out',
      name: 'Novi Sad - Istanbul',
      pairKey: 'pair-1',
      direction: 'OUTBOUND',
      departureStationId: 'station-a',
      arrivalStationId: 'station-b',
      intermediateStops: [
        { stationId: 'station-c', orderIndex: 1 },
        { stationId: 'station-d', orderIndex: 2 }
      ]
    },
    {
      id: 'line-in',
      name: 'Istanbul - Novi Sad',
      pairKey: 'pair-1',
      direction: 'RETURN',
      // Mirrors the outbound but never received station-d.
      departureStationId: 'station-terminus',
      arrivalStationId: 'station-a',
      intermediateStops: [{ stationId: 'station-c', orderIndex: 1 }]
    }
  ];

  const auth = {
    sub: 'admin-1',
    tenantId: 'tenant-1',
    role: UserRole.ADMIN,
    tenantSlug: 'tenant-one'
  } as never;

  const stations = [
    { id: 'station-a', name: 'Central' },
    { id: 'station-b', name: 'North' },
    { id: 'station-c', name: 'Mid 1' },
    { id: 'station-d', name: 'Mid 2' },
    { id: 'station-x', name: 'Other' },
    { id: 'station-terminus', name: 'Terminus' }
  ];

  // Route is A -> C -> D -> B; the stored schedule predates station D.
  const lineWithDriftedRide = {
    id: 'line-1',
    name: 'Central - North',
    departureStationId: 'station-a',
    arrivalStationId: 'station-b',
    intermediateStops: [
      { stationId: 'station-c', orderIndex: 1 },
      { stationId: 'station-d', orderIndex: 2 }
    ],
    rides: [
      {
        id: 'ride-1',
        name: 'Central - North',
        daySchedules: [
          {
            id: 'day-schedule-1',
            dayOfWeek: 1,
            stationTimes: [
              { stationId: 'station-a', orderIndex: 0, time: '08:00' },
              { stationId: 'station-c', orderIndex: 1, time: '09:00' },
              { stationId: 'station-b', orderIndex: 2, time: '10:00' }
            ]
          }
        ]
      }
    ]
  };

  let service: MaintenanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.station.findMany.mockResolvedValue(stations);
    service = new MaintenanceService(prismaMock as never);
  });

  it('reports a schedule that is missing a station added to its route', async () => {
    prismaMock.line.findMany.mockResolvedValue([lineWithDriftedRide]);

    const report = await service.getScheduleDriftReport(auth);

    expect(report.scannedScheduleCount).toBe(1);
    expect(report.driftedScheduleCount).toBe(1);
    expect(report.affectedRideCount).toBe(1);
    expect(report.items[0]).toEqual(
      expect.objectContaining({
        rideName: 'Central - North',
        dayOfWeek: 1,
        scheduleStationCount: 3,
        routeStationCount: 4,
        addedStationNames: ['Mid 2'],
        removedStationNames: []
      })
    );
  });

  it('reports nothing when every schedule already matches its route', async () => {
    prismaMock.line.findMany.mockResolvedValue([
      {
        ...lineWithDriftedRide,
        intermediateStops: [{ stationId: 'station-c', orderIndex: 1 }]
      }
    ]);

    const report = await service.getScheduleDriftReport(auth);

    expect(report.driftedScheduleCount).toBe(0);
    expect(report.items).toEqual([]);
  });

  it('rewrites drifted schedules and preserves times of surviving stations', async () => {
    prismaMock.line.findMany.mockResolvedValue([lineWithDriftedRide]);

    const tx = {
      rideDayScheduleStationTime: {
        deleteMany: jest.fn(),
        createMany: jest.fn()
      }
    };
    prismaMock.$transaction.mockImplementation(async (callback: (db: typeof tx) => unknown) =>
      callback(tx)
    );

    const result = await service.realignSchedules(auth);

    expect(result.realignedScheduleCount).toBe(1);
    expect(result.affectedRideCount).toBe(1);
    expect(result.estimatedTimeCount).toBe(1);

    const [{ data }] = tx.rideDayScheduleStationTime.createMany.mock.calls[0];
    expect(data.map((entry: { stationId: string }) => entry.stationId)).toEqual([
      'station-a',
      'station-c',
      'station-d',
      'station-b'
    ]);
    // Mid 2 is new, so its time is estimated midway between Mid 1 and North.
    expect(data.map((entry: { time: string | null }) => entry.time)).toEqual([
      '08:00',
      '09:00',
      '09:30',
      '10:00'
    ]);
    expect(data.every((entry: { updatedById: string }) => entry.updatedById === 'admin-1')).toBe(true);
  });

  it('does not write anything when there is no drift', async () => {
    prismaMock.line.findMany.mockResolvedValue([
      {
        ...lineWithDriftedRide,
        intermediateStops: [{ stationId: 'station-c', orderIndex: 1 }]
      }
    ]);

    const result = await service.realignSchedules(auth);

    expect(result.realignedScheduleCount).toBe(0);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
  describe('paired line directions', () => {
    it('reports a pair where one direction is missing a stop', async () => {
      prismaMock.line.findMany.mockResolvedValue(pairedLines);

      const report = await service.getPairDriftReport(auth);

      expect(report.scannedPairCount).toBe(1);
      expect(report.driftedPairCount).toBe(1);
      expect(report.items[0].canAutoSync).toBe(true);
      expect(report.items[0].inbound.missingStationNames).toEqual(['Mid 2']);
      expect(report.items[0].outbound.missingStationNames).toEqual([]);
    });

    it('reports nothing when both directions already mirror each other', async () => {
      prismaMock.line.findMany.mockResolvedValue([
        pairedLines[0],
        {
          ...pairedLines[1],
          intermediateStops: [
            { stationId: 'station-d', orderIndex: 1 },
            { stationId: 'station-c', orderIndex: 2 }
          ]
        }
      ]);

      const report = await service.getPairDriftReport(auth);

      expect(report.driftedPairCount).toBe(0);
    });

    it('writes the missing stop into the direction that lacks it, reversed', async () => {
      prismaMock.line.findMany.mockResolvedValue(pairedLines);

      const tx = {
        lineStop: { deleteMany: jest.fn(), createMany: jest.fn() },
        ride: { findMany: jest.fn().mockResolvedValue([]) },
        rideDayScheduleStationTime: { deleteMany: jest.fn(), createMany: jest.fn() }
      };
      prismaMock.$transaction.mockImplementation(async (callback: (db: typeof tx) => unknown) =>
        callback(tx)
      );

      const result = await service.syncPairs(auth);

      expect(result.syncedPairCount).toBe(1);
      expect(result.skippedPairCount).toBe(0);

      const inboundWrite = tx.lineStop.createMany.mock.calls[1][0];
      expect(
        inboundWrite.data.map((entry: { stationId: string; orderIndex: number }) => ({
          stationId: entry.stationId,
          orderIndex: entry.orderIndex
        }))
      ).toEqual([
        { stationId: 'station-d', orderIndex: 1 },
        { stationId: 'station-c', orderIndex: 2 }
      ]);
    });

    it('skips a pair whose directions genuinely disagree rather than guessing', async () => {
      prismaMock.line.findMany.mockResolvedValue([
        pairedLines[0],
        {
          ...pairedLines[1],
          // Holds a stop the outbound does not have, so neither side is richer.
          intermediateStops: [{ stationId: 'station-x', orderIndex: 1 }]
        }
      ]);

      const result = await service.syncPairs(auth);

      expect(result.syncedPairCount).toBe(0);
      expect(result.skippedPairCount).toBe(1);
      expect(result.items[0].canAutoSync).toBe(false);
      expect(result.items[0].conflictReason).toBeTruthy();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });
  describe('return route gaps', () => {
    it('flags a terminus the opposite direction never calls at', async () => {
      prismaMock.line.findMany.mockResolvedValue([
        {
          ...pairedLines[0],
          // Outbound ends at station-b; the return below never calls there.
          arrivalStationId: 'station-b'
        },
        {
          ...pairedLines[1],
          departureStationId: 'station-terminus',
          arrivalStationId: 'station-a',
          intermediateStops: [{ stationId: 'station-c', orderIndex: 1 }]
        }
      ]);

      const report = await service.getReturnRouteGapReport(auth);

      expect(report.scannedPairCount).toBe(1);
      expect(report.gapCount).toBe(2);
      expect(report.items.map((item) => item.unreachableStationNames)).toEqual([
        ['North'],
        ['Terminus']
      ]);
    });

    it('flags nothing when each terminus appears on the opposite route', async () => {
      prismaMock.line.findMany.mockResolvedValue([
        pairedLines[0],
        {
          ...pairedLines[1],
          departureStationId: 'station-b',
          arrivalStationId: 'station-a',
          intermediateStops: [
            { stationId: 'station-d', orderIndex: 1 },
            { stationId: 'station-c', orderIndex: 2 }
          ]
        }
      ]);

      const report = await service.getReturnRouteGapReport(auth);

      expect(report.gapCount).toBe(0);
      expect(report.items).toEqual([]);
    });
  });

  describe('orphaned reservations', () => {
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

    beforeEach(() => {
      prismaMock.ride.findMany.mockResolvedValue([strandedRide]);
    });

    it('points stranded reservations at the instance that replaced their departure time', async () => {
      prismaMock.reservation.findMany.mockResolvedValue([reservation('res-1', 12, '07:45')]);

      const report = await service.getOrphanedReservationReport(auth);

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

      const report = await service.getOrphanedReservationReport(auth);

      expect(report.scannedReservationCount).toBe(1);
      expect(report.orphanedCount).toBe(0);
    });

    it('moves a stranded reservation off a seat a visible passenger now holds', async () => {
      prismaMock.reservation.findMany.mockResolvedValue([
        // Sold after the route changed, so it is visible and owns seat 12.
        reservation('res-visible', 12, '07:30'),
        reservation('res-stranded', 12, '07:45')
      ]);

      const report = await service.getOrphanedReservationReport(auth);

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

      const report = await service.getOrphanedReservationReport(auth);

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

      const report = await service.getOrphanedReservationReport(auth);

      expect(report.items[0]).toEqual(
        expect.objectContaining({
          reason: 'AMBIGUOUS_INSTANCE',
          targetDepartureTime: null,
          canRepair: false
        })
      );
      expect(report.repairableCount).toBe(0);
    });

    it('reports a date the ride no longer runs on without offering a repair', async () => {
      prismaMock.ride.findMany.mockResolvedValue([
        {
          ...strandedRide,
          exceptions: [
            {
              exceptionDate: travelDate,
              type: 'SKIP',
              departureTime: null,
              arrivalTime: null
            }
          ]
        }
      ]);
      prismaMock.reservation.findMany.mockResolvedValue([reservation('res-1', 12, '07:45')]);

      const report = await service.getOrphanedReservationReport(auth);

      expect(report.items[0]).toEqual(
        expect.objectContaining({ reason: 'NO_INSTANCE', canRepair: false })
      );
    });

    it('writes the new departure time and seat, and skips what it cannot place', async () => {
      prismaMock.reservation.findMany.mockResolvedValue([
        reservation('res-visible', 12, '07:30'),
        reservation('res-stranded', 12, '07:45')
      ]);

      const result = await service.repairOrphanedReservations(auth);

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

    it('touches nothing when no single instance can claim the orphans', async () => {
      prismaMock.ride.findMany.mockResolvedValue([
        { ...strandedRide, status: 'INACTIVE', daySchedules: [] }
      ]);
      prismaMock.reservation.findMany.mockResolvedValue([reservation('res-1', 12, '07:45')]);

      const result = await service.repairOrphanedReservations(auth);

      expect(result.repairedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.items[0].reason).toBe('RIDE_NOT_ACTIVE');
      expect(prismaMock.reservation.update).not.toHaveBeenCalled();
    });
  });
});
