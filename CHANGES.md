# Fix Notes — 2026-09-14

Scope: make the executable workspace actually compile, build, and run its tests,
by fixing everything the real toolchain surfaces. No new features, no schema
changes, matching the "Foundation correctness ahead of feature breadth" gate in
`docs/REPOSITORY_DEEP_AUDIT_2026-09-13.md`.

Verified by actually running `tsc -b` (TypeScript, build-mode / project
references) to a clean exit, and by executing the six onboarding assertion
functions end-to-end (not just type-checking them). Could not run the exact
pinned toolchain (`npm install`, ESLint, Prettier, the pinned TypeScript
5.9.2, real `vitest run`) because this sandbox has no network access to the
npm registry — see "Not verified" at the bottom.

## Fixed

1. **Legacy `@phoenix/*` imports** (`packages/onboarding/src/atomicity-tests.ts`,
   `security-tests.ts`, `tests.ts`) — these three files still imported from
   `@phoenix/core` / `@phoenix/runtime`. Only `@qooqnos/*` packages exist in the
   workspace, so this broke module resolution outright.
   `docs/EXECUTABLE_WORKSPACE_STAGE_3_STATUS.md` claims "the legacy `@phoenix/*`
   runtime import was removed from executable source" — that removal missed
   these three files. Fixed to `@qooqnos/*`.

2. **Branded-ID mismatch for `requestId`/`correlationId`** (same three files) —
   all three built a `RequestContext` using a single helper typed as `EntityId`
   for every field, including `requestId` and `correlationId`, which are the
   distinct branded types `RequestId` and `CorrelationId`
   (`packages/core/src/index.ts`). `packages/runtime/src/runtime.ts` shows the
   correct pattern (cast to `RequestContext["requestId"]` specifically). Added
   dedicated `reqId`/`corId` helpers in each file.

3. **`exactOptionalPropertyTypes` violations**, once module resolution let the
   compiler actually reach these lines — this is a real, load-bearing tsconfig
   setting (`tsconfig.base.json`), not a hypothetical one:
   - `packages/core/src/index.ts`: `AppError`/`AppErrorShape`'s `requestId` and
     `details` fields are assigned from other optional fields; needed explicit
     `| undefined`.
   - `packages/database/src/client.ts` (`RepositoryContext`): every repository
     builds this from `RequestContext.tenantId`/`workspaceId`, which are
     themselves optional — same fix. This one is foundational: every future
     repository in every future module hits this the moment it's written.
   - `packages/database/src/services.ts` (`AuditInput`, `OutboxInput`): same
     pattern for audit/outbox metadata built from optional context fields.
   - `packages/runtime/src/authorization.ts` (`AuthorizationRequest.resource`):
     `OnboardingService.authorize()` passes `resource: cond ? {...} : undefined`.

4. **`noUncheckedIndexedAccess` violations**:
   - `packages/database/src/migration-catalog.ts` (`parseMigrationPath`):
     `match[2]` is `string | undefined` under this flag even though the regex
     guarantees it when `match` is non-null; added an explicit guard instead of
     silently returning a possibly-`undefined` `moduleId` typed as `string`.
   - `packages/database/src/migrations.ts` (`MigrationRunner.run`):
     `applied[applied.length - 1]` is `AppliedMigration | undefined` even after
     checking `applied.length === 0` on a different expression; narrowed via a
     local variable instead.

5. **`noImplicitOverride` violation** — `packages/runtime/src/boot.ts`:
   `RuntimeBootError.cause` shadows the standard `Error.cause` (ES2022, part of
   the configured `target`) without the `override` keyword.

6. **Readonly/mutable array mismatch** — `packages/database/src/client.ts`
   (`D1Database.transaction`) required a mutable `unknown[]` for `params`, but
   `TransactionStatement.params` (used everywhere, including
   `D1OnboardingRepository`) is `readonly unknown[]`. Widened the parameter
   type to `readonly unknown[]` instead of forcing every caller to defensively
   copy the array (as `D1DatabaseTransaction.execute` already had to).

