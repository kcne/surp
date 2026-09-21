import { PrismaClient, ReservationStatus } from '@prisma/client';
import {
  applyReturnLegBackfill,
  planReturnLegBackfill
} from './reservation-return-leg-backfill';

const findMany = jest.fn();
const updateMany = jest.fn();
const prismaMock = {
  reservation: { findMany },
  $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({ reservation: { updateMany } })
  )
};

const prisma = prismaMock as unknown as PrismaClient;

const BELGRADE = 'station-bg';
const NOVI_SAD = 'station-ns';

interface RowOverrides {
  id: string;
  phone?: string;
  rideId?: string;
  createdAt?: string;
  cancelledAt?: string | null;
  passengerId?: string;
  travelDate?: string;
  rideDepartureTime?: string;
  seatNumber?: number;
  status?: ReservationStatus;
  departureStationId?: string;
  arrivalStationId?: string;
  roundTripId?: string | null;
  returnOfReservationId?: string | null;
  tenantId?: string;
}

function row({ travelDate = '2026-03-01', phone = '0601234567', createdAt = '2026-01-01T09:00:00.000Z', cancelledAt = null, ...overrides }: RowOverrides) {
  return {
    rideId: 'ride-1',
    createdAt: new Date(createdAt),
    cancelledAt: cancelledAt ? new Date(cancelledAt) : null,
    passenger: { phone },
    tenantId: 'tenant-1',
    passengerId: 'passenger-1',
    rideDepartureTime: '07:30',
    seatNumber: 4,
    status: ReservationStatus.ACTIVE,
    departureStationId: BELGRADE,
    arrivalStationId: NOVI_SAD,
    roundTripId: null,
    returnOfReservationId: null,
    ...overrides,
    travelDate: new Date(`${travelDate}T00:00:00.000Z`)
  };
}

/** The mirror image of a row: same passenger, reversed stations, later date. */
function returnRow(overrides: RowOverrides) {
  return row({
    departureStationId: NOVI_SAD,
    arrivalStationId: BELGRADE,
    travelDate: '2026-03-05',
    ...overrides
  });
}

