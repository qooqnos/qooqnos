# Phoenix Physical Schema Blueprint

**Status:** Canonical architecture contract
**Scope:** Physical relational data dictionary and schema gates derived from the reconciled logical model.

This document is the bridge between the logical model and future module-owned migrations. It does not itself create tables or SQL. No physical table may be introduced unless its row shape, ownership, scope, lifecycle, constraints, retention, and source of truth are defined here or in an approved module-specific extension.

## 1. Non-negotiable physical rules

1. D1 is the transactional source of truth.
2. Every table has exactly one owning module.
3. Every primary key is an opaque immutable identifier; public IDs never encode tenant identity.
4. Canonical timestamps are UTC.
5. Money uses integer minor units plus ISO currency; never floating point.
6. Foreign keys enforce structural integrity; authorization and tenant policy are enforced above the database as required.
7. Cross-module physical FKs may exist for integrity, but cross-module business access is through capabilities.
8. Projection/search/embedding/analytics tables are rebuildable and never authoritative domain state.
9. Historical transaction snapshots are immutable after commit.
10. No table may become a second source of truth for an existing concept.

## 2. Canonical field contract

Every physical field must answer:

```text
name
logical type
nullable?
default
mutable?
unique?
indexed?
foreign key?
scope
classification
PII/sensitivity
encryption requirement
retention class
delete behavior
derived?
snapshot?
source of truth
owner
```

### Canonical physical types

| Domain type | Physical representation | Rule |
|---|---|---|
| EntityId | TEXT opaque | immutable, unique |
| Tenant/Organization/Workspace ID | TEXT | FK + scope validation |
| boolean | INTEGER/BOOLEAN | normalized consistently |
| integer | INTEGER | counts/minor units |
| decimal | INTEGER/DECIMAL according to bounded domain | never money float |
| timestamp | TEXT/INTEGER according to DB convention | UTC only |
| date | TEXT ISO date | no timezone semantics |
| JSON extension | TEXT JSON | only for flexible metadata, not core relational invariants |
| Money | amount_minor INTEGER + currency TEXT | paired fields |
| enum/state | TEXT | canonical state vocabulary only |
| Version | TEXT | explicit compatibility/version semantics |

## 3. Shared columns

Only where semantically applicable:

- `id` — opaque immutable ID.
- `created_at` — UTC creation timestamp.
- `updated_at` — UTC modification timestamp for mutable records.
- `created_by` / `updated_by` — actor reference when meaningful; not a replacement for audit.
- `version` — optimistic/concurrency or domain version only when the aggregate requires it.
- `metadata` — non-authoritative extension data only.

Do not blindly add `organization_id`, `workspace_id`, `created_by`, soft-delete flags, or metadata to every table. Scope follows ownership and authorization semantics.

## 4. Foundation / Identity / Access

| Table | Required canonical fields | Important constraints |
|---|---|---|
| `organizations` | `id`, `name`, `slug?`, `status`, timestamps | slug unique within required global/platform scope |
| `workspaces` | `id`, `organization_id`, `name`, `slug?`, `status`, timestamps | organization FK; slug unique within organization |
| `users` | `id`, identity status, timestamps | no email-as-primary-key; immutable ID |
| `user_profiles` | `user_id`, profile fields, locale/timezone?, timestamps | 1:1 User; personal fields classified |
| `external_identities` | `id`, `user_id`, provider, subject, timestamps | provider+subject unique; secrets not stored here |
| `sessions` | `id`, `user_id`, status, issued/expires/revoked timestamps | token material must be protected/hashed as appropriate |
| `memberships` | `id`, `user_id`, `organization_id`, `workspace_id?`, status, timestamps | valid org/workspace relationship; scoped uniqueness |
| `roles` | `id`, scope type, name, status | canonical role scope; no duplicate role semantics |
| `permissions` | `id`, stable permission key, description | permission key unique |
| `membership_roles` | `membership_id`, `role_id` | composite uniqueness |
| `role_permissions` | `role_id`, `permission_id` | composite uniqueness |

Membership is the only canonical User-to-tenant relationship. Direct user ownership FKs to organization/workspace are not canonical.

## 5. Business / Location

### `businesses`

Required:

```text
id
organization_id
workspace_id
name/display_name
status
publication_status
business_type?
primary_category_id?
default_locale?
timezone?
default_currency?
created_at
updated_at
```

Rules:

- Business belongs to exactly one Workspace.
- Organization must match Workspace organization.
- Lifecycle status and publication status are separate.
- Verification status is not duplicated as Business status.
- Owner is a relationship/permission concept, not a Provider entity.

### `business_profiles`

`business_id`, localized/public description, contact presentation, branding references, timestamps.

Do not store derived rating, trust score, search rank, or availability as authoritative columns.

### `locations`

`id`, `business_id`, display name, location type, timezone?, address fields/value, geo point?, status, timestamps.

`Location` is a domain record; `Address` and `GeoPoint` are shared value semantics and must not become competing Location entities.

## 6. Catalog / Taxonomy

### `categories`

`id`, parent_id?, scope, canonical key, status, timestamps.

Constraints:

- no self-parent;
- hierarchy cycles prohibited by domain validation;
- canonical key scoped according to taxonomy ownership.

### `business_categories` / `offering_categories`

Explicit junctions with stable IDs or composite uniqueness where the relationship has no independent lifecycle.

### `services`

`id`, business_id?, canonical name, description?, status, metadata, timestamps.

Service is the underlying definition; it is not a substitute for Offering.

### `products`

`id`, business_id, name, description?, status, timestamps.

### `product_variants`

`id`, product_id, SKU?, attributes, status, timestamps.

SKU uniqueness is scoped to Business unless an explicit platform-wide requirement exists.

### `offerings`

`id`, business_id, offering_type, title, description?, service_id?, product_id?, status, publication state, timestamps.

Rules:

- exactly one Business;
- optional typed reference to underlying Service/Product according to offering type;
- no generic polymorphic `sellable_id` unless an ADR proves it necessary;
- published Offering must satisfy publication policy.

### `prices`

`id`, offering_id, amount_minor, currency, pricing_type, effective_from, effective_to?, status, timestamps.

Historical pricing must remain reconstructable. Current-price shortcuts are projections/queries, not historical truth.

### `inventory_items`

`id`, product_variant_id, location_id, quantity_on_hand, quantity_reserved, version, timestamps.

Invariant: reserved quantity cannot exceed available stock; quantities cannot become negative.

## 7. Customer

### `customers`

`id`, organization_id, user_id?, status, created_at, updated_at.

A Customer may be a guest. `user_id` is an optional mapping, never the Customer identity itself.

### `customer_profiles`

`customer_id`, preferences/profile data, locale/timezone?, timestamps.

### `customer_addresses`

`id`, customer_id, address value fields, type, default flag?, timestamps.

### `customer_relationships`

`id`, customer_id, business_id, status, relationship type/source, timestamps.

One canonical relationship table; do not create separate CRM/partner/customer relationship tables for the same semantics.

## 8. Booking / Availability

### `bookings`

Required canonical fields:

```text
id
organization_id
workspace_id
business_id
customer_id
status
currency
total_amount_minor?
policy_snapshot?
created_at
updated_at
state timestamps
```

`business_id` may be denormalized for security/query boundaries, but must equal the Business of all booked Offerings. It is not permission to bypass Catalog.

### `booking_items`

`id`, `booking_id`, `offering_id`, quantity, title_snapshot, price_minor_snapshot, currency_snapshot, duration_snapshot?, policy_snapshot?, timestamps/immutable commit metadata.

Historical fields become immutable after booking commit.

### `appointments`

`id`, `booking_id`, status, starts_at, ends_at, timezone context?, location_id?, timestamps.

Appointment is a scheduled occurrence. It is not the Booking aggregate replacement.

### `schedules`

`id`, business_id/location_id/resource_id?, timezone, recurrence definition, booking horizon, lead time, buffer configuration, status, version, timestamps.

### `availability_rules`

`id`, schedule_id, rule type, recurrence payload, start/end constraints, capacity, version, timestamps.

### `availability_exceptions`

`id`, schedule_id, effective interval/date, exception type, capacity/closure data, version, timestamps.

### `resources`

`id`, business_id, location_id?, resource_type, status, capacity, metadata, timestamps.

Resource taxonomy remains extensible; no Provider entity is introduced merely to represent staff.

### Slot

