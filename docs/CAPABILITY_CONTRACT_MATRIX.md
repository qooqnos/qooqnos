# Phoenix Capability Contract Matrix

**Status:** Canonical architecture contract
**Scope:** Reusable capability ownership, contracts, dependencies, authorization, tenant scope, events, AI/plugin access, and anti-duplication rules.

> This document is architecture-only. It defines contracts and ownership; it does not prescribe implementation classes, repositories, API handlers, or SQL.

## 1. Non-negotiable rules

1. Every meaningful business capability has exactly one owner.
2. A capability is implemented once and reused by every consumer.
3. API, UI, AI Agent, AI Tool, Workflow, Plugin, Admin UI, and Integration are consumers/adapters, not alternate owners.
4. Consumers call public capability contracts, never another module's repository or table directly.
5. AI cannot mutate authoritative domain state except by invoking an authorized domain capability.
6. Plugins cannot redefine or fork a canonical Core/Module capability.
7. Orchestration composes capabilities; it does not duplicate their business rules.
8. A capability contract is versioned independently from module and schema versions.
9. Commands require authorization, tenant validation, transaction semantics, idempotency policy, auditability, and event semantics.
10. Queries never become a second source of truth.

## 2. Contract classification

| Type | Meaning | Mutation | Required contract concerns |
|---|---|---:|---|
| COMMAND | authoritative state change | yes | auth, tenant, transaction, idempotency, audit, events |
| QUERY | authoritative/projection read | no | tenant scope, visibility, consistency |
| DECISION | evaluates rules / produces decision | no by default | inputs, policy version, explanation/provenance |
| ORCHESTRATION | composes existing capabilities | possibly through delegates | dependency graph, no duplicated rules |

## 3. Canonical contract envelope

Every capability is defined by:

```text
ID
Version
Owner Module
Classification
Purpose
Input Contract
Output Contract
Preconditions
Postconditions
Permission Requirements
Entitlement Requirements
Tenant Scope
Dependencies
Transaction Boundary
Idempotency Contract
Events Produced
Events Consumed
Error Contract
AI Accessible
Plugin Accessible
Public/Internal
Compatibility Policy
```

## 4. Identity capabilities

| Capability | Type | Owner | Permission family | Scope | Key dependencies | Events | AI | Plugin |
|---|---|---|---|---|---|---|---|---|
| `CAP.IDENTITY.CREATE_USER` | COMMAND | Identity | identity.user.create | GLOBAL | none | `identity.user.created` | yes | yes |
| `CAP.IDENTITY.GET_USER` | QUERY | Identity | identity.user.read | USER | Access | none | yes | yes |
| `CAP.IDENTITY.UPDATE_PROFILE` | COMMAND | Identity | identity.profile.update | USER | Access, Media | `identity.profile.updated` | yes | yes |
| `CAP.IDENTITY.AUTHENTICATE` | COMMAND | Identity | identity.authenticate | GLOBAL | External Identity | `identity.authenticated` | no | no |
| `CAP.IDENTITY.CREATE_SESSION` | COMMAND | Identity | identity.session.create | USER | Authentication | `identity.session.created` | no | no |
| `CAP.IDENTITY.REVOKE_SESSION` | COMMAND | Identity | identity.session.revoke | USER | Access | `identity.session.revoked` | no | no |
| `CAP.IDENTITY.MANAGE_MEMBERSHIP` | COMMAND | Identity | membership.manage | ORGANIZATION/WORKSPACE | Access | membership lifecycle events | no | yes |

## 5. Access capabilities

| Capability | Type | Owner | Scope | Dependencies | Result |
|---|---|---|---|---|---|
| `CAP.ACCESS.CHECK_PERMISSION` | DECISION | Access | TENANT | identity/membership/roles | allow/deny + reason |
| `CAP.ACCESS.CHECK_POLICY` | DECISION | Access | TENANT | permission + policy context | allow/deny + policy version |
| `CAP.ACCESS.CHECK_ENTITLEMENT` | DECISION | Access/Billing contract | TENANT | subscription/entitlement | allowed + entitlement reason |
| `CAP.ACCESS.RESOLVE_ROLES` | QUERY | Access | TENANT | membership | effective roles |
| `CAP.ACCESS.RESOLVE_PERMISSIONS` | QUERY | Access | TENANT | roles/direct grants | effective permissions |

