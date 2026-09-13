# Executable Workspace Stage 3 — Verification Status

Date: 2026-09-13

## Scope

Stage 3 turns the frozen package graph into a repository-level verification contract. The repository uses npm workspaces and the canonical `@qooqnos/*` package namespace.

## Completed in this stage

- Root npm workspace is defined over `packages/*`.
- Root lifecycle scripts cover format, lint, typecheck, unit tests, and build.
- The five canonical packages have package identities and dependency boundaries.
- TypeScript project references cover the canonical package graph.
- The legacy `@phoenix/*` runtime import was removed from executable source.
- Root development tooling is now declared explicitly: TypeScript, ESLint, typescript-eslint, Prettier, Vitest, and Node types.
- Repository ESLint and Prettier policies are committed.
- CI defines the verification order: install, format check, lint, typecheck, test, build.

## Dependency direction

`core` is foundational. `database` may depend on `core`. `runtime` may depend on `core` and `database`. `onboarding` may depend on `core`, `database`, and `runtime`. `i18n` remains independent until a concrete contract requires a dependency.

## Verification status

Configuration is now substantially executable, but it is not considered green until GitHub Actions successfully runs the complete gate. The repository connector can commit and inspect files but does not execute the Node toolchain itself.

## Next gate

1. Observe the first CI run and fix compiler/configuration failures from actual output.
2. Add package-level smoke/unit tests where contracts are currently untested.
3. Add contract-test execution to the CI lifecycle.
4. Freeze the verified workspace baseline before deployment work.

## Non-goals

- no microservices split
- no hidden cross-package imports
- no production deployment before verification is green
