import {
  DEFAULT_AGENCY_TIMEZONE,
  addDays,
  agencyDate,
  departureWindow,
  resolveAgencyTimezone
} from './agency-date';

describe('agency date', () => {
  it('is already tomorrow in Belgrade shortly after local midnight', () => {
    // 22:30 UTC on 30 September is 00:30 on 1 October in Belgrade (CEST).
    expect(agencyDate(new Date('2026-09-30T22:30:00Z'), 'Europe/Belgrade')).toBe('2026-10-01');
  });

  it('is still today in Belgrade shortly before local midnight', () => {
    expect(agencyDate(new Date('2026-09-30T21:30:00Z'), 'Europe/Belgrade')).toBe('2026-09-30');
  });

  it('follows the winter offset', () => {
    // CET is UTC+1: 23:30 UTC on 31 December is 00:30 on 1 January.
    expect(agencyDate(new Date('2026-12-31T23:30:00Z'), 'Europe/Belgrade')).toBe('2027-01-01');
  });

  it('falls back to Belgrade for a missing zone without calling it invalid', () => {
    expect(resolveAgencyTimezone(null)).toEqual({
      timezone: DEFAULT_AGENCY_TIMEZONE,
      configured: null,
      invalid: false
    });
    expect(resolveAgencyTimezone('  ')).toEqual({
      timezone: DEFAULT_AGENCY_TIMEZONE,
      configured: null,
      invalid: false
    });
  });

  it('falls back to Belgrade for an unknown zone, and keeps the stored value to report', () => {
    expect(resolveAgencyTimezone(' Europe/Beograd ')).toEqual({
      timezone: DEFAULT_AGENCY_TIMEZONE,
      configured: 'Europe/Beograd',
      invalid: true
    });
  });

  it('keeps a known zone', () => {
    expect(resolveAgencyTimezone('Europe/Sarajevo')).toEqual({
      timezone: 'Europe/Sarajevo',
      configured: 'Europe/Sarajevo',
      invalid: false
    });
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('spans from the agency date to 365 days ahead', () => {
    expect(departureWindow(new Date('2026-09-30T22:30:00Z'), 'Europe/Belgrade')).toEqual({
      from: '2026-10-01',
      to: '2027-10-01'
    });
  });
});
