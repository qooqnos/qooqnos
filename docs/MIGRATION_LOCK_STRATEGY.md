# Phoenix Migration Lock Strategy

## Status

Architecture contract for production migration integrity. Initial implementation now exists in `packages/database/src/migration-lock.ts` (`generateMigrationLock`, `verifyMigrationLock`), covering verification rules 1-4 below, with a generated manifest committed at `migrations/migration-lock.json`. `packages/runtime/src/boot.ts` accepts an optional `migrationLock` and verifies it before the migration runner executes. Rule 5 (applied D1 checksum) remains `MigrationRunner`'s existing responsibility. Rule 8 (a lock change without a corresponding migration change) is a git/CI-history check and is not implemented by this module; it still belongs in the eventual CI gate below.

## Problem

Runtime checksum validation proves that an applied migration matches the migration definition currently loaded by the runtime. It does not independently prove that the first deployed definition is the originally reviewed SQL if both SQL and its declared checksum are changed together.

## Decision

Phoenix will maintain a committed migration lock manifest containing, for every migration:

- migration id
- version
- module id
- exact SQL SHA-256 checksum
- immutable migration filename

The lock manifest is reviewed and committed together with a new migration.

## Verification rules

1. Migration filenames and versions are contiguous.
2. Every migration in the source directory appears exactly once in the lock manifest.
3. Every lock entry maps to exactly one migration definition.
4. Runtime/source checksum must equal the lock checksum.
5. Applied D1 checksum must equal both runtime and lock checksum.
6. A checksum mismatch is release-blocking.
7. Historical migration SQL is append-only; correction requires a new migration.
8. Lock-manifest changes without a corresponding migration change are prohibited by CI.

## Bootstrap

A fresh D1 must first ensure the migration metadata table exists, then execute migrations in strict version order. The metadata table creation is bootstrap infrastructure, not a recorded business migration.

## Concurrency

Migration execution must not rely on application-level read/write races. Deployment orchestration should serialize migration execution per D1 database. The runner itself remains defensive by validating history and refusing gaps, identity mismatches, or checksum drift.

## CI gate

The eventual CI pipeline must verify:
```
migration source
→ parse definitions
→ calculate SHA-256
→ compare lock manifest
→ verify sequence
→ typecheck/tests
→ build
```
A failure must stop deployment. `verifyMigrationLock` implements the "compare lock manifest" and "verify sequence" steps for a given set of migration definitions; wiring an actual CI job around it (including rule 8's git-history check) is still open.

## Scope boundary

This strategy protects migration integrity. It does not replace database backups, deployment approvals, rollback planning, or environment-specific operational controls.
