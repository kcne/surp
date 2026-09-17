import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { CheckResult, Invariant } from '../invariant.types';

const MAX_BACKUP_AGE_MS = 26 * 60 * 60 * 1000;

type BackupHeartbeat = { completedAt?: unknown; key?: unknown };

export async function checkBackupFreshness(
  env: NodeJS.ProcessEnv = process.env,
  now = new Date(),
  readHeartbeat: (config: BackupStorageConfig) => Promise<string> = readBackupHeartbeat
): Promise<CheckResult> {
  if (env.BACKUP_FRESHNESS_CHECK_ENABLED === 'false') {
    return { scannedCount: 0, violations: [] };
  }

  const config = backupStorageConfig(env);
  if (!config) {
    return result('Provera rezervne kopije nije podesena na serveru.', { reason: 'NOT_CONFIGURED' });
  }

  let heartbeat: BackupHeartbeat;
  try {
    heartbeat = JSON.parse(await readHeartbeat(config)) as BackupHeartbeat;
  } catch (error) {
    return result('Poslednja uspesna rezervna kopija ne moze da se procita.', {
      reason: 'UNREADABLE_HEARTBEAT',
      error: error instanceof Error ? error.message : String(error)
    });
  }

  if (typeof heartbeat.completedAt !== 'string') {
    return result('Zapis o poslednjoj rezervnoj kopiji nema ispravno vreme zavrsetka.', {
      reason: 'INVALID_HEARTBEAT'
    });
  }

  const completedAt = new Date(heartbeat.completedAt);
  const ageMs = now.getTime() - completedAt.getTime();
  if (!Number.isFinite(completedAt.getTime()) || ageMs < 0) {
    return result('Zapis o poslednjoj rezervnoj kopiji ima neispravno vreme zavrsetka.', {
      reason: 'INVALID_HEARTBEAT',
      completedAt: heartbeat.completedAt
    });
  }

  if (ageMs <= MAX_BACKUP_AGE_MS) {
    return { scannedCount: 1, violations: [] };
  }

  return result('Poslednja uspesna rezervna kopija je starija od 26 sati.', {
    reason: 'STALE',
    completedAt: completedAt.toISOString(),
    key: typeof heartbeat.key === 'string' ? heartbeat.key : null,
    ageHours: Math.floor(ageMs / (60 * 60 * 1000))
  });
}

function result(summary: string, detail: Record<string, unknown>): CheckResult {
  return {
    scannedCount: 1,
    violations: [
      {
        subjectType: 'system',
        subjectId: 'backup/latest.json',
        summary,
        detail,
        canRepair: false
      }
    ]
  };
}

type BackupStorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function backupStorageConfig(env: NodeJS.ProcessEnv): BackupStorageConfig | null {
  const endpoint = env.BACKUP_S3_ENDPOINT;
  const bucket = env.BACKUP_S3_BUCKET;
  const accessKeyId = env.BACKUP_S3_ACCESS_KEY_ID;
  const secretAccessKey = env.BACKUP_S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey, region: env.BACKUP_S3_REGION ?? 'auto' };
}

async function readBackupHeartbeat(config: BackupStorageConfig): Promise<string> {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: false,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
  });
  try {
    const response = await client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: 'latest.json' })
    );
    if (!response.Body) throw new Error('latest.json response has no body');
    return await response.Body.transformToString();
  } finally {
    client.destroy();
  }
}

export const backupFresh: Invariant = {
  key: 'backup.fresh',
  title: 'Rezervna kopija je svezija od 26 sati',
  description:
    'Poslednja uspesna rezervna kopija mora biti mladja od 26 sati da bi prekid dnevnog pravljenja kopija bio primecen na vreme.',
  severity: 'critical',
  async check(): Promise<CheckResult> {
    return checkBackupFreshness();
  }
};
