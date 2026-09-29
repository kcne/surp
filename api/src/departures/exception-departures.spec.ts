import { BadRequestException } from '@nestjs/common';
import { assertDecisionDate } from './exception-departures';

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
