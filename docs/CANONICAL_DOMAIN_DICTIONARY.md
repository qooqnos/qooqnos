# Phoenix Canonical Domain Dictionary

**Status:** Canonical architecture contract
**Scope:** Domain vocabulary, entity taxonomy, value objects, aggregates, relationships, policies, capabilities, events, and naming rules

This dictionary is the authoritative vocabulary for Phoenix. New code, schema, API contracts, AI tools, workflows, plugins, documentation, and tests must reuse these terms. A new synonym or parallel model requires an explicit architecture decision.

## 1. Vocabulary rules

1. Every canonical concept has one owner and one canonical name.
2. Synonyms may exist for human language, but code, schema, events, and capability IDs use the canonical term.
3. A concept must not be reintroduced under a module-specific alias when the canonical concept already exists.
4. Entity, Value Object, Aggregate Root, Relationship, Policy, Capability, Event, Projection, and Runtime Result are distinct categories.
5. `User`, `Customer`, `Membership`, `Owner`, and `Provider` are never interchangeable.
6. `Business`, not `Provider`, is the canonical marketplace supply entity unless a future architecture decision creates a distinct Provider entity.
7. `Offering` is the marketplace-facing sellable concept; `Service` and `Product` are underlying domain concepts.
8. `Booking` is the commercial reservation/commitment; `Appointment` is a scheduled occurrence.
9. `Permission` controls access; `Entitlement` controls a commercial/service right.
10. `Capability` is reusable behavior; API, UI, AI Tool, Workflow, and Plugin are consumers or adapters.
11. A Projection is rebuildable and never the source of truth.
12. AI Memory, embeddings, caches, search indexes, and ranking outputs are not authoritative domain state.

## 2. Domain contexts

| Context | Owner | Canonical purpose |
|---|---|---|
| Identity | Identity | users, organizations, workspaces, memberships, authentication |
| Access | Access | permissions, roles, policies, access decisions |
| Business | Business | marketplace businesses and locations |
| Catalog | Catalog | categories, services, products, offerings, pricing, inventory |
| Discovery | Discovery | search, filters, facets, ranking, suggestions, projections |
| Matching | Matching | requests, candidates, matches, scoring, recommendations |
| Booking | Booking | availability, bookings, appointments, resources |
| Commerce | Commerce | carts, orders, payments, refunds, invoices |
| Customer | Customer | customer representation, profiles, relationships, addresses |
| Trust | Trust | verification, reviews, trust signals, moderation |
| Communication | Communication | conversations, messages, notifications, delivery |
| AI | AI | agents, runs, tools, memory, safety, AI interactions |
| Automation | Automation | workflows, triggers, actions, executions, tasks |
| Billing | Billing | plans, subscriptions, entitlements, usage |
| Media | Media | assets, variants, attachments |
| Integration | Integration | external accounts, webhooks, synchronization |
| Platform | Platform | modules, plugins, events, audit, idempotency, outbox |

## 3. Core entity definitions

### Identity

**User** — platform identity/account representing an actor. It is not inherently a customer, employee, owner, provider, or organization member.

**UserProfile** — presentation and preference data belonging to a User.

**ExternalIdentity** — mapping between a User and an external authentication/identity provider subject.

**Session** — authenticated runtime session for a User.

**Organization** — top-level tenant boundary.

**Workspace** — operational boundary belonging to exactly one Organization.

**Membership** — relationship connecting a User to an Organization and optionally a Workspace; it is the canonical membership/participation mechanism.

### Access

**Role** — named bundle of Permissions assigned through a Membership or other explicitly authorized scope.

**Permission** — atomic authorization action such as `booking.create`.

**Policy** — rule set used to evaluate contextual access decisions.

**Entitlement** — right granted by a commercial/service plan or explicit entitlement source.

**Access Decision** — result of authorization evaluation; normally a runtime result rather than a canonical business entity.

### Business

**Business** — marketplace supply entity representing an organization/business that offers goods or services.

**BusinessProfile** — presentation/profile information for a Business.

**Location** — physical or service location owned by a Business; may contain Address and GeoPoint.

