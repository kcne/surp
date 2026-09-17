import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvariantRunStatus, Prisma, TicketCategory, TicketStatus, UserRole } from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import { InvariantReportDto, InvariantResultDto } from './dto/invariant.response.dto';
import { InvariantAlertEmailService } from './invariant-alert-email.service';
import { InvariantsService } from './invariants.service';
import { PrismaService } from '../prisma/prisma.service';

type StoredResult = Pick<InvariantResultDto, 'key' | 'violations' | 'violationCount' | 'title'>;

@Injectable()
export class InvariantRunnerService {
  private readonly logger = new Logger(InvariantRunnerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly invariants: InvariantsService,
    private readonly email: InvariantAlertEmailService
  ) {}

  @Cron('0 2 * * *', { name: 'daily-invariant-run', timeZone: 'UTC' })
  async runDaily(): Promise<void> {
    if (!this.config.get<boolean>('INVARIANT_SCHEDULE_ENABLED', true)) return;
    if (this.running) {
      this.logger.warn('Skipping daily invariant run because the previous run is still active');
      return;
    }

    this.running = true;
    try {
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
          await this.runTenant(tenant);
        } catch (error) {
          this.logger.error({
            event: 'daily_invariant_tenant_failed',
            tenantId: tenant.id,
            message: errorMessage(error),
            stack: error instanceof Error ? error.stack : undefined
          });
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async runTenant(tenant: {
    id: string;
    name: string;
    slug: string;
    users: { id: string; email: string }[];
  }): Promise<void> {
    const startedAt = new Date();
    const previous = await this.prisma.invariantRun.findFirst({
      where: { tenantId: tenant.id, status: InvariantRunStatus.COMPLETED },
      orderBy: { completedAt: 'desc' },
      select: { results: true }
    });
    const actorId = tenant.users[0]?.id ?? 'invariant-monitor';

    let report: InvariantReportDto;
    try {
      report = await this.invariants.checkAll({
        sub: actorId,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        role: UserRole.ADMIN
      } as never);
    } catch (error) {
      await this.prisma.invariantRun.create({
        data: {
          tenantId: tenant.id,
          status: InvariantRunStatus.FAILED,
          startedAt,
          completedAt: new Date(),
          results: [],
          error: errorMessage(error)
        }
      });
      throw error;
    }

    const changedResults = newlyViolatedResults(readResults(previous?.results), report.results);
    const run = await this.prisma.invariantRun.create({
      data: {
        tenantId: tenant.id,
        status: InvariantRunStatus.COMPLETED,
        startedAt,
        completedAt: new Date(report.checkedAt),
        windowDays: report.windowDays,
        invariantCount: report.invariantCount,
        violatedCount: report.violatedCount,
        totalViolationCount: report.totalViolationCount,
        results: report.results as unknown as Prisma.InputJsonValue
      },
      select: { id: true }
    });

    if (changedResults.length === 0) return;

    let ticketId: string | undefined;
    let emailSentAt: Date | undefined;
    const alertErrors: string[] = [];
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
      ticketId = ticket.id;
    } catch (error) {
      alertErrors.push(`ticket: ${errorMessage(error)}`);
    }

    try {
      if (await this.email.send(tenant.name, tenant.users.map((user) => user.email), changedResults)) {
        emailSentAt = new Date();
      } else {
        alertErrors.push('email: Resend is not configured or the tenant has no active admin');
      }
    } catch (error) {
      alertErrors.push(`email: ${errorMessage(error)}`);
    }

    await this.prisma.invariantRun.update({
      where: { id: run.id },
      data: {
        ticketId,
        emailSentAt,
        alertError: alertErrors.length > 0 ? alertErrors.join('\n') : undefined
      }
    });
  }
}

export function newlyViolatedResults(
  previous: StoredResult[],
  current: InvariantResultDto[]
): InvariantResultDto[] {
  const previousIdentities = new Set(
    previous.flatMap((result) =>
      result.violations.map(
        (violation) => `${result.key}\u0000${violation.subjectType}\u0000${violation.subjectId}`
      )
    )
  );
  return current
    .map((result) => ({
      ...result,
      violations: result.violations.filter(
        (violation) =>
          !previousIdentities.has(`${result.key}\u0000${violation.subjectType}\u0000${violation.subjectId}`)
      )
    }))
    .filter((result) => result.violations.length > 0)
    .map((result) => ({ ...result, violationCount: result.violations.length }));
}

function readResults(value: Prisma.JsonValue | undefined): StoredResult[] {
  return Array.isArray(value) ? (value as unknown as StoredResult[]) : [];
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
  ].join('\n').trim();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
