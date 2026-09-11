# surp

Reservation and dispatch software for Serbian intercity bus agencies.
`api/` is NestJS + Prisma + PostgreSQL, `ui/` is Next.js. The OpenAPI schema in
`api/docs/openapi.json` is generated from the Nest decorators and the UI client
in `ui/infrastructure/generated/` is generated from that schema — never edit
either by hand.

## Language

**Write everything in English.** Commit messages, PR titles and bodies, GitHub
issues, code comments, documentation and READMEs.

The single exception is user-facing UI copy — labels, toasts, validation
messages, and anything else a bus-agency employee reads on screen. Those are
Serbian, written in Latin script without diacritics, matching the existing
components.

The language the request arrives in says nothing about the language the artifact
should be written in.

## Working on production data

The production database holds live reservations. See the working rules in the
data-integrity epic (issue #15); in short: additive migrations only, checks ship
read-only before their repairs, backfills run a dry run first, and nothing is
written to production before the same step has run against a restored backup.
