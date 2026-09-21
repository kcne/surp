import { Prisma } from '@prisma/client';
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
  /** A full client for normal runs, or the transaction holding a proposed write. */
  prisma: PrismaService | Prisma.TransactionClient;
  windowDays: number;
}

export type ViolationSubject =
  | 'reservation'
  | 'reservation-group'
  | 'ride-instance'
  | 'ride-schedule'
  | 'line-pair'
  | 'line'
  | 'system';

export interface Violation {
  subjectType: ViolationSubject;
  /** Identifies the row a human would open to look at this. */
  subjectId: string;
  /**
   * How bad this violation is, where "worse" is a larger number.
   *
   * Only meaningful for subjects that can hold more than one problem at once —
   * an instance overbooked by two passengers rather than one, a line calling at
   * three dead stations rather than one. A prospective write compares subjects
   * by identity, so without this a change that deepens a violation it did not
   * create would look identical to the baseline and pass unwarned. Checks whose
   * subject can only ever hold one problem have nothing to count and leave it
   * unset.
   */
  magnitude?: number;
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
  /**
   * What a person should do about what is left after any repair has run, in
   * Serbian. Every check has one: even where a repair exists it declines to
   * guess at some violations, and a count with no next step is the thing the
   * old settings cards got right and a bare table would lose.
   */
  manualAdvice: string;
  severity: InvariantSeverity;
  /**
   * The sentence a write refused for breaking this invariant says, in Serbian.
   *
   * Lives here rather than in a switch beside the guard so that the check and
   * the sentence describing it are one edit, and so a new prospective check
   * cannot silently fall back to generic copy. Present only on the checks a
   * write is ever refused for; `ProspectiveInvariant` requires it.
   */
  breakingChangeMessage?(count: number): string;
  check(ctx: InvariantContext): Promise<CheckResult>;
  /**
   * Present only where a repair can be made without guessing. An invariant
   * whose fix requires a routing decision stays reported.
   */
  repair?(ctx: InvariantContext): Promise<RepairResult>;
}

/**
 * An invariant a write can be refused for.
 *
 * Refusing is user-facing, so it must be able to say why in Serbian. Requiring
 * the sentence here means `PROSPECTIVE_INVARIANTS` cannot name a check that
 * would fall back to generic copy, and the compiler says so at the check.
 */
export type ProspectiveInvariant = Invariant & {
  breakingChangeMessage: (count: number) => string;
};
