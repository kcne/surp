import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { instanceNotOverbooked } from './checks/instance-not-overbooked';
import { reservationPassengerActive } from './checks/passenger-active';
import { reservationReachable } from './checks/reservation-reachable';
import { rideLineActive } from './checks/ride-line-active';
import { routeStationsActive } from './checks/route-stations-active';
import { reservationSeatWithinCapacity } from './checks/seat-within-capacity';
import { reservationSegmentValid } from './checks/segment-valid';
import { reservationStationsOnRoute } from './checks/stations-on-route';
import {
  Invariant,
  InvariantContext,
  ProspectiveInvariant,
  Violation
} from './invariant.types';

/**
 * How far ahead a prospective check looks.
 *
 * Deliberately not the 30 days the reports use. A report bounded to a month is
 * a list somebody can act on this week; a write is judged on everything it
 * breaks, and agencies sell months ahead. The guard this replaced looked at
 * every future reservation with no bound at all, and narrowing that to a month
 * would have quietly re-opened the incident it was written for.
 */
const PROSPECTIVE_WINDOW_DAYS = 3650;

export const PROSPECTIVE_INVARIANTS = {
  lineUpdate: [
    reservationReachable,
    reservationStationsOnRoute,
    reservationSegmentValid,
    // A line carries an isActive flag, so this endpoint can strand every ride
    // on the route as surely as moving its stops can.
    rideLineActive
  ],
  rideUpdate: [
    reservationReachable,
    reservationSeatWithinCapacity,
    instanceNotOverbooked,
    reservationStationsOnRoute,
    // A ride can be moved to another line, which is a route change for every
    // reservation on it: the stations may all still exist but in an order that
    // no longer describes the journey that was sold.
    reservationSegmentValid
  ],
  rideException: [reservationReachable],
  stationDeactivation: [routeStationsActive],
  passengerDeactivation: [reservationPassengerActive]
} satisfies Record<string, readonly ProspectiveInvariant[]>;

export interface ProspectiveWriteScope {
  tenantId: string;
  actorId: string;
}

/**
 * The caller's answer to a refusal it has already been shown.
 *
 * Two answers, not one flag with two meanings. `confirmed` is "write it and
 * leave the breakage for the integrity report"; `repair` is "write it and put
 * the affected reservations back in order, and refuse if you cannot". They are
 * separate because the second is a promise, and a promise that quietly
 * degrades into the first is the thing worth not building: an agency that
 * pressed a button saying the reservations would be fixed must not end up with
 * broken ones and no word about it.
 */
export interface ProspectiveWriteConsent {
  confirmed: boolean;
  repair: boolean;
}

/**
 * Applies a write tentatively, asks the existing invariants what changed, and
 * commits only when the proposed state adds no violations (or was confirmed,
 * or was repaired). Comparing against the baseline matters: old drift must stay
 * visible in the integrity report, but it must not make an unrelated edit
 * impossible.
 */
export async function guardProspectiveWrite<TResult>(
  prisma: PrismaService,
  scope: ProspectiveWriteScope,
  invariants: readonly ProspectiveInvariant[],
  consent: ProspectiveWriteConsent,
  write: (tx: Prisma.TransactionClient) => Promise<TResult>
): Promise<TResult> {
  return runSerializable(prisma, async (tx) => {
    // Nothing to compare, but still serializable: the callbacks do their own
    // read-then-write — an exception that must not already exist, a route read
    // to derive the next one from — and those need the isolation whether or
    // not an invariant is being measured. Only the two scans are skipped.
    //
    // A repair keeps the scans even when the write is confirmed: it cannot fix
    // what it has not measured.
    if (invariants.length === 0 || (consent.confirmed && !consent.repair)) {
      return write(tx);
    }

    const before = await checkInvariants(tx, scope, invariants);
    const result = await write(tx);
    const after = await checkInvariants(tx, scope, invariants);

    for (const invariant of invariants) {
      let added = addedViolations(before.get(invariant.key)!, after.get(invariant.key)!);

      if (added.length === 0) {
        continue;
      }

      if (consent.repair && isFullyRepairable(invariant, added)) {
        await invariant.repair!(invariantContext(tx, scope));

        // Re-checked rather than assumed. The repair decides seats against the
        // bus as it stands and declines whatever it cannot settle, so whether
        // it actually cleared these is a question only another scan answers —
        // and it runs on a fresh context, which is what keeps the repaired
        // rows from being served out of the window cache the first scan filled.
        const repaired = await checkInvariants(tx, scope, [invariant]);
        added = addedViolations(before.get(invariant.key)!, repaired.get(invariant.key)!);

        if (added.length === 0) {
          continue;
        }
      }

      if (consent.confirmed) {
        continue;
      }

      throw new ConflictException({
        code: 'WOULD_BREAK_RESERVATIONS',
        invariant: invariant.key,
        affectedCount: added.length,
        message: invariant.breakingChangeMessage(added.length),
        // Computed from what is left, so a repair that ran and fell short
        // cannot offer itself again on the way out.
        repairable: isFullyRepairable(invariant, added),
        ...(isFullyRepairable(invariant, added) && invariant.repairMessage
          ? { repairMessage: invariant.repairMessage(added.length) }
          : {})
      });
    }

    return result;
  });
}

