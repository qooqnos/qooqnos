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
| SEO/GEO Engine core | 🟢 Core implementation complete | packages/seo; migrations/0077–0079; apps/api/src/seo-routes.ts; docs/SEO_GEO_ENGINE_ARCHITECTURE.md; docs/SEO_GEO_WORLD_CLASS_ENGINE.md | Canonical entity model, centralized URLs/policy/freshness, metadata/structured data, GEO answers, sitemap/robots, entity graph, internal links, geographic truth, query-intent model, consistency diagnostics, agentic readiness, tenant-scoped persistence, dependency/invalidation, audits/measurements, durable publication jobs, canonical business/catalog event adapters, structured-data validation, query persistence, controlled experiments, visibility-provider boundary, scheduled worker and production API routes are implemented. External provider connectors are implemented; credentials/property verification remain deployment/provider activation gates, and unconfigured providers never produce fabricated measurements. |
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

### Frontend Business Workspace Access — 2026-09-25

The business workspace header now verifies live authorization context through `GET /api/v1/business-access` instead of presenting an unconditional healthy state.

Implemented:
- real authorized/unauthorized/error state;
- live workspace and tenant context visibility;
- no business policy or authorization logic duplicated in frontend.

### Frontend Trust / Verification Workspace — 2026-09-25

The frontend now exposes canonical Trust operations.

Implemented:
- dedicated `/trust` route;
- live trust signal reads via `GET /api/v1/trust/signals`;
- canonical reputation rebuild via `POST /api/v1/trust/reputation/rebuild`;
- customer review creation via `POST /api/v1/trust/reviews`;
- no verification, moderation, reputation or policy rules are duplicated in frontend.

Canonical files:
- `apps/web/src/main.ts`
- `apps/web/styles.css`
- `apps/web/public/styles.css`

### Frontend Operations Center — 2026-09-25

The frontend now exposes canonical Case Support and Fulfillment operations.

Implemented:
- dedicated `/operations` route;
- live Case list via `GET /api/v1/cases`;
- first-response recording and optimistic-free status transitions through canonical case commands with expected-version concurrency;
- live Fulfillment lookup via `GET /api/v1/fulfillment/:fulfillmentId`;
- no case state machine, SLA policy, fulfillment transition policy, or shipment logic is duplicated in frontend.

Canonical files:
- `apps/web/src/main.ts`
- `apps/web/styles.css`
- `apps/web/public/styles.css`

### Frontend Media + Seller AI Image Input — 2026-09-25

A previously missing HTTP boundary for the existing Media domain is now implemented and consumed by Seller AI Studio.

Backend:
- `POST /api/v1/media/assets` accepts multipart image uploads and stores objects in the configured R2 bucket before registering the canonical media asset;
- `GET /api/v1/media/assets/:assetId` exposes scoped asset metadata;
- `GET /api/v1/media/assets/:assetId/content` streams the scoped R2 object;
- media permissions `media:upload`, `media:read`, `media:status` are registered by the Media runtime module.

Frontend:
- Seller AI Studio accepts image input (JPG/PNG/WebP/GIF/AVIF/HEIC, 10MB UI guard);
- the image is uploaded through the canonical Media boundary;
- the returned `mediaAssetId` is persisted into the Seller AI creation session input;
- existing Seller AI run/review/confirm flow remains the authoritative orchestration path.

Canonical files:
- `apps/api/src/media-routes.ts`
- `apps/api/src/index.ts`
- `packages/media/src/manifest.ts`
- `apps/web/src/main.ts`
- `apps/web/styles.css`
- `apps/web/public/styles.css`


### SEO core hardening — 2026-09-25

The SEO core now has production-oriented crawl and metadata contracts rather than only minimal metadata helpers.

Implemented:
- metadata generation now emits canonical URL, indexability-aware robots directives, Open Graph metadata, Twitter card metadata, and locale/x-default alternate links;
- structured data now maps Phoenix entity types to appropriate Schema.org types and carries only canonical facts already present on the entity;
- sitemap generation now validates URLs, removes duplicates, sorts deterministically, and optionally emits `lastmod`;
- robots generation now explicitly keeps operational/private application surfaces out of crawl scope while publishing the canonical sitemap;
- the public web entry document now contains canonical, robots, Open Graph, Twitter, and locale metadata;
- SEO unit coverage now verifies metadata contracts, Schema.org type mapping, deterministic sitemap behavior, duplicate filtering, invalid URL filtering, and robots directives.

Canonical files:
- `packages/seo/src/types.ts`
- `packages/seo/src/metadata.ts`
- `packages/seo/src/structured-data.ts`
- `packages/seo/src/sitemap.ts`
- `packages/seo/src/index.test.ts`
- `apps/web/index.html`

Implementation commits:
- `14a1bd7ad192797bd39b57d28f492a25422b5b9d`
- `a50824a57b7cc37d74eb85ba09c9cedb1818db5f`
- `3629b405a907419c348e3620c68107d9f758aeeb`
- `298da8905d2ab5853e1ec21f933feda12b96eee3`
- `2a2720703eea1ecbcc6d540114830cb95f78380e`
- `ac5cdd8710ba7f046f7c9d60d2cb7137f84471e9`

### Frontend SEO / GEO Workspace — 2026-09-25

The frontend now exposes the canonical SEO/GEO operational surface.

Implemented:
- dedicated `/seo` route;
- SEO audit execution through `POST /api/v1/seo/audit/:entityId`;
- publication health through `GET /api/v1/seo/health`;
- direct public sitemap/robots navigation;
- no indexing, publication or SEO scoring logic is duplicated in frontend.

Canonical files:
- `apps/web/src/main.ts`
- `apps/web/styles.css`
- `apps/web/public/styles.css`

### Frontend Automation / Integration / Privacy Control Plane — 2026-09-25

The frontend now exposes an action-oriented control plane for three canonical domains.

Implemented:
- dedicated `/control` route;
- Automation workflow creation via `POST /api/v1/automation/workflows`;
- Integration account connection via `POST /api/v1/integrations/accounts`;
- Privacy consent creation via `POST /api/v1/privacy/consents`;
- Privacy access/export/delete/restrict/correct request creation via `POST /api/v1/privacy/requests`;
- no provider credential storage, automation policy, privacy policy, or integration synchronization logic is duplicated in frontend.

Canonical files:
- `apps/web/src/main.ts`
- `apps/web/styles.css`
- `apps/web/public/styles.css`

### Frontend Catalog Studio — 2026-09-25

The frontend now exposes direct canonical Product creation in addition to Seller AI orchestration.

Implemented:
- dedicated `/catalog` route;
- direct `POST /api/v1/catalog/products` command with idempotency;
- clear separation between Seller AI draft generation and Catalog authoritative product creation;
- no Catalog read model or product policy is invented because the current backend exposes creation as the canonical HTTP capability.

Canonical files:
- `apps/web/src/main.ts`
- `apps/web/styles.css`
- `apps/web/public/styles.css`


### SEO metadata generation — completed — 2026-09-25

