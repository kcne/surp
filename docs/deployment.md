# Deployment

SURP runs on [Railway](https://railway.com).

Recommended setup is two Railway services plus one PostgreSQL instance:

1. `api` service (root directory: `api`)
2. `ui` service (root directory: `ui`)
3. `postgres` service (Railway PostgreSQL)

If you are only deploying the API from this monorepo, Railway can build directly from the repo root using the top-level `Dockerfile`.

## Monorepo Root Docker Deploy (API only)

1. In Railway, create the API service from this repository.
2. Keep root directory as repository root (default).
3. Railway will detect and use the top-level `Dockerfile`.
4. Add service variables from `.env.railway.example` and set `DATABASE_URL` using Railway Postgres variable reference.

Important:

1. Do not commit real secrets in `.env` files.
2. Use Railway Variables for production credentials.

## API service settings

Build command:

```bash
pnpm install --frozen-lockfile && pnpm prisma:generate && pnpm build
```

Start command:

```bash
pnpm prisma:migrate:deploy && pnpm start:prod
```

Required environment variables:

1. `NODE_ENV=production`
2. `PORT` (provided by Railway)
3. `DATABASE_URL` (from Railway PostgreSQL)
4. `JWT_ACCESS_TOKEN_SECRET`
5. `JWT_ACCESS_TOKEN_TTL_SECONDS=900`
6. `JWT_REFRESH_TOKEN_TTL_SECONDS=1209600`
7. `CORS_ALLOWED_ORIGINS=https://<your-ui-domain>`
8. `RESEND_API_KEY=<resend-api-key>`
9. `RESEND_FROM="SURP <contact@surp.rs>"`
10. `EMAIL_TIMEOUT_MS=10000`
11. `MARKETING_EMAIL_LOGO_URL=https://surp.rs/logo.jpg`
12. `MARKETING_LEADS_EMAIL_TO=<lead-recipient-email>`
13. `INVARIANT_SCHEDULE_ENABLED=true` (set to `false` to disable daily checks and alerts)
14. `BACKUP_FRESHNESS_CHECK_ENABLED=true` (set to `false` only where backup storage is intentionally unavailable)
15. `BACKUP_S3_ENDPOINT=<backup-bucket-endpoint>` (must be `https://` in production; the signed request carries the backup key)
16. `BACKUP_S3_REGION=auto`
17. `BACKUP_S3_BUCKET=<backup-bucket-name>`
18. `BACKUP_S3_ACCESS_KEY_ID=<read-only-backup-key-id>`
19. `BACKUP_S3_SECRET_ACCESS_KEY=<read-only-backup-secret>`

Variables 14–19 are production-only. Where there is no backup storage (staging, local), set `BACKUP_FRESHNESS_CHECK_ENABLED=false`; the `BACKUP_S3_*` variables can then be absent or empty. An empty value counts as unset, so a reference to a removed Railway service does not stop the API from booting.

The API backup credentials only need `GetObject` for `latest.json`. Keep them separate from both the backup writer credentials and the ticket-image bucket credentials.
The invariant job runs daily at 02:00 UTC for every active tenant. Each tenant's run is claimed under a unique `(tenantId, runDate)` row before the checks start, so running the API on more than one replica does not duplicate the run, the BUG ticket or the email.

## UI service settings

Build command:

```bash
pnpm install --frozen-lockfile && pnpm build
```

Start command:

```bash
pnpm start
```

Required environment variable:

1. `NEXT_PUBLIC_API_URL=https://<your-api-domain>`

Optional SEO and analytics environment variables:

1. `NEXT_PUBLIC_SITE_URL=https://<your-ui-domain>`
2. `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX`
3. `NEXT_PUBLIC_MARKETING_CONTACT_EMAIL=<public-contact-email>`

The homepage renders only a lightweight poster until Play is clicked, then streams `https://media.surp.rs/presentation-site.mp4` from Cloudflare R2. No video environment variable is required. Keep the small poster in the repository; the CDN must serve `Content-Type: video/mp4` and support byte-range requests (`206 Partial Content`) for seeking.

## Railway-native CI/CD model

Use GitHub Actions for verification and Railway for deployment orchestration:

1. Keep Railway auto-deploy enabled for `master` on both `api` and `ui` services.
2. Use GitHub branch protection to require CI workflows before merging to `master`:
   - `Backend CI`
   - `Frontend CI`
3. Keep deployment secrets in Railway Variables, not in GitHub deploy-hook secrets.
4. Use Railway deployment history for rollback and release audit.

This keeps deployment logic in Railway while preserving strict merge-time quality gates in GitHub.

## Post-deploy checks

1. API health endpoint responds: `/health`
2. API docs endpoint responds: `/docs`
3. UI can authenticate against API with tenant header flows
4. CORS allows UI domain and blocks unknown origins
