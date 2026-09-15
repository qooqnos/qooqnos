# Fix Notes — 2026-09-14/15

Consolidated patch across two passes. No new marketplace features, matching the
"Foundation correctness ahead of feature breadth" gate in
`docs/REPOSITORY_DEEP_AUDIT_2026-09-13.md`.

Environment note (applies to both passes): this sandbox has no network access
to the npm registry (`npm install` fails with `403 host_not_allowed`). Cross-
package resolution was verified by manually creating the
`node_modules/@qooqnos/*` symlinks npm workspaces would create anyway, and
typechecking used a global TypeScript 6.0.3 already present in the sandbox
(the repo pins `^5.9.2`). Every fix below is a standard strict-mode diagnostic
(`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`)
or a real runtime crash reproduced by executing the code, not a version-
specific quirk, but that's inference — please run the real toolchain
(`npm install && npm run format:check && npm run lint && npm run typecheck &&
npm test && npm run build`) to confirm before merging. ESLint/Prettier/real
`vitest` were not run for the same reason.

## Pass 1 — make the existing code actually compile, build, and run

1. **Legacy `@phoenix/*` imports** in `packages/onboarding/src/atomicity-tests.ts`,
   `security-tests.ts`, `tests.ts` — fixed to `@qooqnos/*`. A prior doc claimed
   this was already done repo-wide; these three files were missed.
2. **Branded-ID mismatch**: same three files built `RequestContext` using a
   single `EntityId`-typed helper for every field, including `requestId`/
   `correlationId`, which are the distinct types `RequestId`/`CorrelationId`.
   Added dedicated `reqId`/`corId` helpers, matching the pattern already used
   correctly in `packages/runtime/src/runtime.ts`.
3. **`exactOptionalPropertyTypes` violations** (a real, load-bearing
   `tsconfig.base.json` setting) surfaced once module resolution let the
   compiler reach these lines:
   - `packages/core/src/index.ts` — `AppError`/`AppErrorShape.requestId`/`details`.
   - `packages/database/src/client.ts` — `RepositoryContext` (foundational:
     every future repository hits this the moment it forwards
     `RequestContext.tenantId`/`workspaceId`).
   - `packages/database/src/services.ts` — `AuditInput`, `OutboxInput`.
   - `packages/runtime/src/authorization.ts` — `AuthorizationRequest.resource`.
4. **`noUncheckedIndexedAccess` violations**:
   - `packages/database/src/migration-catalog.ts` (`parseMigrationPath`) —
     `match[2]` is `string | undefined` under this flag even though the regex
     guarantees it when `match` is non-null; added an explicit guard.
   - `packages/database/src/migrations.ts` (`MigrationRunner.run`) —
     `applied[applied.length - 1]` is possibly `undefined` even after checking
     `.length` on a different expression; narrowed via a local variable.
5. **`noImplicitOverride` violation** — `packages/runtime/src/boot.ts`:
   `RuntimeBootError.cause` shadows the standard ES2022 `Error.cause` without
   `override`.
6. **Readonly/mutable array mismatch** — `D1Database.transaction` required a
   mutable `unknown[]` for `params`, but `TransactionStatement.params` (used
   everywhere) is `readonly unknown[]`. Widened the parameter type instead of
   forcing defensive copies at every call site.
7. **Duplicate `ONBOARDING_PERMISSIONS`** declared in both
   `packages/onboarding/src/authorization.ts` and `manifest.ts`, which made
   `index.ts`'s `export *` ambiguous (`TS2308`). `manifest.ts` now imports it
   from `authorization.ts`.
8. **Circular import inside `packages/database`, real runtime crash** — every
   sibling file imported `D1Database`/`DatabaseError`/`Repository` from
   `./index`, while `index.ts` re-exported all of them via `export *`. `tsc`
   doesn't catch this (types have no evaluation order); it reproduces as
   `ReferenceError: Cannot access 'DatabaseError' before initialization` when
   the code is actually executed, which is exactly what `vitest run` would do
   the moment a test imports `@qooqnos/database` through `@qooqnos/runtime`.
   Fixed by extracting the base pieces into a new leaf module, `client.ts`,
   that nothing needs to import back from `index.ts` for. `index.ts` is now a
   plain re-export barrel.
9. **Tests existed but were never run** — `atomicity-tests.ts`,
   `security-tests.ts`, `tests.ts` export `assertOnboarding*` functions with no
   `describe`/`it` and filenames that don't match vitest's default
   `*.test.ts`/`*.spec.ts` pattern, so `vitest run` silently ran zero tests.
   Added `onboarding.test.ts`, wrapping the existing six functions unchanged.
