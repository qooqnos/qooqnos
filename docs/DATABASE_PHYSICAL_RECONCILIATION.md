# Phoenix Database Physical Reconciliation

**Status:** Canonical database-planning record  
**Last reviewed:** 2026-09-22  
**Source branch:** main

## Purpose

This document reconciles the canonical logical database model with the physical schema currently defined by migrations.

It is the gate before adding new D1 tables. Its purpose is to prevent duplicate entities, conflicting semantics and repeated implementation across future coding-agent sessions.

The rule is:

```
Logical model
→ existing physical schema
→ semantic reconciliation
→ one owner per fact
→ new module-owned migration only when genuinely missing
```

## 1. Current physical migration inventory

The current API migration catalog references versions 0001 through 0016.

### Foundation — 0001

17 physical tables:

- schema_migrations
- organizations
- users
- external_identities
- workspaces
- memberships
- roles
- permissions
- role_permissions
- membership_roles
- modules
- module_versions
- tenant_modules
- feature_flags
- audit_events
- idempotency_records
- outbox_events

### Onboarding — 0002

- onboarding_profiles

### Identity sessions — 0003

- sessions

### Business — 0004

- businesses
- business_profiles
- locations

### Catalog — 0005

- categories
- services
- products
- product_variants
- offerings
- business_categories
- offering_categories
- prices
- inventory_items

### Catalog integrity — 0006–0007

No new tables.

These migrations add database-level catalog lifecycle and cross-aggregate integrity triggers.

### Permission catalog — 0008

No new tables.

This migration seeds persisted permission vocabulary.

### Media — 0009

- media_assets
- media_variants
- media_processing_jobs
- media_links

### Discovery — 0010

- search_documents
- embedding_records
- ranking_features
- indexing_jobs

### Seller AI creation — 0011–0013

- seller_ai_creation_sessions
- seller_ai_inputs
- seller_ai_drafts
- seller_ai_field_provenance

0012 adds seller-AI links to Business/Catalog plus idempotency/request metadata.

0013 adds request_fingerprint.

### Catalog Attribute vocabulary — 0016

- attribute_definitions
- attribute_options
- category_attributes

0016 establishes the canonical reusable attribute vocabulary and Category applicability metadata. It does not create a product/service value table; existing product_variants.attributes_json remains the current value representation.

**Total currently defined physical tables: 46.** Migrations 0014–0015 add integrity triggers only; migration 0016 adds three Catalog Attribute vocabulary tables.

This count includes only canonical SQL migration sources. It does not include the removed PostgreSQL compatibility schema or any historical in-memory schema.

## 2. Domain coverage matrix

| Domain | Current physical state | Reconciliation status |
|---|---|---|
| Identity / Tenancy | users, external_identities, organizations, workspaces, memberships, sessions | Core implemented; user_profiles is still missing |
| Authorization | roles, permissions, role_permissions, membership_roles, persisted permission catalog | Core implemented; policy/entitlement extensions remain future work |
| Platform / Reliability | modules, module_versions, tenant_modules, feature_flags, audit_events, idempotency_records, outbox_events, schema_migrations | Core implemented |
| Onboarding | onboarding_profiles | Implemented core |
| Business | businesses, business_profiles, locations | Partial |
| Catalog | categories, services, products, variants, offerings, category links, prices, inventory, attribute vocabulary | Partial; attribute-definition foundation implemented |
| Media | assets, variants, links, processing jobs | Core implemented |
| Discovery | search documents, embeddings, ranking features, indexing jobs | Core projection implemented; index-version registry is missing |
| Seller AI Creation | creation sessions, raw inputs, drafts, field provenance | Implemented for seller-side creation slice |
| Customer / CRM | no canonical customer tables | Missing |
| Matching | no user request / match execution tables | Missing |
| Booking / Availability | no booking/appointment/resource/schedule tables | Missing |
| Trust / Verification | no verification case/check/evidence/decision tables | Missing |
| Moderation / Privacy / Consent | no canonical workflow tables | Missing |
| Communication | no conversation/message/notification/delivery tables | Missing |
| Commerce | no cart/order/payment/refund tables | Missing |
| Billing | no plan/subscription/usage/invoice tables | Missing |
| AI Runtime | no canonical ai_operation/model/provider/policy/result/usage tables | Missing |
| Automation | no workflow/trigger/execution tables | Missing |
| Integration | no integration/external-account/webhook/sync tables | Missing |
| Localization / Documents / Analytics | no dedicated canonical tables identified in current migration set | Missing |

