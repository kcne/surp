/**
 * Brings every tenant's stored departures in step with its timetable (#27).
 *
 * This writes the first window of departures after the migration, and can
 * repair drift that `departure.matchesTimetable` reports. It does the same
 * work as the sync inside every timetable write, credited to the system actor.
 *
 * Dry run (default): pnpm departures:sync
 * Apply:             pnpm departures:sync --apply
 * One tenant:        pnpm departures:sync --tenant=<tenant id>
 *
 * Run the dry run and the apply against a restored production backup before
 * applying to production, and compare the counts of the two runs. Set
 * DEPARTURES_SYNC_ENABLED only after the first apply, then run the dry run
 * again: edits made between the apply and the switch did not sync, and a
 * second apply writes what they changed.
 *
 * The script itself runs whether or not the switch is set.
 */
import { PrismaClient } from '@prisma/client';
import { planDepartureSync, syncDepartures } from '../src/departures/departure-sync';
import { SYSTEM_ACTOR_ID } from '../src/departures/system-actor';
import { scheduleEditTransaction } from '../src/prisma/schedule-lock';

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const tenantArg = args.find((arg) => arg.startsWith('--tenant='))?.slice('--tenant='.length);

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: tenantArg ? { id: tenantArg } : {},
    select: { id: true, slug: true },
    orderBy: { slug: 'asc' }
  });

  if (tenantArg && tenants.length === 0) {
    throw new Error(`Tenant ${tenantArg} not found`);
  }

  console.log(
    apply ? 'APPLY: writing departures.' : 'DRY RUN: nothing is written. Pass --apply to write.'
  );

  const totals = { planned: 0, created: 0, updated: 0, dropped: 0, deleted: 0 };

  for (const tenant of tenants) {
    const scope = { tenantId: tenant.id, actorId: SYSTEM_ACTOR_ID };
    const plan = await planDepartureSync(prisma, tenant.id);
    const counts = apply
      ? await scheduleEditTransaction(prisma, scope, (tx) => syncDepartures(tx, scope, 'full'), {
          departureSync: false,
          timeout: 120_000
        })
      : {
          created: plan.creates.length,
          updated: plan.updates.length,
          dropped: plan.drops.length,
          deleted: plan.deletes.length
        };

    totals.planned += plan.plannedCount;
    totals.created += counts.created;
    totals.updated += counts.updated;
    totals.dropped += counts.dropped;
    totals.deleted += counts.deleted;

    console.log(
      `${tenant.slug} (${plan.window.from}..${plan.window.to}, ${plan.timezone}${
        plan.timezoneInvalid ? ', INVALID tenant timezone' : ''
      }): ${plan.plannedCount} in timetable; ` +
        `${counts.created} to create, ${counts.updated} to update, ` +
        `${counts.dropped} to drop, ${counts.deleted} to delete`
    );
  }

  console.log(
    `Total: ${totals.planned} in timetable; ${totals.created} created, ${totals.updated} updated, ` +
      `${totals.dropped} dropped, ${totals.deleted} deleted${apply ? '' : ' (dry run)'}`
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
