# Phoenix Implementation Ledger

**Status:** Current implementation ledger
**Core implementation completion:** 100%  
**Last reviewed:** 2026-09-24

SEO/GEO implementation has started from the frozen architecture contracts; all future SEO/GEO work must extend the single reusable platform capability and never duplicate SEO logic inside vertical modules.
**Documentation reconciliation:** 2026-09-22; see repository history and this ledger for the latest commit references.

This ledger is the continuity record for future coding agents. Completed or superseded work must not be re-implemented merely because an older document still mentions it.

## 1. Capability status

| Capability | Status | Canonical source |
|---|---|---|
| SEO/GEO Engine core | 🟢 Core implementation complete | packages/seo; migrations/0077–0079; apps/api/src/seo-routes.ts; docs/SEO_GEO_ENGINE_ARCHITECTURE.md; docs/SEO_GEO_WORLD_CLASS_ENGINE.md | Canonical entity model, centralized URLs/policy/freshness, metadata/structured data, GEO answers, sitemap/robots, entity graph, internal links, geographic truth, query-intent model, consistency diagnostics, agentic readiness, tenant-scoped persistence, dependency/invalidation, audits/measurements, durable publication jobs, canonical business/catalog event adapters, structured-data validation, query persistence, controlled experiments, visibility-provider boundary, scheduled worker and production API routes are implemented. External vendor credentials/connectors remain deployment/provider activation gates, not missing SEO engine core. |
| Product North Star | ✅ Complete | docs/PHOENIX_PRODUCT_NORTH_STAR.md |
| AI product direction | ✅ Complete | docs/AI_PRODUCT_DIRECTION.md |
| Capability decision rules | ✅ Complete | docs/CAPABILITY_DECISION_RULES.md |
| Logical database model | ✅ Canonical | docs/DATABASE_MODEL.md |
| Physical schema blueprint | ✅ Canonical | docs/PHYSICAL_SCHEMA_BLUEPRINT.md |
| Physical database reconciliation | ✅ Canonical planning gate | docs/DATABASE_PHYSICAL_RECONCILIATION.md |
| Migration ownership model | ✅ Canonical | docs/MIGRATION_BLUEPRINT.md |
| Migration catalog contract | ✅ Implemented | docs/MIGRATION_CATALOG_IMPLEMENTATION.md |
| Migration lock integrity | ✅ Implemented | docs/MIGRATION_LOCK_STRATEGY.md |
| Canonical source boundary guard | 🟢 CI guard implemented | scripts/verify-canonical-source-boundary.mjs; package.json; .github/workflows/ci.yml; .github/workflows/phoenix-verification.yml |
| Runtime module registry guard | 🟢 CI guard implemented | scripts/verify-runtime-module-registry.mjs; package.json; .github/workflows/ci.yml; .github/workflows/phoenix-verification.yml |
| D1 database client boundary | ✅ Implemented | packages/database/src/client.ts |
| D1 runtime database boot boundary | ✅ Implemented | packages/runtime/src/boot.ts |
| Foundation / onboarding / identity / business / catalog SQL | 🟢 Implemented in migration sequence | migrations/0001–0005 |
| Canonical Onboarding D1 service | 🟢 Package/contract/repository/service implemented | packages/onboarding/src/contract.ts; packages/onboarding/src/repository.ts; packages/onboarding/src/service.ts |
| Catalog guard/integrity migrations | 🟢 Implemented in migration sequence | migrations/0006–0008, 0014 |
| Business category integrity hardening | 🟢 Implemented | migrations/0015_business_primary_category_integrity.sql |
| Catalog Attribute vocabulary | 🟢 Foundation implemented | migrations/0016_catalog_attribute_vocabulary.sql |
| Catalog AttributeValue storage | 🟢 Cutover completed | migrations/0017_catalog_attribute_values.sql; migrations/0063_catalog_attribute_cutover.sql; packages/catalog/src/attribute-value-repository.ts; packages/catalog/src/repository.ts |
| Customer core | 🟢 Schema/repository implemented | migrations/0018_customer_core.sql; packages/database/src/customer-repository.ts |
| CRM Customer relationships | 🟢 Schema/repository implemented | migrations/0019_crm_customer_relationships.sql; packages/database/src/customer-relationship-repository.ts |
| CRM timeline + projection | 🟢 Event store, rebuildable read model, atomic projection, history reads and tests implemented | migrations/0020_crm_timeline_events.sql; migrations/0074_crm_timeline_projection.sql; packages/database/src/crm-timeline-repository.ts; packages/database/src/crm-timeline-projection-repository.ts; packages/customer/src/service.ts; apps/api/src/customer-routes.ts; docs/CRM_TIMELINE_PROJECTION_CONTRACT.md |
| Customer addresses | 🟢 Schema/repository implemented | migrations/0026_customer_addresses.sql; packages/database/src/customer-address-repository.ts |
| Customer capability package | 🟢 Package/service/manifest/API/history implemented | packages/customer/src/service.ts; packages/customer/src/manifest.ts; apps/api/src/customer-routes.ts; `CustomerProfile` remains a logical aggregate; Customer mutations publish transactional outbox events |
| Business lifecycle history / onboarding reconciliation | 🟢 Schema/repository + semantic contract reconciled | migrations/0027_business_status_history.sql; packages/business/src/repository.ts; packages/onboarding/src/contract.ts; docs/BUSINESS_DATA_DICTIONARY.md |
| Booking core | 🟢 Schema/package/repository implemented | migrations/0028_booking_core.sql; packages/booking/src/repository.ts; packages/booking/src/service.ts |
| Booking availability rules | 🟢 Schema/repository implemented | migrations/0029_availability_schedules.sql; packages/booking/src/availability-repository.ts |
| Booking holds / lifecycle history | 🟢 Schema/repository implemented | migrations/0030_booking_holds_history.sql; packages/booking/src/repository.ts |
| Booking transactional finalization | 🟢 Schema/service/API/outbox implemented | migrations/0046_booking_finalization_guards.sql; migrations/0047_booking_capacity_update_guards.sql; packages/booking/src/repository.ts; packages/booking/src/service.ts; apps/api/src/booking-routes.ts |
| Platform Outbox / Queue boundary | 🟢 Publisher/lease/worker boundary implemented | packages/database/src/services.ts; apps/api/src/outbox-worker.ts; apps/api/src/index.ts; apps/api/src/env.ts |
| Commerce transaction core | 🟢 Schema/package/repository/service/API implemented | migrations/0031_commerce_transaction_core.sql; migrations/0032_commerce_integrity_hardening.sql; packages/commerce/src/repository.ts; packages/commerce/src/service.ts; apps/api/src/commerce-routes.ts |
| Billing core / entitlements / usage | 🟢 Schema/package/service implemented | migrations/0033_billing_core.sql; migrations/0034_billing_usage_counters.sql; packages/billing/src/repository.ts; packages/billing/src/service.ts |
| Financial audit trail | 🟢 Append-only schema/repository/integrity tests implemented | migrations/0058_billing_financial_audit_trail.sql; packages/billing/src/financial-audit.ts; packages/billing/src/financial-audit.test.ts |
| Refund financial accounting | 🟢 Refund lifecycle + immutable double-entry ledger + balanced posting + tests implemented | migrations/0059_billing_refund_financial_accounting.sql; packages/billing/src/refund-accounting.ts; packages/billing/src/refund-accounting.test.ts |

