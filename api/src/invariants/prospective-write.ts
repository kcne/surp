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
 * Applies a write tentatively, asks the existing invariants what changed, and
 * commits only when the proposed state adds no violations (or was confirmed).
 * Comparing against the baseline matters: old drift must stay visible in the
 * integrity report, but it must not make an unrelated edit impossible.
 */
export async function guardProspectiveWrite<TResult>(
  prisma: PrismaService,
  scope: ProspectiveWriteScope,
  invariants: readonly ProspectiveInvariant[],
  confirmed: boolean,
  write: (tx: Prisma.TransactionClient) => Promise<TResult>
): Promise<TResult> {
  return runSerializable(prisma, async (tx) => {
    // Nothing to compare, but still serializable: the callbacks do their own
    // read-then-write — an exception that must not already exist, a route read
    // to derive the next one from — and those need the isolation whether or
    // not an invariant is being measured. Only the two scans are skipped.
    if (confirmed || invariants.length === 0) {
      return write(tx);
    }

    const before = await checkInvariants(tx, scope, invariants);
    const result = await write(tx);
    const after = await checkInvariants(tx, scope, invariants);

    for (const invariant of invariants) {
      const added = addedViolations(before.get(invariant.key)!, after.get(invariant.key)!);

      if (added.length > 0) {
        throw new ConflictException({
          code: 'WOULD_BREAK_RESERVATIONS',
          invariant: invariant.key,
          affectedCount: added.length,
          message: invariant.breakingChangeMessage(added.length)
        });
      }
    }

    return result;
  });
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

async function checkInvariants(
  prisma: Prisma.TransactionClient,
  scope: ProspectiveWriteScope,
  invariants: readonly Invariant[]
): Promise<Map<string, Violation[]>> {
  const ctx: InvariantContext = {
    tenantId: scope.tenantId,
    actorId: scope.actorId,
    prisma,
    // A context per pass, which is also what makes the checks share one load of
    // the reservation window rather than taking five identical ones.
    windowDays: PROSPECTIVE_WINDOW_DAYS
  };
  const result = new Map<string, Violation[]>();

  for (const invariant of invariants) {
    result.set(invariant.key, (await invariant.check(ctx)).violations);
  }

  return result;
}

function subjectOf(violation: Violation): string {
  return `${violation.subjectType}:${violation.subjectId}`;
}
