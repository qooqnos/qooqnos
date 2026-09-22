# Phoenix Database Runtime Implementation

**Status:** Current runtime contract  
**Last reviewed:** 2026-09-22

## Purpose

This document records the executable database foundation for the current Cloudflare D1 architecture.

## Canonical boundaries

- D1 is the authoritative transactional store.
- Application code reaches D1 through packages/database.
- SQL is parameterized; values are never interpolated into statements.
- Organization/workspace context is an explicit repository boundary.
- Audit, idempotency and outbox concerns are represented as application services.
- Schema changes are append-only migrations.
- Derived search/vector/cache/analytics structures are not sources of truth.

## Runtime path

```
Cloudflare Worker
      ↓
API / Runtime
      ↓
D1Database
      ↓
Repository / domain service
      ↓
D1
```

Migration boot path:

```
migrations/*.sql
      ↓
loadMigrationCatalog
      ↓
verifyMigrationLock
      ↓
MigrationRunner
      ↓
schema_migrations
      ↓
D1
```

## Migration source contract

The canonical migration contents live only in migrations/*.sql.

The build/runtime layer supplies MigrationSource entries to the catalog loader. The loader derives:

- migration id
- version
- owning module
- exact SQL
- checksum
- executable statements

The lock manifest protects reviewed migration identity/checksum.

No handwritten TypeScript migration constant is allowed to become a second schema source.

## Current migration sequence

apps/api/src/migrations.ts currently references 0001 through 0013:

```
0001_foundation.sql
0002_onboarding.sql
0003_identity_sessions.sql
0004_business.sql
0005_catalog.sql
0006_catalog_product_guards.sql
0007_catalog_integrity_guards.sql
0008_permission_catalog.sql
0009_media.sql
0010_discovery.sql
0011_ai_seller_creation.sql
0012_ai_seller_catalog_link.sql
0013_ai_seller_idempotency_fingerprint.sql
```

## Tenant isolation

Repositories must require the correct organization/workspace context for tenant-owned data.

Cross-organization access is rejected server-side even when a record id is otherwise valid.

UI routes, URLs, AI context and discovery indexes never define authorization scope.

## Legacy PostgreSQL reconciliation warning

The source tree still contains historical PostgreSQL-oriented files:

- packages/database/src/postgres-adapter.ts
- packages/database/src/postgres-database.ts
- an older PostgreSQL-style migration runner in packages/database/src/migrations.ts
- old database exports in packages/database/src/index.ts

These are not the canonical runtime boundary.

There is currently a source-level mismatch to reconcile: runtime boot expects the D1 catalog/lock MigrationRunner contract, while the legacy packages/database/src/migrations.ts and related exports still contain the old PostgreSQL-oriented API.

Until that reconciliation is completed:

- do not extend the legacy migration runner;
- do not add migrations to BUILTIN_MIGRATIONS;
- do not add new PostgreSQL/SQLite adapters;
- do not update USE_POSTGRES documentation;
- do not create a second schema registry.

The correct fix is to converge the remaining consumers onto the canonical D1 contract, verify the full build/test/runtime path, and then remove or archive the legacy code.

## Production hardening

Before production:

1. make the D1 migration catalog/runner contract the only active migration API;
2. verify the committed migration lock in CI;
3. run integration tests against actual D1;
4. test cross-tenant access failures;
5. test idempotency claims and replay behavior;
6. test outbox claiming, retry and dead-letter semantics;
7. verify retention/redaction rules;
8. verify critical transaction boundaries and integrity constraints.

## Non-negotiable safety rules

- Never edit an applied migration.
- Never renumber migrations.
- Never create duplicate canonical entities.
- Never bypass repositories/domain services with arbitrary SQL from AI or UI code.
- Never treat search/vector/cache/analytics data as authoritative business state.
- Never use PostgreSQL compatibility files as the starting point for new domain work.
