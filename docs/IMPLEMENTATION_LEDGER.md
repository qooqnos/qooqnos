# Phoenix Implementation Ledger

**Status:** Current implementation ledger  
**Last reviewed:** 2026-09-23
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
| Canonical Onboarding D1 service | 🟢 Package/contract/repository/service implemented | packages/onboarding/src/contract.ts; packages/onboarding/src/repository.ts; packages/onboarding/src/service.ts |
| Catalog guard/integrity migrations | 🟢 Implemented in migration sequence | migrations/0006–0008, 0014 |
| Business category integrity hardening | 🟢 Implemented | migrations/0015_business_primary_category_integrity.sql |
| Catalog Attribute vocabulary | 🟢 Foundation implemented | migrations/0016_catalog_attribute_vocabulary.sql |
| Catalog AttributeValue storage | 🟡 Expand phase implemented | migrations/0017_catalog_attribute_values.sql; JSON backfill/cutover remains gated |
| Customer core | 🟢 Schema/repository implemented | migrations/0018_customer_core.sql; packages/database/src/customer-repository.ts |
| CRM Customer relationships | 🟢 Schema/repository implemented | migrations/0019_crm_customer_relationships.sql; packages/database/src/customer-relationship-repository.ts |
| CRM timeline events | 🟢 Schema/repository implemented | migrations/0020_crm_timeline_events.sql; packages/database/src/crm-timeline-repository.ts; projections remain gated |
| Customer addresses | 🟢 Schema/repository implemented | migrations/0026_customer_addresses.sql; packages/database/src/customer-address-repository.ts |
| Business status history | 🟢 Schema/repository implemented | migrations/0027_business_status_history.sql; packages/business/src/repository.ts |
| Booking core | 🟢 Schema/package/repository implemented | migrations/0028_booking_core.sql; packages/booking/src/repository.ts; packages/booking/src/service.ts |
| Booking availability rules | 🟢 Schema/repository implemented | migrations/0029_availability_schedules.sql; packages/booking/src/availability-repository.ts |
| Booking holds / lifecycle history | 🟢 Schema/repository implemented | migrations/0030_booking_holds_history.sql; packages/booking/src/repository.ts |
| Booking transactional finalization | 🟢 Schema/service/API/outbox implemented | migrations/0046_booking_finalization_guards.sql; migrations/0047_booking_capacity_update_guards.sql; packages/booking/src/repository.ts; packages/booking/src/service.ts; apps/api/src/booking-routes.ts |
| Platform Outbox / Queue boundary | 🟢 Publisher/lease/worker boundary implemented | packages/database/src/services.ts; apps/api/src/outbox-worker.ts; apps/api/src/index.ts; apps/api/src/env.ts |
| Commerce transaction core | 🟢 Schema/package/repository/service/API implemented | migrations/0031_commerce_transaction_core.sql; migrations/0032_commerce_integrity_hardening.sql; packages/commerce/src/repository.ts; packages/commerce/src/service.ts; apps/api/src/commerce-routes.ts |
| Billing core / entitlements / usage | 🟢 Schema/package/service implemented | migrations/0033_billing_core.sql; migrations/0034_billing_usage_counters.sql; packages/billing/src/repository.ts; packages/billing/src/service.ts |
| Communication core | 🟢 Schema/package/repository/service/API/outbox-consumer implemented | migrations/0035_communication_core.sql; packages/communication/src/repository.ts; packages/communication/src/service.ts; apps/api/src/communication-routes.ts; apps/api/src/outbox-worker.ts |
| Automation workflow engine | 🟢 Schema/package/repository/service/API implemented | migrations/0036_automation_core.sql; packages/automation/src/repository.ts; packages/automation/src/service.ts; apps/api/src/automation-routes.ts |
| AI Runtime persistence | 🟢 Schema/repository/runtime composition implemented | migrations/0037_ai_runtime_core.sql; packages/ai/src/runtime-repository.ts; packages/ai/src/runtime-client.ts; apps/api/src/ai-composition.ts |
| Integration core | 🟢 Schema/package/repository/service/API implemented | migrations/0038_integration_core.sql; packages/integration/src/repository.ts; packages/integration/src/service.ts; apps/api/src/integration-routes.ts; integration sync-job API |
| Privacy / Consent core | 🟢 Schema/package/repository/service implemented | migrations/0039_privacy_consent_requests.sql; packages/privacy/src/repository.ts; packages/privacy/src/service.ts |
| Fulfillment / Service Delivery core | 🟢 Schema/package/repository/service/API implemented | migrations/0049_fulfillment_core.sql; packages/fulfillment/src/repository.ts; packages/fulfillment/src/service.ts; apps/api/src/fulfillment-routes.ts |
| Demand / Matching core | 🟢 Schema/package/repository/service implemented | migrations/0040_demand_matching_core.sql; migrations/0041_demand_matching_integrity.sql; packages/matching/src/repository.ts; packages/matching/src/service.ts; apps/api/src/matching-routes.ts |
| Review moderation / reputation | 🟢 Schema/repository/service/API implemented | migrations/0048_reviews_moderation_reputation.sql; packages/trust/src/repository.ts; packages/trust/src/service.ts; apps/api/src/trust-routes.ts; Review lifecycle fields exposed from repository |
| Billing counter scope integrity | 🟢 Integrity migration implemented | migrations/0044_billing_counter_scope.sql; packages/billing/src/repository.ts |
| Review target integrity | 🟢 Canonical three-target schema/service/integrity implemented | migrations/0042_reviews_core.sql; migrations/0045_review_target_integrity.sql; packages/trust/src/repository.ts; packages/trust/src/service.ts |
| Trust Review core | 🟢 Schema/package/repository/service implemented | migrations/0042_reviews_core.sql; migrations/0043_integrity_update_guards.sql; packages/trust/src/repository.ts; packages/trust/src/service.ts |
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
| Legacy onboarding compatibility | 🟡 Explicit compatibility path | packages/onboarding/src/legacy.ts; package subpath `@qooqnos/onboarding/legacy`; canonical root no longer exports legacy workflow |
| Legacy Node server | 🟡 Isolated compatibility source | packages/runtime/src/legacy-server.ts; canonical runtime no longer exports `./server` and legacy server is excluded from runtime build |

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
- 94a61eb — Add business status history migration 0027
- 819f19c — Register business status history migration
- 1311c39 — Lock business status history checksum
- 8cd05c8 — Implement business lifecycle status history
- c9ebe65 — Test business lifecycle status history
- 84aa66c — Add booking core migration 0028
- 4a25975 — Fix booking scope trigger precedence
- 2b3cb9b — Lock booking core migration checksum
- 4c25434 — Register booking core migration
- 2f8c926 — Add availability schedule migration 0029
- d242580 — Register availability schedule migration
- ad81e18 — Lock availability schedule migration checksum
- f185856 — Add Booking package manifest
- 2385166 — Implement Booking repository
- e4a6af5 — Implement availability repository
- 50f2cbd — Implement Booking service
- b362141 — Add Booking exports
- ab062a9 — Register Booking module in API runtime
- 688c09c — Fix Booking schedule scope check
- 9d94218 — Test Booking lifecycle guards
- e808ff9 — Test Availability tenant scoping
- d8908b3 — Add booking holds and lifecycle history migration 0030
- 8cd30a4 — Register booking hold/history migration
- d5ca07b — Lock booking hold/history migration checksum
- af3d3c4 — Fix active hold uniqueness for resource-less slots
- 7a66937 — Refresh booking hold/history checksum
- fae8f16 — Implement Booking holds and lifecycle history
- 3c58b8e — Add Availability capability service
- 9b2cd4b — Extend Booking permission vocabulary
- 3a2d8a3 — Wire Availability permissions into manifest
- fc5e3eb — Export Availability service
- 6031da2 — Add Commerce transaction core migration 0031
- 84476f4 — Fix Commerce snapshot immutability trigger syntax
- 8d0476b — Register Commerce transaction migration
- c2294ed — Lock Commerce transaction migration checksum
- c9f704e — Add Commerce integrity hardening migration 0032
- 5ed153b — Register Commerce integrity migration
- e3f9b14 — Lock Commerce integrity migration checksum
- 769d12c — Add Commerce package manifest
- 2bdbf2b — Add Commerce TypeScript project
- 4dbcf82 — Implement canonical Commerce repository
- 0ef4da5 — Implement Commerce service capability layer
- a753c85 — Add Commerce runtime module manifest
- 1a0ad2b — Export Commerce package
- a0a8808 — Register Commerce project in root graph
- 9178600 — Register Commerce project in API graph
- 5b7d2c1 — Register Commerce dependency in API
- 0763a85 — Register Commerce module in API runtime
- 69bcbc1 — Add Commerce repository tests
- 8d3b29e — Fix Commerce repository test harness
- 35d3696 — Complete Commerce orchestration repositories
- 4a0e40e0 — Claim Outbox events before Queue publication
- d46dbf02 — Add concurrency-safe Outbox event leasing
- 964a65ba — Add D1 Outbox publisher and Queue consumer boundary
- 102f311c — Wire Outbox publisher and Queue consumer into Worker entrypoint
- 4c8002fb — Expose Commerce cart/checkout/order API routes
- 787f64b9 — Register Commerce API routes
- 1a008e17 — Make Communication notification creation transactional with Outbox
- 880f1398 — Expose Communication API routes
- 508e8b15 — Register Communication API routes
- f15ac668 — Process Communication notification events in Queue consumer
- 973fe752 — Harden Communication notification status scope
- 43ac6625 — Make Commerce order creation idempotent and transactional with Outbox
- 7c11d4c5 — Make Commerce order status transitions transactional with Outbox
- a16c9357 — Make Commerce order outbox race-safe under idempotency concurrency
- c9c409a8 — Emit Booking confirmation event in finalization transaction
- a8116af6 — Make Booking status transitions transactional with Outbox
- 7bcd830 — Reconcile physical inventory through Booking migration 0047
- 552cb66 — Include Auth package in root build graph
- ddb2e81 — Fix Business status-history D1 test mock
- ee99556 — Use syntactically invalid currency in Commerce test
- 7edf140 — Make Commerce checkout idempotency replay independent of cart state
- 7f6c9e0 — Make Verification case submission idempotent
- cbd9b05 — Fix Privacy consent transactional test mock
- 7f9a799 — Align Onboarding lifecycle test authorization with async service contract
- ee51173 — Use async AuthorizationService stub in Onboarding atomicity tests
- 396cae6 — Add Billing core migration 0033
- 5dcc8b8 — Register Billing core migration
- 2590b5a — Lock Billing core migration checksum
- b815ed3 — Add atomic Billing quota counters migration 0034
- 3936de7 — Register Billing quota counter migration
- c1f2fe1 — Lock Billing quota counter migration checksum
- 20b0f45 — Implement canonical Billing repository
- 6561ad2 — Harden Billing entitlement materialization and usage idempotency
- 344ed98 — Expose Billing repository and entitlement service
- 244cdb1 — Implement Billing entitlement service
- c904fa8 — Add Billing runtime module manifest
- a7d47f4 — Extend Billing package dependencies
- 4af726b — Extend Billing project references
- dad066f — Register Billing package in root graph
- 0d2fc87 — Register Billing package in API graph
- 6eb13be — Register Billing dependency in API
- fa9a38c — Register Billing module in API runtime
- a552486 — Add Billing entitlement tests
- e96ffe7 — Add Communication core migration 0035
- fc8331f — Register Communication core migration
- 43c4489 — Lock Communication core migration checksum
- c8c35bf — Add Communication package manifest
- 57c3208 — Add Communication TypeScript project
- e162117 — Implement Communication repository
- 4b3b275 — Implement Communication service
- 3a40f74 — Add Communication runtime manifest
- a8ef171 — Export Communication package
- df51676 — Register Communication project in root graph
- b6af4a2 — Register Communication project in API graph
- fd73f97 — Register Communication dependency in API
- 92ee4c2 — Register Communication module in API runtime
- 2310529 — Refresh physical reconciliation after Trust review/expiry
- e96ffe7 — Add Communication core migration 0035
- 13614a9 — Add canonical Review repository invariant tests
- 8044713 — Remove resolved Address/Review architecture decisions
- 0076b5a — Align physical blueprint with canonical Automation AI and Integration tables
- 5595266 — Fix D1-invalid expression UNIQUE in Billing usage counters
- 98ce88a — Refresh Billing usage counter migration checksum
- 25f17cf — Propagate Seller AI business scope into AIRuntime requests
- 994a807 — Pass persisted Seller business scope into AI runtime
- 74663c3 — Wire business scope into Billing entitlement policy
- 72246b0 — Inject real BillingService into Seller AI API composition
- 10540b8 — Cover Seller AI business scope in entitlement policy test
- 118e73d — Update Seller AI runtime tests for persisted business scope
- 04ee3b0 — Remove duplicate API workspace references
- 8a823dd2 — Fix pre-provision D1 syntax in Billing usage counters
- 10d94263 — Refresh migration 0034 checksum after syntax correction
- 84e00424 — Align Review migration with Gate 05 three-target contract
- bb49dc02 — Normalize Trust Review repository to three targets
- 95da531c — Normalize Trust Review service target contract
- 96e11934 — Test canonical Product Review target
- 81486981 — Add Business-scoped Billing counter uniqueness correction
- a9b9d5fb — Add Review target scope integrity migration
- 3cfbaf4e — Register Billing/Review integrity migrations
- a25ddaeb — Lock migrations through 0045
- c1476ee1 — Enforce stable Business-scoped Billing usage counters
- dfca4efc — Pass plan entitlement limit into quota enforcement
- 67b762dd — Fail closed when Billing quota meter is missing
- 5915ac1b — Mark unavailable Billing configuration as temporary_unavailable
- 683d7d15 — Test Billing plan entitlement quota enforcement
- 6c534a27 — Reconcile logical database model with canonical Demand/AI names
- 7379301b — Reconcile relationship matrix with canonical Runtime tables
- 12701f60 — Reconcile architecture contract physical names
- f7f9121b — Resolve Review target matrix in reconciliation docs
- 559c45c7 — Align physical schema blueprint with Gate 05 Review targets
- 4f246cd — Restore migration lock verifier helpers
- 42f8063 — Test Communication message and notification idempotency
- 2310529 — Refresh physical reconciliation after Trust review/expiry
- 3458d50 — Document Trust review/expiry physical contracts
- 3ba47ec — Record Trust physical implementation status
- 66a0ed4 — Reconcile Trust policy/check/decision chain
- 192fc95 — Align Trust physical blueprint
- 996658e — Align logical Trust model with physical chain

