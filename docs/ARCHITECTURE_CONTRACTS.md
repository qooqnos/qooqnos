# Phoenix Architecture Contracts

**Status:** Canonical architecture contract
**Scope:** Schema Blueprint, Migration Strategy, Versioning, Capability Contracts

This document records the architecture decisions made before implementation. It is intentionally implementation-agnostic: no SQL, repository code, API handler, or runtime implementation belongs here.

## 1. Core rules

1. D1 is the relational source of truth.
2. Every entity, capability, business rule, and event has exactly one logical owner.
3. Other modules, APIs, AI agents, workflows, and plugins consume public contracts; they do not reimplement canonical behavior.
4. A module owns its schema and migrations.
5. A migration evolves schema/data; it is not business logic.
6. Projections, embeddings, caches, search indexes, and AI memory are never authoritative domain state.
7. Cross-module physical foreign keys may exist for referential integrity, but logical access crosses module boundaries only through public capability contracts.
8. Tenant isolation is enforced server-side and is never delegated to URLs, UI state, or AI/tool input.
9. UTC is canonical for timestamps. Money is integer minor units plus ISO currency.
10. Breaking contract changes require explicit versioning and compatibility handling.

## 2. Canonical schema blueprint

A physical table is approved only when its owner, aggregate, scope, keys, constraints, lifecycle, retention, and source of truth are defined.

### Foundation / Identity

| Table | Owner | Primary responsibility | Scope |
|---|---|---|---|
| `organizations` | Identity | tenant boundary | global |
| `workspaces` | Identity | operational boundary | organization |
| `users` | Identity | platform identity | global |
| `user_profiles` | Identity | user profile | user |
| `external_identities` | Identity | external provider mapping | user |
| `sessions` | Identity | authenticated session lifecycle | user |
| `memberships` | Identity | user ↔ organization/workspace relationship | tenant |
| `membership_roles` | Access | membership → role | tenant |
| `roles` | Access | RBAC role definition | platform/tenant |
| `permissions` | Access | atomic authorization permission | platform |
| `role_permissions` | Access | role → permission | platform/tenant |

Canonical constraints include opaque immutable IDs, scoped uniqueness, valid membership/workspace/organization relationships, and cross-tenant reference rejection.

### Business / Catalog

| Table | Owner | Responsibility |
|---|---|---|
| `businesses` | Business | marketplace supply aggregate root |
| `business_profiles` | Business | business presentation/profile |
| `locations` | Business | physical/service location |
| `categories` | Catalog | hierarchical taxonomy |
| `business_categories` | Business/Catalog contract | business classification |
| `services` | Catalog | canonical service definition |
| `products` | Catalog | product definition |
| `product_variants` | Catalog | sellable SKU/variant |
| `offerings` | Catalog | marketplace-sellable business offering |
| `offering_categories` | Catalog | offering classification |
| `prices` | Catalog | versioned/current pricing |
| `inventory_items` | Catalog | variant/location stock state |

`Offering` is the marketplace-facing concept. `Service` and `Product` are underlying domain concepts; neither is automatically synonymous with Offering.

### Customer / Trust

| Table | Owner | Responsibility |
|---|---|---|
| `customers` | Customer | tenant-scoped customer representation |
| `customer_profiles` | Customer | preferences/profile |
| `customer_addresses` | Customer | customer address records |
| `customer_relationships` | Customer | customer ↔ business relationship |
| `verification_cases` | Trust | verification aggregate |
| `verification_documents` | Trust | protected evidence metadata |
| `verification_checks` | Trust | requirement evaluation |
| `verification_decisions` | Trust | reviewer/system decisions |
| `reviews` | Trust | customer feedback |
| `moderation_cases` | Trust/Moderation | moderation workflow |

Verification, TrustSignal, Review, Rating, and Moderation are distinct concepts.

### Booking / Availability

| Table | Owner | Responsibility |
|---|---|---|
| `bookings` | Booking | commercial reservation/commitment |
| `booking_items` | Booking | one or more booked offerings |
| `appointments` | Booking | scheduled execution/occurrence |
| `schedules` | Booking | schedule definition |
| `availability_rules` | Booking | recurring availability |
| `availability_exceptions` | Booking | exceptions/closures |
| `resources` | Booking | staff/room/equipment/etc. resource |

`Slot` is a computed/operational concept unless future scale requirements justify a durable slot table. Availability is calculated once by the Booking capability layer and reused by every consumer.

### Commerce