**Address** — canonical value object representing postal/address information.

**GeoPoint** — canonical value object containing geographic coordinates.

### Catalog

**Category** — taxonomy node used to classify Business, Offering, Product, or other explicitly supported catalog concepts.

**Service** — canonical definition of a service that may be offered by a Business.

**Product** — canonical definition of a physical/digital product owned by a Business.

**ProductVariant** — sellable variant/SKU of a Product.

**Offering** — marketplace-facing sellable representation of something a Business offers. It may be backed by a Service, Product, Package, or future composition type.

**Price** — time/scoped monetary value associated with an Offering or other explicitly priceable domain object.

**Inventory** — authoritative stock state for a ProductVariant at a Location.

**AttributeDefinition** — definition of an allowed catalog attribute.

**AttributeValue** — value of an AttributeDefinition for a supported catalog object.

### Discovery

**Search** — user/system retrieval operation over discoverable data.

**Filter** — constraint applied to a search or discovery operation.

**Facet** — grouped aggregation used to refine or understand search results.

**Ranking** — ordering policy/result applied to candidates or search results.

**SearchProjection** — rebuildable representation optimized for retrieval; never source of truth.

**Suggestion** — predicted or assisted search/discovery input.

### Matching

**MatchRequest** — representation of a user's/system's need and constraints.

**Candidate** — runtime candidate considered for a MatchRequest; not automatically a persistent entity.

**Match** — evaluated relationship between a MatchRequest and a candidate, including score/reasons where applicable.

**Score** — value object representing an evaluation score plus its defined semantics.

**Recommendation** — selected/presented result derived from matches and ranking; not source of truth.

### Booking

**Booking** — commercial reservation/commitment for one or more offerings.

**BookingItem** — line within a Booking identifying an offered item and its historical booking terms.

**Appointment** — scheduled occurrence associated with a Booking.

**Schedule** — reusable schedule definition.

**AvailabilityRule** — recurring rule defining when a resource/business may be available.

**AvailabilityException** — explicit override, closure, or exception to a schedule.

**Resource** — schedulable capacity such as staff, room, equipment, vehicle, or future resource type.

**Slot** — computed availability interval; not authoritative state unless a future scale decision makes durable slots necessary.

### Commerce

**Cart** — mutable customer purchase intent.

**CartItem** — line in a Cart.

**Order** — commercial transaction created from purchase intent.

**OrderItem** — immutable historical line in an Order.

**Payment** — commercial payment aggregate associated with an order, booking, or other explicitly payable transaction.

**PaymentAttempt** — individual provider/payment execution attempt.

**Refund** — reversal of a captured payment amount subject to refund rules.

**Invoice** — financial document representing an amount due/charged.

**InvoiceLine** — immutable component of an Invoice.

### Customer

**Customer** — business/customer representation used by the marketplace. It may optionally map to a User and may support guests.

**CustomerProfile** — logical Customer aggregate composed from `customers`, `customer_preferences`, and `customer_addresses`; it is a capability-level composition, not a separate physical source of truth.

**CustomerAddress** — address record associated with a Customer.

**CustomerRelationship** — relationship between a Customer and Business, including lifecycle/source/context.

### Trust

**VerificationCase** — aggregate representing a verification process for a subject.

**VerificationDocument** — protected evidence metadata associated with a VerificationCase.

**VerificationCheck** — evaluation of an individual verification requirement.

**VerificationDecision** — reviewer/system decision on verification.

**TrustSignal** — evidence or signal contributing to trust evaluation.

**TrustScore** — derived/projection result; never an independent source of truth.

**Review** — customer feedback submitted about an allowed target.

**Rating** — value object representing a bounded rating according to the review policy.

**ModerationCase** — workflow for reviewing potentially problematic content/activity.

### Communication

**Conversation** — communication thread between participants.

**Message** — communication content within a Conversation.

**Notification** — system-generated delivery intent to a recipient.

**NotificationTemplate** — reusable rendering template for Notifications.

**DeliveryAttempt** — attempt to deliver a Notification through a provider/channel.

### AI

**Agent** — configured AI actor with model, policy, tool, and behavior configuration.