10. A TS2367 narrowing quirk in `assertOnboardingLifecycle` (`tests.ts`): after
    `if (current.status !== "submitted") throw ...`, the compiler narrows
    `current.status` to the literal `"submitted"` and — in this TypeScript
    version — stays narrowed across the following `await service.verify(...)`,
    even though that call reassigns `current` through a closure. The next
    comparison (`!== "verified"`) then gets flagged as comparing two literals
    with no overlap. Fixed by reading `current.status` into an explicitly
    `OnboardingStatus`-typed local right before each comparison.

**Verified:** `tsc -b` (the command behind both `npm run typecheck` and
`npm run build`) exits 0 for all five packages from a clean state. All six
`assertOnboarding*` functions were executed directly (not just type-checked)
against the fixed source and pass.

## Pass 2 — implement the migration lock manifest

`docs/MIGRATION_LOCK_STRATEGY.md` says implementation was "intentionally
deferred until the repository build/test foundation can verify the lock
manifest deterministically" — which Pass 1 now provides, so this closes the
second of the three items named in the audit doc's current gate (root
build/CI contract; **migration lock strategy**; tests for the repaired
invariants).

- **New `packages/database/src/migration-lock.ts`**: `MigrationLockEntry`,
  `MigrationLockManifest`, `MigrationLockError` (extends `DatabaseError`, same
  hierarchy as `MigrationIntegrityError`), `generateMigrationLock`,
  `verifyMigrationLock`. Implements verification rules 1-4 from the strategy
  doc (contiguous versions, every source migration in the lock exactly once,
  every lock entry maps to a definition, checksum equality). Rule 5 (applied
  D1 checksum) stays `MigrationRunner`'s job; rule 8 (lock changed without a
  migration changing) is a git/CI-history check, out of scope for a pure
  in-process function, and still needs a CI script.
- **New `packages/database/src/hash.ts`**: while wiring this up I needed a
  third copy of the same 3-line SHA-256 helper that already existed
  separately in both `migrations.ts` and `migration-catalog.ts` — extracted it
  once instead, and pointed both existing call sites at it.
- **`packages/database/src/index.ts`**: exports the new module.
- **`packages/runtime/src/boot.ts`**: `RuntimeBootOptions` gained an optional
  `migrationLock`. When supplied, `RuntimeBoot.start()` verifies it against
  the resolved migration definitions before the runner applies them, so the
  mechanism is actually wired into the boot sequence rather than left as an
  unused utility.
- **New `migrations/migration-lock.json`**: generated from the two real,
  existing migrations using the actual `loadMigrationCatalog` +
  `generateMigrationLock` functions (not hand-written). Checksums cross-
  checked against Node's built-in `crypto.createHash("sha256")` independently
  of this repo's Web Crypto-based implementation — they match.
- **New `packages/database/src/migration-lock.test.ts`**: seven cases (happy
  path, checksum tampering, missing lock entry, unknown lock entry,
  non-contiguous versions, identity mismatch).
- **`docs/MIGRATION_LOCK_STRATEGY.md`**: updated only the Status paragraph to
  point at the new implementation; the architecture rules themselves are
  untouched.

**Verified:** all 7 new tests were actually executed (not just type-checked)
against a minimal real `describe`/`it`/`expect` harness, all pass. Separately,
round-tripped the *real* migrations against the *real* committed lock file end
to end: verification passes, and a synthetic tamper (flipping one checksum in
memory) is correctly rejected with `MigrationLockError`. Full workspace
`tsc -b` still exits 0 after these additions.

## Still open (not attempted here)

- Wiring an actual CI step/script around `verifyMigrationLock`, and rule 8's
  git-diff-aware "lock changed without a migration changing" check — needs
  real CI/git access this sandbox doesn't have.
- Automated regression tests for the *other* invariants
  `docs/REPOSITORY_DEEP_AUDIT_2026-09-13.md` already lists as "fixed" but
  unverified by a test (idempotency claim race, onboarding optimistic-
  concurrency CAS, owner-membership tenancy check). These need a believable
  in-memory D1 fake (matching real `ON CONFLICT ... DO UPDATE ... WHERE`
  semantics) to test properly without a real SQLite/D1 binding, which is a
  bigger, separate piece of work than what's in this patch.
- Real `npm install` / ESLint / Prettier / `vitest run` — please run these for
  real; see the environment note at the top.
