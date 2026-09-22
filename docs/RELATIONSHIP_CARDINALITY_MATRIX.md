# Phoenix Relationship & Cardinality Matrix

**Status:** Canonical architecture contract
**Scope:** Canonical relationships, cardinality, ownership, foreign-key direction, deletion behavior, tenant invariants, and cross-module integrity rules.

This document is the authoritative relationship layer between the logical domain model and the physical schema blueprint. It does not create SQL. A relationship may become a physical foreign key, junction table, snapshot reference, or controlled polymorphic reference only according to the rules below.

## 1. Non-negotiable relationship rules

1. Every relationship has one semantic owner.
2. Cardinality describes domain truth, not merely current UI behavior.
3. A foreign key does not grant cross-module business access.
4. Cross-module behavior is consumed through capabilities/events even when a physical FK exists.
5. Cross-tenant references are forbidden.
6. N:N relationships use explicit junction records unless the relationship itself has an independent lifecycle, in which case it becomes an entity/aggregate.
7. Polymorphic references are exceptional and require an explicit contract.
8. Delete behavior is part of the relationship contract and must be defined before migration.
9. Denormalized ancestor IDs are allowed only with an invariant proving they match the canonical owner chain.
10. Snapshots preserve historical meaning and are not live relationships.
11. A relationship must never create a second source of truth for an existing entity.
12. Relationship cardinality cannot be inferred from nullable SQL alone; business invariants must define the real minimum/maximum.

## 2. Relationship contract

Every canonical relationship must define:

```text
Relationship ID
From Entity
To Entity
Cardinality
Minimum From
Maximum From
Minimum To
Maximum To
Semantic Owner
Physical Representation
Foreign Key Direction
Cross-Module?
Tenant Scope Rule
Delete Behavior
Update Behavior
Uniqueness Rule
Authorization Rule
Lifecycle Dependency
Snapshot?
Polymorphic?
Canonical Capability(s)
Canonical Event(s)
```

## 3. Cardinality notation

```text
1:1   exactly one to exactly one
1:0..1 one to optional one
1:N   one to many
1:0..N one to zero or many
N:N   many to many
```

The matrix uses the perspective `A → B`: one A can reference the stated number of B records.

---

## 4. Identity relationships

| Relationship | Cardinality | Owner | Physical shape | Delete | Tenant rule |
|---|---|---|---|---|---|
| Organization → Workspace | 1:N | Identity | `workspaces.organization_id` | RESTRICT/CASCADE only by approved tenant policy | Workspace organization immutable |
| User → Membership | 1:0..N | Identity | `memberships.user_id` | RESTRICT/HISTORICAL | Membership tenant-scoped |
| Organization → Membership | 1:0..N | Identity | `memberships.organization_id` | RESTRICT | membership belongs to org |
| Workspace → Membership | 1:0..N | Identity | nullable `memberships.workspace_id` | RESTRICT | workspace must belong to membership org |
| User → UserProfile | 1:1 | Identity | `user_profiles.user_id` UNIQUE | CASCADE only where policy permits | global user scope |
| User → ExternalIdentity | 1:0..N | Identity | `external_identities.user_id` | RESTRICT/HARD_DELETE by security policy | global identity |
| User → Session | 1:0..N | Identity | `sessions.user_id` | EXPIRE/HARD_DELETE | global/user |
| Membership → Role | N:N | Access | `membership_roles` | CASCADE junction | same tenant scope |
| Role → Permission | N:N | Access | `role_permissions` | CASCADE junction | permission catalog may be global |

### Identity invariants

- There is no canonical direct `users.organization_id` or `users.workspace_id`.
- A workspace has exactly one organization.
- A workspace-scoped membership must reference a workspace belonging to the same organization.
- A role assignment cannot cross its permitted role scope.
- External identity uniqueness is `(provider, subject)`.
- A revoked/expired session cannot become active without a canonical session capability.

---

## 5. Business relationships