Migration safety:
- canonical migrations 0001–0048 remain numbered and are extended only through new migrations;
- migrations 0024–0048 are preserved in the canonical lock sequence.
- the committed migration lock remains the integrity source for canonical SQL;
- no second schema registry was introduced.
- Verification note: GitHub Actions now provides the authoritative build/test verification path; the latest observed pipelines progressed through build/typecheck and surfaced only test-suite contract failures, which are being fixed directly.

Catalog offering integrity hardening remains in 0014_catalog_offering_integrity.sql; 0015_business_primary_category_integrity.sql adds three integrity triggers and no tables; 0016_catalog_attribute_vocabulary.sql adds three Catalog Attribute tables; 0017_catalog_attribute_values.sql adds two AttributeValue tables and preserves all prior migration identities/checksums.

The old in-memory database implementation is retained only as an explicit legacy compatibility module and is no longer part of the canonical @qooqnos/database root API.

Customer/CRM verification note: repositories and scope-focused tests were added; full local test execution remains unavailable in this connector environment.

CI install reconciliation note: GitHub Actions run 35715908415 initially failed at npm install because package.json declared TypeScript ESLint 7-era direct dependencies while the canonical package-lock already resolved the 8.70.0 toolchain. Root package.json is now aligned to the lockfile toolchain (`typescript-eslint` 8.42, ESLint 9.35, Node >=22).

