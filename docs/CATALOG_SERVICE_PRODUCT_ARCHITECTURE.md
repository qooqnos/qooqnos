# Phoenix Catalog / Service / Product Architecture

## 1. Purpose

The Catalog domain is the authoritative business-facing representation of what a provider offers. Discovery, AI matching, customer presentation, availability and future booking consume catalog contracts; they do not invent catalog facts.

## 2. Core Invariant

> Business owns the offer. Catalog structures it. Policy validates it. Discovery indexes it. AI interprets it but never becomes the source of truth.

Catalog must support beauty first, fashion second, and future industries without forcing industry-specific fields into the core model.

## 3. Domain Boundaries

- `business`: provider identity, organization and locations.
- `catalog`: categories, offerings, services, products, variants, pricing and publication state.
- `media`: images/videos/documents and their lifecycle.
- `availability`: schedules, capacity and bookable inventory when enabled.
- `discovery`: search projections and ranking indexes.
- `verification`: provider/credential verification.
- `booking`: reservations and appointments; catalog never owns booking state.
- `billing`: plans/subscriptions; catalog never owns platform billing.

Cross-module access uses application services and versioned events, not private-table SQL.

## 4. Offer Model

Use a generalized `offer` abstraction with typed details rather than separate incompatible models.

Conceptual structure:

```text
Offer
├── Service
│   ├── duration
│   ├── capacity
│   ├── delivery_mode
│   └── requirements
└── Product
    ├── variants
    ├── SKU
    ├── inventory_reference
    └── attributes
```

An offer has:

- stable opaque ID
- tenant/business ownership
- type
- title and localized content
- category references
- structured attributes
- media references
- pricing policy/reference
- publication state
- version
- timestamps
- provenance

## 5. Publication State Machine

Draft → Pending Review → Published → Suspended → Archived.

Only published offers enter customer discovery. Suspension must immediately prevent new discovery exposure while preserving auditability.

Verification status and publication status are independent. A verified business may still have an unpublished or rejected offer.

## 6. Pricing

Money is represented as integer minor units plus ISO currency.

```text
amount_minor: integer
currency: ISO-4217
pricing_type: fixed | from | range | variable | quote
```

Rules:

- Never use floating point for monetary values.
- Do not let LLMs calculate authoritative prices.
- Country-specific tax/legal rules remain adapters/policies.
- Promotional prices must have explicit validity windows.
- Discovery may display a price projection only with a freshness/version reference.

## 7. Service Pricing

A service may have:

- base price
- duration
- optional add-ons
- price variants
- minimum/maximum price
- member/customer-specific pricing when explicitly supported

Complex pricing belongs in a versioned pricing policy, not prompt logic.

## 8. Product Variants

Fashion requires structured variants such as:

- size
- color
- material
- style
- SKU
- inventory reference

Attributes are schema-driven. Industry modules may define additional attributes without changing the core Offer contract.

## 9. Availability

Catalog stores offer-level availability configuration where appropriate, but real-time booking capacity is owned by the Availability/Booking domain.

Discovery must distinguish:

- `available_now`
- `available_on_date`
- `availability_unknown`

Unknown availability must never be represented as confirmed availability.

## 10. Inventory

Product inventory is authoritative outside discovery indexes. Search indexes receive a versioned projection with freshness metadata.

Never use stale vector metadata to guarantee inventory.

Before an order or other future transactional action, the domain service must revalidate inventory.

## 11. Localization

Every customer-visible textual field must support locale-aware content where applicable.

Normalize:

- Persian/Arabic character variants
- Unicode normalization
- localized numerals
- language
- direction
- timezone
- currency
- calendar representation

Jalali dates are presentation/domain adapters; persisted timestamps remain canonical UTC instants.

## 12. Media

Catalog references media assets owned by the Media module.

Media must provide:

- ownership
- visibility
- moderation status
- content type
- variants
- dimensions
- checksum/version

Untrusted uploaded media is never treated as executable or authoritative instructions for AI.

## 13. Attributes and Schema Evolution

Core attributes are strongly typed. Extensible industry attributes use versioned schemas.

Each schema has:

- schema ID
- version
- validation rules
- locale metadata
- searchable flag
- filterable flag
- semantic-indexing policy

Schema changes must be backward compatible or migrated explicitly.

## 14. Discovery Projection

Catalog publishes events such as:

- `catalog.offer.created.v1`
- `catalog.offer.updated.v1`
- `catalog.offer.published.v1`
- `catalog.offer.suspended.v1`
- `catalog.offer.archived.v1`
- `catalog.price.changed.v1`
- `catalog.availability_projection.updated.v1`

An asynchronous projection pipeline updates lexical/structured indexes and Vectorize embeddings.

The index document should contain only data necessary for retrieval/ranking and must include:

- tenant/workspace
- business ID
- offer ID
- module
- locale
- visibility
- publication state
- content version
- index version
- indexed timestamp

## 15. AI Extraction

AI may convert provider-entered text into a proposed structured draft:

```text
provider input
  → extraction
  → schema validation
  → proposed fields
  → provider confirmation/review
  → domain write
```

AI must not silently publish extracted facts or alter prices, credentials, inventory, medical claims or regulated attributes.

## 16. Medical Boundary

Medical offerings may contain provider-published service information subject to verification and moderation.

The AI layer may help discover and summarize provider-published information, but must not:

- diagnose
- prescribe
- recommend medication
- recommend treatment
- fabricate clinical claims
- infer that a provider is licensed when verification is incomplete

Sensitive health information requires explicit consent and appropriate privacy handling.

## 17. Quality and Anti-Gaming

Catalog quality signals may include:

- completeness
- verified information
- media quality
- freshness
- customer feedback
- cancellation/reliability signals where legitimately available

Providers must not be allowed to manipulate ranking by injecting hidden keywords, fake attributes or misleading structured data.

Sponsored placement, if introduced later, must be clearly labeled and must never override hard eligibility or safety policy.

## 18. Permissions

Minimum permission families:

- `catalog.read`
- `catalog.create`
- `catalog.update`
- `catalog.publish`
- `catalog.suspend`
- `catalog.archive`
- `catalog.price.manage`
- `catalog.media.manage`
- `catalog.review`

Approval permissions should be separable from authoring permissions where separation of duties is required.

## 19. Tenant Isolation

Every catalog record is tenant-scoped. Repository methods require tenant/workspace context.

A request without validated tenant context cannot access catalog records.

Cross-tenant discovery is prohibited unless a deliberately public/global projection explicitly permits it.

## 20. API Contract

Representative API:

```text
POST   /api/v1/catalog/offers
GET    /api/v1/catalog/offers/:id
PATCH  /api/v1/catalog/offers/:id
POST   /api/v1/catalog/offers/:id/publish
POST   /api/v1/catalog/offers/:id/suspend
POST   /api/v1/catalog/offers/:id/archive
POST   /api/v1/catalog/offers/:id/media
GET    /api/v1/catalog/businesses/:businessId/offers
```

All input is schema validated and authorization is evaluated server-side.

## 21. Repository Rules

Repositories must expose domain-oriented methods such as:

```text
createOffer
updateOffer
publishOffer
suspendOffer
archiveOffer
getPublishedOffer
listPublishedOffers
```

Do not expose arbitrary SQL from API or AI layers.

## 22. Caching

Cache keys must include:

- tenant scope
- resource ID
- locale where relevant
- representation/version
- authorization/public visibility context

Publication and suspension events must invalidate affected projections promptly.

## 23. Consistency Model

D1/domain records are authoritative. Discovery indexes are eventually consistent.

The UI must never claim transactional certainty from an index projection.

For mutations requiring immediate correctness, read from the authoritative domain service.

## 24. Testing

Required tests:

- tenant isolation
- permission enforcement
- publication state transitions
- pricing precision
- currency handling
- schema validation
- localization
- media ownership
- stale-index behavior
- suspension propagation
- AI extraction validation
- medical safety boundaries
- concurrent updates/version conflicts

## 25. Implementation Order

1. Offer schema and repository contracts
2. Service model
3. Product/variant model
4. Pricing model
5. Publication workflow
6. Media integration
7. Localization
8. Catalog events/outbox
9. Discovery projection
10. AI extraction helpers
11. Beauty catalog
12. Fashion catalog
13. Medical catalog under verification/moderation policies

## 26. Definition of Done

Catalog is production-ready only when:

- authoritative data lives in D1/domain repositories;
- every mutation is tenant- and permission-checked;
- publication is explicit;
- pricing is integer minor-unit based;
- index projections are versioned and eventually consistent;
- AI cannot silently mutate authoritative facts;
- media is referenced through the Media module;
- localization and country adapters are supported;
- medical restrictions are enforced by deterministic policy;
- audit and outbox records exist for sensitive lifecycle actions;
- tests cover security, consistency and lifecycle transitions.
