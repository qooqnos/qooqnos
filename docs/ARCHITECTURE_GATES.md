# Phoenix Architecture Gates

**Status:** Canonical architecture decision record
**Scope:** Final decisions required before migration blueprint and implementation of the canonical domain model.

This document closes the remaining physical/logical schema gates. It is an architecture contract, not implementation code. Any later change to a closed gate requires an explicit ADR and impact review against capabilities, migrations, plugins, projections, AI tools, and historical data.

## 1. Gate policy

A gate is **closed** only when the decision, ownership, invariants, physical representation, consumer contract, and migration consequence are explicit.

Rules:

1. Closed gates are canonical defaults.
2. A module may extend a gate only through its public capability contract.
3. A module may not create a competing source of truth.
4. Polymorphism is exceptional and requires a controlled contract.
5. Historical transaction meaning is preserved through immutable snapshots.
6. Projections, caches, embeddings, memories, and search indexes never become domain authority.
7. Every gate must remain compatible with tenant isolation and authorization.

## 2. Gate 01 — Address

**Decision: Structured canonical Address value object.**

Address is not a global aggregate and is not a competing Location entity.

Canonical logical fields:

```text
country_code
administrative_area?
locality?
district?
postal_code?
street_line_1?
street_line_2?
building_number?
unit?
formatted?
locale?
```

Rules:

- `country_code` uses ISO-compatible country vocabulary.
- Postal and administrative fields are nullable because address formats differ by country.
- `formatted` is presentation, not authoritative decomposition.
- `GeoPoint` is separate from Address.
- Address snapshots may be embedded in historical transactions when historical location matters.
- Sensitive classification depends on context; a CustomerAddress is personal data, while a public Business Location may have different exposure rules.

**Owner:** Shared Kernel semantics; consuming module owns persistence context.

## 3. Gate 02 — Role scope

**Decision: roles are scope-bound access definitions.**

Canonical role scopes:

| Scope | Meaning |
|---|---|
| GLOBAL | platform-wide authority |
| ORGANIZATION | organization administration |
| WORKSPACE | workspace administration |
| BUSINESS | business-specific authority |
| USER | user-owned/self-service authority |

A role is assigned through `membership_roles`; the assignment must be valid for the membership's tenant scope.

Rules:

- A role does not silently cross its declared scope.
- Permission is the action primitive; role is a reusable permission bundle.
- Ownership is not a hidden role entity.
- ABAC may further constrain a valid role permission.
- Entitlement never replaces permission.

**Owner:** Access module.

## 4. Gate 03 — Resource taxonomy

**Decision: Resource is a scheduling/operational capacity entity, not Provider.**

Canonical resource model:

```text
Resource
├── resource_type
├── Business
├── optional Location
├── capacity
├── status
└── metadata
```

Initial resource types are vocabulary values rather than separate entity tables:

- PERSON
- ROOM
- EQUIPMENT
- VEHICLE
- SERVICE_AREA
- OTHER

A resource may later gain type-specific capability data through a module-owned extension, but a new resource type does not create a second Resource entity.

Rules:

- Provider/Staff is a business role/concept until an explicit domain need requires an independent aggregate.
- Resource participates in scheduling; it does not own Booking.
- Capacity and allocation rules belong to Booking/Availability capabilities.
- Resource references must obey Business tenant boundaries.

**Owner:** Booking/Availability module.

## 5. Gate 04 — BookingItem snapshots

**Decision: BookingItem is the historical commercial snapshot boundary.**

At booking commit, BookingItem preserves at minimum:

```text
offering_id
quantity
title_snapshot
price_minor_snapshot
currency_snapshot
duration_snapshot?
policy_snapshot?
tax_snapshot?
discount_snapshot?
```

Rules:

- Catalog changes never rewrite committed booking meaning.
- Snapshot fields become immutable after commit.
- `offering_id` remains a provenance reference; it is not sufficient to reconstruct history.
- Booking totals must be reproducible from committed item/snapshot semantics and the canonical pricing policy.
- New pricing logic must not reinterpret historical bookings.

