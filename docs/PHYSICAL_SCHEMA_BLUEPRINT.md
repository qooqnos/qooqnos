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

### CustomerProfile logical aggregate

`CustomerProfile` is not a physical table. Its canonical representation is the existing Customer aggregate:

- `customers` owns lifecycle, locale, timezone and identity mapping;
- `customer_preferences` owns explicit/inferred preference records with provenance and consent scope;
- `customer_addresses` owns structured address records.

`CustomerProfile` is a read/write capability-level composition over those canonical records. A new physical profile table would duplicate Customer source-of-truth fields and is prohibited unless a future architecture decision introduces a genuinely distinct profile fact set.

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

### `crm_timeline_projections`

Rebuildable CRM timeline read model. One row maps to exactly one `crm_timeline_events` row; it is never authoritative domain state.

Required fields:

`id`, `organization_id`, `workspace_id`, `relationship_id`, `customer_id`, `business_id`, `timeline_event_id`, `source_module`, `source_event_id`, `event_type`, `event_version`, `occurred_at`, `received_at`, `actor_reference?`, `visibility`, `redaction_class`, `projection_version`, `projected_at`, `created_at`, `updated_at`.

Rules:

- `timeline_event_id` is unique and references the canonical event.
- customer/business keys are denormalized from the authoritative CRM relationship only for read performance.
- ordering is `occurred_at DESC, timeline_event_id DESC`.
- projection writes are idempotent and monotonic by `projection_version`.
- rebuild reads canonical timeline events plus authoritative relationship/customer/business scope; it never reads the projection as input.
- deletion/retention of canonical timeline events cascades to the derived projection.
- visibility and redaction class are inherited from the canonical event and remain subject to authorization at read time.

The canonical implementation contract is `docs/CRM_TIMELINE_PROJECTION_CONTRACT.md`.

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

### Booking finalization guard

Booking finalization uses the existing `bookings`, `booking_items`, `appointments`, `appointment_resources`, `booking_holds` and `resources` tables. Migration 0046 adds scoped Booking idempotency and capacity-finalization guards; migration 0047 re-checks capacity on appointment/resource mutations. No additional authoritative reservation table is permitted.

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

`id`, organization_id, workspace_id?, customer_id, rating_value, content?, moderation_state, business_id?, offering_id?, product_id?, created_at, updated_at.

The Review has exactly one canonical target: Business, Offering, or Product. Review rows never duplicate target-domain truth.

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

### `communication_intents`

`id`, intent_key, category, requires_opt_in, allowed_channels_json, policy_version, status, created_at, updated_at.

Intent is the canonical policy key. Unknown or retired intents are fail-closed.

### `communication_preferences`

`id`, organization_id, workspace_id?, recipient_reference, category, channel?, status, source, consent_reference?, effective_from, effective_to?, created_at, updated_at.

Preference history is recipient- and scope-aware. The latest applicable record wins.

### `communication_suppression_records`

`id`, organization_id, workspace_id?, recipient_reference, scope, category?, channel?, intent?, reason_code, source, applies_to_required, status, effective_from, expires_at?, created_at, updated_at.

Suppressions are explicit policy blocks independent from UI preference state. `applies_to_required` distinguishes global/optional suppression from explicitly required transactional/security traffic.

### `communication_policy_decisions`

`id`, notification_id, organization_id, workspace_id?, result, reason_code?, policy_version, preference_reference?, suppression_reference?, evaluated_at, created_at.

Every notification records the policy decision that authorized, denied, or suppressed delivery.

## 12. AI / Automation

### Automation

The canonical Automation physical boundary is migration 0036.

### `automation_workflows`

`id`, organization_id?, workspace_id?, business_id?, name, scope, status, active_version_id?, created_by, created_at, updated_at.

### `automation_workflow_versions`

`id`, workflow_id, version, definition_json, definition_hash, status, activated_at?, created_at.

### `automation_triggers`

`id`, workflow_version_id, type, event_type?, schedule_id?, command_capability?, enabled, created_at.

### `automation_conditions`