Authorization is centralized. Individual domain modules must not invent parallel permission evaluators.

## 6. Business capabilities

| Capability | Type | Owner | Scope | Dependencies | Events |
|---|---|---|---|---|---|
| `CAP.BUSINESS.CREATE` | COMMAND | Business | WORKSPACE | Access, Identity | `business.created` |
| `CAP.BUSINESS.UPDATE` | COMMAND | Business | BUSINESS | Access | `business.updated` |
| `CAP.BUSINESS.GET` | QUERY | Business | BUSINESS/PUBLIC | Access/visibility | none |
| `CAP.BUSINESS.ACTIVATE` | COMMAND | Business | BUSINESS | Access, Verification policy | `business.activated` |
| `CAP.BUSINESS.SUSPEND` | COMMAND | Business | BUSINESS | Access, policy | `business.suspended` |
| `CAP.BUSINESS.MANAGE_LOCATION` | COMMAND | Business | BUSINESS | Access | `business.location.changed` |
| `CAP.BUSINESS.MANAGE_PROFILE` | COMMAND | Business | BUSINESS | Access, Media | `business.profile.updated` |

Activation must not be implemented independently by Admin, Verification, AI, or Plugin consumers.

## 7. Catalog capabilities

| Capability | Type | Owner | Scope | Dependencies | Events |
|---|---|---|---|---|---|
| `CAP.CATALOG.CREATE_OFFERING` | COMMAND | Catalog | BUSINESS | Access, Business | `catalog.offering.created` |
| `CAP.CATALOG.UPDATE_OFFERING` | COMMAND | Catalog | BUSINESS | Access, Business | `catalog.offering.updated` |
| `CAP.CATALOG.GET_OFFERING` | QUERY | Catalog | BUSINESS/PUBLIC | visibility | none |
| `CAP.CATALOG.SEARCH_OFFERINGS` | QUERY | Catalog/Discovery contract | TENANT/PUBLIC | Discovery projection | none |
| `CAP.CATALOG.CREATE_PRODUCT` | COMMAND | Catalog | BUSINESS | Access, Business | `catalog.product.created` |
| `CAP.CATALOG.UPDATE_PRODUCT` | COMMAND | Catalog | BUSINESS | Access | `catalog.product.updated` |
| `CAP.CATALOG.MANAGE_VARIANT` | COMMAND | Catalog | BUSINESS | Product | `catalog.variant.changed` |
| `CAP.CATALOG.MANAGE_CATEGORY` | COMMAND | Catalog | PLATFORM/TENANT | Access | `catalog.category.changed` |
| `CAP.CATALOG.SET_PRICE` | COMMAND | Catalog | BUSINESS | Offering/Product | `catalog.price.changed` |
| `CAP.CATALOG.GET_PRICE` | QUERY | Catalog | BUSINESS/PUBLIC | Pricing rules | none |
| `CAP.CATALOG.MANAGE_INVENTORY` | COMMAND | Catalog | BUSINESS/LOCATION | Product, Location | `catalog.inventory.changed` |

## 8. Discovery capabilities

| Capability | Type | Owner | Scope | Dependencies | Events/inputs |
|---|---|---|---|---|---|
| `CAP.DISCOVERY.SEARCH` | QUERY | Discovery | PUBLIC/TENANT | Search projection | catalog/business events |
| `CAP.DISCOVERY.FILTER` | QUERY | Discovery | PUBLIC/TENANT | Search projection | none |
| `CAP.DISCOVERY.FACET` | QUERY | Discovery | PUBLIC/TENANT | Search projection | none |
| `CAP.DISCOVERY.RANK` | DECISION | Discovery | PUBLIC/TENANT | ranking features | ranking model/version |
| `CAP.DISCOVERY.SUGGEST` | QUERY | Discovery | PUBLIC/TENANT | search/index | none |
| `CAP.DISCOVERY.GET_PROJECTION` | QUERY | Discovery | TENANT/PUBLIC | projection store | none |

