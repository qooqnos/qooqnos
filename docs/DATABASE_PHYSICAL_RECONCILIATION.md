# Phoenix Database Physical Reconciliation

**Status:** Canonical database-planning record  
**Last reviewed:** 2026-09-23  
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

The current API migration catalog references versions **0001 through 0063**.

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

### Catalog integrity / permission catalog — 0006–0008

No new tables.

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

### Catalog integrity hardening — 0014–0015

No new tables.

These migrations add integrity triggers only.

### Catalog Attribute vocabulary — 0016

- attribute_definitions
- attribute_options
- category_attributes

### Catalog Attribute values — 0017

- attribute_values
- attribute_value_options

0017 established the expand-only AttributeValue layer. Migration 0063 performs the fail-closed JSON validation/backfill and retires `product_variants.attributes_json` as a writable value path. `attribute_values` / `attribute_value_options` are now authoritative for variant attributes.

### Customer core — 0018

- customers
- customer_preferences

### CRM customer relationships — 0019

- customer_relationships

### CRM timeline events — 0020

- crm_timeline_events

### Trust VerificationCase / evidence — 0021

- verification_cases
- verification_documents

### Trust policy / requirements — 0022

- verification_policies
- verification_requirements

### Trust checks — 0023

- verification_checks
- verification_check_documents

### Trust decisions — 0024

- verification_decisions
- verification_decision_checks

### Trust review / expiry — 0025

- verification_reviews
- verification_expiries

### Customer addresses — 0026

- customer_addresses

### Business lifecycle history — 0027

- business_status_history

### Booking core — 0028

- bookings
- booking_items
- appointments
- resources
- appointment_resources

### Availability schedules — 0029

- schedules
- availability_rules
- availability_exceptions

### Booking holds / history — 0030

- booking_holds
- booking_status_history
- appointment_events

### Commerce transaction core — 0031

- commerce_carts
- commerce_cart_lines
- commerce_checkout_sessions
- commerce_price_snapshots
- commerce_orders
- commerce_order_lines
- commerce_order_adjustments
- commerce_transaction_attempts
- commerce_fulfillment_references
- commerce_cancellations
- commerce_refund_references
- commerce_order_events

0031 establishes the Commerce-owned transaction boundary. Billing/Payment remains authoritative for payment instruments, settlement, refunds and financial ledger.

### Commerce integrity hardening — 0032

- no new tables

0032 tightens Commerce tenant boundaries and makes PriceSnapshot calculation-context uniqueness scope-aware.

### Billing core — 0033

- billing_plans
- billing_prices
- billing_plan_entitlements
- billing_subscriptions
- billing_subscription_events
- billing_usage_meters
- billing_usage_events
- billing_entitlement_snapshots
- billing_provider_refs
- billing_reconciliation_cases

### Financial audit trail — 0058

- billing_financial_audit_events

0058 closes the append-only financial evidence boundary. It is tenant-scoped, idempotency-aware, hash-verifiable, and protected against UPDATE/DELETE. It records financial actions without becoming the future double-entry accounting ledger.

### Refund financial accounting — 0059

- billing_refunds
- billing_ledger_accounts
- billing_ledger_transactions
- billing_ledger_entries

0059 establishes Billing/Payment refund financial truth and an immutable double-entry ledger. Refund posting requires matching currency/scope and a balanced, non-zero journal; ledger corrections use reversal entries rather than UPDATE/DELETE. External provider execution remains an adapter/reconciliation concern.

0033 establishes the Billing authority for plans, prices, subscriptions, entitlements, usage events, provider references and reconciliation cases. It does not create marketplace payment execution or financial ledger tables.

### Billing quota counters — 0034

- billing_usage_counters

0034 provides an atomic counter boundary for hard quota enforcement.

### Communication core — 0035

- communication_conversations
- communication_messages
- communication_notifications
- communication_delivery_attempts

0035 establishes provider-neutral Communication conversation, message, notification and delivery-attempt storage with notification idempotency and tenant/workspace scope.

### Automation core — 0036

