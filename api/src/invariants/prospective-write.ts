import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { scheduleEditTransaction } from '../prisma/schedule-lock';
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
 * The caller's answers to refusals it has already been shown.
 *
 * Each answer is the `confirmationToken` of the refusal it answers, so it
 * permits exactly the violations the operator was shown and nothing that
 * appeared since. A token in `confirmationTokens` permits those violations to
 * stand; one in `repairTokens` asks for them to be repaired. One request can
 * carry answers to several refusals when separate invariants raised separate
 * questions. A failed requested repair still refuses the whole write.
 */
export interface ProspectiveWriteConsent {
  confirmationTokens: readonly string[];
  repairTokens: readonly string[];
}

export const NO_CONSENT: ProspectiveWriteConsent = { confirmationTokens: [], repairTokens: [] };

/**
 * Applies a write tentatively, asks the existing invariants what changed, and
 * commits only when the proposed state adds no violations (or the operator
 * confirmed or repaired exactly those). Comparing against the baseline matters:
 * old drift must stay visible in the integrity report, but it must not make an
 * unrelated edit impossible.
 *
 * The whole guard runs under the tenant's exclusive schedule lock, so no
 * booking is in flight while it measures and none starts until it commits.
 */
export async function guardProspectiveWrite<TResult, TPrepared = void>(
  prisma: PrismaService,
  scope: ProspectiveWriteScope,
  invariants: readonly ProspectiveInvariant[],
  consent: ProspectiveWriteConsent,
  write: (tx: Prisma.TransactionClient, prepared: TPrepared) => Promise<TResult>,
  /** Read and validate the proposed write before scanning the tenant. */
  prepare?: (tx: Prisma.TransactionClient) => Promise<TPrepared>
): Promise<TResult> {
  return scheduleEditTransaction(prisma, scope.tenantId, async (tx) => {
    // Cheap existence and payload validation can run before the tenant-wide
    // baseline scan while still reading the state this transaction will write.
    const prepared = prepare ? await prepare(tx) : (undefined as TPrepared);

    // A confirmation does not skip the scans. What the operator agreed to is
    // the set of violations they were shown; only measuring again can tell
    // whether that is still the set this write would leave behind.
    if (invariants.length === 0) {
      return write(tx, prepared);
    }

    const before = await checkInvariants(tx, scope, invariants);
    const result = await write(tx, prepared);
    let afterContext = invariantContext(tx, scope);
    let after = await checkInvariants(tx, scope, invariants, afterContext);

    for (const invariant of invariants) {
      let added = addedViolations(before.get(invariant.key)!, after.get(invariant.key)!);

      if (added.length === 0) {
        continue;
      }

      const token = confirmationTokenFor(invariant, added);

      if (invariant.assessRepair) {
        const assessed = await invariant.assessRepair(
          afterContext,
          new Set(added.map((violation) => violation.subjectId))
        );
        const assessedBySubject = new Map(
          assessed.violations.map((violation) => [subjectOf(violation), violation])
        );
        added = added.map((violation) => assessedBySubject.get(subjectOf(violation)) ?? violation);
      }

      if (consent.repairTokens.includes(token) && invariant.repair) {
        if (!isFullyRepairable(invariant, added)) {
          throw breakingChange(invariant, added, token, false);
        }

        const shown = added;

        await invariant.repair(
          // Nothing has written since the post-write scan, so its cached
          // window is still the state the repair must plan against.
          afterContext,
          new Set(added.map((violation) => violation.subjectId))
        );

        // Refresh every invariant: making a reservation reachable can also
        // change what the seat and segment checks see. This pass gets a fresh
        // context, so the window cache cannot serve pre-repair rows.
        afterContext = invariantContext(tx, scope);
        after = await checkInvariants(tx, scope, invariants, afterContext);
        added = addedViolations(before.get(invariant.key)!, after.get(invariant.key)!);

        if (added.length > 0) {
          // What is left to decide is whether to save without the repair, so
          // the refusal describes that: the violations as first measured, and
          // the token that confirms them.
          throw breakingChange(invariant, shown, token, false);
        }

        continue;
      }

      if (consent.confirmationTokens.includes(token)) {
        continue;
      }

      throw breakingChange(invariant, added, token);
    }

    return result;
  });
}

function breakingChange(
  invariant: ProspectiveInvariant,
  added: readonly Violation[],
  confirmationToken: string,
  repairable = isFullyRepairable(invariant, added)
): ConflictException {
  return new ConflictException({
    code: 'WOULD_BREAK_RESERVATIONS',
    invariant: invariant.key,
    affectedCount: added.length,
    confirmationToken,
    message: invariant.breakingChangeMessage(added.length),
    repairable,
    ...(repairable && invariant.repairMessage
      ? { repairMessage: invariant.repairMessage(added.length) }
      : {})
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
 * Binds an answer to the refusal it was given for.
 *
 * A digest of the invariant and of each added violation's subject and
 * magnitude — what the operator was shown, and nothing about how it was
 * worded. When a booking lands between the refusal and the answer and changes
 * that set, the answer no longer matches and the operator is asked again, so
 * the count confirmed is always the count written.
 */
export function confirmationTokenFor(
  invariant: Pick<ProspectiveInvariant, 'key'>,
  added: readonly Violation[]
): string {
  const subjects = added
    .map((violation) => [subjectOf(violation), violation.magnitude ?? null] as const)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));

  return createHash('sha256')
    .update(JSON.stringify([invariant.key, subjects]))
    .digest('hex');
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
  invariants: readonly Invariant[],
  ctx = invariantContext(prisma, scope)
): Promise<Map<string, Violation[]>> {
  const result = new Map<string, Violation[]>();

  for (const invariant of invariants) {
    result.set(invariant.key, (await invariant.check(ctx)).violations);
  }

  return result;
}

function subjectOf(violation: Violation): string {
  return `${violation.subjectType}:${violation.subjectId}`;
}
