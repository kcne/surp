import { BadRequestException, ConflictException } from '@nestjs/common';
import { assertDecisionDate, assertOperable, OperatedDeparture } from './departure-operations';

describe('departure state refusals', () => {
  it.each([
    ['cancel', { source: 'LEGACY' }, 'DEPARTURE_LEGACY'],
    ['cancel', { cancelledAt: new Date() }, 'DEPARTURE_ALREADY_CANCELLED'],
    ['restore', {}, 'DEPARTURE_NOT_CANCELLED'],
    ['editExtra', {}, 'DEPARTURE_NOT_EXTRA'],
    ['deleteExtra', { source: 'EXTRA', _count: { reservations: 1 } }, 'DEPARTURE_HAS_RESERVATIONS']
  ] as const)('returns a nonconfirmable code for %s (%s)', (operation, changes, code) => {
    const departure = {
      id: 'departure-1', tenantId: 'tenant-1', rideId: 'ride-1', source: 'SCHEDULE',
      serviceDate: new Date('2026-10-05'), departureTime: '09:00', arrivalTime: '11:00',
      capacity: 48, cancelledAt: null, rideExceptionId: null, _count: { reservations: 0 }, ...changes
    } as OperatedDeparture;
    try {
      assertOperable(departure, operation);
      throw new Error('Expected refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({ code, message: expect.any(String) });
    }
  });
});

describe('assertDecisionDate', () => {
  // 23:30 UTC on 29 September is already 30 September in Belgrade.
  const now = new Date('2026-09-29T23:30:00Z');
  const tx = (timezone: string | null) =>
    ({ tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone }) } }) as never;
  const on = (date: string) => new Date(`${date}T00:00:00Z`);

  it("accepts the agency's today and the last day of the horizon", async () => {
    await expect(
      assertDecisionDate(tx(null), 'tenant-1', on('2026-09-30'), now)
    ).resolves.toBeUndefined();
    await expect(
      assertDecisionDate(tx(null), 'tenant-1', on('2027-09-30'), now)
    ).resolves.toBeUndefined();
  });

  it("refuses a date before the agency's today or past the horizon", async () => {
    await expect(
      assertDecisionDate(tx(null), 'tenant-1', on('2026-09-29'), now)
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      assertDecisionDate(tx(null), 'tenant-1', on('2027-10-01'), now)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("reads the date in the agency's own zone", async () => {
    // Still the evening of 29 September in New York.
    await expect(
      assertDecisionDate(tx('America/New_York'), 'tenant-1', on('2026-09-29'), now)
    ).resolves.toBeUndefined();
  });
});
