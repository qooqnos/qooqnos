# Phoenix Analytics / Observability / Data Platform Architecture

## 1. Purpose

Phoenix needs operational visibility and product intelligence without creating a second source of truth.

This architecture separates:

- **Operational observability** — is the system healthy?
- **Product analytics** — how is the marketplace being used?
- **Business analytics** — how are businesses, bookings and plans performing?
- **AI analytics** — are matching, tools and models useful, safe and cost-efficient?
- **Data platform** — how are events transformed into durable analytical datasets?

D1/domain modules remain authoritative for transactional state. Analytical systems are derived and must never be used to silently mutate domain truth.

## 2. Core Invariants

1. Domain databases remain Source of Truth.
2. Analytics consumes events/projections; it does not become a shadow transactional database.
3. Operational telemetry and product analytics have different retention and access policies.
4. Every analytical event is tenant-aware.
5. Sensitive data is minimized, classified, and excluded unless explicitly justified.
6. Customer tracking must respect consent and privacy policy.
7. AI evaluation data must preserve model/prompt/policy versions.
8. Metrics definitions are versioned and centrally documented.
9. Dashboards cannot grant access to data the actor could not otherwise access.
10. Observability must remain useful during partial outages.

## 3. Three Data Planes

### Plane A — Operational Observability

Signals:

- logs
- metrics
- traces
- errors
- queue/job health
- provider health
- security events

Purpose: reliability, debugging, incident response.

### Plane B — Product / Marketplace Analytics

Signals:

- search queries
- impressions
- clicks
- saves
- contact intents
- bookings
- cancellations
- reviews
- conversion funnels

Purpose: product decisions, marketplace quality, partner analytics.

### Plane C — AI Evaluation / Cost

Signals:

- intent extraction outcomes
- retrieval candidates
- ranking versions
- tool calls
- latency
- token/cost usage
- abstentions
- safety decisions
- human feedback
- evaluation results

Purpose: improve quality while controlling cost and safety.

## 4. Event-First Architecture

```text
Domain transaction
    -> Outbox
    -> Queue / Event transport
    -> normalized analytics event
    -> ingestion
    -> analytical storage
    -> metric/model layer
    -> dashboards / reports / evaluation
```

Events should be emitted after the authoritative transaction has reached its intended state, using the established outbox pattern.

Analytics consumers must be idempotent.

## 5. Event Envelope

A normalized event should include:

```text
event_id
event_name
event_version
occurred_at
received_at
actor_id (nullable/minimized)
tenant_id (nullable for public/system events)
workspace_id (nullable)
request_id
session_id (privacy-policy dependent)
source_module
resource_type
resource_id (when safe)
locale
country_context
metadata
```

Avoid placing raw sensitive content inside generic analytics metadata.

## 6. Event Classification

Events should be classified at creation:

- operational
- product
- business
- security
- billing
- AI evaluation
- sensitive/regulated

Sensitive or regulated events use dedicated restricted datasets and stricter retention/access.

## 7. Product Analytics

Core marketplace funnel:

```text
landing/home
 -> search/query
 -> interpreted intent
 -> results
 -> result impression
 -> result click
 -> profile/offer view
 -> contact or booking
 -> completed interaction
 -> review/return
```

Useful metrics:

- search success rate
- zero-result rate
- result CTR
- qualified-result rate
- contact conversion
- booking conversion
- booking completion
- cancellation/no-show rate
- repeat usage
- time-to-useful-result

Analytics must distinguish user intent from UI mechanics.

## 8. Search Analytics

Capture enough information to evaluate retrieval without storing unnecessary user content.

Recommended signals:

- normalized query intent
- applied hard filters
- candidate count
- ranking version
- result position
- impression/click
- selected result
- conversion outcome
- zero-result reason

Raw free-text queries may contain sensitive data; retention and access must be explicitly controlled.

## 9. AI Observability

Every production AI operation should be traceable to:

- AI operation ID
- model/provider version
- prompt version
- policy version
- tool version
- retrieval/index version where applicable
- latency
- token/usage estimate
- cost attribution
- outcome category

Do not log full prompts/responses by default when they may contain private or sensitive information.

Use redaction, sampling, or hashed references where appropriate.

## 10. AI Quality Metrics

Track:

- intent extraction accuracy
- retrieval recall@k
- ranking nDCG
- recommendation acceptance
- tool success/failure
- invalid tool-call rate
- policy rejection rate
- abstention rate
- hallucination/error reports
- user correction rate
- latency
- cost per successful task

Human-reviewed evaluation datasets must be separated from arbitrary production user data and follow explicit retention/access controls.

## 11. Business Analytics

Partner dashboards may expose derived metrics such as:

- profile views
- offer views
- search appearances
- contacts
- booking requests
- completed bookings
- cancellations
- review trends
- response rate
- customer-return rate
- plan/usage metrics

A partner must never receive another partner's analytics.

Analytics access follows the same workspace/resource authorization model as operational APIs.

## 12. Admin / Platform Analytics

Privileged dashboards can include:

- active tenants
- onboarding funnel
- verification backlog
- marketplace supply/demand
- search quality
- booking health
- communication delivery
- billing plan adoption
- AI cost and reliability
- queue depth
- system errors
- security anomalies

Aggregate reporting should be preferred over exposing individual customer records.

## 13. Operational Metrics

Every module should expose a consistent baseline:

- request count
- error count/rate
- latency histogram
- dependency latency
- queue depth
- job success/failure
- retry count
- cache hit rate where relevant
- authorization denials
- domain invariant failures