Metadata generation is now treated as a production SEO contract:
- validates and normalizes canonical URLs;
- honors explicit SEO policy canonical/indexability decisions;
- generates bounded, deterministic title and description values;
- emits locale and language separately;
- supports locale alternates plus x-default;
- emits Open Graph and Twitter metadata including resolved image URLs;
- selects article Open Graph type for Article entities;
- provides a deterministic default social image;
- covers the above behavior with unit tests.


### Structured Data generation & publication validation — completed — 2026-09-25

Structured Data is now a canonical, truth-bound publication contract:
- all Phoenix SEO entity types map to explicit Schema.org types;
- canonical IDs become `@id` only when they are valid HTTP(S) URLs;
- non-URL canonical identifiers remain identifiers rather than being fabricated into URLs;
- alternate names and `sameAs` are normalized and deduplicated, with invalid external URLs rejected;
- geographic truth is represented through country/service-area signals already present on the canonical entity;
- Article and Event entities receive only facts supported by the canonical entity model;
- the validator recognizes every generated Schema.org type;
- publication now blocks on structured-data validation errors before persisting the SEO bundle;
- projection metadata and audit generation now consume the same canonical SEO policy, eliminating policy drift.

### Frontend PWA / Performance Shell — 2026-09-25

Frontend performance shell was hardened with a lightweight PWA boundary.

Implemented:
- `apps/web/public/manifest.webmanifest`;
- static-asset service worker at `/sw.js`;
- cache-first treatment for static assets;
- navigation fallback to cached application shell;
- API/health/readiness/sitemap/robots requests intentionally bypass service-worker caching;
- service worker registration is initiated after page load.

No application state or authenticated API responses are cached.

### Frontend Session Context Hydration — 2026-09-25

Active bearer sessions now hydrate the workspace context automatically from `GET /api/v1/session`.

This removes repeated manual workspace entry when a valid session already contains the workspace scope. Expired/invalid sessions are cleared from browser session storage without blocking shell rendering.


### GEO / Answer representation — completed — 2026-09-25

The GEO answer layer is now a canonical, provenance-aware publication artifact:
- AnswerRepresentation is explicitly bound to entity identity and locale.
- Each answer contains atomic entity-attributable facts with optional verification time, validity window, provenance URL, and source type.
- Canonical entity summaries can become first-party evidence without inventing external facts.
- Citation readiness is explicit rather than inferred from confidence alone.
- Citation-ready answers require a valid canonical HTTP(S) source URL, verified evidence, a public/published entity, and valid generation time.
- Stale evidence can invalidate citation readiness without invalidating the entire SEO representation.
- Non-ready answers remain representable as `pending-review`/non-citation-ready instead of blocking publication of unrelated SEO artifacts.
- Answer questions are localized for common Phoenix locales, including Persian, Arabic, Azerbaijani, Turkish, Russian, German, French, and Spanish.
- Geographic context is embedded in answer representation and remains derived only from canonical country/location/service-area truth.
- Geographic truth fingerprints now include country to prevent cross-country collisions.
- A dedicated answer validator enforces entity binding, timestamps, provenance URLs, publication visibility, citation readiness, and validity windows.
- SEO publication validates both Structured Data and Answer Representation before persisting the publication bundle.

### Promotion & Campaign Engine — 2026-09-25

Promotion & Campaign has moved from architecture-only to a canonical first implementation slice.

Implemented:
- new module `@qooqnos/promotion`;
- migration `0080_promotion_core.sql` with scoped promotion/version/qualification/redemption records and workspace guards;
- migration lock entry for version 80;
- runtime module registration and permission registry;
- API routes for promotion creation, versioning, activation, eligibility evaluation and redemption;
- deterministic eligibility checks for active window, minimum amount, channel, customer/business scope and per-customer redemption limit;
- idempotent qualification and redemption records;
- focused service test for the eligibility boundary.

Ownership remains explicit:
- Promotion owns incentive policy/eligibility;
- Commerce/Billing remain authoritative for monetary truth and transactions;
- Booking remains authoritative for booking facts;
- frontend/AI cannot decide promotion winners outside this capability.

### Dynamic Frontend SEO Surface — implemented — 2026-09-25

Public canonical entity pages are now rendered at the edge from the persisted SEO projection instead of relying on client-side metadata mutation:
- Cloudflare Worker intercepts public document paths before SPA fallback.
- Published/public SEO representations are looked up by canonical URL.
- Static index.html is used as the presentation shell, then canonical metadata is injected into the initial HTML.
- JSON-LD Structured Data is injected into the initial HTML head.
- Answer Representation is rendered as visible first-party page content in the initial HTML, including verified facts, freshness, and geographic context.
- A sanitized hydration payload lets the SPA reuse the same canonical SEO representation after JavaScript loads.
- Internal answer source identifiers/types are excluded from the public hydration payload.
- SPA navigation removes entity JSON-LD/hydration state and restores route-appropriate metadata.
- Public canonical URL lookup is indexed through migration 0084_seo_public_render_index.sql.
- Root / now falls through to the actual Cloudflare Assets web shell instead of the legacy API home fallback whenever Assets are available.
- Public SEO presentation styles are included in the deployed apps/web/public/styles.css asset.
- Unit coverage was added for initial-HTML metadata/JSON-LD/answer injection and public payload sanitization.

Deployment verification remains a runtime step: production HTML should still be checked with URL Inspection / fetched-source verification after the worker and migration are deployed.

### Loyalty & Retention Engine — 2026-09-25
Loyalty has moved from architecture-only to a canonical first implementation slice.

Implemented:
- new module `@qooqnos/loyalty`;
- migration `0081_loyalty_core.sql`;
- versioned loyalty programs;
- customer memberships;
- append-only points ledger with idempotency and provenance;
- reward definitions and reward redemption;
- atomic reward redemption with available-status enforcement and insufficient-balance protection;
- runtime/API registration and focused service validation test.

Ownership remains explicit:
- Loyalty owns points/reward value;
- Commerce/Billing own money and transaction truth;
- Booking owns booking facts;
- CRM/Customer own relationship and identity data;
- Communications owns delivery.

### Advertising & Sponsored Discovery Engine — 2026-09-25
Advertising has moved from architecture-only to a canonical first implementation slice.

Implemented:
- new module `@qooqnos/advertising`;
- migration `0082_advertising_core.sql`;
- advertiser account, campaign/version, ad, budget, delivery decision, impression and click records;
- tenant/workspace isolation triggers;
- idempotent delivery/impression/click measurement;
- moderated + active-state guard before a sponsored ad may be served;
- campaign reporting surface;
- runtime/API registration and focused delivery-boundary test.

Ownership remains explicit:
- Advertising owns sponsored delivery policy and measurement;
- Discovery remains organic ranking/source of truth;
- Billing owns financial truth;
- Media owns creative binaries;
- Trust/Moderation remain policy authorities.


Additional hardening completed after initial Dynamic Frontend SEO Surface implementation:
- Cloudflare Assets now has an explicit `ASSETS` binding required by the Worker edge renderer.
- Public representation responses use `content_hash` as an ETag for cache revalidation.
- `X-Robots-Tag` is emitted consistently, including 304 responses.
- SPA navigation to dynamic entity URLs forces a full navigation so the request reaches the edge renderer and cannot reuse stale entity hydration.
- Unknown public entity-like paths return a real 404 from the edge renderer when no published/public representation exists.
- Migration numbering was reconciled with the existing repository chain: the public-render index is migration `0083`, after existing `0082_advertising_core`.


