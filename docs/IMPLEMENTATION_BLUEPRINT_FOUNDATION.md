# Phoenix Implementation Blueprint — Foundation

## 1. Purpose

Architecture is now complete. This document converts the architecture into an implementation order that can produce a working Phoenix vertical slice without prematurely implementing every module.

The first implementation target is a secure, database-first marketplace foundation followed by a complete Beauty journey.

## 2. Implementation Strategy

Build vertically, not horizontally:

```text
Foundation
  ↓
Identity + Workspace
  ↓
Business Onboarding + Verification
  ↓
Catalog
  ↓
Search / Discovery
  ↓
Customer Experience
  ↓
Booking
  ↓
Communications
  ↓
Reviews / CRM / Billing / Analytics
```

Each vertical slice must pass architecture invariants before moving forward.

## 3. Recommended Repository Shape

```text
apps/
  web/
  api/

packages/
  core/
  runtime/
  database/
  authz/
  api-contracts/
  ui/
  design-tokens/
  i18n/
  api-client/
  frontend-auth/
  frontend-analytics/
  ai/

  modules/
    identity/
    business/
    catalog/
    discovery/
    booking/
    communications/
    customer-experience/
    crm/
    reviews/
    billing/
    media/
    analytics/

  adapters/
    cloudflare/
    providers/

migrations/
workers/
tests/
docs/
.claude/skills/
```

The exact framework/runtime package names may be selected during implementation, but dependency direction must remain consistent with the architecture.

## 4. Dependency Direction

Allowed direction:

```text
apps
  ↓
BFF / API
  ↓
Runtime
  ↓
Module application/domain layers
  ↓
Infrastructure ports
  ↓
Cloudflare/provider adapters
```

Shared packages must remain infrastructure-light. Domain modules must not import frontend code.

## 5. Module Internal Structure

Each module should follow a consistent shape:

```text
module/
  manifest.ts
  domain/
  application/
  contracts/
  repositories/
  policies/
  events/
  commands/
  jobs/
  migrations/
  tests/
```

Rules:

- `domain` contains invariants.
- `application` orchestrates use cases.
- `contracts` contains public DTOs/schemas.
- `repositories` own persistence access.
- `policies` contain authorization/resource decisions specific to the module.
- `events` define versioned facts.
- `commands` define intentional operations.
- `jobs` handle asynchronous work.
- modules cannot query another module's private tables directly.

## 6. Foundation Packages

### `packages/core`

Contains request context, IDs, result/error primitives, time abstractions, money primitives, pagination and shared domain utilities.

### `packages/runtime`

Contains module registry, manifest validation, dependency resolution, lifecycle, route/event/job/tool/UI registration and health checks.

### `packages/database`

Contains D1 connection/access infrastructure, migration runner, transaction helpers where supported, repository primitives and query instrumentation.

### `packages/authz`

Contains permission registry, policy evaluation interfaces and authorization context. Identity remains responsible for authentication and membership data.

### `packages/api-contracts`

Contains versioned request/response/error schemas and generated or derivable client types.

## 7. Database Foundation

D1 is the authoritative relational store.

Initial database foundation should establish:

- users / external identities
- workspaces / memberships
- roles / permissions
- modules / module versions / tenant module state
- audit events
- idempotency records
- outbox events
- feature flags
- migration metadata

Every tenant-owned table must have an explicit tenant/workspace ownership strategy.

## 8. Required Database Conventions

Use:

- stable IDs
- UTC timestamps
- explicit status fields
- optimistic version columns where concurrency matters
- integer minor units for money
- explicit foreign keys where appropriate
- unique constraints for domain invariants
- indexes based on access patterns
- soft deletion only when domain semantics require it

Do not use database structure as the public API contract.

## 9. Migration Strategy

Migrations are append-only history and are registered with Runtime.

Use expand/contract for risky changes:

```text
expand
 → deploy compatible code
 → backfill
 → verify
 → switch reads/writes
 → contract
```

A migration must be observable and safe to retry where practical.

## 10. First Runtime Boot

Implementation order:

1. Load environment/config.
2. Initialize request/runtime context.
3. Discover manifests.
4. Validate manifests.
5. Resolve dependency DAG.
6. Initialize database.
7. Run compatible migrations.
8. Register routes, commands, events, jobs and policies.
9. Register enabled tenant capabilities.
10. Expose health/readiness.

A module that fails validation must not silently become partially active.

## 11. First End-to-End Slice

The first production-shaped slice should be:

```text
Business signup
 → workspace creation
 → business profile
 → service creation
 → verification submission
 → admin verification decision
 → publication
 → discovery indexing
 → customer search
 → business/service result
```

This validates the architecture before booking complexity is introduced.

## 12. Beauty MVP Slice

After the foundation:

```text
Business
 → services + prices
 → portfolio/media
 → location
 → availability
 → verification/publication

Customer
 → natural-language discovery
 → filtered/ranked results
 → profile/offer
 → contact or booking
 → notification
 → feedback
```

