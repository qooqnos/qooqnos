# Phoenix Cloudflare Infrastructure / Deployment / CI/CD Architecture

## 1. Purpose

This document defines the production execution model for Phoenix on Cloudflare while preserving the modular-monolith architecture, database-first design, security boundaries, and fast delivery model.

## 2. Deployment Principles

1. Keep the application modular, not distributed by default.
2. Cloudflare provides edge, runtime, storage, queues and deployment primitives; domain logic remains inside Phoenix modules.
3. Production deployments are immutable and traceable to a Git commit.
4. Environment configuration is separated from application code.
5. Database migrations are explicit, ordered and compatible with application rollout.
6. Secrets never live in Git.
7. CI validates before deployment.
8. Rollback must be operationally simple.
9. Infrastructure failure must degrade safely.
10. Production and preview data must remain isolated.

## 3. Target Runtime

```text
Internet
  -> Cloudflare DNS / Edge
  -> WAF / Rate Limits / Security Controls
  -> Phoenix Web Application
       -> D1
       -> R2
       -> Queues
       -> Vectorize
       -> AI Provider Adapters
       -> Communication Provider Adapters
       -> Billing Provider Adapter
```

The exact Cloudflare product mapping may evolve, but application code must depend on internal interfaces rather than vendor-specific calls throughout domain modules.

## 4. Environment Model

Use at least:

- `local`
- `preview`
- `staging`
- `production`

Each environment has isolated resources where practical:

- D1 database
- R2 buckets/prefixes
- queues
- Vectorize indexes
- provider credentials
- analytics sinks
- domain configuration

Production credentials must never be reused in preview or local development.

## 5. Configuration

Separate configuration into:

### Static configuration

Versioned with code:

- module manifests
- route configuration
- policy defaults
- feature definitions
- schema versions

### Environment configuration

Injected by deployment/runtime:

- database bindings
- bucket bindings
- queue bindings
- service endpoints
- environment identifiers

### Secrets

Managed through secure secret storage:

- API keys
- provider credentials
- webhook secrets
- signing/encryption secrets

Secrets are never exposed to browser bundles.

## 6. Cloudflare Edge Responsibilities

The edge layer should provide:

- TLS termination
- DNS/routing
- WAF/security controls
- coarse rate limiting
- request-size protection
- caching for explicitly public/cacheable content
- static asset delivery

Authorization remains an application responsibility.

Do not treat edge caching as an authorization boundary.

## 7. Application Runtime

Phoenix runs as a modular monolith.

The runtime initializes:

```text
Boot
 -> Config
 -> Module Manifests
 -> Validation
 -> Dependency Graph
 -> Migration Compatibility
 -> Registries
 -> Routes / Jobs / Events / AI Tools
 -> Health Checks
 -> Serve
```

A module must not require a separate deployable service merely because it is a module.

## 8. Storage Mapping

### D1

Authoritative relational state:

- identity metadata
- workspaces
- memberships
- businesses
- catalog
- bookings
- CRM
- communications metadata
- billing state
- reviews
- module registry
- policies/configuration

### R2

Binary objects:

- portfolio media
- generated documents
- private verification documents
- user/business uploads
- derivatives

R2 object access is mediated by Media authorization.

### Queues

Asynchronous work:

- indexing
- embeddings
- media processing
- notifications
- analytics ingestion
- AI extraction
- scheduled reminders
- long-running jobs

### Vectorize

Derived retrieval index only. It is never transactional Source of Truth.

## 9. Database Migration Strategy

Migrations are registered per module and executed through the Runtime migration registry.

Required properties:

- ordered
- idempotent where practical
- observable
- reversible where practical
- compatible with rolling/preview deployment assumptions

Prefer expand/contract migrations:

```text
Expand schema
 -> deploy compatible application
 -> backfill
 -> switch reads/writes
 -> contract old schema later
```

Never make an application deployment depend on an untracked manual database edit.

## 10. CI Pipeline

Recommended pipeline:

```text
Commit
 -> formatting/lint
 -> type checks
 -> unit tests
 -> module contract tests
 -> security checks
 -> migration validation
 -> build
 -> preview validation
 -> deploy staging
 -> smoke tests
 -> production approval gate
 -> production deploy
 -> health verification
```

The exact approval mechanism may be automated or human-controlled depending on environment risk.

## 11. Quality Gates

A deployment should fail if:

- type checks fail
- required tests fail
- migration compatibility fails
- security checks detect blocking issues
- module dependency graph is invalid
- required configuration is missing
- production build differs unexpectedly from the tested artifact

## 12. Preview Environments

Preview deployments should be safe for feature development.

Rules:

- isolated data
- synthetic or sanitized test data
- no production secrets
- no production customer communications
- no production billing operations
- no irreversible external side effects by default

External providers should use sandbox/test accounts where available.

## 13. Production Deployment

Production deployment should be:

1. tied to an immutable Git commit
2. built from the same validated source
3. accompanied by migration state
4. observable during rollout
5. followed by smoke/health checks

