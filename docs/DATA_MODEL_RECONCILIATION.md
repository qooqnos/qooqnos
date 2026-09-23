# Phoenix Data Model Reconciliation

**Status:** Canonical architecture reconciliation gate
**Scope:** Reconcile the logical database model, domain dictionary, capability contracts, booking architecture, analytics architecture, and existing platform rules before any new physical schema work.

## 1. Review result

The existing architecture is coherent at its principles level, but several documents used different names for the same concepts or placed ownership at different boundaries. This document resolves those differences so implementation cannot accidentally create parallel models.

The following documents were reviewed as the primary architecture sources:

- `DATABASE_MODEL.md`
- `ARCHITECTURE_CONTRACTS.md`
- `CANONICAL_DOMAIN_DICTIONARY.md`
- `CAPABILITY_CONTRACT_MATRIX.md`
- `BOOKING_AVAILABILITY_ARCHITECTURE.md`
- `ANALYTICS_OBSERVABILITY_DATA_PLATFORM_ARCHITECTURE.md`
- existing authorization/platform architecture contracts

This is a **model reconciliation**, not an implementation change.

## 2. Non-negotiable canonical hierarchy

```text
Domain Concept
    ↓
Aggregate / Entity / Value Object
    ↓
Owning Module
    ↓
Canonical Capability
    ↓
Permission / Policy / Entitlement
    ↓
Authoritative Transaction
    ↓
Audit + Outbox Event
    ↓
Consumers
    ├── API
    ├── UI
    ├── AI Tool
    ├── Workflow
    ├── Plugin
    ├── Analytics
    └── Projection
```

No consumer is allowed to create a second domain model or second implementation of the same business behavior.

## 3. Canonical ownership decisions

| Concept | Canonical owner | Canonical representation | Decision |
|---|---|---|---|
| User | Identity | `User` | Identity/account only |
| Organization | Identity/Tenancy | `Organization` | Primary security tenant |
| Workspace | Identity/Tenancy | `Workspace` | Operational child of Organization |
| Membership | Identity/Tenancy | `Membership` | Only canonical User↔tenant relationship |
| Role | Access | `Role` | RBAC grouping |
| Permission | Access | `Permission` | Atomic access action |
| Policy | Access/domain policy | `Policy` | Contextual rule evaluation |
| Entitlement | Billing/Access contract | `Entitlement` | Commercial/service right |
| Business | Business | `Business` | Marketplace supply entity |
| Provider | — | role/concept only | **Not a separate entity** unless future ADR proves necessity |
| Location | Business | `Location` | Business-owned physical/service location |
| Category | Catalog | `Category` | Canonical taxonomy |
| Service | Catalog | `Service` | Underlying service definition |
| Product | Catalog | `Product` | Underlying product definition |
| Offering | Catalog | `Offering` | Marketplace-facing sellable concept |
| Price | Catalog | `Price` | Canonical monetary pricing behavior/data |
| Inventory | Catalog | `Inventory` | ProductVariant/location stock truth |
| Customer | Customer | `Customer` | Marketplace customer representation; User mapping optional |
| CustomerRelationship | Customer | `CustomerRelationship` | Customer↔Business relationship |
| MatchRequest | Matching | `MatchRequest` | Need + constraints |
| Match | Matching | `Match` | Evaluated candidate relation |
| Recommendation | Matching | runtime/result | Never authoritative domain truth |
| Availability | Booking | capability/domain behavior | **One canonical engine** |
| Booking | Booking | `Booking` | Commercial reservation/commitment |
| BookingItem | Booking | `BookingItem` | Booked line/offer snapshot |
| Appointment | Booking | `Appointment` | Scheduled occurrence of a Booking |
| Schedule | Booking | `Schedule` | Reusable scheduling definition |
| Resource | Booking | `Resource` | Schedulable capacity |
| Slot | Booking | computed/operational | Not authoritative unless later ADR approves durable slots |
| Cart | Commerce | `Cart` | Mutable purchase intent |
| Order | Commerce | `Order` | Commercial transaction |
| Payment | Billing/Payment | `Payment` | Financial payment aggregate; Commerce stores orchestration/reference state |
| PaymentAttempt | Commerce | `PaymentAttempt` | Provider execution attempt |
| Refund | Billing/Payment | `Refund` | Financial payment reversal |
| Invoice | Billing | `Invoice` | Financial document |
| Verification | Trust | `VerificationCase` | Verification workflow/case, not boolean |
| Review | Trust | `Review` | Customer feedback |
| Rating | Trust | Value Object | Review rating semantics |
| TrustSignal | Trust | `TrustSignal` | Trust evidence/signal |
| TrustScore | Trust/Discovery projection | derived | Never source of truth |
| Moderation | Trust/Moderation | `ModerationCase` | Content/activity policy workflow |
| Conversation | Communication | `Conversation` | Human/system communication thread |
| Message | Communication | `Message` | Communication message |
| AIConversation | AI | `AIConversation` | AI-specific interaction context |
| AIMessage | AI | `AIMessage` | AI conversation message |
| AIRun | AI | `AIRun` | Model/agent execution |
| Tool | AI | `Tool` | Adapter over a Capability |
| ToolCall | AI | `ToolCall` | Invocation record |
| Workflow | Automation | `Workflow` | Automation definition |
| Action | Automation | `Action` | Capability invocation definition |
| Plan | Billing | `Plan` | Commercial plan |
| Subscription | Billing | `Subscription` | Plan enrollment |
| Entitlement | Billing/Access contract | `Entitlement` | Effective service right |
| MediaAsset | Media | `MediaAsset` | Media metadata/source object |
| Plugin | Platform | `Plugin` | Extension contract |
| Capability | Platform/domain owner | `Capability` | One reusable behavior contract |
| Event | Platform/domain producer | `Event` | Immutable fact; one producer |
| Projection | Consumer module | projection | Rebuildable derived state |

