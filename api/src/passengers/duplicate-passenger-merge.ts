import { PrismaClient } from '@prisma/client';
import { withUpdateAudit } from '../prisma/audit-write.helper';
import { nameKeyForIdentity, phoneKeyForIdentity } from './passenger-match.util';

/**
 * Collapses the several rows one human ended up with into one.
 *
 * Imports are the main source: a reimport re-entered twelve passengers as new
 * rows, rebooked them, and cancelled their old tickets, which is why the
 * return-leg backfill paired outbound legs with dead return legs — it matches
 * on `passengerId`, and the live leg sat under a different one.
 *
 * Identity is the rule #13 defined for CSV import: same folded name, first and
 * last order irrelevant, **and** the last 8 digits of the phone. Phone alone
 * would be wrong — on production data 59 phone numbers are shared by rows with
 * different names, which are families booking on one number.
 */

export interface DuplicatePassengerGroup {
  tenantId: string;
  nameKey: string;
  phoneKey: string;
  canonicalPassengerId: string;
  retiredPassengerIds: string[];
  reservationsToRepoint: number;
  /** Fields the canonical row is missing that exactly one duplicate supplies. */
  filledFields: Record<string, string>;
}

export interface DuplicatePassengerConflict {
  tenantId: string;
  nameKey: string;
  phoneKey: string;
  passengerIds: string[];
  /** Fields where two rows each hold a different non-empty value. */
  conflictingFields: string[];
}

export interface DuplicatePassengerCounts {
  passengersRead: number;
  duplicateHumans: number;
  rowsToRetire: number;
  reservationsToRepoint: number;
  conflicts: number;
}

export interface DuplicatePassengerPlan {
  groups: DuplicatePassengerGroup[];
  conflicts: DuplicatePassengerConflict[];
  counts: DuplicatePassengerCounts;
}

export interface DuplicatePassengerResult {
  mergedHumans: number;
  retiredPassengers: number;
  repointedReservations: number;
}

/** Fields carried over when the canonical row has none and one duplicate does. */
const FILLABLE_FIELDS = ['email', 'notes'] as const;
/** Fields two rows must not disagree on; disagreement is reported, never guessed. */
const COMPARED_FIELDS = ['passengerType', 'email', 'notes'] as const;

type PassengerRow = {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  passengerType: string;
  isActive: boolean;
  createdAt: Date;
  _count: { reservations: number };
};

type PrismaReadClient = Pick<PrismaClient, 'passenger'>;

function fieldValue(row: PassengerRow, field: string): string {
  const value = (row as unknown as Record<string, unknown>)[field];

  return typeof value === 'string' ? value.trim() : value === null ? '' : String(value);
}

/**
 * The row the others fold into: an active row if one exists, so a mixed-status
 * merge cannot move a live reservation onto an inactive passenger. Among rows
 * with the same status, keep the one carrying the most reservations to minimize
 * writes.
 * Age breaks the tie, then the id, so two runs always choose the same row.
 */
function canonicalOf(rows: PassengerRow[]): PassengerRow {
  return [...rows].sort(
    (left, right) =>
      Number(right.isActive) - Number(left.isActive) ||
      right._count.reservations - left._count.reservations ||
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.id.localeCompare(right.id)
  )[0];
}

/**
 * Reads the plan without writing, so it can run against a restored backup
 * before anyone supplies an actor id.
 */
