import { departureSyncEnabled } from './departure-sync-enabled';

describe('departureSyncEnabled', () => {
  it('is off when the variable is missing, empty or anything but true', () => {
    expect(departureSyncEnabled({})).toBe(false);
    expect(departureSyncEnabled({ DEPARTURES_SYNC_ENABLED: '' })).toBe(false);
    expect(departureSyncEnabled({ DEPARTURES_SYNC_ENABLED: 'false' })).toBe(false);
    expect(departureSyncEnabled({ DEPARTURES_SYNC_ENABLED: '1' })).toBe(false);
  });

  it('is on for true, as the environment validation reads it', () => {
    expect(departureSyncEnabled({ DEPARTURES_SYNC_ENABLED: 'true' })).toBe(true);
    expect(departureSyncEnabled({ DEPARTURES_SYNC_ENABLED: 'TRUE' })).toBe(true);
  });
});
