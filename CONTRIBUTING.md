# Contributing to SURP

Thanks for helping. SURP handles live reservations, so changes are kept small
and verified before they merge.

## Workflow

1. Branch from `rolling` (staging). `master` is production.
2. Keep each pull request to one focused change and open it against `rolling`.
3. Fill in the pull request template.

## Before you open a pull request

API changes:

```bash
pnpm --dir api lint
pnpm --dir api test
pnpm --dir api test:contract
```

UI changes:

```bash
pnpm --dir ui lint
pnpm --dir ui build
```

The full list of checks is in [quality gates](api/docs/quality-gates.md).

## Rules worth knowing

- **Tests.** New behavior needs tests, including at least one failure case.
- **Generated code.** `api/docs/openapi.json` and `ui/infrastructure/generated/`
  are generated. Never edit them by hand; regenerate and commit them when the
  API contract changes.
- **Migrations.** Additive only. Production data is never rewritten in place.
- **Language.** Code, comments, commits, and docs are in English. On-screen UI
  text is Serbian, Latin script, without diacritics.