Migration verifier note: scripts/verify-migration-lock.mjs verifies the complete SQL source set against the canonical lock independent of commit grouping.

Migration lock note: migration 0021 was refreshed before provisioning after a pre-apply SQL cleanup; migrations 0022–0048 are registered and locked in sequence from canonical SQL contents. Full external D1 application has not yet been executed.

Deployment readiness note: `wrangler.toml` now documents environment-specific D1/Queue/R2 bindings without inventing remote resource IDs. Remote D1 provisioning and real Cloudflare binding configuration remain the final infrastructure gate.

Customer address note: migration 0026 stores the structured Address value object in Customer ownership; CustomerProfile remains gated on field-level contract.

Automation note: migration 0036 establishes versioned workflows, triggers, actions and execution state. Workflow version activation plus pause/retire lifecycle controls are canonical repository/service/API operations, and those lifecycle transitions now emit transactional Outbox events. Durable scheduler/worker action execution remains gated until the capability invocation contract is executable.

Booking finalization note: migrations 0046–0047 establish idempotent Booking creation, transactional hold consumption, appointment/resource commitment and capacity mutation guards. Availability calculation and schedule-derived slot generation remain separate.

Trust Review note: migration 0042 physicalizes the canonical Review target from Gate 05 (Business/Offering/Product); 0045 adds target-scope integrity on insert/update and the Trust package exposes the same three-target creation boundary.

