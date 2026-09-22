# Phoenix Database Model — Canonical Data Model

**Status:** Canonical architecture contract

This document defines the logical source-of-truth model. It is broader than the migrations currently implemented. A logical entity becomes physical schema only when its owning module is implemented through a versioned migration.

## 1. Global invariants

- D1 is the relational source of truth.
- Public identifiers are opaque and must not encode tenant identity.
- Tenant-owned records carry `organization_id`; workspace-scoped records also carry `workspace_id`.
- Cross-tenant access is denied server-side; URL/UI identifiers are never an isolation boundary.
- Canonical timestamps are UTC ISO-8601 values.
- Money is integer minor units plus ISO currency code.
- Mutable domain state is changed through commands/state transitions, not arbitrary status writes.
- Sensitive/regulated data is isolated, classified, least-privilege and audited.
- Every schema change is a numbered migration.
- Derived indexes, embeddings, caches and analytics are disposable projections, never authoritative records.
- Foreign keys and uniqueness constraints enforce invariants where D1 permits them; application policy enforces cross-row/domain rules.

## 2. Tenant hierarchy

```text
Organization (tenant)
 ├── Workspace
 │    ├── Membership
 │    ├── Business
 │    │    ├── Location
 │    │    ├── Service / Product
 │    │    └── Verification
 │    └── tenant configuration
 └── tenant-wide configuration / billing / modules

User
 ├── Identity / session
 ├── Memberships
 ├── Customer profile(s)
 ├── Consents
 └── Audit actor
```

`organization` is the primary security tenant. `workspace` is the operational scope. A user can belong to multiple organizations/workspaces.

## 3. Identity and tenancy domain

| Entity | Canonical responsibility | Scope |
|---|---|---|
| `users` | platform identity subject | global |
| `user_profiles` | user-facing profile attributes | user |
| `sessions` | authenticated session lifecycle | user |
| `external_identities` | external identity/provider mapping | user |
| `organizations` | tenant boundary | global |
| `workspaces` | operational boundary | organization |
| `memberships` | user ↔ organization/workspace relationship | tenant |
| `roles` | named RBAC role | tenant/platform |
| `permissions` | atomic capability | platform |
| `role_permissions` | role → permission | platform/tenant |
| `membership_roles` | membership → role | tenant |

Membership status is explicit: `invited`, `pending`, `active`, `suspended`, `removed`.

## 4. Business supply domain

### Business aggregate

`businesses` is the aggregate root for marketplace supply identity and lifecycle.

Recommended fields:

```text
id
organization_id
workspace_id
owner_membership_id / owner_user_id
legal_name
display_name
business_type
primary_category_id
description
country_code
default_locale
timezone
currency
status
publication_status
created_at
updated_at
```

Business status and verification status are separate concepts.

### Supporting entities

- `business_categories`: many-to-many category classification.
- `business_locations`: physical/service locations; includes address and geo representation.
- `business_contacts`: phone/email/contact-channel records.
- `business_hours`: recurring and exceptional operating hours.
- `business_social_links`: external public links.
- `business_languages`: languages supported by the business/team.
- `business_status_history`: immutable lifecycle transition history.
- `business_service_settings`: business-level catalog/booking configuration.

### Lifecycle

```text
draft → submitted → under_review → approved → active
                  ├→ needs_changes → draft
                  └→ rejected
active → suspended / expired / archived
```

Publication eligibility is a policy decision, not a synonym for `status = active`.

## 5. Taxonomy and catalog domain

### Taxonomy

- `categories`: hierarchical marketplace taxonomy.
- `category_translations`: localized labels/descriptions.
- `category_attributes`: typed attributes valid for a category.
- `attribute_definitions`: reusable platform attribute vocabulary with typed semantics.
- `attribute_options`: controlled values for `enum` and `multi_enum` attributes.
- `category_attributes`: category applicability, requirement, filtering, search and variant-dimension metadata.
- `attribute_values`: typed AttributeValue records for supported catalog targets with provenance.
- `attribute_value_options`: multi-enum option membership for an AttributeValue.

The current physical implementation establishes the Attribute vocabulary in migration 0016 and typed AttributeValue storage in migration 0017. The 0017 storage is an expand-only layer: `product_variants.attributes_json` remains the active authoritative value path until an explicit backfill/conflict-resolution/cutover contract is implemented.

### Services

- `services`: canonical underlying service definition/template; it may be reusable globally or business-specific through its nullable `business_id`.
- `offerings`: business-owned, customer-facing offer of a Service or Product.
- `service_attributes`: future structured service attributes once their canonical ownership is finalized.
- `service_durations`: future duration data where required by the booking model.
- `service_availability_rules`: future constraints used by booking/discovery.

There is no canonical `business_services` table. A business-specific service configuration must extend the existing Service/Offering model through an explicit architecture decision rather than duplicating the relationship.

