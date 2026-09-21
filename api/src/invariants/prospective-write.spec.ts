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

/**
 * An invariant that reports a different set on each pass and can repair.
 *
 * The repair path scans three times — before, after, and again once the repair
 * has run — so what it does is only visible against a check that can say
 * something different the third time.
 */
function invariantRepairing(
  key: string,
  passes: Violation[][],
  repair: () => Promise<void> = async () => {}
): ProspectiveInvariant & { contexts: InvariantContext[]; repairCalls: number } {
  const contexts: InvariantContext[] = [];
  let call = 0;

  const invariant = {
    key,
    title: 'title',
    description: 'description',
    manualAdvice: 'advice',
    severity: 'critical' as const,
    breakingChangeMessage: (count: number) => `${key} breaks ${count}`,
    repairMessage: (count: number) => `${key} repairs ${count}`,
    contexts,
    repairCalls: 0,
    async check(ctx: InvariantContext) {
      contexts.push(ctx);
      const violations = passes[Math.min(call, passes.length - 1)];
      call += 1;

      return { violations, scannedCount: violations.length };
    },
    async repair() {
      invariant.repairCalls += 1;
      await repair();

      return { repairedCount: 0, skippedCount: 0 };
    }
  };

  return invariant;
}

function repairable(subjectId: string): Violation {
  return { ...violation(subjectId), canRepair: true };
}

const scope = { tenantId: 'tenant-1', actorId: 'actor-1' };

/** The three answers a caller can arrive with. */
const UNANSWERED = { confirmed: false, repair: false };
const CONFIRMED = { confirmed: true, repair: false };
const REPAIR = { confirmed: false, repair: true };