| Relationship | Cardinality | Owner | Physical shape | Delete | Tenant rule |
|---|---|---|---|---|---|
| Workspace → Business | 1:0..N | Business | `businesses.workspace_id` | RESTRICT/ARCHIVE | workspace canonical owner |
| Business → BusinessProfile | 1:0..1 | Business | `business_profiles.business_id` UNIQUE | CASCADE/ARCHIVE | same business |
| Business → Location | 1:0..N | Business | `locations.business_id` | RESTRICT/ARCHIVE | same business |
| Business → Category | N:N | Business/Catalog contract | `business_categories` | junction removal | same tenant taxonomy rules |
| Location → Address | 1:1 value | Business | embedded/value columns | follows Location | same location |
| Location → GeoPoint | 1:0..1 value | Business | embedded/value columns | follows Location | same location |

### Business invariants

- `business.workspace_id` is authoritative for tenant ownership.
- If `organization_id` is physically denormalized on Business, it must equal the Workspace organization.
- Business owner is represented by membership/role/relationship, not an Owner entity.
- Business activation is not a side effect that any consumer may implement independently.

---

## 6. Catalog relationships

| Relationship | Cardinality | Owner | Physical shape | Delete | Tenant rule |
|---|---|---|---|---|---|
| Category → Category | 1:N | Catalog | `categories.parent_id` | RESTRICT/controlled reparenting | same taxonomy scope |
| Business → Offering | 1:0..N | Catalog | `offerings.business_id` | RESTRICT/ARCHIVE | same business |
| Offering → Category | N:N | Catalog | `offering_categories` | remove junction | same tenant/public taxonomy |
| Business → Service | 1:0..N | Catalog | optional `services.business_id` | ARCHIVE/RESTRICT | same business when present |
| Business → Product | 1:0..N | Catalog | `products.business_id` | ARCHIVE/RESTRICT | same business |
| Product → ProductVariant | 1:1..N | Catalog | `product_variants.product_id` | RESTRICT/ARCHIVE | same business through Product |
| ProductVariant → Location | N:N | Catalog | `inventory_items` | archive inventory | same business |
| Offering → Service | 0..1:1 | Catalog | `offerings.service_id` | RESTRICT | Service must be compatible with Offering business |
| Offering → Product | 0..1:1 | Catalog | `offerings.product_id` | RESTRICT | Product must belong to Offering business |
| Offering → Price | 1:1..N | Catalog | `prices.offering_id` | RETAIN/HISTORICAL | same business |
| Offering → MediaAsset | N:N | Media contract | `media_attachments` | remove attachment only | tenant validated |

### Catalog invariants

- An Offering belongs to exactly one Business.
- Offering type determines which underlying Service/Product references are legal.
- An Offering cannot reference both Service and Product unless the approved offering composition model explicitly permits it.
- Category hierarchy cannot self-reference or cycle.
- ProductVariant belongs to exactly one Product.
- Inventory is the canonical stock relationship between Variant and Location.
- Price history cannot be reconstructed from a mutable current-price row.

---

## 7. Customer relationships

| Relationship | Cardinality | Owner | Physical shape | Delete | Tenant rule |
|---|---|---|---|---|---|
| User → Customer | 1:0..1 | Customer | optional `customers.user_id` UNIQUE | SET NULL/RESTRICT by policy | user may map to customer within tenant |
| Customer → CustomerProfile | 1:0..1 | Customer | `customer_profiles.customer_id` UNIQUE | CASCADE/ARCHIVE | same customer |
| Customer → CustomerAddress | 1:0..N | Customer | `customer_addresses.customer_id` | ARCHIVE | same customer |
| Business → Customer | N:N | Customer | `customer_relationships` | relationship lifecycle | same tenant |
| Customer → BusinessRelationship | 1:0..N | Customer | `customer_relationships.customer_id` | ARCHIVE | same tenant |

### Customer invariants

- Customer identity is not User identity.
- Guest customers are valid and have no required User row.
- A Customer mapped to a User does not gain cross-tenant access automatically.
- CRM/business relationship state cannot replace Membership.

---

## 8. Booking relationships