`id`, workflow_version_id, expression, evaluation_policy_version, created_at.

### `automation_actions`

`id`, workflow_version_id, capability, input_mapping_json, timeout_policy_json?, retry_policy_json?, approval_policy_json?, sequence, created_at.

### `automation_schedules`

`id`, organization_id?, workspace_id?, timezone, recurrence, start_at, end_at?, misfire_policy, enabled, next_run_at?, created_at, updated_at.

### `automation_executions`

`id`, workflow_id, workflow_version_id, trigger_id, organization_id?, workspace_id?, business_id?, status, input_reference?, correlation_id, trace_id, started_at?, completed_at?, created_at, updated_at.

### `automation_step_executions`

`id`, execution_id, step_id, status, sequence, input_reference?, output_reference?, started_at?, completed_at?, created_at, updated_at.

### `automation_execution_attempts`

`id`, step_execution_id, attempt_number, idempotency_key, status, error_reference?, started_at, completed_at?.

### `automation_execution_errors`

`id`, execution_id, step_execution_id?, attempt_id?, error_class, retryable, safe_message, provider_reference?, created_at.

### `automation_variables`

`id`, execution_id, variable_key, value_reference, classification, created_at.

### `automation_policies`

`id`, organization_id?, workspace_id?, policy_version, max_duration_seconds?, max_steps?, max_retries?, default_timeout_seconds?, max_concurrency?, allowed_capabilities_json, approval_requirements_json?, retention_policy?, emergency_disabled, created_at, updated_at.

### `automation_approval_references`

`id`, execution_id, authorization_request_id, policy_version, status, expires_at, created_at, updated_at.

### `automation_compensation_references`

`id`, failed_action_id, compensation_capability, status, created_at, updated_at.

Automation actions reference canonical capabilities; workflow state does not become domain truth.

### AI Runtime

Migration 0037 defines the canonical shared AI Runtime. The following are the only physical execution authorities:

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

No `ai_runs`, `ai_tool_calls` or feature-local AI execution ledger may be introduced as a parallel source of truth. Durable provider adapters, routing, validation and execution workers are operational layers over these records.


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

### `billing_financial_audit_events`

`id`, organization_id, workspace_id?, business_id?, actor_id?, event_type, entity_type, entity_id, outcome, amount_minor?, currency?, reason_code?, reason?, source, request_id?, correlation_id, idempotency_key?, before_json?, after_json?, metadata_json?, integrity_hash, occurred_at, created_at.

Financial audit events are append-only, tenant-scoped evidence. UPDATE/DELETE are database-blocked, idempotency is scoped to the organization, and monetary values use integer minor units. The event hash provides independent integrity verification; the table is not the accounting ledger.

### Refund financial accounting

### `billing_refunds`

`id`, organization_id, workspace_id?, business_id?, payment_reference, order_reference?, requested_amount_minor, refunded_amount_minor, currency, reason_code, status, provider?, provider_reference?, provider_status?, ledger_transaction_id?, requested_by?, approved_by?, requested_at, processed_at?, completed_at?, failure_code?, correlation_id, idempotency_key, created_at, updated_at.

Refund records are Billing/Payment financial truth. Commerce may retain only orchestration/reference history.

### `billing_ledger_accounts`

`id`, organization_id, workspace_id?, business_id?, account_code, name, account_type, currency, normal_balance, status, parent_account_id?, created_at, updated_at.

### `billing_ledger_transactions`

`id`, organization_id, workspace_id?, business_id?, transaction_type, source_type, source_id, currency, idempotency_key, correlation_id, occurred_at, created_at.

### `billing_ledger_entries`

`id`, transaction_id, account_id, organization_id, workspace_id?, business_id?, direction, amount_minor, currency, source_reference, reversal_of_entry_id?, created_at.

Ledger transactions and entries are immutable. A refund is posted only through a balanced, non-zero double-entry journal with matching currency and scope. Reversals are represented as new entries/transactions rather than mutation or deletion. Ledger balances are derived projections, never mutable balance authority.