### Public Entity Page Architecture — implemented — 2026-09-25

Canonical public entity pages are now a first-class SEO projection surface:
- stable localized canonical URL structure remains `/{locale}/{entity-type}/{slug}-{id}`;
- Entity Page Model is derived from canonical entity, metadata, answer, geography and semantic graph only;
- visible breadcrumb trail is generated from the same canonical URL contract and emits BreadcrumbList semantics;
- Business, Branch, Product, Offer, Service, Location, Person, Article and Event schemas receive specialized properties only when those canonical facts exist;
- Product pages expose brand/category/price/currency/availability through Product + Offer markup;
- Business/Branch pages expose contact, price range, address and geographic truth when canonical fields exist;
- public pages expose verified facts, freshness, commerce context and geographic context;
- contextual actions are derived by entity type for Discovery, Booking and Checkout;
- public related links are derived only from verified semantic graph edges with canonical target URLs;
- internal graph hydration is now part of SEO publication, using persisted SEO graph nodes/edges and published representations for canonical labels/URLs;
- internal-link public payload is sanitized so private source entity IDs are not exposed as UI-only fallback data;
- Discovery breadcrumb links carry query context into the real Discovery page;
- Checkout actions hydrate Product/Offering context from URL parameters.

### Authorization Governance / Approval Workflow — 2026-09-25
A first canonical approval workflow is now implemented.

Implemented:
- D1 `0083_authorization_approval_workflow.sql` with scoped approval requests and separation-of-duties trigger;
- `ApprovalRepository` in Database;
- `ApprovalService` in Runtime with explicit create/read/approve/reject permissions;
- self-approval is rejected both in service/repository flow and at the database trigger boundary;
- HTTP routes under `/api/v1/authorization/approval-requests`;
- frontend Control Plane approval request/create/approve/reject controls;
- authorization decisions now expose stable `reasonCode` and `policyVersion` metadata;
- focused runtime test for approver actor propagation.

Important ownership boundary:
approval governance records and decides approval state; the protected domain module must still enforce the approved state before performing its own high-risk mutation.


### SEO Audit — completed — 2026-09-25

The SEO Audit is now a deterministic production quality gate across the full canonical SEO projection:
- entity identity, publication, visibility, canonical URL, freshness and geographic truth;
- metadata title/description/canonical/robots/hreflang/OpenGraph/Twitter checks;
- Structured Data validation plus canonical binding, BreadcrumbList presence, Product Offer and Event checks;
- Answer Representation provenance, freshness, entity binding and citation readiness;
- Entity Page architecture, breadcrumbs, contextual actions, related canonical links and required sections;
- sitemap/indexability policy consistency;
- decomposable dimension scores plus overall score;
- explicit `pass`, `warning`, or `blocked` status and machine-readable blocking issue codes;
- publication blocks only when an actually indexable representation has a hard SEO error; stale representations that policy marks noindex remain auditable and persistable;
- manual Audit API now re-audits the complete persisted projection rather than only the Entity row;
- Audit result status, overall score and blockers are persisted for operational dashboards;
- frontend SEO dashboard exposes overall score, status, blockers, dimension scores and remediation evidence.
- migration `0085_seo_audit_quality_gate.sql` persists the operational audit gate fields.

### Production Crawler / Rendering Integration — completed — 2026-09-25

Implemented as the runtime closure between persisted SEO projections and the actual production HTML surface:
- deterministic SSR crawler verification in packages/seo/src/crawler.ts;
- crawler compares live production HTML against persisted canonical metadata, robots, canonical URL, JSON-LD, Answer Representation, hydration marker, breadcrumb surface, and H1 shape;
- canonical-origin enforcement prevents crawler SSRF against non-Phoenix origins;
- scheduled production sampling uses existing seo_measurements observability and rotates toward least-recently-crawled indexable pages;
- authenticated manual probe: POST /api/v1/seo/crawl/:entityId?locale=...;
- SEO health now exposes recent production-crawler failures;
- production renderer emits explicit SSR/cache/content headers including ETag, Last-Modified, X-Robots-Tag, X-Phoenix-Render-Mode and X-Phoenix-SEO;
- production SSR dependency failures return HTTP 503/noindex instead of silently serving SPA fallback;
- public sitemap is canonical-origin scoped and publicly crawlable without requiring tenant auth context;
- production cron trigger runs hourly at minute 17, with a 25-page sample by default;
- Control Plane exposes a manual Production Crawl action beside SEO Audit.

Runtime verification remains separate from implementation: the deployed Worker must still be probed against a real public entity URL after deployment.

Additional production hardening:
- sitemap.xml now upgrades automatically to a sitemap index when public canonical URL volume exceeds the configured 50,000-entry shard size; deterministic /sitemap-N.xml shards are supported;
- API/SEO infrastructure routes are handled before Cloudflare SPA asset fallback so robots.txt, sitemap.xml, sitemap shards, health and API routes cannot be replaced by index.html;
- production Wrangler rendering now preserves SEO canonical base, crawler sample limit and the production Cron Trigger.

### Search-engine / AI citation measurement — completed — 2026-09-25

Implemented real external visibility measurement:
- Google Search Console Search Analytics connector using OAuth2/service-account JWT authentication; records actual query/page clicks, impressions, CTR and average position.
- Bing Webmaster JSON/HTTP connector; records actual query+page traffic and position where a tracked canonical page is available.
- Responses Web Search connector; executes a real web-search-enabled AI response and records only explicit `url_citation` annotations as AI citations.
- durable `seo_measurement_runs` and `seo_measurement_citations` state;
- existing `seo_measurements` receives normalized metric observations and provider errors;
- daily production scheduled measurement plus authenticated entity-scoped manual measurement API;
- SEO health reports measurement failures and last observation;
- Control Plane exposes a real Visibility / Citation measurement action.

Provider activation is configuration-gated: unconfigured providers are not treated as zero visibility. Missing credentials result in an unconfigured measurement run rather than fabricated data.

Provider activation contract: `docs/SEO_MEASUREMENT_PROVIDER_ACTIVATION.md`.

### Competitive Intelligence — completed — 2026-09-25

Implemented real competitive intelligence from external SERP evidence:
- DataForSEO Google Organic Live Advanced provider with explicit location, language, device and depth;
- real competitor discovery from observed SERP domains;
- tenant-scoped competitor registry with direct/alternative/publisher/directory/discovered classifications;
- durable competitive runs and observations including URL, title, snippet, rank group, rank absolute and AI-citation evidence;
- rank up/down, URL change, new/lost entry and AI-citation gained/lost detection;
- same-run SERP gap opportunities where competitors are observed and Phoenix is absent;
- daily production sampling plus authenticated entity-scoped manual measurement;
- Control Plane displays competitor observations, changes and query gaps;
- no synthetic market share or inferred universal rank is generated.

