# Phoenix

Phoenix is a secure, modular, multilingual, multi-tenant intelligent decision and connection platform between customers and businesses.

## Product loop

```
Understand Demand → Understand Supply → Decide → Match → Connect → Act → Learn
```

Marketplace, Catalog, Discovery, Booking, CRM, Billing and AI strengthen this loop; they are not independent product identities.

## Canonical production architecture

- API/runtime: Cloudflare Workers + Hono
- Relational source of truth: Cloudflare D1
- Object storage: Cloudflare R2
- Async processing: Cloudflare Queues
- Stateful coordination: Durable Objects where justified
- Semantic retrieval: derived Vectorize/search projections
- AI execution: Phoenix AI Runtime and provider adapters
- Deployment: GitHub Actions → Cloudflare

## Database architecture

D1 is the canonical transactional source of truth.

SQL migrations live under migrations/ and are the only source of migration contents.

The current API migration sequence is:

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

The runtime derives migration metadata from the canonical SQL, verifies the migration lock and executes the resulting definitions against D1.

## Important database rule

Do not create a second database architecture.

The old PostgreSQL-oriented database implementation has been removed from the active source tree. References to it remain only in historical commits and superseded phase documents.

Do not recreate the PostgreSQL adapter, USE_POSTGRES production switch, SQLite schema path, or migrations/0001_schema.sql.

Do not add a parallel TypeScript migration source.

## Where to read before database work

1. docs/PHOENIX_ARCHITECTURE.md
2. docs/DATABASE_MODEL.md
3. docs/PHYSICAL_SCHEMA_BLUEPRINT.md
4. docs/MIGRATION_BLUEPRINT.md
5. docs/MIGRATION_CATALOG_IMPLEMENTATION.md
6. docs/MIGRATION_LOCK_STRATEGY.md
7. docs/DATABASE_RUNTIME_IMPLEMENTATION.md
8. docs/IMPLEMENTATION_LEDGER.md

## Current database state

The logical data model is intentionally broader than the physically migrated schema. Missing modules must be implemented incrementally and only after table-by-table reconciliation.

Do not treat historical phase documents as current architecture.
