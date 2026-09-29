import {
  DepartureField,
  StoredDeparture,
  planDepartureSync
} from '../../departures/departure-sync';
import { PlannedDeparture } from '../../departures/departure-generator';
import { CheckResult, Invariant, InvariantContext, Violation } from '../invariant.types';

/**
 * Stored future departures are exactly what the timetable produces.
 *
 * Departures are written in the shadow of the old read path (#27): nothing
 * reads them yet, so drift here costs nothing today and everything once
 * bookings are linked to them. This check has to stay clean in production
 * before the backfill (PR 2) links reservations.
 *
 * It asks the sync what it would write, from today to the end of the stored
 * window, and reports each difference. Past departures keep what they ran with
 * and `LEGACY` rows belong to the backfill, so neither is compared.
 *
 * Operator decisions are not compared (#27, PR 3a): a cancellation belongs
 * to whoever made it, and an extra bus is compared only on what its ride
 * decides — line, stops, and whether it is dropped. `departure.matchesExceptions`
 * compares the decisions with the exception rows that still mirror them.
 *
 * Reported, never repaired: every timetable write runs the sync, so a
 * difference means a write bypassed it or a nightly run failed. Each deserves
 * a look before anything is rewritten.
 */

export type DepartureMismatchReason =
  | 'MISSING'
  | 'NOT_IN_TIMETABLE'
  | 'FIELDS_DIFFER'
  | 'TIMEZONE_INVALID';

const FIELD_LABELS: Record<DepartureField, string> = {
  lineId: 'linija',
  departureTime: 'vreme polaska',
  arrivalTime: 'vreme dolaska',
  capacity: 'kapacitet',
  timetableDroppedAt: 'oznaka da je izbacen iz reda voznje',
  stops: 'stanice'
};

function missing(departure: PlannedDeparture): Violation {
  return {
    subjectType: 'ride-instance',
    subjectId: departure.key,
    summary: `Polazak ${departure.serviceDate} u ${departure.departureTime} postoji u redu voznje, ali nije sacuvan.`,
    detail: {
      reason: 'MISSING' satisfies DepartureMismatchReason,
      rideId: departure.rideId,
      serviceDate: departure.serviceDate,
      departureTime: departure.departureTime,
      source: departure.source
    },
    canRepair: false
  };
}

function leftOver(departure: StoredDeparture): Violation {
  return {
    subjectType: 'departure',
    subjectId: departure.id,
    summary: `Polazak ${departure.serviceDate} u ${departure.departureTime} je sacuvan, ali ga red voznje vise ne sadrzi.`,
    detail: {
      reason: 'NOT_IN_TIMETABLE' satisfies DepartureMismatchReason,
      rideId: departure.rideId,
      serviceDate: departure.serviceDate,
      departureTime: departure.departureTime,
      source: departure.source,
      referenceCount: departure.referenceCount
    },
    canRepair: false
  };
}

function differs(stored: StoredDeparture, fields: readonly DepartureField[]): Violation {
  return {
    subjectType: 'departure',
    subjectId: stored.id,
    magnitude: fields.length,
    summary: `Polazak ${stored.serviceDate} u ${stored.departureTime} se razlikuje od reda voznje: ${fields
      .map((field) => FIELD_LABELS[field])
      .join(', ')}.`,
    detail: {
      reason: 'FIELDS_DIFFER' satisfies DepartureMismatchReason,
      rideId: stored.rideId,
      serviceDate: stored.serviceDate,
      source: stored.source,
      fields
    },
    canRepair: false
  };
}

export const departureMatchesTimetable: Invariant = {
  key: 'departure.matchesTimetable',
  title: 'Sacuvani polasci odgovaraju redu voznje',
  description:
    'Polasci se cuvaju uz red voznje i uskoro ce rezervacije pokazivati na njih. Polazak koji nedostaje, visak ili polazak sa starim vremenom znacio bi da putnik vidi drugaciji autobus od onog koji saobraca.',
  manualAdvice:
    'Svaka izmena reda voznje sama uskladjuje polaske. Razlika znaci da ga je nesto zaobislo ili da nocno dodavanje polazaka nije uspelo. Prijavite je podrsci pre nego sto menjate red voznje.',
  severity: 'warning',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const plan = await planDepartureSync(ctx.prisma, ctx.tenantId);
    const violations: Violation[] = [
      // The newest day enters the window at the agency's midnight and is
      // stored by the nightly job at 02:00. A run in between is not drift; if
      // the job fails, the day is reported from tomorrow's run.
      ...plan.creates.filter((departure) => departure.serviceDate < plan.window.to).map(missing),
      ...[...plan.drops, ...plan.deletes].map(leftOver),
      ...plan.updates.map((update) => differs(update.stored, update.fields))
    ];

    if (plan.timezoneInvalid) {
      violations.push({
        subjectType: 'system',
        subjectId: ctx.tenantId,
        summary: `Vremenska zona agencije "${plan.configuredTimezone}" nije ispravna, pa se datumi racunaju po zoni ${plan.timezone}.`,
        detail: {
          reason: 'TIMEZONE_INVALID' satisfies DepartureMismatchReason,
          configuredTimezone: plan.configuredTimezone,
          fallbackTimezone: plan.timezone
        },
        canRepair: false
      });
    }

    return { violations, scannedCount: plan.plannedCount };
  }
};