- automation_workflows
- automation_workflow_versions
- automation_triggers
- automation_conditions
- automation_actions
- automation_schedules
- automation_executions
- automation_step_executions
- automation_execution_attempts
- automation_execution_errors
- automation_variables
- automation_policies
- automation_approval_references
- automation_compensation_references

0036 establishes reusable versioned workflows and execution state. Domain facts remain owned by their originating modules.

### AI Runtime core — 0037

- ai_operation_types
- ai_providers
- ai_models
- ai_prompts
- ai_prompt_versions
- ai_schemas
- ai_schema_versions
- ai_policies
- ai_operations
- ai_model_routing_decisions
- ai_policy_decisions
- ai_provider_attempts
- ai_runtime_results
- ai_usage_records

0037 establishes the shared AI Runtime source-of-truth boundary. AI output remains non-authoritative for Business/Booking/Commerce state.

### Integration core — 0038

- integration_providers
- integration_accounts
- integration_webhooks
- integration_sync_jobs
- integration_external_references

0038 establishes provider-neutral external account, webhook, synchronization and reference state. Credential values remain outside ordinary domain rows.

### Privacy / Consent — 0039

- privacy_consents
- privacy_requests
- privacy_processing_records

0039 establishes consent and explicit privacy-subject request processing records.

### Demand / Matching core — 0040

- demand_requests
- demand_profiles
- match_requests
- match_candidates
- match_decisions

0040 establishes Phoenix's canonical Demand → Match persistence boundary. Catalog/Business/Offering remain authoritative for matched supply.

### Demand / Matching integrity — 0041

- no new tables

0041 hardens typed candidate uniqueness and append-only MatchDecision history.

### Trust Reviews — 0042

- reviews

0042 establishes canonical Review storage with exactly one target from the Review target contract: Business, Offering, or Product.

### Integrity update guards — 0043

- no new tables

0043 hardens update-time tenant integrity for MatchCandidate and Review records.

### Billing counter scope — 0044

- no new tables

0044 corrects Billing usage-counter uniqueness so counters are scoped by Organization, Workspace, Business, Meter and Period.

### Review target integrity — 0045

- no new tables

0045 enforces Review Business/Offering/Product target scope on insert and update.

### Booking finalization guards — 0046

- no new tables
- adds `bookings.idempotency_key`

0046 hardens Booking finalization/idempotency and resource-capacity protection.

### Booking capacity update guards — 0047

- no new tables

0047 extends capacity protection to appointment status/time mutations and Resource capacity reductions.

### Review moderation / reputation — 0048

- review_reports
- review_responses
- review_moderation_cases
- review_moderation_decisions
- review_risk_signals
- reputation_summaries
- reputation_versions

0048 establishes review reporting, response, moderation, risk-signal and reputation projection storage.

### Fulfillment core — 0049

- fulfillment_orders
- fulfillment_items
- fulfillment_plans
- fulfillment_tasks
- fulfillment_assignments
- shipments
- shipment_packages
- tracking_events
- delivery_attempts
- service_deliveries
- service_completions
- digital_deliveries
- fulfillment_exceptions
- fulfillment_status_history
- fulfillment_completion_evidence

0049 establishes canonical fulfillment/service-delivery ownership separate from Commerce transaction truth.

### Case & Support core — 0050

- cases
- case_types
- case_queues
- case_assignments
- case_participants
- case_events
- case_notes
- case_evidence_references
- case_links
- case_escalations
- case_resolutions
- case_slas
- case_actions
- case_templates

0050 establishes operational case/support ownership without duplicating domain truth.

### Communication templates — 0051

- communication_templates
- communication_template_versions

0051 establishes the versioned Communication template registry. Approved versions are immutable.

### Generic ModerationCase — 0052

- moderation_cases

0052 establishes the canonical generic moderation workflow record. Review-specific moderation remains owned by the existing review moderation tables; this record is the cross-domain moderation case coordinator.

### AI Runtime worker leases — 0053

- no new tables
- adds AI operation worker lease/claim columns and indexes

0053 adds durable execution ownership to the existing AI Runtime operation aggregate without creating a second execution ledger.

### Discovery index observability — 0054

