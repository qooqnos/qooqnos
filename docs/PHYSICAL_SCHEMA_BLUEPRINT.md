# Phoenix Physical Schema Blueprint

**Status:** Canonical architecture contract
**Scope:** Physical relational data dictionary and schema gates derived from the reconciled logical model.

This document is the bridge between the logical model and future module-owned migrations. It does not itself create tables or SQL. No physical table may be introduced unless its row shape, ownership, scope, lifecycle, constraints, retention, and source of truth are defined here or in an approved module-specific extension.

## 1. Non-negotiable physical rules

1. D1 is the transactional source of truth.
2. Every table has exactly one owning module.
3. Every primary key is an opaque immutable identifier; public IDs never encode tenant identity.
4. Canonical timestamps are UTC.
5. Money uses integer minor units plus ISO currency; never floating point.
6. Foreign keys enforce structural integrity; authorization and tenant policy are enforced above the database as required.
7. Cross-module physical FKs may exist for integrity, but cross-module business access is through capabilities.
8. Projection/search/embedding/analytics tables are rebuildable and never authoritative domain state.
9. Historical transaction snapshots are immutable after commit.
10. No table may become a second source of truth for an existing concept.

## 2. Canonical field contract

Every physical field must answer:

```text
name
logical type
nullable?
default
mutable?
unique?
indexed?
foreign key?
scope
classification
PII/sensitivity
encryption requirement
retention class
delete behavior
derived?
snapshot?
source of truth
owner
```

### Canonical physical types

| Domain type | Physical representation | Rule |
|---|---|---|
| EntityId | TEXT opaque | immutable, unique |
| Tenant/Organization/Workspace ID | TEXT | FK + scope validation |
| boolean | INTEGER/BOOLEAN | normalized consistently |
| integer | INTEGER | counts/minor units |
| decimal | INTEGER/DECIMAL according to bounded domain | never money float |
| timestamp | TEXT/INTEGER according to DB convention | UTC only |
| date | TEXT ISO date | no timezone semantics |
| JSON extension | TEXT JSON | only for flexible metadata, not core relational invariants |
| Money | amount_minor INTEGER + currency TEXT | paired fields |
| enum/state | TEXT | canonical state vocabulary only |
| Version | TEXT | explicit compatibility/version semantics |

## 3. Shared columns

Only where semantically applicable:

- `id` — opaque immutable ID.
- `created_at` — UTC creation timestamp.
- `updated_at` — UTC modification timestamp for mutable records.
- `created_by` / `updated_by` — actor reference when meaningful; not a replacement for audit.
- `version` — optimistic/concurrency or domain version only when the aggregate requires it.
- `metadata` — non-authoritative extension data only.

Do not blindly add `organization_id`, `workspace_id`, `created_by`, soft-delete flags, or metadata to every table. Scope follows ownership and authorization semantics.

## 4. Foundation / Identity / Access

| Table | Required canonical fields | Important constraints |
|---|---|---|
| `organizations` | `id`, `name`, `slug?`, `status`, timestamps | slug unique within required global/platform scope |
| `workspaces` | `id`, `organization_id`, `name`, `slug?`, `status`, timestamps | organization FK; slug unique within organization |
| `users` | `id`, identity status, timestamps | no email-as-primary-key; immutable ID |
| `user_profiles` | `user_id`, profile fields, locale/timezone?, timestamps | 1:1 User; personal fields classified |
| `external_identities` | `id`, `user_id`, provider, subject, timestamps | provider+subject unique; secrets not stored here |
| `sessions` | `id`, `user_id`, status, issued/expires/revoked timestamps | token material must be protected/hashed as appropriate |
| `memberships` | `id`, `user_id`, `organization_id`, `workspace_id?`, status, timestamps | valid org/workspace relationship; scoped uniqueness |
| `roles` | `id`, scope type, name, status | canonical role scope; no duplicate role semantics |
| `permissions` | `id`, stable permission key, description | permission key unique |
| `membership_roles` | `membership_id`, `role_id` | composite uniqueness |
| `role_permissions` | `role_id`, `permission_id` | composite uniqueness |

Membership is the only canonical User-to-tenant relationship. Direct user ownership FKs to organization/workspace are not canonical.

## 5. Business / Location

### `businesses`

Required:

```text
id
organization_id
workspace_id
name/display_name
status
publication_status
business_type?
primary_category_id?
default_locale?
timezone?
default_currency?
created_at
updated_at
```