describe('guardProspectiveWrite', () => {
  it('rejects only violations introduced by the proposed state', async () => {
    const { prisma } = prismaDouble();
    const reachable = invariantReporting(
      'reservation.reachable',
      [violation('old')],
      [violation('old'), violation('new-1'), violation('new-2')]
    );

    await expect(
      guardProspectiveWrite(prisma as never, scope, [reachable], UNANSWERED, jest.fn())
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
      guardProspectiveWrite(prisma as never, scope, [reachable], UNANSWERED, write)
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
      guardProspectiveWrite(prisma as never, scope, [overbooked], UNANSWERED, jest.fn())
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
      guardProspectiveWrite(prisma as never, scope, [overbooked], UNANSWERED, jest.fn())
    ).resolves.toBeUndefined();
  });

  it('rolls back the write it applied to measure the damage', async () => {
    const { prisma, transactions } = prismaDouble();
    const reachable = invariantReporting('reservation.reachable', [], [violation('new')]);
    const write = jest.fn().mockResolvedValue('written');

    await expect(
      guardProspectiveWrite(prisma as never, scope, [reachable], UNANSWERED, write)
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
      guardProspectiveWrite(prisma as never, scope, [clean, broken], UNANSWERED, jest.fn())
    ).rejects.toMatchObject({ response: { invariant: 'reservation.reachable' } });
  });

  it('looks far past the window the reports use', async () => {
    const { prisma } = prismaDouble();
    const reachable = invariantReporting('reservation.reachable', [], []);

    await guardProspectiveWrite(prisma as never, scope, [reachable], UNANSWERED, jest.fn());

    expect(reachable.contexts[0].windowDays).toBeGreaterThan(365);
  });

  it('shares one context per pass, so the checks share one load', async () => {
    const { prisma } = prismaDouble();
    const first = invariantReporting('reservation.reachable', [], []);
    const second = invariantReporting('reservation.stationsOnRoute', [], []);

    await guardProspectiveWrite(prisma as never, scope, [first, second], UNANSWERED, jest.fn());

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
      guardProspectiveWrite(prisma as never, scope, [reachable], CONFIRMED, write)
    ).resolves.toBe('written');

    expect(check).not.toHaveBeenCalled();
    expect(transactions).toHaveLength(1);
  });

  it('keeps the isolation even when there is nothing to check', async () => {
    const { prisma, transactions } = prismaDouble();
    const write = jest.fn().mockResolvedValue('written');

    await expect(guardProspectiveWrite(prisma as never, scope, [], UNANSWERED, write)).resolves.toBe(
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

    await guardProspectiveWrite(prisma as never, scope, [reachable], UNANSWERED, jest.fn());

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
      guardProspectiveWrite(prisma as never, scope, [reachable], UNANSWERED, write)
    ).resolves.toBe('written');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('does not retry an ordinary failure', async () => {
    const { prisma } = prismaDouble();
    const reachable = invariantReporting('reservation.reachable', [], []);
    const write = jest.fn().mockRejectedValue(new Error('constraint violated'));

    await expect(
      guardProspectiveWrite(prisma as never, scope, [reachable], UNANSWERED, write)
    ).rejects.toThrow('constraint violated');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  describe('repairing instead of overriding', () => {
    it('repairs what the write broke and commits', async () => {
      const { prisma, transactions } = prismaDouble();
      // Broken by the write, then settled by the repair.
      const reachable = invariantRepairing('reservation.reachable', [
        [],
        [repairable('res-1'), repairable('res-2')],
        []
      ]);
      const write = jest.fn().mockResolvedValue('written');

      await expect(
        guardProspectiveWrite(prisma as never, scope, [reachable], REPAIR, write)
      ).resolves.toBe('written');

      expect(reachable.repairCalls).toBe(1);
      expect(transactions[0].outcome).toBe('committed');
    });

    it('repairs in the same transaction as the write it is repairing', async () => {
      const { prisma, transactions } = prismaDouble();
      const reachable = invariantRepairing('reservation.reachable', [
        [],
        [repairable('res-1')],
        []
      ]);

      await guardProspectiveWrite(prisma as never, scope, [reachable], REPAIR, jest.fn());

      // One transaction for all of it: a repair that landed while the write it
      // was repairing rolled back would leave passengers moved for nothing.
      expect(transactions).toHaveLength(1);
      expect(reachable.contexts[2].prisma).toEqual({ marker: 'transaction' });
    });

    it('re-checks on a fresh context, not the one the scan already cached', async () => {
      const { prisma } = prismaDouble();
      const reachable = invariantRepairing('reservation.reachable', [
        [],
        [repairable('res-1')],
        []
      ]);

      await guardProspectiveWrite(prisma as never, scope, [reachable], REPAIR, jest.fn());

      expect(reachable.contexts).toHaveLength(3);
      expect(reachable.contexts[2]).not.toBe(reachable.contexts[1]);
    });

    it('refuses when the repair did not settle everything, rather than committing', async () => {
      const { prisma, transactions } = prismaDouble();
      // The repair declines one: seats it cannot find, a departure it cannot
      // choose between.
      const reachable = invariantRepairing('reservation.reachable', [
        [],
        [repairable('res-1'), repairable('res-2')],
        [violation('res-2')]
      ]);

      await expect(
        guardProspectiveWrite(prisma as never, scope, [reachable], REPAIR, jest.fn())
      ).rejects.toMatchObject({
        response: {
          code: 'WOULD_BREAK_RESERVATIONS',
          affectedCount: 1,
          // Nothing left that a second press would fix, so it is not offered
          // again — the remaining one is now a telephone call.
          repairable: false
        }
      });

      expect(transactions[0].outcome).toBe('rolled-back');
    });

    it('refuses an invariant with no repair exactly as it would have', async () => {
      const { prisma } = prismaDouble();
      const overbooked = invariantReporting(
        'instance.notOverbooked',
        [],
        [violation('instance-1')]
      );

      // Asking to repair what cannot be repaired is not a way to get the write
      // through: it is refused, and the refusal says there is nothing to run.
      await expect(
        guardProspectiveWrite(prisma as never, scope, [overbooked], REPAIR, jest.fn())
      ).rejects.toMatchObject({
        response: { invariant: 'instance.notOverbooked', repairable: false }
      });
    });

    it('does not offer a repair that would only settle some of them', async () => {
      const { prisma } = prismaDouble();
      const reachable = invariantRepairing('reservation.reachable', [
        [],
        [repairable('res-1'), violation('res-2')]
      ]);

      await expect(
        guardProspectiveWrite(prisma as never, scope, [reachable], UNANSWERED, jest.fn())
      ).rejects.toMatchObject({ response: { affectedCount: 2, repairable: false } });

      expect(reachable.repairCalls).toBe(0);
    });

    it('offers the repair, and what it would do, when every one can be settled', async () => {
      const { prisma } = prismaDouble();
      const reachable = invariantRepairing('reservation.reachable', [
        [],
        [repairable('res-1'), repairable('res-2')]
      ]);

      await expect(
        guardProspectiveWrite(prisma as never, scope, [reachable], UNANSWERED, jest.fn())
      ).rejects.toMatchObject({
        response: {
          affectedCount: 2,
          repairable: true,
          repairMessage: 'reservation.reachable repairs 2'
        }
      });

      // Offered, not run: the question has not been answered yet.
      expect(reachable.repairCalls).toBe(0);
    });

    it('still measures when the caller confirmed, because a repair needs the measurement', async () => {
      const { prisma } = prismaDouble();
      const reachable = invariantRepairing('reservation.reachable', [
        [],
        [repairable('res-1')],
        []
      ]);

      await guardProspectiveWrite(
        prisma as never,
        scope,
        [reachable],
        { confirmed: true, repair: true },
        jest.fn()
      );

      expect(reachable.repairCalls).toBe(1);
    });
  });
});
