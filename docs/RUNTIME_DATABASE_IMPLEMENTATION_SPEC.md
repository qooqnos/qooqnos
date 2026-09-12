# Phoenix Runtime + D1 Implementation Specification

## Purpose

This document turns the Foundation blueprint into the first concrete implementation contract for the Phoenix runtime and database layer.

The target is a small, deterministic, secure runtime that can boot the modular monolith, establish request context, validate module manifests, connect to D1, run registered migrations, and provide reliable primitives for audit, idempotency, and outbox processing.

## 1. Runtime Responsibilities

`packages/runtime` owns orchestration, not business rules.

It is responsible for:

- application configuration loading and validation
- request/correlation context
- module manifest discovery and validation
- dependency DAG resolution
- lifecycle state
- route/command/event/job/tool registration
- database initialization
- migration coordination
- health/readiness checks
- controlled shutdown/failure reporting

Business modules remain owners of their domain invariants.

## 2. Request Context

Every request and asynchronous execution must establish a typed context containing, when available:

```text
request_id
correlation_id
causation_id
actor_id
tenant_id
workspace_id
module
operation
locale
timezone
```

Rules:

- IDs are generated at the edge when absent.
- Context is immutable after creation except for explicitly scoped child context.
- Child jobs/events preserve correlation and causation relationships.
- Context must never contain secrets or unnecessary sensitive payloads.

## 3. Runtime Boot Order

The boot sequence is fixed:

```text
config
  ↓
request/runtime primitives
  ↓
manifest discovery
  ↓
manifest validation
  ↓
dependency DAG
  ↓
D1 initialization
  ↓
migration compatibility check
  ↓
migration execution
  ↓
route/command/event/job registration
  ↓
tenant capability loading
  ↓
health/readiness
```

A failed mandatory stage stops readiness. Partial module activation is forbidden.

## 4. Module Manifest Contract

Each module exposes a typed manifest containing at minimum:

- module identifier
- semantic version
- runtime compatibility range
- declared dependencies
- owned capabilities
- routes
- commands
- events
- jobs
- permissions
- migration identifiers
- feature-flag requirements

Manifest validation must reject duplicate identifiers, undeclared dependencies, invalid versions, conflicting registrations, and dependency cycles.

## 5. D1 Ownership Model

D1 is the relational source of truth.

The database layer must expose repositories and query primitives without allowing modules to bypass ownership boundaries.

A module may read/write:

1. its own private tables;
2. explicitly approved shared foundation tables;
3. another module only through its application contracts or read projections.

Direct cross-module private-table queries are an architecture violation.

## 6. Foundation Tables

The first migration set establishes the runtime foundation.

### Identity/workspace

- `users`
- `external_identities`
- `workspaces`
- `workspace_memberships`

### Authorization

- `roles`
- `permissions`
- role/permission assignments
- membership/role assignments

### Runtime

- `modules`
- `module_versions`
- `tenant_module_state`
- `feature_flags`

### Reliability/governance

- `audit_events`
- `idempotency_records`
- `outbox_events`
- `schema_migrations`

Exact table columns belong to the database implementation, but every tenant-owned record must have an explicit ownership strategy.

## 7. Database Conventions

Required conventions:

- stable opaque IDs
- UTC timestamps
- explicit status values
- integer minor units for monetary values
- foreign keys where appropriate
- unique constraints for invariants
- indexes derived from real access patterns
- optimistic version columns for concurrency-sensitive aggregates
- no implicit authorization from database visibility
- no secrets stored in plaintext

Avoid JSON blobs when fields participate in filtering, uniqueness, authorization, joins, or lifecycle rules.

## 8. Migration Runner

Migrations are append-only history.

Each migration has:

```text
id
version
checksum
module
up
compatibility metadata
```

Runner rules:

- execute in deterministic order
- record successful application
- verify checksum for already-applied migrations
- refuse silent mutation of applied migration history
- fail readiness on incompatible migration state
- make retry behavior explicit

Risky schema changes use expand/contract:

```text
expand
→ compatible deployment
→ backfill
→ verification
→ traffic switch
→ contract
```

