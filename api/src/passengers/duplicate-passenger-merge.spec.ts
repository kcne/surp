import { PrismaClient } from '@prisma/client';
import {
  applyDuplicatePassengerMerge,
  planDuplicatePassengerMerge
} from './duplicate-passenger-merge';

const findMany = jest.fn();
const reservationFindMany = jest.fn();
const reservationUpdateMany = jest.fn();
const passengerUpdateMany = jest.fn();
const passengerUpdate = jest.fn();
const prismaMock = {
  passenger: { findMany },
  reservation: { findMany: reservationFindMany },
  $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      $executeRaw: jest.fn().mockResolvedValue(1),
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

interface ReservationOverrides {
  id: string;
  passengerId: string;
  seatNumber?: number;
  travelDate?: string;
  rideDepartureTime?: string;
  rideId?: string;
  departureStationId?: string;
  arrivalStationId?: string;
}

/** A live ticket on the Belgrade - Novi Pazar - Podgorica line, stations 0..2. */
function reservationOn({
  travelDate = '2026-09-11',
  seatNumber = 4,
  rideId = 'ride-1',
  rideDepartureTime = '20:30',
  departureStationId = 'belgrade',
  arrivalStationId = 'podgorica',
  ...overrides
}: ReservationOverrides) {
  return {
    ...overrides,
    rideId,
    travelDate: new Date(`${travelDate}T00:00:00.000Z`),
    rideDepartureTime,
    seatNumber,
    departureStationId,
    arrivalStationId,
    ride: {
      line: {
        departureStationId: 'belgrade',
        arrivalStationId: 'podgorica',
        intermediateStops: [{ stationId: 'novi-pazar' }]
      }
    }
  };
}

describe('duplicate passenger merge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reservationFindMany.mockResolvedValue([]);
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

  it('keeps the busiest row even when it is inactive, and brings it back to life', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'inactive-busy', reservations: 5, isActive: false }),
      passenger({ id: 'active-quiet', reservations: 1 })
    ]);
    reservationUpdateMany.mockResolvedValue({ count: 1 });

    const plan = await planDuplicatePassengerMerge(prisma);

    expect(plan.groups[0]).toMatchObject({
      canonicalPassengerId: 'inactive-busy',
      retiredPassengerIds: ['active-quiet'],
      reservationsToRepoint: 1,
      reactivateCanonical: true
    });

    await applyDuplicatePassengerMerge(prisma, 'admin-1', plan);

    expect(reservationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', passengerId: { in: ['active-quiet'] } },
        data: expect.objectContaining({ passengerId: 'inactive-busy' })
      })
    );
    expect(passengerUpdate.mock.calls[0][0]).toMatchObject({
      where: { id: 'inactive-busy' },
      data: { isActive: true, updatedById: 'admin-1' }
    });
    expect(passengerUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['active-quiet'] }, tenantId: 'tenant-1' }
      })
    );
  });

  it('leaves a live canonical row alone rather than rewriting its status', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'keep', reservations: 5 }),
      passenger({ id: 'dupe', reservations: 1 })
    ]);

    const plan = await planDuplicatePassengerMerge(prisma);

    expect(plan.groups[0].reactivateCanonical).toBe(false);

    await applyDuplicatePassengerMerge(prisma, 'admin-1', plan);

    expect(passengerUpdate).not.toHaveBeenCalled();
  });

  it('reports a group whose rows hold one seat at the same time, and leaves it alone', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'keep', reservations: 1 }),
      passenger({ id: 'dupe', reservations: 1 })
    ]);
    reservationFindMany.mockResolvedValue([
      reservationOn({ id: 'res-keep', passengerId: 'keep', seatNumber: 4 }),
      reservationOn({ id: 'res-dupe', passengerId: 'dupe', seatNumber: 4 })
    ]);

    const plan = await planDuplicatePassengerMerge(prisma);

    expect(plan.groups).toHaveLength(0);
    expect(plan.conflicts).toMatchObject([
      {
        reason: 'seat_collision',
        passengerIds: ['keep', 'dupe'],
        seatCollisions: [
          {
            seatNumber: 4,
            travelDate: '2026-09-11',
            rideDepartureTime: '20:30',
            reservationIds: ['res-keep', 'res-dupe']
          }
        ]
      }
    ]);
  });

  it('merges one seat resold down the route, because the first passenger is off', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'keep', reservations: 1 }),
      passenger({ id: 'dupe', reservations: 1 })
    ]);
    reservationFindMany.mockResolvedValue([
      reservationOn({
        id: 'res-keep',
        passengerId: 'keep',
        seatNumber: 4,
        departureStationId: 'belgrade',
        arrivalStationId: 'novi-pazar'
      }),
      reservationOn({
        id: 'res-dupe',
        passengerId: 'dupe',
        seatNumber: 4,
        departureStationId: 'novi-pazar',
        arrivalStationId: 'podgorica'
      })
    ]);

    const plan = await planDuplicatePassengerMerge(prisma);

    expect(plan.conflicts).toHaveLength(0);
    expect(plan.groups).toHaveLength(1);
  });

  it('merges the same seat on two different departures', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'keep', reservations: 1 }),
      passenger({ id: 'dupe', reservations: 1 })
    ]);
    reservationFindMany.mockResolvedValue([
      reservationOn({ id: 'res-keep', passengerId: 'keep', seatNumber: 4 }),
      reservationOn({
        id: 'res-dupe',
        passengerId: 'dupe',
        seatNumber: 4,
        travelDate: '2026-09-18'
      })
    ]);

    const plan = await planDuplicatePassengerMerge(prisma);

    expect(plan.conflicts).toHaveLength(0);
    expect(plan.groups).toHaveLength(1);
  });

  it('ignores a double sale already sitting under one passenger row', async () => {
    findMany.mockResolvedValue([
      passenger({ id: 'keep', reservations: 2 }),
      passenger({ id: 'dupe', reservations: 0 })
    ]);
    reservationFindMany.mockResolvedValue([
      reservationOn({ id: 'res-one', passengerId: 'keep', seatNumber: 4 }),
      reservationOn({ id: 'res-two', passengerId: 'keep', seatNumber: 4 })
    ]);

    const plan = await planDuplicatePassengerMerge(prisma);

    expect(plan.conflicts).toHaveLength(0);
    expect(plan.groups).toHaveLength(1);
  });

  it('does not query reservations when nothing is going to be merged', async () => {
    findMany.mockResolvedValue([passenger({ id: 'only', reservations: 1 })]);

    await planDuplicatePassengerMerge(prisma);

    expect(reservationFindMany).not.toHaveBeenCalled();
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
