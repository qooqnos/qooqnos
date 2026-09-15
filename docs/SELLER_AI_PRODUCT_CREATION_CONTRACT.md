# Phoenix Seller AI Product Creation Contract

## 1. Purpose

Phoenix should make seller supply creation radically simpler:

> **Give Phoenix raw product information; Phoenix prepares the product; the seller confirms what matters; Phoenix makes it discoverable.**

The seller should not be required to become a catalog-management expert. Manual forms remain a fallback and an exception path, not the primary experience.

This contract defines the canonical seller-side flow from raw input to marketplace-ready catalog supply. It does not create a second catalog, media, billing, discovery, authorization, or identity system.

## 2. Product Principle

The canonical experience is:

```text
Raw Seller Input
    ↓
Understand Input
    ↓
Extract
    ↓
Normalize
    ↓
Enrich
    ↓
Validate
    ↓
Ask Only What Is Missing / Uncertain
    ↓
Seller Review & Confirmation
    ↓
Catalog Domain Write
    ↓
Publication / Policy Gates
    ↓
Discovery Projection
    ↓
Customer Matching
```

For a product, the preferred entry point may be a single photo. Other supported raw inputs include text, voice, PDF/document, spreadsheet, multiple photos, and incomplete existing catalog data.

## 3. Canonical Ownership

The Seller AI flow orchestrates capabilities; it does not own their authoritative state.

| Concern | Authority |
|---|---|
| Seller/business identity | Business / Identity / Tenancy |
| Authorization | Authorization |
| Product/service/offer facts | Catalog |
| Media assets and transformations | Media |
| Price | Catalog/Pricing authority |
| Inventory | Inventory/Commerce authority when enabled |
| Availability | Availability/Booking authority |
| Verification and credentials | Verification |
| AI execution and interpretation | AI |
| AI usage telemetry | AI/Usage contract |
| Plans, entitlements, quotas, credits, pricing | Billing |
| Publication eligibility | Catalog + Policy/Verification/Moderation contracts |
| Search/discovery representation | Discovery |
| Audit of sensitive actions | Audit |

No Seller AI implementation may create parallel product tables, private pricing state, private usage balances, or private discovery indexes.

## 4. Seller Experience

### 4.1 The zero-to-product path

A seller can submit:

```text
[ Photo ]
[ Optional text ]
[ Optional additional photos ]
```

Phoenix then presents a generated draft rather than a large form.

Example result:

```text
Product draft

Title:      ...
Category:   ...
Description: ...
Attributes: ...
Variants:   ...
Media:      ...

Needs your confirmation:
✓ Color
✓ Material
? Price
? Stock
```

The UI should distinguish:

- generated/proposed information;
- information extracted with high confidence;
- information confirmed by the seller;
- information supplied directly by the seller;
- information requiring external/domain validation;
- missing information.

### 4.2 Ask only necessary questions

Phoenix should minimize seller effort by asking only questions required for the next valid state.

Do not ask for information that:

- is already supplied;
- can be safely extracted;
- can be derived deterministically;
- is unnecessary for the current publication path.

Questions should be prioritized by publication impact, not by form completeness.

## 5. AI Pipeline

### Stage A — Input intake

Create an AI creation session linked to the validated actor, workspace/tenant, business and input assets.

Capture:

- request ID;
- correlation ID;
- actor identity;
- workspace/tenant;
- business ID;
- input type;
- media/document references;
- locale;
- idempotency key;
- policy context.

The AI layer receives references to owned media/files rather than becoming their owner.

### Stage B — Understanding

AI identifies candidate product/service concepts and visible or explicitly supplied information.

Outputs are proposals, never authoritative catalog facts.

### Stage C — Structured extraction

AI maps the raw input to the applicable Catalog schema:

- offer type;
- category candidate;
- title candidate;
- description candidate;
- attributes;
- variant candidates;
- tags/search terms;
- localization candidates;
- media roles;
- missing fields;
- uncertainty/confidence metadata.

Schema validation occurs before any domain write.

### Stage D — Enrichment

AI may improve presentation and discoverability using approved transformations:

- title refinement;
- description generation;
- attribute normalization;
- taxonomy/category suggestions;
- search-friendly terms;
- localization;
- formatting;
- permitted image enhancement or generation.

Enrichment must not manufacture authoritative commercial facts.

### Stage E — Validation

Validation combines deterministic rules, domain policy, provenance, schema constraints, moderation, and where applicable verification.

Conceptually:

```text
AI Proposal
  → Schema Validation
  → Provenance Check
  → Domain Validation
  → Policy / Moderation
  → Seller Confirmation
  → Catalog Write
```

### Stage F — Seller confirmation

The seller reviews only material uncertainty and required decisions.

Confirmation can be field-level or draft-level depending on risk.

A seller correction becomes explicit seller-provided input and must supersede the corresponding AI proposal according to domain precedence rules.

