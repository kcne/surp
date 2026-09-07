import { UserRole } from '@prisma/client';
import { MaintenanceService } from './maintenance.service';

describe('MaintenanceService', () => {
  const prismaMock = {
    $transaction: jest.fn(),
    line: { findMany: jest.fn() },
    station: { findMany: jest.fn() }
  };

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
    { id: 'station-d', name: 'Mid 2' }
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
});
