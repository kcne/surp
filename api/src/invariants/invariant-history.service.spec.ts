import { InvariantRunStatus, InvariantRunTrigger } from '@prisma/client';
import { InvariantHistoryService } from './invariant-history.service';
import { InvariantsService } from './invariants.service';
import { INVARIANTS } from './registry';

/**
 * The page's two claims that no single check can make: when the last check ran,
 * and since when something has been failing.
 */

const scope = { tenantId: 'tenant-1', actorId: 'admin-1' };

const KEY = 'reservation.reachable';
const OTHER_KEY = 'reservation.seatUnique';

const violation = (subjectId: string) => ({
  subjectType: 'reservation',
  subjectId,
  summary: `${subjectId} se ne vidi na svom polasku.`,
  detail: { reservationId: subjectId },
  canRepair: true
});

const result = (key: string, violations: ReturnType<typeof violation>[]) => ({
  key,
  title: 'stored title',
  description: 'stored description',
  severity: 'critical',
  scannedCount: 201,
  violationCount: violations.length,
  repairableCount: violations.filter((entry) => entry.canRepair).length,
  hasRepair: true,
  violations
});

/** A completed run `daysAgo` days back, carrying the given results. */
const run = (id: string, daysAgo: number, results: unknown[]) => ({
  id,
  trigger: InvariantRunTrigger.SCHEDULED,
  startedAt: new Date(`2026-09-${String(18 - daysAgo).padStart(2, '0')}T02:00:00.000Z`),
  completedAt: new Date(`2026-09-${String(18 - daysAgo).padStart(2, '0')}T02:01:00.000Z`),
  windowDays: 30,
  results
});

describe('InvariantHistoryService', () => {
  const prismaMock = {
    invariantRun: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() }
  };
  const invariantsMock = { checkAll: jest.fn() };

  const service = new InvariantHistoryService(
    prismaMock as never,
    invariantsMock as unknown as InvariantsService
  );

  beforeEach(() => jest.clearAllMocks());

  it('reports every registered invariant, not only the ones the run stored', async () => {
    prismaMock.invariantRun.findMany.mockResolvedValue([
      run('run-1', 0, [result(KEY, [violation('res-1')])])
    ]);

    const summary = await service.summary(scope);

    expect(summary.items).toHaveLength(INVARIANTS.length);
    expect(summary.violatedCount).toBe(1);
    expect(summary.totalViolationCount).toBe(1);
    // A check the stored run never covered reports that it was not checked,
    // rather than a clean zero it has not earned.
    expect(summary.items.find((item) => item.key === OTHER_KEY)).toEqual(
      expect.objectContaining({ checked: false, violationCount: 0 })
    );
  });

  it('takes wording from the registry rather than from the stored run', async () => {
    prismaMock.invariantRun.findMany.mockResolvedValue([
      run('run-1', 0, [result(KEY, [violation('res-1')])])
    ]);

    const item = (await service.summary(scope)).items.find((entry) => entry.key === KEY);
    const registered = INVARIANTS.find((invariant) => invariant.key === KEY)!;

    expect(item?.title).toBe(registered.title);
    expect(item?.manualAdvice).toBe(registered.manualAdvice);
  });

  it('says nothing has run rather than that everything is clean', async () => {
    prismaMock.invariantRun.findMany.mockResolvedValue([]);

    const summary = await service.summary(scope);

    expect(summary.lastRun).toBeUndefined();
    expect(summary.items.every((item) => !item.checked)).toBe(true);
  });

  it('dates a failing check to the oldest run in its current failing streak', async () => {
    prismaMock.invariantRun.findMany.mockResolvedValue([
      run('run-1', 0, [result(KEY, [violation('res-1')])]),
      run('run-2', 1, [result(KEY, [violation('res-1')])]),
      run('run-3', 2, [result(KEY, [violation('res-1')])])
    ]);

    const item = (await service.summary(scope)).items.find((entry) => entry.key === KEY);

    expect(item?.failingSince).toBe('2026-09-16T02:01:00.000Z');
  });

  it('dates a problem that came back to its return, not to the first time ever seen', async () => {
    prismaMock.invariantRun.findMany.mockResolvedValue([
      run('run-1', 0, [result(KEY, [violation('res-1')])]),
      // Clean in between: the earlier failure was fixed and is not this one.
      run('run-2', 1, [result(KEY, [])]),
      run('run-3', 2, [result(KEY, [violation('res-1')])])
    ]);

    const item = (await service.summary(scope)).items.find((entry) => entry.key === KEY);

    expect(item?.failingSince).toBe('2026-09-18T02:01:00.000Z');
  });

  it('leaves a clean check undated', async () => {
    prismaMock.invariantRun.findMany.mockResolvedValue([run('run-1', 0, [result(KEY, [])])]);

    const item = (await service.summary(scope)).items.find((entry) => entry.key === KEY);

    expect(item?.failingSince).toBeUndefined();
    expect(item?.checked).toBe(true);
  });

  it('dates each violation separately, so a newcomer is not backdated', async () => {
    prismaMock.invariantRun.findMany.mockResolvedValue([
      run('run-1', 0, [result(KEY, [violation('res-1'), violation('res-2')])]),
      run('run-2', 1, [result(KEY, [violation('res-1')])])
    ]);

    const detail = await service.detail(scope, KEY);
    const seen = (subjectId: string) =>
      detail.violations.find((entry) => entry.subjectId === subjectId)?.firstSeenAt;

    expect(seen('res-1')).toBe('2026-09-17T02:01:00.000Z');
    expect(seen('res-2')).toBe('2026-09-18T02:01:00.000Z');
    expect(detail.history).toHaveLength(2);
  });

  it('rejects an unknown key rather than reporting an empty check', async () => {
    await expect(service.detail(scope, 'nema.takve.provere')).rejects.toThrow(
      'Unknown invariant: nema.takve.provere'
    );
  });

  it('stores a manual run so the page can say when the last check ran', async () => {
    prismaMock.invariantRun.create.mockResolvedValue({ id: 'run-new' });
    prismaMock.invariantRun.findMany.mockResolvedValue([]);
    invariantsMock.checkAll.mockResolvedValue({
      checkedAt: '2026-09-18T11:00:00.000Z',
      windowDays: 30,
      invariantCount: 1,
      violatedCount: 0,
      totalViolationCount: 0,
      results: [result(KEY, [])]
    });

    await service.runNow(scope);

    expect(prismaMock.invariantRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          trigger: InvariantRunTrigger.MANUAL,
          triggeredById: 'admin-1',
          status: InvariantRunStatus.RUNNING
        })
      })
    );
    expect(prismaMock.invariantRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-new' },
        data: expect.objectContaining({ status: InvariantRunStatus.COMPLETED })
      })
    );
  });

  it('marks a manual run failed instead of leaving it running forever', async () => {
    prismaMock.invariantRun.create.mockResolvedValue({ id: 'run-new' });
    invariantsMock.checkAll.mockRejectedValue(new Error('baza nije dostupna'));

    await expect(service.runNow(scope)).rejects.toThrow('baza nije dostupna');
    expect(prismaMock.invariantRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: InvariantRunStatus.FAILED,
          error: 'baza nije dostupna'
        })
      })
    );
  });

  it('reads only completed runs, so a half-finished one cannot date a problem', async () => {
    prismaMock.invariantRun.findMany.mockResolvedValue([]);

    await service.summary(scope);

    expect(prismaMock.invariantRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: InvariantRunStatus.COMPLETED })
      })
    );
  });
});