**AIConversation** — AI interaction context.

**AIMessage** — message within an AIConversation.

**AIRun** — one model/agent execution with lifecycle, usage, and tool-call metadata.

**Model** — configured AI model reference/configuration.

**Tool** — AI-facing adapter that exposes a Capability or approved operation to an Agent.

**ToolCall** — invocation record for a Tool during an AIRun.

**Memory** — explicitly approved durable AI context with ownership and retention rules; never canonical domain truth by default.

**SafetyPolicy** — policy governing AI safety and allowed behavior.

**SafetyEvent** — recorded safety-related decision/event.

**AIRecommendation** — AI-generated recommendation that must be treated as a recommendation, not authoritative domain state.

### Automation

**Workflow** — reusable automation definition.

**Trigger** — condition/event that starts a Workflow.

**Condition** — predicate used to decide whether/which action should execute.

**Action** — invocation of a Capability or approved automation operation.

**WorkflowExecution** — runtime execution instance of a Workflow.

**Task** — durable unit of work associated with automation or platform execution.

### Billing

**Plan** — commercial definition of available service limits/features.

**Subscription** — customer's/tenant's enrollment in a Plan.

**BillingAccount** — financial identity/context used for billing.

**Entitlement** — concrete right derived from a Plan, Subscription, or explicit grant.

**UsageRecord** — metered usage event/record.

**UsageMetric** — canonical definition of a billable/trackable usage dimension.

### Media / Integration / Platform

**MediaAsset** — canonical stored media object and metadata.

**MediaVariant** — derived representation of a MediaAsset.

**MediaAttachment** — relationship attaching a MediaAsset to another supported entity.

**Integration** — configured connection to an external system/provider.

**ExternalAccount** — external account reference owned by an Integration.

**Webhook** — registered inbound/outbound integration delivery contract.

**SyncJob** — synchronization execution and state.

**ExternalReference** — mapping to an external provider's identifier; never domain ownership.

**Module** — first-class Phoenix architectural owner of capabilities/domain behavior.

**ModuleVersion** — versioned module metadata and compatibility contract.

**Plugin** — extension package that consumes/provides capabilities and events under the Plugin contract.

**PluginVersion** — immutable/versioned Plugin manifest and compatibility information.

**Capability** — reusable behavior contract with one owner and many consumers.

**FeatureFlag** — controlled rollout/availability mechanism; not authorization or entitlement.

**Event** — immutable fact emitted by one producer for many consumers.

**AuditEvent** — immutable record of security/business-sensitive activity.

**OutboxEvent** — operational event record used for reliable publication.

**IdempotencyRecord** — operational record preventing duplicate execution of retryable commands.

## 4. Canonical value objects

These value objects belong to the shared kernel and must not be redefined per module:

| Value Object | Canonical meaning |
|---|---|
| `EntityId` | opaque stable identifier |
| `TenantId` | tenant scope identifier |
| `OrganizationId` | Organization identity |
| `WorkspaceId` | Workspace identity |
| `Money` | integer minor-unit amount + Currency |
| `Currency` | ISO currency code |
| `Percentage` | bounded percentage value |
| `Quantity` | typed quantity with domain-defined semantics |
| `Address` | postal address value |
| `GeoPoint` | latitude/longitude value |
| `DateTime` | UTC canonical timestamp |
| `TimeRange` | start/end temporal interval |
| `Locale` | language/region preference |
| `Timezone` | IANA timezone identifier |
| `Version` | explicit contract/schema/version value |

`Location`, `CustomerAddress`, and other domain records may contain these value objects but are not interchangeable with them.

## 5. Canonical relationship rules