- search_index_versions
- discovery_query_traces
- discovery_evaluation_records

0054 closes the Discovery index-generation/versioning gap and persists query/evaluation evidence without turning derived search state into domain truth.

### Communication policy / consent enforcement — 0055

- communication_intents
- communication_preferences
- communication_suppression_records
- communication_policy_decisions

0055 closes the Communication intent/channel policy, preference, opt-in and suppression boundary. Policy-denied/suppressed notifications remain recorded but are not published to Outbox dispatch.

### Communication required-message suppression — 0056

- no new tables
- adds `communication_suppression_records.applies_to_required`

0056 distinguishes optional suppression from required transactional/security traffic.

**Total currently defined physical tables: 190.**

This count includes only canonical SQL migration sources. It does not include removed PostgreSQL compatibility schema or historical in-memory schema.

## Database completion audit

The canonical schema audit is executable through the repository command "npm run report:database".

Current main schema baseline:
- **56** ordered SQL migrations.
- **190** canonical physical tables defined by those migrations.
- API migration catalog and migration lock must contain the same ordered migration set.
- This document's physical-table inventory must equal the tables parsed from canonical SQL migrations.
- **Physical schema completion: 100%** when those integrity conditions hold.
- Production D1 application is reported separately because it requires credentialed Cloudflare access; it is not conflated with schema completeness.

## 2. Domain coverage matrix

| Domain | Current physical state | Reconciliation status |
|---|---|---|
| Identity / Tenancy | users, external_identities, organizations, workspaces, memberships, sessions | Core implemented; user_profiles is still missing |
| Authorization | roles, permissions, role_permissions, membership_roles, persisted permission catalog | Core implemented; policy/entitlement extensions remain future work |
| Platform / Reliability | modules, module_versions, tenant_modules, feature_flags, audit_events, idempotency_records, outbox_events, schema_migrations | Core implemented |
| Onboarding | onboarding_profiles | Implemented core |
| Business | businesses, business_profiles, locations, business_status_history | Core storage and lifecycle history implemented; Business lifecycle and Onboarding workflow are explicitly reconciled as separate state machines with no additional physical Business status table |
| Catalog | categories, services, products, variants, offerings, category links, prices, inventory, attribute vocabulary and AttributeValue storage | Partial; value storage is staged and current JSON path remains authoritative |
| Media | assets, variants, links, processing jobs | Core implemented |
| Discovery | search_documents, search_index_versions, embedding_records, ranking_features, indexing_jobs, discovery_query_traces, discovery_evaluation_records | Core versioned projection, trace and evaluation persistence implemented; external Vectorize generation remains an infrastructure/provider gate |
| Seller AI Creation | creation sessions, raw inputs, drafts, field provenance | Implemented for seller-side creation slice |
| Customer / CRM | customers, customer_preferences, customer_relationships, crm_timeline_events, customer_addresses | Customer core, CRM relationship, structured Address and logical CustomerProfile composition are implemented; timeline read-model/workflow layers remain |
| Matching | demand_requests, demand_profiles, match_requests, match_candidates, match_decisions, match_learning_signals | Canonical Demand→Match persistence plus Discovery-backed retrieval/ranking, Match→Connect orchestration and append-only learning-signal evidence implemented; broader Act integrations remain |
| Booking / Availability | bookings, booking_items, appointments, resources, appointment_resources, schedules, availability_rules, availability_exceptions, booking_holds, booking_status_history, appointment_events | Core schema/repositories implemented; finalization/idempotency/capacity guards and derived slot generation implemented; provider/workers remain separate |
| Trust / Verification / Reviews | verification_cases, verification_documents, verification_policies, verification_requirements, verification_checks, verification_check_documents, verification_decisions, verification_decision_checks, verification_reviews, verification_expiries, reviews, review_reports, review_responses, review_moderation_cases, review_moderation_decisions, review_risk_signals, reputation_summaries, reputation_versions, trust_signals | Verification chain, assigned-reviewer authorization, review reporting/moderation/risk, reputation and TrustSignal projections implemented; expiry and anti-abuse workers are live |
| Moderation / Privacy / Consent | moderation_cases, privacy_consents, privacy_requests, privacy_processing_records | Core generic moderation/consent/privacy-request storage plus PrivacyProcessor orchestration and Customer export/delete/retention processing implemented; subject scope validation and consent expiry are live |

