# Phoenix Business Onboarding & Verification Architecture

**Status:** Proposed architecture baseline  
**Scope:** Business/provider onboarding, verification, profile publication, service/catalog readiness  
**Runtime:** Phoenix modular monolith on Cloudflare  

## 1. Purpose

Business onboarding is the supply-side foundation of Phoenix Marketplace. The objective is to turn raw business information into a trustworthy, searchable, policy-compliant marketplace profile without allowing incomplete, unverified, stale, or unsafe information to become authoritative.

The onboarding system must support beauty first, fashion second, and medical through a controlled partner/pilot flow. The same Core lifecycle must work internationally; industry and country/legal rules are adapters and policies rather than hard-coded assumptions in Core.

## 2. Core Invariant

> A business can submit information before it can publish information.

Submission, verification, activation, indexing, and ongoing compliance are distinct states.

No AI recommendation, search result, booking flow, or customer-facing profile may treat an unverified or unpublished record as active marketplace supply.

## 3. Lifecycle

```text
Draft
  ↓
Submitted
  ↓
Under Review
  ├── Needs Changes → Draft/Resubmission
  ├── Rejected → Closed / Appeal
  └── Approved
        ↓
      Active
        ↓
  Suspended / Expired / Archived
```

For regulated providers, approval requires the applicable verification evidence and policy checks before activation.

A business may have independently managed verification states for identity, professional credentials, location, ownership, catalog content, and compliance.

## 4. Separation of Concerns

### Identity

Establishes who the actor is and which account/workspace they control.

### Business Profile

Stores the marketplace representation: name, description, categories, locations, contacts, operating information, languages, media, social links, and public status.

### Verification

Collects evidence, evaluates it, records reviewer/system decisions, expiry, provenance, and audit history.

### Catalog

Owns services/products, prices, variants, attributes, portfolio items, and other supply-side inventory.

### Discovery Index

Projects approved, published data into search/semantic indexes. The index is disposable and never the source of truth.

### AI

May extract, normalize, summarize, classify, and suggest; it cannot approve credentials or activate a business.

## 5. Business Workspace Model

Every business operates inside a tenant/workspace boundary.

Recommended entities:

- `business_profiles`
- `business_categories`
- `business_locations`
- `business_contacts`
- `business_hours`
- `business_social_links`
- `business_languages`
- `business_status_history`
- `business_service_settings`
- `verification_cases`
- `verification_documents`
- `verification_checks`
- `verification_decisions`
- `verification_requirements`
- `verification_events`

Existing platform identity and membership tables remain authoritative for users and access.

## 6. Ownership Rules

The Business module owns business profile data.

The Verification module owns evidence and verification decisions.

The Catalog module owns services/products and their marketplace attributes.

The Media module owns uploaded media objects and variants.

The Discovery module owns only derived search/index records.

Cross-module access uses typed application services, commands, or versioned events. A module must not directly query another module's private tables.

## 7. Onboarding Steps

### Step 1 — Account and Workspace

Create or select the business workspace and assign the initial owner.

### Step 2 — Business Basics

Collect minimum required information:

- legal/display name
- business type
- industry/category
- description
- contact methods
- operating location(s)
- supported languages
- timezone/country

### Step 3 — Services or Products

Create the initial catalog. Beauty businesses should be able to define services, prices, duration where relevant, portfolio, and discounts. Fashion businesses should define products, prices, sizes/variants, inventory signals, and style attributes.

### Step 4 — Media

Upload portfolio/product imagery through the Media module. Store metadata and processing state separately from the business profile.

### Step 5 — Verification

Determine required checks from industry + country + business type + risk policy.

### Step 6 — Review

Automated checks may pre-process evidence, detect missing fields, compare structured information, and flag risk. Human review remains authoritative for controlled verification decisions.

### Step 7 — Publication

Only after required gates pass may the profile become customer-visible and eligible for Discovery indexing.

## 8. Verification Architecture

Verification is policy-driven rather than a single boolean.

Example requirement set:

```text
identity → required
business ownership → required
location → required where applicable
professional credential → required for regulated provider
catalog completeness → required for marketplace publication
content policy → required
```

Each requirement has:

