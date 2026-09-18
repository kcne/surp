import { findReturnRouteGaps, terminiReachable } from './termini-reachable';
import { InvariantContext } from '../invariant.types';

const prismaMock = {
  line: { findMany: jest.fn() },
  station: { findMany: jest.fn() }
};

const ctx = {
  tenantId: 'tenant-1',
  actorId: 'admin-1',
  prisma: prismaMock,
  windowDays: 30
} as unknown as InvariantContext;

/**
 * One pair whose two directions each end at a station the other never calls at:
 * outbound ends at "Nis", inbound ends at "Subotica", and neither appears on the
 * opposite route. Both directions are therefore reported.
 */
function pairWithBothTerminiUnreachable() {
  return [
    {
      id: 'line-out',
      name: 'Beograd - Nis',
      pairKey: 'pair-1',
      direction: 'OUTBOUND',
      departureStationId: 'st-bg',
      arrivalStationId: 'st-nis',
      intermediateStops: []
    },
    {
      id: 'line-in',
      name: 'Nis - Subotica',
      pairKey: 'pair-1',
      direction: 'INBOUND',
      departureStationId: 'st-nis',
      arrivalStationId: 'st-su',
      intermediateStops: []
    }
  ];
}

describe('pair.terminiReachable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.station.findMany.mockResolvedValue([
      { id: 'st-bg', name: 'Beograd' },
      { id: 'st-nis', name: 'Nis' },
      { id: 'st-su', name: 'Subotica' }
    ]);
  });

  it('identifies each direction of a pair separately', async () => {
    prismaMock.line.findMany.mockResolvedValue(pairWithBothTerminiUnreachable());

    const { gaps } = await findReturnRouteGaps(ctx);

    expect(gaps).toHaveLength(2);
    expect(gaps.map((gap) => gap.lineId).sort()).toEqual(['line-in', 'line-out']);
  });

  it('gives the two directions distinct violation identities', async () => {
    prismaMock.line.findMany.mockResolvedValue(pairWithBothTerminiUnreachable());

    const { violations } = await terminiReachable.check(ctx);

    expect(new Set(violations.map((violation) => violation.subjectId)).size).toBe(violations.length);
  });
});