Important flows have explicit SLOs from their architecture documents.

## 14. Distributed Tracing

Even in a modular monolith, tracing should connect:

```text
HTTP request
 -> application service
 -> domain module
 -> database
 -> queue
 -> worker
 -> external provider
```

Use correlation/request IDs consistently across synchronous and asynchronous work.

Background jobs preserve causality without impersonating a human actor.

## 15. Structured Logging

Logs should be structured and searchable.

Recommended fields:

```text
timestamp
level
service/module
request_id
trace_id
job_id
actor_id (when permitted)
tenant_id/workspace_id (when permitted)
event/action
outcome
latency_ms
error_code
```

Never log:

- passwords
- access tokens
- signed URLs
- payment-card data
- private verification documents
- raw medical content
- full sensitive AI prompts/responses

## 16. Analytics Storage

The analytical store may evolve independently from D1.

Initial architecture can use an event/analytics store appropriate to workload, while preserving an adapter boundary so the application is not coupled to one vendor.

The analytical schema should contain:

- immutable event facts
- derived dimensions
- daily/hourly aggregates
- metric definitions
- data-quality status

Do not copy every transactional table blindly.

## 17. Metric Definitions

Each important metric should define:

- name
- owner
- formula
- source events
- filters
- timezone/calendar semantics
- attribution window
- version
- privacy classification

Example:

```text
booking_conversion_v1 = completed_bookings / qualified_booking_intents
```

Changing the definition requires a new metric version or explicit migration.

## 18. Time / Locale

Analytics stores canonical timestamps in UTC.

Presentation may use workspace/customer timezone.

For Persian-facing reporting:

- Jalali is a presentation/calendar adapter
- Gregorian/UTC remain canonical for event ordering
- date boundaries must use the requested reporting timezone before calendar conversion

This prevents month/day aggregation errors around timezone and DST boundaries.

## 19. Privacy and Consent

Analytics collection must respect:

- consent state where required
- purpose limitation
- data minimization
- retention limits
- deletion/export obligations
- sensitive-data restrictions

Do not infer sensitive customer attributes merely because analytics can correlate events.

Medical-related analytics should prefer aggregate operational/product metrics over individual clinical content.

## 20. Data Quality

Monitor:

- event delivery lag
- missing event rate
- duplicate rate
- schema validation failures
- out-of-order events
- orphan resource references
- metric freshness
- unexpected cardinality
- tenant leakage

Invalid events go to a quarantine/dead-letter flow rather than silently corrupting aggregates.

## 21. Retention

Retention must differ by data class.

Example policy categories:

- high-volume telemetry: short retention
- product events: medium retention
- aggregated metrics: longer retention
- security audit: policy/legal controlled
- sensitive/regulated analytics: minimum necessary retention

Exact periods are policy decisions and should be configurable rather than hard-coded throughout modules.

## 22. Access Control

Analytics access is role- and scope-aware.

```text
actor
 -> workspace scope
 -> analytics permission
 -> dataset classification
 -> row/resource policy
 -> aggregate/detail level
```

A platform-wide dashboard may require elevated permission and should minimize customer-level detail.

## 23. Alerts

Alerts should be based on actionable conditions rather than raw noise.

Examples:

- availability latency SLO breach
- booking error spike
- notification provider failure
- queue backlog growth
- search zero-result anomaly
- indexing freshness breach
- AI cost spike
- authentication failure anomaly
- data pipeline lag

Alert routing belongs to the operational notification system, not product analytics logic.

## 24. Failure / Degradation

Analytics outages must not stop core marketplace transactions.

If the analytics pipeline is unavailable:

- domain transactions continue
- outbox events accumulate durably
- consumers catch up later
- dashboards show data freshness status

Observability itself must be designed to fail safely and avoid overwhelming the system during incidents.

## 25. APIs / Read Models

Customer-facing APIs should not expose raw analytics datasets.

Partner/admin read models may provide scoped aggregates:

```text
GET /api/v1/partner/analytics/overview
GET /api/v1/partner/analytics/funnel
GET /api/v1/admin/analytics/marketplace
GET /api/v1/admin/analytics/operations
```

Internal interfaces:

```text
analytics.event.ingest
analytics.aggregate.rebuild
analytics.metric.evaluate
analytics.dataset.validate
```

## 26. Testing

Required tests:

- tenant isolation
- consent enforcement
- sensitive-data redaction
- event idempotency
- out-of-order event handling
- schema version compatibility
- metric calculation correctness
- timezone/Jalali reporting boundaries
- analytics outage resilience
- dashboard authorization
- AI trace version integrity
- retention/deletion behavior
- dead-letter replay

## 27. Implementation Order

1. Canonical event envelope
2. Outbox analytics consumer
3. Structured operational logs
4. Metrics and tracing baseline
5. Core marketplace event taxonomy
6. Partner/admin analytics read models
7. Data-quality monitoring
8. AI cost/quality telemetry
9. Metric registry/versioning
10. Analytical storage adapter
11. Advanced funnels and experimentation
12. Data-governance automation

## 28. Definition of Done

The analytics platform is production-ready when:

- domain truth remains authoritative
- events are versioned and idempotent
- tenant isolation is enforced
- operational and product analytics are separated
- sensitive content is minimized/redacted
- core SLOs are observable
- AI operations are traceable by model/prompt/policy/tool/index versions
- partner/admin analytics are scope-safe
- analytics outage cannot block core transactions
- data freshness and quality are visible
- retention and deletion policies are enforceable
