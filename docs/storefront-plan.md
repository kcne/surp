# Storefront Feature Plan — Copilot Execution Brief

This document is the authoritative plan for the per-agency public **storefront** feature. Hand this file to GitHub Copilot (or any contributor) verbatim. Each slice (A–G) is a self-contained PR. Do **not** combine slices.

> Repo memory mirror: `/memories/repo/airtable-demo.md` (Storefront feature decisions section).

---

## 0. Global Rules (apply to every slice)

- Vertical slice discipline: one slice = one PR. Each PR ships a demoable, production-deployable increment.
- Schema changes are **additive only**. No destructive Prisma migrations. Backfills scripted in `api/scripts/`.
- Update `docs/openapi.json` via `pnpm openapi:generate` and run `pnpm openapi:lint` + `pnpm test:contract` in every slice that adds endpoints.
- Add e2e specs under `api/test/*.e2e-spec.ts` per slice. Match existing naming convention.
- Add Postman collection folders per existing convention (`api/postman/`). Include negative tests (404, 401, 422, 429).
- Use existing Tenant model (`Tenant.slug` is unique). End-users are a NEW model with no tenantId.
- Public API namespace: `/api/public/...` — anonymous, rate-limited, returns SAFE DTOs (no audit fields, no internal IDs of staff).
- All new endpoints use NestJS `@nestjs/throttler` decorators from day one; tune limits in Slice G.
- All public storefront pages live under Next.js route group `ui/app/(storefront)/[agencySlug]/...` and are Server Components by default. Only interactive widgets become `'use client'`.
- JWT audience separation: end-user tokens carry `aud=end-user`, staff tokens `aud=staff`. Guards reject the wrong audience.
- Caching: Next.js Data Cache with fetch `next: { revalidate, tags }`. Invalidate via `revalidateTag(...)` from Server Actions after successful API mutations. No Redis. No in-app cache.

---

## 1. Cross-cutting tech decisions (already locked — do not re-litigate)

| Topic | Decision |
|---|---|
| Routing | Path-based `/{agencySlug}`. Subdomains deferred. |
| Reserved slugs | Validator on `Tenant.slug` rejecting: `login`, `signup`, `forgot-password`, `verify`, `api`, `admin`, `blog`, `agencies`, `_next`, `sitemap.xml`, `robots.txt`, `health`, `dashboard`, `auth`. |
| End-user model | New `EndUser` (no `tenantId`). Separate public auth module. `Reservation.endUserId` nullable. |
| Session storage | HttpOnly secure cookie for end-users. Staff dashboard keeps localStorage (existing). |
| Email | `MailService` interface. `ConsoleMailService` impl in v1. Real provider deferred. |
| Image hosting | Reuse existing Railway S3 bucket via `AWS_S3_*` env. Shared `api/src/storage/` module extracted in Slice E. Key prefixes: `storefront/{tenantId}/...`, `blog/{tenantId}/...`. |
| Pricing | `RideSegmentPrice` full O/D matrix per ride. Auto-backfilled at ride creation. `bookingEnabled` per row. |
| SEO | SSR Server Components, `generateMetadata()`, Organization + BlogPosting JSON-LD only (BusTrip deferred), single platform `app/sitemap.ts`, `app/robots.ts`, canonical URLs everywhere, required altText, `next/image` with R2 in `images.remotePatterns`. |
| Branding | `logoUrl` + `logoAlt` + `primaryColor` (hex, validated for WCAG AA contrast against white). CSS var `--brand-primary` set server-side on `<html>`. |
| Visibility rules | Inactive tenant → 404. No `AgencyStorefront` row OR `status=DRAFT` → 404. Section toggle on but content empty → render nothing silently. Draft blog post → 404. |
| Rate limiting | `@nestjs/throttler` in-memory. Redis deferred until API scales to >1 replica. |

---

## 2. Slices

### Slice A — Storefront foundation

**Goal:** Visit `/{slug}` and see a working, themed agency landing page rendered from DB.

