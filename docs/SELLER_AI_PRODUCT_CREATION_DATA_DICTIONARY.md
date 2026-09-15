# Phoenix Seller AI Product Creation — Data Dictionary

**Status:** Canonical architecture contract
**Scope:** Data vocabulary for the seller-side AI product creation workflow. This document defines meaning, ownership, provenance, lifecycle and economic relationships; it does not prescribe SQL tables.

## 1. Purpose

The Seller AI Product Creation flow turns minimal seller input into trustworthy, structured marketplace supply while preserving domain ownership and economic traceability.

The data model follows:

```text
Raw Input → Creation Session → AI Operations → Draft → Validation → Seller Confirmation → Catalog Offer/Product → Publication → Discovery Projection
```

The workflow is orchestration state. Catalog remains the source of truth for product/offer facts; Media owns assets; Billing owns customer-facing economic authority.

## 2. Naming Rules

- IDs are opaque identifiers.
- Timestamps are UTC instants.
- Tenant/workspace scope is explicit.
- Monetary values use integer minor units plus ISO-4217 currency.
- AI-derived fields carry provenance when they materially affect marketplace meaning.
- Draft data is not authoritative Catalog state.
- Enumerations are versioned when exposed externally.

## 3. Core Entities

### 3.1 `seller_ai_creation_session`

Represents one seller attempt to turn raw input into marketplace-ready supply.

| Field | Meaning | Authority |
|---|---|---|
| `id` | Stable creation-session ID | AI/orchestration |
| `tenant_id` | Tenant/workspace scope | Tenancy |
| `workspace_id` | Workspace context when applicable | Tenancy |
| `business_id` | Owning business | Business |
| `actor_id` | Authenticated initiating actor | Identity |
| `request_id` | Request trace ID | Platform |
| `correlation_id` | Cross-operation correlation | Platform |
| `status` | Workflow lifecycle state | AI/orchestration |
| `input_version` | Version of submitted source set | AI/orchestration |
| `draft_version` | Current draft version | AI/orchestration |
| `target_type` | `product` or `service` | AI/Catalog contract |
| `locale` | Primary processing locale | Request/domain context |
| `idempotency_key` | Retry deduplication key | Platform |
| `created_at` | Creation instant | Platform |
| `updated_at` | Last state change | Platform |
| `expires_at` | Optional workflow expiry | AI/orchestration |

### 3.2 `seller_ai_input`

A reference to raw information supplied for interpretation.

| Field | Meaning | Authority |
|---|---|---|
| `id` | Input ID | AI/orchestration |
| `session_id` | Parent creation session | AI/orchestration |
| `input_type` | `image`, `text`, `voice`, `document`, `spreadsheet`, `catalog_record`, etc. | AI contract |
| `media_reference` | Reference to Media/file asset when applicable | Media |
| `text_reference` | Reference/content pointer for text input | Input contract |
| `source_version` | Version/hash of source | Input contract |
| `locale` | Input locale when known | Input metadata |
| `submitted_by` | Actor who supplied input | Identity |
| `submitted_at` | Submission instant | Platform |

AI must consume owned references and must not become the owner of seller media.

### 3.3 `seller_ai_draft`

A non-authoritative proposed representation of an Offer/Product.

| Field | Meaning | Authority |
|---|---|---|
| `id` | Draft ID | AI/orchestration |
| `session_id` | Parent session | AI/orchestration |
| `version` | Optimistic draft version | AI/orchestration |
| `schema_id` | Catalog schema used | Catalog contract |
| `schema_version` | Catalog schema version | Catalog contract |
| `target_type` | Product/service target | Catalog contract |
| `fields` | Proposed structured fields | AI proposal |
| `field_provenance` | Provenance map | AI/data contract |
| `field_confidence` | Confidence/uncertainty map | AI/data contract |
| `missing_fields` | Required or useful missing information | AI/orchestration |
| `conflicts` | Unresolved conflicting evidence | AI/orchestration |
| `validation_state` | Current deterministic/policy validation result | Policy/Catalog |
| `seller_confirmation_state` | Confirmation state | AI/orchestration |
| `created_at` | Draft creation instant | Platform |
| `updated_at` | Last draft update | Platform |