Provider activation remains configuration-gated through DataForSEO credentials and a deliberate location/language configuration.

Provider activation contract: `docs/SEO_COMPETITIVE_INTELLIGENCE_ACTIVATION.md`.

Competitive intelligence hardening completed after initial implementation:
- deduplicated competitor discovery and change events;
- scoped competitor summaries, changes and page snapshots to the requested Entity/query set;
- own Phoenix domain excluded from competitor change feed while remaining available for same-run gap evidence;
- added DataForSEO Labs Domain Intersection keyword-gap evidence with bounded competitor/keyword sampling;
- added durable `seo_competitive_keyword_gaps` state and Control Plane display;
- page snapshot failures mark a CI run partial instead of discarding the underlying SERP evidence.

Competitive intelligence evidence layers now include:
- live SERP/rank observations;
- competitor on-page SEO snapshots;
- provider-observed keyword gaps;
- provider-observed referring-domain/backlink gaps;
- AI Overview/reference URL changes.


## Production SEO Hardening — Control Plane
- **Status:** In progress / production activation gated.
- **Completed:** production readiness evaluator; canonical HTTPS gate; provider readiness states; explicit non-zero-visibility semantics; SEO health/control-plane exposure; control-plane contract tests.
- **Commits:** `877d7dd`, `2aa6b91`, `889e055`.
- **Remaining:** end-to-end production verification and real external provider activation/evidence collection (Search Console, AI citation, competitive intelligence where configured).


## Production SEO Hardening — Runtime Wiring & CI Verification
- **Completed:** production provider environment is now passed from Worker runtime → `ApiRouter` → SEO routes → readiness evaluator; Control Plane no longer evaluates provider readiness from canonical URL alone.
- **Commits:** `1a9cc81`, `c061ced`, `bf522ca`.
- **Verification:** GitHub Actions CI and Phoenix Verification were triggered by the latest `main` push; both were observed running for commit `bf522ca`.
- **Remaining:** await CI completion and perform deployed production evidence verification with real provider credentials/data.


## Production SEO Hardening — Provider Test Contract
- **Completed:** provider activation matrix tests are typed against the real ApiEnv contract; Search Console access-token/service-account activation and complete/partial competitive-intelligence activation are covered without lint-invalid any casts.
- **Commits:** `00fb2607`, `6abb3ceb`, `f39932fd`.
- **Verification:** the first provider-test CI run failed at lint because the initial test introduced explicit any casts; the tests were corrected to use the real environment type and the competitive provider field name. A fresh CI run is now required for final green verification.


## Production SEO Hardening — Contract Alignment After Full CI Test Run
- **Completed:** corrected production readiness state precedence so partially configured providers are reported as `partial` rather than `unconfigured`; aligned geographic audit/truth semantics so city/region/exact scopes require canonical location evidence while country-backed country scope remains valid; aligned SEO tests with the canonical structured-data and attributable-answer contracts; frontend hydration tests now explicitly verify provenance fields used for citation-ready evidence.
- **Commits:** `48afc1e`, `5f45365`, `b174cf8`, `37f35a0`, `0c3efc0`.
- **Verification:** the preceding CI run exposed 9 failures across 6 test files; the failures were traced to these contract mismatches rather than build, typecheck, lint, migration, or Worker-dry-run failures. Fresh CI and Phoenix Verification runs are active on `0c3efc0`.
- **Remaining:** final green CI/Phoenix verification, then deployed production evidence verification.


## Production SEO Hardening — Final CI Contract Fixes
- **Completed:** latest Phoenix verification reduced failures to two contract assertions. The frontend test was aligned to the actual server-rendered hydration payload, and stale public entity sources are now always a blocking SEO audit error rather than becoming a warning when another surface policy has already downgraded indexability.
- **Commits:** `0db1d503`, `0559eb7`.
- **Verification:** Phoenix verification `#2281` reached **102 passing test files / 308 passing tests**, with only 2 failing assertions; build and all structural verification gates passed. A fresh verification chain is now expected on `0559eb7`.
- **Remaining:** green CI/Phoenix verification and deployed production evidence verification.

## SEO/GEO Standards Review — September 2026
- **External review:** Google Search Central's current guidance confirms that AI Overviews/AI Mode do not require special AI markup or `llms.txt`; foundational technical SEO, crawlability, internal links, textual content, structured-data/content consistency, and high-quality media remain the relevant requirements. citeturn1search0turn1search1
- **New Google measurement surface:** Search Console now exposes a multimodal-search filter covering Lens, Circle to Search, image uploads, and image-based search. Phoenix should add multimodal segmentation to visibility analytics when the Search Console API exposes the corresponding dimension; do not fabricate values from ordinary web-search data. citeturn0search12
- **Current Schema.org:** version 30.1 (2026-09-16) adds/expands ecommerce vocabulary. Phoenix should track these terms, but only emit properties backed by canonical product facts. citeturn0search0turn0search1
- **Product gap identified:** Phoenix currently has basic Product/Offer JSON-LD but no ProductGroup/variant schema. Google documents ProductGroup + variesBy + hasVariant + productGroupID for variant-aware product pages. This is a follow-up when canonical catalog variant identity is available. citeturn1search11
- **Commerce gap identified:** Product structured data should be extended when canonical data exists for shipping and returns (`OfferShippingDetails` / `MerchantReturnPolicy`) and product category. citeturn0search11turn0search4
- **Local/geo gap identified:** LocalBusiness structured data can carry geographic coordinates and opening hours; Phoenix's current SEO entity model does not yet expose canonical coordinates/opening-hours fields, so these should be added only at the domain-model boundary rather than inferred from location IDs. citeturn1search9turn1search10
- **Discovery gap implemented:** canonical image sitemap generation and `/image-sitemap.xml` were added so publicly indexable entity images can be explicitly discoverable, including images that may otherwise be harder to discover through JavaScript. citeturn1search5turn1search16
- **Bing/GEO:** Bing Webmaster Tools now exposes AI Performance insights including citations, intents, topics, citation share and compare. Phoenix already measures AI citations/competitive intelligence, but should add first-party Bing AI Performance ingestion when an official machine-readable API becomes available; until then, portal-only metrics must not be synthesized. citeturn0search7turn0search8
- **Not recommended as a standards requirement:** `llms.txt` or custom AI-only schema should not be added merely for Google AI visibility; Google's current guidance explicitly says there are no additional AI-specific technical requirements or special schema. citeturn1search0
- **Current SEO/GEO residual gates:** ProductGroup/variants structured-data contract is implemented and lifecycle refresh now covers product-created/product-updated/variant-changed publication paths; shipping/returns structured-data vocabulary and emission are implemented, but production catalog/fulfillment canonical facts for shipping/returns are not yet exposed to the SEO publication boundary, so no claims are synthesized; canonical geo coordinates and opening-hours contracts are implemented, with Business and Location publication enrichment now hydrating authoritative hours and coordinates; Google Search Console's multimodal reporting is live in the UI, but the Search Analytics API still does not expose a multimodal type, so automated ingestion remains blocked on API support; Bing AI Performance is available in Bing Webmaster Tools, but the published Webmaster API documentation currently exposes rank/traffic/link/keyword/crawl APIs and does not document an AI Performance ingestion endpoint, so Phoenix must not fabricate or scrape portal-only metrics.
## SEO/GEO Residual Gate Reconciliation — September 2026
- **ProductGroup / Variants:** 🟢 Implemented. Canonical SEO types, ProductGroup emission, productGroupID, variesBy, hasVariant, truth-bound variant attributes, and validation tests are present. Publication enrichment now refreshes the parent ProductGroup for product creation, product updates, and variant-change events.
- **Shipping / Returns / Commerce Schema:** 🟡 Contract implemented; canonical source integration remains. Repository inspection confirms Fulfillment owns `shipments`, `shipment_packages`, and tracking evidence, but those tables contain no authoritative shipping rate, destination service zone, handling window, return window, return-fee, or return-method policy fields. Therefore no SEO adapter can truthfully populate `OfferShippingDetails` or `MerchantReturnPolicy` yet. The remaining implementation is a canonical Commerce/Fulfillment policy contract—not an SEO-layer workaround. OfferShippingDetails and MerchantReturnPolicy are emitted only from explicit SEO entity facts. The current Catalog/Fulfillment canonical projections do not expose a complete shipping/return fact set to the SEO publication boundary, so this must remain claim-safe until those facts exist.
- **Canonical Geo Coordinates + Opening Hours:** 🟢 Implemented. Range-validated GeoCoordinates and OpeningHoursSpecification are emitted from canonical Business/Location facts; Location publication enrichment now hydrates authoritative business hours in addition to canonical coordinates/address.
- **Multimodal Search Measurement:** 🟡 API-dependent. Google Search Console added a multimodal performance report on 2026-09-24, covering Lens, Circle to Search, image uploads and related visual-search flows, but the Search Analytics API does not yet expose a corresponding type value. Phoenix must not synthesize multimodal observations from ordinary web-search rows.
- **Bing AI Performance ingestion:** 🟡 API-dependent. Bing Webmaster Tools exposes AI Performance in the portal, including citation and grounding-query analytics, but the current published Webmaster API documentation does not document an AI Performance endpoint. Phoenix retains the provider-neutral measurement boundary and must wait for an official machine-readable API rather than scraping or inventing metrics.
## SEO/GEO Commerce Schema Implementation — September 2026
- Added canonical SEO contract types for product variants, shipping details, and merchant return policy in `packages/seo/src/types.ts`.
- Added truth-bound `ProductGroup` emission with `productGroupID`, `variesBy`, and `hasVariant`; variants are emitted only when the canonical SEO entity explicitly carries variant data.
- Added optional `OfferShippingDetails` and `MerchantReturnPolicy` emission from canonical entity facts; no shipping/return claims are inferred.
- Extended structured-data validation allowlist for `ProductGroup`.
- Added focused tests covering ProductGroup, variant, shipping and return structured data.
- Catalog already has a canonical `ProductVariant` domain model and authoritative AttributeValue storage; future SEO publication adapters should hydrate the new SEO contract from that canonical boundary rather than duplicating catalog logic.