Billing owns commercial entitlement and usage authority. Refund execution and double-entry accounting now have a canonical provider-neutral financial boundary. External payment-provider execution remains behind the provider adapter/reconciliation gate; provider-specific credentials and adapters are not stored in Billing.

### Media

`media_assets`: owner/scope, storage key, checksum, MIME/type, size, classification, status, timestamps.

`media_variants`: source asset, variant type, storage key, processing status, checksum.

`media_attachments`: media_asset_id + typed supported resource relationship; generic polymorphism only under the media attachment contract.

### Integration

The canonical Integration physical boundary is migration 0038.

### `integration_providers`

`id`, provider_key, provider_name, adapter_version, capabilities_json, status, created_at, updated_at.

### `integration_accounts`

`id`, organization_id, workspace_id?, provider_id, account_type, external_account_reference, status, credential_reference?, metadata_json?, connected_at?, disconnected_at?, created_at, updated_at.

### `integration_webhooks`

`id`, integration_account_id, external_event_id, event_type, signature_status, received_at, payload_reference?, processing_status, processed_at?, retry_count, last_error_reference?, correlation_id, created_at.

Webhook uniqueness is provider-account + external event id.

### `integration_sync_jobs`

`id`, integration_account_id, sync_type, direction, status, cursor_reference?, checkpoint_reference?, item_count, error_count, started_at?, completed_at?, next_run_at?, correlation_id, created_at, updated_at.

### `integration_external_references`

`id`, organization_id, workspace_id?, integration_account_id?, resource_type, resource_id, external_type, external_reference, status?, metadata_json?, first_seen_at, last_seen_at, created_at, updated_at.

External references link canonical Phoenix resources to provider identities without transferring domain ownership.


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

## 17.1 Communication Template Registry

### `communication_templates`

`id`, organization_id?, workspace_id?, template_key, intent, channel, owner_reference, status, created_at, updated_at.

Template identity is scoped to organization/workspace and channel. Provider-specific payloads remain outside the domain registry.

### `communication_template_versions`

`id`, template_id, version, locale, variables_schema_json, content_reference, content_checksum, approval_state, effective_from?, effective_to?, created_by, created_at, updated_at.

Approved versions are immutable and can only be resolved when active, locale/channel/intent match, and the effective window is valid.

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

### `match_learning_signals`

Append-only outcome evidence linked to a MatchRequest and optional Candidate: `id`, match_request_id, candidate_id?, organization_id, workspace_id?, signal_type, signal_value?, source, actor_reference?, metadata_json?, occurred_at, created_at. Learning signals are evidence, not authoritative supply or transaction state.

Match decisions are immutable historical decisions.

## 18.2 Reviews / Reputation

### Review lifecycle extension

Migration 0048 extends `reviews` with:

`status`, interaction_reference?, locale?, published_at?, policy_version, content_version.

The existing typed target columns remain canonical; no generic `review_targets` table is introduced.

### `review_reports`

`id`, review_id, reporter_reference, reason_code, details?, status, created_at, updated_at.

Duplicate reports from the same reporter/reason pair are rejected.

### `review_responses`

`id`, review_id, business_id, actor_reference, content, status, moderation_state, policy_version, content_version, created_at, updated_at.

Business ownership of the canonical review target is schema-enforced.

### `review_moderation_cases`

`id`, review_id, status, reason_code?, policy_version, assigned_to?, opened_at, resolved_at?, created_at, updated_at.

Only one active moderation case may exist for a Review.

### `review_moderation_decisions`

`id`, moderation_case_id, decision, actor_reference, reason_code, policy_version, decided_at, created_at.

Decisions are append-only historical facts.

### `review_risk_signals`

`id`, review_id, signal_type, value_json?, confidence?, source, model_version?, policy_version?, created_at.

Risk signals are advisory evidence. They cannot directly publish/remove a Review.

### `reputation_summaries`

`id`, organization_id, workspace_id?, target_type, target_id, published_review_count, rating_sum, rating_distribution_json, report_count, projection_version, source_review_cursor?, calculated_at, created_at, updated_at.

This is a rebuildable projection, never Review truth.

### `reputation_versions`

