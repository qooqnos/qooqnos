# Phoenix Implementation Ledger

**Status:** Current implementation ledger  
**Last reviewed:** 2026-09-22
**Documentation reconciliation:** 2026-09-22; see repository history and this ledger for the latest commit references.

This ledger is the continuity record for future coding agents. Completed or superseded work must not be re-implemented merely because an older document still mentions it.

## 1. Capability status

| Capability | Status | Canonical source |
|---|---|---|
| Product North Star | ✅ Complete | docs/PHOENIX_PRODUCT_NORTH_STAR.md |
| AI product direction | ✅ Complete | docs/AI_PRODUCT_DIRECTION.md |
| Capability decision rules | ✅ Complete | docs/CAPABILITY_DECISION_RULES.md |
| Logical database model | ✅ Canonical | docs/DATABASE_MODEL.md |
| Physical schema blueprint | ✅ Canonical | docs/PHYSICAL_SCHEMA_BLUEPRINT.md |
| Physical database reconciliation | ✅ Canonical planning gate | docs/DATABASE_PHYSICAL_RECONCILIATION.md |
| Migration ownership model | ✅ Canonical | docs/MIGRATION_BLUEPRINT.md |
| Migration catalog contract | ✅ Implemented | docs/MIGRATION_CATALOG_IMPLEMENTATION.md |
| Migration lock integrity | ✅ Implemented | docs/MIGRATION_LOCK_STRATEGY.md |
| D1 database client boundary | ✅ Implemented | packages/database/src/client.ts |
| D1 runtime database boot boundary | ✅ Implemented | packages/runtime/src/boot.ts |
| Foundation / onboarding / identity / business / catalog SQL | 🟢 Implemented in migration sequence | migrations/0001–0005 |
| Catalog guard/integrity migrations | 🟢 Implemented in migration sequence | migrations/0006–0008, 0014 |
| Business category integrity hardening | 🟢 Implemented | migrations/0015_business_primary_category_integrity.sql |
| Catalog Attribute vocabulary | 🟢 Foundation implemented | migrations/0016_catalog_attribute_vocabulary.sql |
| Catalog AttributeValue storage | 🟡 Expand phase implemented | migrations/0017_catalog_attribute_values.sql; JSON backfill/cutover remains gated |
| Customer core | 🟢 Schema/repository implemented | migrations/0018_customer_core.sql; packages/database/src/customer-repository.ts |
| CRM Customer relationships | 🟢 Schema/repository implemented | migrations/0019_crm_customer_relationships.sql; packages/database/src/customer-relationship-repository.ts |
| CRM timeline events | 🟢 Schema/repository implemented | migrations/0020_crm_timeline_events.sql; packages/database/src/crm-timeline-repository.ts; projections remain gated |
| Customer addresses | 🟢 Schema/repository implemented | migrations/0026_customer_addresses.sql; packages/database/src/customer-address-repository.ts |
| Trust VerificationCase / evidence | 🟢 Schema/repository implemented | migrations/0021_verification_case_and_documents.sql; packages/database/src/verification-repository.ts |
| Trust policies / requirements | 🟢 Schema/repository implemented | migrations/0022_verification_policy_requirements.sql; packages/database/src/verification-repository.ts |
| Trust checks / evidence links | 🟢 Schema implemented | migrations/0023_verification_checks.sql; runtime methods in verification-repository.ts |
| Trust decisions / supporting checks | 🟢 Schema implemented, append-only | migrations/0024_verification_decisions.sql; runtime methods in verification-repository.ts |
| Trust reviews / expiry | 🟢 Schema/repository implemented | migrations/0025_verification_review_expiry.sql; review/expiry methods and tests in verification-repository.ts |
| Catalog Attribute repositories | 🟢 Implemented | packages/catalog/src/attribute-repository.ts; packages/catalog/src/attribute-value-repository.ts |
| Media / discovery / seller-AI migrations | 🟢 Implemented in migration sequence | migrations/0009–0013 |
| Full canonical logical model | ⏳ Partial | many logical entities remain un-migrated |
| Final physical D1 schema | ⏳ In progress | requires table-by-table reconciliation |
| Legacy PostgreSQL database path | ✅ Removed from active source | historical git history only |
| Legacy in-memory database path | 🟡 Isolated compatibility path | packages/database/src/legacy.ts; not exported by canonical package root |

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

The previous PostgreSQL/D1 migration API mismatch has been reconciled. The obsolete PostgreSQL database source files have been removed from the active tree and remain only in git history.

## 3.1 Database runtime reconciliation — 2026-09-22

**Status:** ✅ Completed

The database package has been converged onto the canonical D1 runtime contract.