| Table | Owner | Responsibility |
|---|---|---|
| `carts` | Commerce | customer purchase intent |
| `cart_items` | Commerce | cart lines |
| `orders` | Commerce | commercial transaction |
| `order_items` | Commerce | immutable historical purchase lines |
| `payments` | Commerce | payment aggregate |
| `payment_attempts` | Commerce | provider attempts |
| `refunds` | Commerce | refund records |
| `invoices` | Commerce/Billing contract | financial document |
| `invoice_lines` | Commerce/Billing contract | invoice components |

Historical transaction snapshots preserve title, quantity, price, tax, discount, currency, and other values required to reconstruct the transaction without querying mutable catalog state.

### Communication / AI / Automation

| Table | Owner | Responsibility |
|---|---|---|
| `conversations` | Communication | communication conversation |
| `messages` | Communication | communication messages |
| `notifications` | Communication | notification lifecycle |
| `delivery_attempts` | Communication | channel delivery attempts |
| `agents` | AI | agent definition/configuration |
| `ai_conversations` | AI | AI interaction context |
| `ai_messages` | AI | AI messages |
| `ai_operations` | AI Runtime | canonical model operation identity/lifecycle |
| `ai_provider_attempts` | AI Runtime | provider execution attempts |
| `ai_runtime_results` | AI Runtime | normalized validated execution results |
| `ai_memories` | AI | explicitly approved durable memory |
| `workflows` | Automation | automation definition |
| `workflow_triggers` | Automation | event/condition triggers |
| `workflow_actions` | Automation | capability actions |
| `workflow_executions` | Automation | execution lifecycle |

### AI Runtime Registry / Governance

| Table | Owner | Responsibility |
|---|---|---|
| `ai_operation_types` | AI Runtime | semantic operation taxonomy/version |
| `ai_models` | AI Runtime Governance | approved model registry |
| `ai_providers` | AI Runtime Governance | approved provider registry |
| `ai_model_routing_decisions` | AI Runtime Governance | reproducible routing evidence |
| `ai_prompts` | AI Runtime | prompt logical identity |
| `ai_prompt_versions` | AI Runtime | immutable prompt versions |
| `ai_schemas` | AI Runtime | output/input schema logical identity |
| `ai_schema_versions` | AI Runtime | immutable schema versions |
| `ai_policies` | AI Policy/Governance | AI policy metadata/version |
| `ai_policy_decisions` | AI Policy/Governance | execution policy decisions |
| `ai_usage_records` | AI Runtime | canonical execution usage telemetry |

These tables represent the canonical Runtime data dictionary. They are not a second AI domain model. Exact physical decomposition may combine or separate records only when semantic ownership and one-to-one mapping remain explicit.

## 3. Schema field contract

Every physical field must be classifiable by:

`name, type, required, nullable, default, mutable, unique, indexed, FK, scope, sensitivity, PII class, encryption, derived, snapshot, retention, owner, source_of_truth`.

Canonical shared value objects are reused rather than redefined per module:

`EntityId, TenantId, OrganizationId, WorkspaceId, Money, Currency, Percentage, Quantity, Address, GeoPoint, DateTime, TimeRange, Locale, Timezone, Version`.

### Integrity layers

- **Database:** PK, FK, UNIQUE, NOT NULL, structural checks.
- **Domain:** lifecycle, business invariants, cross-row rules, state transitions.
- **Authorization:** actor/tenant/role/policy/entitlement decisions.

No one layer is a substitute for another.

## 4. Relationship rules

1. One entity has one owner.
2. One capability has one owner.
3. Many consumers may call one capability.
4. N:N relationships use explicit junction tables when the relationship has identity, lifecycle, metadata, or policy.
5. Polymorphic references are avoided when strong referential integrity matters; they are reserved for genuinely extensible attachment/moderation-style cases.
6. `User` is not `Customer`, `Membership`, `Owner`, or `Provider`.
7. `Business` is the marketplace supply entity; `Provider` remains a role/concept unless a separate entity becomes necessary.
8. `Booking` is the commercial reservation; `Appointment` is its scheduled occurrence.
9. `Request` is a need; `Match` is an evaluated candidate relation; `Recommendation` is a presentation/selection result.
10. `Permission` is access control; `Entitlement` is a commercial/service right.
11. `Capability` is reusable behavior; API, AI Tool, Workflow, UI, and Plugin are consumers/adapters.
12. AI Runtime records are operational execution records and must not be duplicated as feature-local `ai_runs`, `ai_requests`, or provider-specific ledgers.

### Explicit unresolved decisions

The following remain controlled architecture decisions and must be finalized before their physical migrations:

- whether address is structured columns or a JSON value object in each context;
- final scope model for Roles;
- final `Resource` taxonomy (staff, room, equipment, vehicle, etc.);
- whether `BookingItem` is required from the first physical booking migration;
- final typed target matrix for Reviews;
- package/bundle composition under Offering;
- tax/discount rules and their historical snapshots;
- search/vector storage technology;
- durable AI memory storage and retention;
- integration/webhook/sync retention and retry model.

These are intentionally unresolved; they are not permission to create parallel models.

## 5. Migration architecture

### Ownership

The Module owns its schema. The migration is the versioned mechanism that applies that schema.

```text
Module
  └── owns schema
       └── owns migrations
            └── migration runner applies versions
```

No second migration system may be introduced beside the existing platform migration runner.

### Migration classes

1. **Foundation migrations** — identity, tenancy, authorization, platform operations.
2. **Domain migrations** — module-owned domain tables and constraints.
3. **Projection migrations** — rebuildable search/recommendation/analytics/AI-context structures.

### Migration invariants

- Applied migration files are immutable.
- Each migration has stable identity, module, version, checksum, dependency information, status, and application timestamp.
- Migrations are atomic where the database operation permits it.
- Failed migrations block dependent migrations until recovered.
- Data backfills are explicit, bounded, resumable, and idempotent where possible.
- Migration, seed, and runtime bootstrap are separate concerns.
- Migration code contains schema/data evolution, not business services.

### Expand → Migrate → Contract

Breaking schema changes use:

```text
Expand
  ↓
Dual-compatible state
  ↓
Backfill / migrate
  ↓
Switch consumers
  ↓
Verify zero old consumers
  ↓
Contract / remove old state
```

Direct destructive rename/drop is prohibited unless dependency and retention analysis proves it safe.

### Migration dependency graph

Conceptual dependency order:

```text
Platform
  ↓
Identity / Access
  ↓
Business
  ↓
Catalog
  ↓
Customer
  ↓
Booking
  ↓
Commerce
  ↓
Trust / Communication
  ↓
AI / Automation / Billing / Integration
  ↓
Projections
```

Actual execution is dependency-driven through module manifests, not a blind global numeric sequence.

## 6. Versioning architecture

The following versions are intentionally independent:

```text
Platform Version
Module Version
Schema Version
Capability Contract Version
```

A module may change internally without changing its public capability contract. A schema migration may be compatible with the current module version. A breaking capability contract requires a new contract version.

### Capability compatibility

Compatible changes, such as adding an optional response field, remain on the same contract version. Breaking changes create a new version and require a compatibility/migration path.

Plugins and external consumers depend on capability contracts, never on internal implementation classes or repositories.

## 7. Canonical capability contract

Every capability must eventually have the following contract:

```text
Capability ID
Version
Owner Module
Classification: COMMAND | QUERY | DECISION | ORCHESTRATION
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
AI Accessible?
Plugin Accessible?
Public/Internal
Compatibility Policy
```

### Contract semantics

**COMMAND** changes authoritative state and must define authorization, transaction, idempotency, audit, and events.

**QUERY** reads authoritative/projection data without mutating domain state.

**DECISION** evaluates rules or produces a domain decision; its result is not automatically a mutation.

**ORCHESTRATION** composes existing capabilities and must not duplicate their business rules.

### Example canonical contract

```text
CAP.BOOKING.CREATE@1

Owner: Booking
Classification: COMMAND

Input:
  workspaceId
  businessId
  customerId
  bookingItems[]
  requestedTimeRange?
  policyContext?

Output:
  bookingId
  status
  appointmentIds[]
  totals

Preconditions:
  caller authorized
  tenant context valid
  offering eligible
  customer eligible
  availability valid
  pricing valid

Postconditions:
  booking exists in valid state
  appointment/hold state is consistent
  audit record exists
  outbox event is created

Dependencies:
  Access capabilities
  Catalog capabilities
  Availability capability
  Pricing capability

Events:
  booking.created

Idempotency:
  required for external/retryable command consumers

AI Accessible: yes
Plugin Accessible: yes
```

The example is a contract, not an implementation prescription.

## 8. Canonical capability families

The following capability families are the single reusable behavior surface:

### Identity

`CAP.IDENTITY.CREATE_USER`
`CAP.IDENTITY.GET_USER`
`CAP.IDENTITY.UPDATE_PROFILE`
`CAP.IDENTITY.AUTHENTICATE`
`CAP.IDENTITY.CREATE_SESSION`
`CAP.IDENTITY.REVOKE_SESSION`
`CAP.IDENTITY.MANAGE_MEMBERSHIP`