- Organization 1:N Workspace.
- User N:N Organization/Workspace through Membership.
- Membership N:N Role through `membership_roles`.
- Role N:N Permission through `role_permissions`.
- Workspace 1:N Business.
- Business 1:N Location.
- Business N:N Category.
- Business 1:N Offering.
- Offering N:N Category.
- Product 1:N ProductVariant.
- ProductVariant N:N Location through Inventory.
- Customer may optionally map to one User; a User may have a business/customer role without being reduced to that role.
- Business N:N Customer through CustomerRelationship.
- Customer 1:N Booking.
- Booking 1:N BookingItem.
- Booking 1:N Appointment where recurring/multiple occurrences are supported.
- Order 1:N OrderItem.
- Payment 1:N PaymentAttempt.
- Payment 1:N Refund.
- VerificationCase 1:N VerificationDocument/VerificationCheck/VerificationDecision.
- Conversation 1:N Message.
- Agent 1:N AIRun.
- AIRun 1:N ToolCall.
- Agent N:N Tool through an explicit relationship.
- Tool references a Capability contract, not an implementation.
- Plugin N:N Capability and N:N Event through explicit manifest relationships.

## 6. Canonical state vocabulary

### Business
`draft → pending_verification → active → suspended → active`, with terminal/branch states such as `rejected` and `closed` where policy permits.

### Offering
`draft → published → paused → published`, with `archived` as a terminal/retirement state.

### Booking
`draft → pending → confirmed → in_progress → completed`, with controlled transitions to `cancelled` and `rescheduled`.

### Payment
`pending → processing → succeeded` or `failed`; successful payment may transition to `refunded` according to refund rules.

### Verification
`draft → submitted → under_review → approved/rejected → expired`.

### Review
`draft → submitted → published`, or `submitted → moderated → rejected`.

### Plugin
`registered → validated → installed → enabled → disabled → uninstalled`.

### AI Run
`queued → running → completed`, with `failed` and `cancelled` branches.

### Tool Call
`requested → running → succeeded/failed`.

### Workflow Execution
`queued → running → completed`, with `failed/cancelled` branches.

## 7. Naming dictionary

Canonical identifiers use stable English domain names. Persian translations belong in documentation/UI, not database or capability identifiers.

Preferred:

- `Business`, not `Provider` for the marketplace supply entity.
- `Offering`, not generic `Service` when referring to something sellable in the marketplace.
- `Booking`, not `Reservation` as a parallel entity name.
- `Appointment`, not `BookingSlot` for a scheduled occurrence.
- `Customer`, not `Client` as a second canonical entity.
- `Capability`, not `Function` for reusable domain behavior.
- `Plugin`, not `Extension` when referring to the Phoenix plugin contract.
- `Entitlement`, not `FeaturePermission` for commercial/service rights.
- `Projection`, not `Replica` for rebuildable read models.
- `ExternalReference`, not `ProviderId` as a generic cross-system identifier.

## 8. Forbidden modeling shortcuts

The following patterns require explicit architecture approval:

1. Creating `AI*`, `Plugin*`, `Admin*`, or `API*` versions of an existing domain entity.
2. Creating module-specific duplicates of shared value objects.
3. Direct cross-module repository/table access as a substitute for a capability.
4. Storing derived values as authoritative state without source/provenance and rebuild strategy.
5. Treating AI memory/search indexes as domain truth.
6. Creating polymorphic references where strong referential integrity is important.
7. Using `User` as a substitute for `Customer` or `Membership`.
8. Using `Provider` as a second entity when `Business` already represents the concept.
9. Creating a second booking/availability engine for AI, plugins, or workflows.
10. Creating a second permission/entitlement system for a feature/module.

## 9. Canonical traceability

Every important concept must be traceable as:

```text
Term
  ↓
Entity / Aggregate / Value Object
  ↓
Owner Module
  ↓
Capability
  ↓
Permission / Entitlement
  ↓
Event
  ↓
Consumers
  ↓
AI Tool / Workflow / Plugin
  ↓
Projection (if needed)
```

If a concept cannot be traced to one owner and one canonical behavior surface, its model is incomplete.

## 10. Definition of Done for a new domain concept

Before introducing a new concept, document:

- canonical name;
- definition;
- category/type;
- owner module;
- aggregate relationship;
- lifecycle;
- tenant scope;
- source of truth;
- relationships;
- capability surface;
- permission/entitlement requirements;
- events;
- consumers;
- retention/privacy classification;
- projection requirements;
- compatibility/versioning requirements;
- why an existing concept cannot be reused.

A concept is not approved merely because a new table would be convenient.