Implemented:
- MigrationDefinition and MigrationResult are now the sole migration runtime model.
- MigrationRunner executes canonical SQL statements through D1 batches.
- Applied migration history is checked for contiguous versions, identity, module ownership and checksum integrity.
- Missing schema_migrations is supported for the first migration bootstrap without creating a competing registry.
- packages/database/src/index.ts exposes the canonical D1 database, repository, migration-catalog and migration-lock APIs.
- packages/runtime/src/index.ts now exposes the actual canonical runtime, authorization, boot and AI runtime APIs instead of the removed PostgreSQL compatibility exports.
- Legacy PostgreSQL adapter, PostgreSQL compatibility layer, legacy database repository and legacy database factory were removed from the active source tree.

Commits:
- 7b9d28c — Converge migration runner on D1 contract
- fe3bf8f — Expose canonical D1 database APIs
- f6960d8 — Remove legacy database exports from runtime
- eb5be40 — Remove legacy database factory
- b128b12 — Remove legacy database repository
- a10e19a — Remove PostgreSQL adapter
- aa595ad — Remove PostgreSQL database compatibility layer
- 4b3eee2 — Restore canonical runtime public exports
- 0a99e24 — Add canonical physical database reconciliation
- 0ff5dac — Reference physical database reconciliation gate
- 7547eb2 — Add catalog offering integrity migration 0014
- c2fa85b — Register migration 0014 in API catalog
- fbc467b — Lock migration 0014 checksum
- d79eed0 — Resolve offering-level pricing source of truth
- 9288240 — Resolve service/offering physical model
- f653ea3 — Add business primary category integrity migration 0015
- 99fab7c — Register migration 0015 in API catalog
- 087b672 — Lock migration 0015 checksum
- 571c172 — Reconcile pricing and business primary-category decisions
- 2378c0a — Align logical catalog ownership with physical schema
- 0869e8f — Normalize reconciliation section numbering
- ede3d54 — Add canonical Catalog Attribute vocabulary migration 0016
- e9c338f — Register migration 0016 in API catalog
- f22beb4 — Lock migration 0016 checksum
- 00e904e — Define Catalog Attribute physical contract
- cdbc1cb — Reconcile Catalog Attribute physical schema
- a647b1c — Record canonical Catalog Attribute model
- b6220a1 — Implement Catalog Attribute repository
- 1b528e9 — Export Catalog Attribute repository
- ac0f704 — Add Catalog Attribute repository tests
- 4264535 — Isolate legacy in-memory database compatibility layer
- b06ea23 — Make database package export D1 boundary only
- e166926 — Route legacy API imports through explicit legacy boundary
- aac18d7 — Route legacy runtime server through explicit legacy boundary
- b8e28bb — Route legacy onboarding through explicit legacy boundary
- 2a1cbae — Route legacy onboarding tests through explicit legacy boundary
- f584d3b — Expose legacy database compatibility as explicit subpath
- 736af81 — Map explicit legacy database subpath in TypeScript
- e7c8b44 — Register Catalog AttributeValue migration 0017
- 39b042d — Lock Catalog AttributeValue migration checksum
- 97cf355 — Define canonical AttributeValue physical contract
- 81ea5b2 — Reconcile AttributeValue storage and cutover gate
- 11a884c — Record AttributeValue canonical data model
- b166def — Implement Catalog AttributeValue repository
- 6053bb8 — Export Catalog AttributeValue repository
- b664c41 — Add Catalog AttributeValue repository tests
- 216ccf7 — Harden migration SQL splitting for SQLite triggers
- 0efbe5f — Add migration splitter trigger/comment tests
- 34333c5 — Fix AttributeValue option key generation
- ce36a28 — Add canonical Customer and preference storage
- 683c821 — Register Customer core migration
- 187f7bc — Lock Customer core migration checksum
- 9a6a9a2 — Reconcile Customer and CRM physical schema
- fbba518 — Define Customer preference physical contract
- ef20f3a — Add CRM customer relationship storage
- eccaa8e — Register CRM customer relationship migration
- b409aed — Lock CRM relationship migration checksum
- 7f013f7 — Implement canonical Customer repository
- 2b699fb — Implement canonical CRM customer relationship repository
- e9588d9 — Export Customer and CRM repositories
- 8a1899a — Add Customer repository tests
- 6cba51e — Add CRM relationship repository tests
- 1a1bcc5 — Add canonical CRM timeline events migration 0020
- f057754 — Register CRM timeline migration
- ef9d7cb — Lock CRM timeline migration checksum
- 69f275b — Define CRM timeline physical contract
- be45756 — Reconcile CRM timeline event storage
- a6bf6f1 — Implement canonical CRM timeline repository
- 22c49ab — Export CRM timeline repository
- d922430 — Add CRM timeline repository tests
- f5b9c18 — Add verification case and document migration 0021
- a88c395 — Register verification case migration
- 0a68a2f — Lock verification case migration checksum
- f6177f3 — Refresh verification case migration checksum after pre-apply migration cleanup
- 2e2e47c — Implement canonical verification repository
- 9a901c5 — Export canonical verification repository
- 0ad59e4 — Add verification repository tests
- f3e4586 — Add verification policy/requirement migration 0022
- 376ae76 — Register verification policy migration
- 15b008f — Lock verification policy migration checksum
- fc2cdf5 — Add verification checks migration 0023
- 7452230 — Register verification checks migration
- 2277200 — Lock verification checks migration checksum
- b6ae11a — Add verification decisions migration 0024
- 22fa0de — Register verification decisions migration
- f9a1914 — Refresh immutable decision migration checksum
- 647303c — Enforce complete verification decision immutability
- 4c08a88 — Add verification review and expiry migration 0025
- 552e1ff — Register verification review and expiry migration
- 09269ea — Lock verification review and expiry migration checksum
- 31c441c — Implement verification review and expiry workflow
- 99312bc — Test verification review assignment workflow
- 4071f41 — Add canonical customer address migration 0026
- d62dd6e — Register customer address migration
- 1acc550 — Lock customer address migration checksum
- c8c1468 — Implement customer address repository
- 4b6db9e — Export customer address repository
- 2422486 — Test customer address tenant isolation
- 2310529 — Refresh physical reconciliation after Trust review/expiry
- 3458d50 — Document Trust review/expiry physical contracts
- 3ba47ec — Record Trust physical implementation status
- 66a0ed4 — Reconcile Trust policy/check/decision chain
- 192fc95 — Align Trust physical blueprint
- 996658e — Align logical Trust model with physical chain

