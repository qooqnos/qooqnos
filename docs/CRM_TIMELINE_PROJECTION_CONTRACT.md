# CRM Timeline Projection Contract

**Status:** Canonical implementation contract  
**Owner:** CRM  
**Scope:** `crm_timeline_events` → `crm_timeline_projections` read model, incremental projection, rebuild, consistency and privacy boundaries.

## 1. Purpose

`crm_timeline_events` remains the canonical CRM timeline event/reference store. The originating domain remains authoritative for the underlying business fact.

`crm_timeline_projections` is a disposable, rebuildable read model used only for timeline reads. It must never become a second source of truth.

The projection exists to provide a stable, indexed timeline query shape for:

- relationship timeline reads;
- customer timeline reads;
- workspace-scoped CRM activity feeds;
- cursor pagination;
- future dashboard reads that only need timeline-derived state.

## 2. Ownership

| Concern | Owner |
|---|---|
| Underlying business fact | Originating domain |
| Normalized timeline event/reference | CRM `crm_timeline_events` |
| Timeline read model | CRM `crm_timeline_projections` |
| Authorization / visibility policy | Platform + CRM policy |
| Delivery/retry | Platform Outbox/Queue |
| Rebuild orchestration | CRM |

No consumer may write directly to the projection table.

## 3. Read-model row contract

One projection row exists for exactly one canonical timeline event.

Required fields:

| Field | Semantics |
|---|---|
| `id` | Stable projection identifier; equal to `timeline_event_id` |
| `organization_id` | Tenant scope copied from source event |
| `workspace_id` | Workspace scope copied from source event |
| `relationship_id` | CRM relationship scope |
| `customer_id` | Denormalized read key resolved from the relationship |
| `business_id` | Denormalized read key resolved from the relationship |
| `timeline_event_id` | FK/reference to canonical event; unique |
| `source_module` | Originating module |
| `source_event_id` | Originating event idempotency key |
| `event_type` | Versioned event type |
| `event_version` | Source event schema version |
| `occurred_at` | Canonical event time |
| `received_at` | CRM ingestion time |
| `actor_reference` | Actor reference where applicable |
| `visibility` | Visibility class copied from canonical event |
| `redaction_class` | Redaction policy class copied from canonical event |
| `projection_version` | Read-model transformation version |
| `projected_at` | Last successful projection time |
| `created_at` | Projection creation time |
| `updated_at` | Last projection update time |

The projection deliberately does not own mutable business state and does not introduce a second payload authority.

## 4. Ordering and pagination

Canonical ordering is:

```text
occurred_at DESC, timeline_event_id DESC
```

The second key makes ordering deterministic when events share the same timestamp.

Read APIs must use cursor pagination for large histories. A cursor represents the last `(occurred_at, timeline_event_id)` pair and is scoped to the requesting tenant/workspace/visibility context.

Offset pagination is not the canonical contract.

## 5. Projection application

Projection application is idempotent.

For a source event:

1. validate tenant/workspace/relationship scope;
2. resolve `customer_id` and `business_id` from the authoritative relationship;
3. insert the projection if absent;
4. if present, update only when the incoming `projection_version` is greater than the stored version;
5. never allow an older/out-of-order delivery to overwrite a newer projection;
6. preserve `timeline_event_id` and source-event identity;
7. update `projected_at` and `updated_at` only for an accepted projection write.

The same source event may be delivered repeatedly without creating duplicate rows.

## 6. Consistency model

The canonical event store is authoritative. The projection is **eventually consistent** during asynchronous replay, but incremental writes made by the CRM event ingestion boundary should project in the same database transaction as event persistence whenever the source event is already available in CRM.

The following invariant must hold after a successful projection:

```text
projection.timeline_event_id = event.id
projection.organization_id  = event.organization_id
projection.workspace_id     = event.workspace_id
projection.relationship_id   = event.relationship_id
projection.source_module    = event.source_module
projection.source_event_id  = event.source_event_id
projection.event_version    = event.event_version
projection.occurred_at      = event.occurred_at
projection.projection_version >= event.projection_version
```

A projection may temporarily lag an event during asynchronous processing, but it must never contradict the canonical event.

## 7. Rebuild contract

A rebuild must be deterministic and safe to repeat.

### Full rebuild

1. read canonical `crm_timeline_events` in deterministic `id ASC` order;
2. discard existing projection rows for the target scope;
3. re-resolve customer/business keys from current authoritative CRM relationships;
4. apply the current projection transformation to every retained event;
5. commit replacement rows atomically in bounded batches;
6. record the rebuild timestamp/version in operational logs.

### Scoped rebuild

The same algorithm may be restricted to:

- organization;
- workspace;
- relationship;
- customer.

Scoped rebuilds must never read or write outside the requested scope.

### Rebuild source

Rebuilds read **only** from canonical `crm_timeline_events` plus authoritative `customer_relationships`/Customer/Business scope data. The existing projection is never used as rebuild input.

### Missing source relationship

If an event references a relationship that no longer exists, the rebuild must not invent a relationship. The projection row is omitted and the event remains intact for retention/audit handling.

## 8. Failure and retry semantics

- Projection writes are idempotent.
- Duplicate delivery is a no-op.
- Out-of-order delivery is monotonic by `projection_version`.
- Transient failures are retried by the existing Outbox/Queue mechanism.
- Permanent schema/payload failures are observable and must not be silently converted into fabricated projection rows.
- Rebuild can repair any projection drift without modifying canonical event history.

## 9. Privacy and visibility

The projection inherits `visibility` and `redaction_class` from the canonical event.

Read queries must always apply:

- organization scope;
- workspace scope;
- authorization/resource policy;
- visibility/redaction rules.

Private CRM notes or sensitive source-domain fields must not become visible merely because they were present in an event payload.

The projection is disposable and must participate in CRM export/deletion/retention workflows. When source events are legally deleted or expired, derived projection rows must be deleted or rebuilt accordingly.

## 10. API contract

The existing history endpoints remain stable:

```text
GET /api/v1/customers/:customerId/history
GET /api/v1/customers/relationships/:relationshipId/history
```

They read from `crm_timeline_projections`, not directly from `crm_timeline_events`.

The response shape remains the timeline event view already exposed by the CRM service. Introducing the projection must not change ownership or expose additional private fields.

## 11. Definition of Done

The gate is closed only when all of the following are true:

- physical read-model schema is implemented;
- projection application is idempotent and version-aware;
- relationship/customer/business scope is enforced;
- rebuild and scoped rebuild are implemented;
- history reads use the projection;
- duplicate and out-of-order behavior is tested;
- rebuild determinism is tested;
- projection drift can be repaired without rewriting canonical events;
- privacy/visibility boundaries remain enforced;
- implementation ledger and physical-schema reconciliation are updated.