describe('reservation return leg backfill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateMany.mockResolvedValue({ count: 1 });
  });

  it('plans without writing, so it can run against a restored backup', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-1', roundTripId: 'booking-1' }),
      returnRow({ id: 'return-1', roundTripId: 'booking-1' })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toHaveLength(1);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('pairs rows that already share a booking marker and keeps that marker', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-1', roundTripId: 'booking-1' }),
      returnRow({ id: 'return-1', roundTripId: 'booking-1' })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toEqual([
      {
        phase: 'exact',
        tenantId: 'tenant-1',
        returnReservationId: 'return-1',
        outboundReservationId: 'outbound-1',
        roundTripId: 'booking-1'
      }
    ]);
    expect(plan.counts).toMatchObject({ exactMatches: 1, heuristicMatches: 0, ambiguous: 0 });
  });

  it('takes the shared marker over a closer row the heuristic would have guessed at', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-1', roundTripId: 'booking-1' }),
      returnRow({ id: 'guessable', travelDate: '2026-03-02' }),
      returnRow({ id: 'sold-together', roundTripId: 'booking-1', travelDate: '2026-03-05' })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toMatchObject([
      { phase: 'exact', returnReservationId: 'sold-together', outboundReservationId: 'outbound-1' }
    ]);
    expect(plan.counts).toMatchObject({ exactMatches: 1, heuristicMatches: 0, unmatched: 1 });
  });

  it('links a cancelled return leg, which is the pair the new check exists to find', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-1', roundTripId: 'booking-1' }),
      returnRow({
        id: 'return-1',
        roundTripId: 'booking-1',
        status: ReservationStatus.CANCELLED
      })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toHaveLength(1);
    expect(plan.links[0].returnReservationId).toBe('return-1');
  });

  it('pairs markerless legacy rows and mints one shared marker for them', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-1' }),
      returnRow({ id: 'return-1' })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toHaveLength(1);
    expect(plan.links[0]).toMatchObject({
      phase: 'heuristic',
      returnReservationId: 'return-1',
      outboundReservationId: 'outbound-1'
    });
    expect(plan.links[0].roundTripId).toEqual(expect.any(String));
    expect(plan.counts).toMatchObject({ exactMatches: 0, heuristicMatches: 1 });
  });

  it('prefers the seat the passenger kept in both directions', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-seat-4', seatNumber: 4, roundTripId: 'booking-1' }),
      row({
        id: 'outbound-seat-9',
        seatNumber: 9,
        roundTripId: 'booking-1',
        rideDepartureTime: '09:00'
      }),
      returnRow({ id: 'return-seat-9', seatNumber: 9, roundTripId: 'booking-1' })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toHaveLength(1);
    expect(plan.links[0].outboundReservationId).toBe('outbound-seat-9');
  });

  it('leaves a row unlinked and reports it when the seat does not break the tie', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-a', seatNumber: 1, roundTripId: 'booking-1' }),
      row({
        id: 'outbound-b',
        seatNumber: 2,
        roundTripId: 'booking-1',
        rideDepartureTime: '09:00'
      }),
      returnRow({ id: 'return-1', seatNumber: 7, roundTripId: 'booking-1' })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toHaveLength(0);
    expect(plan.ambiguous).toEqual([
      {
        phase: 'exact',
        tenantId: 'tenant-1',
        reservationId: 'return-1',
        reason: 'multiple_candidates',
        candidateReservationIds: ['outbound-a', 'outbound-b']
      }
    ]);
  });

  it('reports a row whose only candidate another return leg already took', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-1', roundTripId: 'booking-1' }),
      returnRow({
        id: 'return-existing',
        roundTripId: 'booking-1',
        returnOfReservationId: 'outbound-1'
      }),
      returnRow({
        id: 'return-2',
        roundTripId: 'booking-1',
        travelDate: '2026-03-06'
      })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toHaveLength(0);
    expect(plan.ambiguous).toEqual([
      {
        phase: 'exact',
        tenantId: 'tenant-1',
        reservationId: 'return-2',
        reason: 'candidates_already_paired',
        candidateReservationIds: ['outbound-1']
      }
    ]);
    expect(plan.counts.alreadyLinked).toBe(1);
  });

  it('leaves a candidate outside the lookup window alone', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-1', travelDate: '2026-03-01' }),
      returnRow({ id: 'six-months-later', travelDate: '2026-09-01' })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toHaveLength(0);
    expect(plan.counts.unmatched).toBe(2);
  });

  it('reads the later leg as the return, whichever direction was entered first', async () => {
    findMany.mockResolvedValue([
      row({ id: 'novi-sad-first', departureStationId: NOVI_SAD, arrivalStationId: BELGRADE, travelDate: '2026-02-01' }),
      row({ id: 'belgrade-later', travelDate: '2026-03-01' })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toMatchObject([
      { returnReservationId: 'belgrade-later', outboundReservationId: 'novi-sad-first' }
    ]);
  });

  it('keeps a return leg away from another passenger and another tenant', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-1' }),
      returnRow({ id: 'other-passenger', passengerId: 'passenger-2' }),
      returnRow({ id: 'other-tenant', tenantId: 'tenant-2' })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toHaveLength(0);
  });

  it('writes both sides of a pair and guards every update on the row still being free', async () => {
    findMany.mockResolvedValue([row({ id: 'outbound-1' }), returnRow({ id: 'return-1' })]);

    const result = await applyReturnLegBackfill(prisma, 'admin-1');

    expect(result).toEqual({
      linkedCount: 1,
      exactCount: 0,
      heuristicCount: 1,
      blockCount: 0,
      skippedCount: 0
    });

    const [legUpdate, outboundUpdate] = updateMany.mock.calls;
    expect(legUpdate[0].where).toMatchObject({
      id: 'return-1',
      tenantId: 'tenant-1',
      returnOfReservationId: null
    });
    expect(legUpdate[0].data).toMatchObject({
      returnOfReservationId: 'outbound-1',
      updatedById: 'admin-1'
    });
    expect(outboundUpdate[0].where).toMatchObject({ id: 'outbound-1', roundTripId: null });
    expect(outboundUpdate[0].data.roundTripId).toBe(legUpdate[0].data.roundTripId);
  });

  it('is a no-op on a second run, because every pair is already linked', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-1', roundTripId: 'booking-1' }),
      returnRow({
        id: 'return-1',
        roundTripId: 'booking-1',
        returnOfReservationId: 'outbound-1'
      })
    ]);

    const result = await applyReturnLegBackfill(prisma, 'admin-1');

    expect(result.linkedCount).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('skips a row another writer linked between the plan and the write', async () => {
    findMany.mockResolvedValue([row({ id: 'outbound-1' }), returnRow({ id: 'return-1' })]);
    updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await applyReturnLegBackfill(prisma, 'admin-1');

    expect(result).toMatchObject({ linkedCount: 0, skippedCount: 1 });
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('aborts a heuristic link when another writer claimed its outbound row', async () => {
    findMany.mockResolvedValue([row({ id: 'outbound-1' }), returnRow({ id: 'return-1' })]);
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    await expect(applyReturnLegBackfill(prisma, 'admin-1')).rejects.toThrow(
      'outbound reservation was claimed after the backfill plan was read'
    );
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('refuses to write without an actor, so no row loses its author', async () => {
    await expect(applyReturnLegBackfill(prisma, '  ')).rejects.toThrow('actor user id is required');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe('reservation return leg backfill, cancelled and rebooked', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateMany.mockResolvedValue({ count: 1 });
  });

  it('links the return leg still standing, not the one the passenger replaced', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-1' }),
      returnRow({ id: 'cancelled-return', seatNumber: 4, status: ReservationStatus.CANCELLED }),
      returnRow({ id: 'rebooked-return', seatNumber: 11, travelDate: '2026-03-06' })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toMatchObject([
      { returnReservationId: 'rebooked-return', outboundReservationId: 'outbound-1' }
    ]);
    expect(plan.ambiguous).toMatchObject([
      { reservationId: 'cancelled-return', reason: 'candidates_already_paired' }
    ]);
  });

  it('still links a cancelled return leg that was never replaced, so the pair is flagged', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-1' }),
      returnRow({ id: 'cancelled-return', status: ReservationStatus.CANCELLED })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toMatchObject([
      { returnReservationId: 'cancelled-return', outboundReservationId: 'outbound-1' }
    ]);
  });

  it('prefers a live outbound leg when a cancelled one fits equally well', async () => {
    findMany.mockResolvedValue([
      row({ id: 'cancelled-outbound', seatNumber: 4, status: ReservationStatus.CANCELLED }),
      row({ id: 'live-outbound', seatNumber: 9, rideDepartureTime: '09:00' }),
      returnRow({ id: 'return-1', seatNumber: 21 })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toMatchObject([
      { returnReservationId: 'return-1', outboundReservationId: 'live-outbound' }
    ]);
  });
});

describe('reservation return leg backfill, repeated passes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateMany.mockResolvedValue({ count: 1 });
  });

  it('resolves a tie that an earlier pass could only break later, in one run', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-seat-5', seatNumber: 5, travelDate: '2026-03-01' }),
      row({ id: 'outbound-seat-6', seatNumber: 6, travelDate: '2026-03-02' }),
      // Seen first, fits both outbound legs, and its own seat breaks no tie.
      returnRow({ id: 'reseated-return', seatNumber: 99, travelDate: '2026-03-03' }),
      returnRow({ id: 'seat-5-return', seatNumber: 5, travelDate: '2026-03-04' })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toHaveLength(2);
    expect(
      Object.fromEntries(plan.links.map((l) => [l.returnReservationId, l.outboundReservationId]))
    ).toEqual({
      'seat-5-return': 'outbound-seat-5',
      'reseated-return': 'outbound-seat-6'
    });
    expect(plan.ambiguous).toHaveLength(0);
  });

  it('still reports a row no later pass could resolve', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-a', seatNumber: 1 }),
      row({ id: 'outbound-b', seatNumber: 2, travelDate: '2026-03-02' }),
      returnRow({ id: 'return-1', seatNumber: 7 })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toHaveLength(0);
    expect(plan.ambiguous).toMatchObject([
      { reservationId: 'return-1', reason: 'multiple_candidates' }
    ]);
  });
});