`id`, organization_id, workspace_id?, target_type, target_id, version, policy_version, status, generated_at, created_at.

One version is active at a time for a target; previous versions remain for rollback/audit.

### `trust_signals`

`id`, organization_id, workspace_id?, subject_type, subject_id, signal_type, severity, value_json?, confidence?, source_type, source_id, policy_version?, status, detected_at, expires_at?, created_at, updated_at.

TrustSignal is derived evidence with immutable provenance. It is rebuildable from source risk/report evidence and cannot override VerificationDecision or become an independent authorization source. Source idempotency is enforced by organization/workspace + source + signal + policy scope. High/critical anti-abuse signals may create an idempotent generic ModerationCase; enforcement remains policy/authorization controlled.



## 18.3 Fulfillment / Service Delivery

### `fulfillment_orders`

`id`, organization_id, workspace_id, business_id, source_type, source_id, status, fulfillment_type, plan_id?, created_at, updated_at, completed_at?, cancelled_at?.

FulfillmentOrder is the execution aggregate. Source commitments remain authoritative in Commerce or Booking.

### `fulfillment_items`

`id`, fulfillment_id, source_type, source_id, source_line_id?, quantity, fulfillment_type, status, promised_from?, promised_to?, destination_ref?, service_location_ref?, assigned_actor_ref?, completion_evidence_ref?, exception_id?, created_at, updated_at.

### `fulfillment_plans`

`id`, fulfillment_id, version, status, strategy, created_by, created_at, activated_at?, supersedes_plan_id?.

Plans are versioned execution plans, not a second Automation workflow model.

### `fulfillment_tasks`

`id`, fulfillment_id, fulfillment_item_id?, task_type, status, priority, assigned_actor_ref?, scheduled_from?, scheduled_to?, started_at?, completed_at?, failure_reason_code?, created_at, updated_at.

### `fulfillment_assignments`

`id`, fulfillment_task_id, actor_ref, actor_type, assigned_by, assigned_at, unassigned_at?, status.

Identity and authorization remain external authorities.

### `shipments`

`id`, fulfillment_item_id, carrier_ref?, service_level?, tracking_reference?, origin_ref?, destination_ref?, status, dispatched_at?, delivered_at?, proof_of_delivery_ref?, created_at, updated_at.

### `shipment_packages`

`id`, shipment_id, package_reference, package_type, weight_ref?, dimensions_ref?, status, created_at, updated_at.

### `tracking_events`

`id`, shipment_id, event_type, occurred_at, received_at, source, external_event_id?, location_ref?, normalized_status, provider_payload_ref?, event_version, deduplication_key, created_at.

Tracking events are immutable evidence and deduplicated by shipment/deduplication key.

### `delivery_attempts`

`id`, shipment_id, attempt_number, attempted_at, actor_ref?, status, failure_reason_code?, evidence_ref?, next_action_ref?, created_at.

### `service_deliveries`

`id`, fulfillment_item_id, booking_ref, provider_ref?, service_location_ref?, status, scheduled_from?, scheduled_to?, started_at?, ended_at?, completion_id?, exception_id?, created_at, updated_at.

Booking remains authoritative for appointment truth.

### `service_completions`

`id`, service_delivery_id, completed_by_actor_ref, completed_at, confirmation_type, customer_confirmation_ref?, provider_confirmation_ref?, evidence_ref?, status, created_at.

### `digital_deliveries`

`id`, fulfillment_item_id, entitlement_ref?, delivery_channel, recipient_scope_ref, issued_at, expires_at?, delivery_status, evidence_ref?, created_at, updated_at.

Secrets and private access credentials are not stored in ordinary Fulfillment rows.

### `fulfillment_exceptions`

`id`, fulfillment_id, fulfillment_item_id?, exception_type, severity, status, reason_code, detected_at, detected_by, resolution_code?, resolved_at?, resolved_by?, rework_task_ref?, created_at, updated_at.

### `fulfillment_status_history`

`id`, aggregate_type, aggregate_id, from_status?, to_status, changed_by, changed_at, reason_code?, correlation_id, policy_version?.