## 4. Resolved contradictions

### 4.1 Booking vs Appointment

Some architecture text described `Appointment` as the booking aggregate, while the canonical model defines `Booking` as the commercial commitment.

**Resolution:**

- `Booking` is the aggregate root for the commercial reservation.
- `BookingItem` contains the booked offering/terms.
- `Appointment` is a scheduled occurrence owned by Booking.
- A Booking may have one or many Appointments where recurring/multi-occurrence workflows are supported.
- Availability belongs to Booking as the canonical capability/domain boundary.
- Calendar integrations consume Booking/Appointment events and never own booking truth.

Therefore there is no `AppointmentService` parallel to `BookingService` for booking creation.

### 4.2 Service vs Offering

`Service`, `Product`, and `Offering` appeared together in the logical model.

**Resolution:**

- `Service` = underlying service definition.
- `Product` = underlying product definition.
- `Offering` = marketplace-facing sellable representation.
- A Business sells/publishes Offerings.
- An Offering may reference a Service or Product and may later support a Package/Bundle composition.
- Discovery, Matching, Booking, and Commerce consume the Offering contract rather than inventing their own sellable-item entity.

### 4.3 Provider vs Business

Booking documentation used “provider” as a conceptual actor.

**Resolution:**

`Business` is the canonical marketplace supply entity. `Provider` may remain a human-language role, but no `providers` table/entity may be introduced without an explicit ADR.

### 4.4 Verification ownership

The model sometimes placed verification under Business and elsewhere under Trust.

**Resolution:**

Trust owns the verification process, evidence, checks, decisions, and verification events. Business owns its own lifecycle and may consume verification decisions through capabilities/events. Verification must not directly mutate Business lifecycle outside the canonical Business capability.

### 4.5 Moderation ownership

Review moderation and general moderation appeared as overlapping concepts.

**Resolution:**

`ModerationCase` is the canonical moderation workflow. Trust owns review-specific policy integration; a dedicated Moderation module may own generalized moderation when scope expands. There must be one moderation engine, not separate ReviewModeration and GeneralModeration engines with duplicated policy logic.

### 4.6 Conversation vs AIConversation