Refund financial accounting commits: `594fef3` (migration), `59c1198` (repository), `66019fc` (balanced-posting guard), `f640509` (approval/processing lifecycle), `b5832e6` + `35c3c91` (tests), `f38e813` (migration registration/lock), `6cb3fc9` (package export), and the related reconciliation/documentation commits.
| Communication core | 🟢 Schema/package/repository/service/API/outbox-consumer implemented | migrations/0035_communication_core.sql; packages/communication/src/repository.ts; packages/communication/src/service.ts; apps/api/src/communication-routes.ts; apps/api/src/outbox-worker.ts |
| Communication template registry | 🟢 Schema/package/repository/service/API implemented | migrations/0051_communication_templates.sql; packages/communication/src/repository.ts; packages/communication/src/service.ts; apps/api/src/communication-routes.ts |
| Communication policy / consent enforcement | 🟢 Schema/package/repository/service/API/test implemented | migrations/0055_communication_policy_consent.sql; migrations/0056_communication_required_suppression.sql; packages/communication/src/repository.ts; packages/communication/src/service.ts; apps/api/src/communication-routes.ts |
| Automation workflow engine | 🟢 Schema/package/repository/service/API/worker implemented | migrations/0036_automation_core.sql; packages/automation/src/repository.ts; packages/automation/src/service.ts; apps/api/src/automation-routes.ts; apps/api/src/automation-worker.ts; apps/api/src/automation-execution-worker.ts |
| Automation capability executor | 🟢 Runtime registry/executor/composition/worker implemented | packages/runtime/src/capabilities.ts; packages/automation/src/executor.ts; packages/automation/src/repository.ts; apps/api/src/capabilities.ts; Booking availability, Case Support and Fulfillment canonical aliases are registered |
| AI Runtime persistence | 🟢 Schema/repository/runtime composition implemented | migrations/0037_ai_runtime_core.sql; packages/ai/src/runtime-repository.ts; packages/ai/src/runtime-client.ts; apps/api/src/ai-composition.ts |
| AI Runtime worker lease boundary | 🟢 Durable lease/claim/reclaim/resolver/scheduler implemented | migrations/0053_ai_runtime_worker_leases.sql; packages/ai/src/runtime-repository.ts; packages/ai/src/worker.ts; packages/ai/src/runtime-input-resolver.ts; apps/api/src/ai-composition.ts; apps/api/src/index.ts |
| Integration core | 🟢 Schema/package/repository/service/API/durable worker-boundary implemented | migrations/0038_integration_core.sql; packages/integration/src/repository.ts; packages/integration/src/service.ts; packages/integration/src/adapter.ts; packages/integration/src/worker.ts; apps/api/src/integration-routes.ts; apps/api/src/integration-worker.ts |
| Discovery index generation / evaluation | 🟢 Schema/package/repository/service/test implemented | migrations/0054_discovery_index_observability.sql; packages/discovery/src/repository.ts; packages/discovery/src/service.ts; packages/discovery/src/index-observability.test.ts |
| Privacy / Consent core | 🟢 Schema/package/repository/service implemented | migrations/0039_privacy_consent_requests.sql; packages/privacy/src/repository.ts; packages/privacy/src/service.ts |
| Fulfillment / Service Delivery core | 🟢 Schema/package/repository/service/API/provider-boundary implemented | migrations/0049_fulfillment_core.sql; packages/fulfillment/src/repository.ts; packages/fulfillment/src/service.ts; packages/fulfillment/src/adapter.ts; apps/api/src/fulfillment-routes.ts |
| Case Support core | 🟢 Schema/package/repository/service/API implemented | migrations/0050_case_support_core.sql; packages/case-support/src/repository.ts; packages/case-support/src/service.ts; apps/api/src/case-support-routes.ts |
| CaseAction execution worker | 🟢 CapabilityRegistry-backed worker implemented | packages/case-support/src/repository.ts; apps/api/src/capabilities.ts; apps/api/src/case-action-worker.ts |
| Case external queue/provider dispatch | 🟢 Provider-neutral dispatch boundary + durable attempts + outbox trigger + scheduled worker + runtime HTTP adapter implemented | migrations/0073_case_queue_provider_dispatch.sql; packages/case-support/src/dispatch-adapter.ts; packages/case-support/src/dispatch-repository.ts; packages/case-support/src/dispatch.ts; apps/api/src/case-dispatch-worker.ts |
| Privacy subject scope validation | 🟢 Repository validation/test implemented | packages/privacy/src/repository.ts; packages/privacy/src/repository.test.ts |
| Privacy processor contract | 🟢 Domain-owned export/delete/retention processors implemented | packages/privacy/src/processor.ts; packages/privacy/src/retention.ts; packages/customer/src/privacy-processor.ts; apps/api/src/privacy-worker.ts |
| Privacy subject-request worker orchestration | 🟢 Scheduler/claim/outbox boundary implemented | packages/privacy/src/repository.ts; apps/api/src/privacy-worker.ts; apps/api/src/index.ts |
| Lifecycle invariant hardening | 🟢 Implemented through `18342b7` + explicit CAS test `8bf1372` | Billing subscription terminal transitions; Matching latest-decision/terminal request guards; Automation execution/attempt terminal guards; AI operation terminal guard + failed-operation replay; CustomerRelationship interaction CAS; focused repository/client tests |
| CustomerRelationship concurrency hardening | 🟢 Verified in `90792c7` | `packages/database/src/customer-relationship-repository.ts`; `c2692c8`; `2b98364`; `48af422`; `7573f49` test harness |
| Business lifecycle concurrency hardening | 🟢 Verified in `90792c7` | `packages/business/src/repository.ts`; `b935137`; `90792c7` test harness |
| Demand / Matching core | 🟢 Schema/package/repository/service/API/retrieval/ranking/connect implemented | migrations/0040_demand_matching_core.sql; migrations/0041_demand_matching_integrity.sql; packages/matching/src/repository.ts; packages/matching/src/service.ts; apps/api/src/matching-routes.ts |
| Matching learning signals | 🟢 Append-only outcome evidence implemented | migrations/0057_matching_learning_signals.sql; packages/matching/src/learning-repository.ts; packages/matching/src/service.ts; packages/matching/src/service.test.ts; apps/api/src/matching-routes.ts |
| Review moderation / reputation | 🟢 Schema/repository/service/API implemented | migrations/0048_reviews_moderation_reputation.sql; packages/trust/src/repository.ts; packages/trust/src/service.ts; apps/api/src/trust-routes.ts; Review lifecycle fields exposed from repository |
| Generic ModerationCase | 🟢 Schema/repository/service/test implemented | migrations/0052_moderation_cases.sql; packages/trust/src/repository.ts; packages/trust/src/service.ts; packages/trust/src/repository.test.ts |
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
| Full canonical logical model | 🟢 Core logical model resolved | physical coverage is complete for the canonical physical blueprint; remaining work is operational/provider/projection gates rather than an unimplemented CustomerProfile table

Database completion note: all physical table contracts in docs/PHYSICAL_SCHEMA_BLUEPRINT.md have canonical physical representations; CustomerProfile is intentionally represented as a logical aggregate over Customer-owned records rather than a separate table. |
| Final physical D1 schema | 🟢 Physical blueprint complete | all physical table contracts have canonical representations; remaining work is operational/provider/projection gates |
| Database completion audit | 🟢 Executable integrity audit | scripts/report-database-completion.mjs; package.json `report:database` |
| Production D1 migration executor | 🟢 Canonical remote execution path implemented | scripts/migrate-production-d1.mjs; package.json `migrate:prod:canonical`; production deploy invokes it before Worker deploy |
| Legacy PostgreSQL database path | ✅ Removed from active source | historical git history only |
| Legacy in-memory database path | 🟢 Removed from active source | legacy implementation deleted; canonical D1 database is the only active database path |
| Legacy onboarding compatibility | 🟢 Removed from active source | legacy workflow/test deleted; canonical D1 onboarding service is the only active onboarding path |
| Legacy Node server | 🟢 Removed from active source | legacy Node server deleted; canonical runtime/Worker path is authoritative |

### Legacy compatibility cleanup — 2026-09-24

The remaining yellow legacy compatibility paths were removed from the active source tree. The in-memory database, legacy onboarding workflow/test, and legacy Node HTTP server are no longer part of the repository. The obsolete TypeScript aliases, lint exclusions, canonical-source allowlist entries and runtime exclusion were removed as well. The canonical D1 database, D1 onboarding service and Worker runtime are now the only active paths.

Cleanup commits: `3fe67d1`, `8f02cfc`, `aa75afe`, `81162b0`, `6f7fe40`, `ed39a42`, `7fc6f16`, `4055287`, `0c66ec0`, `cd1dadb`, `e7952ba`, `4abc6b9`, `98e25ea`, `9c03b9f`, `65b4796`, `da12643`.

## Database completion status — 2026-09-24

**Physical D1 schema: 100%.** The canonical migration set reaches 0075 and the reconciled inventory contains the physical tables from the current migration catalog. The repository now has an executable audit that cross-checks SQL migration count, API catalog count, migration-lock count, sequence continuity and the documented physical-table total; invoice and refund financial migrations are included in the current canonical sequence.

**Database engineering readiness: 91.7% on the explicit 12-gate rubric:** 11 repository/schema/runtime gates are closed; the remaining gate is credentialed remote application of the canonical migration history to the provisioned production D1. This percentage is a readiness metric, not a product-completion score.

