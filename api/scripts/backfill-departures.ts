/**
 * Links every reservation booked before PR 1b to its departure (#27, PR 2).
 * The rules are in `src/departures/departure-backfill.ts`.
 *
 * Dry run (default): pnpm departures:backfill
 * Apply:             pnpm departures:backfill --apply
 * One tenant:        pnpm departures:backfill --tenant=<tenant id>
 * Optional:          REPORT_PATH=<file.json>  every planned row, by ID
 *                    LINKS_PATH=<file.json>   [{ "reservationId", "departureId" }]
 *                                             for reservations that match several
 *                                             departures, as staff chose them;
 *                                             needs --tenant, and a link an
 *                                             earlier run applied counts as done
 *
 * The dry run takes no lock. The apply runs each tenant in one transaction
 * under its exclusive schedule lock, and refuses a tenant, writing nothing for
 * it, when its stored departures are out of step with the timetable, or when a
 * manual link is invalid.
 *
 * Rehearse the dry run and the apply against a restored production backup
 * first, and compare the counts. A second run after an apply proposes nothing.
 *
 * Apply it right after deploying PR 2: `reservation.departureLinked` no longer
 * skips reservations booked before PR 1b, so until this has run it warns about
 * every one of them.
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync } from 'fs';
import {
  BackfillRefused,
  DepartureBackfillPlan,
  ManualLink,
  backfillDepartures,
  backfillWrites,
  countDepartureBackfill,
  planDepartureBackfill
} from '../src/departures/departure-backfill';

// A flag this does not know, or `--tenant <id>` with a space, must not widen
// an apply meant for one tenant to every tenant. A bare `--` is what pnpm may
// pass through.
const args = process.argv.slice(2).filter((arg) => arg !== '--');
const unknownArgs = args.filter((arg) => arg !== '--apply' && !arg.startsWith('--tenant='));

if (unknownArgs.length > 0) {
  throw new Error(
    `Unknown argument(s): ${unknownArgs.join(' ')}. Use --apply and --tenant=<tenant id>.`
  );
}

const apply = args.includes('--apply');
const tenantFlag = args.find((arg) => arg.startsWith('--tenant='));
const tenantArg = tenantFlag?.slice('--tenant='.length).trim();

if (tenantFlag !== undefined && !tenantArg) {
  throw new Error('--tenant= needs a tenant id');
}

const prisma = new PrismaClient();
const reportPath = process.env.REPORT_PATH?.trim();
const linksPath = process.env.LINKS_PATH?.trim();

function readManualLinks(): ManualLink[] {
  if (!linksPath) {
    return [];
  }

  // Every tenant but the one the file is for would find its links invalid and
  // be refused.
  if (!tenantArg) {
    throw new Error('LINKS_PATH needs --tenant=<tenant id>');
  }

  const parsed: unknown = JSON.parse(readFileSync(linksPath, 'utf8'));

  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (entry) => typeof entry?.reservationId === 'string' && typeof entry?.departureId === 'string'
    )
  ) {
    throw new Error(`${linksPath} must be an array of { reservationId, departureId }`);
  }

  return parsed as ManualLink[];
}

function describe(slug: string, plan: DepartureBackfillPlan, elapsedMs?: number): string {
  const counts = countDepartureBackfill(plan);
  const { NO_DEPARTURE: none, SEVERAL_DEPARTURES: several } = counts.reported;

  return [
    `${slug} (agency date ${plan.agencyDate}${elapsedMs === undefined ? '' : `, lock held ${elapsedMs} ms`}):`,
    `  history departures to create: ${counts.historyCreated}`,
    `  linked to an existing departure: ${counts.linked.EXISTING}, to a history departure: ${counts.linked.HISTORY}, by hand: ${counts.linked.MANUAL}`,
    `  LEGACY departures to create: ${counts.legacyCreated} (${counts.legacyCreatedFuture} dated today or later), to reuse: ${counts.legacyReused}; reservations linked to LEGACY: ${counts.linked.LEGACY}`,
    `  reported, future active: ${none.futureActive} without a departure, ${several.futureActive} matching several`,
    `  reported, past or cancelled: ${none.other} without a departure, ${several.other} matching several`,
    `  LEGACY keys whose arrival times disagree: ${counts.legacyArrivalDisagreements}, with a seat sold twice: ${counts.legacyDuplicateSeats}`,
    `  reused LEGACY departures with a seat above their capacity: ${counts.legacyReusedOverCapacity}`,
    ...(counts.manualLinksDone > 0
      ? [`  manual links already applied: ${counts.manualLinksDone}`]
      : []),
    ...(counts.invalidManualLinks > 0
      ? [
          `  INVALID manual links: ${counts.invalidManualLinks}`,
          ...plan.invalidManualLinks.map(
            (link) => `    ${link.reservationId} -> ${link.departureId}: ${link.problem}`
          )
        ]
      : [])
  ].join('\n');
}

async function main() {
  const manualLinks = readManualLinks();
  const tenants = await prisma.tenant.findMany({
    where: tenantArg ? { id: tenantArg } : {},
    select: { id: true, slug: true },
    orderBy: { slug: 'asc' }
  });

  if (tenantArg && tenants.length === 0) {
    throw new Error(`Tenant ${tenantArg} not found`);
  }

  console.log(
    apply ? 'APPLY: linking reservations.' : 'DRY RUN: nothing is written. Pass --apply to write.'
  );

  const report: Array<{
    tenantId: string;
    slug: string;
    plan?: DepartureBackfillPlan;
    refused?: string;
  }> = [];
  let refusedCount = 0;

  for (const tenant of tenants) {
    try {
      let plan: DepartureBackfillPlan;
      let elapsedMs: number | undefined;

      if (apply) {
        const started = Date.now();
        plan = await backfillDepartures(prisma, tenant.id, { manualLinks });
        elapsedMs = Date.now() - started;
      } else {
        plan = await planDepartureBackfill(prisma, tenant.id, { manualLinks });
      }

      report.push({ tenantId: tenant.id, slug: tenant.slug, plan });
      console.log(describe(tenant.slug, plan, elapsedMs));

      if (!backfillWrites(plan)) {
        console.log('  nothing to write');
      }
    } catch (error: unknown) {
      if (!(error instanceof BackfillRefused)) {
        throw error;
      }

      refusedCount += 1;
      report.push({ tenantId: tenant.id, slug: tenant.slug, refused: error.message });
      console.log(`${tenant.slug}: REFUSED, nothing written: ${error.message}`);
    }
  }

  if (reportPath) {
    writeFileSync(reportPath, JSON.stringify({ apply, tenants: report }, null, 2));
    console.log(`Report written to ${reportPath}`);
  }

  if (refusedCount > 0) {
    console.log(`${refusedCount} tenant(s) refused.`);
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
