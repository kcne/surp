import {
  AmbiguityReviewRow,
  formatReviewSheet,
  groupAmbiguities
} from './return-leg-ambiguity-review';
import type { ReturnLegBackfillAmbiguity } from './reservation-return-leg-backfill';

const TODAY = new Date('2026-09-22T00:00:00.000Z');

const row = (overrides: Partial<AmbiguityReviewRow> & { id: string }): AmbiguityReviewRow => ({
  travelDate: new Date('2026-10-01T00:00:00.000Z'),
  rideDepartureTime: '07:30',
  seatNumber: 4,
  status: 'ACTIVE',
  returnOfReservationId: null,
  passengerName: 'Marko Markovic',
  passengerPhone: '+381601234567',
  lineName: 'Beograd - Subotica',
  departureStationName: 'Beograd BAS',
  arrivalStationName: 'Subotica',
  ...overrides
});

const ambiguity = (
  reservationId: string,
  candidateReservationIds: string[],
  reason: ReturnLegBackfillAmbiguity['reason'] = 'multiple_candidates'
): ReturnLegBackfillAmbiguity => ({
  phase: 'heuristic',
  tenantId: 'tenant-1',
  reservationId,
  reason,
  candidateReservationIds
});

const index = (...rows: AmbiguityReviewRow[]) => new Map(rows.map((entry) => [entry.id, entry]));

describe('groupAmbiguities', () => {
  // A party booked together produces one row per seat against an identical
  // candidate set. That is one question for the agency, not six.
  it('collapses return legs that compete for the same outbounds into one decision', () => {
    const decisions = groupAmbiguities(
      [
        ambiguity('ret-1', ['out-1', 'out-2']),
        ambiguity('ret-2', ['out-2', 'out-1']),
        ambiguity('ret-3', ['out-9'])
      ],
      index(row({ id: 'ret-1' }), row({ id: 'ret-2' }), row({ id: 'ret-3' })),
      TODAY
    );

    expect(decisions).toHaveLength(2);
    expect(decisions[0].returnLegIds).toEqual(['ret-1', 'ret-2']);
    expect(decisions[1].returnLegIds).toEqual(['ret-3']);
  });

  it('orders the decisions with the most crowded first', () => {
    const decisions = groupAmbiguities(
      [ambiguity('ret-1', ['out-1']), ambiguity('ret-2', ['out-2']), ambiguity('ret-3', ['out-2'])],
      index(),
      TODAY
    );

    expect(decisions[0].returnLegIds).toEqual(['ret-2', 'ret-3']);
  });

  it('marks a decision past only when every leg has already travelled', () => {
    const past = new Date('2026-08-02T00:00:00.000Z');
    const decisions = groupAmbiguities(
      [ambiguity('ret-1', ['out-1'])],
      index(row({ id: 'ret-1', travelDate: past }), row({ id: 'out-1', travelDate: past })),
      TODAY
    );

    expect(decisions[0].entirelyPast).toBe(true);
  });

  it('keeps a decision live when one leg still lies ahead', () => {
    const decisions = groupAmbiguities(
      [ambiguity('ret-1', ['out-1'])],
      index(
        row({ id: 'ret-1', travelDate: new Date('2026-10-05T00:00:00.000Z') }),
        row({ id: 'out-1', travelDate: new Date('2026-08-02T00:00:00.000Z') })
      ),
      TODAY
    );

    expect(decisions[0].entirelyPast).toBe(false);
  });

  // Filtering away a decision nobody could look at would hide it twice over.
  it('treats a decision whose rows cannot be resolved as live', () => {
    const decisions = groupAmbiguities([ambiguity('ret-1', ['out-1'])], index(), TODAY);

    expect(decisions[0].entirelyPast).toBe(false);
  });
});

describe('formatReviewSheet', () => {
  const past = new Date('2026-08-02T00:00:00.000Z');
  const rows = index(
    row({ id: 'ret-1' }),
    row({ id: 'out-1', seatNumber: 17, lineName: 'Subotica - Beograd' }),
    row({ id: 'ret-old', travelDate: past }),
    row({ id: 'out-old', travelDate: past })
  );
  const decisions = groupAmbiguities(
    [ambiguity('ret-1', ['out-1']), ambiguity('ret-old', ['out-old'])],
    rows,
    TODAY
  );

  it('hides travelled decisions by default and says how many it hid', () => {
    const sheet = formatReviewSheet(decisions, rows, { includePast: false, sourcePath: 'r.json' });

    expect(sheet).toContain('1 row(s) in 1 decision(s)');
    expect(sheet).toContain('Hidden: 1 decision(s)');
    expect(sheet).toContain('ret-1');
    expect(sheet).not.toContain('ret-old');
  });

  it('lists everything when past decisions are asked for', () => {
    const sheet = formatReviewSheet(decisions, rows, { includePast: true, sourcePath: 'r.json' });

    expect(sheet).toContain('2 row(s) in 2 decision(s)');
    expect(sheet).not.toContain('Hidden:');
    expect(sheet).toContain('ret-old');
    expect(sheet).toContain('[already travelled]');
  });

  // The whole point of the sheet: the agency cannot decide from ids alone.
  it('names the passenger, the departure and the seat on both sides', () => {
    const sheet = formatReviewSheet(decisions, rows, { includePast: false, sourcePath: 'r.json' });

    expect(sheet).toContain('Marko Markovic (+381601234567)');
    expect(sheet).toContain('2026-10-01 07:30');
    expect(sheet).toContain('sediste 17');
    expect(sheet).toContain('Beograd BAS -> Subotica');
  });

  it('flags a candidate that is already linked, which is why it is unavailable', () => {
    const linked = index(row({ id: 'ret-1' }), row({ id: 'out-1', returnOfReservationId: 'ret-9' }));
    const sheet = formatReviewSheet(
      groupAmbiguities([ambiguity('ret-1', ['out-1'], 'candidates_already_paired')], linked, TODAY),
      linked,
      { includePast: false, sourcePath: 'r.json' }
    );

    expect(sheet).toContain('candidates_already_paired');
    expect(sheet).toContain('ALREADY LINKED to ret-9');
  });

  it('renders a decision whose rows are missing rather than dropping it', () => {
    const sheet = formatReviewSheet(
      groupAmbiguities([ambiguity('ret-gone', ['out-gone'])], index(), TODAY),
      index(),
      { includePast: false, sourcePath: 'r.json' }
    );

    expect(sheet).toContain('1 decision(s)');
    expect(sheet).toContain('reservation not found');
    expect(sheet).toContain('id=ret-gone');
  });
});