The current main head is `30cf6fe4b1e95dda5ccd91af20b7001bb0e39192` and is freshly CI/Phoenix-verified.

## 2. Database history

### Historical — commit 2024bdb

A PostgreSQL-oriented Phase 4 implementation was created, including:

- postgres-adapter.ts
- postgres-database.ts
- generic repository implementations
- built-in TypeScript migrations
- USE_POSTGRES runtime selection

This work is preserved as history but is superseded.

- 4d9916c — Test CustomerRelationship interaction CAS guard
- b02d42a — Restore canonical migration import ordering
- 8bf1372 — Add explicit CustomerRelationship interaction CAS test
- 614c7cf — Record explicit CustomerRelationship CAS test
- 0bd7f8a — Refresh verification snapshot after post-checkpoint code fixes
- c64b9af — Verify migration API catalog ordering against canonical SQL
- 4393a09 — Fix migration catalog verifier regexes
- 8bf1372 — Add explicit CustomerRelationship interaction CAS test

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
- 7ffdcc0d — Harden Privacy consent revocation and request lifecycle transitions
- eb197c5c — Test Privacy request lifecycle transition guard
- 4f246cd — Restore migration lock verifier helpers
- 42f8063 — Test Communication message and notification idempotency
- 2310529 — Refresh physical reconciliation after Trust review/expiry
- 3458d50 — Document Trust review/expiry physical contracts
- 3ba47ec — Record Trust physical implementation status
- 66a0ed4 — Reconcile Trust policy/check/decision chain
- 192fc95 — Align Trust physical blueprint
- 996658e — Align logical Trust model with physical chain

Migration safety:
- canonical migrations 0001–0064 remain numbered and are extended only through new migrations;
- migrations 0024–0064 are preserved in the canonical lock sequence;
- the committed migration lock remains the integrity source for canonical SQL;
- no second schema registry was introduced.
- Verification note: GitHub Actions is the authoritative build/test verification path; the current `main` head passed both CI and Phoenix verification with format, lint, migration-lock verification, typecheck, build, Worker dry-run and unit tests green.

Catalog offering integrity hardening remains in 0014_catalog_offering_integrity.sql; 0015_business_primary_category_integrity.sql adds three integrity triggers and no tables; 0016_catalog_attribute_vocabulary.sql adds three Catalog Attribute tables; 0017_catalog_attribute_values.sql adds two AttributeValue tables and preserves all prior migration identities/checksums.

The old in-memory database implementation has been removed from the active source tree and is no longer available through any package export.

Customer/CRM verification note: repository and scope-focused tests are covered by the repository test suite and current GitHub Actions verification.

CI install reconciliation note: GitHub Actions run 35715908415 initially failed at npm install because package.json declared TypeScript ESLint 7-era direct dependencies while the canonical package-lock already resolved the 8.70.0 toolchain. Root package.json is now aligned to the lockfile toolchain (`typescript-eslint` 8.42, ESLint 9.35, Node >=22).

Migration verifier note: scripts/verify-migration-lock.mjs verifies the complete SQL source set against the canonical lock independent of commit grouping.

Migration lock note: migration 0021 was refreshed before provisioning after a pre-apply SQL cleanup; migrations 0022–0059 are registered and locked in sequence from canonical SQL contents. Migration 0055 checksum was independently reconciled from canonical SQL. The verification script also checks API migration import order and migrationSources order against the canonical SQL sequence. The latest verified checkpoint is `30cf6fe4b1e95dda5ccd91af20b7001bb0e39192` (CI `36010494882`, Phoenix verification `36010494895`). Full external D1 application has not yet been executed because the current runtime environment does not expose Cloudflare API credentials.

Production D1 execution note: the repository now verifies the supplied production D1 identity and applies pending canonical migrations through Cloudflare D1 remote SQL execution while preserving Phoenix `schema_migrations`; the live Cloudflare call has not been executed from this ChatGPT runtime because Cloudflare credentials/connector are not exposed here.

Case external dispatch note: queue assignment can create a durable CaseDispatch with deterministic assignment idempotency; the transactional outbox publishes the request; the scheduled worker resolves a provider-neutral adapter, records append-only attempts, classifies failures and retries transient failures. Provider endpoint/credentials remain runtime-only.

Current operational boundary note: Integration durable claim/sync workers, Fulfillment provider-adapter contracts, Matching retrieval/ranking/Connect execution plus canonical Matching Outbox events and Act outcome links, Automation scheduled execution, AI durable Seller AI worker resolution, privacy consent expiry and approved-request orchestration, Communication intent/consent/suppression policy, Localization registry, Case external dispatch, Analytics, CRM timeline projection, canonical-source legacy boundary enforcement, and runtime-module registry enforcement are implemented. Remaining controlled gates are provider-specific vendor onboarding/credentials, any provider-specific Fulfillment/Integration reconciliation semantics, and credentialed remote D1 migration/application. Production D1 itself is now provisioned externally.

Deployment readiness note: `wrangler.toml` remains free of fabricated Cloudflare resource IDs. Production deployment renders `.wrangler/production.wrangler.toml` from real deployment variables, verifies D1/R2/Queue/Workers AI/model bindings, runs the pinned Worker dry-run and tests, then deploys. `/ready` exposes infrastructure binding state in production and scheduled execution fails closed when mandatory bindings are absent.

Customer address note: migration 0026 stores the structured Address value object in Customer ownership; CustomerProfile is a logical aggregate over Customer core/preferences/addresses and is not a standalone table.

Automation note: migrations 0036, 0069 and 0070 establish versioned workflows, triggers, actions, execution state and the concrete compensation contract. Workflow activation/pause/retire lifecycle, transactional Outbox events, scheduled execution, CapabilityRegistry-backed invocation, idempotent AutomationExecutor, reverse-order compensation of prior completed actions, durable compensation references, idempotency keys and compensation evidence are implemented. Non-compensatable and manual recovery remain explicit policy modes rather than implicit rollback.

Booking finalization note: migrations 0046–0047 establish idempotent Booking creation, transactional hold consumption, appointment/resource commitment and capacity mutation guards. `c2943bd` additionally records BookingStatusHistory and AppointmentEvent evidence atomically during finalization; `ed05f89` updates the finalization invariant test to cover the seven-statement atomic batch. Availability calculation and schedule-derived slot generation remain separate.

Trust Review note: migration 0042 physicalizes the canonical Review target from Gate 05 (Business/Offering/Product); 0045 adds target-scope integrity on insert/update and the Trust package exposes the same three-target creation boundary.

Fulfillment adapter note: the canonical Fulfillment package now exposes a provider-neutral carrier/service adapter contract over the existing shipment/tracking/service-completion tables. No provider SDK or duplicate tracking ledger is introduced.

Review reputation note: migration 0048 completes Review lifecycle/report/response/moderation/risk/reputation persistence. Reputation is rebuildable projection state; Review/Booking/Customer/Business remain the authoritative sources.

Automation/Integration API note: Automation workflow/version/execution and Integration account/webhook/sync-job capabilities are registered in the canonical API router; durable claim/sync execution is implemented, while provider-specific adapters/credentials remain external gates.

