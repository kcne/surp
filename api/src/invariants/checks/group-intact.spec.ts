import { findBrokenGroups, reservationGroupIntact } from './group-intact';
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

const leg = (overrides: Record<string, unknown> = {}) => ({
  id: 'res-out',
  groupId: 'group-1',
  status: 'ACTIVE',
  travelDate: dateInDays(5),
  rideDepartureTime: '07:30',
  passenger: { firstName: 'Marko', lastName: 'Markovic', phone: '+381601234567' },
  ride: { name: 'Beograd - Subotica', line: { name: 'Beograd - Subotica' } },
  ...overrides
});

describe('reservation.groupIntact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('leaves a group alone when every leg is active', async () => {
    prismaMock.reservation.findMany
      .mockResolvedValueOnce([{ groupId: 'group-1' }])
      .mockResolvedValueOnce([
        leg({ id: 'res-out', status: 'ACTIVE' }),
        leg({ id: 'res-back', status: 'ACTIVE', rideDepartureTime: '18:00' })
      ]);

    const { items, scannedReservationCount } = await findBrokenGroups(ctx);

    expect(items).toEqual([]);
    expect(scannedReservationCount).toBe(2);
  });

  it('leaves a group alone when every leg is cancelled', async () => {
    prismaMock.reservation.findMany
      .mockResolvedValueOnce([{ groupId: 'group-1' }])
      .mockResolvedValueOnce([
        leg({ id: 'res-out', status: 'CANCELLED' }),
        leg({ id: 'res-back', status: 'CANCELLED', rideDepartureTime: '18:00' })
      ]);

    const { items } = await findBrokenGroups(ctx);

    expect(items).toEqual([]);
  });

  it('flags a group whose legs disagree on state', async () => {
    prismaMock.reservation.findMany
      .mockResolvedValueOnce([{ groupId: 'group-1' }])
      .mockResolvedValueOnce([
        leg({ id: 'res-out', status: 'ACTIVE' }),
        leg({ id: 'res-back', status: 'CANCELLED', rideDepartureTime: '18:00' })
      ]);

    const { items } = await findBrokenGroups(ctx);

    expect(items).toHaveLength(1);
    expect(items[0].groupId).toBe('group-1');
    expect(items[0].activeLegs.map((l) => l.reservationId)).toEqual(['res-out']);
    expect(items[0].cancelledLegs.map((l) => l.reservationId)).toEqual(['res-back']);
  });

  it('reports a mixed group as a critical, unrepaired violation without copying the phone', async () => {
    prismaMock.reservation.findMany
      .mockResolvedValueOnce([{ groupId: 'group-1' }])
      .mockResolvedValueOnce([
        leg({ id: 'res-out', status: 'ACTIVE' }),
        leg({ id: 'res-back', status: 'CANCELLED', rideDepartureTime: '18:00' })
      ]);

    const result = await reservationGroupIntact.check(ctx);

    expect(result.violations).toHaveLength(1);
    const violation = result.violations[0];
    expect(violation.canRepair).toBe(false);
    expect(violation.subjectType).toBe('reservation-group');
    expect(violation.subjectId).toBe('group-1');
    expect(violation.summary).not.toContain('+381601234567');
    expect(violation.summary).toContain('aktivna');
    expect(violation.summary).toContain('otkazana');
    expect(reservationGroupIntact.repair).toBeUndefined();
  });

  it('ignores reservations with no group', async () => {
    prismaMock.reservation.findMany.mockResolvedValueOnce([]);

    const { items, scannedReservationCount } = await findBrokenGroups(ctx);

    expect(items).toEqual([]);
    expect(scannedReservationCount).toBe(0);
    expect(prismaMock.reservation.findMany).toHaveBeenCalledTimes(1);
  });
});
