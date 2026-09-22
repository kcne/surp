/**
 * Pairs the return legs booked before `returnOfReservationId` existed, so the
 * round-trip check has a relationship it can actually assert on.
 *
 * Dry run (default): pnpm reservations:return-legs:backfill
 * Apply:             APPLY=1 ACTOR_USER_ID=<user id> pnpm reservations:return-legs:backfill
 * Optional:          REPORT_PATH=<file.json>
 *
 * Run the dry run and the apply against a restored production backup before
 * using APPLY=1 against production, and compare the counts of the two runs.
 * Deploy the linking write paths first, or this fills a bucket that is still
 * draining.
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import {
  applyReturnLegBackfill,
  planReturnLegBackfill
} from '../src/reservations/reservation-return-leg-backfill';

const prisma = new PrismaClient();
const apply = process.env.APPLY === '1';
const actorId = process.env.ACTOR_USER_ID?.trim();
const reportPath = process.env.REPORT_PATH?.trim();

if (apply && !actorId) {
  throw new Error('ACTOR_USER_ID is required when APPLY=1, so updated rows carry an author.');
}

async function main() {
  const plan = await planReturnLegBackfill(prisma);
  const { counts } = plan;

  console.log(
    `${counts.reservationsRead} reservations read, ${counts.alreadyLinked} already linked.\n` +
      `${counts.exactMatches} exact matches (shared roundTripId), ` +
      `${counts.heuristicMatches} heuristic matches, ` +
      `${counts.blockMatches} paired inside a booking block.\n` +
      `${counts.ambiguous} ambiguous rows left unlinked, ${counts.excluded} cancelled rows held ` +
      `back as not-the-leg, ${counts.unmatched} with no unique assignment.`
  );

  // Ambiguity is a to-do list for a human, not a failure. Print enough to act
  // on, and keep the full detail for diffing one run against the next.
  for (const entry of plan.ambiguous.slice(0, 20)) {
    console.log(
      `  ambiguous ${entry.reservationId} (${entry.phase}, ${entry.reason}): ` +
        `${entry.candidateReservationIds.join(', ')}`
    );
  }
  if (plan.ambiguous.length > 20) {
    console.log(`  ... and ${plan.ambiguous.length - 20} more; set REPORT_PATH to see them all.`);
  }

  const heldBack = plan.excluded.reduce<Record<string, number>>((tally, entry) => {
    tally[entry.reason] = (tally[entry.reason] ?? 0) + 1;
    return tally;
  }, {});
  for (const [reason, count] of Object.entries(heldBack)) {
    console.log(`  held back ${count} x ${reason}`);
  }

  if (reportPath) {
    writeFileSync(
      reportPath,
      `${JSON.stringify(
        { counts, links: plan.links, ambiguous: plan.ambiguous, excluded: plan.excluded },
        null,
        2
      )}\n`
    );
    console.log(`Report written to ${reportPath}.`);
  }

  if (!apply) {
    console.log('Dry run only. Re-run with APPLY=1 and ACTOR_USER_ID=<user id> to write.');
    return;
  }

  const result = await applyReturnLegBackfill(prisma, actorId as string, plan);
  console.log(
    `Linked ${result.linkedCount} return legs ` +
      `(${result.exactCount} exact, ${result.heuristicCount} heuristic, ` +
      `${result.blockCount} booking block).` +
      (result.skippedCount > 0
        ? ` Skipped ${result.skippedCount} rows already linked or changed since the plan was read.`
        : '')
  );
  if (result.contendedReturnReservationIds.length > 0) {
    console.log(
      `Outbound contention rolled back ${result.contendedReturnReservationIds.length} link(s): ` +
        result.contendedReturnReservationIds.join(', ')
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
