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

```text
0001_foundation … 0056_communication_required_suppression
```

See `apps/api/src/migrations.ts` and `migrations/migration-lock.json` for the authoritative ordered sequence.

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
5. docs/DATABASE_PHYSICAL_RECONCILIATION.md
5. docs/MIGRATION_CATALOG_IMPLEMENTATION.md
6. docs/MIGRATION_LOCK_STRATEGY.md
7. docs/DATABASE_RUNTIME_IMPLEMENTATION.md
8. docs/IMPLEMENTATION_LEDGER.md

## Current database state

The current canonical D1 sequence covers the core platform domains through migration `0075`. Remaining work is primarily provider-specific activation, downstream renderer/vendor adapters, production verification, and the credentialed remote D1 application gate.

Do not treat historical phase documents as current architecture.
