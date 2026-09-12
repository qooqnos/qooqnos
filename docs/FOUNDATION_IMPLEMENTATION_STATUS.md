# Phoenix Foundation Implementation Status

## Current milestone

The repository has now moved from architecture-only preparation into the first executable foundation layer.

## Implemented

- `packages/core/src/index.ts`
  - branded identifiers
  - request context
  - application error primitives
  - pagination primitive
  - money primitive
- `packages/runtime/src/index.ts`
  - module manifest contract
  - manifest validation
  - runtime context creation
  - health primitive
- `migrations/0001_foundation.sql`
  - schema migration registry
  - organizations/users/external identities
  - workspaces/memberships
  - roles/permissions
  - module registry/versioning/tenant module state
  - feature flags
  - audit events
  - idempotency records
  - outbox events
  - initial indexes

## Important limitation

This is the first executable scaffold, not production-complete infrastructure. Database repositories, migration execution against a live D1 binding, authentication integration, full authorization evaluation, outbox publishing, idempotency transaction handling, and automated CI execution still need implementation.

## Next milestone

1. `packages/database`
2. D1 adapter and repository primitives
3. migration runner and checksum verification
4. audit service
5. idempotency service
6. outbox repository/publisher boundary
7. runtime boot integration
8. tests for tenant isolation, concurrency and migration integrity
9. Worker/API entrypoint

## Architecture invariant

Business modules must not be implemented by bypassing this foundation. Identity, Business, Catalog and Discovery should be layered on top of the runtime/database contracts rather than creating parallel infrastructure.
