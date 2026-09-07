import { UserRole } from '@prisma/client';
import { MaintenanceService } from './maintenance.service';

describe('MaintenanceService', () => {
  const prismaMock = {
    $transaction: jest.fn(),
    line: { findMany: jest.fn() },
    station: { findMany: jest.fn() }
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
});