### Access

`CAP.ACCESS.CHECK_PERMISSION`
`CAP.ACCESS.CHECK_POLICY`
`CAP.ACCESS.CHECK_ENTITLEMENT`
`CAP.ACCESS.RESOLVE_ROLES`
`CAP.ACCESS.RESOLVE_PERMISSIONS`

### Business / Catalog

`CAP.BUSINESS.CREATE`
`CAP.BUSINESS.UPDATE`
`CAP.BUSINESS.GET`
`CAP.BUSINESS.ACTIVATE`
`CAP.BUSINESS.SUSPEND`
`CAP.BUSINESS.MANAGE_LOCATION`
`CAP.CATALOG.CREATE_OFFERING`
`CAP.CATALOG.UPDATE_OFFERING`
`CAP.CATALOG.GET_OFFERING`
`CAP.CATALOG.SEARCH_OFFERINGS`
`CAP.CATALOG.CREATE_PRODUCT`
`CAP.CATALOG.UPDATE_PRODUCT`
`CAP.CATALOG.MANAGE_VARIANT`
`CAP.CATALOG.MANAGE_CATEGORY`
`CAP.CATALOG.SET_PRICE`
`CAP.CATALOG.GET_PRICE`
`CAP.CATALOG.MANAGE_INVENTORY`

### Discovery / Matching

`CAP.DISCOVERY.SEARCH`
`CAP.DISCOVERY.FILTER`
`CAP.DISCOVERY.FACET`
`CAP.DISCOVERY.RANK`
`CAP.DISCOVERY.SUGGEST`
`CAP.MATCHING.CREATE_REQUEST`
`CAP.MATCHING.FIND_CANDIDATES`
`CAP.MATCHING.MATCH`
`CAP.MATCHING.SCORE`
`CAP.MATCHING.RANK`
`CAP.MATCHING.EXPLAIN`
`CAP.MATCHING.RECOMMEND`

### Booking

`CAP.BOOKING.CHECK_AVAILABILITY`
`CAP.BOOKING.GET_SLOTS`
`CAP.BOOKING.HOLD_SLOT`
`CAP.BOOKING.RELEASE_SLOT`
`CAP.BOOKING.CREATE`
`CAP.BOOKING.CONFIRM`
`CAP.BOOKING.RESCHEDULE`
`CAP.BOOKING.CANCEL`
`CAP.BOOKING.COMPLETE`
`CAP.BOOKING.GET`

### Commerce / Customer / Trust

`CAP.COMMERCE.CREATE_CART`
`CAP.COMMERCE.ADD_ITEM`
`CAP.COMMERCE.CREATE_ORDER`
`CAP.COMMERCE.CONFIRM_ORDER`
`CAP.COMMERCE.CREATE_PAYMENT`
`CAP.COMMERCE.CAPTURE_PAYMENT`
`CAP.COMMERCE.REFUND_PAYMENT`
`CAP.COMMERCE.CREATE_INVOICE`
`CAP.COMMERCE.GET_ORDER`
`CAP.CUSTOMER.CREATE`
`CAP.CUSTOMER.GET`
`CAP.CUSTOMER.UPDATE_PROFILE`
`CAP.CUSTOMER.MANAGE_ADDRESS`
`CAP.CUSTOMER.MANAGE_RELATIONSHIP`
`CAP.CUSTOMER.GET_HISTORY`
`CAP.TRUST.CREATE_VERIFICATION`
`CAP.TRUST.SUBMIT_VERIFICATION`
`CAP.TRUST.REVIEW_VERIFICATION`
`CAP.TRUST.APPROVE_VERIFICATION`
`CAP.TRUST.REJECT_VERIFICATION`
`CAP.TRUST.CREATE_REVIEW`
`CAP.TRUST.MODERATE_REVIEW`
`CAP.TRUST.GET_TRUST_SIGNALS`

### Communication / AI / Automation

`CAP.COMMUNICATION.SEND_NOTIFICATION`
`CAP.COMMUNICATION.SEND_MESSAGE`
`CAP.COMMUNICATION.CREATE_CONVERSATION`
`CAP.COMMUNICATION.SEND_EMAIL`
`CAP.COMMUNICATION.SEND_SMS`
`CAP.COMMUNICATION.SEND_PUSH`
`CAP.COMMUNICATION.RENDER_TEMPLATE`
`CAP.AI.CREATE_AGENT`
`CAP.AI.RUN_AGENT`
`CAP.AI.EXECUTE_TOOL`
`CAP.AI.MANAGE_MEMORY`
`CAP.AI.CLASSIFY`
`CAP.AI.EXTRACT`
`CAP.AI.GENERATE`
`CAP.AI.EVALUATE`
`CAP.AI.APPLY_SAFETY_POLICY`
`CAP.AUTOMATION.CREATE_WORKFLOW`
`CAP.AUTOMATION.ENABLE_WORKFLOW`
`CAP.AUTOMATION.DISABLE_WORKFLOW`
`CAP.AUTOMATION.TRIGGER_WORKFLOW`
`CAP.AUTOMATION.EXECUTE_WORKFLOW`
`CAP.AUTOMATION.EXECUTE_ACTION`

