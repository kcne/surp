import { BadRequestException, Injectable } from '@nestjs/common';
import { InvariantRunStatus, InvariantRunTrigger, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  InvariantDetailDto,
  InvariantHistoryPointDto,
  InvariantRunSummaryDto,
  InvariantSummaryDto,
  InvariantSummaryItemDto
} from './dto/invariant-summary.response.dto';
import { InvariantResultDto, InvariantViolationDto } from './dto/invariant.response.dto';
import { Invariant } from './invariant.types';
import { InvariantScope, InvariantsService } from './invariants.service';
import { INVARIANTS, findInvariant } from './registry';

/**
 * How many stored runs back the page looks.
 *
 * Far enough to date a problem that started a month ago, which is what a
 * postmortem asks first, and short enough that reading every run's results JSON
 * stays one small query.
 */
const HISTORY_RUN_LIMIT = 60;

/** A stored run, reduced to what the page reads back out of it. */
type StoredRun = {
  id: string;
  trigger: InvariantRunTrigger;
  startedAt: Date;
  completedAt: Date | null;
  windowDays: number;
  results: InvariantResultDto[];
};

/**
 * Reads the stored runs behind Settings → Data integrity, and records the runs
 * an admin asks for there.
 *
 * Kept apart from `InvariantsService`, which runs checks and knows nothing about
 * storage, and from the scheduled runner, which also alerts. What is specific
 * here is that the page answers two questions the checks themselves cannot:
 * when the last check ran, and since when something has been failing.
 */