## 9. Outbox

Domain facts that must leave the database transaction boundary are recorded in `outbox_events`.

An outbox record contains at minimum:

- event ID
- event type
- event version
- aggregate/reference ID
- tenant/workspace scope where applicable
- payload
- occurred timestamp
- publication state
- attempt metadata

The event is written with the source state change. Delivery is asynchronous.

Consumers must be idempotent.

## 10. Idempotency

Side-effecting API commands and externally triggered operations use idempotency where the contract requires it.

An idempotency record must bind at least:

```text
scope
key
actor/tenant context
request fingerprint
status
result reference
created/expires timestamps
```

A reused key with a different request fingerprint must fail safely rather than execute a second operation.

Concurrent identical requests must converge on one logical operation.

## 11. Audit

Audit is a security/governance record, not an application log.

Audit entries should capture:

- event/action type
- actor
- tenant/workspace
- target resource
- outcome
- timestamp
- request/correlation IDs
- policy-relevant metadata

Do not store secrets, authentication credentials, raw tokens, or unnecessary sensitive payloads.

High-risk actions must be auditable, including authorization changes, verification decisions, publication decisions, sensitive-data access, and privileged administrative operations.

## 12. Transactions and Concurrency

Where D1 transaction capabilities are used, state changes that must be atomic belong in one transaction boundary.

Examples:

- idempotency reservation + command execution state
- aggregate mutation + outbox insertion
- authorization-sensitive state transition + audit record

Do not assume distributed transactions across D1, external providers, R2, Queues, or AI providers.

Use durable state plus retry/reconciliation patterns instead.

## 13. Health Model

Expose separate concepts:

- liveness: process/runtime can respond
- readiness: mandatory dependencies and migrations are usable
- module health: individual module registration/operation state
- dependency health: provider/binding availability

A noncritical optional provider should not automatically make the entire runtime unavailable.

## 14. Error Rules

Runtime/database errors are mapped to stable application error codes.

Never expose:

- SQL statements
- stack traces
- binding credentials
- internal filesystem/configuration details

Errors must preserve request IDs for support and observability.

## 15. Observability

Every important runtime operation emits structured telemetry with:

```text
request_id
correlation_id
causation_id
module
operation
status
latency
actor_id (when permitted)
tenant_id (when permitted)
```

Logs are not the source of truth for business state.

## 16. Testing Requirements

Before the runtime is considered usable:

### Unit

- context creation
- manifest validation
- DAG resolution
- migration ordering
- idempotency state machine

### Integration

- D1 repositories
- migration runner
- outbox persistence
- audit persistence
- concurrent idempotency requests

### Architecture

Release-blocking tests must prove:

- tenant isolation
- no duplicate module registration
- no dependency cycles
- applied migration checksum integrity
- no second execution for an idempotent command
- aggregate mutation and outbox creation remain consistent

## 17. Cloudflare Boundary

Cloudflare-specific APIs remain behind adapters where practical.

The core runtime should not depend directly on provider-specific implementation details beyond explicit infrastructure ports/bindings required at the application boundary.

Initial bindings:

```text
D1
R2
Queues
Vectorize
```

Only bindings actually needed by the current vertical slice should be initialized eagerly.

## 18. First Implementation Slice

Implement in this order:

1. `packages/core` primitives
2. `packages/runtime` context + lifecycle
3. module manifest types/validation
4. D1 adapter/repository base
5. migration registry/runner
6. audit repository
7. idempotency repository/service
8. outbox repository/publisher boundary
9. health/readiness
10. runtime integration tests

Do not implement business modules in this slice.

## 19. Definition of Done

This slice is complete when:

- the Worker/API boots deterministically
- runtime manifests validate
- D1 is reachable through the database boundary
- migrations are recorded and checksum-verified
- request context is available to handlers
- audit records can be created safely
- idempotency prevents duplicate side effects
- outbox records can be persisted with domain state
- health/readiness accurately reports state
- tenant-isolation and architecture tests pass
- no business domain has leaked into runtime infrastructure
