# SURP agent guide

These rules apply to every change in this repository. Keep the change focused,
preserve unrelated work, and prefer the repository's existing conventions over
introducing a parallel pattern.

## Before changing code

- Read the closest applicable `README`, module conventions, and relevant tests.
- Inspect the working tree before editing. Do not overwrite or discard changes
  you did not create.
- For API, schema, or UI work, identify whether OpenAPI, generated client code,
  migrations, documentation, and tests are affected before implementation.
- Do not claim a behavior is verified unless the exact relevant command or
  manual check was run.

## Implementation and validation

- Keep tenant isolation, authorization, and audit fields intact on domain
  writes. Never log secrets or unnecessary personal data.
- Make PostgreSQL/Prisma migrations additive and deploy-safe where possible;
  state rollout and rollback implications whenever a migration is included.
- Regenerate checked-in API/client artifacts when their sources change.
- Run the smallest relevant checks while working, then the affected API/UI
  lint, type-check, tests, and contract checks before handoff. If a check is
  not run, state why.
- Do not make external changes—commits, pushes, PRs, deployments, or comments—
  unless the user explicitly requests them.

## Pull requests

Before creating or editing a PR, read `.github/PULL_REQUEST_TEMPLATE.md` in
full and use every applicable section. Do not improvise a replacement format.

- Use normal Markdown newlines; inspect the rendered PR after creation or edit.
- Make the summary decision-useful: explain the user/operational problem and
  the outcome in one to three bullets.
- State meaningful API, schema, generated-code, and UI changes in **Scope**.
- Give reviewers concrete high-signal files and a reproducible verification
  flow in **How to review**.
- List only commands actually run in **Validation**, with their result. Mark
  unrun manual checks or test gaps explicitly rather than implying coverage.
- Assess data, compatibility, authorization, and operational risk in **Risk
  and rollout**. For migrations, state deployment order and rollback posture.
- Complete every applicable checklist item honestly. Link the issue using the
  template's closing syntax, e.g. `Closes #123`.
- Keep the PR limited to the requested work; call out intentional generated
  artifacts and avoid unrelated formatting churn.
