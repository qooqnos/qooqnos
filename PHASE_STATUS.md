# Phoenix Implementation Status

**Status:** Current status document  
**Last reviewed:** 2026-09-23

This file supersedes the old Phase 1–6 plan that described PostgreSQL as the planned production database. That plan is no longer the source of truth.

## 1. Current architectural baseline

Phoenix is now designed around:

- Cloudflare Workers / Hono for API execution
- Cloudflare D1 as the canonical relational source of truth
- Cloudflare R2 for binary objects
- Cloudflare Queues for asynchronous work
- module-owned SQL migrations
- migration catalog + migration lock integrity
- repository-level tenant isolation
- modular domain boundaries

The authoritative architecture is defined by docs/PHOENIX_ARCHITECTURE.md and the canonical database documents.

## 2. Database implementation status

| Area | Status | Meaning |
|---|---|---|
| Logical data model | ✅ Canonical | docs/DATABASE_MODEL.md defines the target model |
| Physical schema rules | ✅ Canonical | docs/PHYSICAL_SCHEMA_BLUEPRINT.md defines gates |
| Migration ownership | ✅ Canonical | each migration has one owner module |
| Migration catalog | ✅ Implemented | runtime derives metadata from canonical SQL |
| Migration lock | ✅ Implemented | reviewed SQL identity/checksum is enforced |
| D1 database boundary | ✅ Implemented | packages/database exposes D1-compatible access |
| D1 runtime boot | ✅ Implemented in runtime boundary | runtime boot consumes migration catalog/lock |
| Canonical migrations | 🟢 Active | apps/api/src/migrations.ts references 0001–0054 |
| Full logical model | 🟢 Core logical model resolved | remaining work is operational/provider/projection gates, not an unimplemented CustomerProfile table |
| Final D1 physical schema | 🟢 Physical blueprint complete | 186 physical tables across migrations 0001–0054; remaining work is explicit contract/provider/worker gates and real Cloudflare resource provisioning |
| Legacy PostgreSQL path | ✅ Removed from active source | historical git history only |

## 3. Critical database rule

Do not create a new database schema beside the current D1 model.

Before adding a table:

1. check docs/DATABASE_MODEL.md;
2. check docs/PHYSICAL_SCHEMA_BLUEPRINT.md;
3. identify exactly one owning module;
4. verify that an existing table does not already own the same fact;
5. add one new versioned SQL migration under migrations/;
6. update the migration lock/catalog as required;
7. add repository/service tests for tenant isolation and integrity.

## 4. Migration sequence currently registered

The API runtime currently references the ordered canonical migration sequence `0001` through `0054`.

Do not renumber or replace these migrations.

## 5. Legacy implementation reconciliation

The historical PostgreSQL-oriented implementation has been removed from the active source tree after consumer inspection.

Historical references remain only in git history and superseded phase documents. They are not part of the current database API and must not be recreated.

The reconciliation did not modify, renumber, or rewrite any canonical migration in migrations/.

## 5.1 Physical schema reconciliation

Current physical coverage and missing-domain analysis is maintained in docs/DATABASE_PHYSICAL_RECONCILIATION.md. New tables must pass that reconciliation before a migration is authored.

## 6. Current architecture gate for database work

The database is not considered complete merely because a connection works.

Completion requires:

- canonical logical model coverage;
- physical schema reconciliation;
- migration ownership;
- tenant isolation;
- domain constraints;
- migration checksum/lock integrity;
- repository/service coverage;
- tests for critical invariants;
- removal or formal quarantine of conflicting legacy database code.

## 7. Latest runtime verification

- Latest fully verified code checkpoint is commit `de2454120e57b3f771b9f334fed87fd7de66273a`.
- GitHub Actions CI run `35899964284` and Phoenix verification run `35899964188` both passed for the current `main` checkpoint.
- Migration lock verification is registered through migration `0054` and passed in the latest Phoenix verification workflow.
- The current checkpoint is covered by successful CI/Phoenix verification; historical run details remain available in GitHub Actions.
- Matching Match → Connect is implemented through the canonical CustomerRelationship owner.

## 8. What remains

The remaining database work is not “implement PostgreSQL.”

It is:

```
Canonical logical model
→ physical schema gap analysis
→ missing/partial/duplicate/conflicting entity resolution
→ D1 migrations
→ repository/domain service implementation
→ runtime integration
→ integrity/tenant-isolation tests
```

The application/runtime and physical schema gates are complete; remaining work is operational/provider-specific plus real Cloudflare resource provisioning. Cloudflare D1 production provisioning is the final infrastructure step.

## 9. Remote D1 provisioning gate

The application/runtime is D1-ready, but the repository does not contain a fabricated remote database UUID. Wrangler requires a real `database_id` for a D1 binding; staging and production bindings are therefore documented but remain commented until the corresponding Cloudflare databases exist. The runtime deliberately fails closed when `env.DB` is absent.

## 10. Historical documents

docs/PHASE4_SUMMARY.md and older phase snapshots are historical records. They must not be used as current database design instructions.