Latest verified commits:
- 359d430c6ced62c89b0f3c53bc66beacbfc87275 — latest fully verified checkpoint before the canonical source/module registry guards
- 2d068b1d1a017691071c54a3e105b508b194a2c5 — canonical source boundary guard
- 1c0b2901cd9ad14e0ad7547e1734953006d72d0d — source-boundary CI wiring
- 1e62f4d4ea72fc92c6fd8429e5023c00ac14bd97 — Phoenix verification wiring
- e92ed1eedabab8c5058c318c2d22fd91f0259758 — production preflight source-boundary guard
- be475620aff276affc86ade7d12cc24a0f60ae37 — narrowed legacy compatibility allowlist
- 2f39535db072ee8a28f0b3af973098ce0f6bf15d — runtime module registry guard
- 07df5600a4b010e94f5dd7e1734953006d72d0d — runtime registry package command
- 9d83116a203e111986fd2e87bcb5263eedeb0300 — CI runtime registry wiring
- 87dd3113dfaef658d5defd0c9af9e9f6ac2465de — Phoenix verification runtime registry wiring
- bb275dc1321ab2ae902725c391794ec8b93dc788 — production preflight runtime registry guard
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
- 5199e4a — Make Fulfillment a composite workspace build target
- 1b4011cb — Add Fulfillment to root TypeScript build graph
- 78a38f41 — Add BillingRepository plan listing
- 3ceddd89 — Add BillingService plan listing capability
- 03f5d4d8 — Expose canonical Billing plan listing route
- 346b788b — Register Billing routes in canonical router
- 61327406 — Test protected Billing plan route
- 3beb6ab2 — Fix unused Billing plan listing context argument
- f0d4464d — Remove unused Billing route dependencies
- 13457e45 — Fix Billing plan service RequestContext import
- e15e16e — Finalize Fulfillment continuity ledger after migration verification reset
- fe44de5e — Test Booking availability generation across DST and capacity constraints
- 426196ce — Finalize Automation lifecycle + Outbox transition verification
- 793b494 — Test Automation workflow lifecycle controls
- 1cc6cba — Expose Automation workflow activate/pause/retire routes
- 085805e — Expose Automation lifecycle service
- 5c8219f — Complete Automation workflow activation and lifecycle control
- 076e7863 — Publish canonical Matching outbox events transactionally
- f178a59 — Add Privacy subject-request claim boundary
- 397de04 — Implement Privacy approved-request worker orchestration
- f3d5067 — Run Privacy subject-request worker from scheduled Worker
- b4db6ef — Test Privacy request claim boundary
- a27b37e — Strengthen Privacy claim test to model CAS transition
- b9e9a51 — Synchronize verification and reconciliation snapshots
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

CI verification: commit `13457e4554584bb002adb0b1d8f6145475a2b356` passed both GitHub Actions `CI` and `Phoenix verification` (run IDs `35819822179` and `35819822174`). Format, lint, migration lock verification, typecheck, build and unit tests were green.

Review moderation note: migration 0048 completes moderation/reporting/reputation projection storage and API/service behavior.

Fulfillment 0049 note: package `@qooqnos/fulfillment` and canonical API routes are registered; lifecycle intake is idempotent, status transitions emit transactional Outbox + append-only history, and the package is included in the composite root build graph. CI/Phoenix verification are green.

Fulfillment note: migration 0049 establishes the reusable Fulfillment & Service Delivery execution model across physical, digital and service obligations. Commerce/Booking/Billing remain authoritative for upstream commitments and finance; Fulfillment owns execution state and evidence. Review target types remain canonical Business/Offering/Product only.

Matching execution note: retrieval/ranking is wired through Discovery projections with deterministic eligibility-first ranking and replay-safe candidate reuse. `Match → Connect` is implemented as the canonical Matching orchestration: it requires an explicit selected decision, resolves the canonical Business target, creates/replays the existing Customer↔Business relationship, and advances the MatchRequest to `connected`. Connect does not create a second relationship or supply source of truth.

Matching Connect note: `packages/matching/src/service.ts`, `packages/matching/src/repository.ts`, `apps/api/src/matching-routes.ts`, and `packages/database/src/customer-relationship-repository.ts` provide the canonical connection boundary. Commit `5869597` is covered by green CI and Phoenix verification runs.

Discovery projection note: Business creation/publication outbox events are now consumed by the Discovery projector; indexed eligibility follows authoritative Business publication state. Catalog/product projection remains derived and non-authoritative. Migration 0054 adds versioned search-index generations, query traces and evaluation evidence.

Privacy note: migration 0039 establishes consent, privacy-request and per-module processing persistence. Canonical subject scope validation rejects customer/member/user/actor references outside the current organization/workspace before consent or privacy-request writes. The scheduled worker atomically claims approved requests and now executes registered domain PrivacyProcessors through a provider-neutral registry; requests with no registered processor remain explicitly gated, while completed processor sets transition the request and emit the request-status Outbox event.

Integration worker note: durable webhook/sync claim/finish semantics and provider-adapter boundaries are implemented. The worker now accepts wildcard provider capabilities, while preserving provider-specific type matching.

Integration provider-adapter note: `packages/integration/src/credential.ts` establishes the provider credential resolver contract with environment-backed runtime provisioning; `packages/integration/src/http-adapter.ts` establishes the configurable HTTP adapter, transient/permanent failure classification, credential injection, normalized sync results and signed webhook verification with replay-age protection. `docs/INTEGRATION_PROVIDER_ADAPTERS.md` is the canonical operational contract. No vendor-specific provider has been invented without an explicit provider contract; concrete vendor onboarding remains an external operational step.

Integration note: migration 0038 remains the canonical provider/account/webhook/sync/external-reference persistence boundary. No credential secret is persisted in the Integration schema.

AI Runtime composition note: Seller AI now persists canonical AI operation/result/usage evidence around the shared Runtime. Repeated Seller AI requests replay the persisted draft before invoking the model again; durable/asynchronous worker lease, claim/reclaim and Seller AI resolver execution are implemented.

AI Runtime note: migration 0037 establishes shared operation/provider/model/policy/prompt/schema/result/usage persistence. The Runtime now has the canonical provider registry, governance eligibility checks, routing policy, provider/model identity validation and output/safety validation; persistent terminal operations replay stored terminal evidence instead of invoking a provider again, and abstention is retained in `ai_runtime_results` while lifecycle state uses canonical `blocked`. 

Communication policy hardening: migration 0056 adds `applies_to_required` so explicit suppression policy can distinguish optional communications from required transactional/security traffic.

Communication policy note: migration 0055 establishes intent/channel policy, recipient preferences, explicit suppressions and per-notification policy decision evidence. Unknown intents, invalid channels, required-but-missing opt-in, and active suppressions fail closed; denied/suppressed sends are retained without Outbox dispatch.

Communication template note: migration 0051 establishes the scoped versioned template registry. Notification sends referencing templates now require an approved active version matching intent/channel/locale; approved versions are immutable.

Communication note: migrations 0035/0051/0055/0056 establish provider-neutral Conversation/Message/Notification/Delivery storage, versioned templates, intent/consent/suppression policy and required-message semantics. Migration 0065 adds canonical Push channel support and preserves existing data through table rebuilds. Runtime-configured HTTP adapters now cover Email/SMS/WhatsApp/Push, with optional secondary providers, idempotency propagation, timeout/network normalization, Retry-After handling and health/cooldown failover. Dispatch enforces tenant/recipient/channel/provider/platform rate limits plus bounded burst-anomaly cooldowns; provider credentials remain runtime-only.

Billing runtime note: the API Seller AI composition uses the real D1-backed BillingService. Missing plan/subscription/entitlement state fails the operation closed.

Billing note: migrations 0033–0034 establish plan/price/subscription/entitlement/usage/provider-reference/reconciliation storage plus an atomic quota counter. Migration 0058 adds the append-only financial audit evidence boundary with tenant isolation, idempotency, immutable before/after evidence, monetary context and integrity hashes. Billing is the commercial entitlement authority; payment execution, invoices and the double-entry financial ledger remain separate capabilities. `GET /api/v1/billing/plans` is now exposed through the canonical BillingService and router permission `billing.plan.read`; subscription/entitlement/usage routes remain gated until a precise business-scope selector contract exists.

Commerce note: migrations 0031–0032 establish the Commerce-owned Cart/Checkout/PriceSnapshot/Order transaction boundary and integrity hardening. Cart/Checkout/Order API routes are live in the canonical router; Order creation/status transitions are idempotent/CAS and emit Outbox events. Billing/Payment remains authoritative for payment execution, financial settlement, refunds and invoices.

Slot projection note: the canonical Booking slot generator is a derived projection over Schedule/Rule/Exception/Appointment/Hold state; no authoritative slots table exists.

Booking note: migrations 0028–0030 establish the canonical Booking/Availability physical core and short-lived holds. Migrations 0046–0047 complete transactional finalization, idempotency and capacity guards; confirmation/status events now use the platform Outbox. No second reservation model or authoritative slots table is permitted.

Business lifecycle note: migration 0027 records immutable transitions for the existing physical `draft/active/suspended/archived` Business statuses. It intentionally does not invent a new status vocabulary.

CRM timeline note: migrations 0020 and 0074 implement the canonical event store plus rebuildable timeline read model. Projection writes are atomic on new event append, idempotent/monotonic on retries, history reads use the projection, and workspace/relationship/customer rebuilds are available from canonical events. Contract: `docs/CRM_TIMELINE_PROJECTION_CONTRACT.md`. Implementation commits: `c48f0db`, `d12759f`, `51278b4`, `b226f02`, `8175887`, `29ad354`, `19650fb`, `bea89c9`, `d78ce7f`, `b06c3fe`, `6167289`, `2754fe7`, `f241a8c`, `d5049bd`, `a902777`. Status: 🟢 Complete.