| Relationship | Cardinality | Owner | Physical shape | Delete | Tenant rule |
|---|---|---|---|---|---|
| Customer → Booking | 1:0..N | Booking | `bookings.customer_id` | RESTRICT/HISTORICAL | same tenant |
| Business → Booking | 1:0..N | Booking | `bookings.business_id` | RESTRICT/HISTORICAL | same business |
| Booking → BookingItem | 1:1..N | Booking | `booking_items.booking_id` | CASCADE only before commit; historical retention after commit | same booking |
| BookingItem → Offering | N:1 | Booking/Catalog contract | `booking_items.offering_id` | RESTRICT/HISTORICAL | same business |
| Booking → Appointment | 1:0..N | Booking | `appointments.booking_id` | RESTRICT/HISTORICAL | same tenant |
| Appointment → Location | 0..1:N | Booking/Business contract | `appointments.location_id` | RESTRICT | same business |
| Appointment → Resource | N:N | Booking | `appointment_resources` | relationship lifecycle | same business |
| Business → Schedule | 1:0..N | Booking | `schedules.business_id` | ARCHIVE | same business |
| Schedule → AvailabilityRule | 1:0..N | Booking | `availability_rules.schedule_id` | CASCADE/ARCHIVE | same schedule |
| Schedule → AvailabilityException | 1:0..N | Booking | `availability_exceptions.schedule_id` | CASCADE/ARCHIVE | same schedule |
| Resource → Schedule | 0..1:N | Booking | controlled FK/relationship | ARCHIVE | same business |

### Booking invariants

- Booking is the commercial reservation/commitment.
- Appointment is the scheduled occurrence and may be absent before scheduling.
- BookingItem is the historical association between a booking and an Offering.
- Every committed BookingItem must preserve required snapshots.
- Every BookingItem Offering must belong to the Booking Business.
- `bookings.business_id` may be denormalized for boundary enforcement but is constrained to equal the Offering/BookingItem business.
- Appointment time must satisfy `ends_at > starts_at`.
- Double booking is prevented by the canonical Availability/Booking capability plus transactional/structural protection.
- Slot is computed/materialized data, never authoritative booking state.

---

## 9. Availability relationships

| Relationship | Cardinality | Owner | Physical shape | Delete | Tenant rule |
|---|---|---|---|---|---|
| Business → Schedule | 1:N | Booking | FK | ARCHIVE | business |
| Schedule → Rule | 1:N | Booking | FK | ARCHIVE | schedule |
| Schedule → Exception | 1:N | Booking | FK | ARCHIVE | schedule |
| Schedule → Resource | N:N/controlled | Booking | junction if needed | remove/ARCHIVE | same business |
| Availability calculation → Booking | 0:N result | Booking runtime | no authoritative FK | ephemeral | same tenant |

Availability has exactly one canonical engine. Calendar/UI/AI/Plugin integrations consume its capability and do not create alternate availability algorithms.

---

## 10. Commerce relationships

| Relationship | Cardinality | Owner | Physical shape | Delete | Tenant rule |
|---|---|---|---|---|---|
| Customer → Cart | 1:0..N | Commerce | `commerce_carts.customer_id` | EXPIRE/RETAIN | tenant validated |
| Cart → CartLine | 1:0..N | Commerce | `commerce_cart_lines.cart_id` | RESTRICT/EXPIRE | same cart |
| Cart → CheckoutSession | 1:0..N | Commerce | `commerce_checkout_sessions.cart_id` | RETAIN/HISTORICAL | same cart |
| CheckoutSession → PriceSnapshot | 0..N references | Commerce | `commerce_checkout_sessions.catalog_snapshot_refs_json` / explicit service contract | RETAIN | same tenant |
| Customer → Order | 1:0..N | Commerce | `commerce_orders.customer_id` | RESTRICT/HISTORICAL | same tenant |
| Order → OrderLine | 1:1..N | Commerce | `commerce_order_lines.order_id` | historical immutable | same order |
| Order → OrderAdjustment | 1:0..N | Commerce | `commerce_order_adjustments.order_id` | RETAIN/HISTORICAL | same order |
| Order → TransactionAttempt | 1:0..N | Commerce | `commerce_transaction_attempts.order_id` | RETAIN/HISTORICAL | same order |
| Order → FulfillmentReference | 1:0..N | Commerce | `commerce_fulfillment_references.order_id` | RETAIN/HISTORICAL | same order |
| Order → Cancellation | 1:0..N | Commerce | `commerce_cancellations.order_id` | RETAIN/HISTORICAL | same order |
| Order → RefundReference | 1:0..N | Commerce | `commerce_refund_references.order_id` | RETAIN/HISTORICAL | same order |
| Order → OrderEvent | 1:0..N | Commerce | `commerce_order_events.order_id` | IMMUTABLE | same order |
| Order → Payment | 0..N reference | Billing/Payment | `commerce_orders.payment_status_ref` / Billing contract | RETAIN/HISTORICAL | same tenant |
| Order → Invoice | 0..N reference | Billing | Billing contract / Commerce reference | RETAIN/HISTORICAL | same tenant |