### Stage G — Catalog creation/update

Only the Catalog domain service creates or updates the authoritative Offer/Product records.

The Seller AI flow calls canonical Catalog contracts such as:

```text
createOffer
updateOffer
publishOffer
```

It never writes Catalog private tables directly.

### Stage H — Publication and discovery

Publication remains explicit and policy-controlled.

Only after the Catalog publication contract succeeds may the resulting version be projected into Discovery.

Discovery is eventually consistent and must never become the source of truth for product facts.

## 6. Provenance Contract

Every AI-created or AI-modified field that can materially affect marketplace meaning should retain provenance.

Conceptual provenance values:

```text
seller_input
seller_confirmed
ai_extracted
ai_generated
system_derived
external_verified
policy_validated
```

For material fields, provenance should be associated with:

- source reference;
- source version where applicable;
- AI operation ID when AI-derived;
- timestamp;
- actor who confirmed/changed it;
- confidence/uncertainty when applicable.

AI provenance is evidence of how a proposal was produced, not evidence that the proposal is true.

## 7. Confidence and Uncertainty

Confidence is an AI decision-support signal, not authorization to publish.

Recommended semantic states:

```text
confirmed
high_confidence
needs_review
unknown
conflicting
rejected
```

Low confidence should increase seller review rather than silently reducing data quality.

Conflicting sources must not be arbitrarily resolved by the model when the field is authoritative or commercially material.

## 8. Fields AI Must Not Authoritatively Invent

AI must not silently establish:

- price;
- inventory quantity;
- real-time availability;
- credentials or licenses;
- verification status;
- legal/compliance claims;
- regulated product claims;
- contractual seller policies;
- identity or ownership;
- financial state.

AI may propose a value when the product contract permits proposals, but the value must enter the authoritative domain only through the required validation/confirmation path.

## 9. Media Contract

Media remains owned by the Media module.

Seller AI may request canonical Media capabilities for:

- image analysis;
- quality assessment;
- crop/resize/format optimization;
- background processing;
- permitted image generation;
- derivative creation.

Generated media must carry provenance and appropriate moderation/policy state.

The Catalog stores media references, not duplicated media ownership.

## 10. Product Creation Example

```text
Seller uploads photo
        ↓
Media stores asset
        ↓
Seller AI creates operation/session
        ↓
Vision/model identifies candidate product
        ↓
Catalog schema selected
        ↓
Attributes extracted
        ↓
Title + description generated
        ↓
Category + tags proposed
        ↓
Variants proposed if evidence exists
        ↓
Image quality/enrichment requested
        ↓
Validation + provenance
        ↓
Missing facts identified
        ↓
Seller answers only required questions
        ↓
Seller confirms draft
        ↓
Catalog creates Offer/Product
        ↓
Publication policy evaluated
        ↓
Published catalog version
        ↓
Discovery projection
        ↓
Available to retrieval / matching
```

## 11. AI Economics

Seller AI is a monetizable product capability.

Every material AI operation must produce a measurable usage event linked to the creation workflow.

Conceptual relationship:

```text
AI Operation
    ↓
Usage Event
    ↓
Entitlement / Quota / Credit Check
    ↓
AI Execution
    ↓
Usage Measurement
    ↓
Cost Telemetry
    ↓
Customer Usage / Charge Outcome
```

Examples of operation identities:

```text
seller.product.extract
seller.product.enrich
seller.product.localize
seller.media.enhance
seller.media.generate
seller.catalog.validate_ai
```

The final operation taxonomy must be governed centrally and reused by all AI product experiences.

## 12. Pricing Model

Phoenix may support multiple commercial models without changing the Seller AI contract:

- included usage in a subscription plan;
- monthly/periodic quota;
- prepaid credits;
- per-operation pricing;
- bundled operations;
- tiered usage;
- hybrid pricing.

**Internal provider/model cost is not the customer price.**

Billing owns customer-facing pricing and entitlement decisions. AI reports usage and execution economics; it does not modify balances or financial state directly.

## 13. Charging Semantics

The system must distinguish:

```text
attempted
started
succeeded
failed
partially_succeeded
cancelled
retried
refunded
```

A retry must not accidentally create duplicate customer charges.

The economic contract must define whether a failed operation consumes billable usage. This is a Billing policy, not an implicit AI behavior.

Long-running workflows should use idempotency keys and durable operation state so that network retries do not duplicate work or billing.

## 14. Partial Completion

A multi-step creation flow may succeed partially.

Example:

```text
Extraction       ✓
Description      ✓
Image generation ✗
Catalog draft    ✓
Publication      blocked by missing price
```

Phoenix should preserve successful work, explain what failed, and allow continuation without repeating billable operations unnecessarily.

The user should never have to restart the entire creation process because one downstream AI operation failed.

## 15. Security and Authorization