**Backend (api/):**
1. Prisma migration adding:
   ```prisma
   model AgencyStorefront {
     tenantId         String   @id
     status           StorefrontStatus @default(DRAFT)
     publishedAt      DateTime?
     heroTitle        String?
     heroSubtitle     String?
     heroImageUrl     String?
     heroImageAlt     String?
     aboutMarkdown    String?  @db.Text
     footerText       String?
     logoUrl          String?
     logoAlt          String?
     primaryColor     String?  // "#RRGGBB"
     sectionsEnabled  Json     @default("{\"hero\":true,\"rides\":true,\"gallery\":true,\"about\":true,\"blog\":true}")
     seoTitle         String?
     seoDescription   String?
     ogImageUrl       String?
     facebookUrl      String?
     instagramUrl     String?
     twitterUrl       String?
     linkedinUrl      String?
     websiteUrl       String?
     updatedAt        DateTime @updatedAt
     tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
   }
   enum StorefrontStatus { DRAFT PUBLISHED }
   ```
   Plus add `timezone String?` to `Tenant`.
2. New module `api/src/public-storefront/` exposing:
   - `GET /api/public/agencies/:slug` → safe DTO (only when status=PUBLISHED and tenant.isActive). 404 otherwise.
3. New module `api/src/storefront-admin/` exposing:
   - `GET /api/storefront` (current tenant)
   - `PUT /api/storefront` (upsert, validated)
   - `POST /api/storefront/publish` / `POST /api/storefront/unpublish`
   Auth: existing dashboard JWT + tenant header.
4. Reserved-slug validator added to tenant creation/update path. Reject from list in §1.
5. Hex color validator + WCAG AA contrast check (vs `#FFFFFF`) on `primaryColor`.
6. Throttler decorators on public GET (60/min/IP) and admin PUT (30/min/user). Limits real-tuned in Slice G.
7. E2E: `api/test/storefront-public.e2e-spec.ts`, `api/test/storefront-admin.e2e-spec.ts`.
8. Postman folders: `Public · Agencies`, `Storefront Admin`.
9. OpenAPI regenerate + lint + contract test.

**Frontend (ui/):**
1. New route group `app/(storefront)/[agencySlug]/`:
   - `layout.tsx` — fetches agency via SSR; sets `--brand-primary` CSS var; renders public navbar (logo or name) + footer (social links) + slot. Calls `notFound()` if API returns 404.
   - `page.tsx` — landing page; renders enabled sections in order: Hero, Rides (placeholder card in A), Gallery (placeholder), About (Markdown), Footer.
   - `not-found.tsx` — themed 404 inside route group.
   - `generateMetadata` returns title/description/og based on `seoTitle`/`heroTitle`/`logoUrl`/`ogImageUrl`.
2. Dashboard: new route `(dashboard)/storefront/` with form (text + hex color input + image URL inputs — actual upload UI comes in Slice E; for now accept pasted URLs). Save / Publish / Unpublish buttons. Server Action wrapping fetch + `revalidateTag('agency:{slug}')`.
3. Tailwind config: extend with `brand-primary` semantic color reading the CSS var.
4. `next.config.js`: add `images.remotePatterns` entry for the R2 public base URL.
5. Generate orval client; update infrastructure types.

**Acceptance:**
- Create test agency in seed → set status=PUBLISHED via dashboard → `/test-agency` renders themed page.
- Set status=DRAFT → page returns 404. Set `Tenant.isActive=false` → 404.
- Reserved slug `login` rejected by tenant create endpoint with 422.
- WCAG-failing color (`#FFFF00`) rejected with validation error.
- Lighthouse: SSR confirmed (View Source contains hero text).

---

### Slice B — Rides + segment pricing

**Goal:** Public ride catalog + detail page; agencies manage per-segment prices in dashboard.

**Backend:**
1. Migration adding:
   ```prisma
   model RideSegmentPrice {
     id              String   @id @default(cuid())
     tenantId        String
     rideId          String
     fromStationId   String
     toStationId     String
     price           Decimal  @db.Decimal(10, 2)
     currency        String   @default("RSD")
     bookingEnabled  Boolean  @default(true)
     createdById     String?
     updatedById     String?
     createdAt       DateTime @default(now())
     updatedAt       DateTime @updatedAt
     tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
     ride            Ride     @relation(fields: [rideId], references: [id], onDelete: Cascade)
     fromStation     Station  @relation("SegmentFromStation", fields: [fromStationId], references: [id], onDelete: Restrict)
     toStation       Station  @relation("SegmentToStation", fields: [toStationId], references: [id], onDelete: Restrict)
     @@unique([rideId, fromStationId, toStationId])
     @@index([tenantId])
     @@index([rideId])
     @@index([rideId, bookingEnabled])
   }
   ```
   Update `Station` relations array accordingly.
