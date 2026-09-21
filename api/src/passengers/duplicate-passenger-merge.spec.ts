import { PrismaClient } from '@prisma/client';
import {
  applyDuplicatePassengerMerge,
  planDuplicatePassengerMerge
} from './duplicate-passenger-merge';

const findMany = jest.fn();
const reservationUpdateMany = jest.fn();
const passengerUpdateMany = jest.fn();
const passengerUpdate = jest.fn();
const prismaMock = {
  passenger: { findMany },
  $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      reservation: { updateMany: reservationUpdateMany },
      passenger: { updateMany: passengerUpdateMany, update: passengerUpdate }
    })
  )
};

const prisma = prismaMock as unknown as PrismaClient;

interface RowOverrides {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string | null;
  notes?: string | null;
  passengerType?: string;
  isActive?: boolean;
  createdAt?: string;
  tenantId?: string;
  reservations?: number;
}

function passenger({ createdAt = '2026-01-01', reservations = 0, ...overrides }: RowOverrides) {
  return {
    tenantId: 'tenant-1',
    firstName: 'Aleksandar',
    lastName: 'Tadic',
    phone: '0603086900',
    email: null,
    notes: null,
    passengerType: 'ADULT',
    isActive: true,
    ...overrides,
    createdAt: new Date(`${createdAt}T00:00:00.000Z`),
    _count: { reservations }
  };
}

describe('duplicate passenger merge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reservationUpdateMany.mockResolvedValue({ count: 0 });
    passengerUpdateMany.mockResolvedValue({ count: 1 });
    passengerUpdate.mockResolvedValue({});
  });

  it('plans without writing, so it can run against a restored backup', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'keep', reservations: 3 }),
      passenger({ id: 'dupe', reservations: 1 })
    ]);

    const plan = await planDuplicatePassengerMerge(prisma);

    expect(plan.counts).toMatchObject({ duplicateHumans: 1, rowsToRetire: 1 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('matches across phone formats and reversed names, as the CSV import does', async () => {
    findMany.mockResolvedValue([
      passenger({
        id: 'keep',
        firstName: 'Dzenan',
        lastName: 'Murati',
        phone: '+38765261603',
        reservations: 2
      }),
      passenger({ id: 'dupe', firstName: 'Murati', lastName: 'Dzenan', phone: '065261603' })
    ]);

    const plan = await planDuplicatePassengerMerge(prisma);

    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].retiredPassengerIds).toEqual(['dupe']);
  });

  it('folds diacritics, so one spelling of a name does not hide the other', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'keep', firstName: 'Milos', lastName: 'Djordjevic' }),
      passenger({ id: 'dupe', firstName: 'Miloš', lastName: 'Djordjevic' })
    ]);

    const plan = await planDuplicatePassengerMerge(prisma);

    expect(plan.groups).toHaveLength(1);
  });

  it('refuses to merge a shared phone with different names, which is a family', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'mother', firstName: 'Snezana', lastName: 'Tadic' }),
      passenger({ id: 'son', firstName: 'Aleksandar', lastName: 'Tadic' })
    ]);

    const plan = await planDuplicatePassengerMerge(prisma);

    expect(plan.groups).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(0);
  });

  it('refuses to merge the same name on different phones', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'one', phone: '0601111111' }),
      passenger({ id: 'two', phone: '0602222222' })
    ]);

    await expect(planDuplicatePassengerMerge(prisma)).resolves.toMatchObject({
      groups: [],
      conflicts: []
    });
  });

  it('keeps the row carrying the most reservations, oldest breaking the tie', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'young-busy', reservations: 5, createdAt: '2026-05-01' }),
      passenger({ id: 'old-quiet', reservations: 1, createdAt: '2026-01-01' }),
      passenger({ id: 'young-quiet', reservations: 1, createdAt: '2026-06-01' })
    ]);

    const plan = await planDuplicatePassengerMerge(prisma);

    expect(plan.groups[0].canonicalPassengerId).toBe('young-busy');
    expect(plan.groups[0].reservationsToRepoint).toBe(2);
  });

  it('keeps an active row when an inactive duplicate has more reservations', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'inactive-busy', reservations: 5, isActive: false }),
      passenger({ id: 'active-live', reservations: 1 })
    ]);
    reservationUpdateMany.mockResolvedValue({ count: 5 });

    const plan = await planDuplicatePassengerMerge(prisma);

    expect(plan.groups[0]).toMatchObject({
      canonicalPassengerId: 'active-live',
      retiredPassengerIds: ['inactive-busy'],
      reservationsToRepoint: 5
    });

    await applyDuplicatePassengerMerge(prisma, 'admin-1', plan);

    expect(reservationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', passengerId: { in: ['inactive-busy'] } },
        data: expect.objectContaining({ passengerId: 'active-live' })
      })
    );
    expect(passengerUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['inactive-busy'] }, tenantId: 'tenant-1' }
      })
    );
  });

  it('reports a group whose rows disagree and leaves it alone', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'one', notes: 'plati u autobusu' }),
      passenger({ id: 'two', notes: 'placeno karticom' })
    ]);

    const plan = await planDuplicatePassengerMerge(prisma);

    expect(plan.groups).toHaveLength(0);
    expect(plan.conflicts).toMatchObject([
      { passengerIds: ['one', 'two'], conflictingFields: ['notes'] }
    ]);
  });

  it('carries a field the canonical row is missing over from the duplicate', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'keep', reservations: 2 }),
      passenger({ id: 'dupe', email: 'putnik@example.com' })
    ]);

    const plan = await planDuplicatePassengerMerge(prisma);

    expect(plan.groups[0].filledFields).toEqual({ email: 'putnik@example.com' });
  });

  it('never merges across tenants', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'one', tenantId: 'tenant-1' }),
      passenger({ id: 'two', tenantId: 'tenant-2' })
    ]);

    await expect(planDuplicatePassengerMerge(prisma)).resolves.toMatchObject({ groups: [] });
  });

  it('moves the reservations, fills the gap and retires the duplicate', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'keep', reservations: 3 }),
      passenger({ id: 'dupe', reservations: 2, email: 'putnik@example.com' })
    ]);
    reservationUpdateMany.mockResolvedValue({ count: 2 });

    const result = await applyDuplicatePassengerMerge(prisma, 'admin-1');

    expect(result).toEqual({ mergedHumans: 1, retiredPassengers: 1, repointedReservations: 2 });
    expect(reservationUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { tenantId: 'tenant-1', passengerId: { in: ['dupe'] } },
      data: { passengerId: 'keep', updatedById: 'admin-1' }
    });
    expect(passengerUpdate.mock.calls[0][0].data).toMatchObject({
      email: 'putnik@example.com'
    });
    expect(passengerUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { id: { in: ['dupe'] }, tenantId: 'tenant-1' },
      data: { isActive: false }
    });
  });

  it('is a no-op on a second run, because a retired row is inactive and empty', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'keep', reservations: 5 }),
      passenger({ id: 'dupe', reservations: 0, isActive: false })
    ]);

    const result = await applyDuplicatePassengerMerge(prisma, 'admin-1');

    expect(result.mergedHumans).toBe(0);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('still merges an inactive row that never gave up its reservations', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'keep', reservations: 5 }),
      passenger({ id: 'half-retired', reservations: 2, isActive: false })
    ]);

    const plan = await planDuplicatePassengerMerge(prisma);

    expect(plan.groups[0].retiredPassengerIds).toEqual(['half-retired']);
  });

  it('refuses to write without an actor', async () => {
    await expect(applyDuplicatePassengerMerge(prisma, ' ')).rejects.toThrow(
      'actor user id is required'
    );
  });
});