Communication has `Conversation/Message`, while AI has `AIConversation/AIMessage`.

**Resolution:**

They are intentionally distinct bounded concepts:

- Communication `Conversation` = user-to-user/system communication.
- AI `AIConversation` = model interaction context, prompts, tool calls, safety state.

A product experience may link them, but neither is an alias of the other. Shared `Message` must not be forced into AI internals, and AI execution records must not become ordinary communication messages automatically.

### 4.7 Entitlement ownership

Entitlement appeared in both Access and Billing.

**Resolution:**

Billing is the canonical source of commercial entitlement grants. Access exposes the canonical decision capability `CAP.ACCESS.CHECK_ENTITLEMENT`. Access does not maintain a second entitlement database.

### 4.8 Invoice ownership

Invoice appeared as both Commerce and Billing.

**Resolution:**

Commerce owns transaction-linked invoice creation and historical invoice data for marketplace transactions. Billing owns subscription/plan billing semantics. If one invoice spans both domains, a contract boundary and explicit ownership rule must be defined; never create two invoice entities.

### 4.9 Analytics vs domain tables

Analytics architecture correctly defines analytical data as derived, while the database model lists analytical/search structures.

**Resolution:**

Analytical facts, search indexes, embeddings, ranking features, and AI evaluation datasets are projections. They may physically duplicate domain identifiers and selected attributes but never become authoritative domain records.

### 4.10 Slot persistence

Some documents refer to `appointment_slots` while the capability architecture defines Slot as computed/operational.

**Resolution:**

`Slot` is canonical as a computed/operational result. A durable/materialized slot table is allowed only as an optimization with explicit versioning and invalidation semantics. It never becomes the availability source of truth.

## 5. Canonical tenant/scope model

Security tenancy is hierarchical:

```text
Organization
  └── Workspace
       └── Business
            └── Location
```

User participation is relational:

```text
User
  └── Membership
       ├── Organization
       └── Workspace
```

Rules:

1. Organization is the primary security tenant.
2. Workspace belongs to exactly one Organization.
3. User may belong to many Organizations/Workspaces through Membership.
4. Business belongs to one Workspace.
5. Direct User→Organization and User→Workspace ownership FKs are not canonical.
6. Scope is stored only when it is a direct ownership/security boundary; it is not blindly duplicated into every table.
7. Cross-tenant references are invalid even when the database can technically represent them.

## 6. Canonical aggregate model

### Identity

- User
- Organization
- Workspace
- Membership lifecycle where membership behavior is transactional

### Access

- Role
- Permission
- Policy is evaluated by Access; it need not be a heavy aggregate.

### Business

- Business
- Location where independently lifecycle-managed

### Catalog

- Offering
- Product
- Category where hierarchy/lifecycle is independently managed
- Inventory where stock consistency requires its own transactional boundary

### Customer

- Customer
- CustomerRelationship when relationship lifecycle is independently managed

### Booking

- Booking
- Appointment where occurrence lifecycle requires independent transitions
- Schedule/Resource as independently managed scheduling definitions

### Commerce

- Cart
- Checkout
- Order
- commercial snapshots
- payment/refund/invoice orchestration references

Commerce coordinates commercial transactions and may invoke payment/invoice/refund capabilities, but it does not own financial settlement truth.

### Billing / Payment

- Payment
- PaymentAttempt
- Refund
- Invoice
- financial ledger

### Trust

- VerificationCase
- Review
- ModerationCase

### AI

- Agent (conceptual/gated)
- AIConversation (conceptual/gated)
- AI Operation via canonical Runtime (`ai_operations`)

### Automation

- Workflow
- WorkflowExecution

### Platform

- Plugin
- Module

Aggregate status does not imply every related table must be physically nested or stored in one table. Ownership is a domain boundary.

## 7. Canonical relationship rules

### Identity

- Organization 1:N Workspace.
- User N:N Organization through Membership.
- User N:N Workspace through Membership.
- Membership N:N Role.
- Role N:N Permission.

### Supply/catalog

