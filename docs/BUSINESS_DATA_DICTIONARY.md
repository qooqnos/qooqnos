# Phoenix Business Domain Data Dictionary

**Status:** Canonical data contract  
**Scope:** Business identity within the marketplace, locations, serviceability, public profile state, and onboarding references.

## 1. Business

Canonical business representation.

Fields:
- id;
- tenant_id;
- legal_name_reference;
- display_name;
- business_type;
- status;
- primary_locale;
- timezone;
- created_at;
- updated_at.

Business owns the marketplace business record. Identity owns actor/account identity.

## 2. BusinessLocation

A location at which a business operates or provides service.

Fields:
- id;
- business_id;
- location_type;
- address_reference;
- geo_reference;
- service_radius;
- timezone;
- status;
- created_at;
- updated_at.

Exact sensitive address data follows privacy policy.

## 3. BusinessContact

Business contact channel references.

Fields:
- id;
- business_id;
- channel_type;
- channel_reference;
- purpose;
- visibility;
- verification_reference;
- status.

Communications owns message delivery; Business owns business contact configuration.

## 4. BusinessOperatingSchedule

Business availability window configuration.

Fields:
- id;
- business_id;
- location_id;
- day_rule;
- opening_time;
- closing_time;
- timezone;
- effective_from;
- effective_to;
- status.

Actual appointment availability remains owned by Booking where applicable.

## 5. BusinessProfile

Public-facing business information projection.

Fields:
- business_id;
- display_name;
- description_reference;
- category_refs;
- location_refs;
- service_refs;
- media_refs;
- trust_reference;
- visibility_status;
- locale;
- profile_version;
- updated_at.

Profile is a projection assembled from authoritative business/domain references; it must not become a second source of truth.

## 6. BusinessServiceReference

Reference to services offered by the business.

Fields:
- business_id;
- service_id;
- status;
- display_order;
- effective_from;
- effective_to.

Catalog/Service domain owns service definition and pricing.

## 7. BusinessOnboardingReference

Reference to onboarding state.

Fields:
- business_id;
- onboarding_case_id;
- current_stage;
- verification_status;
- submitted_at;
- completed_at.

The onboarding workflow coordinates registration; Trust owns verification decisions.

## 8. BusinessVisibility

Public discoverability state.

Fields:
- business_id;
- visibility;
- reason;
- effective_from;
- effective_to;
- policy_version.

Business owns activation/visibility eligibility; Discovery owns searchable projections.

## 9. State Machines

### Business lifecycle

The physical \`businesses.status\` vocabulary is canonical and intentionally remains:

\`\`\`text
DRAFT → ACTIVE
DRAFT → SUSPENDED
ACTIVE ↔ SUSPENDED
ACTIVE → ARCHIVED
SUSPENDED → ARCHIVED
\`\`\`

\`Business.status\` is the marketplace-supply lifecycle. It is **not** the onboarding workflow state and it is **not** the verification decision.

### Onboarding workflow

The existing \`onboarding_profiles.status\` vocabulary is a separate workflow state:

\`\`\`text
DRAFT → SUBMITTED → VERIFIED
                    └→ REJECTED
\`\`\`

The onboarding capability owns this workflow. Trust owns verification evidence/decisions; the onboarding status is the workflow outcome/reference used by Business activation policy.

Therefore:

- \`submitted\`, \`verified\`, and \`rejected\` must not be added to \`businesses.status\`.
- \`onboarding_profiles.status\` must not be duplicated into a new Business lifecycle table.
- Business activation remains policy-gated and may require a verified onboarding/trust state.
- Suspension/archival are Business lifecycle transitions and remain in \`business_status_history\`.

### Location

\`\`\`text
DRAFT → ACTIVE → INACTIVE
\`\`\`

## 10. Ownership Matrix

| Data | Owner |
|---|---|
| Business record | Business |
| Actor/account identity | Identity |
| Verification | Trust |
| Services/products | Catalog |
| Inventory | Catalog |
| Booking availability | Booking |
| Customer relationship | CRM |
| Promotions | Promotion |
| Loyalty | Loyalty |
| Public discovery projection | Discovery |
| Media assets | Media |
| Communications | Communications |
| Financial truth | Billing/Commerce |

## 11. Privacy and Security

Business records are tenant-scoped.

Sensitive legal/contact information requires classification and authorization.

Public profile data must be explicitly marked public; private onboarding evidence is never implicitly public.

## 12. Idempotency and Concurrency

Business creation and onboarding synchronization must be idempotent.

Updates use optimistic concurrency/version validation.

External onboarding callbacks require idempotency keys.

## 13. Audit

Material lifecycle changes reference:
- actor/service identity;
- tenant;
- action;
- target;
- timestamp;
- request/correlation ID;
- policy/verification references.

## 14. Canonical Capabilities

```text
CAP.BUSINESS.CREATE
CAP.BUSINESS.GET
CAP.BUSINESS.UPDATE
CAP.BUSINESS.LIST
CAP.BUSINESS.MANAGE_LOCATIONS
CAP.BUSINESS.MANAGE_CONTACTS
CAP.BUSINESS.MANAGE_SCHEDULE
CAP.BUSINESS.ACTIVATE
CAP.BUSINESS.SUSPEND
CAP.BUSINESS.DEACTIVATE
CAP.BUSINESS.UPDATE_VISIBILITY
```

## 15. Canonical Events

```text
business.created
business.updated
business.location.changed
business.schedule.changed
business.submitted
business.activated
business.suspended
business.deactivated
business.visibility.changed
```

## 16. AI Boundary

AI may assist with:
- profile drafting;
- normalization;
- categorization suggestions;
- completeness detection;
- onboarding guidance.

AI may not:
- invent business facts;
- bypass verification;
- activate a business;
- fabricate credentials;
- overwrite authoritative business records without authorized capability.

## 17. Invariants

1. Business and Identity are distinct.
2. Verification truth belongs to Trust.
3. Product/service truth belongs to Catalog.
4. Booking owns actual appointment availability.
5. Public profile is not private onboarding evidence.
6. Activation is policy-gated.
7. Tenant isolation is mandatory.
8. AI output is non-authoritative until accepted through canonical capability.
9. IDs are opaque and timestamps UTC.
10. Historical lifecycle changes remain auditable.

## 18. Anti-Duplication

There is exactly one Business domain model.

Do not create BeautyBusiness, FashionBusiness, MedicalBusiness, or AI-specific business profiles.

Vertical differences use categories, services, policies, adapters, and configuration.

## 19. Definition of Done

Business identity, locations, contacts, operating configuration, profile projection, onboarding reference, visibility, lifecycle, ownership, privacy, authorization, capabilities, events, and anti-duplication rules are canonical.
