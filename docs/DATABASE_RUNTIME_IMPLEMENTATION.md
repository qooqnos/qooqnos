# Phoenix Database Runtime Implementation

## Purpose

This document records the executable database foundation added after the architecture phase.

## Boundaries

- D1 remains the authoritative transactional store.
- Application code reaches D1 through the `packages/database` abstraction.
- SQL is parameterized; values are never interpolated into statements.
- Organization/workspace context is an explicit repository boundary.
- Audit, idempotency and outbox concerns are represented as application services.
- Migrations remain append-only.

## Current implementation

### `packages/database/src/index.ts`

Provides a small D1-compatible adapter with:

- parameter binding
- `first`, `all`, and `run`
- batch transactions
- database error normalization
- mandatory organization/workspace repository context guards

### `packages/database/src/services.ts`

Provides:

- `AuditService.append`
- `IdempotencyService.claim/complete`
- `OutboxService.enqueue`

### `packages/database/src/migrations.ts`

Provides:

- contiguous migration version validation
- migration identity/module validation
- SHA-256 checksum validation for pending definitions
- checksum and identity validation against `schema_migrations`
- transactional D1 batch application with migration history recording
- explicit UTC application timestamps

### `packages/database/src/identity-repository.ts`

Provides:

- user creation and lookup
- external identity creation
- external identity lookup
- user lookup by external identity

### `packages/database/src/workspace-repository.ts`

Provides:

- organization-scoped workspace creation/listing
- workspace lookup requiring both organization and workspace context
- membership creation behind a workspace boundary
- workspace membership lookup

## Required hardening before production

1. Add a build-time migration catalog that derives prepared statements from the canonical SQL files without duplicating SQL sources.
2. Add concurrency-safe idempotency claim tests and define replay semantics.
3. Add outbox claiming/publishing/retry/dead-letter policy.
4. Add retention and redaction policies for audit and sensitive records.
5. Add integration tests against the actual D1 runtime.
6. Add explicit repository tenant-isolation tests, including cross-organization access attempts.
7. Add authorization runtime before exposing membership/role operations to application modules.
8. Add CI gates for typecheck, tests, migration integrity and build.

## Source alignment

The initial database model defines the core relationship chain around User, Membership, Organization, Workspace and the future Business/Service hierarchy, and requires tenant context, opaque public IDs, UTC timestamps, minor-unit money and migration-only schema changes. fileciteturn138file0L2-L2

The current foundation intentionally implements only the infrastructure needed underneath those future domain modules; it does not prematurely implement every domain table.
