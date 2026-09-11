import { BadRequestException, Injectable } from '@nestjs/common';
import { AccessTokenPayload } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  InvariantRepairResultDto,
  InvariantReportDto,
  InvariantResultDto
} from './dto/invariant.response.dto';
import { CheckResult, Invariant, InvariantContext } from './invariant.types';
import { INVARIANTS, findInvariant } from './registry';

/**
 * Days ahead the time-windowed checks cover. Reservations further out exist but
 * are far more likely to be edited again before travel, and a report nobody can
 * act on today is noise.
 */
const DEFAULT_WINDOW_DAYS = 30;

@Injectable()
export class InvariantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs every invariant and reports them in one shape.
   *
   * Checks run in sequence rather than in parallel: they share one database,
   * they are not on a request path, and a single check that fails should not
   * arrive tangled with three others' queries.
   */
  async checkAll(auth: AccessTokenPayload, windowDays = DEFAULT_WINDOW_DAYS): Promise<InvariantReportDto> {
    const ctx = this.contextFor(auth, windowDays);
    const results: InvariantResultDto[] = [];

    for (const invariant of INVARIANTS) {
      results.push(toResult(invariant, await invariant.check(ctx)));
    }

    return {
      checkedAt: new Date().toISOString(),
      windowDays,
      invariantCount: results.length,
      violatedCount: results.filter((result) => result.violationCount > 0).length,
      totalViolationCount: results.reduce((sum, result) => sum + result.violationCount, 0),
      results
    };
  }

  async checkOne(
    auth: AccessTokenPayload,
    key: string,
    windowDays = DEFAULT_WINDOW_DAYS
  ): Promise<InvariantResultDto> {
    const invariant = this.requireInvariant(key);
    const ctx = this.contextFor(auth, windowDays);

    return toResult(invariant, await invariant.check(ctx));
  }

  /**
   * Repairs one invariant, then re-runs its check so the caller is told what is
   * left rather than what was attempted. A repair that silently half-worked is
   * the failure this whole area exists to prevent.
   */
  async repair(
    auth: AccessTokenPayload,
    key: string,
    windowDays = DEFAULT_WINDOW_DAYS
  ): Promise<InvariantRepairResultDto> {
    const invariant = this.requireInvariant(key);

    if (!invariant.repair) {
      throw new BadRequestException(
        `Invariant ${key} is reported only; repairing it requires a decision the data cannot make`
      );
    }

    const ctx = this.contextFor(auth, windowDays);
    const outcome = await invariant.repair(ctx);

    return {
      key,
      repairedCount: outcome.repairedCount,
      skippedCount: outcome.skippedCount,
      remaining: toResult(invariant, await invariant.check(ctx))
    };
  }

  private requireInvariant(key: string): Invariant {
    const invariant = findInvariant(key);

    if (!invariant) {
      throw new BadRequestException(`Unknown invariant: ${key}`);
    }

    return invariant;
  }

  private contextFor(auth: AccessTokenPayload, windowDays: number): InvariantContext {
    return {
      tenantId: auth.tenantId,
      actorId: auth.sub,
      prisma: this.prisma,
      windowDays
    };
  }
}

function toResult(invariant: Invariant, result: CheckResult): InvariantResultDto {
  return {
    key: invariant.key,
    title: invariant.title,
    description: invariant.description,
    severity: invariant.severity,
    scannedCount: result.scannedCount,
    violationCount: result.violations.length,
    repairableCount: result.violations.filter((violation) => violation.canRepair).length,
    hasRepair: Boolean(invariant.repair),
    violations: result.violations
  };
}
