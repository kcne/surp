import { findBrokenReturnLegs, reservationReturnLegIntact } from './return-leg-intact';
import { InvariantContext } from '../invariant.types';

const prismaMock = {
  reservation: { findMany: jest.fn() }
};

const ctx = {
  tenantId: 'tenant-1',
  actorId: 'admin-1',
  prisma: prismaMock,
  windowDays: 30
} as unknown as InvariantContext;

const dateInDays = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const passenger = { firstName: 'Marko', lastName: 'Markovic', phone: '+381601234567' };

const outboundRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'res-out',
  status: 'ACTIVE',
  travelDate: dateInDays(5),
  rideDepartureTime: '07:30',
  seatNumber: 3,
  returnOfReservationId: null,
  passenger,
  ride: { name: 'Jutarnja', line: { name: 'Beograd - Subotica' } },
  ...overrides
});

const returnRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'res-back',
  status: 'ACTIVE',
  travelDate: dateInDays(12),
  rideDepartureTime: '18:00',
  seatNumber: 5,
  returnOfReservationId: 'res-out',
  passenger,
  ride: { name: 'Vecernja', line: { name: 'Subotica - Beograd' } },
  ...overrides
});

/** What the windowed candidate query returns for a pair whose outbound is in view. */
const candidates = (...rows: Array<{ id: string; returnOfReservationId: string | null }>) => rows;

const pairOf = (...legs: unknown[]) => {
  prismaMock.reservation.findMany
    .mockResolvedValueOnce(candidates({ id: 'res-out', returnOfReservationId: null }))
    .mockResolvedValueOnce(legs);
};

