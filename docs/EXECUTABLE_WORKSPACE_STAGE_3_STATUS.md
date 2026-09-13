# Executable Workspace Stage 3 — Verification Status

Date: 2026-09-13

## Scope

Stage 3 turns the frozen package graph into a repository-level verification contract. The repository uses npm workspaces and the canonical `@qooqnos/*` package namespace.

## Verified repository facts

- Root workspace declares `packages/*` as workspaces.
- Root lifecycle scripts exist for format, lint, typecheck, test, and build.
- Canonical packages are `@qooqnos/core`, `@qooqnos/database`, `@qooqnos/i18n`, `@qooqnos/runtime`, and `@qooqnos/onboarding`.
- Database depends on core.
- Runtime depends on core and database.
- Onboarding depends on core, database, and runtime.
- No `@phoenix/*` namespace references remain in the indexed repository.
- TypeScript solution references cover the five canonical packages.

## CI gate

`.github/workflows/ci.yml` now defines the non-negotiable repository verification order:

1. install dependencies
2. format check
3. lint
4. typecheck
5. unit tests
6. build

A future deployment gate must consume this verification result rather than duplicate package-level checks.

## Important limitation

The GitHub repository connector can author and inspect repository files, but it does not execute `npm install`, TypeScript, ESLint, Prettier, or Vitest inside the repository. Therefore this stage records and commits the executable CI gate; actual green execution must be established by GitHub Actions after the workflow runs.

## Next gate

The next implementation step is to make the CI gate executable end-to-end by ensuring every referenced tool exists in the root dependency graph and every package has a coherent TypeScript build/test boundary. No deployment configuration should be treated as production-ready before that gate passes.