### Billing / Media / Platform

`CAP.BILLING.CREATE_SUBSCRIPTION`
`CAP.BILLING.CHANGE_PLAN`
`CAP.BILLING.CANCEL_SUBSCRIPTION`
`CAP.BILLING.CHECK_ENTITLEMENT`
`CAP.BILLING.RECORD_USAGE`
`CAP.BILLING.GET_USAGE`
`CAP.MEDIA.UPLOAD`
`CAP.MEDIA.STORE`
`CAP.MEDIA.GET`
`CAP.MEDIA.DELETE`
`CAP.MEDIA.CREATE_VARIANT`
`CAP.MEDIA.ATTACH`
`CAP.MEDIA.DETACH`
`CAP.PLATFORM.AUDIT`
`CAP.PLATFORM.IDEMPOTENCY`
`CAP.PLATFORM.PUBLISH_EVENT`
`CAP.PLATFORM.REGISTER_MODULE`
`CAP.PLATFORM.REGISTER_PLUGIN`
`CAP.PLATFORM.CHECK_FEATURE_FLAG`

## 9. Anti-duplication contract

For every feature request:

```text
1. Search the canonical capability registry.
2. If capability exists → consume it.
3. If behavior is similar → extend the canonical contract/implementation.
4. If behavior is genuinely new → define a new capability and owner.
5. Never create an AI-specific, Plugin-specific, API-specific, UI-specific, or Workflow-specific duplicate of a domain capability.
```

Canonical flow:

```text
Entity
  ↓
Domain Rules
  ↓
Canonical Capability
  ├── API
  ├── UI
  ├── AI Tool
  ├── Workflow Action
  └── Plugin
```

One implementation; many consumers.

## 10. Plugin architecture contract

A Plugin has:

```text
Manifest
Version
Dependencies
Provided Capabilities
Required Capabilities
Permissions
Event Subscriptions
Lifecycle
```

Lifecycle:

```text
registered → validated → installed → enabled → disabled → uninstalled
```

A Plugin may consume canonical capabilities and events and may provide genuinely new capabilities. It may not redefine a canonical Core/Module capability.

Plugin dependencies should prefer capability contracts over plugin-to-plugin implementation coupling.

## 11. Event contract

Events have one producer/owner and many consumers.

Representative canonical events:

`identity.user.created`
`identity.membership.created`
`business.created`
`business.verified`
`catalog.offering.created`
`catalog.offering.updated`
`matching.request.created`
`matching.match.created`
`booking.created`
`booking.confirmed`
`booking.rescheduled`
`booking.cancelled`
`booking.completed`
`commerce.order.created`
`commerce.payment.completed`
`commerce.payment.failed`
`commerce.refund.created`
`trust.review.created`
`trust.verification.completed`
`ai.operation.started`
`ai.operation.completed`
`ai.tool.called`
`billing.subscription.created`
`billing.subscription.cancelled`

Legacy event names such as `ai.run.started` and `ai.run.completed` are compatibility aliases only; they must not imply a second execution ledger.

Event consumers must be idempotent and must not assume delivery is exactly once.

## 12. Projection contract

There are three logical data layers:

1. **Canonical Domain Data** — source of truth.
2. **Operational Data** — sessions, idempotency, outbox, audit, AI Runtime execution records, jobs.
3. **Projection Data** — search, recommendations, analytics, AI context.

A projection must record enough source/version metadata to be rebuilt. A projection cannot be used as the authoritative state merely because it is faster to query.

## 13. Final architecture rule

The architecture is considered violated if any new feature introduces a second implementation of an existing capability, a second source of truth, a direct cross-module repository/table dependency, an AI direct-write path around domain rules, or a plugin implementation of an already-owned core capability.

This document, `docs/DATABASE_MODEL.md`, `docs/AI_RUNTIME_ARCHITECTURE.md`, and `docs/AI_RUNTIME_DATA_DICTIONARY.md` together define the pre-implementation canonical architecture baseline.
