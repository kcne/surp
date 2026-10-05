import { Prisma, RideExceptionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatDateOnly, utcDateOf } from '../rides/ride-instance-materialization';
import { PlannedCancellation } from './departure-generator';
import { SYSTEM_ACTOR_ID } from './system-actor';

/**
 * Exception rows as the record of operator decisions that have no departure
 * row to live on (#27, until PR 6).
 *
 * From PR 3a a decision is written on its departure. Two kinds of decision
 * still exist only as an exception row, and are read from here:
 * - a past date, which no departure is written for any more;
 * - a future date with no stored departure: a SKIP on a date the timetable
 *   does not produce yet, or an exception saved before PR 3a whose departure
 *   the old sync deleted. The sync applies it when it creates the departure,
 *   and never clears or rewrites a decision it did not create.
 */

type Db = PrismaService | Prisma.TransactionClient;

export interface ExceptionRecord {
  id: string;
  rideId: string;
  /** `YYYY-MM-DD`. */
  exceptionDate: string;
  type: RideExceptionType;
  departureTime: string | null;
  arrivalTime: string | null;
  createdAt: Date;
  createdById: string | null;
  updatedById: string | null;
}

export function rideDateKey(rideId: string, date: string): string {
  return `${rideId}:${date}`;
}

/** The first SKIP on each ride and date, in the order the records were loaded. */
export function skipsByRideDate(records: readonly ExceptionRecord[]): Map<string, ExceptionRecord> {
  const skips = new Map<string, ExceptionRecord>();

  for (const record of records) {
    const key = rideDateKey(record.rideId, record.exceptionDate);

    if (record.type === RideExceptionType.SKIP && !skips.has(key)) {
      skips.set(key, record);
    }
  }

  return skips;
}

/**
 * The ADDITIONAL rows that produce an extra bus. The materializer ignores one
 * without both times, and so does everything that reads it as a departure.
 */
export function busAdditionals(
  records: readonly ExceptionRecord[]
): Array<ExceptionRecord & { departureTime: string; arrivalTime: string }> {
  return records.filter(
    (record): record is ExceptionRecord & { departureTime: string; arrivalTime: string } =>
      record.type === RideExceptionType.ADDITIONAL &&
      record.departureTime !== null &&
      record.arrivalTime !== null
  );
}

/**
 * A SKIP as a cancellation, credited to its author at the moment it was
 * written. A SKIP without an author still cancelled the date, as it hid the
 * date from the materializer. The audit trigger refuses such a row today, but
 * the schema allows it, so it is credited to the system actor.
 */
export function skipCancellation(skip: ExceptionRecord | undefined): PlannedCancellation | null {
  if (!skip) {
    return null;
  }

  return { at: skip.createdAt, by: skip.updatedById ?? skip.createdById ?? SYSTEM_ACTOR_ID };
}

export async function loadExceptionRecords(
  db: Db,
  tenantId: string,
  window: { from: string; to: string }
): Promise<ExceptionRecord[]> {
  const exceptions = await db.rideException.findMany({
    where: {
      tenantId,
      exceptionDate: { gte: utcDateOf(window.from), lte: utcDateOf(window.to) }
    },
    select: {
      id: true,
      rideId: true,
      exceptionDate: true,
      type: true,
      departureTime: true,
      arrivalTime: true,
      createdAt: true,
      createdById: true,
      updatedById: true
    },
    // A deterministic SKIP when a date carries more than one.
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
  });

  return exceptions.map((exception) => ({
    ...exception,
    exceptionDate: formatDateOnly(exception.exceptionDate)!
  }));
}
