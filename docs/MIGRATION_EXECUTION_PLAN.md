# Migration Execution Plan

## Purpose

This document converts the canonical migration architecture into an execution sequence for the current repository. It maps existing migrations to canonical bounded contexts and defines the safe path from the current schema to the target modular schema.

This is an architecture/execution plan only. It does not authorize implementation of future SQL migrations by itself.

## Current migration authority

The repository currently contains two migrations:

- `0001_foundation.sql` — foundational identity, access, module/platform, audit, idempotency, and outbox schema.
- `0002_onboarding.sql` — onboarding lifecycle schema.

The existing migration runner/catalog remains the single source of migration state. Applied migrations are immutable.

## Canonical execution order

Future schema evolution follows the bounded-context dependency order:

1. Foundation / platform hardening
2. Identity
3. Access
4. Business
5. Catalog
6. Customer
7. Booking / Availability
8. Commerce
9. Trust
10. Communication
11. AI Runtime
12. Automation
13. Billing / Payment
14. Media
15. Integration
16. Discovery / projections

Recommended migration identifiers remain module-owned and monotonic, for example:
`identity.0002.membership-scope`, `business.0001.business`, `catalog.0001.offering`.

Migration version is distinct from module, capability, API, permission, and plugin versions.

## Existing schema ownership mapping

| Existing table | Canonical owner | Treatment |
|---|---|---|
| organizations | Identity | retain as canonical organization root |
| users | Identity | retain as canonical user root |
| external_identities | Identity | retain and evolve through Identity migrations |
| workspaces | Identity | retain as canonical workspace root |
| memberships | Identity | retain; harden scope invariants before expansion |
| roles | Access | retain as canonical role definition |
| permissions | Access | retain as canonical permission definition |
| role_permissions | Access | retain as canonical role-permission relation |
| membership_roles | Access | retain; evolve toward explicit role scope |
| modules | Platform | retain as module registry |
| module_versions | Platform | retain as module version registry |
| tenant_modules | Platform | retain as tenant/module enablement |
| feature_flags | Platform | retain as platform feature flags |
| audit_events | Platform | retain as immutable operational audit trail |
| idempotency_records | Platform | retain as operational idempotency store |
| outbox_events | Platform | retain as transactional event outbox |
| schema_migrations | Platform | retain as sole migration state authority |
| onboarding_profiles | Business / onboarding capability | retain current lifecycle; evolve ownership only through compatibility migration |

No existing table is duplicated merely to match a future bounded context.

## Compatibility and hardening sequence

### Phase A — Preserve existing truth

Existing tables remain authoritative. No parallel replacement tables are introduced solely for architectural naming.

### Phase B — Harden boundaries

Add constraints, indexes, scope invariants, and compatibility fields only where required by the canonical model. Changes must be backward compatible with current consumers.

### Phase C — Introduce canonical capabilities

Expose domain behavior through the owning module's capability contract. API, AI, automation, plugins, and administration consume the capability rather than implementing the behavior independently.

### Phase D — Backfill

Every backfill must be resumable, idempotent, tenant-safe, observable, and independently verifiable. Backfill is operational work, not a schema migration disguised as application logic.

### Phase E — Switch consumers

Consumers move to the canonical capability/data representation only after compatibility and validation gates pass.

### Phase F — Contract obsolete representation

Only after all consumers have migrated, data integrity has been validated, and rollback is no longer dependent on the obsolete representation may the old representation be deprecated or removed.

## Initial migration roadmap

| Sequence | Context | Intent |
|---|---|---|
| F0001 | Foundation | Existing foundation baseline |
| F0002 | Foundation | Platform/schema hardening |
| I0001 | Identity | Canonical identity/profile/session/consent expansion |
| A0001 | Access | Explicit role scope and policy foundations |
| B0001 | Business | Business/profile/location foundations |
| C0001 | Catalog | Offering/category/pricing foundations |
| CU0001 | Customer | Customer/address/relationship foundations |
| BK0001 | Booking | Schedule/resource/booking/appointment foundations |
| CO0001 | Commerce | Cart/checkout/order/commercial-snapshot foundations and financial orchestration references |
| T0001 | Trust | Verification/review/moderation foundations |
| M0001 | Communication | Conversation/message/notification foundations |
| AI0001 | AI | Agent/run/tool/memory foundations |
| AU0001 | Automation | Workflow/trigger/action/execution foundations |
| BL0001 | Billing / Payment | Plan/subscription/usage plus payment/settlement/invoice financial foundations when their contracts are closed |
| ME0001 | Media | Asset/variant/attachment foundations |
| IN0001 | Integration | Integration/webhook/sync foundations |
| D0001 | Discovery | Rebuildable search/filter/facet projection foundations |

The identifiers above are planning identifiers, not permission to create migrations immediately.

## Hard gates before each migration

1. Owning module is identified.
2. Capability contract exists for behavior affected by the schema.
3. Canonical vocabulary has no unresolved naming conflict.
4. Relationship/cardinality rules are documented.
5. Tenant boundary is explicit and testable.
6. Existing consumers are inventoried.
7. Expand/migrate/switch/contract strategy is defined for breaking changes.
8. Backfill and rollback strategy is defined where data movement is required.
9. Projection data is explicitly marked rebuildable and non-authoritative.
10. Migration Definition of Done is satisfied, including authorization and tenant-isolation validation.

## Cross-module rules

- One table has one owning module.
- Cross-module behavior is accessed through capabilities, not repository/table calls.
- Cross-module foreign keys may enforce structural integrity, but do not grant access to another module's data layer.
- One canonical implementation per capability.
- Events have one producer and many consumers.
- No projection, search index, embedding store, cache, or analytics table becomes domain source of truth.
- Historical commercial snapshots are immutable after commitment.
- External provider identifiers are references, never canonical domain identifiers.

## Rollout safety

Breaking schema changes use:

`Expand → Migrate → Switch → Contract`

Backfills use bounded batches and checkpoints. Each migration must be safely retryable or explicitly define why retry is impossible. Recovery must preserve tenant isolation and must not publish inconsistent domain events.

## Current status

The repository is ready for migration execution planning, but future domain migrations should not be implemented until their module capability contracts and implementation Definition of Done are approved. This document is the bridge from the canonical data model to implementation sequencing.
