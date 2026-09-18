import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvariantRunStatus, Prisma, TicketCategory, TicketStatus, UserRole } from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import { InvariantReportDto, InvariantResultDto } from './dto/invariant.response.dto';
import { InvariantAlertEmailService } from './invariant-alert-email.service';
import { InvariantsService } from './invariants.service';
import { PrismaService } from '../prisma/prisma.service';

/** The slice of a stored run that the next run reads back as its baseline. */
type StoredResult = Pick<InvariantResultDto, 'key' | 'violations'>;

type MonitoredTenant = {
  id: string;
  name: string;
  slug: string;
  users: { id: string; email: string }[];
};

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class InvariantRunnerService {
  private readonly logger = new Logger(InvariantRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly invariants: InvariantsService,
    private readonly email: InvariantAlertEmailService
  ) {}

  @Cron('0 2 * * *', { name: 'daily-invariant-run', timeZone: 'UTC' })
  async runDaily(): Promise<void> {
    if (!this.config.get<boolean>('INVARIANT_SCHEDULE_ENABLED', true)) return;

    const runDate = utcDay(new Date());
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        users: {
          where: { isActive: true, role: UserRole.ADMIN },
          select: { id: true, email: true },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { slug: 'asc' }
    });

    for (const tenant of tenants) {
      try {
        await this.runTenant(tenant, runDate);
      } catch (error) {
        this.logger.error({
          event: 'daily_invariant_tenant_failed',
          tenantId: tenant.id,
          message: errorMessage(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }
  }

  private async runTenant(tenant: MonitoredTenant, runDate: Date): Promise<void> {
    const startedAt = new Date();

    // Claim the day before doing any work. The unique (tenantId, runDate) index
    // is the only thing standing between a multi-replica deployment and one
    // duplicate ticket and email per extra replica, so nothing that follows may
    // run without having won this insert.
    let runId: string;
    try {
      const run = await this.prisma.invariantRun.create({
        data: {
          tenantId: tenant.id,
          runDate,
          status: InvariantRunStatus.RUNNING,
          startedAt,
          results: []
        },
        select: { id: true }
      });
      runId = run.id;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        this.logger.log({
          event: 'daily_invariant_run_already_claimed',
          tenantId: tenant.id,
          runDate: runDate.toISOString()
        });
        return;
      }
      throw error;
    }

    const previous = await this.alertBaseline(tenant.id);

    let report: InvariantReportDto;
    try {
      report = await this.invariants.checkAll({ tenantId: tenant.id, actorId: this.actorFor(tenant) });
    } catch (error) {
      await this.prisma.invariantRun.update({
        where: { id: runId },
        data: {
          status: InvariantRunStatus.FAILED,
          completedAt: new Date(),
          error: errorMessage(error)
        }
      });
      throw error;
    }

    const changedResults = newlyViolatedResults(previous, report.results);
    await this.prisma.invariantRun.update({
      where: { id: runId },
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

    if (changedResults.length === 0) return;

    const alertErrors: string[] = [];
    const ticketId = await this.openTicket(tenant, changedResults, alertErrors);
    const emailSentAt = await this.sendAlertEmail(tenant, changedResults, Boolean(ticketId), alertErrors);

    await this.prisma.invariantRun.update({
      where: { id: runId },
      data: {
        ticketId,
        emailSentAt,
        alertError: alertErrors.length > 0 ? alertErrors.join('\n') : undefined
      }
    });
  }

  /**
   * The violations the tenant has already been told about.
   *
   * Deliberately the last run whose alerting fully succeeded, not simply the
   * last completed run: if a ticket or an email failed to go out, that run never
   * informed anyone, so leaving it out of the baseline makes the next run
   * re-send instead of going quiet. The cost is a repeat alert for anything that
   * did get through on the half of the delivery that worked, which is the
   * cheaper of the two failures.
   */
  private async alertBaseline(tenantId: string): Promise<StoredResult[]> {
    const previous = await this.prisma.invariantRun.findFirst({
      where: { tenantId, status: InvariantRunStatus.COMPLETED, alertError: null },
      orderBy: { completedAt: 'desc' },
      select: { results: true }
    });

    return Array.isArray(previous?.results) ? (previous.results as unknown as StoredResult[]) : [];
  }

  private async openTicket(
    tenant: MonitoredTenant,
    changedResults: InvariantResultDto[],
    alertErrors: string[]
  ): Promise<string | undefined> {
    try {
      const ticket = await this.prisma.ticket.create({
        data: {
          tenantId: tenant.id,
          createdById: tenant.users[0]?.id,
          updatedById: tenant.users[0]?.id,
          title: 'Automatska provera je pronasla nove probleme',
          description: ticketDescription(changedResults),
          category: TicketCategory.BUG,
          status: TicketStatus.OPEN
        },
        select: { id: true }
      });
      return ticket.id;
    } catch (error) {
      alertErrors.push(`ticket: ${errorMessage(error)}`);
      return undefined;
    }
  }

  private async sendAlertEmail(
    tenant: MonitoredTenant,
    changedResults: InvariantResultDto[],
    ticketOpened: boolean,
    alertErrors: string[]
  ): Promise<Date | undefined> {
    try {
      const sent = await this.email.send(
        tenant.name,
        tenant.users.map((user) => user.email),
        changedResults,
        ticketOpened
      );
      if (sent) return new Date();
      alertErrors.push('email: Resend is not configured or the tenant has no active admin');
    } catch (error) {
      alertErrors.push(`email: ${errorMessage(error)}`);
    }
    return undefined;
  }

  /**
   * Checks are written against a tenant admin's point of view. With no request
   * behind this run, the tenant's longest-standing admin stands in, and a tenant
   * without one is attributed to the monitor itself.
   */
  private actorFor(tenant: MonitoredTenant): string {
    return tenant.users[0]?.id ?? 'invariant-monitor';
  }
}

export function newlyViolatedResults(
  previous: StoredResult[],
  current: InvariantResultDto[]
): InvariantResultDto[] {
  const previousIdentities = new Set(previous.flatMap(violationIdentities));

  return current
    .map((result) => ({
      ...result,
      violations: result.violations.filter(
        (violation) => !previousIdentities.has(identity(result.key, violation))
      )
    }))
    .filter((result) => result.violations.length > 0)
    .map((result) => ({ ...result, violationCount: result.violations.length }));
}

function violationIdentities(result: StoredResult): string[] {
  return result.violations.map((violation) => identity(result.key, violation));
}

function identity(key: string, violation: { subjectType: string; subjectId: string }): string {
  return `${key} ${violation.subjectType} ${violation.subjectId}`;
}

/** Midnight UTC of the given instant, the key a day's run is claimed under. */
function utcDay(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  );
}

function ticketDescription(results: InvariantResultDto[]): string {
  return [
    'Dnevna provera integriteta je pronasla nove probleme od prethodne provere.',
    '',
    ...results.flatMap((result) => [
      `${result.title} (${result.violationCount})`,
      ...result.violations.map((violation) => `- ${violation.summary}`),
      ''
    ])
  ]
    .join('\n')
    .trim();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
