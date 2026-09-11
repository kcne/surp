import { PrismaService } from '../prisma/prisma.service';

/**
 * An invariant is a statement about the data that must hold, expressed as code
 * that can be run at any time.
 *
 * Five incidents on this system shared one shape: the edit succeeded, some copy
 * of the data stayed behind, and no request ever failed. Nothing watching
 * requests can see that, because nothing about a request was wrong. What sees
 * it is a claim about the data, checked repeatedly.
 *
 * Every invariant here runs unchanged in four places — before a write, on a
 * schedule, on demand from Settings, and in CI against fixtures — so a check
 * written once covers all four.
 */

export type InvariantSeverity = 'critical' | 'warning';

/**
 * What a check is given. The window bounds the checks that look at travel
 * dates: reservations further out exist, but they are far more likely to be
 * edited again before travel, and a report nobody can act on today is noise.
 */
export interface InvariantContext {
  tenantId: string;
  actorId: string;
  prisma: PrismaService;
  windowDays: number;
}

export type ViolationSubject = 'reservation' | 'ride-schedule' | 'line-pair' | 'line';

export interface Violation {
  subjectType: ViolationSubject;
  /** Identifies the row a human would open to look at this. */
  subjectId: string;
  /** One sentence, in Serbian: it is read in Settings by agency staff. */
  summary: string;
  /** Everything the review page needs to render a detail row. */
  detail: Record<string, unknown>;
  /** Whether `repair` would act on this particular violation. */
  canRepair: boolean;
}

/**
 * Carries what was examined alongside what was wrong.
 *
 * "No violations" and "no violations out of 201 reservations scanned" read very
 * differently at 2am, and the second is the one that says the check actually
 * ran against something.
 */
export interface CheckResult {
  violations: Violation[];
  scannedCount: number;
}

export interface RepairResult {
  repairedCount: number;
  /** Violations a repair deliberately declined to guess at. */
  skippedCount: number;
}

export interface Invariant {
  /** Stable identifier, used in URLs, metrics and alerts. Never renamed. */
  key: string;
  /** Shown in Settings, so Serbian. */
  title: string;
  /** Why a violation matters, in terms of what an agency would notice. */
  description: string;
  severity: InvariantSeverity;
  check(ctx: InvariantContext): Promise<CheckResult>;
  /**
   * Present only where a repair can be made without guessing. An invariant
   * whose fix requires a routing decision stays reported.
   */
  repair?(ctx: InvariantContext): Promise<RepairResult>;
}