Review reputation note: migration 0048 completes Review lifecycle/report/response/moderation/risk/reputation persistence. Reputation is rebuildable projection state; Review/Booking/Customer/Business remain the authoritative sources.

Automation/Integration API note: Automation workflow/version/execution and Integration account/webhook/sync-job capabilities are now registered in the canonical API router; durable worker execution remains gated by provider/capability contracts.

Latest verified commits:
- e1769126 — Expose persisted AI Runtime terminal results and normalize abstention operation state
- d965b2e — Replay persisted AI Runtime terminal results without rerunning providers
- 134a68a — Test AI Runtime terminal replay and abstention persistence
- 556a4086 — Add canonical Fulfillment migration 0049
- 9d5f4383 — Implement Fulfillment repository
- b9f6a27a — Implement Fulfillment service capability
- 87e38c92 — Add Fulfillment service-delivery route
- d790c08c — Register Fulfillment routes in canonical router
- 833e169f — Test Fulfillment commitment idempotency/lifecycle
- 17a21774 — Test protected Fulfillment API registration
- d31481e4 — Repair migration lock JSON separator after 0049
- fe44de5e — Test Booking availability generation across DST and capacity constraints
- 426196ce — Finalize Automation lifecycle + Outbox transition verification
- 793b494 — Test Automation workflow lifecycle controls
- 1cc6cba — Expose Automation workflow activate/pause/retire routes
- 085805e — Expose Automation lifecycle service
- 5c8219f — Complete Automation workflow activation and lifecycle control
- 5869597 — Test canonical Matching Connect flow
- 421a91c — Keep Matching Connect dependency optional for non-connect consumers
- a06eb07 — Make Match Connect selection-bound and replay-safe
- 615a5ae — Require explicit Match selection before Connect
- 6eab4c0 — Add canonical Customer relationship lookup for Match Connect replay
- 30199b0 — Resolve Match offering candidates to canonical Business
- 45731de — Expose Matching Connect API
- 55a6118 — Record Automation and Integration API composition in ledger
- c681855 — Expose Review lifecycle fields from canonical 0048 schema
- f6f0c3b — Update Review repository tests for lifecycle fields
- e15721d — Expose Integration sync job API capability
- 56591ab — Test protected Integration sync job route

