import { guardProspectiveWrite } from './prospective-write';
import { findInvariant } from './registry';

jest.mock('./registry', () => ({ findInvariant: jest.fn() }));

const mockedFindInvariant = jest.mocked(findInvariant);

function setup(beforeIds: string[], afterIds: string[]) {
  const check = jest
    .fn()
    .mockResolvedValueOnce({ scannedCount: beforeIds.length, violations: beforeIds.map(violation) })
    .mockResolvedValueOnce({ scannedCount: afterIds.length, violations: afterIds.map(violation) });
  mockedFindInvariant.mockReturnValue({
    key: 'reservation.reachable',
    title: 'title',
    description: 'description',
    manualAdvice: 'advice',
    severity: 'critical',
    check
  });

  const tx = { marker: 'transaction' };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
  };
  const write = jest.fn().mockResolvedValue('written');

  return { check, prisma, tx, write };
}

function violation(subjectId: string) {
  return {
    subjectType: 'reservation' as const,
    subjectId,
    summary: 'summary',
    detail: {},
    canRepair: false
  };
}

describe('guardProspectiveWrite', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects only violations introduced by the proposed state', async () => {
    const { prisma, write } = setup(['old'], ['old', 'new-1', 'new-2']);

    await expect(
      guardProspectiveWrite(
        prisma as never,
        { tenantId: 'tenant-1', actorId: 'actor-1' },
        ['reservation.reachable'],
        false,
        write
      )
    ).rejects.toMatchObject({
      response: {
        code: 'WOULD_BREAK_RESERVATIONS',
        invariant: 'reservation.reachable',
        affectedCount: 2,
        message: 'Ova izmena cini 2 rezervacija nevidljivim.'
      }
    });
  });

  it('does not block an edit because of a pre-existing violation', async () => {
    const { prisma, tx, write } = setup(['old'], ['old']);

    await expect(
      guardProspectiveWrite(
        prisma as never,
        { tenantId: 'tenant-1', actorId: 'actor-1' },
        ['reservation.reachable'],
        false,
        write
      )
    ).resolves.toBe('written');
    expect(write).toHaveBeenCalledWith(tx);
  });

  it('skips invariant reads after explicit confirmation', async () => {
    const { check, prisma, write } = setup([], ['new']);

    await expect(
      guardProspectiveWrite(
        prisma as never,
        { tenantId: 'tenant-1', actorId: 'actor-1' },
        ['reservation.reachable'],
        true,
        write
      )
    ).resolves.toBe('written');
    expect(check).not.toHaveBeenCalled();
  });
});