## SEO/GEO LocalBusiness Enrichment — September 2026
- Added canonical `SeoGeoPoint` and `SeoOpeningHours` contracts.
- Structured data now emits validated `GeoCoordinates` and `OpeningHoursSpecification` for Business/Branch entities only when authoritative values are present.
- Coordinates are range-validated; no location inference or geocoding is performed by SEO.
- Opening-hours output is sourced from canonical business schedule data and does not claim appointment availability, which remains Booking-owned.
- Added regression coverage for geo coordinates and opening-hours structured data.
- Next integration step: hydrate these fields from the Business domain's canonical `locations.geo_point_json` and `business_hours` projection through the existing SEO publication boundary; do not query private domain tables directly from the SEO package.

## SEO/GEO Canonical Publication Boundary — September 2026
- Catalog now exposes tenant/workspace-scoped `listProductVariants()` through its canonical repository, including normalized AttributeValue data; SEO does not query Catalog tables directly.
- Business now exposes tenant/workspace-scoped `listLocations()` with parsed canonical address and validated geo coordinates from the Business location model.
- The API outbox composition boundary hydrates SEO publication payloads from Catalog/Business repositories before handing them to the SEO publication pipeline.
- Product SEO payloads now carry active canonical variants and stable `productGroupId` when available; no price, image, availability, shipping, or return facts are invented.
- Business SEO payloads now carry an active physical location's canonical geo/address when available; coordinates are validated and never inferred.
- Opening-hours structured data remains contract-ready but is not hydrated yet because the physical `business_hours` table is documented but not currently implemented in the reconciled database schema. This is intentionally left unimplemented rather than creating a parallel or speculative source of truth.

## SEO/GEO Canonical Operating Hours — September 2026
- Added migration `0091_business_hours.sql` for canonical recurring operating hours, scoped to Business and optionally Location.
- Registered migration 91 in `migration-lock.json` with SHA-256 checksum.
- Added `BusinessRepository.listHours()` as the tenant/workspace-scoped projection boundary.
- SEO publication enrichment now maps canonical active physical-location hours to Schema.org day-of-week values and `OpeningHoursSpecification`.
- Added repository regression coverage.
- The SEO layer still does not infer hours, appointment availability, or exceptional closures; those remain explicit Business-domain facts.

## SEO/GEO Public Business Contact & Social Signals — September 2026
- Added canonical `business_contacts` and `business_social_links` tables, matching the existing Business data dictionary instead of introducing SEO-owned contact storage.
- Added tenant/workspace-scoped Business repository projections for public, active contact channels and social links.
- SEO publication enrichment now maps public phone/email to `telephone`/`email` and authoritative social URLs to `sameAs`.
- Private/inactive/archived contact and social records are excluded at the Business boundary.
- Added repository regression coverage.
- No `knowsAbout`, fabricated category, review, rating, or website signals were added without a canonical Business source.

## SEO/GEO Entity Relationship Publication Triggers — September 2026
- Aligned SEO publication event contracts with documented versioned Business profile lifecycle events: `business.profile.updated.v1`, `business.profile.published.v1`, and `business.profile.suspended.v1`.
- Business SEO canonical enrichment now rehydrates the canonical Business projection on those lifecycle events, so contact, social, location, and operating-schedule changes are not dependent on stale event payload snapshots.
- The existing EntityGraph/InternalLink recommendation layer remains the sole semantic-linking mechanism; no SEO-owned relationship source was introduced.
- Undocumented `*.v1` location/schedule event names were deliberately not registered; future event contracts must be added only when the Business module emits a concrete versioned event.

## SEO/GEO Canonical Entity Graph & Bidirectional Link Traversal — September 2026
- SEO publication now persists the canonical entity as a derived graph node and materializes declared `relatedEntityIds` as provenance-aware directional graph edges only when the target has a public published representation.
- Relationship facts remain owned by canonical domain payloads; SEO graph storage is derived and rebuildable.
- Graph loading now traverses both outgoing and incoming edges, enabling internal-link recommendations from either side without fabricating a reciprocal domain relationship.
- Existing `seo_dependencies` remains the invalidation mechanism; no second relationship source of truth was introduced.
- Self-links and cross-tenant/workspace links remain protected by existing database constraints.