/**
 * Whether running this invariant's repair would settle every one of these
 * violations. Partial repair is deliberately not offered: an agency told the
 * change would be fixed, and then left holding three broken reservations, is
 * worse off than one told plainly that this is a telephone call.
 */
function isFullyRepairable(
  invariant: ProspectiveInvariant,
  added: readonly Violation[]
): boolean {
  return (
    typeof invariant.repair === 'function' && added.every((violation) => violation.canRepair)
  );
}

/**
 * Violations the proposed state is answerable for: ones whose subject was
 * clean before, plus ones the write made worse on a subject that was already
 * broken. Without the second half, halving a bus that is already one seat over
 * capacity would compare equal to the baseline and go through unwarned.
 */
function addedViolations(before: Violation[], after: Violation[]): Violation[] {
  const baseline = new Map(before.map((violation) => [subjectOf(violation), violation]));

  return after.filter((violation) => {
    const previous = baseline.get(subjectOf(violation));

    if (!previous) {
      return true;
    }

    return (violation.magnitude ?? 0) > (previous.magnitude ?? 0);
  });
}

/**
 * Runs the guard at `Serializable`.
 *
 * `RepeatableRead` is not enough here. Lowering capacity to 20 and selling seat
 * 45 touch no common row, so both transactions commit happily and the invariant
 * this guard exists to protect is broken by the pair of them — the textbook
 * write skew, and a plausible Monday morning at a busy counter. Serializable
 * makes Postgres abort one of them instead; one retry covers the ordinary case,
 * and a second failure surfaces rather than looping.
 *
 * Note what this does not buy. Postgres only serializes against other
 * serializable transactions, and booking still runs at the default isolation
 * with its own advisory lock on the ride instance. So this closes the race
 * between two guarded writes, and leaves the one between a guarded write and a
 * concurrent booking open. Closing that means putting both sides on the same
 * protocol, which is a change to the booking path, not to this file.
 */
async function runSerializable<TResult>(
  prisma: PrismaService,
  work: (tx: Prisma.TransactionClient) => Promise<TResult>
): Promise<TResult> {
  const options = {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5_000,
    timeout: 30_000
  };

  try {
    return await prisma.$transaction(work, options);
  } catch (error) {
    if (!isSerializationFailure(error)) {
      throw error;
    }

    return prisma.$transaction(work, options);
  }
}

function isSerializationFailure(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2034' || error.code === 'P2028')
  );
}

/**
 * A context per pass, never shared between them: the checks cache the
 * reservation window against the context they were given, which is what makes
 * five of them share one load — and what would serve a second pass the rows the
 * first one read, write or repair notwithstanding.
 */
function invariantContext(
  prisma: Prisma.TransactionClient,
  scope: ProspectiveWriteScope
): InvariantContext {
  return {
    tenantId: scope.tenantId,
    actorId: scope.actorId,
    prisma,
    windowDays: PROSPECTIVE_WINDOW_DAYS
  };
}

async function checkInvariants(
  prisma: Prisma.TransactionClient,
  scope: ProspectiveWriteScope,
  invariants: readonly Invariant[]
): Promise<Map<string, Violation[]>> {
  const ctx = invariantContext(prisma, scope);
  const result = new Map<string, Violation[]>();

  for (const invariant of invariants) {
    result.set(invariant.key, (await invariant.check(ctx)).violations);
  }

  return result;
}

function subjectOf(violation: Violation): string {
  return `${violation.subjectType}:${violation.subjectId}`;
}