Discovery never writes canonical Business or Catalog state.

## 9. Matching capabilities

| Capability | Type | Owner | Scope | Dependencies | Result |
|---|---|---|---|---|---|
| `CAP.MATCHING.CREATE_REQUEST` | COMMAND | Matching | CUSTOMER/WORKSPACE | Customer, Access | `matching.request.created` |
| `CAP.MATCHING.UPDATE_REQUEST` | COMMAND | Matching | CUSTOMER/WORKSPACE | Access | `matching.request.updated` |
| `CAP.MATCHING.FIND_CANDIDATES` | QUERY | Matching | TENANT/PUBLIC | Discovery, Catalog | candidate set |
| `CAP.MATCHING.MATCH` | ORCHESTRATION | Matching | TENANT | candidate retrieval + constraints | matches |
| `CAP.MATCHING.SCORE` | DECISION | Matching | TENANT | trust, availability, preferences | score + provenance |
| `CAP.MATCHING.RANK` | DECISION | Matching | TENANT | score | ordered candidates |
| `CAP.MATCHING.EXPLAIN` | DECISION | Matching | TENANT | score/ranking provenance | explanation |
| `CAP.MATCHING.RECOMMEND` | ORCHESTRATION | Matching | CUSTOMER | search/match/rank/policy | recommendations |

Hard constraints must be applied before semantic similarity can influence ranking.

## 10. Booking capabilities

| Capability | Type | Owner | Scope | Key dependencies | Events |
|---|---|---|---|---|---|
| `CAP.BOOKING.CHECK_AVAILABILITY` | QUERY | Booking | BUSINESS/LOCATION | schedules, resources, catalog | none |
| `CAP.BOOKING.GET_SLOTS` | QUERY | Booking | BUSINESS | availability | none |
| `CAP.BOOKING.HOLD_SLOT` | COMMAND | Booking | BUSINESS | availability, Access | `booking.slot.held` |
| `CAP.BOOKING.RELEASE_SLOT` | COMMAND | Booking | BUSINESS | hold state | `booking.slot.released` |
| `CAP.BOOKING.CREATE` | COMMAND | Booking | WORKSPACE | Customer, Catalog, Availability, Access, Pricing | `booking.created` |
| `CAP.BOOKING.CONFIRM` | COMMAND | Booking | WORKSPACE | Access, availability, policy | `booking.confirmed` |
| `CAP.BOOKING.RESCHEDULE` | COMMAND | Booking | WORKSPACE | availability, policy | `booking.rescheduled` |
| `CAP.BOOKING.CANCEL` | COMMAND | Booking | WORKSPACE | policy, Access | `booking.cancelled` |
| `CAP.BOOKING.COMPLETE` | COMMAND | Booking | WORKSPACE | Access | `booking.completed` |
| `CAP.BOOKING.GET` | QUERY | Booking | WORKSPACE/PUBLIC | visibility | none |

`CAP.BOOKING.CHECK_AVAILABILITY` is the single canonical availability behavior. Calendar plugins, AI agents, UI, matching, and automation consume it rather than calculating availability independently.

## 11. Commerce capabilities

| Capability | Type | Owner | Scope | Dependencies | Events |
|---|---|---|---|---|---|
| `CAP.COMMERCE.CREATE_CART` | COMMAND | Commerce | CUSTOMER/WORKSPACE | Customer, Access | `commerce.cart.created` |
| `CAP.COMMERCE.ADD_ITEM` | COMMAND | Commerce | CUSTOMER | Catalog, Pricing, Access | `commerce.cart.changed` |
| `CAP.COMMERCE.CREATE_ORDER` | COMMAND | Commerce | WORKSPACE | Cart, Catalog, Pricing, Customer | `commerce.order.created` |
| `CAP.COMMERCE.CONFIRM_ORDER` | COMMAND | Commerce | WORKSPACE | Inventory, Payment policy | `commerce.order.confirmed` |
| `CAP.COMMERCE.CREATE_PAYMENT` | COMMAND | Commerce | CUSTOMER/WORKSPACE | Order, Access | `commerce.payment.created` |
| `CAP.COMMERCE.CAPTURE_PAYMENT` | COMMAND | Commerce | WORKSPACE | Payment provider adapter | `commerce.payment.completed` |
| `CAP.COMMERCE.REFUND_PAYMENT` | COMMAND | Commerce | WORKSPACE | Payment state | `commerce.refund.created` |
| `CAP.COMMERCE.CREATE_INVOICE` | COMMAND | Commerce/Billing contract | WORKSPACE | Order | `commerce.invoice.created` |
| `CAP.COMMERCE.GET_ORDER` | QUERY | Commerce | CUSTOMER/WORKSPACE | visibility | none |