- requirement id/version
- jurisdiction/industry scope
- required evidence type
- expiry behavior
- reviewer role
- automated-check allowance
- escalation policy
- effective dates

## 9. Verification Evidence

Evidence must be treated as sensitive data according to its classification.

The database stores metadata and references; binary documents belong in protected object storage.

Never expose verification documents through public profile URLs.

Recommended metadata:

- document id
- verification case id
- type
- storage reference
- checksum/content hash
- issuer metadata when available
- submitted-at
- expiry-at
- processing status
- classification
- retention policy
- access/audit metadata

Do not store unnecessary copies of documents.

## 10. Automated Checks

Automation can perform deterministic checks such as:

- required-field completeness
- document type detection
- expiry detection
- metadata consistency
- duplicate evidence detection
- image/document quality checks
- policy-rule matching
- catalog completeness

Automation produces **signals**, not unrestricted approval authority.

For high-risk or regulated verification, policy determines whether human approval is mandatory.

## 11. Medical Boundary

Medical onboarding has an explicit safety boundary.

Before activation, applicable professional credentials must be verified according to the configured jurisdictional requirements.

Phoenix may expose verified provider/service information, matching, scheduling/contact, and organization of user-provided information.

Phoenix must not use onboarding AI to:

- diagnose a patient
- prescribe medication
- recommend treatment
- fabricate professional credentials
- infer that an unverified provider is qualified
- convert a provider's marketing claim into a verified medical fact

Sensitive health-related information requires appropriate consent, access control, retention, and audit handling.

## 12. Profile Publication Gates

A profile is eligible for publication only when:

```text
workspace active
AND required fields complete
AND required verification checks passed
AND policy checks passed
AND no blocking moderation state
AND publication status = approved
```

For regulated businesses, an additional credential gate is mandatory.

The publication decision is deterministic and auditable.

## 13. Business Status vs Verification Status

Do not collapse these into one field.

Example:

```text
business_status = active
verification_status = credential_expired
```

The resulting policy may make the business temporarily ineligible for certain discovery/booking capabilities without destroying its underlying profile.

Similarly:

```text
business_status = suspended
verification_status = verified
```

A verified business can still be suspended for moderation, billing, legal, or platform reasons.

## 14. Catalog Readiness

A business can have an approved profile while individual services/products remain unavailable.

Each supply item should have its own publication/readiness state where required:

```text
draft → review → published → paused → archived
```

Discovery must index only items that satisfy both business-level and item-level eligibility.

## 15. Discovery Integration

Publication changes emit versioned events such as:

- `business.profile.published.v1`
- `business.profile.updated.v1`
- `business.profile.suspended.v1`
- `verification.status.changed.v1`
- `catalog.item.published.v1`
- `catalog.item.unpublished.v1`

The Discovery module consumes these events through the outbox pattern and updates derived indexes asynchronously.

Indexing must be idempotent and version-aware.

## 16. AI-Assisted Onboarding

AI may help the operator by:

- converting natural-language descriptions into structured fields
- suggesting categories
- extracting service/product attributes
- detecting missing information
- drafting descriptions
- translating/localizing approved content
- identifying possible duplicates
- flagging inconsistent claims for review

Every AI-produced field must carry provenance when it matters operationally:

```text
source = user | verified_document | ai_suggestion | imported_data | reviewer
```

AI suggestions are not automatically authoritative.

## 17. Trust and Quality Signals

Marketplace quality can use signals such as:

- verification completeness
- profile completeness
- response rate
- customer feedback
- service reliability
- content quality
- freshness
- cancellation/no-show metrics where applicable
- successful interactions

These signals must not be manipulable by arbitrary self-reported claims.

Sensitive or regulated attributes must not be inferred merely because a model predicts them.

## 18. Internationalization

The onboarding model must support:

- multiple languages
- RTL/LTR
- country-specific addresses
- local phone formats
- currencies
- timezones
- calendars, including Jalali adapters
- country-specific verification requirements
- local legal/compliance policies

Country rules belong in policy/configuration modules, not scattered through domain code.

## 19. Permission Model

Example permissions:

