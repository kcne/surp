import { ReservationStatus } from '@prisma/client';
import { formatDateOnly } from '../rides/ride-instance-materialization';
import type { ReturnLegBackfillAmbiguity } from './reservation-return-leg-backfill';

/**
 * Turns the return-leg backfill's ambiguity report into something a person can
 * act on.
 *
 * The report carries reservation ids and nothing else, which is right for a
 * machine and useless to the agency: deciding which outbound leg a return
 * belongs to needs the passenger, the departure and the seat in front of you.
 *
 * Two things make the list far shorter than its row count suggests.
 *
 * Several return legs competing for the same outbound legs is **one** decision,
 * not one per row — a party of six booked together produces six rows with an
 * identical candidate set. Grouping on that set is what turns 48 rows into 28
 * questions.
 *
 * And a pair whose every leg has already travelled is not actionable. Nobody
 * phones a passenger about a journey that finished in August, and the check
 * that watches these pairs windows forward from today, so a past pair could
 * never reach the page anyway. They are filtered out by default and kept
 * behind a flag rather than dropped, because they are still real round trips —
 * unactionable is not the same as unrelated.
 */

export interface AmbiguityReviewRow {
  id: string;
  travelDate: Date;
  rideDepartureTime: string;
  seatNumber: number;
  status: ReservationStatus;
  /** Set when this leg already belongs to a pair, which is why it is unavailable. */
  returnOfReservationId: string | null;
  passengerName: string;
  passengerPhone: string;
  lineName: string;
  departureStationName: string;
  arrivalStationName: string;
}

export interface AmbiguityDecision {
  reason: string;
  /** The return legs waiting on this decision. */
  returnLegIds: string[];
  /** The outbound legs they could belong to. */
  candidateReservationIds: string[];
  /** True when every leg involved has already travelled. */
  entirelyPast: boolean;
}

/**
 * Groups the report's rows into decisions, newest question first.
 *
 * Rows whose referenced reservations are missing from `rowsById` keep their
 * place: a decision that cannot be rendered is still a decision, and silently
 * dropping it would understate the review.
 */
export function groupAmbiguities(
  ambiguous: readonly ReturnLegBackfillAmbiguity[],
  rowsById: ReadonlyMap<string, AmbiguityReviewRow>,
  today: Date
): AmbiguityDecision[] {
  const byCandidateSet = new Map<string, AmbiguityDecision>();

  for (const entry of ambiguous) {
    const key = [...entry.candidateReservationIds].sort().join(',');
    const existing = byCandidateSet.get(key);

    if (existing) {
      existing.returnLegIds.push(entry.reservationId);
      continue;
    }

    byCandidateSet.set(key, {
      reason: entry.reason,
      returnLegIds: [entry.reservationId],
      candidateReservationIds: [...entry.candidateReservationIds],
      entirelyPast: false
    });
  }

  const decisions = [...byCandidateSet.values()];

  for (const decision of decisions) {
    decision.entirelyPast = isEntirelyPast(decision, rowsById, today);
  }

  return decisions.sort((left, right) => right.returnLegIds.length - left.returnLegIds.length);
}

/**
 * A decision is past only when every leg it touches has travelled. One leg
 * still ahead makes the whole question live, which is the same rule the pair
 * check uses when it pulls both ends of a pair into its window.
 */
export function isEntirelyPast(
  decision: AmbiguityDecision,
  rowsById: ReadonlyMap<string, AmbiguityReviewRow>,
  today: Date
): boolean {
  const ids = [...decision.returnLegIds, ...decision.candidateReservationIds];

  // A leg that did not resolve has no date, so nothing can be concluded about
  // it — and concluding "past" from the legs that happen to be present would
  // hide the decision from the only person able to answer it. Every id must
  // resolve and every one of them must have travelled.
  return (
    ids.length > 0 &&
    ids.every((id) => {
      const leg = rowsById.get(id);

      return leg !== undefined && leg.travelDate < today;
    })
  );
}

function describe(row: AmbiguityReviewRow): string {
  return (
    `${row.passengerName} (${row.passengerPhone}) | ` +
    `${formatDateOnly(row.travelDate)} ${row.rideDepartureTime} | ` +
    `sediste ${row.seatNumber} | ${row.status} | ` +
    `${row.lineName} | ${row.departureStationName} -> ${row.arrivalStationName}`
  );
}

export interface ReviewSheetOptions {
  includePast: boolean;
  sourcePath: string;
}

export function formatReviewSheet(
  decisions: readonly AmbiguityDecision[],
  rowsById: ReadonlyMap<string, AmbiguityReviewRow>,
  { includePast, sourcePath }: ReviewSheetOptions
): string {
  const shown = includePast ? decisions : decisions.filter((entry) => !entry.entirelyPast);
  const hidden = decisions.length - shown.length;
  const rowCount = shown.reduce((total, entry) => total + entry.returnLegIds.length, 0);

  const lines: string[] = [
    `Ambiguous return legs: ${rowCount} row(s) in ${shown.length} decision(s)`,
    `Source: ${sourcePath}`
  ];

  if (hidden > 0) {
    lines.push(
      `Hidden: ${hidden} decision(s) where every leg has already travelled. ` +
        `Set INCLUDE_PAST=1 to list them.`
    );
  }

  lines.push('');

  shown.forEach((decision, index) => {
    lines.push(
      `-- Decision ${index + 1}/${shown.length}  (${decision.reason})  ` +
        `${decision.returnLegIds.length} return leg(s), ` +
        `${decision.candidateReservationIds.length} candidate outbound(s)` +
        (decision.entirelyPast ? '  [already travelled]' : '')
    );

    lines.push('  RETURN LEG(S) needing an outbound:');
    for (const id of decision.returnLegIds) {
      const row = rowsById.get(id);
      lines.push(`    * ${row ? describe(row) : 'reservation not found'}`);
      lines.push(`      id=${id}`);
    }

    lines.push('  CANDIDATE OUTBOUND(S):');
    for (const id of decision.candidateReservationIds) {
      const row = rowsById.get(id);
      lines.push(`    - ${row ? describe(row) : 'reservation not found'}`);
      lines.push(
        `      id=${id}` +
          (row?.returnOfReservationId ? `  ALREADY LINKED to ${row.returnOfReservationId}` : '')
      );
    }

    lines.push('');
  });

  return `${lines.join('\n')}\n`;
}
