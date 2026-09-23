import { PrismaClient } from '@prisma/client';
import {
  applyReservationGroupBackfill,
  inspectReservationGroupBackfill
} from './reservation-group-backfill';

const updateMany = jest.fn();
const prismaMock = {
  $queryRaw: jest.fn(),
  $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({ $executeRaw: jest.fn().mockResolvedValue(1), reservation: { updateMany } })
  ),
  reservation: { count: jest.fn() }
};

const prisma = prismaMock as unknown as PrismaClient;

describe('reservation group backfill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports missing reservations and passenger groups without writing', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { reservationCount: BigInt(5), passengerGroupCount: BigInt(3) }
    ]);

    await expect(inspectReservationGroupBackfill(prisma)).resolves.toEqual({
      reservationCount: 5,
      passengerGroupCount: 3
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('fills one group per missing ride-instance passenger key and leaves existing groups alone', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          tenantId: 'tenant-1',
          rideId: 'ride-1',
          travelDate: new Date('2026-09-20T00:00:00.000Z'),
          rideDepartureTime: '07:30',
          passengerId: 'passenger-1',
          reservationCount: 2
        },
        {
          tenantId: 'tenant-1',
          rideId: 'ride-1',
          travelDate: new Date('2026-09-20T00:00:00.000Z'),
          rideDepartureTime: '07:30',
          passengerId: 'passenger-2',
          reservationCount: 1
        }
      ])
      .mockResolvedValueOnce([]);
    updateMany.mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce({ count: 1 });
    prismaMock.reservation.count.mockResolvedValue(0);

    const result = await applyReservationGroupBackfill(prisma, 'admin-1', 100);

    expect(result).toEqual({ updatedReservationCount: 3, createdGroupCount: 2 });
    expect(updateMany).toHaveBeenCalledTimes(2);

    const firstCall = updateMany.mock.calls[0][0];
    const secondCall = updateMany.mock.calls[1][0];
    expect(firstCall.where).toEqual({
      tenantId: 'tenant-1',
      rideId: 'ride-1',
      travelDate: new Date('2026-09-20T00:00:00.000Z'),
      rideDepartureTime: '07:30',
      passengerId: 'passenger-1',
      groupId: null
    });
    expect(firstCall.data.groupId).toEqual(expect.any(String));
    expect(firstCall.data.groupId).not.toBe(secondCall.data.groupId);
    expect(firstCall.data.updatedById).toBe('admin-1');
  });

  it('is a no-op when every reservation already has a group', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    prismaMock.reservation.count.mockResolvedValue(0);

    await expect(applyReservationGroupBackfill(prisma, 'admin-1', 100)).resolves.toEqual({
      updatedReservationCount: 0,
      createdGroupCount: 0
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('refuses an unaudited write or an invalid batch size', async () => {
    await expect(applyReservationGroupBackfill(prisma, '', 100)).rejects.toThrow(
      'actor user id is required'
    );
    await expect(applyReservationGroupBackfill(prisma, 'admin-1', 0)).rejects.toThrow(
      'batch size must be between 1 and 1000'
    );
  });

  it('fails if missing groups remain after the repair', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    prismaMock.reservation.count.mockResolvedValue(1);

    await expect(applyReservationGroupBackfill(prisma, 'admin-1', 100)).rejects.toThrow(
      '1 reservations still have no groupId'
    );
  });
});
