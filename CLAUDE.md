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

## Quality gates and independent review

Before considering any change complete, run the applicable lint, type-check,
test, build, and generated-contract checks. Do not report a change as complete
when a relevant check has not been run or is failing. At minimum, API changes
require `pnpm --dir api lint`, `pnpm --dir api test`, and
`pnpm --dir api test:contract`; UI changes require `pnpm --dir ui build`.

New features and behavior changes must include focused automated tests for the
new behavior, including failure cases when they affect validation, permissions,
or data integrity. Regenerate and commit OpenAPI and UI-client artifacts when
an API contract changes.

When a feature is complete, prepare a self-contained review prompt for a fresh,
independent agent. It must name the feature, relevant files and behavior,
validation commands and results, and ask the reviewer to look specifically for
correctness, regressions, data-integrity risks, test gaps, and UI/accessibility
issues. Add this prompt to the pull request before handoff.
