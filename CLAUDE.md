# surp

Reservation and dispatch software for Serbian intercity bus agencies.
`api/` is NestJS + Prisma + PostgreSQL, `ui/` is Next.js. The OpenAPI schema in
`api/docs/openapi.json` is generated from the Nest decorators and the UI client
in `ui/infrastructure/generated/` is generated from that schema — never edit
either by hand.

## Language

**Write everything in English.** Commit messages, PR titles and bodies, GitHub
issues, code comments, documentation and READMEs.

The single exception is user-facing product text — labels, toasts, validation
messages, emails, generated documents, and anything else a bus-agency employee
or a visitor reads on screen. That text ships in both Serbian and English.

Serbian is written in Latin script **with** diacritics: "Sačuvaj", "Četvrtak",
"Obriši". This replaces the earlier no-diacritics rule. English uses `en-US`
spelling, dates, and numbers; schedule times stay on a 24-hour clock in both.

Product text lives in the message catalogs under `ui/i18n/messages/<locale>/`,
never inline in a component. Serbian is the default locale and the emergency
fallback for a missing message. `pnpm --dir ui test` rejects catalogs that have
drifted apart, and it runs on every pull request.

Text a user typed — passenger names, notes, station names, an agency's own
storefront copy — is rendered as written and never translated. Tenant timezone
and currency follow the agency, not the reader's language.

See `ui/docs/localization-inventory.md` for which issue owns which surface and
`ui/docs/adding-a-locale.md` for adding a language.

The language the request arrives in says nothing about the language the artifact
should be written in.

## Working on production data

The production database holds live reservations. See the working rules in the
data-integrity epic (issue #15); in short: additive migrations only, checks ship
read-only before their repairs, backfills run a dry run first, and nothing is
written to production before the same step has run against a restored backup.

## Quality gates and independent review

Before considering any change complete, run the applicable lint, type-check,
test, build, and generated-contract checks. Do not report a change as complete
when a relevant check has not been run or is failing. At minimum, API changes
require `pnpm --dir api lint`, `pnpm --dir api test`, and
`pnpm --dir api test:contract`; UI changes require `pnpm --dir ui lint`,
`pnpm --dir ui test`, and `pnpm --dir ui build`.

New features and behavior changes must include focused automated tests for the
new behavior, including failure cases when they affect validation, permissions,
or data integrity. Regenerate and commit OpenAPI and UI-client artifacts when
an API contract changes.

When a feature is complete, prepare a self-contained review prompt for a fresh,
independent agent. It must name the feature, relevant files and behavior,
validation commands and results, and ask the reviewer to look specifically for
correctness, regressions, data-integrity risks, test gaps, and UI/accessibility
issues. Return this prompt in the final chat handoff; do not add it to a pull
request unless the user explicitly asks for that.
