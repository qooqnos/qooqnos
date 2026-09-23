# Phoenix Migration Blueprint

**Status:** Canonical architecture contract
**Scope:** Migration ownership, ordering, dependency graph, rollout strategy, compatibility, backfill, recovery, and projection rebuild rules.

This document defines how the approved data model becomes physical schema. It does **not** authorize implementation of business logic inside migrations and does not itself create SQL.

## 1. Non-negotiable rules

1. Every schema object has exactly one owning module.
2. Every migration has exactly one owning module.
3. Migrations evolve schema; they do not implement domain workflows.
4. Applied migrations are immutable.
5. Migration identity is globally unique and checksummed.
6. Dependency order follows the module dependency DAG.
7. Cross-module FKs are allowed for structural integrity, but runtime business access remains capability-based.
8. Projection migrations are separate from canonical domain migrations.
9. Backfills are resumable, bounded, observable, idempotent operations.
10. Breaking schema changes use Expand → Migrate → Switch → Contract.
11. Migration failure must leave a deterministic recovery path.
12. No migration may introduce a second source of truth.

## 2. Migration layers

### Layer A — Foundation

Owned by Platform/Foundation:

- migration registry
- module registry
- organization/workspace primitives
- user identity primitives
- membership primitives
- permission primitives
- audit
- idempotency
- outbox
- foundational indexes/constraints

Foundation must not contain marketplace domain tables merely because they are needed early by an application route.

### Layer B — Core domain

Ordered by dependency:

```text
Identity
   ↓
Access
   ↓
Business
   ↓
Catalog
   ↓
Customer
   ↓
Booking / Availability
   ↓
Commerce
   ↓
Trust
Communication
AI
Automation
Billing
Media
Integration
Discovery / Projections
```

This is a logical dependency order, not a requirement that every module depend directly on every module above it. Each module consumes public contracts only.

### Layer C — Projections

Search, recommendation, analytics, vector, AI-context and other derived structures are separately migratable and rebuildable.

Projection schema may be dropped/recreated without destroying canonical domain truth.

## 3. Canonical migration identity

Each migration must have:

```text
migration_id
module_id
version
name
checksum
depends_on[]
transaction_strategy
compatibility_window
backfill_required?
recovery_strategy
created_at
```

Recommended stable identifier format:

```text
<module>.<version>.<name>
```

Example:

```text
identity.0002.membership-scope
```

Migration version is not the same as:

- module version
- capability version
- API version
- permission version
- plugin version
- schema object version

## 4. Migration registry

The existing centralized Migration Registry remains the sole source of migration execution state.

Canonical states:

```text
PENDING
RUNNING
APPLIED
FAILED
ROLLED_BACK

```

`APPLIED` records retain migration ID, checksum, execution timestamp and relevant metadata.

A changed checksum for an already-applied migration is a deployment integrity failure, not an invitation to re-run it.

There must be no second migration registry hidden inside a domain module or plugin.

## 5. Dependency graph

### Foundation graph

```text
platform.foundation
├── identity.tenant
├── identity.user
├── identity.membership
├── access.permission
├── platform.audit
├── platform.idempotency
└── platform.outbox
```

### Domain graph

```text
Identity
   └── Access
        └── Business
             ├── Catalog
             │    └── Discovery Projection
             ├── Customer
             │    └── Booking
             │         └── Commerce
             └── Trust

Communication ← canonical events from domain modules
AI ← capabilities + events from domain modules
Automation ← events + capabilities
Billing ← Identity/Workspace + commercial events
Media ← referenced by Business/Catalog/Trust/AI
Integration ← adapters around domain capabilities/events
```

The graph must remain acyclic at module level.

If a cycle appears:

1. extract a genuinely shared contract/value object;
2. replace synchronous dependency with canonical event where appropriate;
3. introduce a rebuildable projection where read composition is the real need;
4. never hide the cycle through direct repository/table access.

## 6. Foundation migration sequence

The already-existing foundation migration remains the base. Future migrations extend it rather than replacing it.

Conceptual sequence:

```text
F0001 foundation core
F0002 migration registry hardening
F0003 module/version registry hardening
F0004 capability/permission registry extensions
F0005 operational integrity extensions
```

Exact numeric migration IDs must follow the repository's existing migration catalog. Do not renumber applied migrations.

## 7. Identity migration sequence