Trust note: migrations 0021–0025 implement the canonical VerificationCase → Policy/Requirement → Check/Evidence → append-only Decision → Review/Expiry chain. Migration 0064 adds the canonical TrustSignal evidence/projection store and anti-abuse moderation idempotency boundary. Reviewer completion now requires the assigned-reviewer authorization permission and owner policy.

Trust expiry/anti-abuse workers: scheduled Trust expiry processing is idempotent; expired work creates an append-only system Policy Decision, marks the expiry/case state and emits `trust.verification.expired` through Outbox in one D1 batch. The anti-abuse worker normalizes review risk/report evidence into TrustSignals and opens idempotent generic ModerationCases for high/critical signals.

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
0050_case_support_core.sql
0051_communication_templates.sql
0052_moderation_cases.sql
0053_ai_runtime_worker_leases.sql
0054_discovery_index_observability.sql
0055_communication_policy_consent.sql
0056_communication_required_suppression.sql
0057_matching_learning_signals.sql
0058_billing_financial_audit_trail.sql
0059_billing_refund_financial_accounting.sql
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

The canonical physical inventory reaches migration `0075_analytics_platform.sql`. Migrations 0057–0059 are registered and checksum-locked. The latest pre-refund verified head remains the deployment-strategy checkpoint; the new refund-accounting commits require the normal CI/Phoenix verification pass before being treated as a verified checkpoint.

Latest fully verified head: `3f24f07a0a04e58ac3dbb389c6491d59802ad82e` — deployment-strategy reconciliation head, verified by current CI and Phoenix verification.

The canonical source-boundary and runtime-module-registry guards remain mandatory verification gates; the current head passes both. Discovery's RuntimeModule was also registered in `apps/api/src/runtime.ts` so every canonical manifest is present in the runtime module list.

GitHub Actions on the current head completed successfully:
- Phoenix verification run `35922471460`
- CI run `35922471425`

Verification coverage on this checkpoint includes migration-lock integrity, canonical-source legacy boundary, runtime-module registry completeness, migration-history rules, lint, typecheck, workspace build, Cloudflare Worker dry-run, and unit tests.

The current verification workflows check migration-lock integrity, workspace build and tests; CI additionally runs lint/typecheck/Worker dry-run. The current cleanup head still requires a fresh CI/Phoenix verification run before it is treated as a verified checkpoint.

The Billing route dependency wiring was corrected in commit `fc7f53e1f848094a32aa697d3bafab90197ab9e6`; the corrected commit is covered by the green verification checkpoint above. Privacy subject scope validation was added in commits `afcff1bb0023187024b12508f7eb7cf175d8bec6` and `c121e50055d3a2e3ca1023c88c13a2f5bb403fa0`, then reconciled into the verified checkpoint `d122981098cc1d517664afdce3d33d3333e82afa`.



Discovery index observability implementation commits:
- a5432b45022e53b12fc2bc31a74ab732ca1fb43a — add migration 0054_discovery_index_observability.sql
- 31b3b3ac756a541a6e4d8a80b14fc1067b7a885e — register migration 0054 in API catalog
- 6fc79015cd4230ce3a4a52d021d3059b71f35d5a — lock migration 0054 checksum
- 0565a740dd833cff41211cc285648ebb434e44d9 — register migration 0055 in API catalog
- c96a6737ea7f6f3998a3b56ec4ac857063cb8b70 — lock migration 0055 checksum
- d99837cfe07578e4f9b0add855b8d3ddb2223c50 — register migration 0056 in API catalog
- 15ad01cb7e423a705364ea5a83a3ede09b245456 — lock migration 0056 checksum
- b7fe5e4fd9896a2b6f5b5c48e8b6f4a0bdc7d604 — fix migration lock JSON separator
- 1dbfa6965296fb8c8a983d0e8ba1fe8e8f58d863 — implement Discovery index/query/evaluation repository
- 42790c1c1227f7d6df3c99dd89505284d1707eec — expose Discovery observability capabilities
- 4f29f7422e08017bd4e0dd54f3adf23190f60ae9 — add Discovery observability invariant tests
- 583a7d6ac4037e593bb07f111a7f0e2c9d4beb3e — reconcile Discovery implementation status
- f6ef5fb01486738a0cce3d80fec5ea25d35e970b — update physical schema blueprint
- 03146a358b6736a46ca8b2cc407c0325fa05e1a8 — update implementation ledger
- 6169b15d7f9e1ab4c6af4692632a96ca5f8209a7 — update phase status
- b688ba5bc8d118896c45e3bb1c315ae3a84520a3 — reconcile physical inventory through migration 0054

Lifecycle hardening commits: `77d7945` / `9d3c85f` (Matching latest-decision Connect invariant), `a70fa84` / `df9c33b` (MatchRequest lifecycle), `e4f018d` / `5a361f2` (Billing subscription terminal lifecycle), `9158971` / `8fc9619` (Automation execution lifecycle), `25c70aa` / `b2cd1044` (AI failed-operation replay), `8a4af78` / `c48e5949` / `26ace41` (AI terminal lifecycle), `ed90ca6` / `28af923` (Automation attempt lifecycle), `c2692c8` / `2b98364` / `48af422` / `7573f49` (CustomerRelationship CAS/monotonic interactions), and `b935137` / `90792c7` (Business status lifecycle atomicity/CAS).

Business lifecycle reconciliation note: `Business.status` owns marketplace lifecycle (`draft | active | suspended | archived`); `onboarding_profiles.status` owns onboarding workflow (`draft | submitted | verified | rejected`). No additional Business status table/column is authorized by the reconciliation.

Commerce/Billing ownership reconciliation note: Commerce owns Cart/Checkout/Order/commercial transaction orchestration. Billing/Payment owns Payment/Refund/Invoice and financial ledger truth. Existing Commerce payment/refund/invoice capability names remain orchestration contracts and must not create parallel financial aggregates.

Migration continuity remains mandatory: never renumber, rewrite or replace an existing migration. Every physical change must use a new numbered migration and preserve the canonical migration lock.


Production D1 handoff: the production D1 resource `qooqnos-production` is now provisioned externally and its real UUID has been supplied to the project. The repository intentionally does not hard-code that identifier; production configuration must continue to consume `PHOENIX_PROD_D1_DATABASE_NAME` and `PHOENIX_PROD_D1_DATABASE_ID` through the protected deployment environment. The remaining remote step is credentialed execution of the canonical migration runner.

### Verification checkpoint — 2026-09-24

- Main head `3f24f07a0a04e58ac3dbb389c6491d59802ad82e` has successful **CI** and **Phoenix verification** workflow runs.
- Verified steps include format, lint, migration catalog/lock, database completion report, canonical-source boundary, runtime-module registry, migration-history checks, typecheck, build, Cloudflare Worker dry-run and unit tests.
- Production deployment remains intentionally separate and is protected by the production environment plus Cloudflare credentials; the canonical deploy path runs the full predeploy verification, then `migrate:prod:canonical`, then Worker deploy. No repository code should embed production D1/resource identifiers or credentials.


### Matching learning signals — 2026-09-24

Migration `0057_matching_learning_signals.sql` establishes append-only, tenant/workspace-scoped outcome evidence for MatchRequest/Candidate results. `MatchingLearningRepository` validates request scope and records typed signal categories without mutating historical evidence. `MatchingService.recordLearningSignal` exposes the canonical capability and requires the dedicated `matching.learning.record` permission. Broader Act integrations (booking/order/payment/provider outcomes) remain separate integrations and must publish into this canonical signal boundary rather than creating duplicate learning tables.

Implementation commits:
- 5dfd32e2 — add append-only matching learning signals
- 30d6697f — persist learning signal evidence
- 58bf06d2 — export learning signal repository
- 05f251ad — expose learning signal recording
- b57412ee — cover learning signal recording
- 86e9908b — register matching learning migration
- 8d697763 — lock migration 0057 checksum
- 64b26449 — reconcile physical matching learning storage
- 49fb12b7 — add matching learning signal model
- baffd81d — expose learning signal API
- 163a163d — type learning signal route input
- 929390f3 — document matching learning signal data model
- 7354ceee — document matching learning signal physical contract


