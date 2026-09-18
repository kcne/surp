import { InvariantContext } from '../invariant.types';
import { findReservationsWithoutGroup, reservationGroupPresent } from './group-present';

const prismaMock = {
  reservation: {
    count: jest.fn(),
    findMany: jest.fn()
  }
};

const ctx = {
  tenantId: 'tenant-1',
  actorId: 'admin-1',
  prisma: prismaMock,
  windowDays: 30
} as unknown as InvariantContext;

describe('reservation.groupPresent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.reservation.count.mockResolvedValue(3);
    prismaMock.reservation.findMany.mockResolvedValue([]);
  });

  it('scans active reservations from today onward and selects only missing groups', async () => {
    await findReservationsWithoutGroup(ctx);

    expect(prismaMock.reservation.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        status: 'ACTIVE',
        travelDate: { gte: expect.any(Date) }
      }
    });
    expect(prismaMock.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          status: 'ACTIVE',
          travelDate: { gte: expect.any(Date) },
          groupId: null
        }
      })
    );
  });

  it('reports an ungrouped reservation without offering an online repair', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      {
        id: 'reservation-1',
        travelDate: new Date('2026-09-20T00:00:00.000Z'),
        rideDepartureTime: '07:30',
        seatNumber: 4,
        passenger: { id: 'passenger-1', firstName: 'Mila', lastName: 'Markovic' },
        ride: { id: 'ride-1', name: 'Beograd - Subotica' }
      }
    ]);

    const result = await reservationGroupPresent.check(ctx);

    expect(result.scannedCount).toBe(3);
    expect(result.violations).toEqual([
      expect.objectContaining({
        subjectType: 'reservation',
        subjectId: 'reservation-1',
        canRepair: false
      })
    ]);
    expect(reservationGroupPresent.repair).toBeUndefined();
  });
});