A draft must never be treated as published marketplace truth.

### 3.4 `seller_ai_field_provenance`

Describes how a material field value entered the draft or authoritative domain.

| Field | Meaning |
|---|---|
| `field_path` | Canonical field path, e.g. `attributes.material` |
| `source_type` | `seller_input`, `seller_confirmed`, `ai_extracted`, `ai_generated`, `system_derived`, `external_verified`, `policy_validated` |
| `source_reference` | Input, operation, actor or external evidence reference |
| `source_version` | Source version when available |
| `ai_operation_id` | Producing AI operation when applicable |
| `confidence` | Model confidence where meaningful |
| `confirmed_by` | Actor who confirmed the value when applicable |
| `confirmed_at` | Confirmation instant |
| `recorded_at` | Provenance record instant |

Provenance explains origin; it does not by itself establish truth.

## 4. Lifecycle States

### 4.1 Creation Session

```text
initiated
→ analyzing
→ draft_ready
→ needs_seller_input
→ seller_review
→ confirmed
→ validating
→ catalog_saved
→ publication_pending
→ published
```

Exceptional states:

```text
failed
cancelled
expired
blocked_by_policy
blocked_by_entitlement
blocked_by_missing_required_data
```

`published` in the session means the delegated Catalog publication succeeded; the session does not own publication truth.

### 4.2 AI Operation

```text
attempted
→ started
→ succeeded
```

Exceptional/terminal states:

```text
failed
partially_succeeded
cancelled
```

A retried execution is linked to the original operation identity rather than silently creating an unrelated billable action.

### 4.3 Seller Confirmation

```text
not_required
pending
confirmed
rejected
superseded
```

Confirmation must target a specific draft version.

## 5. AI Operation Entity

### `ai_operation`

Represents a material model/provider operation.

| Field | Meaning | Authority |
|---|---|---|
| `operation_id` | Stable operation ID | AI |
| `operation_type` | Canonical operation taxonomy ID | AI/Usage contract |
| `session_id` | Seller creation session | AI |
| `tenant_id` | Tenant scope | Tenancy |
| `workspace_id` | Workspace scope | Tenancy |
| `actor_id` | Initiating actor where applicable | Identity |
| `provider` | Model/provider reference | AI |
| `model` | Model identifier/version | AI |
| `input_reference` | Input set reference | AI |
| `output_reference` | Output artifact/reference | AI |
| `status` | Execution state | AI |
| `attempt_number` | Retry attempt | AI |
| `request_id` | Request trace | Platform |
| `latency_ms` | Execution latency | AI telemetry |
| `input_units` | Provider/input usage units | AI telemetry |
| `output_units` | Provider/output usage units | AI telemetry |
| `estimated_internal_cost` | Internal cost estimate | AI economics |
| `created_at` | Operation creation | Platform |
| `completed_at` | Completion instant | Platform |

Provider/model identifiers and token telemetry are internal economic/operational signals. They are not customer pricing rules.

## 6. Canonical Seller AI Operation Taxonomy

Initial conceptual operation IDs:

| Operation ID | Purpose | Typical input | Typical output |
|---|---|---|---|
| `seller.product.extract` | Extract product facts from raw input | image/text/document | structured proposals |
| `seller.product.classify` | Classify product/category | raw input | taxonomy proposal |
| `seller.product.enrich` | Improve title/description/attributes | draft | enriched draft |
| `seller.product.localize` | Produce localized content | draft + locale | localized fields |
| `seller.product.validate_ai` | AI-assisted consistency/quality check | draft | findings |
| `seller.media.analyze` | Understand image/media | media | media observations |
| `seller.media.enhance` | Improve permitted media quality | media | derivative media |
| `seller.media.generate` | Generate permitted derivative/commercial media | approved context | generated media |

