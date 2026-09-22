const mockFindMany = jest.fn();
const mockTxFindMany = jest.fn();
const mockUpdateMany = jest.fn();
const mockDisconnect = jest.fn();
const mockPrisma = {
  reservation: { findMany: mockFindMany },
  $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      reservation: { findMany: mockTxFindMany, updateMany: mockUpdateMany }
    })
  ),
  $disconnect: mockDisconnect
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  ReservationStatus: { ACTIVE: 'ACTIVE', CANCELLED: 'CANCELLED' }
}));

function reservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'reservation-1',
    tenantId: 'tenant-1',
    rideId: 'ride-1',
    travelDate: new Date('2026-03-01T00:00:00.000Z'),
    rideDepartureTime: '07:30',
    seatNumber: 4,
    status: 'ACTIVE',
    roundTripId: null,
    returnOfReservationId: null,
    returnOf: null,
    notes: null,
    passenger: { firstName: 'Test', lastName: 'Passenger', phone: '0600000000' },
    departureStation: { name: 'Belgrade' },
    arrivalStation: { name: 'Novi Sad' },
    ride: { name: 'Test ride' },
    _count: { returnLegs: 0 },
    ...overrides
  };
}

describe('cancel-reservations linked-leg guard', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      APPLY: '1',
      ACTOR_USER_ID: 'admin-1',
      TENANT_ID: 'tenant-1',
      RESERVATION_IDS: 'reservation-1'
    };
    delete process.env.ALLOW_LINKED;
    mockUpdateMany.mockResolvedValue({ count: 1 });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    // The script sets `process.exitCode` on failure, and that is jest's own
    // process here: leaving it set would fail the run over a passing test.
    process.exitCode = 0;
    jest.restoreAllMocks();
  });

  /** The re-read under the locks, answering with whatever the row looks like now. */
  function relocked(row: ReturnType<typeof reservation>) {
    mockTxFindMany.mockImplementation(
      async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in
          .filter((id) => id === row.id)
          .map(() => ({
            id: row.id,
            returnOfReservationId: row.returnOfReservationId,
            returnOf: row.returnOf,
            _count: row._count
          }))
    );
  }

  async function run(row: ReturnType<typeof reservation>, afterLocks = row) {
    // The first read is the dry run's; any second one is the other-tenant probe.
    mockFindMany.mockResolvedValueOnce([row]).mockResolvedValue([]);
    relocked(afterLocks);
    const errors: unknown[] = [];
    jest.spyOn(console, 'error').mockImplementation((error: unknown) => {
      errors.push(error);
    });
    const finished = new Promise<void>((resolve) => {
      mockDisconnect.mockImplementation(async () => resolve());
    });
    jest.isolateModules(() => require('./cancel-reservations'));
    await finished;
    if (errors.length > 0) throw errors[0];
  }

  it('skips a return leg linked to an outbound reservation', async () => {
    await run(reservation({ returnOfReservationId: 'outbound-1', returnOf: { status: 'ACTIVE' } }));

    expect(mockUpdateMany.mock.calls[0][0].where.id.in).toEqual([]);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('ALLOW_LINKED=1'));
  });

  it('skips an outbound reservation with a linked return leg', async () => {
    await run(reservation({ _count: { returnLegs: 1 } }));

    expect(mockUpdateMany.mock.calls[0][0].where.id.in).toEqual([]);
  });

  it('allows an outbound whose only return leg is already cancelled', async () => {
    await run(reservation({ _count: { returnLegs: 0 } }));

    expect(mockFindMany.mock.calls[0][0].select._count).toEqual({
      select: { returnLegs: { where: { status: 'ACTIVE' } } }
    });
    expect(mockUpdateMany.mock.calls[0][0].where.id.in).toEqual(['reservation-1']);
  });

  it('allows a return leg whose outbound is already cancelled', async () => {
    await run(reservation({ returnOfReservationId: 'outbound-1', returnOf: { status: 'CANCELLED' } }));

    expect(mockUpdateMany.mock.calls[0][0].where.id.in).toEqual(['reservation-1']);
  });

  it('allows an explicitly authorized linked return leg', async () => {
    process.env.ALLOW_LINKED = '1';
    await run(reservation({ returnOfReservationId: 'outbound-1', returnOf: { status: 'ACTIVE' } }));

    expect(mockUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { id: { in: ['reservation-1'] }, tenantId: 'tenant-1', status: 'ACTIVE' },
      data: expect.objectContaining({ status: 'CANCELLED', updatedById: 'admin-1' })
    });
    // ALLOW_LINKED=1 means the update must not carry the linked-leg predicate.
    expect(mockUpdateMany.mock.calls[0][0].where.returnLegs).toBeUndefined();
  });

  it('does not write in its default dry run', async () => {
    delete process.env.APPLY;
    await run(reservation());

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Dry run only'));
  });

  it('skips an already cancelled reservation', async () => {
    await run(reservation({ status: 'CANCELLED' }));

    expect(mockUpdateMany.mock.calls[0][0].where.id.in).toEqual([]);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('already cancelled'));
  });

  it('requires reservation ids before opening the database', () => {
    delete process.env.RESERVATION_IDS;

    expect(() => jest.isolateModules(() => require('./cancel-reservations'))).toThrow(
      'RESERVATION_IDS is required'
    );
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('requires a tenant before opening the database', () => {
    delete process.env.TENANT_ID;

    expect(() => jest.isolateModules(() => require('./cancel-reservations'))).toThrow(
      'TENANT_ID is required'
    );
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('scopes both the read and the write to the named tenant', async () => {
    await run(reservation());

    expect(mockFindMany.mock.calls[0][0].where).toMatchObject({
      id: { in: ['reservation-1'] },
      tenantId: 'tenant-1'
    });
    expect(mockUpdateMany.mock.calls[0][0].where.tenantId).toBe('tenant-1');
  });

  it('refuses to apply when a requested id belongs to another tenant', async () => {
    mockFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: 'reservation-1', tenantId: 'tenant-2' }]);
    relocked(reservation());

    const errors: unknown[] = [];
    jest.spyOn(console, 'error').mockImplementation((error: unknown) => {
      errors.push(error);
    });
    const finished = new Promise<void>((resolve) => {
      mockDisconnect.mockImplementation(async () => resolve());
    });
    jest.isolateModules(() => require('./cancel-reservations'));
    await finished;

    expect(String(errors[0])).toContain('belong to another tenant');
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('OTHER TENANT'));
  });

  it('drops a row that gained a live linked leg after the dry run was read', async () => {
    await run(
      reservation(),
      reservation({ returnOfReservationId: 'outbound-1', returnOf: { status: 'ACTIVE' } })
    );

    expect(mockUpdateMany.mock.calls[0][0].where.id.in).toEqual([]);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('gained a live linked leg after the dry run')
    );
  });

  it('states the linked-leg refusal in the update itself, not only in the plan', async () => {
    await run(reservation());

    expect(mockUpdateMany.mock.calls[0][0].where).toMatchObject({
      returnLegs: { none: { status: 'ACTIVE' } },
      OR: [{ returnOfReservationId: null }, { returnOf: { status: { not: 'ACTIVE' } } }]
    });
  });
});
