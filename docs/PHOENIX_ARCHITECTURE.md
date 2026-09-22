# Phoenix — System Architecture

**Status:** Canonical architecture contract  
**Last reviewed:** 2026-09-22

## 1. Product north star

Phoenix is fundamentally an intelligent decision and connection layer between customers and businesses.

The canonical product loop is:

```
Understand Demand → Understand Supply → Decide → Match → Connect → Act → Learn
```

Marketplace, Catalog, Discovery, Booking, CRM, Billing and AI are supporting capabilities that strengthen this loop. They are not independent product identities.

The architecture must therefore optimize for trustworthy understanding, decisioning, matching and connection rather than for accumulating disconnected software features.

## 2. Canonical platform topology

Phoenix is a Cloudflare-first modular monolith.

| Concern | Canonical technology / boundary |
|---|---|
| Web/API execution | Cloudflare Workers + Hono |
| Transactional relational database | Cloudflare D1 |
| Object storage | Cloudflare R2 |
| Async work | Cloudflare Queues |
| Stateful coordination | Durable Objects only where justified |
| Semantic retrieval | Cloudflare Vectorize or another derived retrieval index |
| AI execution | Phoenix AI Runtime with provider adapters |
| Delivery | GitHub Actions → Cloudflare |

D1 is the authoritative transactional source of truth. R2 stores binary objects; derived search/vector/analytics structures never become a second source of truth.

## 3. Architecture style

Phoenix remains a modular monolith.

Core bounded contexts include:

- Identity / Tenancy
- Authorization
- Business
- Catalog
- Customer
- Booking / Availability
- Commerce
- Trust / Verification / Moderation
- Communication
- Media
- Discovery / Matching
- AI
- Automation
- Billing
- Integration
- Documents / Export
- Analytics / Localization

Each module owns its private persistence structures and exposes typed application capabilities and contracts. Cross-module access must not become direct table-to-table business coupling.

## 4. Database source-of-truth hierarchy

The hierarchy is:

```
Canonical logical model
        ↓
Physical schema blueprint
        ↓
Module-owned SQL migrations
        ↓
Migration catalog + lock
        ↓
D1 migration runner
        ↓
D1 physical database
```

The authoritative documents are:

1. docs/DATABASE_MODEL.md — logical source-of-truth model
2. docs/PHYSICAL_SCHEMA_BLUEPRINT.md — physical schema gates
3. docs/MIGRATION_BLUEPRINT.md — migration ownership and evolution rules
4. docs/MIGRATION_CATALOG_IMPLEMENTATION.md — SQL → runtime catalog contract
5. docs/MIGRATION_LOCK_STRATEGY.md — migration integrity contract
6. docs/DATABASE_RUNTIME_IMPLEMENTATION.md — executable D1 runtime boundary

No older phase report, PostgreSQL design, README snapshot, or generated patch file may override these contracts.

## 5. D1 database boundary

Application code reaches persistence through packages/database.

The canonical persistence boundary provides:

- parameterized SQL
- explicit organization/workspace context
- repository-level tenant isolation
- D1-compatible transactions/batches
- audit, idempotency and outbox services
- migration execution and integrity validation

D1 is not merely one interchangeable production backend in the current architecture. It is the canonical relational backend.

A future alternate backend would require an explicit architecture decision and a compatibility plan; it must not be introduced by copying the old PostgreSQL path.

## 6. Migration architecture

SQL files under migrations/ are the only source of migration contents.

The required filename shape is:

```
NNNN_module[_description].sql
```

For example:

```
0001_foundation.sql
0005_catalog.sql
0011_ai_seller_creation.sql
```

The module segment establishes the default migration owner. The migration catalog derives:

- migration id
- numeric version
- module id
- exact SQL
- SHA-256 checksum
- executable statements

The migration lock records the reviewed identity and checksum of each migration.

The runtime flow is:

```
canonical SQL
  → migration catalog
  → lock verification
  → D1 MigrationRunner
  → schema_migrations
  → D1 schema
```

Applied migration SQL is immutable. Never edit, rename, renumber or silently replace an applied migration.

## 7. Current migration state

The API migration catalog currently references the canonical SQL sequence through:

```
0001_foundation
0002_onboarding
0003_identity_sessions
0004_business
0005_catalog
0006_catalog_product_guards
0007_catalog_integrity_guards
0008_permission_catalog
0009_media
0010_discovery
0011_ai_seller_creation
0012_ai_seller_catalog_link
0013_ai_seller_idempotency_fingerprint
```