The creation workflow executes under the authenticated actor and validated workspace/tenant context.

Required controls include:

- server-side authorization;
- tenant isolation;
- ownership checks for seller assets;
- policy checks before publication;
- auditability of material confirmations;
- protection against prompt/content injection from uploaded media or documents;
- no secrets in prompts or model-visible content unless explicitly required and protected;
- no AI-created identity, permission, membership, or financial authority.

Uploaded documents/images are untrusted input, including text embedded inside images.

## 16. Idempotency and Versioning

The workflow must be safe under retries and concurrent seller edits.

At minimum:

- creation session has a stable ID;
- each material AI operation has an operation ID;
- client retries use an idempotency key;
- source input has a version/hash where appropriate;
- draft has a version;
- seller confirmation targets a specific draft version;
- Catalog writes use optimistic/version conflict protection;
- repeated projection events are safe.

A seller edit made after AI generation must not be overwritten by a stale AI result.

## 17. Lifecycle

Recommended creation-session lifecycle:

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

The lifecycle is orchestration state. Catalog publication remains authoritative in Catalog.

## 18. No Duplicate Capability Rule

Seller AI must reuse existing canonical capabilities:

| Need | Reuse |
|---|---|
| Identity | Identity |
| Tenant/workspace | Tenancy |
| Permission | Authorization |
| Product/service state | Catalog |
| Media | Media |
| AI execution | AI |
| Usage metering | Usage/AI economics |
| Plans/credits/entitlements | Billing |
| Verification | Verification |
| Moderation/policy | Policy/Moderation |
| Search projection | Discovery |
| Audit | Audit |

Do not implement a seller-specific copy of any of these capabilities.

## 19. API-Level Conceptual Contract

The implementation may expose endpoints such as:

```text
POST /api/v1/ai/seller/product-creation-sessions
POST /api/v1/ai/seller/product-creation-sessions/:id/inputs
POST /api/v1/ai/seller/product-creation-sessions/:id/run
GET  /api/v1/ai/seller/product-creation-sessions/:id
POST /api/v1/ai/seller/product-creation-sessions/:id/confirm
POST /api/v1/ai/seller/product-creation-sessions/:id/cancel
```

These are conceptual orchestration endpoints only. Exact route ownership must follow the existing API/module contract matrix.

The endpoints must not bypass Catalog, Billing, Media, Authorization, or Discovery domain services.

## 20. UX Rules

The seller experience should optimize for:

1. minimum manual entry;
2. maximum useful first draft;
3. transparent uncertainty;
4. fast correction;
5. no unnecessary questions;
6. clear cost/usage before chargeable operations where policy requires disclosure;
7. recoverability after failure;
8. no surprise publication;
9. no silent changes to seller-confirmed facts.

The interface should feel like:

> **"Show Phoenix what you sell."**

rather than:

> **"Fill out our catalog administration form."**

## 21. Quality Metrics

Success must be measured by marketplace outcomes, not AI activity alone.

Primary metrics:

- median seller time from raw input to publishable draft;
- percentage of products created from raw input without full manual form entry;
- seller correction rate;
- percentage of drafts requiring additional questions;
- required-field completeness;
- publication acceptance rate;
- failed-operation recovery rate;
- AI cost per successful publishable product;
- seller retention/usage of the creation capability;
- discovery quality of AI-created supply;
- qualified customer interaction/conversion;
- downstream match relevance.

A higher number of AI calls is not a success metric.

## 22. Definition of Done

Seller AI Product Creation is architecturally complete when:

- raw seller input can enter a canonical creation session;
- AI proposals are schema validated;
- authoritative Catalog state remains owned by Catalog;
- seller confirmation is explicit where required;
- provenance is retained for material AI-derived fields;
- Media ownership remains with Media;
- commercial facts are protected by domain authority;
- publication gates are enforced;
- discovery receives only published/versioned projections;
- AI usage is measured through a canonical economic contract;
- Billing remains the authority for entitlements, quotas, credits and pricing;
- retries are idempotent;
- partial failures are recoverable;
- tenant/authorization boundaries are enforced;
- sensitive actions are auditable;
- measurable seller and marketplace outcomes are tracked.

## 23. Strategic Decision

**Phoenix should default to "raw input first, structured form second."**

Manual catalog entry remains available for precision and exception handling, but the product's differentiated seller experience is AI-assisted supply creation.

The strategic loop is:

```text
Seller has something to sell
        ↓
Phoenix understands it
        ↓
Phoenix turns it into trustworthy structured supply
        ↓
Seller confirms what matters
        ↓
Phoenix publishes it
        ↓
Phoenix understands customer demand
        ↓
Phoenix matches demand to supply
        ↓
Connection / booking / purchase / lead
        ↓
Outcome signals improve the system
```

This is a core expression of Phoenix as the **intelligent decision-making and connection layer between customers and businesses**.