## SEO/GEO Public Entity Page Relationship Surfaces — September 2026
- Public Entity Page SSR already consumes the persisted `EntityPageModel`; internal-link recommendations now traverse both outgoing canonical relationships and incoming canonical relationships.
- A page therefore exposes reciprocal navigation without inventing a second canonical relationship: incoming edges are rendered as `relatedTo` surface links while the original edge retains its authoritative relation.
- Only published/public target nodes are linkable, and canonical URLs are taken from persisted SEO representations.
- Tests cover both directions of a Business ↔ Service graph relationship.

## SEO/GEO Canonical Domain Relationship Hydration — September 2026
- Catalog now exposes a tenant/workspace-scoped canonical projection of active Products and Services owned by a Business; no SEO-owned relationship table was introduced.
- Business SEO enrichment consumes canonical Catalog products/services plus canonical Business locations and places their IDs into `relatedEntityIds`.
- Product SEO continues to reference its canonical owning Business.
- Graph publication turns only relationships whose public representations exist into linkable graph edges, while `seo_dependencies` records the same related entities for invalidation propagation.
- This establishes the canonical Business ↔ Product/Service/Location relationship path without inventing undocumented service/location event contracts.

## SEO/GEO Semantic Canonical Relationships — September 2026
- `SeoEntity` now optionally carries `relatedEntities` with canonical target IDs and explicit relationship semantics while retaining `relatedEntityIds` compatibility.
- Product projections emit `ownedByBusiness`; Business projections emit `offersProduct`, `offersService`, and `hasLocation` from canonical repositories.
- SEO graph persistence preserves the semantic relation instead of collapsing every canonical relationship to `relatedTo`.
- Legacy ID-only payloads remain supported through a `relatedTo` fallback.

## SEO/GEO Repository Projection Test Hardening — September 2026
- Corrected the Business repository regression test so public contacts and social links are validated against distinct canonical result shapes.
- The social-link assertion now verifies platform and URL rather than accidentally accepting a contact row as a social row.
- This closes a false-positive test path in the Business → SEO public signal boundary.

## Migration Integrity — September 2026
- Recomputed the SHA-256 checksum for `0092_business_public_contact_links.sql` from the committed migration contents.
- Corrected `migrations/migration-lock.json` version 92 checksum to `24bb4f9a2659265c8afb1f44cb4641024587d17cd9137e136868b0e31f3a8284`.
- Migration source and lock are now content-aligned; production migration verification must still be confirmed by the deployment pipeline.
- CI surfaced the exact source checksum as `24bb4f9a2659265c8afb1f44cb4641024587d17cd9137e136868b0e31f3a8284`; `migration-lock.json` was corrected accordingly in commit `0e10b1a89376f4aee836300b443c859b38b0b3d5`.
- CI then exposed a second migration-integrity gap: the Commerce policy migration had been named `0091_*` alongside Business Hours, while the API catalog omitted Business Hours and Public Contact Links. The canonical ordered catalog is now restored as 0091 Business Hours, 0092 Public Contact Links, 0093 Commerce Fulfillment Policies in commit `6c98532aee7e9265da7b240622fbd493dca302ed`. The final reconciliation is on `main` at `4c446cfb5485d69563423f0095960a1ceefa225e`, with Commerce lock metadata and checksum `0e9f19efe9f4c2e48f8fb7b4dc842f88007926560838817c139b2790b74225a3`.
- Restored the Location lifecycle test's accidental literal newline regression in commit `e04ffb7254af41e2efcd674e421fbb02d215dd46`.

## Catalog Service Lifecycle → SEO/GEO Publication — September 2026
- Added the canonical transactional `CatalogCommandRepository.createService()` path with tenant/workspace validation, idempotency, audit, and `catalog.service.created` outbox event.
- Added regression coverage for the atomic Service creation command.
- Registered `catalog.service.created` in the SEO publication reason map.
- Outbox SEO enrichment now resolves the canonical Service through `CatalogRepository.getService()` and emits a truth-bound `Service` SEO entity: active Services are public/published; draft/inactive Services are not exposed as public.
- Service → owning Business is represented canonically as `ownedByBusiness`; no SEO-owned relationship source was introduced.

## Catalog Service Discovery Projection — September 2026
- `catalog.service.created` now enters the existing Discovery projection pipeline alongside canonical Product creation.
- Discovery remains a derived projection; Catalog remains the canonical Service source.
- Tenant/workspace validation continues to be enforced by the existing outbox worker context.


## Business Location lifecycle → SEO/GEO publication → page verification — 2026-09-25

- Canonical Business Location lifecycle commands are now implemented in `packages/business/src/repository.ts` and exposed through `packages/business/src/service.ts`: create, update and status transitions are tenant/workspace scoped, concurrency guarded, and emit the single canonical `business.location.changed.v1` outbox event.
- SEO publication now understands Location lifecycle change reasons and converts Location event payloads into canonical `SeoEntity` representations; Location representations retain the owning Business dependency for deterministic invalidation.
- Outbox SEO enrichment now materializes the authoritative Location snapshot, including publication state, address, exact GEO coordinates, timezone and Business relationship before the SEO engine consumes the event.
- Location page verification covers canonical URL generation, Place structured data, GEO coordinates, breadcrumbs, publication eligibility and non-public behavior for inactive locations in `packages/seo/src/location-lifecycle.test.ts`.
- Commits: `126f5657200e3e11827e074a4382593a7d62d531` (Business repository), `77746e84e01172286905e2384024a027d788613d` (Business service), `4e9b1d97cce5c0029bcd2c7fb9efa7b055789f9d` (SEO publication), `701c6be026d6c3b5b26511ea8a39a56c6746914f` (SEO outbox enrichment), plus `b2427f8eeb0be148c42f5a071c47c5c82aec7e08` (stale-write guard), `359863e1870b50cd259204d1fc610278f54a3369` (SEO graph verification test), and `a136f04f4969bf4d18f6539948cb16f0cb91a829` (SSR Location page verification).
- Remaining verification gate: run the repository CI/typecheck/test suite and, where production credentials are available, verify the live Worker → D1 → outbox → SEO publication → SSR page chain.


- CI identified four regressions in the existing lifecycle/commerce assertions. Structured Data now preserves canonical Location `GeoCoordinates` and emits `OfferShippingDetails` / `MerchantReturnPolicy`; Location event parsing now resolves Location before the Business fallback. Fix commits: `cc6c4598`, `7d9314b4`, `c74d2d8a`.
## Commerce Shipping + Returns Canonical Policy — September 2026

The former SEO/GEO commerce gap is now implemented through a canonical Commerce-owned policy boundary. SEO does not own or persist shipping/returns truth.