describe('reservation.returnLegIntact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('flags a live outbound whose only return leg is cancelled', async () => {
    pairOf(outboundRow(), returnRow({ status: 'CANCELLED' }));

    const { items, scannedReservationCount } = await findBrokenReturnLegs(ctx);

    expect(items).toHaveLength(1);
    expect(items[0].reason).toBe('RETURN_CANCELLED');
    expect(items[0].outbound.reservationId).toBe('res-out');
    expect(items[0].returnLegs.map((leg) => leg.reservationId)).toEqual(['res-back']);
    expect(scannedReservationCount).toBe(2);
  });

  it('flags a live return leg whose outbound is cancelled', async () => {
    pairOf(outboundRow({ status: 'CANCELLED' }), returnRow());

    const { items } = await findBrokenReturnLegs(ctx);

    expect(items).toHaveLength(1);
    expect(items[0].reason).toBe('OUTBOUND_CANCELLED');
    expect(items[0].outbound.reservationId).toBe('res-out');
  });

  it('leaves a pair alone when both legs are active', async () => {
    pairOf(outboundRow(), returnRow());

    const { items } = await findBrokenReturnLegs(ctx);

    expect(items).toEqual([]);
  });

  it('leaves a pair alone when both legs are cancelled', async () => {
    pairOf(outboundRow({ status: 'CANCELLED' }), returnRow({ status: 'CANCELLED' }));

    const { items } = await findBrokenReturnLegs(ctx);

    expect(items).toEqual([]);
  });

  // Cancelling a return leg and booking another one is an ordinary agency
  // action, which is why the unique index on the link is partial. A predicate
  // reading "the statuses disagree" would flag this, and no row in production
  // has this shape yet, so nothing but this test would catch that.
  it('leaves a cancelled return leg alone when a live replacement links to the same outbound', async () => {
    pairOf(
      outboundRow(),
      returnRow({ id: 'res-back-old', status: 'CANCELLED' }),
      returnRow({ id: 'res-back-new', seatNumber: 6 })
    );

    const { items } = await findBrokenReturnLegs(ctx);

    expect(items).toEqual([]);
  });

  // The #79 regression: a party on one departure with some seats cancelled is
  // not a half-dead round trip. Those rows carry no link, so they never enter
  // the candidate set at all.
  it('never considers reservations that carry no return-leg link', async () => {
    prismaMock.reservation.findMany.mockResolvedValueOnce([]);

    const { items, scannedReservationCount } = await findBrokenReturnLegs(ctx);

    expect(items).toEqual([]);
    expect(scannedReservationCount).toBe(0);
    expect(prismaMock.reservation.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.reservation.findMany.mock.calls[0][0].where.OR).toEqual([
      { returnOfReservationId: { not: null } },
      { returnLegs: { some: {} } }
    ]);
  });

  it('reads a return leg weeks past its outbound rather than treating it as missing', async () => {
    pairOf(outboundRow(), returnRow({ travelDate: dateInDays(75) }));

    const { items } = await findBrokenReturnLegs(ctx);

    expect(items).toEqual([]);
    // Only the first query is windowed: the pair itself is loaded by id, or a
    // leg outside the window would read as gone instead of merely out of sight.
    expect(prismaMock.reservation.findMany.mock.calls[0][0].where.travelDate).toBeDefined();
    expect(prismaMock.reservation.findMany.mock.calls[1][0].where.travelDate).toBeUndefined();
  });

  it('finds the pair when the return leg is the end sitting inside the window', async () => {
    prismaMock.reservation.findMany
      .mockResolvedValueOnce(candidates({ id: 'res-back', returnOfReservationId: 'res-out' }))
      .mockResolvedValueOnce([
        outboundRow({ travelDate: dateInDays(-20) }),
        returnRow({ status: 'CANCELLED' })
      ]);

    const { items } = await findBrokenReturnLegs(ctx);

    expect(items).toHaveLength(1);
    expect(items[0].outbound.reservationId).toBe('res-out');
    expect(prismaMock.reservation.findMany.mock.calls[1][0].where.OR).toEqual([
      { id: { in: ['res-out'] } },
      { returnOfReservationId: { in: ['res-out'] } }
    ]);
  });

  it('agrees in number when more than one cancelled return leg is named', async () => {
    pairOf(
      outboundRow(),
      returnRow({ id: 'res-back-1', status: 'CANCELLED', travelDate: dateInDays(12) }),
      returnRow({
        id: 'res-back-2',
        status: 'CANCELLED',
        seatNumber: 6,
        travelDate: dateInDays(19)
      })
    );

    const result = await reservationReturnLegIntact.check(ctx);

    const summary = result.violations[0].summary;
    expect(summary).toContain('a povratne');
    expect(summary).toContain('su otkazane');
    expect(summary).not.toContain('je otkazana');
  });

  it('keeps the singular form when a single return leg is named', async () => {
    pairOf(outboundRow(), returnRow({ status: 'CANCELLED' }));

    const result = await reservationReturnLegIntact.check(ctx);

    const summary = result.violations[0].summary;
    expect(summary).toContain('a povratna');
    expect(summary).toContain('je otkazana');
    expect(summary).not.toContain('su otkazane');
  });

  it('names only the live return leg when the outbound is the cancelled half', async () => {
    pairOf(
      outboundRow({ status: 'CANCELLED' }),
      returnRow({ id: 'res-back-old', status: 'CANCELLED', travelDate: dateInDays(12) }),
      returnRow({ id: 'res-back-new', seatNumber: 6, travelDate: dateInDays(19) })
    );

    const result = await reservationReturnLegIntact.check(ctx);

    expect(result.violations).toHaveLength(1);
    const summary = result.violations[0].summary;
    expect(summary).toContain(formatDate(dateInDays(19)));
    expect(summary).not.toContain(formatDate(dateInDays(12)));
  });

  it('reports the pair as a critical, unrepaired violation naming both directions', async () => {
    pairOf(outboundRow(), returnRow({ status: 'CANCELLED' }));

    const result = await reservationReturnLegIntact.check(ctx);

    expect(result.violations).toHaveLength(1);
    const violation = result.violations[0];
    expect(reservationReturnLegIntact.severity).toBe('critical');
    expect(reservationReturnLegIntact.repair).toBeUndefined();
    expect(violation.canRepair).toBe(false);
    expect(violation.subjectType).toBe('reservation');
    expect(violation.subjectId).toBe('res-out');
    expect(violation.summary).toContain('Marko Markovic');
    expect(violation.summary).toContain('Beograd - Subotica');
    expect(violation.summary).toContain('Subotica - Beograd');
    expect(violation.summary).toContain('otkazana');
    expect(violation.summary).not.toContain('+381601234567');
  });
});