**Owner:** Booking module for booking snapshots; source values originate through Catalog/Commerce capabilities.

## 6. Gate 05 — Review target matrix

**Decision: typed target references for canonical Review targets.**

Initial canonical targets:

| Target | Allowed |
|---|---|
| Business | YES |
| Offering | YES |
| Product | YES, if marketplace review semantics require it |
| Appointment | NO by default |
| Booking | NO by default |
| Customer | NO |
| User | NO |
| Category | NO |

A Review has exactly one target. The physical model should prefer nullable typed FKs plus a domain-level exactly-one-target invariant over unconstrained `target_type/target_id`.

Adding a new target requires a domain decision because it changes moderation, aggregation, authorization, projections, and trust semantics.

Rating is a value object within Review; TrustScore is derived/projection data.

**Owner:** Trust module.

## 7. Gate 06 — Offering composition

**Decision: composition is explicit and bounded; Package/Bundle is not a second Offering entity.**

Canonical model:

```text
Offering
├── offering_type
├── optional Service reference
├── optional Product reference
└── optional OfferingComponent relationships
```

For composite offerings, use a relationship such as:

```text
OfferingComponent
- parent_offering_id
- component_offering_id
- quantity
- sequence
- component_role
```

Rules:

- A composite offering remains one sellable Offering.
- Component offerings remain independently owned Catalog records.
- Composition cannot introduce cycles.
- Pricing policy decides whether component prices are exposed, rolled up, or overridden.
- Package/Bundle is a business classification/type, not a duplicate aggregate unless future requirements prove independent lifecycle is necessary.

**Owner:** Catalog module.

## 8. Gate 07 — Tax and discount ownership

**Decision: Commerce owns transaction-time financial snapshots; Catalog owns base prices; Billing owns subscription entitlement economics.**

Boundaries:

```text
Catalog
  → base price / pricing rules

Commerce
  → order-time tax/discount calculation and immutable transaction snapshots

Booking
  → booking-time commercial snapshot where booking is directly transacted

Billing
  → subscription/plan/usage economics
```

Rules:

- No global TaxService and DiscountService may compete with Commerce's canonical transaction calculation contract.
- Tax/discount definitions may be reusable policies, but the transaction result is snapshotted.
- Historical order/booking amounts never depend on current tax or discount configuration.
- Currency and minor units remain canonical.

**Owner:** Commerce for transaction calculation; Billing for subscription economics.

## 9. Gate 08 — Payment provider reference

**Decision: Payment is provider-neutral domain state; Integration owns provider adapters and credentials.**

Payment stores:

```text
provider
integration_id?
external_reference?
status
amount_minor
currency
```

Payment does not store provider secrets, access tokens, webhook signing secrets, or provider-specific credential material.

Provider adapters expose canonical payment capabilities such as:

```text
CAP.COMMERCE.CREATE_PAYMENT
CAP.COMMERCE.CAPTURE_PAYMENT
CAP.COMMERCE.REFUND_PAYMENT
```

Provider-specific behavior is an Integration concern and must map into the canonical Commerce contract.

**Owner:** Commerce for Payment; Integration for adapter/credential lifecycle.

## 10. Gate 09 — Search and vector projections

**Decision: Search and vector stores are rebuildable projections, never transactional truth.**

Canonical flow:

```text
Domain mutation
    ↓
Canonical event
    ↓
Projection/index pipeline
    ↓
Search/vector representation
```

Rules:

- Search documents reference canonical entity IDs.
- Vector embeddings store provenance: entity ID, projection version, embedding/model version, timestamp.
- Indexes can be deleted and rebuilt from canonical state/events.
- Search ranking is a projection/decision output, not a persisted domain fact unless explicitly snapshotted for historical audit.
- No domain write may depend on search-index availability.