2. Hook into `rides.service.ts` create path: after ride creation, generate matrix rows for every `(fromOrderIndex < toOrderIndex)` pair across `[departureStation, ...intermediateStops, arrivalStation]`. Price `0`, bookingEnabled `true`.
3. One-shot backfill script `api/scripts/backfill-segment-prices.ts` for existing rides.
4. New endpoints:
   - `GET /api/rides/:id/segments` (dashboard)
   - `PUT /api/rides/:id/segments` (bulk upsert; agency edits matrix)
   - `GET /api/public/agencies/:slug/rides` (catalog with origin/destination/date filters)
   - `GET /api/public/agencies/:slug/rides/:rideId` (detail; static info)
5. Public DTO includes `priceFrom` (min enabled price), `currency`, `stops[]`, `daysOfOperation`, exception dates.
6. Update agency public DTO to expose `rideCount`.
7. Throttler decorators. E2E. Postman.

**Frontend:**
1. Public:
   - `(storefront)/[agencySlug]/rides/page.tsx` — catalog with filter form (origin/destination/date dropdowns).
   - `(storefront)/[agencySlug]/rides/[rideId]/page.tsx` — detail page (stops, days, gallery placeholder, segment-price matrix display, "Book this ride — coming soon" disabled CTA).
2. Dashboard:
   - On existing ride edit page, add "Pricing & Segments" tab with matrix table. Each cell = price input + enabled toggle. Bulk save.
3. `revalidateTag('rides:{slug}')` after segment save / ride save.

**Acceptance:**
- Create ride → segment-price rows auto-generated for every O/D pair.
- Edit matrix → public catalog reflects new `priceFrom` after revalidate.
- Disable a segment → public detail page shows "Not available" for that O/D.
- Filter `/test-agency/rides?from=X&to=Y` returns only matching routes.

---

### Slice C — End-user auth

**Goal:** Anonymous visitor can sign up, verify email, log in, log out, reset password. Reservations stay disabled.

**Backend:**
1. Migration:
   ```prisma
   model EndUser {
     id                String   @id @default(cuid())
     email             String   @unique
     passwordHash      String?
     firstName         String
     lastName          String
     emailVerifiedAt   DateTime?
     createdAt         DateTime @default(now())
     updatedAt         DateTime @updatedAt
     emailTokens       EmailToken[]
     reservations      Reservation[]
   }
   model EmailToken {
     id          String   @id @default(cuid())
     endUserId   String
     tokenHash   String   @unique
     type        EmailTokenType
     expiresAt   DateTime
     consumedAt  DateTime?
     createdAt   DateTime @default(now())
     endUser     EndUser  @relation(fields: [endUserId], references: [id], onDelete: Cascade)
     @@index([endUserId, type])
   }
   enum EmailTokenType { VERIFY RESET }
   ```
   Add nullable `endUserId` to `Reservation`.
   Refactor `AuditEvent`: make `actorUserId` nullable, add `actorEndUserId String?`, add `actorType AuditActorType` enum (`STAFF | END_USER | SYSTEM`).
2. Module `api/src/end-users/` + `api/src/public-auth/`:
   - `POST /api/public/auth/signup` (email+password+firstName+lastName + honeypot field)
   - `POST /api/public/auth/login`
   - `POST /api/public/auth/logout`
   - `POST /api/public/auth/forgot-password` (always 200, no enumeration)
   - `POST /api/public/auth/reset-password`
   - `GET  /api/public/auth/verify?token=...`
   - `GET  /api/public/auth/me`
3. `MailService` interface + `ConsoleMailService` impl that logs the link.
4. JWT issuer with `aud=end-user`. Cookie: HttpOnly, Secure, SameSite=Lax, root-domain scoped. Existing staff guards updated to reject `aud=end-user`.
5. NIST password validator: min 8 chars, reject from top-1000 list (embed as JSON).
6. Bcrypt cost 12.
7. Throttler:
   - signup: 5/IP/hour, 3/email/hour
   - login: 10/IP/15min, 5/email/15min
   - forgot-password: 3/email/hour, 5/IP/hour
   - verify/reset: 10/IP/hour
8. Audit events for all flows.
9. E2E covering happy path + each abuse vector.

**Frontend:**
1. Platform-level routes (NOT inside `(storefront)`):
   - `app/(auth)/login/page.tsx`
   - `app/(auth)/signup/page.tsx`
   - `app/(auth)/forgot-password/page.tsx`
   - `app/(auth)/reset-password/page.tsx`
   - `app/(auth)/verify/page.tsx`
   All support `?returnTo=` redirect.
