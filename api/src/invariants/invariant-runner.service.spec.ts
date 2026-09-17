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
    const email = { send: jest.fn().mockResolvedValue(true) };
    const service = new InvariantRunnerService(
      prisma as never,
      { get: jest.fn((_key: string, fallback: unknown) => fallback) } as never,
      invariants as never,
      email as never
    );
    return { service, prisma, invariants, email };
  }

  it('stores the run and sends both channels on the first new violation', async () => {
    const current = [result('reservation.reachable', ['one'])];
    const { service, prisma, email } = setup(undefined, current);

    await service.runDaily();

    expect(prisma.invariantRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED', totalViolationCount: 1 })
      })
    );
    expect(prisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ category: 'BUG', status: 'OPEN' }) })
    );
    expect(email.send).toHaveBeenCalledWith('Prevoznik', ['admin@example.com'], current);
    expect(prisma.invariantRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ticketId: 'ticket-1' }) })
    );
  });

  it('stores an unchanged violating run without repeating either alert', async () => {
    const unchanged = [result('reservation.reachable', ['one'])];
    const { service, prisma, email } = setup(unchanged, unchanged);

    await service.runDaily();

    expect(prisma.invariantRun.create).toHaveBeenCalledTimes(1);
    expect(prisma.ticket.create).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
    expect(prisma.invariantRun.update).not.toHaveBeenCalled();
  });

  it('stores a failed run when an invariant throws', async () => {
    const { service, prisma, invariants } = setup(undefined, []);
    const failure = new Error('database timeout');
    invariants.checkAll.mockRejectedValue(failure);

    await service.runDaily();

    expect(prisma.invariantRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'FAILED', error: 'database timeout', results: [] })
    });
  });
});
