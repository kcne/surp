import { PrismaClient, ReservationStatus } from '@prisma/client';
import { withUpdateAudit } from '../prisma/audit-write.helper';
import { reservationWriteTransaction } from '../prisma/schedule-lock';
import { RouteSegment, routeStationOrder, segmentsOverlap } from '../reservations/route-segment';
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
  /**
   * True when the row that won on reservation count is inactive while another
   * row in the group is live. The human is demonstrably still a customer, and
   * retiring every other row would otherwise leave them with no active record.
   */
  reactivateCanonical: boolean;
}

/** Why a group was reported rather than merged. */
export type DuplicatePassengerConflictReason = 'field_disagreement' | 'seat_collision';

/** One seat two of the group's rows hold at the same time on one departure. */
export interface DuplicatePassengerSeatCollision {
  rideId: string;
  travelDate: string;
  rideDepartureTime: string;
  seatNumber: number;
  reservationIds: string[];
}

export interface DuplicatePassengerConflict {
  tenantId: string;
  nameKey: string;
  phoneKey: string;
  reason: DuplicatePassengerConflictReason;
  passengerIds: string[];
  /** Fields where two rows each hold a different non-empty value. */
  conflictingFields: string[];
  /** Overlapping same-seat holdings; set when `reason` is `seat_collision`. */
  seatCollisions: DuplicatePassengerSeatCollision[];
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

type PrismaReadClient = Pick<PrismaClient, 'passenger' | 'reservation'>;

/**
 * A live reservation of a group member, with the route it was sold against.
 *
 * The merge has to see these before it repoints anything: #93 requires that
 * collapsing two rows never puts one human on the same departure twice in the
 * same seat. The line is read alongside so the seat can be judged by the
 * stretch of route each ticket occupies rather than by the seat number alone —
 * two tickets for seat 4 are legitimate when the first passenger is off before
 * the second boards, and `route-segment` is where that rule lives.
 */
type ReservationRow = {
  id: string;
  passengerId: string;
  rideId: string;
  travelDate: Date;
  rideDepartureTime: string;
  seatNumber: number;
  departureStationId: string;
  arrivalStationId: string;
  ride: {
    line: {
      departureStationId: string;
      arrivalStationId: string;
      intermediateStops: { stationId: string }[];
    };
  };
};

function fieldValue(row: PassengerRow, field: string): string {
  const value = (row as unknown as Record<string, unknown>)[field];

  return typeof value === 'string' ? value.trim() : value === null ? '' : String(value);
}

/**
 * The row the others fold into: the one carrying the most reservations, which
 * is both what #93 specifies and the choice that moves the fewest rows.
 * Age breaks the tie, then the id, so two runs always choose the same row.
 *
 * Status deliberately plays no part. An inactive row holding five reservations
 * is the row the agency has been selling against; picking the live row with one
 * reservation instead would move five live tickets rather than one. The merge
 * reactivates the winner when the group holds a live row, so the human is never
 * left without an active record — see `reactivateCanonical`.
 */
function canonicalOf(rows: PassengerRow[]): PassengerRow {
  return [...rows].sort(
    (left, right) =>
      right._count.reservations - left._count.reservations ||
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.id.localeCompare(right.id)
  )[0];
}


/**
 * The stretch of route a ticket occupies its seat for.
 *
 * A station dropped from the line since the ticket was sold leaves the segment
 * unreadable. The whole route is assumed then, the same assumption the seat
 * checks make, so an unreadable row is reported as a collision rather than
 * merged past.
 */
function segmentOf(row: ReservationRow, order: Map<string, number>): RouteSegment {
  const lastOrder = row.ride.line.intermediateStops.length + 1;

  return {
    departureOrder: order.get(row.departureStationId) ?? 0,
    arrivalOrder: order.get(row.arrivalStationId) ?? lastOrder
  };
}

/** `rideId : travelDate : departureTime : seat`, the seat one bus carries. */
function seatKey(row: ReservationRow): string {
  return [
    row.rideId,
    row.travelDate.toISOString().slice(0, 10),
    row.rideDepartureTime,
    row.seatNumber
  ].join(':');
}

/**
 * Seats two different rows of one group hold at the same time.
 *
 * Reservations already sitting under a single passenger id are left out: that
 * is a pre-existing double sale for `reservation.seatUnique` to report, and
 * the merge neither creates nor worsens it.
 */
function seatCollisionsOf(
  members: PassengerRow[],
  reservationsByPassengerId: Map<string, ReservationRow[]>,
  orderByRideId: Map<string, Map<string, number>>
): DuplicatePassengerSeatCollision[] {
  const bySeat = new Map<string, ReservationRow[]>();

  for (const member of members) {
    for (const row of reservationsByPassengerId.get(member.id) ?? []) {
      const key = seatKey(row);
      const held = bySeat.get(key);
      if (held) {
        held.push(row);
      } else {
        bySeat.set(key, [row]);
      }
    }
  }

  const collisions: DuplicatePassengerSeatCollision[] = [];

  for (const held of bySeat.values()) {
    if (held.length < 2) {
      continue;
    }

    const orderOf = (row: ReservationRow): Map<string, number> => {
      const cached = orderByRideId.get(row.rideId);
      if (cached) {
        return cached;
      }

      const order = routeStationOrder(row.ride.line);
      orderByRideId.set(row.rideId, order);

      return order;
    };

    const overlapping = new Set<string>();
    for (let left = 0; left < held.length; left += 1) {
      for (let right = left + 1; right < held.length; right += 1) {
        if (held[left].passengerId === held[right].passengerId) {
          continue;
        }

        if (
          segmentsOverlap(
            segmentOf(held[left], orderOf(held[left])),
            segmentOf(held[right], orderOf(held[right]))
          )
        ) {
          overlapping.add(held[left].id);
          overlapping.add(held[right].id);
        }
      }
    }

    if (overlapping.size > 0) {
      const [sample] = held;
      collisions.push({
        rideId: sample.rideId,
        travelDate: sample.travelDate.toISOString().slice(0, 10),
        rideDepartureTime: sample.rideDepartureTime,
        seatNumber: sample.seatNumber,
        reservationIds: held.filter((row) => overlapping.has(row.id)).map((row) => row.id)
      });
    }
  }

  return collisions;
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

  // Only the rows that are actually about to be folded together: one query for
  // every group rather than one per group, and nothing at all when the data
  // holds no duplicates.
  const mergeCandidateIds = [...byHuman.values()]
    .filter((members) => members.length > 1)
    .flatMap((members) => members.map((member) => member.id));

  const reservations =
    mergeCandidateIds.length > 0
      ? ((await prisma.reservation.findMany({
          where: { passengerId: { in: mergeCandidateIds }, status: ReservationStatus.ACTIVE },
          select: {
            id: true,
            passengerId: true,
            rideId: true,
            travelDate: true,
            rideDepartureTime: true,
            seatNumber: true,
            departureStationId: true,
            arrivalStationId: true,
            ride: {
              select: {
                line: {
                  select: {
                    departureStationId: true,
                    arrivalStationId: true,
                    intermediateStops: {
                      select: { stationId: true },
                      orderBy: { orderIndex: 'asc' }
                    }
                  }
                }
              }
            }
          }
        })) as unknown as ReservationRow[])
      : [];

  const reservationsByPassengerId = new Map<string, ReservationRow[]>();
  for (const row of reservations) {
    const held = reservationsByPassengerId.get(row.passengerId);
    if (held) {
      held.push(row);
    } else {
      reservationsByPassengerId.set(row.passengerId, [row]);
    }
  }

  // One numbering per ride rather than per reservation; the route behind a ride
  // does not change mid-plan.
  const orderByRideId = new Map<string, Map<string, number>>();

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
        reason: 'field_disagreement',
        passengerIds: members.map((member) => member.id),
        conflictingFields: [...conflictingFields],
        seatCollisions: []
      });
      continue;
    }

    // #93: the merge must not put one human on the same departure twice in the
    // same seat. Report it and leave the group alone, the same refusal the
    // field disagreement above gets — repointing first and discovering the
    // double sale afterwards would need a second repair to undo.
    const seatCollisions = seatCollisionsOf(members, reservationsByPassengerId, orderByRideId);

    if (seatCollisions.length > 0) {
      conflicts.push({
        tenantId,
        nameKey,
        phoneKey,
        reason: 'seat_collision',
        passengerIds: members.map((member) => member.id),
        conflictingFields: [],
        seatCollisions
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
      filledFields,
      reactivateCanonical: !canonical.isActive && members.some((member) => member.isActive)
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
    const written = await reservationWriteTransaction(prisma, group.tenantId, async (tx) => {
      const repointed = await tx.reservation.updateMany({
        where: {
          tenantId: group.tenantId,
          passengerId: { in: group.retiredPassengerIds }
        },
        data: withUpdateAudit({ passengerId: group.canonicalPassengerId }, actorId)
      });

      const canonicalChanges: Record<string, string | boolean> = {
        ...group.filledFields,
        ...(group.reactivateCanonical ? { isActive: true } : {})
      };

      if (Object.keys(canonicalChanges).length > 0) {
        await tx.passenger.update({
          where: { id: group.canonicalPassengerId },
          data: withUpdateAudit(canonicalChanges, actorId)
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