Historical order/payment values are snapshots; consumers must not reconstruct old transactions from mutable Catalog data.

## 12. Customer capabilities

| Capability | Type | Owner | Scope | Dependencies |
|---|---|---|---|---|
| `CAP.CUSTOMER.CREATE` | COMMAND | Customer | TENANT | Identity/Access |
| `CAP.CUSTOMER.GET` | QUERY | Customer | TENANT | Access |
| `CAP.CUSTOMER.UPDATE_PROFILE` | COMMAND | Customer | CUSTOMER | Access |
| `CAP.CUSTOMER.MANAGE_ADDRESS` | COMMAND | Customer | CUSTOMER | Access |
| `CAP.CUSTOMER.MANAGE_RELATIONSHIP` | COMMAND | Customer | BUSINESS | Access, Business |
| `CAP.CUSTOMER.GET_HISTORY` | QUERY | Customer | CUSTOMER/BUSINESS | Booking/Commerce contracts |

## 13. Trust capabilities

| Capability | Type | Owner | Scope | Dependencies | Events |
|---|---|---|---|---|---|
| `CAP.TRUST.CREATE_VERIFICATION` | COMMAND | Trust | BUSINESS/USER | Access, policy | `trust.verification.created` |
| `CAP.TRUST.SUBMIT_VERIFICATION` | COMMAND | Trust | BUSINESS/USER | Media, policy | `trust.verification.submitted` |
| `CAP.TRUST.REVIEW_VERIFICATION` | COMMAND | Trust | BUSINESS/USER | Access | `trust.verification.reviewed` |
| `CAP.TRUST.APPROVE_VERIFICATION` | COMMAND | Trust | BUSINESS/USER | policy | `trust.verification.approved` |
| `CAP.TRUST.REJECT_VERIFICATION` | COMMAND | Trust | BUSINESS/USER | policy | `trust.verification.rejected` |
| `CAP.TRUST.CREATE_REVIEW` | COMMAND | Trust | CUSTOMER/BUSINESS | Booking/order eligibility | `trust.review.created` |
| `CAP.TRUST.MODERATE_REVIEW` | COMMAND | Trust/Moderation | TENANT | Access, policy | `trust.review.moderated` |
| `CAP.TRUST.GET_TRUST_SIGNALS` | QUERY | Trust | PUBLIC/TENANT | verified signals | none |

Verification evidence is never inferred from reviews or trust scores.

## 14. Communication capabilities

| Capability | Type | Owner | Scope | Dependencies | Events |
|---|---|---|---|---|---|
| `CAP.COMMUNICATION.SEND_NOTIFICATION` | COMMAND | Communication | TENANT/USER | templates, channel adapter | delivery events |
| `CAP.COMMUNICATION.SEND_MESSAGE` | COMMAND | Communication | CONVERSATION | conversation policy | `communication.message.sent` |
| `CAP.COMMUNICATION.CREATE_CONVERSATION` | COMMAND | Communication | TENANT | Access | `communication.conversation.created` |
| `CAP.COMMUNICATION.SEND_EMAIL` | COMMAND | Communication | TENANT | email adapter | delivery events |
| `CAP.COMMUNICATION.SEND_SMS` | COMMAND | Communication | TENANT | SMS adapter | delivery events |
| `CAP.COMMUNICATION.SEND_PUSH` | COMMAND | Communication | TENANT | push adapter | delivery events |
| `CAP.COMMUNICATION.RENDER_TEMPLATE` | QUERY/DECISION | Communication | TENANT | template version | none |

Channel-specific functions are adapters under the canonical notification/message capability; they are not separate business notification systems.