Beauty is the first fully implemented marketplace vertical.

## 13. AI Implementation Boundary

The first AI implementation should support:

- natural-language query understanding
- structured constraint extraction
- multilingual query normalization
- candidate retrieval
- ranking assistance
- concise explanations

It must not initially become a general autonomous agent.

AI execution path:

```text
User input
 → AI Gateway
 → structured intent
 → deterministic validation
 → Discovery
 → policy
 → result
```

## 14. Search Implementation Order

1. Canonical relational query.
2. Deterministic hard filters.
3. Lexical search.
4. Persian normalization.
5. Index projection.
6. Vector embeddings.
7. Hybrid retrieval.
8. Ranking/reranking.
9. Feedback/evaluation.

Vector search must not be introduced before source-of-truth filtering is correct.

## 15. Frontend Implementation Order

Build shared shell first:

1. design tokens
2. typography
3. RTL/LTR foundation
4. theme system
5. accessibility primitives
6. API client
7. auth/workspace context
8. error/loading/empty states
9. customer routes
10. partner routes
11. admin routes

Then compose module screens from shared primitives.

## 16. Security Gates

Every implementation stage must pass:

- authentication
- authorization
- tenant isolation
- input/schema validation
- rate limits where applicable
- safe errors
- audit requirements
- sensitive-data rules
- AI policy rules

Security is not a final hardening phase.

## 17. Testing Gates

For each module:

```text
Unit
 → Domain/module
 → Contract
 → Integration
 → E2E
```

Critical architecture invariants are release-blocking:

- cross-tenant access
- unauthorized actions
- unverified discovery
- booking oversell
- stale availability
- private media leakage
- AI unauthorized tool use
- medical policy violations

## 18. Local Development

Local development should provide deterministic infrastructure substitutes or test adapters for:

- D1
- R2
- Queues
- Vectorize
- external providers

Provider adapters must support fake/sandbox implementations so tests do not depend on live external systems.

## 19. Environment Promotion

```text
local
 ↓
preview
 ↓
staging
 ↓
production
```

Production data and credentials never flow backward into lower environments.

Preview environments must not send real customer communications or perform real financial side effects.

## 20. Initial API Surface

Foundation endpoints should be intentionally small:

```text
GET  /api/v1/me
GET  /api/v1/workspaces
POST /api/v1/workspaces
GET  /api/v1/workspaces/:id/members
POST /api/v1/workspaces/:id/invitations
GET  /api/v1/business/profile
POST /api/v1/business/verification/submissions
GET  /api/v1/catalog/offers
POST /api/v1/catalog/offers
POST /api/v1/discovery/search
```

Exact endpoints are subordinate to module contracts and should not be created merely to expose CRUD tables.

## 21. Observability Foundation

Every request/job/event should be traceable through:

```text
request_id
correlation_id
causation_id
actor_id
tenant_id
workspace_id
module
operation
```

Sensitive payloads are excluded or redacted.

## 22. Feature Flags

Use flags for controlled rollout, not as hidden business rules.

Each flag has:

- owner
- scope
- default
- rollout strategy
- expiry/review date
- audit history

## 23. Definition of Ready for Coding

A feature is ready when:

- owning module is identified
- source of truth is identified
- public contract is defined
- permissions are defined
- tenant scope is defined
- events/commands are defined
- persistence model is defined
- failure states are defined
- observability is defined
- tests are identified
- AI involvement, if any, is explicitly bounded

## 24. Definition of Done for Foundation

Foundation is complete when:

- Runtime boots and validates modules
- D1 migrations execute safely
- Identity/workspace authorization works
- API contracts are typed
- audit/outbox/idempotency infrastructure works
- tenant isolation tests pass
- frontend shell works in RTL/LTR and light/dark themes
- CI blocks critical architecture violations
- a business can be onboarded and verified
- a published Beauty offer can be discovered by a customer

## 25. Next Coding Sequence

The recommended concrete implementation sequence is:

### Phase A — Repository Bootstrap

- workspace/package setup
- TypeScript/config conventions
- Cloudflare bindings
- local tooling
- CI baseline

### Phase B — Runtime + Database

- runtime registry
- migration runner
- request context
- D1 repositories
- outbox/idempotency/audit

### Phase C — Identity + Authorization

- managed authentication integration
- user/workspace/membership
- permissions
- resource policies
- session/security events

### Phase D — Business + Catalog

- business onboarding
- verification workflow
- service/offer model
- publication gates
- media references

### Phase E — Discovery + AI

- indexing projection
- Persian normalization
- deterministic filters
- hybrid retrieval
- AI intent parser
- ranking

### Phase F — Frontend Vertical Slice

- shared shell
- customer discovery
- partner onboarding
- admin verification console

### Phase G — Booking + Communications

- schedules
- slots
- booking transaction
- notifications

Only after these stages should the team expand aggressively into CRM, Reviews, Billing and additional industries.