```text
business.read
business.update
business.manage_members
business.publish
business.suspend
business.verification.submit
business.verification.view
business.verification.review
business.verification.approve
business.catalog.manage
business.media.manage
```

A user having `business.update` must not implicitly receive `business.verification.approve`.

Separation of duties should prevent an actor from approving high-risk evidence they are not authorized to review.

## 20. Audit Requirements

Audit every meaningful state transition:

- submission
- evidence upload/reference
- automated check
- reviewer assignment
- reviewer decision
- approval/rejection
- appeal
- suspension
- credential expiry
- publication/unpublication
- privileged profile edits

Audit entries should include actor, tenant/workspace, target, action, timestamp, request/correlation id, policy/version where relevant, and outcome.

## 21. Privacy and Retention

Verification data follows least-privilege access.

Retention must be explicit per evidence type and jurisdiction. Expired evidence should trigger policy evaluation rather than silently remaining trusted forever.

Deletion/retention workflows must preserve required audit records without unnecessarily retaining the underlying sensitive document.

## 22. Anti-Fraud and Abuse

Design for:

- duplicate businesses
- repeated failed verification
- synthetic profiles
- stolen/copied portfolio content
- misleading pricing
- fake reviews/signals
- verification document reuse
- account takeover
- automated onboarding abuse

Rate limits, risk scoring, review queues, and challenge mechanisms belong in the security/risk layer and should be invoked through policy rather than embedded in UI code.

## 23. API Contract

Suggested endpoints:

```text
POST   /api/v1/businesses
GET    /api/v1/businesses/:id
PATCH  /api/v1/businesses/:id
POST   /api/v1/businesses/:id/submit
POST   /api/v1/businesses/:id/publish
POST   /api/v1/businesses/:id/suspend
GET    /api/v1/businesses/:id/verification
POST   /api/v1/businesses/:id/verification/submit
GET    /api/v1/businesses/:id/catalog
```

Administrative review endpoints must be separately permissioned and must not reuse customer-facing authorization assumptions.

## 24. State Machine Rules

State transitions must be explicit commands, not arbitrary status updates.

Examples:

```text
submitOnboarding()
approveVerification()
requestChanges()
rejectVerification()
publishBusiness()
suspendBusiness()
expireCredential()
```

Each command validates current state, actor permission, policy, and required invariants inside the application layer.

## 25. Performance

Onboarding writes remain strongly consistent in D1 transactions where appropriate.

Heavy work is asynchronous:

- image processing
- document processing
- duplicate detection
- embeddings
- search indexing
- translation
- analytics aggregation

Customer-facing publication should not wait for non-critical derived indexes.

## 26. Failure Model

If Discovery indexing fails after publication, the business remains published in the source of truth and a retryable indexing job is created.

If verification service automation fails, the case enters a retry/reviewable state; it must not silently become approved.

If a required credential expires, policy reevaluates eligibility and emits the appropriate event.

## 27. Testing

Required tests:

- lifecycle state-machine tests
- permission matrix tests
- tenant-isolation tests
- verification requirement tests
- expiry tests
- publication gate tests
- medical safety tests
- event/outbox idempotency tests
- discovery indexing tests
- malicious upload/abuse tests
- AI provenance tests
- multilingual/RTL tests
- country-policy adapter tests

## 28. Implementation Order

1. Business domain model and repositories
2. Workspace/member authorization integration
3. Onboarding state machine
4. Verification case/evidence model
5. Policy-driven requirements
6. Review queue and audit
7. Publication gates
8. Catalog readiness integration
9. Outbox events
10. Discovery indexing integration
11. AI-assisted onboarding
12. International/country adapters
13. Fraud/risk enhancements

## 29. Definition of Done

A Business Onboarding implementation is complete only when:

- no unapproved business can appear as active marketplace supply;
- verification is modeled independently from business status;
- regulated-provider credentials are handled through explicit policy gates;
- AI cannot approve or activate a provider by itself;
- sensitive evidence is protected and auditable;
- all privileged transitions are permissioned and audited;
- Discovery indexes only eligible published records;
- events are versioned and idempotent;
- country/legal requirements are adapter-driven;
- tests cover lifecycle, authorization, tenancy, privacy, safety, and publication invariants.
