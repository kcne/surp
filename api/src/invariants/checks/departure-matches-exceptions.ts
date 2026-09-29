import { DepartureSource, Prisma, RideExceptionType } from '@prisma/client';
import { departureWindow, resolveAgencyTimezone } from '../../departures/agency-date';
import { scheduleKey } from '../../departures/departure-generator';
import { formatDateOnly, utcDateOf } from '../../rides/ride-instance-materialization';
import { CheckResult, Invariant, InvariantContext, Violation } from '../invariant.types';

/**
 * Operator decisions on departures agree with the exception rows that still
 * mirror them (#27, PR 3a, until PR 6).
 *
 * From PR 3a a cancelled date or an extra bus lives on the departure, and the
 * exception endpoints write both halves in one transaction. `/rides/instances`
 * and the ride screen still read the exception rows, so a write that records
 * only one half shows the operator one thing and the departures another.
 *
 * From the agency's today to the end of the stored window, it reports:
 * - a SKIP whose timetable departure is stored but not cancelled;
 * - a cancelled timetable departure with no SKIP;
 * - an ADDITIONAL with no extra bus, or whose extra has other times;
 *
 * A SKIP on a date with no timetable departure stored is not a mismatch: the
 * sync applies it when it creates the departure. An ADDITIONAL with no extra
 * is, until the next timetable write or nightly run inserts it.
 * - an extra bus with no ADDITIONAL that is not cancelled;
 * - a cancelled extra bus that still has its ADDITIONAL.
 *
 * Reported, never repaired: which half is right is the operator's call.
 */

export type ExceptionMismatchReason =
  | 'SKIP_NOT_APPLIED'
  | 'CANCELLED_WITHOUT_SKIP'
  | 'ADDITIONAL_NOT_APPLIED'
  | 'EXTRA_WITHOUT_ADDITIONAL'
  | 'CANCELLED_EXTRA_HAS_ADDITIONAL';

interface Loaded {
  exceptions: Array<{
    id: string;
    rideId: string;
    exceptionDate: Date;
    type: RideExceptionType;
    departureTime: string | null;
    arrivalTime: string | null;
  }>;
  departures: Array<{
    id: string;
    rideId: string;
    serviceDate: Date;
    source: DepartureSource;
    departureTime: string;
    arrivalTime: string;
    cancelledAt: Date | null;
    rideExceptionId: string | null;
  }>;
}

async function load(db: InvariantContext['prisma'], tenantId: string): Promise<Loaded> {
  // Given a root client, both reads share one snapshot, so an exception
  // endpoint committing between them cannot look like half a decision.
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
  const range = { gte: utcDateOf(window.from), lte: utcDateOf(window.to) };
  const [exceptions, departures] = await Promise.all([
    db.rideException.findMany({
      where: { tenantId, exceptionDate: range },
      select: {
        id: true,
        rideId: true,
        exceptionDate: true,
        type: true,
        departureTime: true,
        arrivalTime: true
      },
      orderBy: [{ exceptionDate: 'asc' }, { id: 'asc' }]
    }),
    db.departure.findMany({
      where: {
        tenantId,
        serviceDate: range,
        source: { in: [DepartureSource.SCHEDULE, DepartureSource.EXTRA] }
      },
      select: {
        id: true,
        rideId: true,
        serviceDate: true,
        source: true,
        departureTime: true,
        arrivalTime: true,
        cancelledAt: true,
        rideExceptionId: true
      },
      orderBy: [{ serviceDate: 'asc' }, { id: 'asc' }]
    })
  ]);

  return { exceptions, departures };
}

function violation(
  subjectType: Violation['subjectType'],
  subjectId: string,
  reason: ExceptionMismatchReason,
  summary: string,
  detail: Record<string, unknown>
): Violation {
  return { subjectType, subjectId, summary, detail: { reason, ...detail }, canRepair: false };
}