| Invoice system | 🟢 Canonical Billing invoice lifecycle + immutable lines + payment applications + tenant/currency/amount integrity implemented | migrations/0060_billing_invoice_system.sql; packages/billing/src/invoice-repository.ts; packages/billing/src/invoice-repository.test.ts |

Invoice runtime/API note: `GET /api/v1/billing/invoices` is implemented through `BillingInvoiceRepository.list`, protected by `billing.invoice.read`, with tenant/workspace/business/customer scoping. Invoice creation/payment execution remain inside the Billing financial boundary rather than Commerce.

| Payment Provider Adapters | 🟢 Provider-neutral adapter/registry/service + HTTP adapter + signed webhook verification + replay protection + failure classification + provider-reference persistence implemented | packages/billing/src/payment-provider-adapter.ts; packages/billing/src/payment-provider-service.ts; packages/billing/src/payment-provider-adapter.test.ts |

| Settlement | 🟢 Settlement aggregate + immutable items + approval/processing/paid lifecycle + provider payout boundary + reconciled double-entry accounting + tests implemented | migrations/0061_billing_settlement.sql; packages/billing/src/settlement-repository.ts; packages/billing/src/settlement-service.ts; packages/billing/src/settlement-repository.test.ts; packages/billing/src/payment-provider-adapter.ts |

| Billing Reconciliation | 🟢 Case lifecycle + mismatch financial evidence + idempotency + immutable event history + scoped resolution implemented | migrations/0062_billing_reconciliation_hardening.sql; packages/billing/src/reconciliation-repository.ts; packages/billing/src/reconciliation-repository.test.ts |\n| Analytics | 🟢 Outbox ingestion + immutable normalized events/facts + versioned metric registry + rebuildable aggregates + scheduled worker implemented | migrations/0075_analytics_platform.sql; packages/database/src/analytics-repository.ts; apps/api/src/outbox-worker.ts; apps/api/src/analytics-worker.ts; docs/ANALYTICS_IMPLEMENTATION_CONTRACT.md |

| TrustSignal / anti-abuse | 🟢 Operational | migrations/0064_trust_signals_anti_abuse.sql; packages/trust/src/repository.ts; packages/trust/src/service.ts; apps/api/src/trust-worker.ts; apps/api/src/trust-routes.ts |


### Integration provider adapters — 2026-09-24

| Capability | Status | Canonical source |
|---|---|---|
| Integration provider adapter runtime | 🟢 Complete | `packages/integration/src/adapter.ts`, `packages/integration/src/worker.ts` |
| Integration credential contract/provisioning boundary | 🟢 Complete | `packages/integration/src/credential.ts` |
| Configurable HTTP provider adapter | 🟢 Complete | `packages/integration/src/http-adapter.ts` |
| Signed webhook verification | 🟢 Complete | `packages/integration/src/http-adapter.ts` |
| Provider-specific vendor onboarding | 🟡 External operational work; activation runbook complete | `docs/INTEGRATION_PROVIDER_ADAPTERS.md`; `docs/INTEGRATION_VENDOR_ONBOARDING_RUNBOOK.md` |

Implementation commits: `a51897e`, `e6bad36`, `a00a183`, `3e39a95`, `224b884`, `1ad3881`, `be974cf`.


| Communication provider adapters + rate limiting | 🟢 Operational | migrations/0067_communication_push_channel.sql; packages/communication/src/adapter.ts; packages/communication/src/provider-config.ts; packages/communication/src/dispatch.ts; packages/communication/src/rate-limit.ts; apps/api/src/communication-worker.ts; packages/communication/src/provider-rate-limit.test.ts | Push channel + Email/SMS/WhatsApp/Push runtime HTTP adapters; optional secondary-provider failover; scoped rate limits; bounded burst-anomaly cooldowns; provider credentials remain runtime-only. | commits c576061d, 004d2b9, 392a36e, b8e6298, 97c8f52, 7680903, 6491760, d7a846f, aa86fc6, cae8fa5, c2511c1, 3926003, 9adf77c, b230c99, db20b88, c7a34e1, 925d4e8 | CI/Phoenix verification green on the current post-checkpoint head. |


### Matching Act outcome integrations — 2026-09-24

`0071_matching_act_outcome_links.sql` adds optional MatchRequest/Candidate references to authoritative Booking and Commerce Act records. `MatchingOutcomeProcessor` consumes the existing transactional outbox and maps `booking.completed`, `booking.no_show`, `booking.cancelled`, `commerce.order.completed`, `commerce.payment.completed`, `payment.captured`, and `fulfillment.completed` into the existing append-only Learning Signal repository. Event IDs are used as deterministic signal IDs for retry idempotency; ambiguous or unlinked outcomes are ignored rather than guessed. No second Learning system or duplicate outcome table was introduced.

Implementation commits: `35ef63e` (migration), `f71191f` (processor), `b7ee74d` (export), `1f7f0f1` (outbox consumer), `6023b33` / `bd6d8b2` (Booking), `98b8932` / `ee6cda0` / `fad742c` / `849b8f4` (Commerce), `f95cb36` (retry-idempotent learning recording).

Status: 🟢 Complete


### Analytics implementation — 2026-09-24

Migration `0075_analytics_platform.sql` closes the Analytics physical/operational contract. `AnalyticsRepository` ingests transactional Outbox events idempotently, stores only a normalized envelope plus payload hash, creates append-only measurement facts, owns versioned metric definitions and rebuildable aggregates. `apps/api/src/outbox-worker.ts` performs asynchronous ingestion and `analytics-worker.ts` rebuilds UTC daily event-count aggregates. Analytics remains derived and cannot become operational source of truth.

Implementation commits: `1386c1e0`, `6b9f1c14`, `8f8e9cef`, `18718d44`, `2278fda1`, `287c0d32`, `19e26e9a`, `df8e0fad`, `5330552c`, `954b2763`, `46eb8be9`, `eb828953`, `7a453d7b`, `188e39dc`, `021743fe`, `ecce4ca2`, `f1e767a3`, `e554ea31`, `42ed8a6f`.

Status: 🟢 Complete


### Verification and vendor activation hardening — 2026-09-24

The repository now includes an explicit Integration vendor activation runbook covering provider identity, runtime-only credentials, adapter mapping, webhook security, synchronization, verification evidence and fail-closed activation rules. This does not invent a concrete vendor; actual vendor activation remains external until a real provider contract and credentials are supplied.

Implementation commits: `5d3d97d357359ac6a277a297945891dcbfb8e3ee`, `5d3ce233d86868547124d5dc3d96b7721689f6ee`.

Fresh CI/Phoenix verification is green on the current post-checkpoint head; build, Worker dry-run and unit tests are passing.


### Documents / Export implementation — 2026-09-24

Core `Export Document` composition is now implemented as `@qooqnos/documents`: tenant-scoped request validation, public Query-capability boundary, immutable format-neutral snapshot, template/version provenance, attachments, and SHA-256 integrity evidence are covered by unit tests and registered in the runtime module registry. PDF/Print rendering and durable artifact persistence are implemented as downstream adapters; PDF Unicode/RTL font embedding remains an explicit font-asset concern.

Implementation commits: `410127af9a52fd93718c6d4482ca410f1ef2a20d`, `ee2006853d1905e0611849af71ef346b7d4b14f8`.


### Fulfillment provider callback reconciliation — 2026-09-24

Provider callback reconciliation is now implemented as a reusable pre-persistence boundary. Incoming tracking events require a non-empty deduplication key; previously observed keys are classified as duplicates and cannot produce a second operational transition. Unit tests cover first delivery, replay, and fail-closed malformed callbacks.

Implementation commits: `039fda222cbd184cfce03383c6da055bf6f38694`.


### Document renderer boundary — 2026-09-24

The Documents module now also defines the downstream renderer/artifact contracts: versioned PDF/Print renderer profiles, renderer registry, immutable `DocumentArtifact` output tied to the source snapshot hash, and an idempotent `DocumentArtifactStore` boundary. Renderer implementations remain intentionally adapter-specific; the canonical composition engine does not query domain storage or render output formats itself.

Implementation commits: `73b060bef3710a384dd40618ed43b17a7ab7945b`, `0afa9282c445a48db5bc0c0180c7d4b0ce0e378f`, `2a3dfa54f09c386b4c02e5193628a9862375ddab`, `4ca264c0d4cda854453ccbcf635e18702c899e84`, plus the document composition/renderer files now present on `main`.


### Documents project-graph integration — 2026-09-24