| Communication | communication_conversations, communication_messages, communication_notifications, communication_delivery_attempts, communication_intents, communication_preferences, communication_suppression_records, communication_policy_decisions, communication_templates, communication_template_versions | Core storage, policy/consent/suppression enforcement, outbox-linked dispatch worker, versioned template registry, in-app delivery adapter, runtime HTTP provider adapters and scoped dispatch rate-limit controls implemented |
| Commerce | commerce_carts, commerce_cart_lines, commerce_checkout_sessions, commerce_price_snapshots, commerce_orders, commerce_order_lines, commerce_order_adjustments, commerce_transaction_attempts, commerce_fulfillment_references, commerce_cancellations, commerce_refund_references, commerce_order_events | Core transaction boundary implemented; pricing/checkout orchestration, Billing/Payment, Promotion/Loyalty and Fulfillment integrations remain separate capabilities |
| Billing | billing_plans, billing_prices, billing_plan_entitlements, billing_subscriptions, billing_subscription_events, billing_usage_meters, billing_usage_events, billing_usage_counters, billing_entitlement_snapshots, billing_provider_refs, billing_reconciliation_cases | Core plan/subscription/entitlement/usage/quota/reconciliation storage implemented; financial audit, refund and double-entry accounting storage is implemented; provider adapters and invoicing remain separate gates |
| AI Runtime | ai_operation_types, ai_providers, ai_models, ai_prompts, ai_prompt_versions, ai_schemas, ai_schema_versions, ai_policies, ai_operations, ai_model_routing_decisions, ai_policy_decisions, ai_provider_attempts, ai_runtime_results, ai_usage_records | Core persistence plus provider registry/governance/routing/output-safety validation and Seller AI durable worker scheduling implemented; new AI operation types require explicit input resolvers |
| Automation | automation_workflows, automation_workflow_versions, automation_triggers, automation_conditions, automation_actions, automation_schedules, automation_executions, automation_step_executions, automation_execution_attempts, automation_execution_errors, automation_variables, automation_policies, automation_approval_references, automation_compensation_references | Core versioned workflow/execution persistence plus CapabilityRegistry-backed idempotent execution implemented; durable schedule polling, ISO-8601 recurrence/misfire handling and scheduled action execution run from Worker scheduler |
| Integration | integration_providers, integration_accounts, integration_webhooks, integration_sync_jobs, integration_external_references | Core external account/webhook/sync/reference persistence implemented; provider adapters and durable sync workers remain |
| Case & Support Operations | cases, case_types, case_queues, case_assignments, case_participants, case_events, case_notes, case_evidence_references, case_links, case_escalations, case_resolutions, case_slas, case_actions, case_templates | Core case lifecycle/assignment/escalation/resolution persistence implemented; SLA breach worker, first-response event, CaseAction approval/completion routes and CapabilityRegistry-backed execution worker are live; external queue/provider integrations remain |
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

The logical model contains AttributeDefinition and AttributeValue semantics.

**Decision:** migration 0016 implements the canonical reusable Attribute vocabulary, and migration 0017 adds the canonical typed AttributeValue storage. product_variants.attributes_json remains authoritative during this expand phase. Do not dual-write or dual-read it until an explicit backfill, conflict-resolution and repository cutover migration is defined. Do not create parallel product_attributes, service_attributes or product_variant_attributes tables.

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

Migration 0017 deliberately established the reusable AttributeValue tables without immediately replacing legacy variant JSON. Migration 0063 now performs the fail-closed JSON validation/backfill and repository cutover. `attribute_values` and `attribute_value_options` are authoritative for variant attributes; `product_variants.attributes_json` is retained only as a retired, non-writable compatibility column and is cleared during cutover.

## 3.11 Catalog Attribute values — 0017