describe('reservation return leg backfill, legs that are not what they look like', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateMany.mockResolvedValue({ count: 1 });
  });

  it('holds back a cancelled leg whose passenger still has a live seat on that departure', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-1' }),
      returnRow({ id: 'reseated-away', seatNumber: 25, status: ReservationStatus.CANCELLED }),
      returnRow({ id: 'the-live-seat', seatNumber: 3 })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.excluded).toMatchObject([
      { reservationId: 'reseated-away', reason: 'reseated_or_partly_cancelled' }
    ]);
    expect(plan.links).toMatchObject([{ returnReservationId: 'the-live-seat' }]);
  });

  it('holds back a cancelled leg when the seat sits under another row on the same phone', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-1', passengerId: 'goran', phone: '0628246580' }),
      returnRow({
        id: 'his-cancelled-seat',
        passengerId: 'goran',
        phone: '0628246580',
        status: ReservationStatus.CANCELLED
      }),
      returnRow({ id: 'her-live-seat', passengerId: 'zorica', phone: '+3816282465800'.slice(0, 13) })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.excluded).toMatchObject([
      { reservationId: 'his-cancelled-seat', reason: 'seat_held_under_another_row' }
    ]);
    // Her row is a different passenger, so it is never paired with his leg.
    expect(plan.links).toHaveLength(0);
  });

  it('holds back a leg cancelled minutes after it was booked', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-1' }),
      returnRow({
        id: 'mis-entry',
        status: ReservationStatus.CANCELLED,
        createdAt: '2026-03-02T16:27:00.000Z',
        cancelledAt: '2026-03-02T16:28:00.000Z'
      })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.excluded).toMatchObject([
      { reservationId: 'mis-entry', reason: 'entry_correction' }
    ]);
    expect(plan.links).toHaveLength(0);
  });

  it('still pairs a cancelled leg the passenger really did lose', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-1' }),
      returnRow({
        id: 'really-cancelled',
        status: ReservationStatus.CANCELLED,
        createdAt: '2026-02-01T10:00:00.000Z',
        cancelledAt: '2026-03-03T10:00:00.000Z'
      })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.excluded).toHaveLength(0);
    expect(plan.links).toMatchObject([{ returnReservationId: 'really-cancelled' }]);
  });

  it('does not confuse a different departure for the one the leg was on', async () => {
    findMany.mockResolvedValue([
      row({ id: 'outbound-1' }),
      returnRow({ id: 'cancelled-leg', status: ReservationStatus.CANCELLED }),
      // Same passenger, live, but a different departure entirely.
      returnRow({ id: 'other-trip', travelDate: '2026-03-20', rideId: 'ride-2' })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.excluded).toHaveLength(0);
  });
});

