import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { scheduleEditTransaction } from '../prisma/schedule-lock';
import { DepartureSyncCounts, syncDepartures } from './departure-sync';
import { departureSyncEnabled } from './departure-sync-enabled';
import { SYSTEM_ACTOR_ID } from './system-actor';

export interface NightlyTenantOutcome {
  tenantId: string;
  counts?: DepartureSyncCounts;
  error?: string;
}

/**
 * Adds the departures that entered the window overnight, one tenant at a time.
 *
 * Insert only: every timetable write already keeps existing departures in
 * step, so the night never changes or removes one. It takes the exclusive
 * schedule lock and reads the timetable only after holding it, so it cannot
 * bring back a departure an edit has just removed. One tenant failing is
 * logged and the rest still run; `departure.matchesTimetable` reports what is
 * missing until the next night.
 */
@Injectable()
export class DepartureNightlyService {
  private readonly logger = new Logger(DepartureNightlyService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Before the 03:00 audit retention job.
  @Cron('0 2 * * *', { name: 'departures-nightly', timeZone: 'Europe/Belgrade' })
  async runScheduled(): Promise<void> {
    if (!departureSyncEnabled()) {
      return;
    }

    await this.run();
  }

  async run(now: Date = new Date()): Promise<NightlyTenantOutcome[]> {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true },
      orderBy: { id: 'asc' }
    });
    const outcomes: NightlyTenantOutcome[] = [];

    for (const tenant of tenants) {
      const scope = { tenantId: tenant.id, actorId: SYSTEM_ACTOR_ID };

      try {
        const counts = await scheduleEditTransaction(
          this.prisma,
          scope,
          (tx) => syncDepartures(tx, scope, 'insertOnly', now),
          { departureSync: false }
        );

        if (counts.created > 0) {
          this.logger.log(`Tenant ${tenant.id}: added ${counts.created} departures`);
        }

        outcomes.push({ tenantId: tenant.id, counts });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Tenant ${tenant.id}: nightly departure sync failed: ${message}`);
        outcomes.push({ tenantId: tenant.id, error: message });
      }
    }

    return outcomes;
  }
}