The root TypeScript project graph now includes `packages/documents`, and the Documents package declares its `core` and `runtime` project references. This closes the build-graph integration gap for the new Documents module; it does not claim concrete PDF/Print renderer implementations or remote artifact storage.


### Documents composition test coverage — 2026-09-24

Added `packages/documents/src/export-document.test.ts` covering tenant-scoped composition, Query capability/resource-scope propagation, provenance, snapshot integrity, and fail-closed tenant validation. This closes the missing unit-test artifact for the canonical export composition boundary.

Implementation commit: `e92b9fb4acd3c63d108691164eff714037630698`.


### AI Memory implementation — 2026-09-24

AI Memory is now physically and operationally implemented as a tenant/workspace-scoped, non-authoritative contextual store. Migration `0076_ai_memory.sql` adds scoped memory records, provenance, classification, optional consent reference, expiry/deletion timestamps and integrity triggers. `AIMemoryRepository` provides scoped create/read/delete plus bounded expiry processing; `AIMemoryService` enforces `ai.memory.read` / `ai.memory.manage` authorization. The AI manifest registers the permissions and the migration is catalog/lock registered.

Canonical contract: `docs/AI_MEMORY_IMPLEMENTATION_CONTRACT.md`.

Implementation commits: `2529874019b861aca0f3b6b0299024076d2d682e`, `81604001f47a00e2700bc68516411f51f01b8acb`, `8ecf459d83ac98e91b17bace042b1b8e1ad96627`, `6284f1d7af87062d61acbb385f4b43bb371f6c1d`, `1da25e144a96650e81fb477a13488289cdfe4faa`, `d738af41bd3049417de84f861ea87ce0a420c110`, `034ba57a36d08fda7ffc3ee31d6f719b8cab8b5d`, `05985f78a419788d781a231480b978f1746e34db`.


### Document concrete adapters — 2026-09-24

Concrete PDF and print adapters are now implemented and registered as the default Documents renderer registry. PDF output is deterministic A4/Helvetica output for the canonical ASCII-safe text subset; Unicode-safe print output is emitted as UTF-8 HTML/CSS for browser/print pipelines. Durable document artifacts now have an R2-backed, tenant-scoped, idempotent storage adapter with renderer and source-snapshot provenance metadata.

Implementation commits: `4e6ea5693192380a079e7e1229029ffd30a5f4de`, `6f80b990fc5f632065f3f98de24d38120773e1e5`, `a573389e6f364624f1a8de8c3a2404d8b7fe3afc`, `a2bfa61f49f78ccbcd1f1773d89c0b40b487726f`, `a68958e9536e1d2a19d4fe4560af51c9207e0fa4`.


### PDF renderer completion — 2026-09-24

PDF concrete adapter advanced to renderer v2 with deterministic pagination/wrapping, multi-page page-tree generation, PDF header/xref/trailer generation, provenance preservation, and A4 output. Print output also now applies locale-derived RTL direction for Persian/Arabic/Hebrew. Note: a truly embedded Unicode/RTL font remains a separate font-asset/licensing concern; the core renderer does not falsely claim a bundled proprietary font.

Latest commits: `04d3a56c8e8350f749210fd5bb2923387b0827f9`, `e84c4ec345739948713f91d2fd661dd218ff35f3`.


### CI/Phoenix verification checkpoint — 2026-09-24

- Current main head: `891894b44751c7c3e696f8c706a9e19106b97af4`.
- CI run and Phoenix verification run are both green.
- Verified: dependency installation, format check, lint, migration catalog/lock, database completion report, canonical source boundary, runtime module registry, migration-history checks, typecheck, build, Cloudflare Worker dry-run, and 263 unit tests across 90 test files.
- Recent fixes closed strict TypeScript/lint/test-fixture issues in Automation, Integration, Communication, Privacy, Case Support, Billing, Matching, Documents, CRM Timeline, and migration tooling.
- Production D1 credentialed migration remains an explicitly external deployment gate; no credentialed remote execution is claimed from this runtime.


### SEO/GEO Engine — canonical ingestion and dependency invalidation — 2026-09-24

SEO/GEO now has explicit canonical-domain ingestion and incremental invalidation contracts in addition to the representation/projection foundation. `CanonicalEntitySource` makes source-module ownership and contract version explicit; canonical graph loading deduplicates entity IDs and rejects entities returned by the wrong source module. `SeoDomainChange` and `planSeoInvalidation` define deterministic invalidation for direct changes, relationship changes, and dependent representations, so SEO regeneration follows canonical domain events/dependencies instead of full-site rebuilds. Unit tests cover source ownership, deduplication, and dependency invalidation.

Implementation commits: `de65967cf6e44ac7dac642baed50d37effb0b6f7`, `4e98517320097af7eeefe6a628ed869441d01397`, `091aa690358fe85dd2c9d44897548a3618199703`, `5f715ee9ed7f972bba8870ced2eeb2da22d7fc54`.

Status: 🟢 Canonical ingestion + invalidation contract complete; external domain adapters/event wiring remain the next operational layer.

### SEO/GEO operational control plane — 2026-09-24

The SEO/GEO engine control plane is now wired end-to-end: canonical domain/outbox events enqueue durable publication jobs; the scheduled Worker regenerates tenant-scoped representations and derived artifacts with retry/terminal-failure handling; business and catalog creation/publication events have concrete adapters; structured-data validation is explicit; query-intent persistence and deterministic experiment assignment are durable; visibility observability has a provider-neutral HTTP adapter boundary; and production API routes expose sitemap, robots and SEO health.

Operational implementation commits: `68558fea703113788d2ce0c7c9809e5dbcc624c7`, `f226977697f25b4377ab55cdf842476433985af3`, `bbdc3d89502116899825955c533412b8a039d44d`, `17904dbd259237a733422f8f35ad5759f12c3771`, `db19f07c52eef16e7a13312f8a53fd2f8f6e2b12`, `689a150f0914be1e143b7cd1f7c31b414c371787`, `a0366f8711723979a578e3f71f294ce190cdaa4c`, `2283fa62e9eaf3e8d2d1a44876bbc1958db5e084`, `5fd49aab67f0442b38ae2959fa63ab3533a1d7a2`, `11c19dde03b64f207a6bd0db304a6dcebdd875cf`, plus migration registration/lock commits.

The engine remains truth-first: SEO/GEO is derived from canonical domain state and never becomes a second source of truth. External search/AI vendor activation is intentionally separated from repository-owned core implementation.


### SEO/GEO dependency-aware rebuild — 2026-09-24

Dependency invalidation is now operational: source changes resolve affected SEO representations through `seo_dependencies`, enqueue deterministic rebuild jobs for dependent entities, and dependent representations retain a canonical entity snapshot so the worker can rebuild without incorrectly treating the changed source entity as the target representation. This keeps SEO derived state tenant-scoped and makes relationship/location/credential-driven invalidation durable rather than advisory.

Latest implementation commits: `3afc5760f0c4ca15e8e40b297b539e131abc9361`, `a4c8d4414e910840393393f8f3a16e3eeba29b54`, `edff5a8667c4d3edd5274b7bbaf4049b6255bc93`.


### SEO/GEO stale-write protection — 2026-09-24

Concurrent publication is now guarded at persistence level: representation upserts compare source update time and source version, so a delayed worker cannot overwrite a newer canonical SEO representation with stale derived state. Publication passes the canonical source version explicitly into persistence. Commits: `c772319cbad9b5839e683c649e195a2ff81d92a8`, `d63591f763a6a94aefe06bc7711df5127a3d7ba7`, `0ee1cfb10bdf93579d46a378ac1f72e2edaf3518`.


## SEO/GEO atomic publication and artifact consistency — 2026-09-24
- SEO representation, artifacts, and dependency rows now publish through one database transaction/batch.
- A publication bundle is guarded by sourceUpdatedAt + sourceVersion + contentHash, so stale workers cannot delete or recreate artifacts belonging to a newer representation.
- Artifact replacement is complete-set based: prior artifacts for the active representation are removed and the current metadata/structured-data/answer artifacts are inserted in the same atomic operation.
- Dependency replacement is included in the same publication boundary; a worker is marked succeeded only after the atomic bundle completes.
- Existing single-artifact repository APIs remain available for non-publication use, while the publication worker uses the atomic bundle boundary.