### Products

- `products`: canonical product entity.
- `product_variants`: sellable variants/SKU-level attributes; current physical attributes are stored in `attributes_json`.
- `product_attributes`: future structured product attributes only after the canonical attribute model is finalized.
- `inventory_items`: current physical stock/availability records.
- Pricing is owned by the shared `prices` table through the owning `offering`; do not create `product_prices` as a parallel source of truth.

Offer-level pricing is canonical: the physical `prices` table is the single source of truth for current and historical price records attached to customer-facing Offerings.

Catalog item lifecycle is explicit:

```text
draft → review → published → paused → archived
```

## 6. Media domain

- `media_assets`: source object metadata and ownership.
- `media_variants`: generated sizes/formats.
- `media_links`: typed relation from media to domain resource.
- `media_processing_jobs`: asynchronous processing state.

Binary content belongs in R2. D1 stores metadata, ownership, classification, checksum, processing state and references. Protected evidence must never use public profile URLs.

## 7. Customer and trust domain

- `customers`: tenant-scoped customer representation.
- `customer_profiles`: customer preferences/profile data.
- `reviews`: customer feedback against eligible supply.
- `review_replies`: business responses.
- `review_moderation`: moderation outcome/signals.
- `trust_signals`: derived quality indicators with provenance/version.

Reviews and trust signals are not authoritative verification evidence.

## 8. Booking and availability domain

- `appointment_slots`: bookable availability projections/rules.
- `appointments`: booking aggregate.
- `appointment_participants`: participants/actors.
- `appointment_events`: immutable lifecycle events.
- `availability_rules`: recurring/exception rules.
- `resources`: staff/location/resource constraints where required.

Appointment lifecycle is explicit, for example:

```text
requested → held → confirmed → completed
                         ├→ cancelled
                         └→ no_show
```

Availability must be resolved from current domain state; AI output is never authoritative availability.

## 9. Verification and compliance domain

Verification is a case/check/decision system, not a boolean.

- `verification_cases`: aggregate for a verification workflow.
- `verification_policies`: immutable policy versions.
- `verification_requirements`: policy-defined requirements.
- `verification_documents`: protected evidence metadata/reference.
- `verification_checks`: evaluation of one requirement.
- `verification_check_documents`: controlled evidence links for checks.
- `verification_decisions`: immutable reviewer/system decisions.
- `verification_decision_checks`: supporting-check links.

The core Trust chain is now physically implemented through migrations 0021–0024. Verification reviewer assignment, expiry workflow, trust signals and historical event projection remain separate capabilities.

Example check types:

```text
identity
ownership
location
professional_credential
catalog_completeness
content_policy
compliance
```

Evidence binary data is in protected R2; D1 stores metadata/reference/checksum/expiry/classification/retention metadata.

## 10. Discovery and search projections

The source of truth remains Business/Catalog/Verification data. Discovery owns derived records such as:

- `search_documents`
- `search_index_versions`
- `embedding_records`
- `ranking_features`
- `indexing_jobs`

Every projection records resource ID, module, tenant/workspace scope, visibility, locale, source version and indexed timestamp.

Only eligible published records may be indexed.

## 11. User request and matching domain

- `user_requests`: normalized representation of a customer's marketplace need.
- `match_runs`: immutable/versioned execution metadata.
- `match_results`: candidate scores/signals/explanations for a run.
- `match_constraints`: hard constraints extracted from a request.
- `match_preferences`: softer preferences with provenance.

Pipeline:

```text
natural language
→ intent
→ hard constraints
→ candidate retrieval
→ semantic retrieval
→ availability
→ quality/trust
→ ranking
→ policy filter
→ explanation
```

Hard constraints eliminate candidates; semantic similarity never overrides them.

## 12. AI domain

AI has two distinct but connected storage layers:

### 12.1 AI interaction/orchestration data

- `ai_conversations`: AI interaction context.
- `ai_messages`: ordered AI conversation messages.
- `agents`: Agent definition/configuration.
- `ai_memories`: explicitly approved durable AI memory with provenance/retention.
- Agent-run/step/tool-invocation concepts are orchestration evidence and map to the canonical AI vocabulary defined by `AI_DATA_DICTIONARY.md`.

### 12.2 Canonical AI Runtime data

The Runtime is the sole model execution boundary. Runtime data must use the canonical objects from `AI_RUNTIME_DATA_DICTIONARY.md`, including:

- `ai_operation_types`: semantic operation taxonomy/version.
- `ai_operations`: operation identity, tenant/actor context, lifecycle, idempotency and execution references.
- `ai_models`: approved model registry records.
- `ai_providers`: provider registry records.
- `ai_model_routing_decisions`: reproducible model/provider selection evidence.
- `ai_prompts` and `ai_prompt_versions`: versioned prompt registry.
- `ai_schemas` and `ai_schema_versions`: versioned output/input schema registry.
- `ai_policies`: AI policy registry/version metadata.
- `ai_policy_decisions`: policy decisions attached to execution.
- `ai_provider_attempts`: provider execution attempts.
- `ai_runtime_results`: normalized validated Runtime results.
- `ai_usage_records`: canonical Runtime usage telemetry.

These Runtime records are operational/execution state, not business-domain truth.

### 12.3 Important reconciliation rule

Legacy names such as `ai_runs`, `ai_tool_calls`, `ai_prompt_versions`, and `ai_usage_events` must not be interpreted as parallel canonical Runtime entities.

Where a physical migration needs AI execution storage, it must map to the canonical Runtime objects and relationships rather than create duplicate tables with overlapping semantics.

Conceptually:

```text
AI Capability / Agent
      ↓
ai_operation
      ↓
Prompt + Schema + Policy + Routing Decision
      ↓
Provider Attempt(s)
      ↓
ai_runtime_result
      ↓
ai_usage_record
```

Tool invocation and Agent Step evidence may reference Runtime operation/result IDs; they do not become a second execution ledger.

## 13. Moderation, consent and privacy

- `moderation_cases`: policy/moderation workflow.
- `moderation_actions`: immutable decisions/actions.
- `consent_records`: explicit consent state and version.
- `privacy_requests`: access/deletion/retention workflow.
- `data_classifications`: classification metadata/policy.
- `retention_policies`: retention rules by resource/data type.

Medical/regulated information requires stronger classification, consent, access controls and auditability.

## 14. Billing and entitlements

- `plans`: commercial plan definitions.
- `plan_entitlements`: capability/quota definitions.
- `subscriptions`: tenant/user subscription state.
- `subscription_events`: immutable billing lifecycle events.
- `usage_events`: metered usage.
- `invoices`: financial document metadata.
- `invoice_lines`: billable components.

Money is never represented as floating point.

## 15. Platform/module domain

- `modules`: installed module metadata/version.
- `module_versions`: migration/runtime compatibility versions.
- `tenant_modules`: tenant enablement/configuration.
- `feature_flags`: controlled rollout state.
- `audit_events`: security/business audit trail.
- `idempotency_records`: idempotent command state.
- `outbox_events`: reliable domain-event publication state.

## 16. Event relationships

```text
Domain command
   ↓
D1 transaction
 ├── source-of-truth mutation
 ├── audit event
 └── outbox event
          ↓
       Queue
          ↓
 derived projections / notifications / analytics / indexing
```

Outbox events are versioned, tenant-aware, idempotent and retryable.

## 17. Cross-module ownership

| Module | Owns | Must not directly own/query |
|---|---|---|
| Identity/Tenancy | users, orgs, workspaces, memberships | business private tables |
| Business | business profile/lifecycle | verification evidence internals |
| Catalog | services/products/prices/inventory | identity internals |
| Media | media metadata/processing | business lifecycle decisions |
| Verification | requirements/checks/evidence/decisions | catalog internals |
| Discovery | derived search/index state | authoritative business state |
| Booking | appointments/availability | verification evidence |
| AI | agent/orchestration/runtime execution state | arbitrary domain writes |
| Billing | plans/subscriptions/usage | domain authorization decisions |
| Moderation | cases/actions/policy outcomes | raw business ownership data |

Cross-module interaction uses application services, typed contracts and versioned events.

## 18. Indexing and uniqueness principles

Minimum invariants include:

- membership uniqueness per user/organization/workspace;
- role/permission uniqueness;
- one active/current subscription where business rules require it;
- opaque public IDs unique globally within their entity;
- business/category and catalog relationship uniqueness;
- review uniqueness according to configured review policy;
- idempotency key uniqueness within its actor/scope;
- outbox event IDs unique;
- verification requirement/check identifiers unique within their case/version;
- AI operation identity/idempotency uniqueness according to the canonical Runtime contract.

Exact indexes and foreign keys are defined by module migrations, not by this logical document alone.

## 19. Canonical naming

Database names use `snake_case`, plural table names, singular foreign-key semantics (`organization_id`, `workspace_id`, `business_id`).

Application/domain names use PascalCase entities and camelCase properties. Mapping belongs at repository boundaries.

## 20. Logical model completeness

The canonical domain inventory now covers:

`identity, tenancy, authorization, business, taxonomy, catalog, media, customer, trust, verification, moderation, discovery, search, matching, AI, booking, messaging, notification, CRM, loyalty, billing, analytics, localization, documents, PDF/printing, consent, privacy, audit, modules, feature flags`.

This is the **logical target model**. It does not claim that every entity above has already been physically migrated or implemented.