**Owner:** Discovery for search projection; AI for embedding/model representation where applicable.

## 11. Gate 10 — AI Memory

**Decision: AI Memory is contextual, consent-aware, expirable, and non-authoritative.**

Canonical fields/semantics:

```text
id
owner_scope
owner_reference
memory_type
content/reference
provenance
consent_reference?
classification
created_at
expires_at?
deleted_at?
version
```

Rules:

- Memory is not Business, Customer, Booking, Order, Payment, or User source of truth.
- A memory may contain a reference to canonical domain data, but consumers must resolve authoritative state through domain capabilities.
- Memory must support retention/expiry and deletion semantics.
- Sensitive memory requires explicit policy/consent handling.
- Embeddings are projections of memory, not the memory source itself.
- AI may propose a domain change, but the canonical capability performs the mutation.

**Owner:** AI module.

## 12. Gate 11 — Integration / Webhook / Sync

**Decision: Integration owns external connectivity; Webhook and SyncJob are operational records.**

Canonical model:

```text
Integration
├── ExternalAccount
├── ExternalReference
├── Webhook
└── SyncJob
```

Webhook contract:

```text
provider
external_event_id
received_at
status
attempt_count
next_attempt_at?
processed_at?
error_category?
payload_reference?
```

SyncJob contract:

```text
integration_id
sync_type
scope
status
cursor?
started_at
completed_at?
next_run_at?
attempt_count
last_error_category?
```

Rules:

- Webhooks are idempotently ingested.
- External event IDs are unique within provider/integration scope.
- Retry state is operational, not domain state.
- Provider payloads are retained only according to integration retention policy; large/sensitive payloads should use protected storage references.
- Sync jobs are resumable and bounded.
- External IDs never become canonical domain IDs.
- Integration adapters call domain capabilities rather than writing domain tables directly.

**Owner:** Integration module.

## 13. Cross-gate invariants

The following rules apply to all eleven gates:

1. One canonical owner per concept.
2. One implementation per capability.
3. One source of truth per business fact.
4. Cross-module consumption uses public capabilities/events.
5. Cross-tenant references are rejected.
6. Historical snapshots are immutable after their transaction boundary.
7. Projections are rebuildable.
8. External references are not domain identity.
9. AI and plugins consume canonical capabilities; they do not bypass them.
10. Authorization and entitlement checks remain server-side.
11. Schema constraints, domain invariants, and authorization remain separate integrity layers.

## 14. Gate closure status

| Gate | Decision | Status |
|---|---|---|
| Address | Structured Value Object | CLOSED |
| Role Scope | Explicit scope-bound roles | CLOSED |
| Resource | Generic scheduling Resource | CLOSED |
| BookingItem | Immutable transaction snapshot boundary | CLOSED |
| Review Target | Typed canonical targets | CLOSED |
| Offering Composition | Explicit bounded components | CLOSED |
| Tax/Discount | Commerce transaction ownership | CLOSED |
| Payment Provider | Provider-neutral Payment + Integration adapter | CLOSED |
| Search/Vector | Rebuildable projection | CLOSED |
| AI Memory | Non-authoritative contextual memory | CLOSED |
| Integration/Webhook/Sync | Integration-owned operational model | CLOSED |

## 15. Readiness gate for Migration Blueprint

The data model is considered architecturally ready for the Migration Blueprint when:

- all gates above remain CLOSED;
- every table has one owner;
- every relationship has one canonical representation;
- every aggregate has defined transaction boundaries;
- every historical transaction has defined snapshot boundaries;
- every cross-module dependency maps to a capability/event;
- every projection has a rebuild strategy;
- every sensitive record has classification and retention semantics;
- every migration has a module owner and dependency order;
- no second source of truth is introduced.

The next architecture artifact is the **Migration Blueprint**, followed by a migration dependency graph and implementation sequencing plan. No migration SQL is authorized merely by this document.