```text
I0001 User/Profile/ExternalIdentity/Session completeness
I0002 Organization/Workspace/Membership constraints
I0003 Membership scope and uniqueness hardening
I0004 Identity retention/security metadata
```

Rules:

- Membership remains the canonical tenant relationship.
- User must not gain direct organization/workspace ownership columns as a shortcut.
- Identity migrations do not create Customer records automatically unless an explicit onboarding workflow requires it.

## 8. Access migration sequence

```text
A0001 Role/Permission completeness
A0002 Role scope matrix
A0003 Membership role constraints
A0004 Policy/entitlement reference extensions
```

Authorization runtime remains outside migration logic. Migrations establish the structures and constraints consumed by Access capabilities.

## 9. Business migration sequence

```text
B0001 Business core
B0002 BusinessProfile
B0003 Location + Address representation
B0004 BusinessCategory relationships
B0005 Business lifecycle/publication constraints
```

Rules:

- Business always belongs to Workspace.
- Workspace → Organization integrity is preserved.
- Derived trust/rating/search fields are not introduced as authoritative columns.

## 10. Catalog migration sequence

```text
C0001 Category taxonomy
C0002 Service
C0003 Product/ProductVariant
C0004 Offering
C0005 OfferingCategory relationships
C0006 Pricing
C0007 Inventory
C0008 Offering composition
C0009 Catalog historical/version constraints
```

Catalog is the source of truth for current catalog definitions and base pricing. It is not the source of historical Order/Booking transaction snapshots.

## 11. Customer migration sequence

```text
CU0001 Customer
CU0002 CustomerProfile (logical aggregate; no standalone table)
CU0003 CustomerAddress
CU0004 CustomerRelationship
```

`user_id` remains optional to support guests. Customer identity must not be replaced by User identity.

## 12. Booking / Availability migration sequence

```text
BK0001 Booking
BK0002 BookingItem
BK0003 Appointment
BK0004 Resource
BK0005 Schedule
BK0006 AvailabilityRule
BK0007 AvailabilityException
BK0008 booking/resource constraints
```

Rules:

- BookingItem is the historical commercial snapshot boundary.
- Appointment is an occurrence, not a replacement for Booking.
- Slots are computed/operational by default and do not receive canonical authority.
- Double-booking prevention requires domain + transaction/constraint strategy.

## 13. Commerce migration sequence

```text
CO0001 Cart/CartItem
CO0002 Order/OrderItem
CO0003 Payment/PaymentAttempt
CO0004 Refund
CO0005 Invoice/InvoiceLine
CO0006 tax/discount snapshot fields
CO0007 financial integrity constraints
```

Rules:

- Historical transaction fields become immutable at commit boundaries.
- Provider credentials never enter Commerce schema.
- Payment provider references remain Integration-compatible.
- Refund totals cannot exceed captured amounts.

## 14. Trust migration sequence

```text
T0001 VerificationCase
T0002 VerificationDocument
T0003 VerificationCheck
T0004 VerificationDecision
T0005 Review
T0006 ModerationCase
T0007 Trust projections
```

Sensitive verification evidence uses protected storage references; the relational database stores metadata and integrity references.

## 15. Communication migration sequence

```text
M0001 Conversation/Message
M0002 Notification/Template
M0003 DeliveryAttempt
M0004 delivery/idempotency indexes
```

Communication consumes domain events and owns channel delivery state.

## 16. AI migration sequence

```text
AI0001 Agent
AI0002 AIConversation/AIMessage
AI0003 AIRun
AI0004 AIToolCall
AI0005 AI Memory
AI0006 safety/evaluation operational records
```

AI tables are operational/contextual. They do not become authoritative domain state.

## 17. Automation migration sequence

```text
AU0001 Workflow
AU0002 Trigger
AU0003 Action/Condition
AU0004 WorkflowExecution
AU0005 Task
```

Workflow definitions reference canonical event and capability IDs, never implementation class names.

## 18. Billing migration sequence

```text
BL0001 Plan
BL0002 BillingAccount
BL0003 Subscription
BL0004 Entitlement
BL0005 UsageRecord
```

Billing owns subscription economics and entitlement grants. Access evaluates authorization; it does not become a second entitlement source.

## 19. Media migration sequence

```text
ME0001 MediaAsset
ME0002 MediaVariant
ME0003 MediaAttachment
ME0004 media integrity/retention metadata
```

No domain module may create its own canonical image/file table for the same asset semantics.

## 20. Integration migration sequence