### Commerce invariants

- Historical OrderLine values are snapshots, not live Catalog values.
- TransactionAttempt is Commerce orchestration evidence, not the financial ledger.
- Payment, payment attempts, refund execution and invoices remain Billing/Payment-owned.
- Refund references do not become a second financial ledger.
- Invoice line values remain immutable under the Billing invoice contract.
- Commerce cannot claim payment success or fulfillment success without authoritative external evidence.

---

## 11. Trust relationships

| Relationship | Cardinality | Owner | Physical shape | Delete | Tenant rule |
|---|---|---|---|---|---|
| VerificationCase → VerificationDocument | 1:0..N | Trust | FK | RESTRICT/retention | protected evidence |
| VerificationCase → VerificationCheck | 1:0..N | Trust | FK | RETAIN | same case |
| VerificationCase → VerificationDecision | 1:0..N | Trust | FK | IMMUTABLE/HISTORICAL | same case |
| Customer → Review | 1:0..N | Trust | `reviews.customer_id` | RETAIN/ANONYMIZE by policy | tenant validated |
| Review → canonical target | 1:1 | Trust | typed FK to Business OR Offering OR Product | RESTRICT/ARCHIVE | same tenant/workspace scope |
| ModerationCase → subject | 1:1 | Trust | controlled polymorphic reference | policy-driven | explicit tenant validation |

### Trust invariants

- Verification evidence is protected and retention-controlled.
- Verification status is authoritative only in Trust.
- Review has exactly one canonical target.
- TrustScore is derived; it is not an authoritative relationship or manual duplicate state.
- Moderation cannot silently alter the canonical review lifecycle without the appropriate capability/event.

---

## 12. Communication relationships

| Relationship | Cardinality | Owner | Physical shape | Delete | Tenant rule |
|---|---|---|---|---|---|
| Conversation → Message | 1:0..N | Communication | `messages.conversation_id` | RETAIN/ARCHIVE | same scope |
| Notification → DeliveryAttempt | 1:1..N | Communication | `delivery_attempts.notification_id` | RETAIN/operational policy | same recipient scope |
| Notification → TemplateVersion | N:1 | Communication | version reference | RESTRICT/HISTORICAL | template is versioned |
| Domain Event → Notification | 1:0..N | Communication | event/correlation reference | RETAIN | consumer relationship |

Communication consumes domain events/capabilities. It must not create shadow Booking/Order/Verification state.

---

## 13. AI relationships

| Relationship | Cardinality | Owner | Physical shape | Delete | Tenant rule |
|---|---|---|---|---|---|
| AI Operation → ProviderAttempt | 1:0..N | AI Runtime | `ai_provider_attempts.operation_id` | RETAIN/retention policy | same operation scope |
| AI Operation → RuntimeResult | 1:0..1 | AI Runtime | `ai_runtime_results.operation_id` UNIQUE | RETAIN/audit policy | same operation |
| AI Operation → UsageRecord | 1:0..N | AI Runtime | `ai_usage_records.operation_id` | RETAIN/usage policy | same tenant |
| AI Operation → PolicyDecision | 1:0..N | AI Runtime | `ai_policy_decisions.operation_id` | RETAIN/audit policy | same tenant |
| AI Operation → RoutingDecision | 1:0..N | AI Runtime | `ai_model_routing_decisions.operation_id` | RETAIN/audit policy | same tenant |
| AI Prompt → PromptVersion | 1:1..N | AI Runtime | `ai_prompt_versions.prompt_id` | RETAIN/HISTORICAL | platform/runtime scope |
| AI Schema → SchemaVersion | 1:1..N | AI Runtime | `ai_schema_versions.schema_id` | RETAIN/HISTORICAL | platform/runtime scope |

### AI invariants

- AI has no direct authoritative relationship to mutate Booking/Order/Business/etc.
- Capability invocations are recorded as operation/provenance evidence; they do not create a second execution ledger.
- Durable AI memory remains a separate gated contract.
- Model/prompt/schema/policy versions needed for auditability are captured on the canonical Runtime records.

---

## 14. Automation relationships

