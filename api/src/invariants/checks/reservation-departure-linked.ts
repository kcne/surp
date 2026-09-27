import { Prisma, ReservationStatus } from '@prisma/client';
import { departureWindow, resolveAgencyTimezone } from '../../departures/agency-date';
import {
  LINKABLE_SOURCES,
  indexLinkableDepartures,
  uniqueDepartureMatch
} from '../../departures/departure-link';
import { formatDateOnly, utcDateOf } from '../../rides/ride-instance-materialization';
import { CheckResult, Invariant, InvariantContext, Violation } from '../invariant.types';

/**
 * Every future active reservation points at the departure it is on (#27).
 *
 * Bookings link themselves since PR 1b, by the rule in `departure-link.ts`.
 * Nothing reads the link yet, which is why this is a warning; PR 3 moves seats
 * and locking onto it and makes it critical. PR 3 also needs this check to
 * report no unlinked reservations at all.
 *
 * It looks at active reservations from the agency's date to the end of the
 * stored departure window, and reports:
 * - a link whose time copy uniquely matches a different departure: the link
 *   names the wrong bus. A copy that matches nothing is only stale, and
 *   `reservation.reachable` already reports and repairs it;
 * - a link to a departure that is not running: its passengers are still
 *   active and somebody has to call them;
 * - an unlinked reservation booked after linking went live, either with a
 *   unique match (a writer skipped the link) or without one (an extra at the
 *   same time, a stale time, or no stored departure).
 *
 * Reservations booked before linking went live are the backfill's (PR 2), and
 * would otherwise fill Settings with a few hundred warnings nobody can act on.
 * PR 2 removes the cutoff.
 *
 * Reported, never repaired: repairs ship after the checks that justify them.
 */

/** When #27 PR 1b is deployed. Bookings made before this carry no link. */
export const DEPARTURE_LINK_REQUIRED_FROM = new Date('2026-09-28T22:00:00.000Z');

export type DepartureLinkReason =
  | 'WRONG_LINK'
  | 'NOT_RUNNING'
  | 'LINKABLE_UNLINKED'
  | 'NO_UNIQUE_MATCH';

const RESERVATION_SELECT = {
  id: true,
  rideId: true,
  travelDate: true,
  rideDepartureTime: true,
  departureId: true,
  createdAt: true,
  passenger: { select: { firstName: true, lastName: true } },
  departure: {
    select: { timetableDroppedAt: true, cancelledAt: true }
  }
} as const;

type LinkedReservation = Prisma.ReservationGetPayload<{ select: typeof RESERVATION_SELECT }>;

async function load(
  db: InvariantContext['prisma'],
  tenantId: string
): Promise<{
  reservations: LinkedReservation[];
  departures: Array<{ id: string; rideId: string; serviceDate: Date; departureTime: string }>;
}> {
  // Given a root client, both reads share one snapshot, so a sync committing
  // between them cannot make an unlinked booking look linkable.
  if ('$transaction' in db) {
    return db.$transaction((tx) => load(tx, tenantId), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 5_000,
      timeout: 30_000
    });
  }

  const tenant = await db.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { timezone: true }
  });
  const window = departureWindow(new Date(), resolveAgencyTimezone(tenant.timezone).timezone);
  const serviceDate = { gte: utcDateOf(window.from), lte: utcDateOf(window.to) };

  const [reservations, departures] = await Promise.all([
    db.reservation.findMany({
      where: { tenantId, status: ReservationStatus.ACTIVE, travelDate: serviceDate },
      select: RESERVATION_SELECT,
      orderBy: [{ travelDate: 'asc' }, { rideDepartureTime: 'asc' }, { id: 'asc' }]
    }),
    db.departure.findMany({
      where: { tenantId, serviceDate, source: { in: [...LINKABLE_SOURCES] } },
      select: { id: true, rideId: true, serviceDate: true, departureTime: true }
    })
  ]);

  return { reservations, departures };
}

function violation(
  reservation: LinkedReservation,
  reason: DepartureLinkReason,
  sentence: string,
  extra: Record<string, unknown> = {}
): Violation {
  const passenger = `${reservation.passenger.firstName} ${reservation.passenger.lastName}`;
  const travelDate = formatDateOnly(reservation.travelDate);

  return {
    subjectType: 'reservation',
    subjectId: reservation.id,
    summary: `${passenger}, ${travelDate}, polazak ${reservation.rideDepartureTime}: ${sentence}`,
    detail: {
      reason,
      rideId: reservation.rideId,
      travelDate,
      rideDepartureTime: reservation.rideDepartureTime,
      departureId: reservation.departureId,
      ...extra
    },
    canRepair: false
  };
}

export function classifyDepartureLinks(
  reservations: readonly LinkedReservation[],
  index: ReadonlyMap<string, string | null>,
  requiredFrom: Date = DEPARTURE_LINK_REQUIRED_FROM
): Violation[] {
  const violations: Violation[] = [];

  for (const reservation of reservations) {
    const match = uniqueDepartureMatch(
      index,
      reservation.rideId,
      reservation.travelDate,
      reservation.rideDepartureTime
    );

    if (reservation.departureId && reservation.departure) {
      if (match && match !== reservation.departureId) {
        violations.push(
          violation(
            reservation,
            'WRONG_LINK',
            'rezervacija je vezana za drugi autobus od onog koji odgovara njenom vremenu polaska.',
            { matchingDepartureId: match }
          )
        );
        continue;
      }

      const { cancelledAt, timetableDroppedAt } = reservation.departure;

      if (cancelledAt || timetableDroppedAt) {
        violations.push(
          violation(
            reservation,
            'NOT_RUNNING',
            cancelledAt
              ? 'polazak je otkazan, a rezervacija je i dalje aktivna.'
              : 'polazak je izbacen iz reda voznje, a rezervacija je i dalje aktivna.',
            { cancelled: Boolean(cancelledAt), timetableDropped: Boolean(timetableDroppedAt) }
          )
        );
      }
      continue;
    }

    if (reservation.createdAt < requiredFrom) {
      continue;
    }

    violations.push(
      match
        ? violation(
            reservation,
            'LINKABLE_UNLINKED',
            'rezervacija nije vezana za polazak, iako tacno jedan polazak odgovara njenom vremenu.',
            { matchingDepartureId: match }
          )
        : violation(
            reservation,
            'NO_UNIQUE_MATCH',
            'rezervacija nije vezana za polazak, jer njenom vremenu ne odgovara tacno jedan polazak.'
          )
    );
  }

  return violations;
}

export const reservationDepartureLinked: Invariant = {
  key: 'reservation.departureLinked',
  title: 'Rezervacija je vezana za svoj polazak',
  description:
    'Svaka rezervacija treba da pokazuje na tacno jedan sacuvan polazak. Uskoro ce se sedista brojati po tom polasku, pa bi rezervacija vezana za pogresan autobus ili bez polaska znacila pogresan broj slobodnih mesta.',
  manualAdvice:
    'Ako je polazak otkazan ili izbacen iz reda voznje, pozovite putnika i ponudite drugi termin ili otkazite rezervaciju. Ostale razlike prijavite podrsci: rezervacija radi kao i do sada, ali je treba vezati za pravi polazak pre sledece izmene sistema.',
  severity: 'warning',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const { reservations, departures } = await load(ctx.prisma, ctx.tenantId);

    return {
      violations: classifyDepartureLinks(reservations, indexLinkableDepartures(departures)),
      scannedCount: reservations.length
    };
  }
};
