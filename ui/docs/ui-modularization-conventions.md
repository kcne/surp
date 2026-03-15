# UI Modularization Conventions

These conventions define how UI code should be organized in the `ui` app while store interfaces remain stable.

## 1) Page Responsibilities

- Keep page files in `app/(dashboard)/**/page.tsx` as thin containers.
- Pages should compose feature components and call feature hooks.
- Avoid placing long business workflows directly in page files.

## 2) Feature Component Boundaries

- Use feature folders under `components/<feature>/`.
- Prefer splitting large components into:
  - orchestration container (state wiring)
  - presentational sections (pure UI props in, callbacks out)
- Keep feature UI reusable across routes where possible.

## 3) Hooks and State Orchestration

- Put reusable orchestration logic in `hooks/use<Feature>*.ts`.
- Hooks may call existing stores but should not mutate store contracts.
- Use hooks to isolate effect chains, derived state, and action handlers.

## 4) Forms (react-hook-form + zod)

- Use typed schemas and resolver-driven validation.
- Centralize default values and reset behavior.
- Use `useWatch` for dependent fields instead of local duplicated state.
- Keep submit handlers in dedicated hooks for complex forms.

## 5) Tables (TanStack + shared UI)

- Keep feature table columns in dedicated modules.
- Use shared DataTable primitives for pagination/search interactions.
- Keep filter logic near table container; keep cells presentational.

## 6) Dialogs and CRUD Flows

- Use shared modal shells for consistent structure.
- Use shared confirm delete dialog for destructive actions.
- Keep create/edit/delete open/close logic in dedicated dialog-state hooks.

## 7) File Naming and Structure

- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utilities: `<feature><Purpose>Helpers.ts`
- Keep feature-local types close to feature if not globally shared.

## 8) Quality Gates

- `pnpm lint` must pass before merge.
- Preserve behavior parity while refactoring UI structure.
- Prefer small, composable components over large monolith files.