Rules:

- Business belongs to exactly one Workspace.
- Organization must match Workspace organization.
- Lifecycle status and publication status are separate.
- Verification status is not duplicated as Business status.
- Owner is a relationship/permission concept, not a Provider entity.

### `business_status_history`

`id`, business_id, from_status?, to_status, changed_at, created_at.

Append-only history for the currently physical Business status vocabulary. It does not replace the authoritative `businesses.status` field.

### `business_profiles`

`business_id`, localized/public description, contact presentation, branding references, timestamps.

Do not store derived rating, trust score, search rank, or availability as authoritative columns.

### `locations`

`id`, `business_id`, display name, location type, timezone?, address fields/value, geo point?, status, timestamps.

`Location` is a domain record; `Address` and `GeoPoint` are shared value semantics and must not become competing Location entities.

## 6. Catalog / Taxonomy

### `categories`

`id`, parent_id?, scope, canonical key, status, timestamps.

Constraints:

- no self-parent;
- hierarchy cycles prohibited by domain validation;
- canonical key scoped according to taxonomy ownership.

### Catalog Attribute Vocabulary

#### `attribute_definitions`

Canonical, reusable platform attribute vocabulary.

Required physical fields:

`id`, canonical_key, name, description?, data_type, status, metadata_json?, created_at, updated_at.

Supported `data_type` values in the current physical contract:

`text`, `integer`, `number`, `boolean`, `date`, `datetime`, `enum`, `multi_enum`.

`canonical_key` is globally unique in the current platform-level vocabulary. Tenant-specific attribute vocabularies are intentionally not introduced until Category ownership/scope is represented physically.

#### `attribute_options`

Controlled values for `enum` and `multi_enum` attribute definitions.

Required fields:

`id`, attribute_definition_id, canonical_value, display_label, sort_order, status, metadata_json?, created_at, updated_at.

`canonical_value` is unique within one attribute definition.

#### `category_attributes`

Category-to-attribute applicability and presentation contract.

Required fields:

`id`, category_id, attribute_definition_id, is_required, is_filterable, is_searchable, is_variant_dimension, sort_order, constraints_json?, created_at, updated_at.

Uniqueness is enforced per category/attribute definition pair.

### `attribute_values`

Canonical typed AttributeValue records for supported Catalog targets.

Required fields:

`id`, attribute_definition_id, target_type, target_id, source_type, source_reference?, confidence?, option_id?, one typed scalar value channel where applicable, created_at, updated_at.

Current target types are intentionally limited to `product`, `product_variant` and `service`. A new target type requires an explicit contract update rather than a generic polymorphic expansion.

Typed scalar channels are:

- text_value
- integer_value
- number_value
- boolean_value
- date_value
- datetime_value

Enumerated attributes use `option_id`; multi-enum attributes use the child `attribute_value_options` relation.

Exactly one AttributeValue is permitted per attribute definition and target object. Multi-enum values are represented by one parent AttributeValue plus one or more option rows.

Source/provenance is part of the authoritative value record because AI-generated or extracted values require traceability.

### `attribute_value_options`

Child rows for `multi_enum` AttributeValues.

Required fields:

`id`, attribute_value_id, option_id, created_at.

The option must belong to the same AttributeDefinition as the parent value. The current schema enforces type compatibility at the database boundary.

### `business_categories` / `offering_categories`

Explicit junctions with stable IDs or composite uniqueness where the relationship has no independent lifecycle.

### `services`

`id`, business_id?, canonical name, description?, status, metadata, timestamps.

Service is the underlying definition; it is not a substitute for Offering.

### `products`

`id`, business_id, name, description?, status, timestamps.

### `product_variants`

`id`, product_id, SKU?, attributes, status, timestamps.

SKU uniqueness is scoped to Business unless an explicit platform-wide requirement exists.

### `offerings`

`id`, business_id, offering_type, title, description?, service_id?, product_id?, status, publication state, timestamps.

Rules:

- exactly one Business;
- optional typed reference to underlying Service/Product according to offering type;
- no generic polymorphic `sellable_id` unless an ADR proves it necessary;
- published Offering must satisfy publication policy.

### `prices`

`id`, offering_id, amount_minor, currency, pricing_type, effective_from, effective_to?, status, timestamps.

Historical pricing must remain reconstructable. Current-price shortcuts are projections/queries, not historical truth.