CI verification: commit `426196ce1758a3f73499c22b59f520be29315401` passed both GitHub Actions `CI` and `Phoenix verification` (run IDs `35786881635` and `35786881674`). Migration lock verification, typecheck, build and unit tests were green in that verification path.

Review moderation note: migration 0048 completes moderation/reporting/reputation projection storage and API/service behavior.

Fulfillment 0049 note: package `@qooqnos/fulfillment` and canonical API routes are registered; lifecycle intake is idempotent and status transitions emit Outbox + append-only history.

Fulfillment note: migration 0049 establishes the reusable Fulfillment & Service Delivery execution model across physical, digital and service obligations. Commerce/Booking/Billing remain authoritative for upstream commitments and finance; Fulfillment owns execution state and evidence. Review target types remain canonical Business/Offering/Product only.

Matching execution note: retrieval/ranking is wired through Discovery projections with deterministic eligibility-first ranking and replay-safe candidate reuse. `Match → Connect` is now implemented as the canonical Matching orchestration: it requires an explicit selected decision, resolves the canonical Business target, creates/replays the existing Customer↔Business relationship, and advances the MatchRequest to `connected`. Connect does not create a second relationship or supply source of truth.

Matching Connect note: `packages/matching/src/service.ts`, `packages/matching/src/repository.ts`, `apps/api/src/matching-routes.ts`, and `packages/database/src/customer-relationship-repository.ts` provide the canonical connection boundary. Commit `5869597` is covered by green CI and Phoenix verification runs.

Discovery projection note: Business creation/publication outbox events are now consumed by the Discovery projector; indexed eligibility follows authoritative Business publication state. Catalog/product projection remains derived and non-authoritative.

Privacy note: migration 0039 establishes consent, privacy-request and per-module processing persistence. Durable export/delete/retention workers remain follow-up operational capabilities.

Integration note: migration 0038 establishes provider/account/webhook/sync/external-reference persistence; provider adapters and durable sync workers remain operational follow-up.

AI Runtime composition note: Seller AI now persists canonical AI operation/result/usage evidence around the shared Runtime. Repeated Seller AI requests replay the persisted draft before invoking the model again; provider adapters/routing/validation workers remain the next operational layers.