export function findExceptionMismatches({ exceptions, departures }: Loaded): Violation[] {
  const violations: Violation[] = [];
  const rideDate = (rideId: string, date: Date) => `${rideId}:${formatDateOnly(date)}`;
  const scheduled = new Map(
    departures
      .filter((departure) => departure.source === DepartureSource.SCHEDULE)
      .map((departure) => [rideDate(departure.rideId, departure.serviceDate), departure])
  );
  const extrasByException = new Map(
    departures
      .filter(
        (departure) => departure.source === DepartureSource.EXTRA && departure.rideExceptionId
      )
      .map((departure) => [departure.rideExceptionId!, departure])
  );
  const skipped = new Set<string>();
  const additionalIds = new Set<string>();

  for (const exception of exceptions) {
    const date = formatDateOnly(exception.exceptionDate)!;

    if (exception.type === RideExceptionType.SKIP) {
      const key = rideDate(exception.rideId, exception.exceptionDate);
      const departure = scheduled.get(key);
      skipped.add(key);

      if (departure && !departure.cancelledAt) {
        violations.push(
          violation(
            'ride-instance',
            scheduleKey(exception.rideId, date),
            'SKIP_NOT_APPLIED',
            `Voznja je otkazana za ${date}, ali polazak u ${departure.departureTime} nije oznacen kao otkazan.`,
            {
              rideId: exception.rideId,
              serviceDate: date,
              rideExceptionId: exception.id,
              departureId: departure.id
            }
          )
        );
      }

      continue;
    }

    // An ADDITIONAL without both times never produced a bus.
    if (!exception.departureTime || !exception.arrivalTime) {
      continue;
    }

    additionalIds.add(exception.id);
    const extra = extrasByException.get(exception.id);

    if (
      !extra ||
      extra.departureTime !== exception.departureTime ||
      extra.arrivalTime !== exception.arrivalTime
    ) {
      violations.push(
        violation(
          'ride-instance',
          `additional:${exception.id}`,
          'ADDITIONAL_NOT_APPLIED',
          extra
            ? `Dodatni polazak ${date} je u ${extra.departureTime}-${extra.arrivalTime}, a izuzetak kaze ${exception.departureTime}-${exception.arrivalTime}.`
            : `Dodatni polazak ${date} u ${exception.departureTime} postoji kao izuzetak, ali nije sacuvan kao polazak.`,
          {
            rideId: exception.rideId,
            serviceDate: date,
            rideExceptionId: exception.id,
            departureId: extra?.id ?? null
          }
        )
      );
    }
  }

  for (const departure of departures) {
    const date = formatDateOnly(departure.serviceDate)!;
    const detail = {
      rideId: departure.rideId,
      serviceDate: date,
      departureTime: departure.departureTime
    };

    if (departure.source === DepartureSource.SCHEDULE) {
      if (
        departure.cancelledAt &&
        !skipped.has(rideDate(departure.rideId, departure.serviceDate))
      ) {
        violations.push(
          violation(
            'departure',
            departure.id,
            'CANCELLED_WITHOUT_SKIP',
            `Polazak ${date} u ${departure.departureTime} je otkazan, ali voznja za taj dan nije oznacena kao otkazana.`,
            detail
          )
        );
      }

      continue;
    }

    const hasAdditional =
      departure.rideExceptionId !== null && additionalIds.has(departure.rideExceptionId);

    if (!departure.cancelledAt && !hasAdditional) {
      violations.push(
        violation(
          'departure',
          departure.id,
          'EXTRA_WITHOUT_ADDITIONAL',
          `Dodatni polazak ${date} u ${departure.departureTime} nema izuzetak iz kog je nastao, a nije otkazan.`,
          detail
        )
      );
    } else if (departure.cancelledAt && hasAdditional) {
      violations.push(
        violation(
          'departure',
          departure.id,
          'CANCELLED_EXTRA_HAS_ADDITIONAL',
          `Dodatni polazak ${date} u ${departure.departureTime} je otkazan, ali njegov izuzetak jos postoji.`,
          { ...detail, rideExceptionId: departure.rideExceptionId }
        )
      );
    }
  }

  return violations;
}

export const departureMatchesExceptions: Invariant = {
  key: 'departure.matchesExceptions',
  title: 'Otkazani i dodatni polasci odgovaraju izuzecima voznji',
  description:
    'Otkazivanje i dodatni polazak cuvaju se na polasku i, do daljnjeg, kao izuzetak voznje. Ekran voznje cita izuzetke, a rezervacije polaske, pa neslaganje znaci da osoblje vidi jedan autobus, a sistem racuna sa drugim.',
  manualAdvice:
    'Izuzetke dodajte i uklanjajte samo sa ekrana voznje, koji menja oba zapisa zajedno. Neslaganje prijavite podrsci pre nego sto menjate izuzetak.',
  severity: 'warning',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const loaded = await load(ctx.prisma, ctx.tenantId);

    return {
      violations: findExceptionMismatches(loaded),
      scannedCount: loaded.exceptions.length + loaded.departures.length
    };
  }
};