### `inventory_items`

`id`, product_variant_id, location_id, quantity_on_hand, quantity_reserved, version, timestamps.

Invariant: reserved quantity cannot exceed available stock; quantities cannot become negative.

## 7. Customer

### `customers`

`id`, organization_id, user_id?, status, created_at, updated_at.

A Customer may be a guest. `user_id` is an optional mapping, never the Customer identity itself.

### `customer_profiles`

`customer_id`, preferences/profile data, locale/timezone?, timestamps.

The profile shape remains intentionally open until its field-level contract is finalized. Do not create physical columns or JSON blobs merely to reserve this concept.

### `customer_preferences`

`id`, customer_id, attribute, value_reference, source, confidence?, persistence, consent_scope?, created_at, expires_at.

Preferences are distinct from AI memory and centralized consent authority. Source/confidence are provenance metadata and must not be interpreted as financial or identity truth.

### `customer_addresses`

`id`, customer_id, country_code, administrative_area?, locality?, district?, postal_code?, street_line_1?, street_line_2?, building_number?, unit?, formatted?, locale?, created_at, updated_at.

The stored fields implement the canonical structured Address value object from Architecture Gate 01. Address type/default semantics are not invented until their customer-specific contract is finalized.

### `customer_relationships`

`id`, customer_id, business_id, status, relationship type/source, timestamps.

One canonical relationship table; do not create separate CRM/partner/customer relationship tables for the same semantics.

## 7.1 CRM Timeline

### `crm_timeline_events`

Canonical normalized CRM event references consumed from the platform Outbox/event infrastructure.

Required fields:

`id`, organization_id, workspace_id, relationship_id, source_module, source_event_id, event_type, event_version, occurred_at, received_at, actor_reference?, visibility, redaction_class, payload_json?, projection_version.

Uniqueness is enforced on `source_module + source_event_id` for idempotent event consumption.

The relationship, organization and workspace scope must agree. The originating domain remains authoritative for the underlying business fact.

A separate `crm_timeline_projections` table is intentionally not physicalized yet because its read-model fields, rebuild contract and projection ownership are not sufficiently specified.

## 8. Booking / Availability

### `booking_status_history`

`id`, booking_id, from_status?, to_status, changed_at, created_at.

Immutable lifecycle history belongs to Booking and must not replace the authoritative current `bookings.status` field.

### `bookings`

Required canonical fields:

```text
id
organization_id
workspace_id
business_id
customer_id
status
currency
total_amount_minor?
policy_snapshot?
created_at
updated_at
state timestamps
```

`business_id` may be denormalized for security/query boundaries, but must equal the Business of all booked Offerings. It is not permission to bypass Catalog.

### `booking_items`

`id`, `booking_id`, `offering_id`, quantity, title_snapshot, price_minor_snapshot, currency_snapshot, duration_snapshot?, policy_snapshot?, timestamps/immutable commit metadata.

Historical fields become immutable after booking commit.

### `appointments`

`id`, `booking_id`, status, starts_at, ends_at, timezone context?, location_id?, timestamps.

Appointment is a scheduled occurrence. It is not the Booking aggregate replacement.

### `schedules`

`id`, business_id/location_id/resource_id?, timezone, recurrence definition, booking horizon, lead time, buffer configuration, status, version, timestamps.

### `availability_rules`

`id`, schedule_id, rule type, recurrence payload, start/end constraints, capacity, version, timestamps.

### `availability_exceptions`

`id`, schedule_id, effective interval/date, exception type, capacity/closure data, version, timestamps.

### `resources`

`id`, business_id, location_id?, resource_type, status, capacity, metadata, timestamps.

Resource taxonomy remains extensible; no Provider entity is introduced merely to represent staff.

### `booking_holds`

`id`, organization_id, workspace_id, business_id, resource_id?, slot_reference, actor_reference?, status, expires_at, created_at, updated_at.

A Hold is short-lived operational state. Active uniqueness is enforced at the business/resource/slot boundary; expired holds are reclaimable. Holds never become historical booking truth.

### `booking_status_history`

`id`, booking_id, from_status?, to_status, changed_at, created_at.

Append-only lifecycle history for Booking.

### `appointment_events`

`id`, appointment_id, event_type, event_version, payload_json?, occurred_at, created_at.

Appointment events are immutable history/evidence and do not replace Appointment current state.

### Slot