No authoritative `slots` table in the canonical first implementation. A materialized slot table is permitted only as a rebuildable optimization with schedule/version references, expiration/invalidation semantics, and no authority over booking truth.

## 9. Commerce / Financial history

### `carts` / `cart_items`

Mutable purchase intent. Cart data must not become historical transaction truth.

### `orders`

`id`, organization/workspace scope, customer_id, status, currency, totals, policy/tax/discount snapshot references, timestamps.

### `order_items`

Immutable historical fields: `order_id`, source offering/product variant reference, title snapshot, quantity, unit price snapshot, currency, tax snapshot, discount snapshot, total snapshot.

### `payments`

`id`, order_id?, booking_id?, customer_id?, status, amount_minor, currency, provider, external_reference?, timestamps.

Provider secrets/credentials belong to Integration/secret management, not Payment rows.

### `payment_attempts`

`id`, payment_id, provider, status, amount_minor, currency, external_reference?, attempted_at, failure code/category?, metadata-safe fields.

### `refunds`

`id`, payment_id, amount_minor, currency, status, reason?, external_reference?, created_at.

Invariant: cumulative refunds cannot exceed captured amount.

### `invoices` / `invoice_lines`

Invoice header and immutable line snapshots. Marketplace transaction invoices are owned by Commerce; subscription billing semantics remain Billing-owned. Do not create two invoice entities.

## 10. Trust / Verification / Moderation

### `verification_cases`

`id`, organization/business/user subject reference, verification_type, status, policy_version, timestamps.

The subject model must use an approved typed-target strategy or explicitly controlled polymorphism.

### `verification_documents`

`id`, verification_case_id, protected media reference, checksum, classification, retention/expiry metadata, timestamps.

Raw evidence belongs in protected storage; D1 stores metadata/reference.

### `verification_checks`

`id`, verification_case_id, requirement key, status, evidence reference?, evaluated_at, policy/version.

### `verification_decisions`

`id`, verification_case_id, decision, actor/system reference, reason code, policy version, created_at.

### `reviews`

`id`, customer_id, rating value, content, moderation state, typed target reference(s), timestamps.

A Review has exactly one canonical target according to the final typed-target matrix. Avoid generic target_type/target_id where FK integrity is important.

### `moderation_cases`

`id`, subject reference, status, policy/version, opened/resolved timestamps.

Polymorphic moderation subjects are allowed only under the controlled polymorphism contract.

## 11. Communication

### `conversations`

`id`, scope, status, timestamps.

### `messages`

`id`, conversation_id, sender reference, content, classification, timestamps.

### `notifications`

`id`, recipient reference, event/action reference, template version, channel, status, timestamps.

### `delivery_attempts`

`id`, notification_id, provider/channel, status, attempted_at, safe provider reference, retry metadata.

Communication owns delivery behavior; domain modules only emit canonical events/capabilities.

## 12. AI / Automation

### `agents`

`id`, workspace scope, name, status, model reference, safety policy reference, configuration, timestamps.

### `ai_conversations` / `ai_messages`

AI-specific context and messages. They are distinct from Communication Conversation/Message.

### `ai_runs`

`id`, agent_id?, ai_conversation_id?, status, model/version, prompt_version?, policy_version?, correlation/request IDs, usage/cost fields, timestamps.

### `ai_tool_calls`

`id`, ai_run_id, capability_id/version, status, input/output references or redacted payload, timestamps.

Tool records reference Capability contracts; they never own domain behavior.

### `ai_memories`

`id`, owner scope, content/reference, provenance, consent reference?, retention/expiry, classification, timestamps.

Memory is never authoritative Business/Booking/Commerce state.

### `workflows`, `workflow_triggers`, `workflow_actions`, `workflow_executions`

Workflow definitions reference canonical event/capability identifiers, never implementation class names or repositories.

## 13. Billing / Media / Integration / Platform

### Billing

`plans`, `subscriptions`, `entitlements`, `usage_records` use explicit scope, lifecycle, version and timestamps. Billing is the source of commercial entitlement grants; Access evaluates them.

### Media

`media_assets`: owner/scope, storage key, checksum, MIME/type, size, classification, status, timestamps.

`media_variants`: source asset, variant type, storage key, processing status, checksum.

`media_attachments`: media_asset_id + typed supported resource relationship; generic polymorphism only under the media attachment contract.