Migration safety:
- canonical migrations 0001–0023 were not edited, renumbered or replaced;
- migration 0024_verification_decisions was added as a new Trust-owned schema migration;
- the committed migration lock remains the integrity source for canonical SQL;
- no second schema registry was introduced.
- Verification note: source-level reconciliation was completed, but no local build/test execution was available in this connector environment and no GitHub Actions run was visible for the reconciliation commit at verification time.

Catalog offering integrity hardening remains in 0014_catalog_offering_integrity.sql; 0015_business_primary_category_integrity.sql adds three integrity triggers and no tables; 0016_catalog_attribute_vocabulary.sql adds three Catalog Attribute tables; 0017_catalog_attribute_values.sql adds two AttributeValue tables and preserves all prior migration identities/checksums.

The old in-memory database implementation is retained only as an explicit legacy compatibility module and is no longer part of the canonical @qooqnos/database root API.

Customer/CRM verification note: repositories and scope-focused tests were added; full local test execution remains unavailable in this connector environment.

Migration lock note: 0021 was refreshed after a pre-apply SQL cleanup; 0022–0024 remain locked to their canonical SHA-256 values recorded during implementation.

Customer address note: migration 0026 stores the structured Address value object in Customer ownership; CustomerProfile remains gated on field-level contract.

CRM timeline note: normalized event storage and idempotent source-event handling are implemented. A separate timeline projection table remains gated pending a field-level read-model/rebuild contract.

Trust note: migrations 0021–0025 implement the canonical VerificationCase → Policy/Requirement → Check/Evidence → append-only Decision → Review/Expiry chain. Reviewer authorization integration, expiry workers/events and TrustSignal projections remain gated.

Migration runtime hardening: splitSqlStatements now keeps SQLite CREATE TRIGGER bodies intact across internal semicolons and rejects unterminated trigger/comment/literal blocks. Trigger-splitting regression tests were added.

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
0014_catalog_offering_integrity.sql
0015_business_primary_category_integrity.sql
0016_catalog_attribute_vocabulary.sql
0017_catalog_attribute_values.sql
0018_customer_core.sql
0019_crm_customer_relationships.sql
0020_crm_timeline_events.sql
0021_verification_case_and_documents.sql
0022_verification_policy_requirements.sql
0023_verification_checks.sql
0024_verification_decisions.sql
0025_verification_review_expiry.sql
0026_customer_addresses.sql
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
→ complete Catalog Attribute value ownership/cutover without duplicating attributes_json
→ complete Business lifecycle only where contracts are sufficiently specified
→ implement repositories/domain services for the canonical D1 path
→ migrate or retire any remaining explicit legacy compatibility consumers
→ verify tenant isolation and integrity
```

Cloudflare D1 provisioning comes after the schema is reconciled; it must not be used to hide model uncertainty.
