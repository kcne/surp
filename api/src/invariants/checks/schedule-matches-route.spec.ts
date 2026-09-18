import { findDriftedSchedules, realignDriftedSchedules } from './schedule-matches-route';
import { InvariantContext } from '../invariant.types';

/**
 * Moved here from the maintenance service spec when #24 replaced the four
 * settings cards with one page: the endpoint that used to wrap these helpers is
 * gone, the drift logic they cover is not.
 */

const prismaMock = {
  $transaction: jest.fn(),
  line: { findMany: jest.fn() },
  station: { findMany: jest.fn() }
};

const ctx = {
  tenantId: 'tenant-1',
  actorId: 'admin-1',
  prisma: prismaMock,
  windowDays: 30
} as unknown as InvariantContext;

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

const alignedLine = {
  ...lineWithDriftedRide,
  intermediateStops: [{ stationId: 'station-c', orderIndex: 1 }]
};

describe('schedule.matchesRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.station.findMany.mockResolvedValue(stations);
  });

  it('reports a schedule that is missing a station added to its route', async () => {
    prismaMock.line.findMany.mockResolvedValue([lineWithDriftedRide]);

    const { drifted, scannedScheduleCount } = await findDriftedSchedules(ctx);

    expect(scannedScheduleCount).toBe(1);
    expect(drifted).toHaveLength(1);
    expect(drifted[0].item).toEqual(
      expect.objectContaining({
        rideId: 'ride-1',
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
    prismaMock.line.findMany.mockResolvedValue([alignedLine]);

    const { drifted } = await findDriftedSchedules(ctx);

    expect(drifted).toEqual([]);
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

    const result = await realignDriftedSchedules(ctx);

    expect(result.drifted).toHaveLength(1);
    expect(new Set(result.drifted.map((entry) => entry.item.rideId)).size).toBe(1);
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
    expect(data.every((entry: { updatedById: string }) => entry.updatedById === 'admin-1')).toBe(
      true
    );
  });

  it('does not write anything when there is no drift', async () => {
    prismaMock.line.findMany.mockResolvedValue([alignedLine]);

    const result = await realignDriftedSchedules(ctx);

    expect(result.drifted).toEqual([]);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
