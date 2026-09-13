---
name: runtime-database-implementation
description: Rules for Phoenix runtime and D1 implementation, request context, migrations, outbox, idempotency, audit, Cloudflare boundaries, and testing.
---

# Phoenix Runtime + D1 Implementation Skill

## Purpose

Implement and modify Phoenix runtime/database infrastructure without violating module boundaries, security invariants, or Cloudflare-first architecture.

## Mandatory Stack

- TypeScript for runtime/application infrastructure.
- SQL for D1 migrations and relational queries.
- JSON/JSON Schema for contracts/configuration where applicable.
- Cloudflare bindings through explicit infrastructure boundaries.

Do not introduce another runtime language or persistence system without an explicit architecture decision.

## Before Coding

1. Read `docs/RUNTIME_DATABASE_IMPLEMENTATION_SPEC.md`.
2. Read the relevant architecture documents in `docs/`.
3. Identify the owning package/module.
4. Identify source of truth and tenant/workspace scope.
5. Identify command/event/idempotency/audit requirements.
6. Check existing repository structure before creating new abstractions.

## Runtime Rules

The boot order is:

```text
config → context → manifests → validation → DAG → D1 → migrations → registration → readiness
```

Never:

- silently activate a partially invalid module;
- bypass manifest validation;
- create hidden global state that circumvents request context;
- put business invariants in runtime infrastructure.

## Request Context

Every request/job/event execution must carry typed context where available:

`request_id`, `correlation_id`, `causation_id`, `actor_id`, `tenant_id`, `workspace_id`, `module`, `operation`, `locale`, `timezone`.

Do not put secrets or unnecessary sensitive payloads in context.

## D1 Rules

- D1 is the relational source of truth.
- Use stable IDs and UTC timestamps.
- Use explicit status fields.
- Use integer minor units for money.
- Add constraints/indexes based on domain invariants and access patterns.
- Keep module-private persistence private.
- Cross-module access occurs through contracts or projections, never private-table coupling.

## Migration Rules

Migrations are append-only.

Never rewrite an applied migration to fix behavior. Create a new migration.

Applied migration checksums must be verified. Incompatible history must block readiness.

For risky changes use expand/contract:

```text
expand → compatible code → backfill → verify → switch → contract
```

## Outbox Rules

When a state change produces an external/domain event, persist the outbox record with the source mutation in the same atomic boundary where supported.

Events must have stable type/version identifiers.

Consumers must tolerate retries and duplicate delivery.

Do not treat Queue delivery as the source of truth.

## Idempotency Rules

For side-effecting commands:

1. derive the correct scope;
2. reserve/check the idempotency key;
3. compare request fingerprint;
4. execute only once logically;
5. persist/replay the result safely.

A reused key with a different fingerprint is a conflict, not a second execution.

## Audit Rules

Audit privileged and security-relevant actions.

Never record credentials, raw tokens, secrets, or unnecessary sensitive payloads.

Audit is separate from operational logs.

## Cloudflare Rules

Keep provider-specific behavior behind infrastructure adapters when practical.

Do not assume cross-service transactions between D1, R2, Queues, Vectorize, or external providers.

Use durable state, outbox, retries, and reconciliation instead.

## Error Rules

Return stable application error codes.

Never expose SQL, stack traces, credentials, or internal infrastructure details to clients.

Preserve request/correlation IDs for diagnostics.

## Testing Gate

Every change must add or update the smallest appropriate tests.

Required coverage includes:

- unit tests for context/manifest/DAG/state machines;
- D1 integration tests for persistence;
- migration tests;
- concurrent idempotency tests;
- outbox consistency tests;
- audit tests;
- tenant-isolation tests;
- architecture-boundary tests.

Critical failures are release blockers.

## Completion Checklist

Before declaring the task complete, verify:

- [ ] correct package/module ownership
- [ ] TypeScript/SQL standards followed
- [ ] tenant scope explicit
- [ ] request context preserved
- [ ] authorization boundary preserved
- [ ] migration is append-only
- [ ] idempotency handled where required
- [ ] outbox handled where required
- [ ] audit handled where required
- [ ] errors are safe
- [ ] tests added/passed
- [ ] no direct cross-module private-table access
- [ ] no provider-specific leakage into domain code
