import { DepartureNightlyService } from './departure-nightly.service';
import { syncDepartures } from './departure-sync';
import { SYSTEM_ACTOR_ID } from './system-actor';

jest.mock('./departure-sync', () => ({ syncDepartures: jest.fn() }));

const syncMock = syncDepartures as jest.MockedFunction<typeof syncDepartures>;

describe('DepartureNightlyService', () => {
  const tx = { $executeRaw: jest.fn() };
  const prismaMock = {
    tenant: { findMany: jest.fn() },
    $transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) => work(tx))
  };

  function service(enabled: boolean) {
    const config = { get: jest.fn(() => enabled) };
    return new DepartureNightlyService(prismaMock as never, config as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.tenant.findMany.mockResolvedValue([{ id: 'tenant-a' }, { id: 'tenant-b' }]);
  });

  it('does nothing until it is enabled', async () => {
    await service(false).runScheduled();

    expect(prismaMock.tenant.findMany).not.toHaveBeenCalled();
    expect(syncMock).not.toHaveBeenCalled();
  });

  it('inserts only, as the system actor, under each tenant schedule lock', async () => {
    syncMock.mockResolvedValue({ created: 1, updated: 0, dropped: 0, deleted: 0 });

    await service(true).runScheduled();

    expect(syncMock).toHaveBeenCalledTimes(2);
    expect(syncMock).toHaveBeenCalledWith(
      tx,
      { tenantId: 'tenant-a', actorId: SYSTEM_ACTOR_ID },
      'insertOnly',
      expect.any(Date)
    );
    // The exclusive lock, then no second (full) sync from the transaction helper.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('keeps going when one tenant fails', async () => {
    syncMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ created: 3, updated: 0, dropped: 0, deleted: 0 });

    const outcomes = await service(true).run();

    expect(outcomes).toEqual([
      { tenantId: 'tenant-a', error: 'boom' },
      { tenantId: 'tenant-b', counts: { created: 3, updated: 0, dropped: 0, deleted: 0 } }
    ]);
  });
});
