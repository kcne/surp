import { Prisma } from '@prisma/client';
import { InvariantRunnerService, newlyViolatedResults } from './invariant-runner.service';
import { InvariantResultDto } from './dto/invariant.response.dto';

function result(key: string, ids: string[]): InvariantResultDto {
  return {
    key,
    title: key,
    description: key,
    severity: 'critical',
    scannedCount: ids.length,
    violationCount: ids.length,
    repairableCount: 0,
    hasRepair: false,
    violations: ids.map((subjectId) => ({
      subjectType: 'reservation',
      subjectId,
      summary: subjectId,
      detail: {},
      canRepair: false
    }))
  };
}

describe('newlyViolatedResults', () => {
  it('alerts on the first violating run', () => {
    expect(newlyViolatedResults([], [result('reservation.reachable', ['one'])])).toHaveLength(1);
  });

  it('does not alert again while the same violations remain', () => {
    expect(
      newlyViolatedResults([result('reservation.reachable', ['one'])], [result('reservation.reachable', ['one'])])
    ).toEqual([]);
  });

  it('alerts only for new subjects and new kinds of violation', () => {
    const changed = newlyViolatedResults(
      [result('reservation.reachable', ['one'])],
      [result('reservation.reachable', ['one', 'two']), result('backup.fresh', ['backup/latest.json'])]
    );
    expect(changed.map((item) => [item.key, item.violations.map((v) => v.subjectId)])).toEqual([
      ['reservation.reachable', ['two']],
      ['backup.fresh', ['backup/latest.json']]
    ]);
  });
});