2. Storefront navbar shows "Log in / Sign up" → links with `returnTo=/{slug}/...` preserved.
3. After login, navbar shows "Hi, {firstName}" + logout button.
4. Honeypot hidden input on signup form.
5. Forms include CSRF protection via double-submit header on mutating POSTs.

**Acceptance:**
- Sign up → verification email logged to API console with token link → clicking it sets `emailVerifiedAt`.
- Wrong password = same generic error as nonexistent email.
- Forgot-password for unknown email returns 200 with no email sent (silent).
- Staff JWT cannot hit `/api/public/auth/me`. End-user JWT cannot hit `/api/users`.

---

### Slice D — Blog

**Goal:** Agencies manage Markdown blog posts; public visitors read them.

**Backend:**
1. Migration:
   ```prisma
   model BlogPost {
     id              String   @id @default(cuid())
     tenantId        String
     slug            String
     title           String
     excerpt         String?
     contentMarkdown String   @db.Text
     coverImageUrl   String?
     coverImageAlt   String?
     status          BlogPostStatus @default(DRAFT)
     publishedAt     DateTime?
     seoTitle        String?
     seoDescription  String?
     createdById     String?
     updatedById     String?
     createdAt       DateTime @default(now())
     updatedAt       DateTime @updatedAt
     tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
     @@unique([tenantId, slug])
     @@index([tenantId, status, publishedAt])
   }
   enum BlogPostStatus { DRAFT PUBLISHED }
   ```
2. Endpoints:
   - Dashboard CRUD `/api/blog/...` (list/get/create/update/delete/publish/unpublish)
   - Public `GET /api/public/agencies/:slug/blog` (paginated, PUBLISHED only, sorted by `publishedAt` desc)
   - Public `GET /api/public/agencies/:slug/blog/:postSlug` (PUBLISHED only, 404 else)
3. Slug uniqueness check at create/update (per tenant).
4. E2E, Postman, OpenAPI.

**Frontend:**
1. Public:
   - `(storefront)/[agencySlug]/blog/page.tsx` — paginated list (12/page, cursor-based).
   - `(storefront)/[agencySlug]/blog/[postSlug]/page.tsx` — render Markdown (use `react-markdown` + `remark-gfm`; sanitize), print stylesheet, Web Share button.
   - `generateMetadata` per post for SEO.
2. Dashboard:
   - `(dashboard)/storefront/blog/page.tsx` — table.
   - `(dashboard)/storefront/blog/[postId]/page.tsx` — editor (Markdown textarea with live preview pane).
   - "New post" button → `(dashboard)/storefront/blog/new`.
3. Revalidate `blog:{slug}` + `agency:{slug}` (landing shows latest 3 posts).

**Acceptance:**
- Draft post → public 404.
- Publish → public list shows it, detail page renders sanitized HTML from Markdown.
- Cover image alt text required on save.

---

### Slice E — Gallery (and shared storage module)

**Goal:** Agencies upload gallery images via presigned URLs; storefront renders the gallery.

**Backend:**
1. Refactor: extract generic S3 plumbing from `TicketStorageService` into `api/src/storage/storage.service.ts`. Existing `TicketStorageService` becomes a thin wrapper (or call sites use the new service directly with a `tickets/` key prefix).
2. Migration:
   ```prisma
   model AgencyGalleryImage {
     id        String @id @default(cuid())
     tenantId  String
     url       String
     caption   String?
     altText   String   // required
     order     Int    @default(0)
     createdAt DateTime @default(now())
     tenant    Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
     @@index([tenantId, order])
   }
   ```
3. Endpoints:
   - `POST /api/storefront/uploads/presign` (auth; returns presigned PUT URL + final public URL; validates MIME `image/jpeg|png|webp|avif` + max 5 MB; key `storefront/{tenantId}/gallery/{uuid}.{ext}`)
   - Same endpoint variant for hero/logo/blog covers (different key prefix).
   - `GET/POST/PUT/DELETE /api/storefront/gallery` (CRUD).
   - `GET /api/public/agencies/:slug/gallery`.
4. Reorder endpoint (`PUT /api/storefront/gallery/reorder` with array of IDs).
5. E2E mocking S3 client.