```text
IN0001 Integration
IN0002 ExternalAccount
IN0003 ExternalReference
IN0004 Webhook
IN0005 SyncJob
IN0006 retry/idempotency constraints
```

Integration stores external connectivity state. It does not own the domain entity represented by an external system.

## 21. Discovery / projection migration sequence

```text
D0001 search projection schema
D0002 facets/suggestions
D0003 ranking projection metadata
D0004 vector/embedding projection metadata
```

These migrations are rebuildable. A projection migration failure must never make canonical transaction writes unavailable unless the capability explicitly declares a non-authoritative dependency, which is discouraged.

## 22. Expand → Migrate → Switch → Contract

Breaking schema evolution follows four phases.

### Expand

Add new nullable columns/tables/indexes while old consumers remain valid.

### Migrate

Backfill historical rows in bounded, resumable batches.

### Switch

Move capability implementation to the new representation while preserving compatibility during the transition window.

### Contract

After all consumers, plugins, projections, jobs and historical requirements are validated, remove the old representation.

Never combine destructive Contract work with an unverified consumer switch.

## 23. Backfill contract

A backfill must define:

```text
job_id
source_of_truth
target_representation
batch_size
cursor/checkpoint
idempotency strategy
retry strategy
observability
validation query/metric
completion condition
rollback/recovery strategy
```

Backfills must not silently mutate immutable historical snapshots.

A backfill that changes business meaning is not a schema backfill; it requires a domain migration plan and explicit decision.

## 24. Seed vs migration vs bootstrap

These are distinct:

- **Migration:** evolves schema.
- **Backfill:** transforms existing data into a new compatible representation.
- **Seed:** installs controlled reference/configuration data.
- **Bootstrap:** initializes runtime/module registration.

No migration should become a general-purpose application bootstrap script.

## 25. Plugin migrations

A plugin may own plugin-specific schema only after:

1. Plugin manifest is validated.
2. Plugin dependency graph is valid.
3. Required capabilities exist at compatible versions.
4. Plugin migration namespace is unique.
5. Plugin tables have one plugin owner.
6. Uninstall semantics are explicit.

Plugin schema may not duplicate core domain tables.

Plugin uninstall must not destroy canonical core data. Plugin-owned data requires an explicit retention/archive/delete policy.

## 26. Projection rebuild contract

Every projection must declare:

```text
projection_id
source entities/events
projection version
rebuild command/capability
checkpoint strategy
staleness semantics
failure recovery
```

A projection can be dropped and rebuilt from canonical source without losing domain truth.

## 27. Migration transaction strategy

Prefer atomic D1 transactions for structural changes supported by the platform.

For operations that cannot safely be atomic:

- split into deterministic phases;
- record progress in operational state;
- make each phase resumable;
- validate pre/post conditions;
- never pretend a partial migration is atomic.

Long-running data movement belongs in resumable backfill jobs, not in a migration transaction that can exceed operational limits.

## 28. Recovery strategy

Every migration must define whether recovery is:

- automatic retry;
- safe re-run because operation is idempotent;
- forward-fix migration;
- restore/recovery procedure;
- manual intervention with explicit state.

Applied migrations are not edited to repair production state. A corrective migration is created.

## 29. Tenant isolation migration gate

Before applying a migration, verify:

- all tenant-scoped rows have the correct owner scope;
- new FKs cannot cross tenant boundaries;
- unique constraints are scoped correctly;
- backfills cannot mix tenants;
- public projections cannot expose private tenant data;
- historical snapshots preserve their tenant provenance.

## 30. Migration Definition of Done

A migration is complete only when:

- owner is explicit;
- dependency graph is valid;
- migration ID/version is unique;
- checksum is recorded;
- forward path is defined;
- transaction strategy is defined;
- recovery strategy is defined;
- indexes and constraints are explicit;
- tenant isolation is verified;
- retention/delete semantics are compatible;
- backfill is separated when needed;
- capability compatibility is preserved;
- plugin/projection consumers are considered;
- documentation is updated;
- no duplicate source of truth is introduced.

## 31. Implementation authorization boundary

This blueprint authorizes the architecture of future migrations but does **not** authorize immediate SQL implementation.

The next implementation planning artifact is the **Migration Dependency Graph / Execution Plan**, which maps the existing repository migrations to these canonical module boundaries and identifies exactly which existing migrations remain authoritative, which need compatibility treatment, and which future migrations are required.
