import { findRoutesWithInactiveStations, routeStationsActive } from './route-stations-active';
import { InvariantContext } from '../invariant.types';

const prismaMock = {
  line: { findMany: jest.fn() }
};

const ctx = {
  tenantId: 'tenant-1',
  actorId: 'admin-1',
  prisma: prismaMock,
  windowDays: 30
} as unknown as InvariantContext;

const station = (name: string, isActive = true) => ({ name, isActive });

const line = (overrides: Record<string, unknown> = {}) => ({
  id: 'line-1',
  name: 'Beograd - Subotica',
  departureStation: station('Beograd'),
  arrivalStation: station('Subotica'),
  intermediateStops: [{ station: station('Novi Sad') }],
  ...overrides
});

describe('route.stationsActive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('leaves a route whose stations are all active alone', async () => {
    prismaMock.line.findMany.mockResolvedValue([line()]);

    const { items, scannedLineCount } = await findRoutesWithInactiveStations(ctx);

    expect(items).toEqual([]);
    expect(scannedLineCount).toBe(1);
  });

  it('names a deactivated intermediate stop', async () => {
    prismaMock.line.findMany.mockResolvedValue([
      line({ intermediateStops: [{ station: station('Novi Sad', false) }] })
    ]);

    const { items } = await findRoutesWithInactiveStations(ctx);

    expect(items).toEqual([
      expect.objectContaining({ lineId: 'line-1', inactiveStationNames: ['Novi Sad'] })
    ]);
  });

  it('names a deactivated terminus', async () => {
    prismaMock.line.findMany.mockResolvedValue([
      line({ arrivalStation: station('Subotica', false) })
    ]);

    const { items } = await findRoutesWithInactiveStations(ctx);

    expect(items[0].inactiveStationNames).toEqual(['Subotica']);
  });

  it('reports it as a critical violation, unrepaired', async () => {
    prismaMock.line.findMany.mockResolvedValue([
      line({ departureStation: station('Beograd', false) })
    ]);

    const result = await routeStationsActive.check(ctx);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].canRepair).toBe(false);
    expect(result.violations[0].summary).toContain('Beograd');
    expect(routeStationsActive.repair).toBeUndefined();
  });
});
