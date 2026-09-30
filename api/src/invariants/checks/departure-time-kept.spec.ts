import { confirmationTokenFor } from '../prospective-write';
import { InvariantContext } from '../invariant.types';
import { reservationDepartureTimeKept } from './departure-time-kept';

const travelDate = (() => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 7);
  date.setUTCHours(0, 0, 0, 0);
  return date;
})();

const reservation = (id: string, departureId: string | null) => ({
  id,
  rideId: 'ride-1',
  departureId,
  travelDate,
  rideDepartureTime: '07:30',
  rideArrivalTime: '10:45',
  seatNumber: 12,
  departureStationId: 'station-bg',
  arrivalStationId: 'station-su',
  passenger: { firstName: 'Marko', lastName: 'Markovic', phone: '+381601234567', isActive: true }
});

const contextWith = (departureTime: string, arrivalTime: string) =>
  ({
    tenantId: 'tenant-1',
    actorId: 'admin-1',
    windowDays: 30,
    prisma: {
      reservation: {
        findMany: jest
          .fn()
          .mockResolvedValue([reservation('res-1', 'departure-1'), reservation('res-2', null)])
      },
      ride: { findMany: jest.fn().mockResolvedValue([]) },
      departure: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'departure-1',
            source: 'SCHEDULE',
            departureTime,
            arrivalTime,
            capacity: 38,
            cancelledAt: null,
            timetableDroppedAt: null,
            stops: []
          }
        ])
      }
    }
  }) as unknown as InvariantContext;

describe('reservation.departureTimeKept', () => {
  it('lists linked reservations under their departure times, and leaves unlinked ones out', async () => {
    const { violations } = await reservationDepartureTimeKept.check(contextWith('07:30', '10:45'));

    expect(violations.map((violation) => violation.subjectId)).toEqual(['res-1@07:30-10:45']);
    expect(violations[0].canRepair).toBe(false);
  });

  it('gives a moved departure a new subject, so the guard asks about it', async () => {
    const before = await reservationDepartureTimeKept.check(contextWith('07:30', '10:45'));
    const after = await reservationDepartureTimeKept.check(contextWith('08:00', '11:15'));

    expect(after.violations[0].subjectId).not.toBe(before.violations[0].subjectId);
  });

  it('keeps the subject when the times do not change', async () => {
    const before = await reservationDepartureTimeKept.check(contextWith('07:30', '10:45'));
    const after = await reservationDepartureTimeKept.check(contextWith('07:30', '10:45'));

    expect(confirmationTokenFor(reservationDepartureTimeKept, after.violations)).toBe(
      confirmationTokenFor(reservationDepartureTimeKept, before.violations)
    );
  });

  it('counts an arrival change as a time change too', async () => {
    const before = await reservationDepartureTimeKept.check(contextWith('07:30', '10:45'));
    const after = await reservationDepartureTimeKept.check(contextWith('07:30', '11:00'));

    expect(after.violations[0].subjectId).not.toBe(before.violations[0].subjectId);
  });

  it('says what the operator is confirming, in Serbian', () => {
    expect(reservationDepartureTimeKept.breakingChangeMessage(2)).toBe(
      'Ova izmena menja vreme polaska ili dolaska za 2 rezervacije. Putnici ostaju na istom polasku, ali im treba javiti novo vreme.'
    );
  });
});
