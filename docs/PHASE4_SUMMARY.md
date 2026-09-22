# Phase 4 — Historical Database Implementation Record

**Status:** Historical / superseded  
**Original implementation date:** 2026-09-21

## Important

This document records an earlier database implementation attempt. It is retained for audit/history only.

It is **not** the current Phoenix database architecture and must not be used as the basis for new database work.

The earlier implementation centered on:

- PostgreSQL adapter code
- SQLite development mode
- a built-in TypeScript migration schema
- generic User / Workspace / Service / Booking tables
- a dual in-memory/PostgreSQL runtime switch

That architecture has been superseded by the Cloudflare D1 + canonical SQL migration architecture.

## Historical commit

The historical implementation was introduced in commit 2024bdb and related follow-up commits.

The historical files included:

- packages/database/src/postgres-adapter.ts
- packages/database/src/postgres-database.ts
- packages/database/src/database-factory.ts
- the old packages/database/src/migrations.ts implementation
- legacy repository implementations

These files may still exist in the repository, but their presence is a compatibility/reconciliation concern, not an architectural recommendation.

## Current replacement architecture

The current database path is:

\`\`\`
Cloudflare Workers / API
        ↓
Runtime boot
        ↓
packages/database D1 boundary
        ↓
canonical SQL migrations/
        ↓
migration catalog
        ↓
migration lock verification
        ↓
D1 MigrationRunner
        ↓
Cloudflare D1
\`\`\`

Canonical references:

- docs/PHOENIX_ARCHITECTURE.md
- docs/DATABASE_MODEL.md
- docs/PHYSICAL_SCHEMA_BLUEPRINT.md
- docs/MIGRATION_BLUEPRINT.md
- docs/MIGRATION_CATALOG_IMPLEMENTATION.md
- docs/MIGRATION_LOCK_STRATEGY.md
- docs/DATABASE_RUNTIME_IMPLEMENTATION.md

## Database safety rules

Do not:

- add new tables to the historical five-table schema;
- extend the PostgreSQL adapter for new capabilities;
- create TypeScript migration constants that duplicate SQL files;
- reintroduce migrations/0001_schema.sql;
- add a second migration registry;
- create duplicate Business, Customer, Invoice, Booking or Catalog entities;
- change an already-applied migration in place.

All new physical schema must be introduced through the canonical module-owned SQL migration process.

## Reconciliation note

The repository still contains historical PostgreSQL-oriented code. Before that code is deleted, active imports and runtime consumers must be identified and replaced with the D1 boundary.

This document is intentionally explicit so that historical code is not mistaken for an unfinished Phase 4 implementation.
