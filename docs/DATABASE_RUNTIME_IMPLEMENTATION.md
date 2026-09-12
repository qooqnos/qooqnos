# Phoenix Database Runtime Implementation

## Purpose

This document records the executable database foundation added after the architecture phase.

## Boundaries

- D1 remains the authoritative transactional store.
- Application code reaches D1 through the `packages/database` abstraction.
- SQL is parameterized; values are never interpolated into statements.
- Workspace context is an explicit repository boundary.
- Audit, idempotency and outbox concerns are represented as application services.
- Migrations remain append-only.

## Current implementation

### `packages/database/src/index.ts`

Provides a small D1-compatible adapter with:

- parameter binding
- `first`, `all`, and `run`
- batch transactions
- database error normalization
- repository workspace-context guard

### `packages/database/src/services.ts`

Provides:

- `AuditService.append`
- `IdempotencyService.claim/complete`
- `OutboxService.enqueue`

## Required hardening before production

1. Add migration runner with ordered version checks and checksum validation.
2. Add repositories for identity/workspace entities.
3. Make tenant isolation mandatory at repository API level rather than convention-only.
4. Add concurrency-safe idempotency claim tests and define replay semantics.
5. Add outbox claiming/publishing/retry/dead-letter policy.
6. Add retention and redaction policies for audit and sensitive records.
7. Add integration tests against the actual D1 runtime.
8. Add CI gates for typecheck, tests, migration integrity and build.

## Source alignment

The initial database model defines the core relationship chain around User, Membership, Organization, Workspace and the future Business/Service hierarchy, and requires tenant context, opaque public IDs, UTC timestamps, minor-unit money and migration-only schema changes. fileciteturn138file0L2-L2

The current foundation intentionally implements only the infrastructure needed underneath those future domain modules; it does not prematurely implement every domain table.