Deployment metadata should record:

- commit SHA
- build/version
- deployment timestamp
- environment
- migration version
- feature-flag state where relevant

## 14. Rollback

Application rollback should normally mean redeploying a known-good immutable version.

Database rollback is more sensitive.

Prefer forward-compatible migrations and expand/contract patterns rather than destructive rollback scripts.

Feature flags provide a faster mitigation path when a feature can be safely disabled.

## 15. Health Model

Expose separate health concepts:

### Liveness

Can the runtime execute?

### Readiness

Can the runtime serve normal traffic with required dependencies?

### Dependency health

Are D1, queues, R2, Vectorize and external providers healthy enough for affected capabilities?

A non-critical dependency outage should not make the entire marketplace appear unavailable.

## 16. Observability During Deployment

Track:

- request error rate
- p50/p95/p99 latency
- D1 errors/latency
- queue depth
- job failures
- provider errors
- search freshness
- booking failures
- authentication failures
- AI latency/cost anomalies

Compare deployment health against the previous stable version where possible.

## 17. Zero-Downtime Principles

Avoid deployments that require simultaneous incompatible application versions.

Use:

- backward-compatible event contracts
- versioned APIs/events
- expand/contract database migrations
- feature flags
- idempotent jobs

## 18. Queues and Background Jobs

Every important job should have:

- job type/version
- unique job ID
- tenant/workspace context when applicable
- causation/correlation ID
- idempotency key
- retry policy
- timeout
- dead-letter handling
- observability

A worker must have explicit system/job identity rather than impersonating a human actor.

## 19. Scheduled Jobs

Scheduled work includes:

- reminders
- retention/deletion processing
- analytics aggregation
- index maintenance
- verification follow-ups
- reconciliation
- cleanup

Jobs must be safe against duplicate execution.

## 20. External Provider Isolation

Provider adapters must live behind interfaces.

Examples:

```text
AIProvider
MessageProvider
PaymentProvider
SearchProvider
```

A provider outage should produce a typed failure/degradation state, not leak provider-specific assumptions throughout domain code.

## 21. Security Controls

Infrastructure must enforce:

- least-privilege bindings
- secret isolation
- environment isolation
- secure headers
- WAF/rate limits where appropriate
- private object access
- auditability
- dependency scanning
- protected deployment credentials

Production deployment credentials must not be available to ordinary runtime code.

## 22. Data Backup / Recovery

Define recovery objectives for critical D1 data and configuration.

Recovery planning should cover:

- database loss/corruption
- accidental destructive migration
- R2 object loss
- queue/event replay
- Vectorize rebuild
- provider credential compromise

Derived indexes should be rebuildable from authoritative data.

## 23. Disaster Recovery Principle

Phoenix should be designed so that:

```text
D1 + durable media + versioned configuration
        ↓
rebuild derived indexes / projections
```

Search indexes, analytics aggregates and caches must not become irreplaceable system state.

## 24. Performance Targets

Initial targets:

- edge/static assets: CDN-optimized
- warm metadata reads: typically <100ms where practical
- core API reads: p95 <300–500ms depending on workflow
- availability checks: p95 <300ms
- booking finalization: p95 <500ms excluding external notifications
- customer shell: p95 <1.5s where practical

Targets are SLO inputs, not guarantees.

## 25. Cost Controls

Monitor:

- Worker execution
- D1 reads/writes
- R2 operations/storage
- queue operations
- Vectorize usage
- AI tokens/cost
- communication provider usage
- analytics volume

Use quotas, batching, caching and asynchronous processing where appropriate.

## 26. Local Development

Local development should provide deterministic substitutes/mocks for external dependencies where practical.

Developers should be able to run:

- application
- migrations
- tests
- workers/jobs
- seed data
- module validation

without access to production secrets or customer data.

## 27. Release Strategy

Use progressive risk reduction:

```text
Local
 -> Preview
 -> Staging
 -> Production
 -> Observe
 -> Expand feature flag
```

For high-risk modules, release behind a feature flag and enable gradually.

## 28. Incident Mitigation

Operators should be able to:

- disable a feature/module capability
- pause selected jobs
- disable a provider adapter
- revoke compromised credentials
- suspend affected tenant/business where justified
- inspect health and audit signals

Emergency controls must themselves be audited.

## 29. CI/CD Security

Protect the deployment pipeline against:

- secret leakage
- dependency compromise
- unauthorized workflow changes
- artifact substitution
- unreviewed production deployment
- malicious build scripts

Pin or constrain critical dependencies and use lockfiles.

## 30. Definition of Done

Infrastructure/deployment architecture is complete when:

- environments are isolated
- Cloudflare bindings are defined by environment
- secrets are outside Git
- CI has deterministic quality gates
- migrations are runtime-registered and compatible
- production deployments are commit-traceable
- rollback/forward recovery is documented
- health and observability are available
- queues/jobs are idempotent and replayable
- external providers are adapter-isolated
- derived stores can be rebuilt
- security and cost controls are observable