No authoritative `slots` table in the canonical first implementation. A materialized slot table is permitted only as a rebuildable optimization with schedule/version references, expiration/invalidation semantics, and no authority over booking truth.

## 9. Commerce / Financial history

Commerce physical persistence is module-prefixed to make ownership explicit and prevent collisions with Billing-owned financial tables.

### `commerce_carts`

`id`, organization_id, workspace_id?, customer_id?, actor_reference, status, currency, version, expires_at?, created_at, updated_at.

Cart is mutable intent. It never becomes historical transaction truth.

### `commerce_cart_lines`

`id`, cart_id, resource_type, resource_id, variant_reference?, quantity, selected_options_json?, source_reference?, created_at, updated_at.

Resource types are controlled; canonical Catalog resources remain authoritative.

### `commerce_checkout_sessions`

`id`, cart_id, status, idempotency_key, correlation_id, catalog_snapshot_refs_json?, promotion_qualification_refs_json?, loyalty_benefit_refs_json?, booking_reservation_refs_json?, payment_attempt_ref?, failure_code?, started_at, completed_at?, created_at, updated_at.

### `commerce_price_snapshots`

`id`, organization_id, workspace_id?, currency, line_snapshots_json, subtotal_minor, adjustment_total_minor, tax_total_minor, fee_total_minor, grand_total_minor, catalog_version_refs_json?, promotion_version_refs_json?, loyalty_version_refs_json?, policy_version, calculated_at, calculation_context_hash, created_at.

Price snapshots are immutable commercial evidence.

### `commerce_orders`

`id`, organization_id, workspace_id, business_id, customer_id, price_snapshot_id?, status, currency, subtotal_minor, adjustment_total_minor, tax_total_minor, fee_total_minor, grand_total_minor, payment_status_ref?, fulfillment_status_ref?, source_channel, policy_version, idempotency_key, correlation_id, created_at, updated_at, confirmed_at?, completed_at?.

Order is the canonical Commerce aggregate after checkout.

### `commerce_order_lines`

`id`, order_id, resource_type, resource_id, resource_version?, variant_reference?, description_snapshot, quantity, unit_price_minor_snapshot, line_subtotal_minor, line_adjustment_total_minor, line_total_minor, promotion_reference?, loyalty_reference?, booking_reference?, fulfillment_reference?, created_at, updated_at.

Historical values become immutable after the order commitment boundary.

### `commerce_order_adjustments`

`id`, order_id, order_line_id?, adjustment_type, source_module, source_reference, amount_minor, currency, policy_version, created_at.

### `commerce_transaction_attempts`

`id`, order_id, attempt_type, attempt_status, idempotency_key, provider_reference?, requested_at, completed_at?, failure_code?, correlation_id, created_at.

This is Commerce orchestration evidence, not the Billing/Payment financial ledger.

### `commerce_fulfillment_references`

`id`, order_id, order_line_id?, fulfillment_type, external_module, external_reference, status_reference?, created_at, updated_at.

External modules remain authoritative for fulfillment state.

### `commerce_cancellations`

`id`, order_id, requested_by, reason_code, policy_version, decision, effective_at, correlation_id, created_at.

Cancellation does not erase financial or Booking history.

### `commerce_refund_references`

`id`, order_id, requested_amount_minor, currency, reason_code, billing_reference, refund_status, requested_at, completed_at?, correlation_id, created_at.

Commerce references refunds; Billing/Payment executes and owns the financial outcome.

### `commerce_order_events`

`id`, order_id, event_type, event_version, tenant_id, workspace_id, actor_reference?, source, occurred_at, correlation_id, causation_id?, provenance_reference?, payload_reference?, created_at.

Order events are immutable Commerce history and publication evidence.

Payment, payment attempts, refund execution, invoices and subscription billing remain outside Commerce unless their canonical owner contract explicitly assigns a transaction reference surface.

## 10. Trust / Verification / Moderation

### `verification_cases`

`id`, organization_id, workspace_id?, subject_type, subject_id, policy_id, policy_version, status, risk_class, submitted_at?, resolved_at?, expires_at?, created_at, updated_at.

The subject model uses a controlled subject-type vocabulary; it is not an unconstrained generic polymorphic target.

### `verification_documents`

`id`, case_id, evidence_type, storage_reference, content_hash, issuer?, submitted_at, expires_at?, processing_status, classification, provenance, retention_policy, created_at, updated_at.