AI Runtime note: migration 0037 establishes shared operation/provider/model/policy/prompt/schema/result/usage persistence. Runtime provider/model strings are not written into FK fields until a canonical provider/model registry mapping contract is explicit. Persistent Runtime terminal operations now replay stored terminal evidence instead of invoking a provider again; abstention is retained in `ai_runtime_results` while the operation lifecycle uses the canonical `blocked` status. 

Communication note: migration 0035 establishes provider-neutral Conversation/Message/Notification/Delivery storage with tenant scope and Notification idempotency. Notification creation is transactional with Outbox; the scheduled dispatch worker now claims queued notifications, records DeliveryAttempt evidence, provides a built-in in-app adapter, and requeues transient adapter failures. External provider adapters plus template/policy/consent layers remain gated.

Billing runtime note: the API Seller AI composition now uses the real D1-backed BillingService. No fallback unavailable Billing service is used for the production path; missing plan/subscription/entitlement state fails the operation closed.

Billing note: migrations 0033–0034 establish plan/price/subscription/entitlement/usage/provider-reference/reconciliation storage plus an atomic quota counter. Billing is the commercial entitlement authority; payment execution, invoices and financial ledger remain gated.

Commerce note: migrations 0031–0032 establish the Commerce-owned Cart/Checkout/PriceSnapshot/Order transaction boundary and integrity hardening. Cart/Checkout/Order API routes are live in the canonical router; Order creation/status transitions are idempotent/CAS and emit Outbox events. Billing/Payment remains authoritative for payment execution, financial settlement, refunds and invoices.

Slot projection note: the canonical Booking slot generator is a derived projection over Schedule/Rule/Exception/Appointment/Hold state; no authoritative slots table exists.

Booking note: migrations 0028–0030 establish the canonical Booking/Availability physical core and short-lived holds. Migrations 0046–0047 complete transactional finalization, idempotency and capacity guards; confirmation/status events now use the platform Outbox. No second reservation model or authoritative slots table is permitted.

Business lifecycle note: migration 0027 records immutable transitions for the existing physical `draft/active/suspended/archived` Business statuses. It intentionally does not invent a new status vocabulary.

CRM timeline note: normalized event storage and idempotent source-event handling are implemented. A separate timeline projection table remains gated pending a field-level read-model/rebuild contract.

Trust note: migrations 0021–0025 implement the canonical VerificationCase → Policy/Requirement → Check/Evidence → append-only Decision → Review/Expiry chain. Reviewer authorization integration and TrustSignal projections remain gated.

Trust expiry worker: scheduled Trust expiry processing is now idempotent; expired work creates an append-only system Policy Decision, marks the expiry/case state and emits `trust.verification.expired` through Outbox in one D1 batch.

Trust API routes: canonical VerificationCase creation, human-review assignment/completion, Review creation and Review moderation are now exposed through the main API router with centralized authorization.

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
0027_business_status_history.sql
0028_booking_core.sql
0029_availability_schedules.sql
0030_booking_holds_history.sql
0031_commerce_transaction_core.sql
0032_commerce_integrity_hardening.sql
0033_billing_core.sql
0034_billing_usage_counters.sql
0035_communication_core.sql
0036_automation_core.sql
0037_ai_runtime_core.sql
0038_integration_core.sql
0039_privacy_consent_requests.sql
0040_demand_matching_core.sql
0041_demand_matching_integrity.sql
0042_reviews_core.sql
0043_integrity_update_guards.sql
0044_billing_counter_scope.sql
0045_review_target_integrity.sql
0046_booking_finalization_guards.sql
0047_booking_capacity_update_guards.sql
0048_reviews_moderation_reputation.sql
0049_fulfillment_core.sql
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

## 7. Current completion focus

The canonical physical inventory now reaches migration 0049. The remaining work is execution/completion, not schema invention:

```
pass CI build + tests
→ keep canonical runtime free of legacy implementations
→ finish API/runtime composition for remaining canonical capabilities
→ complete durable workers for Outbox/Communication/Automation/Integration/Trust/Privacy
→ finish Matching retrieval/ranking/learning and Connect/Act integrations
→ close CustomerProfile/timeline only when field-level contracts are explicit
→ define remaining Localization/Documents/Analytics contracts
→ provision D1 only after the application/runtime verification gates are green
```

No new table should be introduced merely to move the completion checklist forward.