export async function planDuplicatePassengerMerge(
  prisma: PrismaReadClient
): Promise<DuplicatePassengerPlan> {
  const rows = (await prisma.passenger.findMany({
    select: {
      id: true,
      tenantId: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      notes: true,
      passengerType: true,
      isActive: true,
      createdAt: true,
      _count: { select: { reservations: true } }
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
  })) as unknown as PassengerRow[];

  // A row already retired by an earlier run carries no reservations and is
  // inactive, so leaving those out is what makes a second run a no-op.
  const candidates = rows.filter((row) => row.isActive || row._count.reservations > 0);

  const byHuman = new Map<string, PassengerRow[]>();
  for (const row of candidates) {
    const nameKey = nameKeyForIdentity(row.firstName, row.lastName);
    const phoneKey = phoneKeyForIdentity(row.phone);
    if (!nameKey || phoneKey.length < 8) {
      continue;
    }

    const key = `${row.tenantId}:${nameKey}:${phoneKey}`;
    const group = byHuman.get(key);
    if (group) {
      group.push(row);
    } else {
      byHuman.set(key, [row]);
    }
  }

  const groups: DuplicatePassengerGroup[] = [];
  const conflicts: DuplicatePassengerConflict[] = [];

  for (const members of byHuman.values()) {
    if (members.length < 2) {
      continue;
    }

    const { tenantId } = members[0];
    const nameKey = nameKeyForIdentity(members[0].firstName, members[0].lastName);
    const phoneKey = phoneKeyForIdentity(members[0].phone);

    const conflictingFields = COMPARED_FIELDS.filter((field) => {
      const values = new Set(
        members.map((member) => fieldValue(member, field)).filter((value) => value.length > 0)
      );

      return values.size > 1;
    });

    if (conflictingFields.length > 0) {
      conflicts.push({
        tenantId,
        nameKey,
        phoneKey,
        passengerIds: members.map((member) => member.id),
        conflictingFields: [...conflictingFields]
      });
      continue;
    }

    const canonical = canonicalOf(members);
    const retired = members.filter((member) => member.id !== canonical.id);
    const filledFields: Record<string, string> = {};

    for (const field of FILLABLE_FIELDS) {
      if (fieldValue(canonical, field).length > 0) {
        continue;
      }

      const supplied = retired
        .map((member) => fieldValue(member, field))
        .filter((value) => value.length > 0);

      if (supplied.length > 0) {
        // Every non-empty value in the group is the same one; a disagreement
        // would have been reported as a conflict above.
        filledFields[field] = supplied[0];
      }
    }

    groups.push({
      tenantId,
      nameKey,
      phoneKey,
      canonicalPassengerId: canonical.id,
      retiredPassengerIds: retired.map((member) => member.id),
      reservationsToRepoint: retired.reduce(
        (total, member) => total + member._count.reservations,
        0
      ),
      filledFields
    });
  }

  return {
    groups,
    conflicts,
    counts: {
      passengersRead: rows.length,
      duplicateHumans: groups.length,
      rowsToRetire: groups.reduce((total, group) => total + group.retiredPassengerIds.length, 0),
      reservationsToRepoint: groups.reduce(
        (total, group) => total + group.reservationsToRepoint,
        0
      ),
      conflicts: conflicts.length
    }
  };
}

/**
 * Moves every reservation onto the canonical row and retires the others.
 *
 * Retired rather than deleted: the FK is `onDelete: Restrict`, the row is
 * referenced by past audit trails, and an agency that wants to see what
 * happened is better served by a row marked inactive than by a gap.
 */
export async function applyDuplicatePassengerMerge(
  prisma: PrismaClient,
  actorId: string,
  plan?: DuplicatePassengerPlan
): Promise<DuplicatePassengerResult> {
  if (!actorId?.trim()) {
    throw new Error('actor user id is required for the duplicate passenger merge');
  }

  const resolved = plan ?? (await planDuplicatePassengerMerge(prisma));
  const result: DuplicatePassengerResult = {
    mergedHumans: 0,
    retiredPassengers: 0,
    repointedReservations: 0
  };

  for (const group of resolved.groups) {
    const written = await prisma.$transaction(async (tx) => {
      const repointed = await tx.reservation.updateMany({
        where: {
          tenantId: group.tenantId,
          passengerId: { in: group.retiredPassengerIds }
        },
        data: withUpdateAudit({ passengerId: group.canonicalPassengerId }, actorId)
      });

      if (Object.keys(group.filledFields).length > 0) {
        await tx.passenger.update({
          where: { id: group.canonicalPassengerId },
          data: withUpdateAudit({ ...group.filledFields }, actorId)
        });
      }

      await tx.passenger.updateMany({
        where: { id: { in: group.retiredPassengerIds }, tenantId: group.tenantId },
        data: withUpdateAudit({ isActive: false }, actorId)
      });

      return repointed.count;
    });

    result.mergedHumans += 1;
    result.retiredPassengers += group.retiredPassengerIds.length;
    result.repointedReservations += written;
  }

  return result;
}