## 3. Important semantic mismatches

These are not invitations to create duplicate tables. They are reconciliation gates.

### 3.1 Service model

The logical model distinguishes a reusable Service definition from a business-specific offering.

The current physical schema represents that distinction without a second service-link table:

- services may exist with a nullable business_id;
- offerings always belong to a Business;
- a service offering references one Service;
- the catalog repository validates that a referenced Service is compatible with the offering Business.

**Decision:** keep the current services + offerings model as the physical source of truth. Do not create business_services or another service-link table merely to mirror the logical vocabulary.

If a future business-specific service configuration needs an independent lifecycle, it must be introduced as an explicit extension of this model, not as a duplicate relationship table.

### 3.2 Pricing model

The logical vocabulary previously described service_prices and product_prices.

The physical schema uses one shared `prices` table attached to `offerings`, and no active code creates parallel service- or product-price tables.

**Decision:** `prices(offering_id, ...)` is the canonical physical source of truth for offer-level pricing. Do not create `service_prices` or `product_prices`. If variant-specific or component-specific pricing becomes a product requirement, extend the existing pricing model through an explicit migration and ownership decision.

### 3.3 Business category ownership

business_categories is physically introduced by the Catalog migration, while the logical model also treats business classification as part of the Business domain.

**Action:** keep the existing table as the single source of truth. Resolve module ownership formally before any ownership refactor. Never create business_category_links or an equivalent duplicate.

### 3.4 Business profile JSON fields

business_profiles currently stores contact and branding information in JSON fields.

**Action:** do not create parallel contact/branding tables until each field's filtering, uniqueness, privacy and lifecycle requirements are established. Split only through an explicit compatibility migration when the domain requires structured ownership.

### 3.5 Product variant attributes

product_variants currently contains attributes_json.

The logical model also contains structured product attributes and reusable attribute definitions/options.

**Decision:** migration 0016 implements the canonical reusable Attribute vocabulary (attribute_definitions, attribute_options, category_attributes) without creating a second value store. product_variants.attributes_json remains the current physical value representation. Do not create product_attributes, service_attributes or a variant-attribute table until authoritative value ownership, backfill and read/write cutover semantics are explicitly defined.

### 3.6 Business primary category

`businesses.primary_category_id` is part of the canonical Business record but was initially created without a direct foreign-key constraint to `categories`.

**Decision:** harden the existing field in a Business-owned integrity migration. Do not create another category relationship table. Because category scope currently does not carry explicit organization/workspace owner columns, tenant-scope compatibility remains a domain-policy concern rather than an invented SQL relationship.

### 3.7 Offering integrity

offerings identifies its offering_type and optional service_id/product_id. The current guard migrations enforce cross-business consistency when references are present, but the physical contract should also ensure the correct referenced aggregate exists for the declared type.

**Decision:** this invariant is finalized and enforced by migration 0014. Do not redesign offerings as another entity.

## 3.8 Catalog integrity hardening — 0014

Migration 0014 hardens the existing offerings model without introducing a new entity. It enforces that a service offering references exactly one service, a product offering exactly one product, the referenced row exists, and the referenced product/service belongs to the offering business. Update paths are protected as well.

This confirms the current physical design: services, products and offerings are distinct but related concepts. Do not create business_services, offers, or another duplicate sellable table without a new architecture decision.

## 3.9 Business primary category integrity — 0015

Migration 0015 hardens the existing `businesses.primary_category_id` relationship without adding a new entity. It rejects inserts/updates that reference an unknown category and prevents deletion of a category that is referenced as a Business primary category.

The migration deliberately does not infer organization/workspace ownership for category rows because the current `categories` contract does not store those owner keys.

## 3.10 Catalog Attribute vocabulary — 0016

