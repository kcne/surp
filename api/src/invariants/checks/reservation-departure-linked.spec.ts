import { indexLinkableDepartures } from '../../departures/departure-link';
import { classifyDepartureLinks } from './reservation-departure-linked';

const travelDate = new Date('2026-10-05T00:00:00.000Z');

const index = indexLinkableDepartures([
  { id: 'timetable', rideId: 'ride-1', serviceDate: travelDate, departureTime: '09:00' },
  { id: 'extra', rideId: 'ride-1', serviceDate: travelDate, departureTime: '15:00' },
  { id: 'twin-a', rideId: 'ride-2', serviceDate: travelDate, departureTime: '07:00' },
  { id: 'twin-b', rideId: 'ride-2', serviceDate: travelDate, departureTime: '07:00' }
]);

type Row = Parameters<typeof classifyDepartureLinks>[0][number];

function row(overrides: Partial<Row> & { id: string }): Row {
  return {
    rideId: 'ride-1',
    travelDate,
    rideDepartureTime: '09:00',
    departureId: 'timetable',
    passenger: { firstName: 'Ana', lastName: 'Petrovic' },
    departure: { source: 'SCHEDULE', timetableDroppedAt: null, cancelledAt: null },
    ...overrides
  };
}

function reasons(rows: Row[]): Array<[string, unknown]> {
  return classifyDepartureLinks(rows, index).map((violation) => [
    violation.subjectId,
    violation.detail.reason
  ]);
}

describe('classifyDepartureLinks', () => {
  it('is quiet for a link to the running departure its time names', () => {
    expect(reasons([row({ id: 'r1' })])).toEqual([]);
  });

  it('reports a link whose time copy names another bus', () => {
    expect(reasons([row({ id: 'r1', departureId: 'extra' })])).toEqual([['r1', 'WRONG_LINK']]);
  });

  it('leaves a stale time copy to reservation.reachable', () => {
    // The timetable moved the departure to 09:30; the copy still says 09:00
    // and matches nothing, so the link is right and the copy is stale.
    const index = indexLinkableDepartures([
      { id: 'timetable', rideId: 'ride-1', serviceDate: travelDate, departureTime: '09:30' }
    ]);

    expect(classifyDepartureLinks([row({ id: 'r1' })], index)).toEqual([]);
  });

  it('reports passengers on a cancelled or dropped departure', () => {
    const cancelled = row({
      id: 'r1',
      departure: { source: 'SCHEDULE', timetableDroppedAt: null, cancelledAt: new Date() }
    });
    const dropped = row({
      id: 'r2',
      departure: { source: 'SCHEDULE', timetableDroppedAt: new Date(), cancelledAt: null }
    });

    const violations = classifyDepartureLinks([cancelled, dropped], index);

    expect(violations.map((violation) => violation.detail)).toEqual([
      expect.objectContaining({ reason: 'NOT_RUNNING', cancelled: true, timetableDropped: false }),
      expect.objectContaining({ reason: 'NOT_RUNNING', cancelled: false, timetableDropped: true })
    ]);
    expect(violations[0].summary).toBe(
      'Ana Petrovic, 2026-10-05, polazak 09:00: polazak je otkazan, a rezervacija je i dalje aktivna.'
    );
  });

  it('reports every unlinked booking, by why it is unlinked', () => {
    expect(
      reasons([
        row({ id: 'linkable', departureId: null, departure: null }),
        row({
          id: 'ambiguous',
          rideId: 'ride-2',
          rideDepartureTime: '07:00',
          departureId: null,
          departure: null
        }),
        row({ id: 'nothing', rideDepartureTime: '12:00', departureId: null, departure: null })
      ])
    ).toEqual([
      ['linkable', 'LINKABLE_UNLINKED'],
      ['ambiguous', 'NO_UNIQUE_MATCH'],
      ['nothing', 'NO_UNIQUE_MATCH']
    ]);
  });

  it('reports an unlinked booking however long ago it was made', () => {
    // The cutoff PR 1b had is gone: the backfill has linked the older ones.
    expect(reasons([row({ id: 'r1', departureId: null, departure: null })])).toEqual([
      ['r1', 'LINKABLE_UNLINKED']
    ]);
  });

  it('reports an active booking on a LEGACY departure', () => {
    expect(
      reasons([
        row({
          id: 'r1',
          departureId: 'legacy',
          departure: { source: 'LEGACY', timetableDroppedAt: null, cancelledAt: null }
        })
      ])
    ).toEqual([['r1', 'ON_LEGACY']]);
  });

  it('reports ON_LEGACY rather than WRONG_LINK when a timetable bus shares the time', () => {
    // 09:00 uniquely matches the timetable bus, which is not the LEGACY row
    // the booking points at.
    const violations = classifyDepartureLinks(
      [
        row({
          id: 'r1',
          departureId: 'legacy',
          departure: { source: 'LEGACY', timetableDroppedAt: null, cancelledAt: null }
        })
      ],
      index
    );

    expect(violations.map((violation) => violation.detail.reason)).toEqual(['ON_LEGACY']);
    expect(violations[0].summary).toBe(
      'Ana Petrovic, 2026-10-05, polazak 09:00: rezervacija je aktivna, a vezana je za polazak koji red voznje vise ne pravi.'
    );
  });
});