### Integration

`integrations`, `external_accounts`, `webhooks`, `sync_jobs`, `external_references` contain provider references and lifecycle state, not domain ownership.

### Platform

`modules`, `module_versions`, `tenant_modules`, `feature_flags`, `audit_events`, `idempotency_records`, `outbox_events` are platform-owned operational/foundation records. They must not be duplicated by domain modules.

## 14. Scope matrix

| Scope | Typical owners | Storage rule |
|---|---|---|
| GLOBAL | User, Organization, Module, Permission | no tenant FK unless independently required |
| ORGANIZATION | Workspace, tenant configuration, subscriptions | organization_id required |
| WORKSPACE | Business, Agent, Workflow, many operational records | workspace_id + organization derivation/validation |
| BUSINESS | Offering, Location, business configuration | business_id; tenant derived/validated |
| USER | User profile/session | user_id |
| CUSTOMER | Customer profile, booking history | customer_id + tenant boundary |
| PUBLIC | published discovery projection | no private write authority |

Do not mechanically store every ancestor scope on every table. Denormalize only when it materially improves tenant enforcement/query boundaries and maintain explicit invariants.

## 15. Index / uniqueness policy

Required index classes:

- every PK;
- every FK used for joins or authorization;
- scoped lookup keys used by capabilities;
- lifecycle/status queries where operationally justified;
- effective-date queries for prices/schedules;
- idempotency lookup keys;
- outbox publication state;
- external provider identity keys.

Required uniqueness examples:

- external provider + subject;
- membership scoped to user/org/workspace;
- role/permission junctions;
- business/category and offering/category junctions;
- idempotency actor+scope+key;
- outbox event ID;
- external reference within its provider/integration scope.

Uniqueness must not accidentally prevent legitimate multi-tenant reuse.

## 16. Deletion / retention policy

Default policy by class:

| Data | Default behavior |
|---|---|
| Identity/security history | restrict/retention controlled |
| Membership | soft lifecycle, historical retention |
| Business/catalog | archive/soft lifecycle |
| Booking/order/payment/invoice | immutable historical retention; restrict deletion |
| Verification evidence | protected retention/expiry, legal policy |
| Reviews | moderation/archive policy |
| AI memory | explicit expiry/deletion policy |
| Sessions | expiry/hard deletion where safe |
| Outbox/idempotency | operational retention |
| Projections | rebuildable deletion/rebuild |

No deletion policy may silently violate audit, legal retention, or historical financial requirements.

## 17. Derived and snapshot rules

A field is **derived** only when its source, owner, rebuild strategy, and staleness semantics are documented.

A field is a **snapshot** only when it preserves historical meaning at a transaction boundary and becomes immutable at the defined point.

Forbidden pattern:

```text
mutable catalog.price
      ↓
reconstruct yesterday's order
```

Required pattern:

```text
order_item.unit_price_snapshot
      ↓
historical truth
```

## 18. Physical schema gate

A future migration may create a table only after this checklist is complete:

- canonical domain term exists;
- owner module exists;
- aggregate/relationship role defined;
- source of truth defined;
- tenant scope defined;
- PK/FK/UNIQUE strategy defined;
- lifecycle defined;
- invariant enforcement layer defined;
- PII/classification defined;
- retention/delete policy defined;
- derived/snapshot fields identified;
- indexes justified;
- capability contract identified for every mutation;
- event/audit semantics identified;
- migration dependency and rollback/recovery strategy defined;
- no existing table/capability already owns the same fact.

## 19. Explicit gates still open

The following must be finalized before their concrete SQL migrations:

1. structured Address shape;
2. final Role scope matrix;
3. Resource taxonomy;
4. exact BookingItem snapshots;
5. Review typed-target matrix;
6. Offering Package/Bundle composition;
7. tax/discount ownership and snapshots;
8. Payment provider reference contract;
9. search/vector projection storage;
10. AI Memory storage/retention;
11. Integration/Webhook/Sync retention and retry rules.

These are controlled architecture gates, not provisional implementation instructions.

## 20. Definition of Done

The physical data model is architecture-complete when every planned physical table can be generated from this blueprint without inventing a new concept, scope, source of truth, ownership rule, lifecycle, or business invariant during migration design.
