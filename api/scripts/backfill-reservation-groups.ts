/**
 * Gives every legacy reservation a driver-facing group without changing any
 * groupId already in the database.
 *
 * Dry run (default): pnpm reservations:groups:backfill
 * Apply:             APPLY=1 ACTOR_USER_ID=<user id> pnpm reservations:groups:backfill
 * Optional:          BATCH_SIZE=250
 *
 * Run the dry run and apply against a restored production backup before using
 * APPLY=1 against production. Deploy the new reservation write behavior first
 * so no new NULL rows can arrive while this script runs.
 */
import { PrismaClient } from '@prisma/client';
import {
  applyReservationGroupBackfill,
  inspectReservationGroupBackfill
} from '../src/reservations/reservation-group-backfill';

const prisma = new PrismaClient();
const apply = process.env.APPLY === '1';
const actorId = process.env.ACTOR_USER_ID?.trim();
const batchSize = Number(process.env.BATCH_SIZE ?? 250);

if (apply && !actorId) {
  throw new Error('ACTOR_USER_ID is required when APPLY=1, so updated rows carry an author.');
}

async function main() {
  const inspection = await inspectReservationGroupBackfill(prisma);
  console.log(
    `${inspection.reservationCount} reservations without a group across ` +
      `${inspection.passengerGroupCount} ride-instance passenger groups.`
  );

  if (!apply) {
    console.log('Dry run only. Re-run with APPLY=1 and ACTOR_USER_ID=<user id> to write.');
    return;
  }

  const result = await applyReservationGroupBackfill(prisma, actorId as string, batchSize);
  console.log(
    `Updated ${result.updatedReservationCount} reservations and created ` +
      `${result.createdGroupCount} groups.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
