import { UserRole } from '@prisma/client';
import { InvariantsService } from './invariants.service';
import { CheckResult, Invariant, Violation } from './invariant.types';
import { INVARIANTS, findInvariant } from './registry';

const auth = {
  sub: 'admin-1',
  tenantId: 'tenant-1',
  role: UserRole.ADMIN,
  tenantSlug: 'tenant-one'
} as never;

const violation = (overrides: Partial<Violation> = {}): Violation => ({
  subjectType: 'reservation',
  subjectId: 'reservation-1',
  summary: 'Marko Markovic, 2026-09-15, polazak 07:45 vise ne postoji.',
  detail: {},
  canRepair: true,
  ...overrides
});

describe('INVARIANTS registry', () => {
  it('exposes every check under a unique key', () => {
    const keys = INVARIANTS.map((invariant) => invariant.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('carries the four checks that used to be separate endpoints, plus what has been added since', () => {
    expect(INVARIANTS.map((invariant) => invariant.key)).toEqual([
      'reservation.reachable',
      'reservation.arrivalTimeCurrent',
      'reservation.seatUnique',
      'reservation.seatWithinCapacity',
      'instance.notOverbooked',
      'schedule.matchesRoute',
      'pair.directionsAgree',
      'pair.terminiReachable'
    ]);
  });

  it('gives every check a title and a description, since Settings renders both', () => {
    for (const invariant of INVARIANTS) {
      expect(invariant.title.length).toBeGreaterThan(0);
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });

  // A stale arrival time breaks nothing a request can see — the passenger is
  // simply told the wrong hour — so it is reported as a warning and repaired
  // without asking, unlike the moves that reseat people.
  it('keeps the arrival-time check quiet and repairable', () => {
    const invariant = findInvariant('reservation.arrivalTimeCurrent');

    expect(invariant?.severity).toBe('warning');
    expect(invariant?.repair).toBeDefined();
  });

  // Placing a terminus onto the opposite route is a routing decision, so this
  // one stays reported however convenient a button would be.
  it('leaves the return-route gap check without a repair', () => {
    expect(findInvariant('pair.terminiReachable')?.repair).toBeUndefined();
  });

  it('returns nothing for an unknown key', () => {
    expect(findInvariant('reservation.imaginary')).toBeUndefined();
  });
});

describe('InvariantsService', () => {
  const prismaMock = {} as never;

  // A registry entry that records how it was called, so the service can be
  // tested without touching any of the real checks.
  const stub = (
    key: string,
    result: CheckResult,
    repair?: Invariant['repair']
  ): Invariant => ({
    key,
    title: `title ${key}`,
    description: `description ${key}`,
    severity: 'warning',
    check: jest.fn(async () => result),
    ...(repair ? { repair } : {})
  });

  let service: InvariantsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InvariantsService(prismaMock);
  });

  const useRegistry = (invariants: Invariant[]) => {
    (INVARIANTS as unknown as Invariant[]).length = 0;
    (INVARIANTS as unknown as Invariant[]).push(...invariants);
  };

  const realRegistry = [...INVARIANTS];

  afterEach(() => useRegistry(realRegistry));

  it('summarises every check into one report', async () => {
    useRegistry([
      stub('a.clean', { violations: [], scannedCount: 201 }),
      stub('b.broken', { violations: [violation(), violation({ canRepair: false })], scannedCount: 12 })
    ]);

    const report = await service.checkAll(auth);

    expect(report.invariantCount).toBe(2);
    expect(report.violatedCount).toBe(1);
    expect(report.totalViolationCount).toBe(2);
    expect(report.windowDays).toBe(30);
  });

  // "No violations" and "no violations out of 201 scanned" read very
  // differently when a check has quietly stopped seeing any data.
  it('reports what was scanned even when nothing is wrong', async () => {
    useRegistry([stub('a.clean', { violations: [], scannedCount: 201 })]);

    const [result] = (await service.checkAll(auth)).results;

    expect(result.violationCount).toBe(0);
    expect(result.scannedCount).toBe(201);
  });

  it('separates violations a check can repair from those it cannot', async () => {
    useRegistry([
      stub('b.broken', {
        violations: [violation(), violation({ canRepair: false })],
        scannedCount: 12
      })
    ]);

    const [result] = (await service.checkAll(auth)).results;

    expect(result.violationCount).toBe(2);
    expect(result.repairableCount).toBe(1);
    expect(result.hasRepair).toBe(false);
  });

  it('passes the tenant and window through to each check', async () => {
    const one = stub('a.clean', { violations: [], scannedCount: 0 });
    useRegistry([one]);

    await service.checkAll(auth, 7);

    expect(one.check).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', actorId: 'admin-1', windowDays: 7 })
    );
  });

  it('runs a single check by key', async () => {
    const one = stub('a.clean', { violations: [], scannedCount: 5 });
    const other = stub('b.broken', { violations: [violation()], scannedCount: 5 });
    useRegistry([one, other]);

    const result = await service.checkOne(auth, 'b.broken');

    expect(result.key).toBe('b.broken');
    expect(one.check).not.toHaveBeenCalled();
  });

  it('rejects an unknown key rather than reporting a clean check', async () => {
    useRegistry([stub('a.clean', { violations: [], scannedCount: 0 })]);

    await expect(service.checkOne(auth, 'a.imaginary')).rejects.toThrow('Unknown invariant');
  });

  // A report-only check has no repair on purpose; offering one would mean
  // guessing at a decision the data cannot make.
  it('refuses to repair a check that has no repair', async () => {
    useRegistry([stub('a.reported', { violations: [violation()], scannedCount: 1 })]);

    await expect(service.repair(auth, 'a.reported')).rejects.toThrow('reported only');
  });

  // Reporting what was attempted would hide a repair that half-worked, which is
  // the exact failure this area exists to catch.
  it('re-runs the check after repairing and reports what is left', async () => {
    let repaired = false;
    const invariant: Invariant = {
      key: 'a.fixable',
      title: 'title',
      description: 'description',
      severity: 'critical',
      check: jest.fn(async (): Promise<CheckResult> => ({
        violations: repaired ? [violation({ canRepair: false })] : [violation(), violation()],
        scannedCount: 10
      })),
      repair: jest.fn(async () => {
        repaired = true;
        return { repairedCount: 1, skippedCount: 1 };
      })
    };
    useRegistry([invariant]);

    const result = await service.repair(auth, 'a.fixable');

    expect(result.repairedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.remaining.violationCount).toBe(1);
    expect(invariant.check).toHaveBeenCalledTimes(1);
  });
});