Append-only historical lifecycle evidence.

### `fulfillment_completion_evidence`

`id`, evidence_type, evidence_ref, source, captured_at, captured_by, verification_status, metadata_ref?, created_at.

Evidence may reference Media or external providers; Fulfillment never becomes an evidence-storage substitute.

Fulfillment is execution authority only. Commerce owns Order/OrderLine truth, Booking owns Appointment truth, Billing/Payment owns financial settlement, and Communications owns delivery messaging.

## 18.4 Discovery index / observability

### `search_index_versions`

`id`, organization_id, workspace_id, generation, index_schema_version, embedding_model_version?, status, source_checkpoint_reference?, created_by, activated_at?, retired_at?, created_at, updated_at.

Exactly one active index generation exists per organization/workspace. The active generation can be rotated without changing authoritative domain records.

### `discovery_query_traces`

`id`, organization_id, workspace_id, request_id, normalized_intent_json?, candidate_counts_json?, retrieval_sources_json?, policy_exclusions_json?, ranking_policy_version, cache_status?, latency_ms?, degradation_state?, result_ids_json?, created_at.

Query traces are operational/evaluation evidence and never an authorization boundary.

### `discovery_evaluation_records`

`id`, organization_id?, workspace_id?, evaluation_type, dataset_reference, query_version?, index_schema_version?, embedding_model_version?, ranking_policy_version?, metrics_json, evaluator_version, generated_at, created_at.

Evaluation records are immutable evidence for retrieval/ranking/matching quality.

## 18.6 SEO/GEO derived representations and observability

SEO/GEO is a derived platform capability. Its persistence never becomes source of truth for Business, Catalog, Customer, Trust, Location, or other domain facts.

### `seo_entity_representations`
Tenant/workspace-scoped canonical derived representation keyed by source entity, type and locale. Stores publication/indexability policy, canonical URL, source version, generated representation, source freshness and content hash.

### `seo_artifacts`
Versioned deterministic outputs such as metadata, structured data, GEO answers, sitemap/robots representations and internal-link artifacts. Artifacts are rebuildable from canonical source representations.

### `seo_dependencies`
Explicit entity dependency edges used for incremental invalidation. Dependencies do not transfer ownership of source facts.

### `seo_audits`
Explainable SEO/GEO quality evidence with decomposable scores and issue/remediation records. Audits are diagnostic and never authoritative.

### `seo_measurements`
Observed discovery/visibility measurements with surface, metric, entity/query context and provenance. The table must never invent rankings, impressions, citations or referrals that were not actually observed.

SEO/GEO publication must remain truth-first, tenant-safe, provenance-aware and policy-controlled. Search indexes, structured data, answer representations and measurements are rebuildable projections.

### `seo_entity_graph_nodes`
Derived semantic entity nodes with source module/version and publication/visibility state.

### `seo_entity_graph_edges`
Derived, provenance-aware semantic relationships with confidence and verification state. No self-edges are permitted.

### `seo_internal_link_recommendations`
Rebuildable internal-link planning output derived from canonical semantic relationships.

### `seo_geo_signals`
Canonical-data-derived geographic truth signals distinguishing location from service-area and remote availability semantics.

## 19. Explicit gates still open

The following remain controlled architecture/operational gates:

2. Tax/discount transaction snapshot semantics beyond the existing Commerce ownership decision.
3. Payment provider reference/invoice/financial-ledger contract.
4. AI Memory physical storage/retention contract.
5. Integration/Webhook/Sync retention semantics and provider-specific adapter implementations.
6. Communication external provider adapter implementations and scoped dispatch rate-limit/anomaly controls are implemented. Email/SMS/WhatsApp/Push adapters, optional secondary-provider health/cooldown failover, intent/consent/suppression policy, template registry and provider-neutral dispatch are implemented. Provider credentials remain runtime-only.
7. Business lifecycle vocabulary is reconciled: `businesses.status` owns marketplace lifecycle; `onboarding_profiles.status` owns onboarding workflow; no parallel Business lifecycle/status table is permitted.
8. AI durable worker input/payload resolution contract is closed for Seller AI `seller.product.extract`; new AI operation types require their own explicit resolver contract.
9. Matching learning-signal persistence/derivation contract and broader Act projections where required. Core retrieval/ranking/Connect execution is implemented.
10. Privacy export/delete/retention processing semantics are implemented for Customer; subject-level identity validation and consent expiry are implemented.

