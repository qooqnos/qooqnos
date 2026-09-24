# Analytics Implementation Contract

**Status:** Implemented  
**Migration:** `0075_analytics_platform.sql`  
**Owner:** Analytics projection boundary  
**Source of truth:** Domain modules + transactional Outbox

## 1. Canonical flow

```
Domain transaction
  ↓
Outbox
  ↓
AnalyticsRepository.ingestOutboxEvent
  ↓
analytics_events
  ↓
analytics_facts
  ↓
rebuildable metric aggregates
```

Analytics never writes operational domain state.

## 2. Event ingestion

Every Outbox event is a candidate analytics event. Ingestion is:

- asynchronous;
- tenant/workspace scoped when the source event is scoped;
- idempotent by the canonical Outbox event id;
- protected against identity collisions by event-name + payload hash;
- independent of the originating domain transaction;
- safe to retry.

Raw Outbox payloads are **not** copied into the analytics event store. The stored event contains the normalized envelope, aggregate/resource references and a SHA-256 payload hash.

## 3. Facts

Each accepted event creates one immutable `analytics_facts` row with the canonical fact name:

`event.<event_type>`

The fact is evidence for measurement, not operational truth.

Facts are rebuildable from `analytics_events`/Outbox history and must not be used to reconstruct mutable domain state.

## 4. Aggregates

`analytics_metric_aggregates` is a rebuildable projection.

The current implementation provides:

- UTC daily event-count aggregation;
- tenant/workspace grouping;
- deterministic upsert;
- projection versioning;
- scheduled rebuild.

Rebuild replaces the aggregate value for the selected bucket instead of incrementing it, so retries cannot double-count events.

## 5. Metric definitions

`analytics_metric_definitions` is the versioned registry for:

- metric key/version;
- owner;
- formula;
- source events;
- filters;
- timezone policy;
- attribution window;
- privacy classification;
- lifecycle status.

Changing metric semantics requires a new metric version.

## 6. Failure semantics

If analytics ingestion fails:

```
Domain transaction → remains committed
Outbox             → remains durable
Analytics consumer → retries
Analytics           → catches up
```

Analytics failure must never roll back or block the authoritative domain transaction itself.

Invalid events must be quarantined rather than silently corrupting analytical state.

## 7. Privacy

Analytics stores only the minimum normalized event envelope required for measurement.

Never copy:

- credentials;
- payment-card data;
- private verification documents;
- raw medical content;
- full AI prompts/responses;
- arbitrary raw event payloads.

Privacy classification is stored explicitly. Sensitive datasets require stricter retention/access policies.

## 8. Scope and authorization

Analytics records retain organization/workspace scope from the source event. Reads must apply the same scope boundary.

Partner analytics may only expose the requesting workspace's derived metrics. Platform analytics requires explicit elevated authorization.

Analytics data never grants authorization over operational resources.

## 9. Replay / rebuild

Replay operates from durable source events and is idempotent.

Aggregate rebuilds are replacement-based, not additive. This permits:

- replay after consumer failure;
- backfill;
- metric-version migration;
- correction of corrupted projections;
- deterministic recovery after analytical-store loss.

## 10. Definition of Done

The Analytics contract is closed when:

- [x] Outbox → analytics ingestion exists;
- [x] event identity/idempotency exists;
- [x] immutable event/fact storage exists;
- [x] tenant/workspace scope exists;
- [x] versioned metric definitions exist;
- [x] rebuildable aggregates exist;
- [x] scheduled rebuild exists;
- [x] analytics cannot become domain source of truth;
- [x] raw payload minimization exists;
- [x] retry does not double-count events;
- [x] migration/catalog/lock are registered.

Provider-specific analytical warehouse integration remains an infrastructure optimization, not a missing domain contract.