The taxonomy is centrally governed. Product, onboarding, catalog, admin and other experiences reuse these operation identities rather than creating synonyms.

## 7. Usage and Billing Relationship

The Seller AI flow does not own balances, credits, plans or customer prices.

Conceptual relationship:

```text
AI Operation
    ↓
Usage Event
    ↓
Billing Entitlement / Quota / Credit Decision
    ↓
Execution
    ↓
Measured Usage
    ↓
Customer Usage / Charge Outcome
```

### `ai_usage_event`

| Field | Meaning |
|---|---|
| `usage_event_id` | Stable usage event ID |
| `operation_id` | Related AI operation |
| `operation_type` | Canonical operation taxonomy ID |
| `tenant_id` | Tenant scope |
| `workspace_id` | Workspace scope |
| `actor_id` | Initiating actor |
| `meter_unit` | Canonical billable/usage unit |
| `quantity` | Measured quantity |
| `status` | Usage recording state |
| `idempotency_key` | Usage deduplication key |
| `entitlement_decision_id` | Related entitlement decision |
| `charge_reference` | Billing charge reference when applicable |
| `created_at` | Event instant |

Usage event identity must remain stable across transport retries.

### `ai_entitlement_decision`

A reference to Billing's decision about whether an operation is permitted under current commercial terms.

The decision may represent:

- included plan usage;
- quota availability;
- prepaid credits;
- per-operation permission;
- tiered/hybrid rules;
- denial due to exhausted entitlement.

The Seller AI domain consumes the decision; it does not implement the pricing rules.

## 8. Charge Semantics

A chargeable operation must distinguish:

```text
authorized
started
succeeded
failed
partially_succeeded
cancelled
refunded
```

Whether a failed operation consumes billable usage is a Billing policy.

The Seller AI workflow must preserve enough identifiers for Billing to make that determination without reconstructing AI execution history from logs.

## 9. Catalog Handoff

When seller confirmation and required validation succeed, Seller AI invokes canonical Catalog capabilities.

Minimum conceptual handoff:

```text
createOffer
createProduct
manageVariant
setPrice (only from authoritative seller/domain input)
publishOffer
```

The exact capability selected depends on the existing Catalog contract and product type.

The handoff should include:

- business/workspace context;
- draft version;
- structured fields;
- provenance references;
- seller-confirmed values;
- media references;
- schema/version;
- request/correlation IDs.

Seller AI must not write Catalog tables directly.

## 10. Material Field Classes

### AI-proposable

Examples:

- title;
- description;
- category candidate;
- tags;
- normalized attributes;
- search terms;
- localization;
- media presentation suggestions.

### Seller-confirmable

Examples:

- material where not reliably visible;
- color where ambiguity exists;
- variant existence;
- product-specific claims;
- other material marketplace facts requiring seller attestation.

### Domain-authoritative

Examples:

- price;
- inventory;
- real-time availability;
- credentials;
- verification status;
- legal/compliance facts;
- contractual policies;
- ownership/identity;
- financial state.

The exact boundary is defined by the owning domain, but Seller AI must never silently elevate an AI proposal into authority.

## 11. Field Precedence

For the same field, precedence should follow the authoritative source chain:

```text
External/domain-verified authoritative value
        ↓
Seller-confirmed value
        ↓
Explicit seller input
        ↓
System-derived value
        ↓
AI-extracted value
        ↓
AI-generated value
```

A lower-precedence value must not overwrite a higher-precedence value without an explicit domain rule.

## 12. Versioning Rules

- Every draft has a monotonically managed version.
- Seller confirmation references the exact draft version reviewed.
- AI operations reference their source input/draft version.
- Catalog writes use the resulting authoritative version.
- Discovery projections include Catalog content/version metadata.
- Stale AI results must be rejected or reconciled rather than overwriting newer seller edits.

