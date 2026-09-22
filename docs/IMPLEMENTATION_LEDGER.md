# Phoenix Implementation Ledger

**Status:** Current implementation ledger  
**Last reviewed:** 2026-09-22
**Documentation reconciliation commit:** 41e494d1d6b6f13b9d9d33655cfd589b942a4515

This ledger is the continuity record for future coding agents. Completed or superseded work must not be re-implemented merely because an older document still mentions it.

## 1. Capability status

| Capability | Status | Canonical source |
|---|---|---|
| Product North Star | ✅ Complete | docs/PHOENIX_PRODUCT_NORTH_STAR.md |
| AI product direction | ✅ Complete | docs/AI_PRODUCT_DIRECTION.md |
| Capability decision rules | ✅ Complete | docs/CAPABILITY_DECISION_RULES.md |
| Logical database model | ✅ Canonical | docs/DATABASE_MODEL.md |
| Physical schema blueprint | ✅ Canonical | docs/PHYSICAL_SCHEMA_BLUEPRINT.md |
| Migration ownership model | ✅ Canonical | docs/MIGRATION_BLUEPRINT.md |
| Migration catalog contract | ✅ Implemented | docs/MIGRATION_CATALOG_IMPLEMENTATION.md |
| Migration lock integrity | ✅ Implemented | docs/MIGRATION_LOCK_STRATEGY.md |
| D1 database client boundary | ✅ Implemented | packages/database/src/client.ts |
| D1 runtime database boot boundary | ✅ Implemented | packages/runtime/src/boot.ts |
| Foundation / onboarding / identity / business / catalog SQL | 🟢 Implemented in migration sequence | migrations/0001–0005 |
| Catalog guard migrations | 🟢 Implemented in migration sequence | migrations/0006–0008 |
| Media / discovery / seller-AI migrations | 🟢 Implemented in migration sequence | migrations/0009–0013 |
| Full canonical logical model | ⏳ Partial | many logical entities remain un-migrated |
| Final physical D1 schema | ⏳ In progress | requires table-by-table reconciliation |
| Legacy PostgreSQL database path | ⚠️ Quarantined | reconciliation target only |

## 2. Database history

### Historical — commit 2024bdb

A PostgreSQL-oriented Phase 4 implementation was created, including:

- postgres-adapter.ts
- postgres-database.ts
- generic repository implementations
- built-in TypeScript migrations
- USE_POSTGRES runtime selection

This work is preserved as history but is superseded.

### Current canonical path

All new database work must use:

```
D1Database
→ repositories/services
→ canonical migrations/*.sql
→ migration catalog
→ migration lock
→ D1
```

Do not extend the historical PostgreSQL path.

## 3. Known reconciliation issue

The source tree still contains old PostgreSQL-oriented exports and a legacy migration implementation in packages/database/src/migrations.ts.

This is a known architectural mismatch with the D1 runtime boot contract.

It must be treated as technical debt to reconcile, not as a reason to create another database abstraction.

Required future sequence:

1. identify all active consumers of the legacy exports;
2. migrate consumers to the D1 boundary;
3. make the canonical D1 MigrationRunner/catalog types the only runtime contract;
4. run typecheck, unit tests, migration integrity tests and runtime tests;
5. remove or isolate the legacy PostgreSQL files;
6. update this ledger with the resulting commit.

## 4. Current canonical migration inventory

The API runtime references these migration sources:

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

Their exact SQL is the source of truth. Never duplicate their contents in another TypeScript migration list.

## 5. Rules for continuing implementation

Before writing database code:

- inspect the canonical logical model;
- inspect the physical schema blueprint;
- inspect the owning module;
- search the existing migrations and repositories for the entity;
- confirm that the capability does not already exist under another name;
- add exactly one canonical implementation;
- preserve organization/workspace isolation;
- add a migration before relying on a new physical structure.

Before touching migration files:

- never edit an applied migration;
- preserve numbering;
- preserve checksum/lock integrity;
- use a new migration for schema evolution;
- use Expand → Migrate → Switch → Contract for breaking changes.

## 6. Ledger update rule

Every substantial implementation change must update this ledger with:

- capability name
- status
- owning module
- canonical files
- migration ids involved
- tests/verification
- commit reference
- unresolved follow-up work

The ledger is the continuity mechanism for future coding-agent sessions.

## 7. Immediate database work

The next database milestone is not “build PostgreSQL.”

It is:

```
reconcile logical model
→ map every target entity to one owner
→ classify implemented / partial / missing / duplicate / conflicting
→ finalize physical D1 schema
→ implement missing module-owned migrations
→ implement repositories/domain services
→ verify tenant isolation and integrity
```

Cloudflare D1 provisioning comes after the schema is reconciled; it must not be used to hide model uncertainty.