@Injectable()
export class InvariantHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invariants: InvariantsService
  ) {}

  /**
   * The page as it loads: what the last run found, per invariant.
   *
   * Deliberately does not run anything. Opening Settings should not start
   * sixteen table scans, and the honest answer to "is my data alright" is what
   * the last check found plus when it ran — never a blank page.
   */
  async summary(scope: InvariantScope): Promise<InvariantSummaryDto> {
    return this.summaryFrom(await this.recentRuns(scope.tenantId));
  }

  /**
   * Runs every check now and stores the result as a manual run.
   *
   * Stored for the same reason the scheduled run is: a repair done at noon that
   * left no trace would make the history claim the problem stood until 02:00 the
   * next morning.
   */
  async runNow(scope: InvariantScope): Promise<InvariantSummaryDto> {
    const run = await this.prisma.invariantRun.create({
      data: {
        tenantId: scope.tenantId,
        trigger: InvariantRunTrigger.MANUAL,
        triggeredById: scope.actorId,
        status: InvariantRunStatus.RUNNING,
        startedAt: new Date(),
        results: []
      },
      select: { id: true }
    });

    let report;
    try {
      report = await this.invariants.checkAll(scope);
    } catch (error) {
      await this.prisma.invariantRun.update({
        where: { id: run.id },
        data: {
          status: InvariantRunStatus.FAILED,
          completedAt: new Date(),
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }

    await this.prisma.invariantRun.update({
      where: { id: run.id },
      data: {
        status: InvariantRunStatus.COMPLETED,
        completedAt: new Date(report.checkedAt),
        windowDays: report.windowDays,
        invariantCount: report.invariantCount,
        violatedCount: report.violatedCount,
        totalViolationCount: report.totalViolationCount,
        results: report.results as unknown as Prisma.InputJsonValue
      }
    });

    return this.summaryFrom(await this.recentRuns(scope.tenantId));
  }

  /**
   * One invariant in full: its violations as of the last run, each dated to when
   * it first appeared, and the run-by-run counts behind it.
   */
  async detail(scope: InvariantScope, key: string): Promise<InvariantDetailDto> {
    const invariant = findInvariant(key);

    if (!invariant) {
      throw new BadRequestException(`Unknown invariant: ${key}`);
    }

    const runs = await this.recentRuns(scope.tenantId);
    const latest = runs[0];
    const result = latest ? resultFor(latest, key) : undefined;

    return {
      key: invariant.key,
      title: invariant.title,
      description: invariant.description,
      manualAdvice: invariant.manualAdvice,
      severity: invariant.severity,
      hasRepair: Boolean(invariant.repair),
      lastRun: latest ? toRunSummary(latest) : undefined,
      scannedCount: result?.scannedCount ?? 0,
      violationCount: result?.violationCount ?? 0,
      repairableCount: result?.repairableCount ?? 0,
      // `latest` is necessarily set wherever there are violations to date:
      // they were read out of it.
      violations: (result?.violations ?? []).map((violation) => ({
        ...violation,
        firstSeenAt: firstSeenAt(runs, key, violation, isoOf(latest!))
      })),
      history: runs.map((run) => toHistoryPoint(run, key))
    };
  }

  private summaryFrom(runs: StoredRun[]): InvariantSummaryDto {
    const latest = runs[0];
    const items = INVARIANTS.map((invariant) => toSummaryItem(invariant, runs));

    return {
      lastRun: latest ? toRunSummary(latest) : undefined,
      invariantCount: items.length,
      violatedCount: items.filter((item) => item.violationCount > 0).length,
      criticalViolatedCount: items.filter(
        (item) => item.violationCount > 0 && item.severity === 'critical'
      ).length,
      totalViolationCount: items.reduce((sum, item) => sum + item.violationCount, 0),
      items
    };
  }

  /**
   * Completed runs only, newest first.
   *
   * A run that failed halfway carries results nobody should date a problem
   * from, and a run still in flight carries none at all.
   */
  private async recentRuns(tenantId: string): Promise<StoredRun[]> {
    const runs = await this.prisma.invariantRun.findMany({
      where: { tenantId, status: InvariantRunStatus.COMPLETED, completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      take: HISTORY_RUN_LIMIT,
      select: {
        id: true,
        trigger: true,
        startedAt: true,
        completedAt: true,
        windowDays: true,
        results: true
      }
    });

    return runs.map((run) => ({
      ...run,
      results: Array.isArray(run.results) ? (run.results as unknown as InvariantResultDto[]) : []
    }));
  }
}

function toSummaryItem(invariant: Invariant, runs: StoredRun[]): InvariantSummaryItemDto {
  const latest = runs[0];
  const result = latest ? resultFor(latest, invariant.key) : undefined;

  return {
    key: invariant.key,
    // Wording comes from the registry, never from the stored run: a run older
    // than the last edit to a check would otherwise show its former title.
    title: invariant.title,
    description: invariant.description,
    manualAdvice: invariant.manualAdvice,
    severity: invariant.severity,
    checked: Boolean(result),
    scannedCount: result?.scannedCount ?? 0,
    violationCount: result?.violationCount ?? 0,
    repairableCount: result?.repairableCount ?? 0,
    hasRepair: Boolean(invariant.repair),
    failingSince: failingSince(runs, invariant.key)
  };
}

/**
 * Since when this invariant has been failing without a clean run in between.
 *
 * Walks back only while every run still reports it, so a problem that was fixed
 * and came back is dated to its return rather than to the first time it was
 * ever seen. A run that predates the check stops the walk: it says nothing
 * about the check, and reading it as clean would date the problem to it.
 */
function failingSince(runs: StoredRun[], key: string): string | undefined {
  let since: string | undefined;

  for (const run of runs) {
    const result = resultFor(run, key);

    if (!result || result.violationCount === 0) break;

    since = isoOf(run);
  }

  return since;
}

function firstSeenAt(
  runs: StoredRun[],
  key: string,
  violation: InvariantViolationDto,
  fallback: string
): string {
  let since = fallback;

  for (const run of runs) {
    const result = resultFor(run, key);
    const present = result?.violations.some(
      (stored) =>
        stored.subjectType === violation.subjectType && stored.subjectId === violation.subjectId
    );

    if (!present) break;

    since = isoOf(run);
  }

  return since;
}

function toRunSummary(run: StoredRun): InvariantRunSummaryDto {
  return {
    id: run.id,
    trigger: run.trigger,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString(),
    windowDays: run.windowDays
  };
}

function toHistoryPoint(run: StoredRun, key: string): InvariantHistoryPointDto {
  const result = resultFor(run, key);

  return {
    runId: run.id,
    trigger: run.trigger,
    checkedAt: isoOf(run),
    checked: Boolean(result),
    violationCount: result?.violationCount ?? 0,
    scannedCount: result?.scannedCount ?? 0
  };
}

function resultFor(run: StoredRun, key: string): InvariantResultDto | undefined {
  return run.results.find((result) => result.key === key);
}

/** Completed runs are the only ones read here, so `completedAt` is always set. */
function isoOf(run: StoredRun): string {
  return (run.completedAt ?? run.startedAt).toISOString();
}