## 13. Event Vocabulary

Conceptual events for orchestration and integration:

```text
seller_ai.creation_session.created.v1
seller_ai.input.received.v1
seller_ai.operation.started.v1
seller_ai.operation.completed.v1
seller_ai.operation.failed.v1
seller_ai.draft.created.v1
seller_ai.draft.updated.v1
seller_ai.seller_input.required.v1
seller_ai.seller_confirmation.recorded.v1
seller_ai.creation.blocked.v1
seller_ai.catalog_handoff.requested.v1
seller_ai.catalog_handoff.completed.v1
```

These events describe workflow activity. Catalog remains authoritative for catalog lifecycle events such as product creation and publication.

## 14. Permissions

Seller AI should reuse centralized authorization. Conceptual permission families:

```text
ai.seller.create
ai.seller.read
ai.seller.run
ai.seller.confirm
ai.seller.cancel
ai.seller.media.generate
```

These are subject to the existing permission registry and capability matrix. No Seller AI-specific authorization evaluator may be created.

## 15. Tenant Isolation

Every session, draft, operation and usage event must carry or derive validated tenant/workspace scope.

Cross-tenant references are prohibited unless explicitly permitted by a platform/global contract.

## 16. Audit Requirements

Audit evidence should be retained for material actions including:

- seller confirmation;
- seller correction of AI output;
- publication request;
- publication approval/rejection;
- charge/credit outcome when relevant;
- privileged override;
- policy block;
- material provenance changes.

Audit is not a duplicate workflow store.

## 17. Privacy and Retention

Raw seller inputs and AI outputs must follow the retention policy of the owning media/data domain.

The Seller AI flow must not retain duplicate copies merely for convenience.

Sensitive content must not be unnecessarily included in prompts, logs, telemetry or analytics.

## 18. Metrics

Required analytical dimensions should support:

- session-to-publish conversion;
- time from first input to draft;
- time from draft to publication;
- seller correction rate;
- missing-information rate;
- operation success/failure rate;
- recovery after partial failure;
- AI cost per successful publishable product;
- usage and revenue by operation type;
- discovery quality of AI-created supply;
- downstream matching/conversion outcomes.

Analytics consumes events/projections; it does not become the source of truth.

## 19. Anti-Duplication Matrix

| Data/behavior | Canonical owner | Seller AI behavior |
|---|---|---|
| User/actor | Identity | reference |
| Tenant/workspace | Tenancy | require context |
| Permissions | Authorization | evaluate through contract |
| Business | Business | reference |
| Offer/product | Catalog | delegate |
| Pricing | Catalog/Pricing | request authoritative input |
| Inventory | Inventory/Commerce | reference/revalidate |
| Availability | Availability/Booking | reference |
| Media asset | Media | reference/delegate |
| AI execution | AI | execute through AI capability |
| AI usage | Usage/economic contract | emit/record canonical usage |
| Entitlement/credits | Billing | consume decision |
| Charge | Billing | reference outcome |
| Verification | Trust/Verification | consume result |
| Policy/moderation | Policy/Trust | consume decision |
| Discovery | Discovery | emit/project only |
| Audit | Audit | emit evidence |

## 20. Definition of Done

The data contract is complete when:

- each workflow concept has one canonical owner;
- raw inputs can be traced to the resulting draft;
- material AI fields have provenance;
- draft versions protect against stale AI writes;
- seller confirmation is tied to a reviewed version;
- AI operations have stable identities;
- usage events are idempotent;
- Billing remains authoritative for commercial entitlement and pricing;
- Catalog remains authoritative for product/offer state;
- Media remains authoritative for assets;
- publication and discovery remain separate lifecycle concerns;
- tenant and authorization context are explicit;
- audit evidence is sufficient for material decisions;
- metrics can connect AI usage to marketplace outcomes.