- Workspace 1:N Business.
- Business 1:N Location.
- Business N:N Category.
- Business 1:N Offering.
- Offering N:N Category.
- Product 1:N ProductVariant.
- ProductVariant N:N Location through Inventory.

### Customer/booking

- Customer may optionally map to a User.
- Business N:N Customer through CustomerRelationship.
- Customer 1:N Booking.
- Booking 1:N BookingItem.
- Booking 1:N Appointment.
- Appointment may reference one or more Resources according to scheduling policy.

### Commerce

- Customer 1:N Order.
- Order 1:N OrderItem.
- Order has 0:N Payment references/financial interactions through the Billing/Payment contract.
- Payment 1:N PaymentAttempt.
- Payment 1:N Refund.
- Order 0:N Invoice through the Billing contract.

### Trust

- VerificationCase 1:N VerificationDocument.
- VerificationCase 1:N VerificationCheck.
- VerificationCase 1:N VerificationDecision.
- Review has exactly one canonical target: Business, Offering, or Product.

### AI/plugin

- Agent 1:N AIRun.
- AIRun 1:N ToolCall.
- Agent N:N Tool.
- Tool → Capability.
- Plugin N:N Capability.
- Plugin N:N Event.
- Plugin dependencies reference capability contracts rather than implementation modules where possible.

## 8. Source-of-truth matrix

| Data | Source of truth | Projection allowed? |
|---|---|---:|
| User identity | Identity | yes |
| Membership | Identity | yes |
| Authorization decision | Access runtime/policy | cached result only |
| Business | Business | yes |
| Offering | Catalog | yes |
| Price | Catalog | yes |
| Inventory | Catalog | yes |
| Availability rules | Booking | yes |
| Availability result | Booking capability | short-lived/cache/materialization |
| Booking | Booking | yes |
| Appointment | Booking | yes |
| Order | Commerce | yes |
| Payment | Billing/Payment financial authority; Commerce keeps orchestration/reference state | yes |
| Verification | Trust | yes |
| Review | Trust | yes |
| Trust score | derived | yes, always |
| Search index | Discovery | yes, rebuildable |
| Match score | Matching run/provenance | yes |
| AI memory | AI | yes, but never domain truth |
| Analytics | Analytics projection | yes, always |
| Audit | Platform | immutable authoritative audit record |
| Outbox | Platform | operational, replayable |

## 9. Canonical invariant layers

Every important invariant must be assigned to exactly one primary enforcement layer, while defense-in-depth is allowed.

### Database layer

- primary/foreign keys
- uniqueness
- non-null requirements
- structural checks
- basic numeric bounds

### Domain layer

- lifecycle transitions
- booking concurrency
- inventory semantics
- refund limits
- eligibility
- cross-row business rules
- snapshot creation

### Authorization layer

- actor identity
- tenant scope
- permission
- policy
- entitlement
- resource ownership/access

No domain module may move authorization logic into ad-hoc SQL filters or UI checks as its sole enforcement.

## 10. Historical snapshot rules

Mutable current state must not be used to reconstruct historical transactions.

Snapshots are required where a future change could alter historical meaning, including as applicable:

- Booking item title/price/duration/policy
- Order item title/price/tax/discount/currency
- Payment amount/currency/provider reference
- Invoice line description/amount/tax
- Applied cancellation/reschedule policy version
- Pricing/ranking/model/prompt/policy versions when required for auditability

Snapshot fields are immutable after the transaction reaches the relevant committed state.

## 11. Polymorphic reference policy

Polymorphism is permitted only where extensibility materially outweighs referential-integrity loss.

Preferred:

- typed foreign keys for Review targets;
- typed relationships for Booking/Offering/Business;
- explicit junction tables for N:N relationships.

Allowed with explicit contract:

- moderation subject;
- generic media attachment;
- external reference;
- other genuinely extensible platform concepts.

A polymorphic field must define allowed types, ownership, authorization, deletion behavior, and tenant validation.

## 12. Shared-kernel rule

The following are shared canonical value objects and must never be recreated per module:

`EntityId`, `TenantId`, `OrganizationId`, `WorkspaceId`, `Money`, `Currency`, `Percentage`, `Quantity`, `Address`, `GeoPoint`, `DateTime`, `TimeRange`, `Locale`, `Timezone`, `Version`.

Domain-specific values remain inside their owning module unless there is a demonstrated cross-context semantic identity.

## 13. Data classification and retention

Every physical field must be classified using at least:

```text
PUBLIC
INTERNAL
PERSONAL
SENSITIVE_PERSONAL
SECRET
```

And retention behavior:

```text
ACTIVE
HISTORICAL
AUDIT
EPHEMERAL
EXPIRABLE
LEGAL_RETENTION
```

Deletion semantics must be explicit:

```text
HARD_DELETE
SOFT_DELETE
ARCHIVE
IMMUTABLE
CASCADE
RESTRICT
ANONYMIZE
```

Sensitive evidence, credentials, tokens, payment secrets, and protected verification material must not be copied into generic domain/projection records merely for convenience.

## 14. Canonical lifecycle rule

Every persistent stateful entity must have one canonical lifecycle. Other modules may react to it but must not invent a shadow status representing the same fact.

For example:

```text
Booking.status        ← authoritative
Payment.status        ← authoritative for Payment
Appointment.status    ← authoritative for Appointment
Notification.status   ← authoritative for delivery
```

A consumer may maintain `notification_pending = true` as a projection only if it is explicitly derived and rebuildable; it cannot become a second booking state.

## 15. Canonical capability rule

The data model and capability model are inseparable.

For every entity mutation:

```text
Entity mutation
   ↓
Canonical capability
   ↓
Authorization
   ↓
Transaction
   ↓
Audit
   ↓
Outbox event
```

Examples:

- Booking creation → `CAP.BOOKING.CREATE`
- Availability calculation → `CAP.BOOKING.CHECK_AVAILABILITY`
- Offering creation → `CAP.CATALOG.CREATE_OFFERING`
- Customer update → `CAP.CUSTOMER.UPDATE_PROFILE`
- Verification approval → `CAP.TRUST.APPROVE_VERIFICATION`
- Subscription creation → `CAP.BILLING.CREATE_SUBSCRIPTION`

No `AI*`, `Plugin*`, `Admin*`, `API*`, or `Workflow*` implementation may duplicate these mutations.

## 16. Final unresolved decisions before physical schema

These are intentionally kept as explicit gates rather than silently guessing:

1. Exact structured Address column model vs canonical serialized value object per context.
2. Final Role scope matrix for platform/organization/workspace/business.
3. Final Resource taxonomy and whether staff/provider identity needs a dedicated resource/person abstraction.
4. Exact BookingItem physical shape and snapshot fields.
5. Review target matrix is resolved by Architecture Gate 05.
6. Package/Bundle composition under Offering.
7. Tax/discount ownership and immutable financial snapshots.
8. Payment provider adapter/reference model.
9. Search/vector storage technology and projection schema.
10. AI Memory storage/retention/consent implementation.
11. Integration/Webhook/Sync retention and retry semantics.

These are architecture gates. They must be resolved before their physical migrations are designed; they are not permission to create provisional duplicate tables.

## 17. Reconciliation acceptance criteria

The data model is considered reconciled when:

- every canonical entity has exactly one owner;
- every business capability has exactly one owner and implementation;
- User/Customer/Membership/Business/Provider are not conflated;
- Service/Product/Offering are not conflated;
- Booking/Appointment/Slot are not conflated;
- Verification/Trust/Review/Moderation are not conflated;
- Conversation/AIConversation are intentionally distinct;
- Entitlement has one source of truth;
- Invoice ownership is explicit;
- availability has exactly one canonical engine;
- projections never become source of truth;
- cross-module access uses capabilities/contracts;
- shared value objects are canonical;
- historical snapshots are explicit;
- polymorphism is controlled;
- tenant boundaries are explicit;
- unresolved decisions are documented before migrations.

**This reconciliation is the gate for the next architecture phase. No new domain table should be designed until a new concept passes this contract.**