Migration 0017 adds \`attribute_values\` and \`attribute_value_options\` as the canonical typed AttributeValue storage layer.

The storage is intentionally staged: existing \`product_variants.attributes_json\` remains the active value path. No backfill is attempted because arbitrary JSON keys cannot be safely mapped to canonical AttributeDefinitions without an explicit mapping contract.

The supported target types are currently product, product_variant and service. Adding more targets requires a contract update. Multi-enum values use a parent AttributeValue plus child option rows, while enum values use a single option_id.


## 3.12 Customer core — 0018

Migration 0018 establishes `customers` and `customer_preferences`.

Customer is distinct from User. Identity remains authoritative for authentication/account state; Customer is the marketplace representation scoped to an Organization. A guest Customer has no user mapping.

Preference records retain source, confidence, persistence and consent scope; they are not AI memory or communication consent authority.

## 3.13 CRM customer relationships — 0019

Migration 0019 establishes `customer_relationships` as the canonical Customer↔Business relationship table. Relationship status follows the Customer data contract (prospect, active, inactive).

The database rejects cross-organization Customer/Business relationships. CRM remains the owner of relationship workflows and does not duplicate booking, commerce, communication or reputation truth.

## 3.14 CRM Timeline events — 0020

Migration 0020 implements \`crm_timeline_events\` as the canonical CRM timeline event store.

The table stores normalized event references rather than duplicating source-domain facts. Idempotency is based on \`source_module + source_event_id\`. Scope is validated against the Customer relationship and Business workspace.

\`crm_timeline_projections\` remains intentionally unimplemented. Its physical read-model fields, rebuild semantics and projection ownership are not sufficiently specified to justify another table.

## 3.15 Trust VerificationCase / evidence — 0021

Migration 0021 implements \`verification_cases\` and \`verification_documents\`.

\`verification_cases\` stores the verification workflow aggregate, subject reference/type, evaluated policy reference/version, risk class and lifecycle timestamps.

\`verification_documents\` stores protected evidence metadata and an object-storage reference; binary evidence remains outside D1. The table intentionally does not model policy/requirement ownership or decision history.

Verification requirement, check and decision tables remain gated because their dependency contracts require additional canonical policy/reference definitions and immutable decision semantics.
## 3.16 Trust policy / requirement / check / decision chain — 0022–0024

Migrations 0022–0024 complete the core verification decision chain without creating a boolean verification flag.

- 0022: versioned policies and requirements.
- 0023: evaluation checks and evidence links.
- 0024: append-only decisions and supporting-check links.

The chain is policy/version scoped and enforces subject/case compatibility at the database boundary. Reviewer assignment and expiry workflows remain separate contracts.
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

The search_index_versions contract is implemented in migration 0054; Discovery now persists index generations, active-generation lifecycle, query traces and evaluation evidence.

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

The database is broad but not yet production-complete.

The accurate state is:

```
190 physical tables defined across 56 ordered migrations
        ↓
core foundation + identity + business + catalog + media + discovery
+ seller AI + customer/CRM + trust + booking + commerce + billing
+ communication + automation + AI Runtime + integration + privacy
+ Demand/Matching + reviews + Fulfillment + Case Support are physically implemented
        ↓
remaining work is primarily operational execution, derived projections,
provider adapters, lifecycle workers and a small set of explicitly gated contracts
        ↓