describe('InvariantRunnerService', () => {
  const tenant = {
    id: 'tenant-1',
    name: 'Prevoznik',
    slug: 'prevoznik',
    users: [{ id: 'admin-1', email: 'admin@example.com' }]
  };

  function setup(previousResults: InvariantResultDto[] | undefined, currentResults: InvariantResultDto[]) {
    const prisma = {
      tenant: { findMany: jest.fn().mockResolvedValue([tenant]) },
      invariantRun: {
        findFirst: jest.fn().mockResolvedValue(previousResults ? { results: previousResults } : null),
        create: jest.fn().mockResolvedValue({ id: 'run-1' }),
        update: jest.fn().mockResolvedValue({})
      },
      ticket: { create: jest.fn().mockResolvedValue({ id: 'ticket-1' }) }
    };
    const invariants = {
      checkAll: jest.fn().mockResolvedValue({
        checkedAt: '2026-09-17T02:00:00.000Z',
        windowDays: 30,
        invariantCount: currentResults.length,
        violatedCount: currentResults.filter((item) => item.violationCount > 0).length,
        totalViolationCount: currentResults.reduce((sum, item) => sum + item.violationCount, 0),
        results: currentResults
      })
    };
    const email = { send: jest.fn().mockResolvedValue('sent') };
    const service = new InvariantRunnerService(
      prisma as never,
      { get: jest.fn((_key: string, fallback: unknown) => fallback) } as never,
      invariants as never,
      email as never
    );
    return { service, prisma, invariants, email };
  }

  /** The update that carries the run's outcome, as opposed to its alert state. */
  const outcomeUpdate = (prisma: { invariantRun: { update: jest.Mock } }) =>
    prisma.invariantRun.update.mock.calls[0][0].data;

  it('claims the day before running any check', async () => {
    const { service, prisma, invariants } = setup(undefined, []);

    await service.runDaily();

    expect(prisma.invariantRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RUNNING', tenantId: 'tenant-1' })
      })
    );
    const claimOrder = prisma.invariantRun.create.mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(invariants.checkAll.mock.invocationCallOrder[0]);
  });

  it('skips a tenant another replica has already claimed for today', async () => {
    const { service, prisma, invariants } = setup(undefined, []);
    prisma.invariantRun.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('claimed', { code: 'P2002', clientVersion: 'test' })
    );

    await expect(service.runDaily()).resolves.toBeUndefined();

    expect(invariants.checkAll).not.toHaveBeenCalled();
    expect(prisma.ticket.create).not.toHaveBeenCalled();
  });

  it('stores the run and sends both channels on the first new violation', async () => {
    const current = [result('reservation.reachable', ['one'])];
    const { service, prisma, email } = setup(undefined, current);

    await service.runDaily();

    expect(outcomeUpdate(prisma)).toEqual(
      expect.objectContaining({ status: 'COMPLETED', totalViolationCount: 1 })
    );
    expect(prisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ category: 'BUG', status: 'OPEN' }) })
    );
    expect(email.send).toHaveBeenCalledWith('Prevoznik', ['admin@example.com'], current, true);
    expect(prisma.invariantRun.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ticketId: 'ticket-1' }) })
    );
  });

  it('stores an unchanged violating run without repeating either alert', async () => {
    const unchanged = [result('reservation.reachable', ['one'])];
    const { service, prisma, email } = setup(unchanged, unchanged);

    await service.runDaily();

    expect(prisma.ticket.create).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
    expect(prisma.invariantRun.update).toHaveBeenCalledTimes(1);
  });

  it('takes its baseline only from runs whose alerts went out', async () => {
    const { service, prisma } = setup(undefined, [result('reservation.reachable', ['one'])]);

    await service.runDaily();

    expect(prisma.invariantRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'COMPLETED', alertError: null })
      })
    );
  });

  // A manual run from Settings alerts nobody. Counting it as the baseline
  // would let an admin pressing "Proveri sve" cancel that night's email about
  // everything that run happened to see.
  it('ignores manual runs when deciding what admins have been told', async () => {
    const { service, prisma } = setup(undefined, [result('reservation.reachable', ['one'])]);

    await service.runDaily();

    expect(prisma.invariantRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ trigger: 'SCHEDULED' })
      })
    );
  });

  it('records the nightly run as scheduled, so the page can tell it apart', async () => {
    const { service, prisma } = setup(undefined, [result('reservation.reachable', ['one'])]);

    await service.runDaily();

    expect(prisma.invariantRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ trigger: 'SCHEDULED' })
      })
    );
  });

  it('tells admins the details are on the run when the ticket could not be opened', async () => {
    const current = [result('reservation.reachable', ['one'])];
    const { service, prisma, email } = setup(undefined, current);
    prisma.ticket.create.mockRejectedValue(new Error('ticket table locked'));

    await service.runDaily();

    expect(email.send).toHaveBeenCalledWith('Prevoznik', ['admin@example.com'], current, false);
    expect(prisma.invariantRun.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ alertError: 'ticket: ticket table locked' })
      })
    );
  });

  it('does not hold the baseline back when there is nobody to email', async () => {
    const { service, prisma, email } = setup(undefined, [result('reservation.reachable', ['one'])]);
    email.send.mockResolvedValue('skipped');

    await service.runDaily();

    // An unreachable email channel is the standing state of the deployment, not
    // a delivery that failed: recording it as an alert error would reopen this
    // same ticket every night.
    expect(prisma.invariantRun.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ alertError: undefined }) })
    );
  });

  it('does hold the baseline back when a send was attempted and failed', async () => {
    const { service, prisma, email } = setup(undefined, [result('reservation.reachable', ['one'])]);
    email.send.mockRejectedValue(new Error('Resend email API request failed with status 500'));

    await service.runDaily();

    expect(prisma.invariantRun.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          alertError: 'email: Resend email API request failed with status 500'
        })
      })
    );
  });

  it('stores a failed run when an invariant throws', async () => {
    const { service, prisma, invariants } = setup(undefined, []);
    invariants.checkAll.mockRejectedValue(new Error('database timeout'));

    await service.runDaily();

    expect(outcomeUpdate(prisma)).toEqual(
      expect.objectContaining({ status: 'FAILED', error: 'database timeout' })
    );
  });
});