## SEO/GEO operational audit pipeline — 2026-09-24
- Persisted entity audits are now executable operationally, not only computed in memory.
- Audit rules include entity completeness, semantic relationships, geographic consistency, publication/visibility consistency, and canonical identity presence.
- Authenticated workspace-scoped API endpoints expose latest audit results and allow explicit audit execution against the current canonical SEO representation.


## SEO/GEO crawl and indexability audit hardening — 2026-09-24
- SEO audits now validate canonical URL presence for public published entities, publication/indexability consistency, visibility/indexability consistency, valid indexability policy values, service-area evidence, canonical identity references, and absolute sameAs references.
- Audit scores now expose technical indexability alongside entity completeness, content quality, geographic answerability, local relevance, and provenance.
- Audit persistence passes the canonical indexability policy explicitly, preventing the audit timestamp from being misinterpreted as policy input.
- Unit coverage verifies publication/indexability conflicts and canonical identity diagnostics.

Implementation commits: cb1fe23d24279264e5e8ba85a79bd9368c7b5acc, 684804634150c5afb0f49e5ee506a591c8bdb781, 58fb3fb7a23d013f71562d444bac1989afb538bd.

## Frontend implementation — 2026-09-24

The first production frontend slice is now implemented in `apps/web` as a dependency-light TypeScript SPA designed for the Cloudflare Worker asset boundary.

Implemented:
- application shell with responsive sidebar/header/mobile navigation;
- RTL-first design system with dark/light themes and reduced-motion support;
- client-side routing for `/`, `/discover`, `/business`, and `/product-studio`;
- modern dashboard and discovery experience with loading states, responsive cards, and keyboard `/` focus shortcut;
- Discovery API integration through `GET /api/v1/discovery/search`, with tenant/workspace/access-token forwarding when configured and a safe demo fallback;
- Seller AI Product Studio UX for raw seller input, draft generation preview, review-oriented state and AI usage messaging;
- root TypeScript build now references `apps/web`, so the frontend is included in the workspace typecheck/build graph; execution of the Node toolchain remains a CI/runtime verification step.

Canonical source:
- `apps/web/src/main.ts`
- `apps/web/styles.css`
- `apps/web/index.html`

Implementation commits:
- `01b5f9f3ec4c2475c0121d942f51c45ed0c571e8` — build Phoenix application shell and core experiences
- `8fa1b9a776ca3ee0f098713a3568d4717faaef39` — add modern Phoenix design system and responsive shell
- `df52ff2297718198379b0273ddc110f98ad3c1ef` — harden client routing and global shortcuts
- `ecc69d3b1a81f47e2697e801a87461a3c4ff32f5` — include web app in workspace typecheck

Next frontend slices should reuse this shell and connect the operational pages to the existing canonical API instead of creating parallel domain state.

### Frontend operational connectivity — 2026-09-24

The web application now connects its first operational customer/partner flows to canonical backend contracts without duplicating domain logic.

Implemented:
- Phoenix Connection panel using the existing bearer-session contract and workspace context;
- access tokens are held in browser `sessionStorage`, while workspace/business identifiers remain in `localStorage`;
- live `GET /api/v1/session` and `GET /api/v1/context` verification from the frontend;
- canonical Business creation through `POST /api/v1/businesses` with idempotency;
- Seller AI Product Studio now performs the real session → input → run sequence against `/api/v1/ai/seller/product-creation-sessions`;
- remote Seller AI success/pending/error states are represented in the UI.

Implementation commits:
- `f847ddc84a1f4461bb41c682c1df3a0b4bf97015` — frontend continuity checkpoint
- current follow-up commits — workspace/session connectivity, Seller AI execution, Business creation and token-storage hardening.

Authentication/login remains intentionally outside this slice because the current backend exposes session verification/revocation but does not expose a public credential-login endpoint; the frontend does not invent a second authentication authority.

### Frontend session management — 2026-09-24

The web app now exposes an Account screen that reads the canonical session/context endpoints and can revoke the current authenticated session. It intentionally does not implement credentials/login because no public credential-login endpoint exists in the current backend contract.

Canonical source:
- `apps/web/src/main.ts`
- `apps/web/styles.css`

Implementation commits:
- current frontend account/session management commits after `1789560118be9b756975f2149505834ca5be20e4`.

### Frontend Discovery and Booking — 2026-09-25

The frontend now extends the canonical marketplace loop into two operational customer-facing surfaces.

Discovery:
- consumes the canonical `GET /api/v1/discovery/search` projection shape (`sourceType`, `sourceId`, document version, body, metadata, eligibility/ranking fields);
- renders live projection cards and an inspectable detail sheet without creating a second discovery state model;
- retains demo data only as an explicit degraded fallback when the live endpoint is unavailable or empty.

Booking:
- adds a dedicated Booking workspace route;
- reads live availability through `GET /api/v1/availability/schedules/:scheduleId/slots`;
- lets a user select a returned slot and create a canonical booking hold through `POST /api/v1/booking/holds`;
- forwards the existing Phoenix bearer token and workspace context through the shared API client.

Canonical frontend files:
- `apps/web/src/main.ts`
- `apps/web/styles.css`
- `apps/web/public/styles.css`

The frontend does not implement booking policy or discovery ranking locally; those remain owned by backend/domain modules.

### Frontend Commerce Checkout — 2026-09-25

The frontend now exposes the canonical Commerce cart → line → checkout-start flow.

Implemented:
- dedicated `/checkout` route;
- creates a canonical cart through `POST /api/v1/commerce/carts`;
- adds a selected offering/product-variant/service line through `POST /api/v1/commerce/carts/:cartId/lines`;
- starts checkout through `POST /api/v1/commerce/checkout` with idempotency;
- UI displays the canonical checkout session state and identifiers;
- no pricing, promotion, loyalty, payment or fulfillment rules are implemented in the frontend.

Canonical files:
- `apps/web/src/main.ts`
- `apps/web/styles.css`
- `apps/web/public/styles.css`

### Frontend Seller AI → Catalog — 2026-09-25

Seller AI Product Studio now completes the canonical draft lifecycle instead of stopping at preview.

Implemented:
- after a successful Seller AI run, frontend reads the canonical session to obtain `currentDraftVersion`;
- `review` is sent to `POST /api/v1/ai/seller/product-creation-sessions/:sessionId/review`;
- `confirm` is sent to `POST /api/v1/ai/seller/product-creation-sessions/:sessionId/confirm`;
- backend-confirmed Catalog linkage and `catalogProductId` are displayed;
- Seller AI session cancellation is exposed through the canonical `cancel` endpoint;
- no product creation logic is duplicated in the frontend.

Canonical file:
- `apps/web/src/main.ts`

### Frontend Customer / CRM Workspace — 2026-09-25

The frontend now has a canonical Customer/CRM workspace.

Implemented:
- dedicated `/customer` route;
- Customer creation through `POST /api/v1/customers`;
- Customer profile hydration through `GET /api/v1/customers/:customerId/profile`;
- preference reads/writes through the canonical preferences endpoints;
- CRM timeline hydration through `GET /api/v1/customers/:customerId/history`;
- explicit Customer, Workspace and Business context display;
- no CRM timeline or customer-domain rules are duplicated in frontend.

Canonical files:
- `apps/web/src/main.ts`
- `apps/web/styles.css`
- `apps/web/public/styles.css`

### Frontend Communication Center — 2026-09-25

The frontend now exposes the canonical Communication/Notification surface.

Implemented:
- dedicated `/communication` route;
- live communication preference reads via `GET /api/v1/communications/preferences`;
- preference writes via `PATCH /api/v1/communications/preferences`;
- notification creation via `POST /api/v1/communications/notifications` with idempotency;
- shared Phoenix bearer/session context is reused;
- no delivery policy, suppression policy, or provider logic is duplicated in the frontend.

Canonical files:
- `apps/web/src/main.ts`
- `apps/web/styles.css`
- `apps/web/public/styles.css`

### Frontend Billing Workspace — 2026-09-25

The frontend now exposes canonical Billing visibility.

Implemented:
- dedicated `/billing` route;
- plans loaded from `GET /api/v1/billing/plans`;
- invoices loaded from `GET /api/v1/billing/invoices` with business/customer filters;
- currency/amount display is presentation-only and uses returned minor-unit values;
- no pricing, plan entitlement, invoice calculation, or payment policy is duplicated in frontend.

Canonical files:
- `apps/web/src/main.ts`
- `apps/web/styles.css`
- `apps/web/public/styles.css`