new migrations must follow ownership + no-duplication gates
```

## 8. Next database implementation order

The remaining implementation work is operational/provider/projection work; Catalog AttributeValue cutover is closed by migration 0063.

1. Keep CRM timeline projections gated until projection rebuild/read-model contracts are explicit; CustomerProfile is a logical aggregate over existing Customer-owned records and requires no standalone table.
2. Complete Booking availability calculation and slot-generation semantics; transactional finalization/capacity guards are implemented in 0046–0047.
3. Complete remaining Billing provider adapters/reconciliation workers and ledger/provider operational gates; invoice, refund accounting, settlement and reconciliation are now implemented.
4. Continue the remaining Automation, Integration, Privacy, Communication, AI, Matching, Localization, Documents and Analytics operational/contract gates without introducing duplicate sources of truth.
5. Communication external provider-adapter contracts and scoped dispatch rate-limit/anomaly controls are implemented; intent/consent/suppression policy and required-message exception semantics are implemented. Provider credentials remain runtime-only.
6. Scheduled Automation polling/misfire execution and CapabilityRegistry-backed scheduled action execution are implemented; capability compensation remains only where a concrete rollback contract exists.
7. AI Runtime durable worker scheduling and Seller AI input/payload resolution are implemented; add resolvers only when a new AI operation type is introduced.
8. Integration provider adapter runtime, credential resolver contract, configurable HTTP adapter and signed webhook verification are implemented; concrete vendor onboarding and any provider-specific retention/reconciliation semantics remain external operational work.
9. Privacy export/delete/retention processors are implemented for the canonical Customer domain; future domains require their own domain-owned processor contract. Approved-request orchestration, subject-level identity validation and consent expiry are implemented.
10. Matching learning signals and broader Act outcome integration are complete; core retrieval/ranking/Connect execution is implemented.
11. Complete Fulfillment provider-specific adapters, callback reconciliation and durable polling only where an external provider contract exists; canonical tracking/service completion persistence is implemented.
12. Business lifecycle vocabulary reconciliation is closed; do not introduce another Business status model.
13. Complete Case queue dispatch/provider integrations where explicit contracts exist; CaseAction capability execution is already implemented.
14. Add Localization/Documents and Analytics structures where their contracts are sufficiently explicit.

Every future step must use a new numbered module-owned migration and must preserve all prior migration IDs and checksums. Migrations 0043–0047 are integrity-only and add no tables; 0048 completes the Review-owned moderation/reputation projection layer; 0054 adds Discovery index generations and observability evidence; 0064 completes the TrustSignal/anti-abuse physical boundary.

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
- canonical API routes expose all frozen runtime capabilities that are intended for external use;
- CI and migration verification are green on the current main commit;
- tenant-isolation and integrity tests pass.

Until then, adding another generic database schema would create unnecessary divergence.



### Billing invoice reconciliation — 2026-09-24

Billing invoice financial truth is now physically implemented by migration `0060_billing_invoice_system.sql`: `billing_invoices`, `billing_invoice_lines`, and `billing_invoice_payment_applications`. No parallel Commerce invoice table is authorized. Commerce invoice commands remain orchestration/reference contracts against the Billing-owned aggregate.

Billing invoice API surface: `GET /api/v1/billing/invoices` is now exposed through the canonical Billing invoice repository with `billing.invoice.read` authorization and tenant/workspace-scoped filtering.

### Payment provider adapters — 2026-09-24

The provider-execution boundary is implemented in `packages/billing/src/payment-provider-adapter.ts` and `payment-provider-service.ts`. It uses the existing `billing_provider_refs` table for normalized external references; no provider secrets are added to the database. Webhook signature validation, replay-age checks, normalized event parsing, idempotency propagation and transient/permanent failure classification are implemented.

### Settlement reconciliation — 2026-09-24

Migration `0061_billing_settlement.sql` establishes the settlement aggregate and immutable settlement-item ledger boundary. Provider payout execution is normalized through `PaymentProviderAdapter.payoutSettlement`, while accounting is posted through the existing immutable Billing ledger. No Commerce settlement table is permitted.

### Reconciliation hardening — migration 0062

The existing `billing_reconciliation_cases` contract is now operationally complete. Migration `0062_billing_reconciliation_hardening.sql` adds financial mismatch fields, scope, idempotency, resolution ownership and an immutable case-event history. Reconciliation is an exception-management boundary: it does not mutate payment, invoice, refund or settlement truth to conceal a mismatch.

### Matching Act outcome integration — 2026-09-24

Migration `0071_matching_act_outcome_links.sql` adds optional MatchRequest/Candidate references to Booking and Commerce authoritative records. `MatchingOutcomeProcessor` consumes existing outbox events for completed/cancelled bookings, completed orders, payment-completion events and fulfillment completion, resolves the linked MatchRequest/Candidate without guessing ambiguous candidates, and records the result through the existing append-only `match_learning_signals` boundary. No parallel Learning store was introduced.