Raw evidence belongs in protected storage; D1 stores metadata and an opaque storage reference.

### `verification_policies`

`id`, version, jurisdiction?, industry?, subject_type, risk_class, effective_from?, effective_to?, human_review_rules?, expiry_rules?, status, created_at, updated_at.

Active policy versions are immutable.

### `verification_requirements`

`id`, policy_id, policy_version, subject_type, jurisdiction?, industry?, requirement_type, required, evidence_types, human_review_required, effective_from?, effective_to?, expiry_rule?, created_at, updated_at.

A Requirement belongs to one immutable Policy version.

### `verification_checks`

`id`, case_id, requirement_id, check_type, method, result, confidence?, reviewer_id?, policy_version, performed_at, created_at, updated_at.

Checks are evaluations, not final verification decisions.

### `verification_check_documents`

`check_id`, document_id, created_at.

The linked document must belong to the same VerificationCase as the Check.

### `verification_decisions`

`id`, case_id, requirement_id, outcome, actor_type, actor_id?, rationale_reference, policy_version, decided_at, created_at.

Decisions are append-only historical facts; corrections create a new Decision.

### `verification_decision_checks`

`decision_id`, check_id, created_at.

The linked Check must belong to the same VerificationCase as the Decision.

### `verification_reviews`

`id`, case_id, reviewer_id, status, assigned_at, completed_at?, review_outcome?, escalation_reason?, created_at, updated_at.

Reviewers remain authorized by the centralized Authorization module; Trust does not grant reviewer permissions.

### `verification_expiries`

`id`, case_id, requirement_id, evidence_id?, expires_at, detected_at, reevaluation_status, resulting_decision_id?, created_at, updated_at.

Expiry records trigger policy re-evaluation. They are operational Trust records, not a replacement for immutable Decisions.

### `reviews`

`id`, organization_id, workspace_id?, customer_id, rating_value, content?, moderation_state, business_id?, offering_id?, booking_id?, appointment_id?, service_id?, product_id?, location_id?, created_at, updated_at.

The Review has exactly one canonical typed target from the approved target matrix. Review rows never duplicate target-domain truth.

### `moderation_cases`

`id`, subject reference, status, policy/version, opened/resolved timestamps.

Polymorphic moderation subjects are allowed only under the controlled polymorphism contract.

## 11. Communication

### `communication_conversations`

`id`, organization_id, workspace_id?, customer_id?, status, created_at, updated_at.

### `communication_messages`

`id`, conversation_id, sender_reference, content, classification, status, created_at, updated_at.

### `communication_notifications`

`id`, organization_id, workspace_id?, recipient_reference, intent, channel, template_reference?, template_version?, locale?, variables_json?, priority, status, idempotency_key, scheduled_at?, expires_at?, last_policy_evaluated_at?, created_at, updated_at.

Notification idempotency is unique within Organization scope.

### `communication_delivery_attempts`

`id`, notification_id, provider, channel, status, attempted_at, provider_reference?, retry_count, next_retry_at?, failure_code?, failure_class?, metadata_json?, created_at.

Communication owns delivery state and attempt history. Provider-specific credentials and secrets remain outside domain rows.

Communication owns delivery behavior; domain modules only emit canonical events/capabilities.

## 12. AI / Automation

### `agents`

`id`, workspace scope, name, status, model reference, safety policy reference, configuration, timestamps.

### `ai_conversations` / `ai_messages`

AI-specific context and messages. They are distinct from Communication Conversation/Message.

### `ai_runs`

`id`, agent_id?, ai_conversation_id?, status, model/version, prompt_version?, policy_version?, correlation/request IDs, usage/cost fields, timestamps.

### `ai_tool_calls`

`id`, ai_run_id, capability_id/version, status, input/output references or redacted payload, timestamps.

Tool records reference Capability contracts; they never own domain behavior.

### `ai_memories`

`id`, owner scope, content/reference, provenance, consent reference?, retention/expiry, classification, timestamps.

Memory is never authoritative Business/Booking/Commerce state.

### `workflows`, `workflow_triggers`, `workflow_actions`, `workflow_executions`

Workflow definitions reference canonical event/capability identifiers, never implementation class names or repositories.

## 13. Billing / Media / Integration / Platform

### Billing

### `billing_plans`

`id`, plan_key, name, description?, status, created_at, updated_at.

### `billing_prices`