7. **Duplicate `ONBOARDING_PERMISSIONS` declaration** —
   `packages/onboarding/src/authorization.ts` and `manifest.ts` both declared
   the same constant, which made `index.ts`'s `export * from "./authorization"`
   + `export * from "./manifest"` ambiguous (`TS2308`). `manifest.ts` now
   imports it from `authorization.ts` instead of redeclaring it — the
   duplication this whole architecture is explicitly designed to prevent
   (see `docs/CAPABILITY_CONTRACT_MATRIX.md` §22, "Anti-duplication decision
   tree") had already crept into a two-file module.

8. **Circular import inside `packages/database`, real runtime crash** — every
   sibling file (`migrations.ts`, `transaction.ts`, `services.ts`,
   `identity-repository.ts`, `workspace-repository.ts`) imported `D1Database`/
   `DatabaseError`/`Repository` from `./index`, while `index.ts` re-exported
   all of them via `export *`. `tsc` doesn't care about this (types don't have
   an evaluation order), so it was invisible to typechecking. It's a real
   `ReferenceError: Cannot access 'DatabaseError' before initialization` at
   runtime, depending on which file the ESM loader reaches first when
   resolving the cycle — reproduced by actually executing the code (see
   below), not by reading it. This is exactly the kind of thing that would
   have surfaced the first time `vitest run` (which uses Vite's ESM-accurate
   module runner) touched a test that transitively imports `@qooqnos/database`
   through `@qooqnos/runtime`. Fixed by extracting the base pieces
   (`D1Database`, `DatabaseError`, `Repository`, `RepositoryContext`, the D1
   interfaces) into a new leaf module, `client.ts`, that nothing in the
   package needs to import back from `index.ts` for. `index.ts` is now a
   plain re-export barrel with no logic of its own.

9. **Tests existed but were never run by `npm test`** —
   `atomicity-tests.ts`, `security-tests.ts`, and `tests.ts` export
   `assertOnboarding*` functions but have no `describe`/`it` blocks and don't
   match vitest's default `*.test.ts` / `*.spec.ts` include pattern, so
   `vitest run` silently found zero tests. This matches the "Executable
   build/test/CI foundation: approximately 35%" line and the stated next-gate
   item "Add package-level smoke/unit tests where contracts are currently
   untested" in `docs/REPOSITORY_DEEP_AUDIT_2026-09-13.md`. Added
   `onboarding.test.ts`, which imports the existing six assertion functions
   unchanged and wraps each in `describe`/`it` so they're actually discovered
   and run. Did not rename or restructure the existing files, since something
   outside this package might already invoke them directly by path.

## A TS2367 narrowing quirk worth knowing about

`packages/onboarding/src/tests.ts` (`assertOnboardingLifecycle`) mutates a
`let current: OnboardingProfile` from inside closures passed to the mock
repository (`setStatus`/`setStatusAndRecord`). After
`if (current.status !== "submitted") throw ...`, the compiler narrows
`current.status` to the literal `"submitted"` — and, in this TypeScript
version, it stays narrowed across the following `await service.verify(...)`,
even though that call does end up invoking the closure that reassigns
`current`. The next comparison (`!== "verified"`) then gets flagged as
comparing two literals with no overlap (`TS2367`), which would have made the
"submitted → verified" transition impossible to assert. Fixed by reading
`current.status` into an explicitly `OnboardingStatus`-typed local right
before each comparison, which forces the widened type. Worth being aware of
if similar patterns show up elsewhere (mutating shared state from closures
handed to a collaborator, then asserting on it afterwards).

## Verified

- `tsc -b` (the command behind both `npm run typecheck` and `npm run build`)
  completes with exit code 0 for all five packages, from a clean
  `*.tsbuildinfo`/`dist` state, using project references in dependency order
  (core → database/i18n/runtime → onboarding).
- All six `assertOnboarding*` functions were executed directly (not just
  type-checked) against the real, fixed source and pass.

## Not verified (no network access in this environment)

- `npm install` against the real npm registry (blocked: `403 Forbidden`,
  `host_not_allowed`). Cross-package resolution was verified instead via
  manually created `node_modules/@qooqnos/*` symlinks, which is what npm
  workspaces would create anyway.
- The exact pinned TypeScript version (`^5.9.2` in `package.json`) — verified
  instead with a global TypeScript 6.0.3 already present in this sandbox.
  Everything above is a standard-strict-mode compiler diagnostic
  (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`), not a version-specific quirk, so it should reproduce
  identically on 5.9.2, but that's inference, not something I watched happen.
- ESLint and Prettier (not installed, no global fallback available in this
  sandbox) — please run `npm run lint` and `npm run format:check` for real
  before merging.
- `vitest run` itself — not installed. Verified the underlying logic
  end-to-end with a direct Node/tsx execution of the six assertion functions
  instead, and typechecked `onboarding.test.ts` against a minimal local-only
  stand-in for the `vitest` module's types (`describe`/`it` signatures only).
  That stand-in is not part of this patch; real `vitest` types will apply once
  `npm install` runs for real. Please run `npm test` to confirm the six cases
  render correctly as vitest output.

## Not touched

Everything else in the repository — 100+ architecture documents, the other
`.claude/skills/*`, CI config, migrations, and every file that already
compiled and had no reachable bug. No new marketplace features, matching the
audit doc's current gate.