Migration 0016 establishes three canonical Catalog Attribute tables: attribute_definitions, attribute_options and category_attributes.

The physical contract is deliberately platform-level for the reusable attribute vocabulary. It does not invent tenant-specific ownership semantics while the existing Category model lacks physical organization/workspace owner columns.

The migration also deliberately does not create value tables for Products or Services. The existing product_variants.attributes_json remains the current value representation. A later value migration must define authoritative storage, JSON backfill, conflict handling and repository cutover before introducing any structured value table.

## 4. Seller AI versus canonical AI Runtime

The seller-AI migrations are real physical implementation, but they are not the canonical AI execution ledger.

Current seller-AI tables:

- seller_ai_creation_sessions
- seller_ai_inputs
- seller_ai_drafts
- seller_ai_field_provenance

These represent the seller product-creation workflow.

They must eventually integrate with the canonical AI Runtime objects defined by the AI runtime data dictionary:

- ai_operations
- ai_models
- ai_providers
- ai_model_routing_decisions
- ai_prompts / ai_prompt_versions
- ai_schemas / ai_schema_versions
- ai_policies / ai_policy_decisions
- ai_provider_attempts
- ai_runtime_results
- ai_usage_records

Do not create ai_runs, ai_tool_calls or another parallel execution ledger.

Seller-AI workflow state and AI Runtime execution state have different ownership and semantics.

## 5. Discovery is projection-only

The current Discovery migration creates:

- search_documents
- embedding_records
- ranking_features
- indexing_jobs

These are derived records.

They must never become authoritative sources for:

- business status
- catalog publication
- availability
- price
- inventory
- permissions
- financial state

The missing search_index_versions concept should be introduced only if its versioning semantics are needed by the projection system.

## 6. Duplicate prevention rules

Before creating any new physical table:

1. Search this document.
2. Search docs/DATABASE_MODEL.md.
3. Search docs/PHYSICAL_SCHEMA_BLUEPRINT.md.
4. Search every existing migration for the same fact under another name.
5. Identify exactly one owner module.
6. Decide whether the existing table can be extended instead of creating a new table.
7. Only then add a new module-owned migration.

Never create parallel canonical entities for:

- User / Customer identity
- Business / Vendor / Merchant identity
- Service / Appointment commitment
- Product / Catalog product
- Offering / Offer
- Price / Pricing
- Booking / Reservation
- Invoice / Billing document
- MediaAsset / Image / File metadata
- AI execution / AI run
- Search document / authoritative catalog record

## 7. Current implementation boundary

The database is neither empty nor complete.

The accurate state is:

```
43 physical tables defined
        ↓
foundation + onboarding + identity + business + catalog
+ media + discovery + seller-AI slices implemented
        ↓
many logical domains remain unimplemented
        ↓
several existing semantic mismatches require explicit reconciliation
        ↓
new migrations must follow ownership + no-duplication gates
```

## 8. Next database implementation order

The next implementation work should proceed in this order:

1. Complete Catalog Attribute value ownership and migration semantics without duplicating current JSON-backed state.
2. Complete Business lifecycle support only where the logical model requires it.
4. Introduce Customer/CRM identity and relationship structures.
5. Introduce Verification/Trust/Moderation structures.
6. Introduce Booking/Availability structures.
7. Introduce Commerce/Billing structures.
8. Introduce Communication/Automation/Integration structures.
9. Introduce canonical AI Runtime storage.
10. Add matching/user-request persistence and rebuildable projections.
11. Add remaining localization/document/analytics/privacy structures where justified.

Every step must use a new numbered module-owned migration and must preserve all prior migration IDs and checksums.

## 9. Final D1 gate

Cloudflare D1 provisioning is not the schema-design step.

The database is ready for production provisioning only when:

- every required logical entity has exactly one physical owner;
- semantic mismatches are explicitly resolved;
- duplicate entities are ruled out;
- tenant boundaries are enforced;
- critical invariants are enforced by schema or domain transactions;
- migration history and lock integrity pass;
- repositories and services cover implemented domains;
- tenant-isolation and integrity tests pass.

Until then, adding another generic database schema would create unnecessary divergence.
