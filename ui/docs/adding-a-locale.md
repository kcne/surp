# Adding a locale

A new language is a registry entry plus a set of catalogs. Nothing else — no
database migration, no enum, no routing rewrite, no per-user preference
column, no API change.

The example below adds German (`de`).

## 1. Register the locale

Add an entry to `LOCALES` in `i18n/locales.ts` and the key to
`SUPPORTED_LOCALES`:

```ts
export const SUPPORTED_LOCALES = ["sr", "en", "de"] as const

export const LOCALES: Record<SupportedLocale, LocaleDefinition> = {
  // ...
  de: {
    locale: "de",
    formattingLocale: "de-DE",
    htmlLang: "de",
    ogLocale: "de_DE",
    nativeName: "Deutsch",
    englishName: "German",
    firstDayOfWeek: 1,
  },
}
```

Every field matters:

- **`formattingLocale`** is the tag `Intl` and next-intl receive. It is not
  always the registry key: bare `sr` resolves to Cyrillic in CLDR, which is
  why Serbian uses `sr-Latn-RS`. Check what your tag actually produces before
  committing it:

  ```sh
  node -e 'console.log(new Intl.DateTimeFormat("de-DE",{month:"long"}).format(new Date()))'
  ```

- **`firstDayOfWeek`** is a `Date#getDay` index. Calendars read it instead of
  `Intl.Locale#getWeekInfo`, which Node 20 does not implement.

Changing `DEFAULT_LOCALE` is a different, much larger change: it moves which
URLs are unprefixed and which locale serves the emergency fallback. Adding a
locale does not touch it.

## 2. Add the catalogs

Copy the default locale's catalogs and translate them:

```sh
cp -R i18n/messages/sr i18n/messages/de
```

There must be one file per namespace in `MESSAGE_NAMESPACES` — the check
below fails on a missing file, so do not delete the ones you have not
translated yet.

Translate every value. Keep:

- the key structure identical to the default locale's;
- every ICU placeholder, by name and by kind — `{count, plural, ...}` in one
  locale and `{count}` in another renders but silently drops the plural forms;
- every plural category the language actually uses. German needs `one` and
  `other`; Serbian needs `one`, `few`, and `other`. The check derives the
  required set from `Intl.PluralRules`, so it will tell you which are missing;
- the weekday and month arrays at 7 and 12 entries, indexed from Sunday and
  January respectively.

## 3. Register the catalogs with the loader

`i18n/messages.ts` imports each catalog by name, so every shipped file is
statically reachable and an unregistered namespace cannot be requested.
Dynamic imports would defeat that, so add the imports explicitly:

```ts
import deAuth from "./messages/de/auth.json"
// ...one per namespace

const CATALOGS = {
  // ...
  de: { auth: deAuth, common: deCommon, /* ... */ },
}
```

`i18n/format.ts` imports `common` separately, because it is the one i18n
module client components reach and `messages.ts` would pull every namespace
of every language into the browser bundle with it. Add the locale there too:

```ts
import deCommon from "./messages/de/common.json"

const COMMON: Record<SupportedLocale, typeof srCommon> = { sr: srCommon, en: enCommon, de: deCommon }
```

Both maps are exhaustive over `SupportedLocale`, so `pnpm exec tsc --noEmit`
fails until each has its entry — you cannot forget one silently.

## 4. Verify

```sh
pnpm exec tsc --noEmit   # every locale map is exhaustive, so a gap fails here
pnpm test                # registry, formatting, and catalog completeness
pnpm build               # production build
```

`i18n/__tests__/catalogs.test.ts` is the gate: it checks key parity, ICU
validity, placeholder names and kinds, and plural coverage across every locale
and namespace. It runs on every pull request, so an incomplete catalog cannot
merge.

Add formatting expectations for the new locale to
`i18n/__tests__/format.test.ts` where its output differs interestingly from
the existing ones — collation and plural categories are the usual ones.

## 5. What you do not have to do

- **No database change.** Language is never stored per user; it lives in a
  cookie the language switcher writes.
- **No routing change.** The middleware reads `SUPPORTED_LOCALES`, so a new
  entry gets its `/xx` URL prefix, its place in `Accept-Language` negotiation
  at `/`, and its own 404 pages with no edit to `middleware.ts`. The one thing
  a new locale does need is the slug check below. `locale-routing.md` explains
  the URL rules themselves.
- **No API change.** Responses stay as they are; visible errors are translated
  on the client from stable codes.
- **No separate activation step.** A locale in the registry with complete
  catalogs is live as soon as routing can reach it. There is no supported-but-disabled state — that is what
  the CI check is for.

## One thing a new locale does need: check the slug collision

A locale becomes a URL segment at the root of the site, which is also where
agency storefronts live. Adding `de` makes `/de` a language prefix, so a
tenant whose slug is `de` loses its storefront.

Add the locale to `api/src/platform-tenants/supported-locales.ts`, which feeds
`RESERVED_TENANT_SLUGS`, so no new tenant or converted lead can take it. Then
run the `tenant.slug-reserved` invariant, which reports tenants already
holding the word. It never renames anything: a storefront URL an agency has
printed or linked is not ours to rewrite, so an existing collision is a
conversation with that agency, not a migration.

## What is not locale-dependent

Do not reach for the locale when handling these:

| Concern | Where it lives |
| --- | --- |
| Tenant timezone | `i18n/tenant.ts` (`DEFAULT_TIME_ZONE`), per-tenant from the API |
| Currency | `i18n/tenant.ts` (`DEFAULT_CURRENCY`) — always the tenant's, never the reader's |
| Business dates | `toBusinessDate` / `fromBusinessDate`, computed in tenant time |
| Stored timestamps | Always UTC instants; formatted for display only |
| Schedule times | 24-hour in every locale, and stored wall-clock times never pass through a timezone |
| User-entered text | Passenger names, notes, station names, agency storefront copy — rendered as written |