**Frontend:**
1. Dashboard `(dashboard)/storefront/gallery/` — drag-and-drop grid (use existing react-dnd or `@dnd-kit`), each tile has image + alt-text input + caption + delete. Add upload button — file picker → presign → PUT to S3 → POST metadata to API.
2. Add upload affordance to Slice A's hero/logo/OG image fields (same flow).
3. Public storefront landing renders gallery section (if enabled + images exist) with `next/image`.

**Acceptance:**
- Upload 5 MB JPEG → succeeds. 6 MB → 422 from presign.
- Upload PDF → 422.
- Reorder via drag → public storefront reflects order after revalidate.
- Required altText enforced server-side.

---

### Slice F — SEO polish

**Goal:** Storefront scores well on Lighthouse SEO + Rich Results Test.

**Backend:**
1. Endpoint feeding sitemap data: `GET /api/public/sitemap-data` (active+published tenants, their published blog posts, ride detail URLs).
2. Endpoint for `Organization` + `BlogPosting` JSON-LD data is part of existing public DTOs — no new endpoints needed.

**Frontend:**
1. `app/sitemap.ts` — dynamic, builds entries from `/api/public/sitemap-data`. 3600s revalidate.
2. `app/robots.ts` — if `process.env.APP_ENV !== 'production'` return blanket disallow; else allow public paths, disallow `/api`, `/(dashboard)`, `/login`, `/signup`, `/forgot-password`, `/verify`, `/reset-password`.
3. JSON-LD components:
   - `<OrganizationJsonLd>` on storefront landing.
   - `<BlogPostingJsonLd>` on blog post page.
4. Canonical URLs via `generateMetadata` `alternates.canonical` on every storefront page.
5. Favicon support: `AgencyStorefront.faviconUrl` field (additive migration), wire into layout `<head>`.
6. OG image fallback chain in `generateMetadata`: `ogImageUrl` → `heroImageUrl` → `logoUrl` → platform default.
7. Cookie consent banner (simple Accept/Reject UI; auth cookie marked strictly-necessary).

**Acceptance:**
- Run Google Rich Results Test on `/test-agency` and `/test-agency/blog/some-post` — both pass.
- Lighthouse SEO score ≥ 95 on storefront landing.
- `curl https://staging.../robots.txt` shows full disallow.
- `curl https://prod.../sitemap.xml` lists every published agency + post.

---

### Slice G — Hardening

**Goal:** Tune throttler, finalize audit, formalize abuse defenses.

**Backend:**
1. Centralize throttler config; ensure every public + auth + admin endpoint has appropriate decorator.
2. Implement password top-1000 blocklist (embed `top-1000-passwords.json`).
3. Session token rotation on password reset + email change.
4. Generic-error audit pass on auth endpoints; remove any leaks.
5. Honeypot enforcement on signup (already in Slice C; verify + add e2e for bot path).
6. Add `AuditEvent` writes everywhere they're missing (especially public auth flows from Slice C if anything was missed).
7. Bump test coverage to include 429 cases.

**Frontend:**
1. Friendly 429 page / inline error states on auth forms.
2. Document Cloudflare WAF recommended rules in `docs/operations/cloudflare-waf.md` (non-blocking ops doc).

**Acceptance:**
- Hammer login with wrong password 11 times → 429 with `Retry-After` header.
- Pass top-1000 password to signup → 422 with "Password is too common."
- Reset password → all existing end-user sessions invalidated; staff sessions unaffected.

---

## 3. Out of Scope (do not start without explicit approval)

End-user reservations · Payments · Subdomains · Social login · Multilingual content · BusTrip JSON-LD · Captcha / Turnstile · Redis · Cloudflare WAF rules in code · Multi-author blog · Scheduled publishing · Blog tags/categories · Mobile app · Real email provider · Contact form · Comments · Newsletter · Analytics.

---

## 4. Definition of Done (per slice)

- [ ] Prisma migration committed; `pnpm prisma migrate dev` clean
- [ ] `pnpm openapi:generate` + `pnpm openapi:lint` + `pnpm test:contract` pass
- [ ] All new e2e specs pass; existing specs still pass
- [ ] Postman collection updated; Newman run idempotent
- [ ] UI builds (`pnpm build` in `ui/`)
- [ ] No new ESLint or TypeScript errors
- [ ] Repo memory `/memories/repo/airtable-demo.md` updated with what shipped
- [ ] Manual smoke test on local + staging
