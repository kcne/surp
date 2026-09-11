/**
 * Placeholder configuration for the offline tooling.
 *
 * `AppModule` validates the whole environment the moment it is loaded, so
 * anything that boots it needs a complete set of variables — including S3
 * credentials. Generating the OpenAPI schema and running the e2e suite boot it
 * but never reach out to S3, so real credentials would be a requirement without
 * a purpose: the schema generator would refuse to run on a fresh clone, and in
 * CI, where no `.env` exists, it would fail outright.
 *
 * Real values always win. This only fills what is missing, so it cannot mask a
 * misconfiguration anywhere a value is genuinely supplied — and it is never
 * imported by `main.ts`, so a production boot still validates for real.
 */
export function applyOfflineEnv(): void {
  const fallbacks: Record<string, string> = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/airtable_demo?schema=public',
    JWT_ACCESS_TOKEN_SECRET: 'test-secret-that-is-at-least-thirty-two-chars',
    JWT_ACCESS_TOKEN_TTL_SECONDS: '900',
    JWT_REFRESH_TOKEN_TTL_SECONDS: '1209600',
    AWS_ENDPOINT_URL: 'http://localhost:9000',
    AWS_DEFAULT_REGION: 'us-east-1',
    AWS_S3_BUCKET_NAME: 'surp-test-bucket',
    AWS_ACCESS_KEY_ID: 'test-access-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret-key'
  };

  for (const [key, value] of Object.entries(fallbacks)) {
    process.env[key] = process.env[key] ?? value;
  }
}
