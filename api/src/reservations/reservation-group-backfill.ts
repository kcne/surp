import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { withUpdateAudit } from '../prisma/audit-write.helper';
import { acquireScheduleLocksShared } from '../prisma/schedule-lock';

export interface ReservationGroupBackfillInspection {
  reservationCount: number;
  passengerGroupCount: number;
}

export interface ReservationGroupBackfillResult {
  updatedReservationCount: number;
  createdGroupCount: number;
}

interface MissingPassengerGroup {
  tenantId: string;
  rideId: string;
  travelDate: Date;
  rideDepartureTime: string;
  passengerId: string;
  reservationCount: number;
}

const MAX_BATCH_SIZE = 1000;

/**
 * Counts the legacy rows a backfill would touch. This is intentionally a
 * separate read-only operation so it can be run against a restored production
 * backup before anyone supplies an actor id or enables writes.
 */
export async function inspectReservationGroupBackfill(
  prisma: PrismaClient
): Promise<ReservationGroupBackfillInspection> {
  const [summary] = await prisma.$queryRaw<
    Array<{ reservationCount: bigint; passengerGroupCount: bigint }>
  >`
    SELECT
      COUNT(*)::bigint AS "reservationCount",
      COUNT(DISTINCT (
        "tenantId",
        "rideId",
        "travelDate",
        "rideDepartureTime",
        "passengerId"
      ))::bigint AS "passengerGroupCount"
    FROM "Reservation"
    WHERE "groupId" IS NULL
  `;

  return {
    reservationCount: Number(summary?.reservationCount ?? 0),
    passengerGroupCount: Number(summary?.passengerGroupCount ?? 0)
  };
}

/**
 * Assigns one group to every legacy passenger on a ride instance.
 *
 * Each key is updated atomically and only while groupId is still NULL. Existing
 * group ids are therefore never overwritten, and an interrupted run can be
 * repeated safely: completed keys disappear from the next batch.
 */
export async function applyReservationGroupBackfill(
  prisma: PrismaClient,
  actorId: string,
  batchSize = 250
): Promise<ReservationGroupBackfillResult> {
  if (!actorId?.trim()) {
    throw new Error('actor user id is required for the reservation group backfill');
  }

  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    throw new Error(`batch size must be between 1 and ${MAX_BATCH_SIZE}`);
  }

  let updatedReservationCount = 0;
  let createdGroupCount = 0;

  while (true) {
    const missingGroups = await loadMissingPassengerGroups(prisma, batchSize);
    if (missingGroups.length === 0) {
      break;
    }

    const batchResult = await prisma.$transaction(async (tx) => {
      await acquireScheduleLocksShared(
        tx,
        missingGroups.map((missing) => missing.tenantId)
      );

      let batchUpdatedCount = 0;
      let batchCreatedGroupCount = 0;

      for (const missing of missingGroups) {
        const update = await tx.reservation.updateMany({
          where: {
            tenantId: missing.tenantId,
            rideId: missing.rideId,
            travelDate: missing.travelDate,
            rideDepartureTime: missing.rideDepartureTime,
            passengerId: missing.passengerId,
            groupId: null
          },
          data: withUpdateAudit({ groupId: randomUUID() }, actorId)
        });

        batchUpdatedCount += update.count;
        if (update.count > 0) {
          batchCreatedGroupCount += 1;
        }
      }

      return { batchUpdatedCount, batchCreatedGroupCount };
    }, { timeout: 30_000 });

    updatedReservationCount += batchResult.batchUpdatedCount;
    createdGroupCount += batchResult.batchCreatedGroupCount;
  }

  const remaining = await prisma.reservation.count({ where: { groupId: null } });
  if (remaining > 0) {
    throw new Error(`${remaining} reservations still have no groupId after the backfill`);
  }

  return { updatedReservationCount, createdGroupCount };
}

async function loadMissingPassengerGroups(
  prisma: Pick<PrismaClient, '$queryRaw'>,
  batchSize: number
): Promise<MissingPassengerGroup[]> {
  return prisma.$queryRaw<MissingPassengerGroup[]>(Prisma.sql`
    SELECT
      "tenantId",
      "rideId",
      "travelDate",
      "rideDepartureTime",
      "passengerId",
      COUNT(*)::integer AS "reservationCount"
    FROM "Reservation"
    WHERE "groupId" IS NULL
    GROUP BY
      "tenantId",
      "rideId",
      "travelDate",
      "rideDepartureTime",
      "passengerId"
    ORDER BY
      "tenantId",
      "rideId",
      "travelDate",
      "rideDepartureTime",
      "passengerId"
    LIMIT ${batchSize}
  `);
}
