# Phoenix Domain Architecture Freeze

**Status:** IMPLEMENTATION READY
**Decision:** Domain ownership, source-of-truth, and capability boundaries are frozen for implementation.

## 1. Purpose

This document closes the ownership/reconciliation phase. It is a gate for implementation, not a new domain model.

The canonical architecture already established in `DATABASE_MODEL.md`, `ARCHITECTURE_CONTRACTS.md`, `CANONICAL_DOMAIN_DICTIONARY.md`, `DATA_MODEL_RECONCILIATION.md`, and `CAPABILITY_CONTRACT_MATRIX.md` remains authoritative.

## 2. Frozen ownership map

| Domain | Canonical owner | Authoritative state |
|---|---|---|
| Identity / Tenancy | Identity | User, Organization, Workspace, Membership |
| Authorization | Access | Roles, Permissions, policy decisions |
| Business supply | Business | Business, Location, lifecycle |
| Catalog | Catalog | Category, Service, Product, Variant, Offering, Price, Inventory |
| Media | Media | MediaAsset and processing metadata |
| Customer | Customer | Customer, Profile, Relationship |
| Booking / Availability | Booking | Booking, BookingItem, Appointment, Schedule, Resource, availability rules/results |
| Commerce | Commerce | Cart, Order, Payment, Refund, transaction snapshots |
| Trust / Verification | Trust | Verification cases/evidence/checks/decisions, Reviews, Trust signals |
| Matching | Matching | Need/request, candidate relation, match run/result |
| Discovery | Discovery | Search/index/projection state only |
| Communication | Communication | Conversation, Message, Notification, Delivery |
| AI | AI + canonical AI Runtime | Agent/context; AI execution via Runtime |
| Automation | Automation | Workflow and execution |
| Billing | Billing | Plans, subscriptions, entitlements, usage, customer billing |
| Integration | Integration | External accounts, webhooks, sync state |
| Platform | Platform | Audit, idempotency, outbox, module lifecycle |

## 3. Non-entities / non-owners

The following must not become parallel authoritative entities without an explicit ADR:

- Provider: role/concept; Business is the marketplace supply entity.
- Slot: computed/operational availability result; not availability source of truth.
- Recommendation: result/presentation, not domain truth.
- TrustScore: derived projection, not verification truth.
- Search document/index: Discovery projection, never Catalog/Business truth.
- AI Tool: adapter over a canonical capability.
- Workflow Action: capability invocation definition, not a second capability.
- API/UI/Plugin/Agent: consumers or adapters, not alternate domain owners.

## 4. Frozen capability rule

Every behavior has exactly one canonical capability owner.

```text
Domain truth
  -> Domain rules
  -> Canonical capability
  -> API / UI / AI Tool / Workflow / Plugin / Integration
```

Consumers must never access another module's repository/table directly to reproduce domain behavior.

AI and plugins cannot mutate authoritative state except by invoking the owning canonical capability.

## 5. Frozen source-of-truth rules

1. D1 is the relational source of truth for canonical domain state.
2. Projections, indexes, embeddings, caches, analytics, and AI context are rebuildable/derived.
3. Historical transactions use immutable snapshots where mutable source data could change meaning.
4. Availability is calculated through one Booking capability and reused by all consumers.
5. Pricing is owned by Catalog for marketplace offering pricing; Billing owns customer plan/usage pricing.
6. Verification truth belongs to Trust; Business consumes verification decisions through contracts/events.
7. Discovery never becomes a source of truth for Business/Catalog/Trust.
8. AI execution records use the canonical AI Runtime model; feature-specific execution ledgers are prohibited.

## 6. Frozen cross-domain access rule

Cross-module interaction is through:

- canonical capabilities;
- typed application/domain contracts;
- versioned events;
- approved projection consumers.

Physical foreign keys may enforce structural integrity, but they do not authorize runtime business access.

## 7. What remains allowed during coding

Coding may refine implementation details without reopening ownership:

- repository/query implementation;
- transaction boundaries already defined by the owning capability;
- indexes and constraints required by the approved physical schema;
- adapters and integrations;
- performance optimizations;
- projection/materialization details;
- tests and observability;
- compatible contract extensions.

## 8. What requires an ADR before changing

Ownership must not silently change. An explicit ADR is required for:

- creating a new authoritative entity for an existing concept;
- transferring an entity/capability to another module;
- introducing a second source of truth;
- introducing a second authorization, availability, billing, AI-runtime, or moderation engine;
- changing a frozen aggregate boundary in a way that affects external contracts;
- making a projection authoritative.

## 9. Implementation gate

**OWNERSHIP PHASE: CLOSED.**

The project may now proceed to implementation. Future coding tasks must first reuse the frozen contracts and only create a new capability/entity when the behavior is genuinely new.

No additional general-purpose ownership audit is required before coding.
