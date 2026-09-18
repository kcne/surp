import { Prisma } from '@prisma/client';
import { guardProspectiveWrite } from './prospective-write';
import { InvariantContext, ProspectiveInvariant, Violation } from './invariant.types';

function violation(subjectId: string, magnitude?: number): Violation {
  return {
    subjectType: 'reservation',
    subjectId,
    magnitude,
    summary: 'summary',
    detail: {},
    canRepair: false
  };
}

/**
 * An invariant that reports one set of violations before the write and another
 * after it, which is the only thing the guard asks of a check.
 */
function invariantReporting(
  key: string,
  before: Violation[],
  after: Violation[]
): ProspectiveInvariant & { contexts: InvariantContext[] } {
  const contexts: InvariantContext[] = [];
  let call = 0;

  return {
    key,
    title: 'title',
    description: 'description',
    manualAdvice: 'advice',
    severity: 'critical',
    breakingChangeMessage: (count) => `${key} breaks ${count}`,
    contexts,
    async check(ctx) {
      contexts.push(ctx);
      const violations = call === 0 ? before : after;
      call += 1;

      return { violations, scannedCount: violations.length };
    }
  };
}

/**
 * Stands in for Prisma's interactive transaction, and records whether each one
 * reached its end or was abandoned — the guard applies the write before it
 * knows whether to keep it, so "the throw rolled it back" is the behaviour
 * that matters most here.
 */
function prismaDouble() {
  type TransactionOptions = { isolationLevel?: Prisma.TransactionIsolationLevel };
  const transactions: Array<{ options?: TransactionOptions; outcome: string }> = [];
  const prisma = {
    $transaction: jest.fn(
      async (
        callback: (tx: unknown) => Promise<unknown>,
        options?: TransactionOptions
      ) => {
        const record = { options, outcome: 'open' };
        transactions.push(record);

        try {
          const result = await callback({ marker: 'transaction' });
          record.outcome = 'committed';

          return result;
        } catch (error) {
          record.outcome = 'rolled-back';
          throw error;
        }
      }
    )
  };

  return { prisma, transactions };
}

const scope = { tenantId: 'tenant-1', actorId: 'actor-1' };

