import { DepartureSource, Prisma, ReservationStatus } from '@prisma/client';
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
 * Bookings link themselves since PR 1b, by the rule in `departure-link.ts`,
 * and `departures:backfill` (PR 2) linked the ones booked before. Since PR 3b
 * seats are counted and locked on the link, so a missing or wrong one is a
 * wrong count of free seats, and this is critical.
 *
 * It looks at active reservations from the agency's date to the end of the
 * stored departure window, and reports:
 * - a link to a `LEGACY` departure: those record sales the timetable no longer
 *   produces, and only past or cancelled reservations belong on one;
 * - a link whose time copy uniquely matches a different departure: the link
 *   names the wrong bus;
 * - a link whose time copy matches neither its departure nor any other: the
 *   sync keeps a linked row's copies in step with its departure, so only a
 *   write that bypassed it leaves one, and old tabs still find a passenger
 *   by that copy;
 * - an unlinked reservation, either with a unique match (a writer skipped the
 *   link, or the backfill has not run) or without one (two buses at the same
 *   time, a stale time, or no stored departure).
 *
 * A link to a departure that does not run is not wrong, and is listed by
 * `reservation.reachable` since PR 3b: its passengers still need a call, and
 * that check is the one a timetable edit is asked about.
 *
 * Reported, never repaired: repairs ship after the checks that justify them.
 */

export type DepartureLinkReason =
  | 'ON_LEGACY'
  | 'WRONG_LINK'
  | 'STALE_TIME_COPY'
  | 'LINKABLE_UNLINKED'
  | 'NO_UNIQUE_MATCH';

const RESERVATION_SELECT = {
  id: true,
  rideId: true,
  travelDate: true,
  rideDepartureTime: true,
  departureId: true,
  passenger: { select: { firstName: true, lastName: true } },
  departure: { select: { source: true, departureTime: true } }
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
  index: ReadonlyMap<string, string | null>
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
      // Before the time comparison: the index holds no LEGACY rows, so a
      // LEGACY link whose time a timetable bus shares would read as the wrong
      // bus, and the wrong advice.
      if (reservation.departure.source === DepartureSource.LEGACY) {
        violations.push(
          violation(
            reservation,
            'ON_LEGACY',
            'rezervacija je aktivna, a vezana je za polazak koji red voznje vise ne pravi.'
          )
        );
        continue;
      }

      if (match && match !== reservation.departureId) {
        violations.push(
          violation(
            reservation,
            'WRONG_LINK',
            'rezervacija je vezana za drugi autobus od onog koji odgovara njenom vremenu polaska.',
            { matchingDepartureId: match }
          )
        );
      } else if (reservation.departure.departureTime !== reservation.rideDepartureTime) {
        violations.push(
          violation(
            reservation,
            'STALE_TIME_COPY',
            `rezervacija nosi drugo vreme polaska od svog polaska (${reservation.departure.departureTime}), pa se ne vidi na spisku putnika.`,
            { departureTime: reservation.departure.departureTime }
          )
        );
      }
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
    'Svaka rezervacija treba da pokazuje na tacno jedan sacuvan polazak. Sedista se broje po tom polasku, pa rezervacija vezana za pogresan autobus ili bez polaska znaci pogresan broj slobodnih mesta.',
  manualAdvice:
    'Ako vreme polaska rezervacije vise ne postoji u redu voznje, pokrenite popravku provere "Rezervacija se vidi na svom polasku" ili otkazite rezervaciju. Ako u isto vreme polaze dva autobusa, javite podrsci koji autobus putnik koristi. Ako rezervacija nosi drugo vreme od svog polaska, javite podrsci. Ostale razlike prijavite podrsci: dok rezervacija nije vezana za pravi polazak, njeno sediste se ne broji na tom autobusu i ne moze da se menja.',
  severity: 'critical',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const { reservations, departures } = await load(ctx.prisma, ctx.tenantId);

    return {
      violations: classifyDepartureLinks(reservations, indexLinkableDepartures(departures)),
      scannedCount: reservations.length
    };
  }
};