Closed implementation gates must not be reopened by future agents: Booking transactional finalization/capacity guards, Review target integrity, Matching retrieval/ranking/Connect execution, Automation scheduled execution, Integration durable claim/worker boundaries, Fulfillment provider-adapter boundary and CaseAction capability execution are implemented and tested.

## 20. Definition of Done

The physical data model is architecture-complete when every planned physical table can be generated from this blueprint without inventing a new concept, scope, source of truth, ownership rule, lifecycle, or business invariant during migration design.


### Billing invoice system — implemented

`billing_invoices`, `billing_invoice_lines`, and `billing_invoice_payment_applications` are the canonical physical representation for Billing invoices. Invoice values are integer minor units and invoice lines are historical snapshots. Draft invoices may be assembled; once issued, financial fields and lines are immutable. Payment applications update paid/due state only through the Billing invoice repository. External payment-provider execution remains an adapter/reconciliation concern.

### Payment provider reference contract — implemented

`billing_provider_refs` is now actively used by the Billing payment-provider service. Provider execution state is normalized at the adapter boundary and external references are persisted without provider credentials or signing secrets.

### Settlement physical model — implemented

`billing_settlements` and `billing_settlement_items` are the authoritative settlement/payout records. Settlement items are immutable, tenant/business/workspace/currency scoped, and reconcile exactly to settlement net amount before ledger posting. Provider references are external execution evidence, not financial truth.

### `billing_reconciliation_cases` — implemented

The reconciliation case is the canonical exception record for Billing/provider mismatches. It carries tenant/workspace/business scope, provider and local/external references, expected/observed amounts, currency, category, resolution metadata, correlation and idempotency. `billing_reconciliation_case_events` is append-only and immutable for auditability.

### Matching Act outcome integration — implemented

Booking and Commerce may persist optional `match_request_id` / `match_candidate_id` references on authoritative Act records. These references do not transfer ownership of Booking or Commerce truth to Matching.

Durable Act outcomes are emitted through the existing transactional outbox and consumed by `MatchingOutcomeProcessor`. Supported v1 outcomes are `booking.completed`, `booking.no_show`, `booking.cancelled`, `commerce.order.completed`, `commerce.payment.completed`, `payment.captured`, and `fulfillment.completed`. The processor resolves the authoritative MatchRequest/Candidate, records exactly one append-only Learning Signal using the outbox event ID as the signal identity, and ignores events with no unambiguous match linkage rather than guessing.

This closes the integration boundary without creating a second Learning system.


## 18.5 Analytics physical projections

### `analytics_events`

Immutable normalized analytics event envelope. It is derived from the transactional Outbox and never authoritative for domain state.

Fields include event identity/version, occurrence/receipt timestamps, organization/workspace scope, source/resource references, privacy classification and payload hash.

### `analytics_facts`

Append-only measurement facts derived from accepted analytics events. The current canonical fact is `event.<event_type>` with a numeric value of 1. Facts are evidence for metrics and are rebuildable.

### `analytics_metric_definitions`

Versioned metric registry containing owner, formula, source events, filters, timezone policy, attribution window and privacy classification. Metric semantics are versioned rather than silently changed.

### `analytics_metric_aggregates`

Rebuildable hourly/daily metric projection. Aggregate replacement is idempotent; it is never used as operational truth.

### `analytics_ingestion_quarantine`

Durable invalid-event evidence containing source identity, scope, reason, payload hash, attempts and resolution state. Quarantine prevents malformed analytics data from silently contaminating aggregates.

Analytics tables are projection-owned and may be dropped/rebuilt from durable source events. They do not authorize, price, book, settle, communicate, verify, or otherwise mutate domain state.