describe('guardProspectiveWrite', () => {
  it('rejects only violations introduced by the proposed state', async () => {
    const { prisma } = prismaDouble();
    const reachable = invariantReporting(
      'reservation.reachable',
      [violation('old')],
      [violation('old'), violation('new-1'), violation('new-2')]
    );

    await expect(
      guardProspectiveWrite(prisma as never, scope, [reachable], false, jest.fn())
    ).rejects.toMatchObject({
      response: {
        code: 'WOULD_BREAK_RESERVATIONS',
        invariant: 'reservation.reachable',
        affectedCount: 2,
        message: 'reservation.reachable breaks 2'
      }
    });
  });

  it('does not block an edit because of a pre-existing violation', async () => {
    const { prisma } = prismaDouble();
    const reachable = invariantReporting(
      'reservation.reachable',
      [violation('old')],
      [violation('old')]
    );
    const write = jest.fn().mockResolvedValue('written');

    await expect(
      guardProspectiveWrite(prisma as never, scope, [reachable], false, write)
    ).resolves.toBe('written');
    expect(write).toHaveBeenCalledWith({ marker: 'transaction' });
  });

  it('rejects a change that deepens a violation it did not create', async () => {
    const { prisma } = prismaDouble();
    const overbooked = invariantReporting(
      'instance.notOverbooked',
      [violation('instance-1', 1)],
      [violation('instance-1', 9)]
    );

    await expect(
      guardProspectiveWrite(prisma as never, scope, [overbooked], false, jest.fn())
    ).rejects.toMatchObject({
      response: { invariant: 'instance.notOverbooked', affectedCount: 1 }
    });
  });

  it('lets through a change that eases a violation it did not create', async () => {
    const { prisma } = prismaDouble();
    const overbooked = invariantReporting(
      'instance.notOverbooked',
      [violation('instance-1', 9)],
      [violation('instance-1', 2)]
    );

    await expect(
      guardProspectiveWrite(prisma as never, scope, [overbooked], false, jest.fn())
    ).resolves.toBeUndefined();
  });

  it('rolls back the write it applied to measure the damage', async () => {
    const { prisma, transactions } = prismaDouble();
    const reachable = invariantReporting('reservation.reachable', [], [violation('new')]);
    const write = jest.fn().mockResolvedValue('written');

    await expect(
      guardProspectiveWrite(prisma as never, scope, [reachable], false, write)
    ).rejects.toBeDefined();

    expect(write).toHaveBeenCalledTimes(1);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].outcome).toBe('rolled-back');
  });

  it('names the first invariant the change breaks', async () => {
    const { prisma } = prismaDouble();
    const clean = invariantReporting('reservation.stationsOnRoute', [], []);
    const broken = invariantReporting('reservation.reachable', [], [violation('new')]);

    await expect(
      guardProspectiveWrite(prisma as never, scope, [clean, broken], false, jest.fn())
    ).rejects.toMatchObject({ response: { invariant: 'reservation.reachable' } });
  });

  it('looks far past the window the reports use', async () => {
    const { prisma } = prismaDouble();
    const reachable = invariantReporting('reservation.reachable', [], []);

    await guardProspectiveWrite(prisma as never, scope, [reachable], false, jest.fn());

    expect(reachable.contexts[0].windowDays).toBeGreaterThan(365);
  });

  it('shares one context per pass, so the checks share one load', async () => {
    const { prisma } = prismaDouble();
    const first = invariantReporting('reservation.reachable', [], []);
    const second = invariantReporting('reservation.stationsOnRoute', [], []);

    await guardProspectiveWrite(prisma as never, scope, [first, second], false, jest.fn());

    expect(first.contexts[0]).toBe(second.contexts[0]);
    expect(first.contexts[1]).toBe(second.contexts[1]);
    expect(first.contexts[0]).not.toBe(first.contexts[1]);
  });

  it('skips the invariant reads after explicit confirmation', async () => {
    const { prisma, transactions } = prismaDouble();
    const reachable = invariantReporting('reservation.reachable', [], [violation('new')]);
    const check = jest.spyOn(reachable, 'check');
    const write = jest.fn().mockResolvedValue('written');

    await expect(
      guardProspectiveWrite(prisma as never, scope, [reachable], true, write)
    ).resolves.toBe('written');

    expect(check).not.toHaveBeenCalled();
    expect(transactions).toHaveLength(1);
  });

  it('keeps the isolation even when there is nothing to check', async () => {
    const { prisma, transactions } = prismaDouble();
    const write = jest.fn().mockResolvedValue('written');

    await expect(guardProspectiveWrite(prisma as never, scope, [], false, write)).resolves.toBe(
      'written'
    );

    // The callbacks do their own read-then-write — the exception that must not
    // already exist — so the isolation is not the checks' to skip.
    expect(transactions[0].options?.isolationLevel).toBe(
      Prisma.TransactionIsolationLevel.Serializable
    );
  });

  it('runs the compared write serializably', async () => {
    const { prisma, transactions } = prismaDouble();
    const reachable = invariantReporting('reservation.reachable', [], []);

    await guardProspectiveWrite(prisma as never, scope, [reachable], false, jest.fn());

    expect(transactions[0].options?.isolationLevel).toBe(
      Prisma.TransactionIsolationLevel.Serializable
    );
  });

  it('retries once when Postgres aborts the transaction to keep it serializable', async () => {
    const { prisma } = prismaDouble();
    const reachable = invariantReporting('reservation.reachable', [], []);
    const write = jest.fn().mockResolvedValue('written');

    prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: 'test'
      })
    );

    await expect(
      guardProspectiveWrite(prisma as never, scope, [reachable], false, write)
    ).resolves.toBe('written');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('does not retry an ordinary failure', async () => {
    const { prisma } = prismaDouble();
    const reachable = invariantReporting('reservation.reachable', [], []);
    const write = jest.fn().mockRejectedValue(new Error('constraint violated'));

    await expect(
      guardProspectiveWrite(prisma as never, scope, [reachable], false, write)
    ).rejects.toThrow('constraint violated');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
