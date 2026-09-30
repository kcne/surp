import { indexLinkableDepartures } from '../../departures/departure-link';
import { classifyDepartureLinks, reservationDepartureLinked } from './reservation-departure-linked';

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
    departure: { source: 'SCHEDULE', departureTime: '09:00' },
    ...overrides
  };
}

function reasons(rows: Row[]): Array<[string, unknown]> {
  return classifyDepartureLinks(rows, index).map((violation) => [
    violation.subjectId,
    violation.detail.reason
  ]);
}

describe('reservation.departureLinked', () => {
  it('is critical, since seats are counted on the link', () => {
    expect(reservationDepartureLinked.severity).toBe('critical');
  });
});

describe('classifyDepartureLinks', () => {
  it('is quiet for a link to the running departure its time names', () => {
    expect(reasons([row({ id: 'r1' })])).toEqual([]);
  });

  it('reports a link whose time copy names another bus', () => {
    expect(reasons([row({ id: 'r1', departureId: 'extra' })])).toEqual([['r1', 'WRONG_LINK']]);
  });

  it('reports a time copy that matches neither its departure nor any other', () => {
    // The departure moved to 09:30 and a write outside the sync left the
    // copy at 09:00, which matches nothing: the screens cannot find it.
    const index = indexLinkableDepartures([
      { id: 'timetable', rideId: 'ride-1', serviceDate: travelDate, departureTime: '09:30' }
    ]);

    const violations = classifyDepartureLinks(
      [row({ id: 'r1', departure: { source: 'SCHEDULE', departureTime: '09:30' } })],
      index
    );

    expect(violations.map((violation) => violation.detail)).toEqual([
      expect.objectContaining({ reason: 'STALE_TIME_COPY', departureTime: '09:30' })
    ]);
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
          departure: { source: 'LEGACY', departureTime: '09:00' }
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
          departure: { source: 'LEGACY', departureTime: '09:00' }
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
