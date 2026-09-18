import { checkBackupFreshness } from './backup-fresh';

const configured = {
  BACKUP_S3_ENDPOINT: 'https://storage.example.com',
  BACKUP_S3_BUCKET: 'backups',
  BACKUP_S3_ACCESS_KEY_ID: 'read-only-key',
  BACKUP_S3_SECRET_ACCESS_KEY: 'secret'
};

describe('backup.fresh', () => {
  const now = new Date('2026-09-17T12:00:00.000Z');

  it('is clean when the heartbeat is younger than 26 hours', async () => {
    const result = await checkBackupFreshness(configured, now, async () =>
      JSON.stringify({ completedAt: '2026-09-16T10:01:00.000Z' })
    );
    expect(result.violations).toEqual([]);
  });

  it('reports a heartbeat older than 26 hours', async () => {
    const result = await checkBackupFreshness(configured, now, async () =>
      JSON.stringify({ completedAt: '2026-09-16T09:59:00.000Z', key: 'daily/backup.dump' })
    );
    expect(result.violations[0]).toMatchObject({
      subjectType: 'system',
      subjectId: 'backup/latest.json',
      detail: { reason: 'STALE', ageHours: 26 }
    });
  });

  it('treats a heartbeat exactly at the 26 hour limit as stale', async () => {
    const result = await checkBackupFreshness(configured, now, async () =>
      JSON.stringify({ completedAt: '2026-09-16T10:00:00.000Z' })
    );
    expect(result.violations[0].detail).toMatchObject({ reason: 'STALE', ageHours: 26 });
  });

  it('reports a heartbeat that is valid JSON but not an object', async () => {
    const result = await checkBackupFreshness(configured, now, async () => 'null');
    expect(result.violations[0].detail).toEqual({ reason: 'INVALID_HEARTBEAT' });
  });

  it('reports missing configuration instead of silently skipping the check', async () => {
    const result = await checkBackupFreshness({}, now);
    expect(result.violations[0].detail).toEqual({ reason: 'NOT_CONFIGURED' });
  });

  it('can be explicitly disabled for offline environments', async () => {
    const result = await checkBackupFreshness({ BACKUP_FRESHNESS_CHECK_ENABLED: 'false' }, now);
    expect(result).toEqual({ scannedCount: 0, violations: [] });
  });

  it('reports an unreadable heartbeat', async () => {
    const result = await checkBackupFreshness(configured, now, async () => {
      throw new Error('access denied');
    });
    expect(result.violations[0].detail).toMatchObject({ reason: 'UNREADABLE_HEARTBEAT' });
  });
});
