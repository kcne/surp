import { findDriftedPairs, syncDriftedPairs } from './paired-directions-agree';
import { InvariantContext } from '../invariant.types';

/**
 * Moved here from the maintenance service spec when #24 replaced the four
 * settings cards with one page.
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
  { id: 'station-d', name: 'Mid 2' },
  { id: 'station-x', name: 'Other' },
  { id: 'station-terminus', name: 'Terminus' }
];

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

describe('pair.directionsAgree', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.station.findMany.mockResolvedValue(stations);
  });

  it('reports a pair where one direction is missing a stop', async () => {
    prismaMock.line.findMany.mockResolvedValue(pairedLines);

    const { drifted, scannedPairCount } = await findDriftedPairs(ctx);

    expect(scannedPairCount).toBe(1);
    expect(drifted).toHaveLength(1);
    expect(drifted[0].item.canAutoSync).toBe(true);
    expect(drifted[0].item.inbound.missingStationNames).toEqual(['Mid 2']);
    expect(drifted[0].item.outbound.missingStationNames).toEqual([]);
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

    const { drifted } = await findDriftedPairs(ctx);

    expect(drifted).toEqual([]);
  });

  it('writes the missing stop into the direction that lacks it, reversed', async () => {
    prismaMock.line.findMany.mockResolvedValue(pairedLines);

    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      lineStop: { deleteMany: jest.fn(), createMany: jest.fn() },
      ride: { findMany: jest.fn().mockResolvedValue([]) },
      rideDayScheduleStationTime: { deleteMany: jest.fn(), createMany: jest.fn() }
    };
    prismaMock.$transaction.mockImplementation(async (callback: (db: typeof tx) => unknown) =>
      callback(tx)
    );

    const result = await syncDriftedPairs(ctx);

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

    const result = await syncDriftedPairs(ctx);

    expect(result.syncedPairCount).toBe(0);
    expect(result.skippedPairCount).toBe(1);
    expect(result.drifted[0].item.canAutoSync).toBe(false);
    expect(result.drifted[0].item.conflictReason).toBeTruthy();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