| Relationship | Cardinality | Owner | Physical shape | Delete | Tenant rule |
|---|---|---|---|---|---|
| Workflow → Version | 1:1..N | Automation | `automation_workflow_versions.workflow_id` | RETAIN/HISTORICAL | scope of workflow |
| WorkflowVersion → Trigger | 1:0..N | Automation | `automation_triggers.workflow_version_id` | RETAIN | workflow scope |
| WorkflowVersion → Action | 1:0..N | Automation | `automation_actions.workflow_version_id` | RETAIN | workflow scope |
| Workflow → Execution | 1:0..N | Automation | `automation_executions.workflow_id` | RETAIN | workflow scope |
| StepExecution → Attempt | 1:0..N | Automation | `automation_execution_attempts.step_execution_id` | RETAIN | execution scope |
| Execution → ApprovalReference | 1:0..N | Automation | `automation_approval_references.execution_id` | RETAIN | execution scope |

Automation orchestrates capabilities; it never becomes a second implementation of their business rules.

---

## 15. Billing relationships

| Relationship | Cardinality | Owner | Physical shape | Delete | Tenant rule |
|---|---|---|---|---|---|
| Plan → Subscription | 1:0..N | Billing | `subscriptions.plan_id` | RETAIN/HISTORICAL | organization/workspace scope |
| BillingAccount → Subscription | 1:0..N | Billing | FK | RESTRICT | same billing scope |
| Subscription → Entitlement | 1:0..N | Billing | FK/junction depending on model | RETAIN/HISTORICAL | same scope |
| Subscription → UsageRecord | 1:0..N | Billing | FK/reference | RETAIN | same scope |
| UsageMetric → UsageRecord | 1:0..N | Billing | metric key/reference | RETAIN | same scope |

Entitlement has one commercial source of truth in Billing. Access evaluates it; Access does not maintain a competing entitlement ledger.

---

## 16. Media relationships

| Relationship | Cardinality | Owner | Physical shape | Delete | Tenant rule |
|---|---|---|---|---|---|
| MediaAsset → MediaVariant | 1:0..N | Media | `media_variants.media_asset_id` | CASCADE/retain source | same scope |
| MediaAsset → Attachment | 1:0..N | Media | `media_attachments.media_asset_id` | detach only | tenant validated |
| Domain Entity → MediaAsset | N:N | Media contract | `media_attachments` | detach/archive | controlled polymorphism |

Media attachment is a reusable platform relationship. Domain modules must not create `business_images`, `offering_images`, `review_images`, etc. when the same attachment semantics apply.

---

## 17. Integration relationships

| Relationship | Cardinality | Owner | Physical shape | Delete | Tenant rule |
|---|---|---|---|---|---|
| Integration → ExternalAccount | 1:0..N | Integration | FK | REVOKE/RETAIN | tenant scope |
| Integration → Webhook | 1:0..N | Integration | FK | disable/retain | tenant scope |
| Integration → SyncJob | 1:0..N | Integration | FK | RETAIN/operational | tenant scope |
| Domain Entity → ExternalReference | 1:0..N | Integration | controlled reference | RETAIN | explicit tenant validation |
| Webhook → Delivery/Attempt | 1:0..N | Integration | FK | operational retention | same integration |

External references never transfer domain ownership to the provider.

---

## 18. Platform relationships

| Relationship | Cardinality | Owner | Physical shape | Delete | Tenant rule |
|---|---|---|---|---|---|
| Module → ModuleVersion | 1:1..N | Platform | FK | RETAIN/HISTORICAL | platform |
| Plugin → PluginVersion | 1:1..N | Platform | FK | RETAIN | platform |
| Plugin → Capability | N:N | Platform | junction | remove/retain history | capability contract |
| Plugin → Event | N:N | Platform | subscription junction | disable/unsubscribe | tenant/global scope |
| Plugin → Plugin | N:N dependency | Platform | dependency junction | RESTRICT | dependency graph must remain acyclic |
| AuditEvent → actor/entity context | 1:0..N | Platform | immutable references | IMMUTABLE | tenant context retained |
| OutboxEvent → Event consumers | 1:N logical | Platform | event envelope + consumer state where needed | replayable | tenant context in envelope |
| IdempotencyRecord → actor/scope | N:1 logical | Platform | scoped key | operational retention | exact scope key required |

---