describe('reservation return leg backfill, a booking block', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateMany.mockResolvedValue({ count: 1 });
  });

  it('pairs a party whose seats do not match in both directions', async () => {
    findMany.mockResolvedValue([
      row({ id: 'out-3', seatNumber: 3 }),
      row({ id: 'out-4', seatNumber: 4 }),
      returnRow({ id: 'back-15', seatNumber: 15 }),
      returnRow({ id: 'back-16', seatNumber: 16 })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toHaveLength(2);
    expect(plan.links.every((link) => link.phase === 'block')).toBe(true);
    expect(
      Object.fromEntries(plan.links.map((l) => [l.returnReservationId, l.outboundReservationId]))
    ).toEqual({ 'back-15': 'out-3', 'back-16': 'out-4' });
    // One booking, one marker.
    expect(new Set(plan.links.map((link) => link.roundTripId)).size).toBe(1);
    expect(plan.ambiguous).toHaveLength(0);
  });

  it('keeps the marker a block already carries instead of minting another', async () => {
    findMany.mockResolvedValue([
      row({ id: 'out-3', seatNumber: 3, roundTripId: 'booking-1' }),
      row({ id: 'out-4', seatNumber: 4, roundTripId: 'booking-1' }),
      returnRow({ id: 'back-15', seatNumber: 15, roundTripId: 'booking-1' }),
      returnRow({ id: 'back-16', seatNumber: 16, roundTripId: 'booking-1' })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toHaveLength(2);
    expect(plan.links.map((link) => link.roundTripId)).toEqual(['booking-1', 'booking-1']);
  });

  it('will not pair a wholly cancelled side against a wholly live one', async () => {
    findMany.mockResolvedValue([
      row({ id: 'out-37', seatNumber: 37, status: ReservationStatus.CANCELLED, cancelledAt: '2026-03-01T14:00:00.000Z' }),
      row({ id: 'out-38', seatNumber: 38, status: ReservationStatus.CANCELLED, cancelledAt: '2026-03-01T14:00:00.000Z' }),
      returnRow({ id: 'back-5', seatNumber: 5 }),
      returnRow({ id: 'back-6', seatNumber: 6 })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toHaveLength(0);
  });

  it('still pairs a party that genuinely lost its whole return, because the seats match', async () => {
    findMany.mockResolvedValue([
      row({ id: 'out-23', seatNumber: 23 }),
      row({ id: 'out-24', seatNumber: 24 }),
      returnRow({ id: 'back-23', seatNumber: 23, status: ReservationStatus.CANCELLED, cancelledAt: '2026-03-04T09:00:00.000Z' }),
      returnRow({ id: 'back-24', seatNumber: 24, status: ReservationStatus.CANCELLED, cancelledAt: '2026-03-04T09:00:00.000Z' })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toHaveLength(2);
    expect(plan.links.every((link) => link.phase === 'heuristic')).toBe(true);
  });

  it('leaves a block alone when the two sides are different sizes', async () => {
    findMany.mockResolvedValue([
      row({ id: 'out-1', seatNumber: 1 }),
      row({ id: 'out-2', seatNumber: 2 }),
      row({ id: 'out-3', seatNumber: 3 }),
      returnRow({ id: 'back-9', seatNumber: 9 }),
      returnRow({ id: 'back-10', seatNumber: 10 })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links.filter((link) => link.phase === 'block')).toHaveLength(0);
  });

  it('leaves a block alone when the outbound legs sit on two different departures', async () => {
    findMany.mockResolvedValue([
      row({ id: 'out-a', seatNumber: 3, travelDate: '2026-03-01' }),
      row({ id: 'out-b', seatNumber: 4, travelDate: '2026-03-02' }),
      returnRow({ id: 'back-15', seatNumber: 15 }),
      returnRow({ id: 'back-16', seatNumber: 16 })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links.filter((link) => link.phase === 'block')).toHaveLength(0);
  });

  it('leaves both return departures alone when the same outbound block fits each one', async () => {
    findMany.mockResolvedValue([
      row({ id: 'out-3', seatNumber: 3 }),
      row({ id: 'out-4', seatNumber: 4 }),
      returnRow({ id: 'first-back-15', seatNumber: 15, travelDate: '2026-03-05' }),
      returnRow({ id: 'first-back-16', seatNumber: 16, travelDate: '2026-03-05' }),
      returnRow({ id: 'second-back-25', seatNumber: 25, travelDate: '2026-03-06' }),
      returnRow({ id: 'second-back-26', seatNumber: 26, travelDate: '2026-03-06' })
    ]);

    const plan = await planReturnLegBackfill(prisma);

    expect(plan.links).toHaveLength(0);
    expect(plan.counts.blockMatches).toBe(0);
  });
});