## 15. AI capabilities

| Capability | Type | Owner | Scope | Dependencies | Domain mutation |
|---|---|---|---|---|---|
| `CAP.AI.CREATE_AGENT` | COMMAND | AI | WORKSPACE | Access | AI state only |
| `CAP.AI.RUN_AGENT` | ORCHESTRATION | AI | USER/WORKSPACE | model, safety, tools | only through capabilities |
| `CAP.AI.EXECUTE_TOOL` | COMMAND | AI | USER/WORKSPACE | capability registry, safety | delegated |
| `CAP.AI.MANAGE_MEMORY` | COMMAND | AI | USER/WORKSPACE | consent, retention | AI memory only |
| `CAP.AI.CLASSIFY` | DECISION | AI | TENANT | model/policy | no |
| `CAP.AI.EXTRACT` | DECISION | AI | TENANT | model/policy | no |
| `CAP.AI.GENERATE` | DECISION | AI | TENANT | model/safety | no |
| `CAP.AI.EVALUATE` | DECISION | AI | TENANT | evaluation policy | no |
| `CAP.AI.APPLY_SAFETY_POLICY` | DECISION | AI | TENANT | safety policy | no |

AI Tool definitions map to capabilities. An AI Tool must not contain a second implementation of the domain behavior it exposes.

## 16. Automation capabilities

| Capability | Type | Owner | Scope | Dependencies | Events |
|---|---|---|---|---|---|
| `CAP.AUTOMATION.CREATE_WORKFLOW` | COMMAND | Automation | WORKSPACE | Access | `automation.workflow.created` |
| `CAP.AUTOMATION.ENABLE_WORKFLOW` | COMMAND | Automation | WORKSPACE | policy | `automation.workflow.enabled` |
| `CAP.AUTOMATION.DISABLE_WORKFLOW` | COMMAND | Automation | WORKSPACE | Access | `automation.workflow.disabled` |
| `CAP.AUTOMATION.TRIGGER_WORKFLOW` | ORCHESTRATION | Automation | WORKSPACE | event/trigger policy | execution events |
| `CAP.AUTOMATION.EXECUTE_WORKFLOW` | ORCHESTRATION | Automation | WORKSPACE | capabilities | execution events |
| `CAP.AUTOMATION.EXECUTE_ACTION` | ORCHESTRATION | Automation | WORKSPACE | target capability | delegated events |

Workflow actions reference capability contracts, never service implementation names.

## 17. Billing capabilities

| Capability | Type | Owner | Scope | Dependencies | Events |
|---|---|---|---|---|---|
| `CAP.BILLING.CREATE_SUBSCRIPTION` | COMMAND | Billing | ORGANIZATION/USER | plan, Access | `billing.subscription.created` |
| `CAP.BILLING.CHANGE_PLAN` | COMMAND | Billing | ORGANIZATION/USER | plan, policy | `billing.subscription.changed` |
| `CAP.BILLING.CANCEL_SUBSCRIPTION` | COMMAND | Billing | ORGANIZATION/USER | subscription | `billing.subscription.cancelled` |
| `CAP.BILLING.CHECK_ENTITLEMENT` | DECISION | Billing | TENANT | subscription/plan | none |
| `CAP.BILLING.RECORD_USAGE` | COMMAND | Billing | TENANT | metric definition | `billing.usage.recorded` |
| `CAP.BILLING.GET_USAGE` | QUERY | Billing | TENANT | usage projection | none |

Entitlement checks may be consumed by Access but remain commercially owned by Billing.

## 18. Media capabilities

| Capability | Type | Owner | Scope | Dependencies | Events |
|---|---|---|---|---|---|
| `CAP.MEDIA.UPLOAD` | COMMAND | Media | TENANT/USER | storage policy | `media.asset.created` |
| `CAP.MEDIA.STORE` | COMMAND | Media | TENANT | R2/storage adapter | none |
| `CAP.MEDIA.GET` | QUERY | Media | TENANT/PUBLIC | visibility | none |
| `CAP.MEDIA.DELETE` | COMMAND | Media | TENANT | retention policy | `media.asset.deleted` |
| `CAP.MEDIA.CREATE_VARIANT` | COMMAND | Media | TENANT | processing pipeline | `media.variant.created` |
| `CAP.MEDIA.ATTACH` | COMMAND | Media | TENANT | attachment policy | `media.attachment.created` |
| `CAP.MEDIA.DETACH` | COMMAND | Media | TENANT | attachment policy | `media.attachment.removed` |