## 19. Cross-tenant integrity rules

The following are mandatory:

```text
Workspace.organization_id = Membership.organization_id when workspace-scoped
Business.workspace_id → Workspace
Business.organization_id (if denormalized) = Workspace.organization_id
Offering.business_id → Business
Product.business_id → Business
Location.business_id → Business
Booking.customer_id → Customer within compatible tenant scope
Booking.business_id → Business
BookingItem.offering_id → Offering of Booking.business_id
Appointment.booking_id → Booking
Payment.order_id → Order of same tenant
Payment.booking_id → Booking of same tenant
Review.customer_id → Customer in compatible tenant scope
Subscription scope → BillingAccount scope
AI Agent/Workflow scope → Workspace/tenant scope
Plugin execution scope → authorized tenant/global scope
```

No consumer, API, AI tool, or plugin may bypass these invariants.

## 20. Delete and update semantics

### RESTRICT
Use when deleting the parent would destroy historical or authoritative meaning.

Typical examples: Business with committed bookings; Order with payments; Payment with refunds; VerificationCase with retained evidence.

### CASCADE
Use only for dependent records with no independent historical meaning, usually junction/configuration records.

### SET NULL
Use only when the relationship is optional and historical semantics remain intact.

### ARCHIVE / SOFT LIFECYCLE
Use for domain entities whose historical identity must remain queryable but no longer active.

### IMMUTABLE
Use for historical snapshots, audit records, financial history, and decision records where mutation would change historical meaning.

### HARD DELETE
Use only for explicitly disposable/ephemeral records after retention requirements are satisfied.

## 21. Relationship anti-patterns

Forbidden without an approved architecture decision:

- direct User → Organization FK replacing Membership;
- direct User → Workspace FK replacing Membership;
- Provider table created solely to mean Business owner/staff;
- duplicate Customer/CRM relationship tables;
- duplicate Invoice entities for different surfaces;
- separate Booking and Reservation entities representing the same commitment;
- separate Availability engines in AI, Calendar, Booking, or Plugin modules;
- `*_images` tables duplicating MediaAttachment;
- generic polymorphic foreign keys where typed FKs are practical;
- child records containing conflicting tenant ancestors;
- shadow statuses duplicating parent lifecycle;
- relationship tables that become hidden second sources of truth;
- consumer-owned copies of authoritative domain relationships.

## 22. Relationship → capability traceability

Every relationship mutation must resolve to a canonical capability.

Examples:

| Relationship operation | Canonical capability |
|---|---|
| Add membership role | `CAP.ACCESS.*` / membership management capability |
| Attach business category | Catalog/Business category capability |
| Create offering | `CAP.CATALOG.CREATE_OFFERING` |
| Set price | `CAP.CATALOG.SET_PRICE` |
| Create booking item | `CAP.BOOKING.CREATE` |
| Schedule appointment | Booking scheduling capability |
| Reserve inventory | `CAP.CATALOG.MANAGE_INVENTORY` or approved inventory capability |
| Create order item | `CAP.COMMERCE.CREATE_ORDER` |
| Capture payment | `CAP.COMMERCE.CAPTURE_PAYMENT` |
| Approve verification | `CAP.TRUST.APPROVE_VERIFICATION` |
| Send notification | `CAP.COMMUNICATION.SEND_NOTIFICATION` |
| Invoke AI tool | `CAP.AI.EXECUTE_TOOL` → target domain capability |
| Execute workflow action | `CAP.AUTOMATION.EXECUTE_ACTION` → target capability |

A relationship is data structure; the capability is the authoritative behavior for changing it.

## 23. Final relationship gates before migration

Before a physical migration is approved, confirm:

- cardinality is explicit;
- minimum/maximum cardinality is explicit;
- owner is explicit;
- FK direction is explicit;
- tenant invariant is explicit;
- delete behavior is explicit;
- update mutability is explicit;
- uniqueness is explicit;
- polymorphism is justified or rejected;
- snapshot semantics are explicit;
- lifecycle ownership is explicit;
- capability ownership is explicit;
- event consequences are explicit;
- no duplicate relationship/entity exists elsewhere;
- historical records remain reconstructable;
- cross-module access remains capability-based.

## 24. Architecture status

This matrix is the canonical relationship contract for the Phoenix data model. Any future entity or relationship must be added here before its physical migration is designed.