- **Canonical persistence:** `migrations/0091_commerce_fulfillment_policies.sql`
- **Canonical repository:** `packages/commerce/src/repository.ts`
- **Canonical capability:** `packages/commerce/src/service.ts` via `commerce.fulfillment_policy.manage`.
- **Management API:** `POST /api/v1/commerce/fulfillment-policies` with authorization enforcement.
- **Lifecycle event:** `commerce.fulfillment.policy.changed` is emitted transactionally with policy writes.
- **SEO projection:** `apps/api/src/outbox-worker.ts` resolves the product's active policy and attaches authoritative `shippingDetails` / `returnPolicy` to the canonical SEO entity before publication.
- **Precedence:** resource-specific policy first, then the business-level policy for the same resource type; variant identity is resolved through the canonical Catalog repository when a variant policy event triggers publication.
- **Invariant:** no SEO-specific shipping/returns table or duplicate source of truth was introduced.

Residual gate status:
- ProductGroup / Variants: 🟢
- Shipping / Returns / Commerce Schema: 🟢 canonical source + lifecycle + SEO projection implemented
- Canonical Geo Coordinates + Opening Hours: 🟢
- Multimodal Search Measurement: 🟡 API-dependent
- Bing AI Performance ingestion: 🟡 API-dependent


## Business Location GEO Projection Regression — 2026-09-25
- Fixed the Location event adapter so raw canonical `geoPoint` coordinates survive `seoEntityFromEvent()` into the SEO projection model.
- This closes the regression exposed by `packages/seo/src/location-lifecycle.test.ts`; the canonical Location page now retains the authoritative latitude/longitude before structured-data generation.
- Commit: `69b157b426d979817beac76190d2ec3b6b13df19`.
- Phoenix verification passed on this commit; repository CI was still running at ledger update time.


## Location Invalidation Contract Hardening — 2026-09-25
- Registered the canonical `business.location.changed.v1` event in SEO domain invalidation as `location-changed`, so dependency-aware invalidation can consume the real Business Location lifecycle event directly.
- Added regression coverage asserting Location changes retain related Business dependencies during domain-change conversion.
- Commits: `11df4f426759716d661950468e48386a8ea785b2`, `4f00eaec0bb5dd8b20e2770d1d97ddebbdea7682`.


## Business Location End-to-End Contract Verification — 2026-09-25
- Extended Location lifecycle coverage across the canonical event → SEO domain invalidation → dependent representation target chain.
- Added SSR assertions confirming Location GEO coordinates and hydration are present in the rendered public document surface.
- The repository-level E2E contract now verifies the deterministic chain without introducing a second Location source of truth.
- Commits: `c02bd6bb7d9f221f9dc789c9cd11beb61ddd5050`, `6b40e8fbbae5c837f71f62030a66836a51ff5587`.

## SEO/GEO Standards Hardening — 2026-09-25

- Completed the standards-driven AI crawler policy surface without changing the existing default wildcard robots behavior.
- Added independently configurable robots controls for `OAI-SearchBot`, `GPTBot`, `Google-Extended`, `ClaudeBot`, and `PerplexityBot`, plus optional `Crawl-delay`.
- Added an optional IndexNow adapter with same-host validation, batching capped at the protocol maximum, optional key-location/endpoint configuration, and non-blocking failure semantics.
- Wired IndexNow to successful canonical SEO publication so external freshness notification is derived only from the persisted canonical URL.
- Added the operational contract `docs/SEO_AI_CRAWLER_INDEXING_CONTRACT.md` and production-hardening guidance.
- Added regression coverage for AI crawler directives and IndexNow payload validation.
- Added `/image-sitemap.xml` to API-first Worker routing so the canonical image discovery surface cannot fall through to SPA assets.
- Code/doc commits: `adc5945278f3923d10b2523340d396463f752b4a`, `2e897133b123b103cfafc7ce2adeb897231b12c1`, `b6592dc61d6d41ffd922f21b9c1dbf8770aa72ab`, `59e1a65e11206c74f590abdda3fd7d67c684a320`, `11280a1f268f089528ba5e14497e3a384de7f67c`, `ce16c9ef2d340295596e332da881808e05378be5`, `9a9c8cf74861c47bb060a7227e41aa9d818af578`, `8983d764d97b0e10bdc64c37b97f4ab9fce78f55`, `0d8d0898dfab9b93997a2902db7b7f8a4513dab5`, `e29c6474362a073bd97ba89a7d5835f882566238`, `b5df2b1282b4b66cb1f0e75061d0ac94256d3ecd`.

Residual external gates remain intentionally evidence-bound: Google Search Console multimodal Search Analytics API support and Bing Webmaster AI Performance machine-readable ingestion. Neither is synthesized while the provider API does not expose the required data.

### SEO/GEO verification fixes — 2026-09-25

- Fixed strict Fetch API typing in the IndexNow regression test (`b39348057c...`, `613682b56c...`).
- Restored the required `aggregateType` field in the Location lifecycle test fixture (`bddb41d60a...`).
- Fixed the remaining Location invalidation contract so `business.location.changed.v1` derives the owning Business dependency from its canonical `businessId` payload when `relatedEntityIds` is not explicitly present (`4f18d1df4063d29f0b4c38fb7f00617b6b23f310`).
- Latest Phoenix CI before this fix had 319/320 tests passing; the only failing test was the Location invalidation dependency assertion.

### Canonical Trust reputation → Public SEO/GEO projection — 2026-09-25

- Added a public `ReputationSummaryRecord` read path to Trust so SEO consumes published reputation truth without duplicating the source of truth.
- SEO outbox enrichment now attaches `AggregateRating` to Business and Product public entities only when canonical published review count is positive.
- Structured Data emits Schema.org `AggregateRating` from the same canonical values.
- SSR Entity Pages render the same rating value and review count visibly, preserving the structured-data visible-content invariant.
- Public Entity Page model now exposes a dedicated Customer Reviews section when canonical reputation evidence exists.
- Added regression coverage for Business/Product AggregateRating output.
- Commits: `d42ad48eea...`, `2c088ff346...`, `f241b61126...`, `9e651ee0c9...`, `a48e76fc6a...`, `ae0a3a8f96...`, `55f0d57739...`, `4f3ec9ccdb...`, `d5a02a3d9b...`.
## Search Engine API Control Plane — 2026-09-25

- Added provider-native search-engine actions to the SEO core in `packages/seo/src/search-engine-actions.ts`.
- Google Search Console: sitemap submission and URL Inspection API support using OAuth access tokens or service-account JWT credentials.
- Bing Webmaster: URL submission via the documented JSON endpoint, supporting API-key or OAuth bearer authentication.
- Yandex Webmaster: URL recrawl requests and indexing-history retrieval via the v4 API with OAuth authorization.
- Added authenticated API routes for Google URL Inspection/sitemap submission, Bing URL submission, and Yandex recrawl requests.
- Bing and optional Yandex recrawl notifications are wired into successful SEO publication; provider failures remain non-blocking to canonical SEO publication and are counted separately.
- Existing IndexNow remains the multi-engine freshness notification path; these APIs add provider-specific control/inspection rather than duplicating the IndexNow protocol.
- Official API constraints are respected: Google Indexing API is not used as a generic page-submission mechanism because Google restricts it to JobPosting and BroadcastEvent-in-VideoObject pages; ordinary Phoenix pages continue through sitemaps/Search Console and IndexNow/Bing/Yandex-supported notification paths.
- Multimodal Search Console measurement and Bing AI Performance ingestion remain API-dependent and are not synthesized until official machine-readable fields/endpoints are exposed.
- Commits: `a75c455a6a22c11be878ee1c1aaeada5c3915d96`, `3eba8f11276932efec32819a37868485e80ebb00`, `7ae3aee976c565ba6464d136abdf688832d77fcf`, `878479bbbeca5ea2164dea7c5b9590c7472fc279`, `3009ec007408b93a75d4bfcd81f3704eb0a5b51d`, `9b5188aeacbbe40a8c841e3170d0891a9aa056e3`.

