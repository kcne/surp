const mockFindMany = jest.fn();
const mockUpdateMany = jest.fn();
const mockDisconnect = jest.fn();
const mockPrisma = {
  reservation: { findMany: mockFindMany },
  $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      reservation: { updateMany: mockUpdateMany }
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
      RESERVATION_IDS: 'reservation-1'
    };
    delete process.env.ALLOW_LINKED;
    mockUpdateMany.mockResolvedValue({ count: 1 });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  async function run(row: ReturnType<typeof reservation>) {
    mockFindMany.mockResolvedValue([row]);
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
    await run(reservation({ returnOfReservationId: 'outbound-1' }));

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [] }, status: 'ACTIVE' } })
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('ALLOW_LINKED=1'));
  });

  it('skips an outbound reservation with a linked return leg', async () => {
    await run(reservation({ _count: { returnLegs: 1 } }));

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [] }, status: 'ACTIVE' } })
    );
  });

  it('allows an explicitly authorized linked return leg', async () => {
    process.env.ALLOW_LINKED = '1';
    await run(reservation({ returnOfReservationId: 'outbound-1' }));

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['reservation-1'] }, status: 'ACTIVE' },
        data: expect.objectContaining({ status: 'CANCELLED', updatedById: 'admin-1' })
      })
    );
  });
});
