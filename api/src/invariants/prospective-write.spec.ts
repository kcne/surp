import { Prisma } from '@prisma/client';
import { confirmationTokenFor, guardProspectiveWrite, ProspectiveWriteConsent } from './prospective-write';
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
  after: Violation[],
  afterRepair = after
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
      const violations = call === 0 ? before : call === 1 ? after : afterRepair;
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
  const statements: string[] = [];
  const tx = {
    marker: 'transaction',
    $executeRaw: jest.fn(async (sql: TemplateStringsArray) => {
      statements.push(sql.join('?'));
      return 1;
    })
  };
  const prisma = {
    $transaction: jest.fn(
      async (
        callback: (tx: unknown) => Promise<unknown>,
        options?: TransactionOptions
      ) => {
        const record = { options, outcome: 'open' };
        transactions.push(record);

        try {
          const result = await callback(tx);
          record.outcome = 'committed';

          return result;
        } catch (error) {
          record.outcome = 'rolled-back';
          throw error;
        }
      }
    )
  };

  return { prisma, transactions, tx, statements };
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
): ProspectiveInvariant & {
  contexts: InvariantContext[];
  repairCalls: number;
  repairSubjects: string[][];
} {
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
    repairSubjects: [] as string[][],
    async check(ctx: InvariantContext) {
      contexts.push(ctx);
      const violations = passes[Math.min(call, passes.length - 1)];
      call += 1;

      return { violations, scannedCount: violations.length };
    },
    async repair(_ctx: InvariantContext, subjectIds?: ReadonlySet<string>) {
      invariant.repairCalls += 1;
      invariant.repairSubjects.push([...(subjectIds ?? [])]);
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

const UNANSWERED: ProspectiveWriteConsent = { confirmationTokens: [], repairTokens: [] };

/** The answer an operator gives after being shown exactly these violations. */
function confirming(key: string, added: Violation[]): ProspectiveWriteConsent {
  return { confirmationTokens: [confirmationTokenFor({ key }, added)], repairTokens: [] };
}

function repairing(key: string, added: Violation[]): ProspectiveWriteConsent {
  return { confirmationTokens: [], repairTokens: [confirmationTokenFor({ key }, added)] };
}

function both(...answers: ProspectiveWriteConsent[]): ProspectiveWriteConsent {
  return {
    confirmationTokens: answers.flatMap((answer) => answer.confirmationTokens),
    repairTokens: answers.flatMap((answer) => answer.repairTokens)
  };
}

const REACHABLE = 'reservation.reachable';

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
    const { prisma, tx } = prismaDouble();
    const reachable = invariantReporting(
      'reservation.reachable',
      [violation('old')],
      [violation('old')]
    );
    const write = jest.fn().mockResolvedValue('written');

    await expect(
      guardProspectiveWrite(prisma as never, scope, [reachable], UNANSWERED, write)
    ).resolves.toBe('written');
    expect(write).toHaveBeenCalledWith(tx, undefined);
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

  describe('answering with a confirmation token', () => {
    it('hands out a token that names exactly the violations it refused', async () => {
      const { prisma } = prismaDouble();
      const added = [violation('new-1'), violation('new-2', 3)];
      const reachable = invariantReporting(REACHABLE, [violation('old')], [violation('old'), ...added]);

      await expect(
        guardProspectiveWrite(prisma as never, scope, [reachable], UNANSWERED, jest.fn())
      ).rejects.toMatchObject({
        response: { confirmationToken: confirmationTokenFor({ key: REACHABLE }, added) }
      });
    });

    it('commits when the token matches what the operator was shown', async () => {
      const { prisma, transactions } = prismaDouble();
      const reachable = invariantReporting(REACHABLE, [], [violation('new')]);
      const write = jest.fn().mockResolvedValue('written');

      await expect(
        guardProspectiveWrite(
          prisma as never,
          scope,
          [reachable],
          confirming(REACHABLE, [violation('new')]),
          write
        )
      ).resolves.toBe('written');
      expect(transactions[0].outcome).toBe('committed');
    });

    it('still measures after a confirmation, since only a measurement can match the token', async () => {
      const { prisma } = prismaDouble();
      const reachable = invariantReporting(REACHABLE, [], [violation('new')]);
      const check = jest.spyOn(reachable, 'check');

      await guardProspectiveWrite(
        prisma as never,
        scope,
        [reachable],
        confirming(REACHABLE, [violation('new')]),
        jest.fn()
      );

      expect(check).toHaveBeenCalledTimes(2);
    });

    it('refuses again, with a fresh token, when a booking changed the set in between', async () => {
      const { prisma, transactions } = prismaDouble();
      // Shown one broken reservation; by the time the answer arrives, a booking
      // has made it two.
      const shown = [violation('res-1')];
      const now = [violation('res-1'), violation('res-2')];
      const reachable = invariantReporting(REACHABLE, [], now);

      await expect(
        guardProspectiveWrite(
          prisma as never,
          scope,
          [reachable],
          confirming(REACHABLE, shown),
          jest.fn()
        )
      ).rejects.toMatchObject({
        response: {
          code: 'WOULD_BREAK_RESERVATIONS',
          affectedCount: 2,
          confirmationToken: confirmationTokenFor({ key: REACHABLE }, now)
        }
      });
      expect(transactions[0].outcome).toBe('rolled-back');
    });

    it('refuses again when the same subjects got worse', async () => {
      const { prisma } = prismaDouble();
      const overbooked = invariantReporting('instance.notOverbooked', [], [violation('bus-1', 4)]);

      await expect(
        guardProspectiveWrite(
          prisma as never,
          scope,
          [overbooked],
          confirming('instance.notOverbooked', [violation('bus-1', 2)]),
          jest.fn()
        )
      ).rejects.toMatchObject({ response: { invariant: 'instance.notOverbooked' } });
    });

    it('does not let a token for one invariant answer another', async () => {
      const { prisma } = prismaDouble();
      const overbooked = invariantReporting('instance.notOverbooked', [], [violation('res-1')]);

      await expect(
        guardProspectiveWrite(
          prisma as never,
          scope,
          [overbooked],
          confirming(REACHABLE, [violation('res-1')]),
          jest.fn()
        )
      ).rejects.toMatchObject({ response: { invariant: 'instance.notOverbooked' } });
    });

    it('does not depend on the order the violations were reported in', () => {
      expect(confirmationTokenFor({ key: REACHABLE }, [violation('b'), violation('a')])).toBe(
        confirmationTokenFor({ key: REACHABLE }, [violation('a'), violation('b')])
      );
    });
  });

  describe('the schedule lock', () => {
    it('runs at READ COMMITTED, where a lock taken first is seen by every read after it', async () => {
      const { prisma, transactions } = prismaDouble();
      const reachable = invariantReporting(REACHABLE, [], []);

      await guardProspectiveWrite(prisma as never, scope, [reachable], UNANSWERED, jest.fn());

      expect(transactions[0].options?.isolationLevel).toBe(
        Prisma.TransactionIsolationLevel.ReadCommitted
      );
    });

    it('takes the tenant lock exclusively before preparing, scanning or writing', async () => {
      const { prisma, statements } = prismaDouble();
      const order: string[] = [];
      const reachable = invariantReporting(REACHABLE, [], []);
      jest.spyOn(reachable, 'check').mockImplementation(async () => {
        order.push(`check after ${statements.length} statements`);
        return { violations: [], scannedCount: 0 };
      });

      await guardProspectiveWrite(
        prisma as never,
        scope,
        [reachable],
        UNANSWERED,
        async () => {
          order.push('write');
        },
        async () => {
          order.push(`prepare after ${statements.length} statements`);
        }
      );

      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain('pg_advisory_xact_lock(');
      expect(statements[0]).not.toContain('_shared');
      expect(order[0]).toBe('prepare after 1 statements');
    });

    it('keeps the lock even when there is nothing to check', async () => {
      const { prisma, statements } = prismaDouble();
      const write = jest.fn().mockResolvedValue('written');

      await expect(guardProspectiveWrite(prisma as never, scope, [], UNANSWERED, write)).resolves.toBe(
        'written'
      );

      // The callbacks do their own read-then-write — the exception that must not
      // already exist — so the lock is not the checks' to skip.
      expect(statements[0]).toContain('pg_advisory_xact_lock(');
    });

    it('does not retry a failure behind the operator\'s back', async () => {
      const { prisma } = prismaDouble();
      const reachable = invariantReporting(REACHABLE, [], []);
      const write = jest.fn().mockRejectedValue(new Error('constraint violated'));

      await expect(
        guardProspectiveWrite(prisma as never, scope, [reachable], UNANSWERED, write)
      ).rejects.toThrow('constraint violated');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
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
        guardProspectiveWrite(
          prisma as never,
          scope,
          [reachable],
          repairing(REACHABLE, [repairable('res-1'), repairable('res-2')]),
          write
        )
      ).resolves.toBe('written');

      expect(reachable.repairCalls).toBe(1);
      expect(transactions[0].outcome).toBe('committed');
      expect(reachable.repairSubjects).toEqual([['res-1', 'res-2']]);
    });

    it('does not pass pre-existing violations to the repair', async () => {
      const { prisma } = prismaDouble();
      const reachable = invariantRepairing('reservation.reachable', [
        [repairable('old')],
        [repairable('old'), repairable('new')],
        [repairable('old')]
      ]);

      await guardProspectiveWrite(
        prisma as never,
        scope,
        [reachable],
        repairing(REACHABLE, [repairable('new')]),
        jest.fn()
      );

      expect(reachable.repairSubjects).toEqual([['new']]);
    });

    it('uses a scoped seat assessment when old orphans make the full report pessimistic', async () => {
      const { prisma } = prismaDouble();
      const reachable = invariantRepairing('reservation.reachable', [
        [violation('old')],
        [violation('old'), violation('new')],
        [violation('old')]
      ]);
      reachable.assessRepair = jest.fn(async (_ctx, subjectIds) => ({
        scannedCount: 2,
        violations: [repairable([...subjectIds][0])]
      }));

      await guardProspectiveWrite(
        prisma as never,
        scope,
        [reachable],
        repairing(REACHABLE, [violation('new')]),
        jest.fn()
      );

      expect(reachable.assessRepair).toHaveBeenCalledWith(
        expect.anything(),
        new Set(['new'])
      );
      expect(reachable.repairSubjects).toEqual([['new']]);
    });

    it('repairs in the same transaction as the write it is repairing', async () => {
      const { prisma, transactions, tx } = prismaDouble();
      const reachable = invariantRepairing('reservation.reachable', [
        [],
        [repairable('res-1')],
        []
      ]);

      await guardProspectiveWrite(
        prisma as never,
        scope,
        [reachable],
        repairing(REACHABLE, [repairable('res-1')]),
        jest.fn()
      );

      // One transaction for all of it: a repair that landed while the write it
      // was repairing rolled back would leave passengers moved for nothing.
      expect(transactions).toHaveLength(1);
      expect(reachable.contexts[2].prisma).toBe(tx);
    });

    it('re-checks on a fresh context, not the one the scan already cached', async () => {
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
        repairing(REACHABLE, [repairable('res-1')]),
        jest.fn()
      );

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

      const shown = [repairable('res-1'), repairable('res-2')];

      await expect(
        guardProspectiveWrite(prisma as never, scope, [reachable], repairing(REACHABLE, shown), jest.fn())
      ).rejects.toMatchObject({
        response: {
          code: 'WOULD_BREAK_RESERVATIONS',
          // The repair rolled back with everything else, so saving anyway
          // leaves both broken — and that is the count the operator confirms.
          affectedCount: 2,
          confirmationToken: confirmationTokenFor({ key: REACHABLE }, shown),
          // Nothing left that a second press would fix, so it is not offered
          // again — the remaining one is now a telephone call.
          repairable: false
        }
      });

      expect(transactions[0].outcome).toBe('rolled-back');
    });

    it('rolls back a failed repair even when another violation was confirmed', async () => {
      const { prisma, transactions } = prismaDouble();
      const reachable = invariantRepairing('reservation.reachable', [
        [],
        [repairable('res-1')],
        [repairable('res-1')]
      ]);

      const shown = [repairable('res-1')];

      await expect(
        guardProspectiveWrite(
          prisma as never,
          scope,
          [reachable],
          both(repairing(REACHABLE, shown), confirming('instance.notOverbooked', [violation('bus-1')])),
          jest.fn()
        )
      ).rejects.toMatchObject({ response: { repairable: false } });

      expect(transactions[0].outcome).toBe('rolled-back');
    });

    it('repairs one invariant and honors confirmation for another', async () => {
      const { prisma, transactions } = prismaDouble();
      const reachable = invariantRepairing('reservation.reachable', [
        [],
        [repairable('res-1')],
        []
      ]);
      const overbooked = invariantReporting('instance.notOverbooked', [], [violation('bus-1')]);

      await guardProspectiveWrite(
        prisma as never,
        scope,
        [reachable, overbooked],
        both(
          repairing(REACHABLE, [repairable('res-1')]),
          confirming('instance.notOverbooked', [violation('bus-1')])
        ),
        jest.fn()
      );

      expect(reachable.repairCalls).toBe(1);
      expect(transactions[0].outcome).toBe('committed');
    });

    it('checks other invariants again after repair makes reservations reachable', async () => {
      const { prisma, transactions } = prismaDouble();
      const reachable = invariantRepairing('reservation.reachable', [
        [],
        [repairable('res-1')],
        []
      ]);
      const overbooked = invariantReporting(
        'instance.notOverbooked',
        [],
        [],
        [violation('bus-1')]
      );

      await expect(
        guardProspectiveWrite(
          prisma as never,
          scope,
          [reachable, overbooked],
          repairing(REACHABLE, [repairable('res-1')]),
          jest.fn()
        )
      ).rejects.toMatchObject({ response: { invariant: 'instance.notOverbooked' } });

      expect(overbooked.contexts).toHaveLength(3);
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
        guardProspectiveWrite(
          prisma as never,
          scope,
          [overbooked],
          repairing('instance.notOverbooked', [violation('instance-1')]),
          jest.fn()
        )
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

    it('does not let confirmation turn a partial repair request into an override', async () => {
      const { prisma, transactions } = prismaDouble();
      const reachable = invariantRepairing('reservation.reachable', [
        [],
        [repairable('res-1'), violation('res-2')]
      ]);

      await expect(
        guardProspectiveWrite(
          prisma as never,
          scope,
          [reachable],
          both(
            repairing(REACHABLE, [repairable('res-1'), violation('res-2')]),
            confirming('instance.notOverbooked', [])
          ),
          jest.fn()
        )
      ).rejects.toMatchObject({ response: { affectedCount: 2, repairable: false } });

      expect(reachable.repairCalls).toBe(0);
      expect(transactions[0].outcome).toBe('rolled-back');
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

    it('confirms instead of repairing when the operator chose to save anyway', async () => {
      const { prisma, transactions } = prismaDouble();
      const reachable = invariantRepairing('reservation.reachable', [
        [],
        [repairable('res-1')]
      ]);

      await guardProspectiveWrite(
        prisma as never,
        scope,
        [reachable],
        confirming(REACHABLE, [repairable('res-1')]),
        jest.fn()
      );

      expect(reachable.repairCalls).toBe(0);
      expect(transactions[0].outcome).toBe('committed');
    });
  });
});