## 2026-09-25 SEO/GEO completion hardening

| Area | Status | Implementation |
|---|---|---|
| Merchant Center XML product feed | 🟢 Implemented | `packages/seo/src/merchant-feed.ts`; public `/merchant-center/products.xml`; canonical product projection; required-fact gating without fabricated condition/price/image/availability |
| Google Merchant API | 🟢 Optional production sync ready | `packages/seo/src/merchant-api.ts`; `productInputs.insert/delete`; OAuth access-token or service-account JWT support; non-blocking publication integration |
| ProductGroup / variants | 🟢 Hardened | full Schema.org `variesBy` URLs, ProductGroup AggregateRating, variant description/name derivation, stable variant identifiers, `inProductGroupWithID`, canonical variant preservation |
| Google Search Console multimodal / Generative AI ingestion | 🟢 Export ingestion implemented; API limitation explicit | `packages/seo/src/external-visibility-import.ts`; authenticated import routes for multimodal and Generative AI Performance exports; page-to-entity resolution; provenance preserved |
| Bing AI Performance | 🟢 Export ingestion implemented; API boundary truthful | authenticated CSV/JSON ingestion for pages, grounding queries and time-series; citation share/intent/topic capture; no undocumented scraping |
| Production SEO crawler hardening | 🟢 Implemented | HTTPS canonical validation, 200/MIME checks, 4 MiB safety limit, single canonical enforcement, metadata drift, JSON-LD parseability, exact X-Robots consistency |
| Tests | 🟢 Added | Merchant feed, Google/Bing import, and crawler hardening coverage |
| External activation gates | 🟡 Provider-account dependent | Merchant Center account/data source/credentials, Google Search Console export availability, Bing Webmaster export data remain external provider operations; no synthetic measurements |


### Final hardening additions after initial 2026-09-25 completion pass
- Merchant feed links now resolve from persisted `seo_entity_representations.canonical_url`; fallback URL construction is used only when no persisted canonical URL is available.
- Merchant variant titles exclude `condition` from differentiating title text; condition remains a dedicated commerce field.
- ProductGroup nested variants no longer redundantly emit `inProductGroupWithID`; parent `productGroupID` is canonical for the nested representation.
- Variants without dedicated URLs still receive stable JSON-LD `@id` values derived from the canonical parent URL and variant ID.
- Production Wrangler rendering now carries optional Merchant Center account/data-source/feed-label/content-language variables.


## Search Engine API Reliability + Unified Gateway — 2026-09-25

- Hardened \`packages/seo/src/search-engine-actions.ts\` with bounded retry/backoff, \`Retry-After\` handling, per-attempt timeout, non-blocking transient retry behavior and a non-secret audit hook.
- Google service-account access tokens are cached for the lifetime of an action adapter instead of being exchanged for every request.
- Added \`packages/seo/src/search-engine-gateway.ts\` as the unified control-plane abstraction for Google Search Console, Bing Webmaster and Yandex Webmaster actions.
- SEO publication now routes Bing submission and optional Yandex recrawl through the same gateway contract; authenticated API routes expose gateway-backed capability status.
- Added authenticated \`GET /api/v1/seo/search-engines/status\` and \`GET /api/v1/seo/search-engines/yandex/indexing-history\`.
- Added runtime configuration: \`SEO_SEARCH_ENGINE_MAX_ATTEMPTS\`, \`SEO_SEARCH_ENGINE_TIMEOUT_MS\`, \`SEO_SEARCH_ENGINE_BASE_DELAY_MS\`, \`SEO_SEARCH_ENGINE_MAX_DELAY_MS\`.
- Added retry/audit and gateway regression tests.
- Commits: \`ffa11d359e6d4f846d3b713af5659d5066076455\`, \`1f206b647292a5d57440621a0a53a02c6f6e5c60\`, \`f028d954d819218ffc4bd81e94d1a6229563d70a\`, \`0c18b682ad13c1a8e096b0cb4da82ebe48bce464\`, \`3891092e17c3d34ba376ea1141ebe6928d1d04df\`, \`afac97f545d1a5c09ce90f6d3eb14d99f090fc2\`, \`4cb87b518dd51758277964a0b759b142be2e4562\`, \`b436307d71a8ef20e21bc9ece980d880f8a630c6\`.


### Search Engine Gateway routing completion — 2026-09-25

- The authenticated Google/Bing/Yandex control-plane routes now invoke \`SearchEngineActionGateway\`; provider classes are no longer instantiated directly from \`apps/api/src/index.ts\`.
- Publication-triggered Bing submission and Yandex recrawl already use the same gateway.
- The control plane therefore has one provider abstraction for capability status, operational actions, retry/timeout behavior and audit hooks.
- Commit: \`808c5001ad09493981df12951ec7304044a66cff\`.


## Non-SerpApi Search Intelligence Expansion — 2026-09-25

- Added provider-neutral `packages/seo/src/search-intelligence.ts` with DataForSEO-backed Google Organic, AI Mode, Maps, Local Finder, News, Images, Jobs, Autocomplete, Dataset Search, Shopping, Search by Image, Bing Organic/News/Images/Videos, Yandex Organic, Yahoo, Baidu, Naver, Seznam, YouTube SERP and Amazon Product intelligence.
- Added DataForSEO Trends, Google business-information and Google Ads Search / Ads Advertisers intelligence.
- Added official Google Places (Text Search, Nearby Search, Autocomplete, Place Details, Place Photos), Google Routes and YouTube Data API adapters.
- Added authenticated SEO intelligence control-plane routes and readiness gates; SerpApi is intentionally not used.
- Added regression tests and provider-neutral provenance; raw provider observations are not converted into invented universal rank/popularity metrics.
- Commits: `bcfebd560c47245a7621e5f1bf342d773fe2f18e`, `81b8470dd0fdd534e0bdbc4c032a5696187aa904`, `7406b33a9d4d49ecb2b9fab7eade18007d0d85d4`, `bebba75946352900a39654fd8fed8ff5d2d07784d`, `93d9119d1cae2d122bad390f739edc60ddee8f45`, `7cbdc9f0f2ff6aedf1781b6ed9b3e2d79b1f9a5b`, `b19a2e003c01f5f30fc400b480f8260873e0a289`, `d3cf09ba19985d6584388244cfe2f7df96c0ffba`, `0682b369511f7ed0268cfbfc853d238dc290cac0`, `8f62b6ee13f07e27e36b9a3b6d769d881537bc15`, `c4757354da390b48303a4334ae6856c0d5b7eed8`.
