# Phoenix Implementation Status

**Status:** Current status document  
**Last reviewed:** 2026-09-24

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
| Canonical migrations | 🟢 Active | apps/api/src/migrations.ts references 0001–0064 |
| Full logical model | 🟢 Core logical model resolved | remaining work is operational/provider/projection gates, not an unimplemented CustomerProfile table |
| Final D1 physical schema | 🟢 Physical blueprint complete | 192 physical tables across migrations 0001–0064; remaining work is explicit contract/provider/worker gates and credentialed remote D1 migration/application |
| Legacy PostgreSQL path | ✅ Removed from active source | historical git history only |

## 2.1 Database completion percentage

- **Physical D1 schema: 100% complete** — 64 ordered migrations define the canonical physical schema and the reconciled inventory is 192 tables.
- **Database engineering readiness: 91.7%** on the explicit 12-gate readiness rubric: 11 repository/schema/runtime gates are closed; one credentialed remote-D1 application gate remains.

The 12-gate rubric is:
1. canonical logical model;
2. physical schema blueprint/reconciliation;
3. migration ownership;
4. migration catalog;
5. migration lock/checksum integrity;
6. D1 client/database boundary;
7. runtime boot/migration boundary;
8. tenant/workspace isolation;
9. database/domain integrity constraints;
10. repository/service coverage;
11. critical invariant verification;
12. credentialed remote production-D1 application.
- **Production remote migration state:** not verified from this runtime because no Cloudflare credential/connector is exposed here. The canonical remote migration executor is implemented and verifies D1 identity plus migration checksums before applying anything.
- Payment provider adapters are implemented behind the Billing boundary; other provider-specific adapters, Analytics, Documents, Localization registries and AI Memory are not counted as missing relational schema where their physical contracts are intentionally gated.

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

The API runtime currently references the ordered canonical migration sequence `0001` through `0064`.

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

- Last fully verified code checkpoint is commit `3f3192819a9879fb453070e82e04785b3fea5e80`.
- Current main is now of that checkpoint; the compare contains no canonical migration SQL changes, but the latest head has not been independently CI-verified through the currently exposed connector.
- Migration lock verification is registered through migration `0056` and passed in the latest CI/Phoenix verification workflows.
- The current checkpoint is covered by successful CI/Phoenix verification, including migration lock, legacy-source boundary, runtime-module registry, lint, typecheck, build, Worker dry-run and tests; historical run details remain available in GitHub Actions.
- Matching Match → Connect is implemented through the canonical CustomerRelationship owner.

## 7.1 Runtime continuity guards

The canonical runtime now has two repository-level guards: legacy-source boundary verification and runtime-module registry completeness. Discovery's `DISCOVERY_MODULE` is registered in `apps/api/src/runtime.ts`; all canonical package manifests are covered by the registry guard.

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

The application/runtime and physical schema gates are complete; remaining work is operational/provider-specific plus credentialed remote D1 migration/application. The production D1 resource has now been provisioned externally.

## 9. Remote D1 provisioning gate

The production D1 resource is provisioned externally as `qooqnos-production`. The repository intentionally does not hard-code the real UUID into `wrangler.toml`; production continues to consume `PHOENIX_PROD_D1_DATABASE_NAME` and `PHOENIX_PROD_D1_DATABASE_ID` through the protected deployment environment.

The remaining infrastructure action is credentialed execution of `npm run migrate:prod:canonical` against that D1. The runtime still fails closed when `env.DB` is absent.

## 10. Historical documents

docs/PHASE4_SUMMARY.md and older phase snapshots are historical records. They must not be used as current database design instructions.


## 10.1 Trust completion — 2026-09-24

Trust reviewer completion is protected by the dedicated `trust.verification.review` permission bound to the assigned reviewer identity. Migration 0064 adds tenant/workspace-scoped TrustSignal persistence and source idempotency; the scheduled anti-abuse worker normalizes review risk/report evidence and opens idempotent generic ModerationCases for high/critical signals. Trust projections are exposed through the canonical `GET /api/v1/trust/signals` read surface.