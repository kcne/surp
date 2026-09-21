# Locale routing

How a URL decides which language a page is rendered in.

## The rules

- **Serbian is unprefixed.** `/cene` is Serbian and always will be, so every
  link that existed before this layer keeps working.
- **English adds a segment.** `/en/cene`. Slugs are never translated, so a
  page has exactly one path per language.
- **`/sr/...` redirects (308) to the unprefixed path.** It is a valid way to
  ask for Serbian but not the canonical URL for it, so the same page is never
  indexed at two addresses.
- **The URL decides the language everywhere except `/`.** Opening
  `/reservations` serves Serbian even for a reader whose saved language is
  English — otherwise a link one colleague sends another would open
  differently for each of them.
- **`/` is the one exception**, because it has no segment to read. It consults
  the saved cookie, then `Accept-Language`, then falls back to Serbian, and
  redirects to `/en` when the answer is English. The redirect is temporary and
  the response is `private, no-store` with `Vary: Accept-Language, Cookie`:
  the answer differs per visitor, so neither the browser nor a CDN may reuse
  it for someone else.
- **Nothing here writes the language cookie.** Only the language switcher does
  (#68). Following a link is not a choice about language.
- **No language lookup touches the database.** Everything above is the URL, a
  cookie, and a header.

`middleware.ts` implements all of it, and `__tests__/middleware.test.ts` is
where the rules are pinned down.

## What stays outside

API routes, Next.js internals, `md/[slug]`, `llms.txt`, `llms-full.txt`,
`robots.txt`, `sitemap.xml`, and anything with a file extension are excluded
by the middleware matcher and live outside `app/[locale]`. Bilingual metadata
and text routes are #74's to design.

## Tenant slugs

Storefronts live at the root — `/moja-agencija` — so a locale segment and a
tenant slug compete for the same names. `sr` and `en` are in
`RESERVED_TENANT_SLUGS`, and the `tenant.slug-reserved` invariant reports
tenants that already hold a reserved word. It never renames one. Adding a
locale means repeating both steps; see `adding-a-locale.md`.

## Two Next.js 14 constraints worth knowing before you touch this

Both were found by measuring against `master`, and both are load-bearing.

### A `not-found.tsx` must not read request state

Anything in a `not-found.tsx` that reads the request — `headers()`, or
next-intl's `getTranslations`/`useLocale`, which fall back to it — makes Next
serve **every route in that segment** `private, no-store`. For the marketing
pages that means losing `s-maxage=31536000` and with it all CDN caching.

But a `not-found.tsx` receives no route params, so it has no other way to
learn the locale. `i18n/active-locale.ts` is the way out: a `cache()`-backed
holder, which is per-render and not a dynamic API. The route that calls
`notFound()` writes the locale it got from its own params; the boundary reads
it back. The write has to happen **before** the first `await` in that route,
or it does not reach the boundary.

### A `not-found.tsx` must be a server component, next to the route that throws

Two smaller rules with the same symptom — Next silently renders its own
untranslated 404 instead of yours:

- A `not-found.tsx` that is a client component, or that renders one, is
  ignored.
- Next resolves the boundary **beside** the route that called `notFound()`,
  not from an ancestor segment. Every such route therefore has its own
  `not-found.tsx`, each a one-line re-export of a shared body in
  `components/errors/`.

`app/[locale]/[...rest]/page.tsx` exists for the same reason: without it a
path matching no route falls out of `app/[locale]` entirely and gets Next's
built-in 404, which has neither a locale nor a layout.

### Known gap

An unknown blog slug under `/en` — `/en/blog/nema-ovoga` — returns 404 with
Next's built-in page rather than the marketing 404. The Serbian equivalent is
correct, as is every other unknown path in both languages. The status code is
right either way; only that one page's styling and language are wrong. Adding
`locale` to that route's `generateStaticParams` makes it worse, not better.
