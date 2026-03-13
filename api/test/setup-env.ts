process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/airtable_demo?schema=public';
process.env.JWT_ACCESS_TOKEN_SECRET =
  process.env.JWT_ACCESS_TOKEN_SECRET ?? 'test-secret-that-is-at-least-thirty-two-chars';
process.env.JWT_ACCESS_TOKEN_TTL_SECONDS = process.env.JWT_ACCESS_TOKEN_TTL_SECONDS ?? '900';
process.env.JWT_REFRESH_TOKEN_TTL_SECONDS = process.env.JWT_REFRESH_TOKEN_TTL_SECONDS ?? '1209600';
