import { envValidationSchema } from './env.validation';

const required = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/surp',
  JWT_ACCESS_TOKEN_SECRET: 'x'.repeat(32),
  AWS_ENDPOINT_URL: 'https://storage.example.com',
  AWS_S3_BUCKET_NAME: 'tickets',
  AWS_ACCESS_KEY_ID: 'key',
  AWS_SECRET_ACCESS_KEY: 'secret',
  MARKETING_LEADS_EMAIL_TO: 'leads@example.com'
};

const backup = {
  BACKUP_S3_ENDPOINT: 'https://backups.example.com',
  BACKUP_S3_REGION: 'auto',
  BACKUP_S3_BUCKET: 'backups',
  BACKUP_S3_ACCESS_KEY_ID: 'read-only-key',
  BACKUP_S3_SECRET_ACCESS_KEY: 'read-only-secret'
};

function validate(env: Record<string, string>) {
  return envValidationSchema.validate(env, { allowUnknown: true, abortEarly: false });
}

describe('envValidationSchema backup storage', () => {
  it('accepts a production environment without any backup variables', () => {
    const { error, value } = validate(required);
    expect(error).toBeUndefined();
    expect(value.BACKUP_S3_REGION).toBe('auto');
  });

  // Staging after the backup service is removed: the Railway references stay
  // on the api service but resolve to empty strings.
  it('treats empty backup variables as unset', () => {
    const empty = Object.fromEntries(Object.keys(backup).map((key) => [key, '']));
    const { error, value } = validate({ ...required, ...empty });
    expect(error).toBeUndefined();
    expect(value.BACKUP_S3_ENDPOINT).toBeUndefined();
    expect(value.BACKUP_S3_BUCKET).toBeUndefined();
    expect(value.BACKUP_S3_ACCESS_KEY_ID).toBeUndefined();
    expect(value.BACKUP_S3_SECRET_ACCESS_KEY).toBeUndefined();
    expect(value.BACKUP_S3_REGION).toBe('auto');
  });

  it('accepts a configured production backup bucket', () => {
    const { error } = validate({ ...required, ...backup });
    expect(error).toBeUndefined();
  });

  it('still rejects a plain-HTTP backup endpoint in production', () => {
    const { error } = validate({ ...required, ...backup, BACKUP_S3_ENDPOINT: 'http://backups.example.com' });
    expect(error?.message).toContain('BACKUP_S3_ENDPOINT');
  });

  it('allows a plain-HTTP backup endpoint outside production', () => {
    const { error } = validate({
      ...required,
      ...backup,
      NODE_ENV: 'development',
      BACKUP_S3_ENDPOINT: 'http://localhost:9000'
    });
    expect(error).toBeUndefined();
  });

  it('still rejects a malformed backup endpoint', () => {
    const { error } = validate({ ...required, BACKUP_S3_ENDPOINT: 'not a url' });
    expect(error?.message).toContain('BACKUP_S3_ENDPOINT');
  });
});
