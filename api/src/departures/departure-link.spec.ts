import {
  indexLinkableDepartures,
  resolveDepartureLink,
  uniqueDepartureMatch
} from './departure-link';

const serviceDate = new Date('2026-10-05T00:00:00.000Z');

describe('resolveDepartureLink', () => {
  const lookup = (rows: Array<{ id: string }>) => {
    const db = { departure: { findMany: jest.fn().mockResolvedValue(rows) } };
    const result = resolveDepartureLink(db as never, {
      tenantId: 'tenant-1',
      rideId: 'ride-1',
      travelDate: serviceDate,
      departureTime: '09:00'
    });

    return { db, result };
  };

  it('matches on ride, date and exact time among timetable and extra departures', async () => {
    const { db, result } = lookup([{ id: 'departure-1' }]);

    await expect(result).resolves.toBe('departure-1');
    expect(db.departure.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        rideId: 'ride-1',
        serviceDate,
        departureTime: '09:00',
        // LEGACY rows belong to the backfill and are never a booking's.
        source: { in: ['SCHEDULE', 'EXTRA'] }
      },
      select: { id: true },
      take: 2
    });
  });

  it('refuses to guess between two departures at the same time', async () => {
    await expect(lookup([{ id: 'departure-1' }, { id: 'departure-extra' }]).result).resolves.toBeNull();
  });

  it('leaves the booking unlinked when nothing matches', async () => {
    await expect(lookup([]).result).resolves.toBeNull();
  });
});

describe('indexLinkableDepartures', () => {
  const departure = (id: string, rideId: string, departureTime: string) => ({
    id,
    rideId,
    serviceDate,
    departureTime
  });

  it('answers the same as the single lookup, for many rows at once', () => {
    const index = indexLinkableDepartures([
      departure('timetable', 'ride-1', '09:00'),
      departure('extra-same-time', 'ride-1', '09:00'),
      departure('extra-later', 'ride-1', '15:00'),
      departure('other-ride', 'ride-2', '09:00')
    ]);

    expect(uniqueDepartureMatch(index, 'ride-1', serviceDate, '09:00')).toBeNull();
    expect(uniqueDepartureMatch(index, 'ride-1', serviceDate, '15:00')).toBe('extra-later');
    expect(uniqueDepartureMatch(index, 'ride-2', serviceDate, '09:00')).toBe('other-ride');
    expect(uniqueDepartureMatch(index, 'ride-1', serviceDate, '10:00')).toBeNull();
    expect(
      uniqueDepartureMatch(index, 'ride-2', new Date('2026-10-06T00:00:00.000Z'), '09:00')
    ).toBeNull();
  });
});