This is the current migration source sequence visible in apps/api/src/migrations.ts.

The existence of a migration source does not mean every logical target entity is already implemented, nor does it imply that production data has already been migrated. Physical completion is tracked separately by the implementation ledger and schema reconciliation work.

## 8. Module ownership rules

Every physical table, constraint set and migration has exactly one owning module.

Examples:

- foundation tables → Foundation / Platform
- businesses and business lifecycle → Business
- products, services, prices, inventory → Catalog
- AI seller creation records → AI / Seller Creation capability according to the approved contract
- search and vector structures → Discovery / projections

A module may reference another module through approved foreign keys or typed capabilities, but it must not create a duplicate canonical entity because a local query is convenient.

Before adding any table, verify:

1. the logical entity already exists or has an approved model;
2. the physical owner is unique;
3. the row shape is approved;
4. organization/workspace scope is explicit;
5. lifecycle and retention are defined;
6. no existing table already owns the same fact.

## 9. Canonical vs derived data

Authoritative business state lives in D1.

Derived structures include:

- search documents
- embeddings
- ranking features
- caches
- analytics projections
- recommendation indexes
- AI retrieval context

Derived structures may be rebuilt or replaced. They must contain enough provenance/version metadata to identify the canonical source version.

AI outputs never become authoritative availability, price, permissions, inventory or financial state without a normal domain command and validation path.

## 10. Transactions and integrity

Critical state transitions must use D1 transactional/batch boundaries plus schema constraints where supported.

Examples include:

- membership and authorization changes
- inventory reservations
- booking transitions
- financial state transitions
- idempotent command claims
- outbox publication records

Do not rely on eventual consistency for a rule that is required to prevent duplicate ownership, double booking, double charging or cross-tenant access.

## 11. Legacy database architecture quarantine

The repository still contains historical PostgreSQL-oriented files such as:

- packages/database/src/postgres-adapter.ts
- packages/database/src/postgres-database.ts
- the old PostgreSQL-style MigrationRunner and BUILTIN_MIGRATIONS definitions
- README / phase documents describing USE_POSTGRES, SQLite development mode, or migrations/0001_schema.sql

These files are historical compatibility artifacts, not the Phoenix database architecture.

New code must not:

- add new features through the PostgreSQL adapter;
- create new schema sources inside TypeScript migration constants;
- reintroduce migrations/0001_schema.sql;
- create a parallel SQLite/PostgreSQL schema;
- use USE_POSTGRES as a production architecture switch;
- treat the old repository layer as the source of the current data model.

The old files must be removed or explicitly adapted only in a dedicated reconciliation change after their consumers are identified. Until then, their presence must never be interpreted as authorization to extend that architecture.

## 12. Safe schema evolution

Breaking changes use:

```
Expand → Migrate → Switch → Contract
```

Never combine destructive cleanup with an unverified consumer switch.

A migration refactor must preserve:

- existing migration ids
- applied migration checksums
- existing table meaning
- tenant boundaries
- historical snapshots
- module ownership
- rollback/recovery strategy

Changing documentation must not trigger a schema migration. Changing schema must always trigger a new migration.

## 13. Runtime and security boundaries

Tenant isolation is server-side and mandatory.

Every tenant/workspace repository operation must receive explicit context. URL identifiers, UI state, search indexes and AI reasoning are never authorization boundaries.

Sensitive data must follow classification, least-privilege, audit and retention policies.

## 14. Product architecture consequence

Before implementing any capability, verify that it strengthens:

```
Understand Demand
→ Understand Supply
→ Decide
→ Match
→ Connect
→ Act
→ Learn
```

When a capability is useful infrastructure rather than a product identity, it belongs inside the appropriate bounded context and must not create a competing source of truth.

## 15. Canonical references

For implementation work, read these in order:

1. docs/PHOENIX_PRODUCT_NORTH_STAR.md
2. docs/AI_PRODUCT_DIRECTION.md when AI is involved
3. docs/CAPABILITY_DECISION_RULES.md
4. docs/DATABASE_MODEL.md for logical data ownership
5. docs/PHYSICAL_SCHEMA_BLUEPRINT.md for physical schema gates
6. docs/MIGRATION_BLUEPRINT.md for schema evolution
7. docs/MIGRATION_CATALOG_IMPLEMENTATION.md and docs/MIGRATION_LOCK_STRATEGY.md for runtime migration integrity
8. docs/DATABASE_RUNTIME_IMPLEMENTATION.md for D1 execution boundaries

This document describes the system architecture. It does not replace the more specific contracts above.