`id`, plan_id, currency, amount_minor, billing_interval, effective_from, effective_to?, tax_treatment_reference?, provider_price_reference?, created_at, updated_at.

### `billing_plan_entitlements`

`id`, plan_id, entitlement_key, value_type, value_json, version, created_at, updated_at.

### `billing_subscriptions`

`id`, organization_id, workspace_id?, business_id, plan_id, billing_price_id, status, starts_at, trial_ends_at?, current_period_start, current_period_end?, grace_until?, cancelled_at?, expires_at?, version, created_at, updated_at.

### `billing_subscription_events`

`id`, subscription_id, from_status?, to_status, event_type, source, actor_reference?, provider_event_reference?, occurred_at, correlation_id, created_at.

### `billing_usage_meters`

`id`, meter_key, unit, aggregation, period_type, hard_limit?, status, created_at, updated_at.

### `billing_usage_events`

`id`, organization_id, workspace_id?, business_id?, meter_id, source_event_id, quantity, period_start?, period_end?, occurred_at, correlation_id, metadata_json?, created_at.

### `billing_usage_counters`

`id`, organization_id, workspace_id?, business_id?, meter_id, period_key, quantity, version, updated_at.

Counters are enforcement state for concurrency-safe hard quotas; usage events remain the historical meter input.

### `billing_entitlement_snapshots`

`id`, subscription_id, entitlement_key, value_type, value_json, source_plan_id, source_plan_version, effective_from, effective_to?, created_at.

### `billing_provider_refs`

`id`, organization_id, workspace_id?, business_id?, provider, reference_type, external_reference, status, metadata_json?, created_at, updated_at.

### `billing_reconciliation_cases`

`id`, organization_id, provider, reference_type, external_reference?, local_reference?, status, category, details_json?, opened_at, resolved_at?, created_at, updated_at.

Billing owns commercial entitlement and usage authority. Payment execution, invoices and financial ledger remain gated until their provider/legal contracts are explicit.

### Media

`media_assets`: owner/scope, storage key, checksum, MIME/type, size, classification, status, timestamps.

`media_variants`: source asset, variant type, storage key, processing status, checksum.

`media_attachments`: media_asset_id + typed supported resource relationship; generic polymorphism only under the media attachment contract.

### Integration

`integrations`, `external_accounts`, `webhooks`, `sync_jobs`, `external_references` contain provider references and lifecycle state, not domain ownership.

### Platform

`modules`, `module_versions`, `tenant_modules`, `feature_flags`, `audit_events`, `idempotency_records`, `outbox_events` are platform-owned operational/foundation records. They must not be duplicated by domain modules.

## 14. Scope matrix

| Scope | Typical owners | Storage rule |
|---|---|---|
| GLOBAL | User, Organization, Module, Permission | no tenant FK unless independently required |
| ORGANIZATION | Workspace, tenant configuration, subscriptions | organization_id required |
| WORKSPACE | Business, Agent, Workflow, many operational records | workspace_id + organization derivation/validation |
| BUSINESS | Offering, Location, business configuration | business_id; tenant derived/validated |
| USER | User profile/session | user_id |
| CUSTOMER | Customer profile, booking history | customer_id + tenant boundary |
| PUBLIC | published discovery projection | no private write authority |

Do not mechanically store every ancestor scope on every table. Denormalize only when it materially improves tenant enforcement/query boundaries and maintain explicit invariants.

## 15. Index / uniqueness policy

Required index classes:

- every PK;
- every FK used for joins or authorization;
- scoped lookup keys used by capabilities;
- lifecycle/status queries where operationally justified;
- effective-date queries for prices/schedules;
- idempotency lookup keys;
- outbox publication state;
- external provider identity keys.

Required uniqueness examples:

- external provider + subject;
- membership scoped to user/org/workspace;
- role/permission junctions;
- business/category and offering/category junctions;
- idempotency actor+scope+key;
- outbox event ID;
- external reference within its provider/integration scope.

Uniqueness must not accidentally prevent legitimate multi-tenant reuse.

## 16. Deletion / retention policy

Default policy by class:

| Data | Default behavior |
|---|---|
| Identity/security history | restrict/retention controlled |
| Membership | soft lifecycle, historical retention |
| Business/catalog | archive/soft lifecycle |
| Booking/order/payment/invoice | immutable historical retention; restrict deletion |
| Verification evidence | protected retention/expiry, legal policy |
| Reviews | moderation/archive policy |
| AI memory | explicit expiry/deletion policy |
| Sessions | expiry/hard deletion where safe |
| Outbox/idempotency | operational retention |
| Projections | rebuildable deletion/rebuild |