## 19. Platform capabilities

| Capability | Type | Owner | Scope | Purpose |
|---|---|---|---|---|
| `CAP.PLATFORM.AUDIT` | COMMAND | Platform | TENANT/GLOBAL | append audit event |
| `CAP.PLATFORM.IDEMPOTENCY` | COMMAND | Platform | ACTOR/TENANT | idempotent command coordination |
| `CAP.PLATFORM.PUBLISH_EVENT` | COMMAND | Platform | TENANT/GLOBAL | outbox/event publication |
| `CAP.PLATFORM.REGISTER_MODULE` | COMMAND | Platform | GLOBAL | module registration |
| `CAP.PLATFORM.REGISTER_PLUGIN` | COMMAND | Platform | GLOBAL | plugin registration |
| `CAP.PLATFORM.CHECK_FEATURE_FLAG` | DECISION | Platform | TENANT/USER | rollout decision |

Platform capabilities are infrastructure contracts and must not become a second domain service layer.

## 20. Event contract rules

Each canonical event has:

```text
Event ID
Version
Producer Module
Aggregate Type
Aggregate ID
Tenant Context
Occurred At (UTC)
Correlation ID
Causation ID
Payload Schema Version
Idempotency Key
```

Rules:

- one producer/owner;
- many consumers;
- immutable event identity;
- versioned payload;
- tenant context is explicit;
- consumers are retry-safe;
- projections and integrations consume events without becoming the source of truth.

## 21. Plugin contract

A plugin declares:

```text
Plugin ID
Plugin Version
Required Capabilities + compatible versions
Provided Capabilities + versions
Required Permissions
Subscribed Events + versions
Tenant Scope
Lifecycle
```

Plugin lifecycle:

```text
registered → validated → installed → enabled → disabled → uninstalled
```

Disabled/uninstalled plugins cannot execute capabilities or receive active subscriptions.

A plugin may provide a new capability, but may not provide a second implementation of an existing canonical capability.

## 22. Anti-duplication decision tree

For every proposed feature:

```text
Does a canonical capability already exist?
       │
      yes ──→ reuse it
       │
       no
       ↓
Is the behavior semantically an extension of an existing capability?
       │
      yes ──→ extend/version the canonical contract
       │
       no
       ↓
Define a new capability with one owner
       ↓
Register dependencies/events/permissions
       ↓
Implement exactly once
       ↓
Expose through API / AI / Plugin / Workflow adapters
```

Forbidden examples:

```text
AIBookingService.create()
PluginBookingService.create()
AdminBookingService.create()
```

Canonical pattern:

```text
CAP.BOOKING.CREATE
      ↑
  Booking owner
      ↑
 ┌────┼──────────┬──────────┐
 API  AI Agent   Plugin    Workflow
```

## 23. Traceability requirement

Every major domain feature must be traceable:

```text
Domain Term
  → Aggregate/Entity
  → Capability
  → Permission
  → Entitlement (if applicable)
  → Event
  → Projection/Consumer
  → AI Tool (if applicable)
  → Plugin contract (if applicable)
```

A feature without a single owner or traceable capability contract is not architecture-complete.

## 24. Contract Definition of Done

A capability is architecture-complete only when:

- [ ] unique ID assigned;
- [ ] owner assigned;
- [ ] classification assigned;
- [ ] input/output contract defined;
- [ ] preconditions/postconditions defined;
- [ ] permission and tenant scope defined;
- [ ] entitlement requirement defined or explicitly none;
- [ ] dependencies identified;
- [ ] transaction boundary identified;
- [ ] idempotency behavior identified;
- [ ] produced/consumed events identified;
- [ ] error contract identified;
- [ ] AI access identified;
- [ ] plugin access identified;
- [ ] compatibility/version policy identified;
- [ ] no duplicate owner or implementation exists.
