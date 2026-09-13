import { findActiveRidesOnInactiveLines, rideLineActive } from './ride-line-active';
import { InvariantContext } from '../invariant.types';

const prismaMock = {
  ride: { findMany: jest.fn() }
};

const ctx = {
  tenantId: 'tenant-1',
  actorId: 'admin-1',
  prisma: prismaMock,
  windowDays: 30
} as unknown as InvariantContext;

const ride = (overrides: Record<string, unknown> = {}) => ({
  id: 'ride-1',
  name: 'Beograd - Subotica 07:30',
  line: { id: 'line-1', name: 'Beograd - Subotica', isActive: true },
  ...overrides
});

describe('ride.lineActive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('leaves an active ride on an active line alone', async () => {
    prismaMock.ride.findMany.mockResolvedValue([ride()]);

    const { items, scannedRideCount } = await findActiveRidesOnInactiveLines(ctx);

    expect(items).toEqual([]);
    expect(scannedRideCount).toBe(1);
  });

  it('flags an active ride left on a deactivated line', async () => {
    prismaMock.ride.findMany.mockResolvedValue([
      ride({ line: { id: 'line-1', name: 'Beograd - Subotica', isActive: false } })
    ]);

    const { items } = await findActiveRidesOnInactiveLines(ctx);

    expect(items).toEqual([
      expect.objectContaining({ rideId: 'ride-1', lineId: 'line-1' })
    ]);
  });

  it('reports it as a warning, unrepaired', async () => {
    prismaMock.ride.findMany.mockResolvedValue([
      ride({ line: { id: 'line-1', name: 'Beograd - Subotica', isActive: false } })
    ]);

    const result = await rideLineActive.check(ctx);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].canRepair).toBe(false);
    expect(rideLineActive.severity).toBe('warning');
    expect(rideLineActive.repair).toBeUndefined();
  });
});
