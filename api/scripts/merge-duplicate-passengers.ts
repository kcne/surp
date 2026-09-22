/**
 * Collapses the several rows one human ended up with into one, so a passenger
 * is one record and the reservations of both directions hang off it.
 *
 * Dry run (default): pnpm passengers:duplicates:merge
 * Apply:             APPLY=1 ACTOR_USER_ID=<user id> pnpm passengers:duplicates:merge
 * Optional:          REPORT_PATH=<file.json>
 *
 * Run the dry run and the apply against a restored production backup before
 * using APPLY=1 against production. Run this before the return-leg backfill:
 * with one row per human, that backfill finds the live return leg by itself.
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import {
  applyDuplicatePassengerMerge,
  planDuplicatePassengerMerge
} from '../src/passengers/duplicate-passenger-merge';

const prisma = new PrismaClient();
const apply = process.env.APPLY === '1';
const actorId = process.env.ACTOR_USER_ID?.trim();
const reportPath = process.env.REPORT_PATH?.trim();

if (apply && !actorId) {
  throw new Error('ACTOR_USER_ID is required when APPLY=1, so updated rows carry an author.');
}

async function main() {
  const plan = await planDuplicatePassengerMerge(prisma);
  const { counts } = plan;

  console.log(
    `${counts.passengersRead} passengers read.\n` +
      `${counts.duplicateHumans} humans hold more than one row: ` +
      `${counts.rowsToRetire} rows to retire, ` +
      `${counts.reservationsToRepoint} reservations to repoint.\n` +
      `${counts.conflicts} groups left alone because their rows disagree or would collide.`
  );

  for (const conflict of plan.conflicts) {
    if (conflict.reason === 'seat_collision') {
      const seats = conflict.seatCollisions
        .map(
          (collision) =>
            `seat ${collision.seatNumber} on ${collision.travelDate} ${collision.rideDepartureTime} ` +
            `(${collision.reservationIds.join(', ')})`
        )
        .join('; ');

      console.log(
        `  conflict ${conflict.nameKey} (${conflict.phoneKey}): merging ${conflict.passengerIds.join(', ')} ` +
          `would put one human in the same seat twice — ${seats}`
      );
      continue;
    }

    console.log(
      `  conflict ${conflict.nameKey} (${conflict.phoneKey}): ` +
        `${conflict.conflictingFields.join(', ')} differ across ${conflict.passengerIds.join(', ')}`
    );
  }

  if (reportPath) {
    writeFileSync(reportPath, `${JSON.stringify(plan, null, 2)}\n`);
    console.log(`Report written to ${reportPath}.`);
  }

  if (!apply) {
    console.log('Dry run only. Re-run with APPLY=1 and ACTOR_USER_ID=<user id> to write.');
    return;
  }

  const result = await applyDuplicatePassengerMerge(prisma, actorId as string, plan);
  console.log(
    `Merged ${result.mergedHumans} humans: retired ${result.retiredPassengers} rows and ` +
      `moved ${result.repointedReservations} reservations.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