No deletion policy may silently violate audit, legal retention, or historical financial requirements.

## 17. Derived and snapshot rules

A field is **derived** only when its source, owner, rebuild strategy, and staleness semantics are documented.

A field is a **snapshot** only when it preserves historical meaning at a transaction boundary and becomes immutable at the defined point.

Forbidden pattern:

```text
mutable catalog.price
      ↓
reconstruct yesterday's order
```

Required pattern:

```text
order_item.unit_price_snapshot
      ↓
historical truth
```

## 18. Physical schema gate

A future migration may create a table only after this checklist is complete:

- canonical domain term exists;
- owner module exists;
- aggregate/relationship role defined;
- source of truth defined;
- tenant scope defined;
- PK/FK/UNIQUE strategy defined;
- lifecycle defined;
- invariant enforcement layer defined;
- PII/classification defined;
- retention/delete policy defined;
- derived/snapshot fields identified;
- indexes justified;
- capability contract identified for every mutation;
- event/audit semantics identified;
- migration dependency and rollback/recovery strategy defined;
- no existing table/capability already owns the same fact.

## 18. Privacy / Consent

### `privacy_consents`

`id`, organization_id, workspace_id?, subject_type, subject_id, purpose, consent_version, status, source, evidence_reference?, granted_at?, revoked_at?, expires_at?, created_at, updated_at.

There is at most one active granted consent for a subject/purpose within an organization.

### `privacy_requests`

`id`, organization_id, workspace_id?, subject_type, subject_id, request_type, status, requested_by, requested_at, due_at?, completed_at?, result_reference?, rejection_reason?, created_at, updated_at.

Requests are explicit workflow records for access/export/delete/restrict/correct actions.

### `privacy_processing_records`

`id`, request_id, module_id, action, resource_reference?, status, error_reference?, processed_at?, created_at.

Processing records provide module-level auditability for privacy requests without making Privacy a copy of domain data.

## 18.1 Demand / Matching

### `demand_requests`

`id`, organization_id, workspace_id?, customer_id?, source_channel, status, raw_input_reference?, locale?, normalized_demand_json?, confidence?, created_at, updated_at.

Demand request is the canonical customer-demand intake record.

### `demand_profiles`

`id`, demand_request_id, version, profile_json, confidence?, provenance_json?, status, created_at, updated_at.

DemandProfile versions are the normalized representation used by matching; raw input remains in the Demand Request.

### `match_requests`

`id`, demand_request_id, organization_id, workspace_id?, algorithm_version, policy_version, status, requested_at, completed_at?, created_at, updated_at.

A MatchRequest records one execution intent against a specific demand version/context.

### `match_candidates`

`id`, match_request_id, business_id? XOR offering_id?, retrieval_source, retrieval_score?, ranking_score?, rank_position?, eligibility_status, reasons_json?, feature_snapshot_json?, created_at.

Candidates reference canonical Business/Offering authority; Matching never copies supply truth.

### `match_decisions`

`id`, match_request_id, candidate_id, decision, reason_code?, decision_source, policy_version, actor_reference?, decided_at, created_at.

Match decisions are immutable historical decisions.

## 19. Explicit gates still open

The following remain controlled architecture gates before their concrete SQL migrations:

1. CustomerProfile field-level contract.
2. CRM timeline projection read-model/rebuild contract.
3. Tax/discount transaction snapshot semantics beyond the existing Commerce ownership decision.
4. Payment provider reference contract.
5. Search/vector projection versioning/storage details.
6. AI Memory physical storage/retention contract.
7. Integration/Webhook/Sync retention and retry details.
8. Communication consent/policy/template registry and provider adapter contracts.
9. Business conceptual lifecycle vocabulary reconciliation.
10. Booking availability calculation, hold consumption and atomic finalization contract.
11. Review physical target implementation beyond the canonical typed-target matrix.
12. Matching retrieval/ranking/learning execution contracts where they require additional derived projections.

These are controlled architecture gates, not provisional implementation instructions.

## 20. Definition of Done

The physical data model is architecture-complete when every planned physical table can be generated from this blueprint without inventing a new concept, scope, source of truth, ownership rule, lifecycle, or business invariant during migration design.
