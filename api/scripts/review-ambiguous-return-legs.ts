/**
 * Renders the return-leg backfill's ambiguity report as a sheet the agency can
 * work from.
 *
 * The backfill deliberately refuses to guess which outbound leg a return
 * belongs to when more than one fits, because a wrong link sends staff to
 * phone a passenger about a journey that was never sold. What it leaves behind
 * is a list of reservation ids, and no one can decide from those.
 *
 *   REPORT_PATH=/tmp/return-legs.json pnpm reservations:return-legs:review
 *   INCLUDE_PAST=1 ...   also list decisions whose every leg has travelled
 *   OUT_PATH=<file.txt>  where to write (default /tmp/ambiguous-review.txt)
 *
 * Read-only: it opens the database to name rows and never writes to it.
 *
 * The sheet carries passenger names and phone numbers, unlike the JSON it is
 * built from. Keep it where the rest of the review material lives and out of
 * pull requests and issues.
 */
import { PrismaClient } from '@prisma/client';
import { chmodSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import {
  AmbiguityReviewRow,
  formatReviewSheet,
  groupAmbiguities
} from '../src/reservations/return-leg-ambiguity-review';
import type { ReturnLegBackfillAmbiguity } from '../src/reservations/reservation-return-leg-backfill';

const prisma = new PrismaClient();
const reportPath = process.env.REPORT_PATH?.trim();
const outPath = process.env.OUT_PATH?.trim() || '/tmp/ambiguous-review.txt';
const includePast = process.env.INCLUDE_PAST === '1';

if (!reportPath) {
  throw new Error(
    'REPORT_PATH is required: the JSON written by reservations:return-legs:backfill.'
  );
}

const REVIEW_SELECT = {
  id: true,
  travelDate: true,
  rideDepartureTime: true,
  seatNumber: true,
  status: true,
  returnOfReservationId: true,
  passenger: { select: { firstName: true, lastName: true, phone: true } },
  ride: { select: { line: { select: { name: true } } } },
  departureStation: { select: { name: true } },
  arrivalStation: { select: { name: true } }
} as const;

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const report = require(resolve(reportPath!)) as { ambiguous?: ReturnLegBackfillAmbiguity[] };
  const ambiguous = report.ambiguous ?? [];

  if (ambiguous.length === 0) {
    console.log('No ambiguous rows in this report; nothing to review.');
    return;
  }

  const ids = [
    ...new Set(
      ambiguous.flatMap((entry) => [entry.reservationId, ...entry.candidateReservationIds])
    )
  ];
  const rows = await prisma.reservation.findMany({
    where: { id: { in: ids } },
    select: REVIEW_SELECT
  });

  const rowsById = new Map<string, AmbiguityReviewRow>(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        travelDate: row.travelDate,
        rideDepartureTime: row.rideDepartureTime,
        seatNumber: row.seatNumber,
        status: row.status,
        returnOfReservationId: row.returnOfReservationId,
        passengerName: `${row.passenger.firstName} ${row.passenger.lastName}`,
        passengerPhone: row.passenger.phone,
        lineName: row.ride.line.name,
        departureStationName: row.departureStation.name,
        arrivalStationName: row.arrivalStation.name
      }
    ])
  );

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const decisions = groupAmbiguities(ambiguous, rowsById, today);
  const live = decisions.filter((decision) => !decision.entirelyPast).length;

  // The sheet carries passenger names and phone numbers, so it is never
  // world-readable. `mode` applies only when the file is created, and the
  // default path is a shared /tmp where a previous run may have left a
  // readable file behind, so an existing one is tightened too.
  const sheet = formatReviewSheet(decisions, rowsById, { includePast, sourcePath: reportPath! });

  writeFileSync(outPath, sheet, { mode: 0o600 });
  chmodSync(outPath, 0o600);

  console.log(
    `${ambiguous.length} ambiguous row(s) in ${decisions.length} decision(s); ` +
      `${live} still to travel.`
  );
  console.log(
    includePast
      ? `Review sheet written to ${outPath}, past decisions included.`
      : `Review sheet written to ${outPath}. Set INCLUDE_PAST=1 to add the ${decisions.length - live} already travelled.`
  );
  console.log(
    'It carries passenger names and phone numbers; keep it out of issues and pull requests.'
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
