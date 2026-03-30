process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/airtable_demo?schema=public';
process.env.JWT_ACCESS_TOKEN_SECRET =
  process.env.JWT_ACCESS_TOKEN_SECRET ?? 'test-secret-that-is-at-least-thirty-two-chars';
process.env.JWT_ACCESS_TOKEN_TTL_SECONDS = process.env.JWT_ACCESS_TOKEN_TTL_SECONDS ?? '900';
process.env.JWT_REFRESH_TOKEN_TTL_SECONDS = process.env.JWT_REFRESH_TOKEN_TTL_SECONDS ?? '1209600';
process.env.AWS_ENDPOINT_URL = process.env.AWS_ENDPOINT_URL ?? 'http://localhost:9000';
process.env.AWS_DEFAULT_REGION = process.env.AWS_DEFAULT_REGION ?? 'us-east-1';
process.env.AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME ?? 'surp-test-bucket';
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID ?? 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY ?? 'test-secret-key';
