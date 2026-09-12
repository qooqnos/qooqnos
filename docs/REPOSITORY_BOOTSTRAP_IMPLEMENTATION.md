# Phoenix Repository Bootstrap Implementation

## Goal

Create the smallest production-shaped repository foundation required to begin coding Phoenix without violating the established architecture.

## Target Shape

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
  adapters/

tests/
migrations/
docs/
.claude/skills/
```

## Bootstrap Rules

- Keep the application a modular monolith.
- Keep domain modules independent from frontend code.
- Keep Cloudflare-specific implementation behind adapters where practical.
- Do not introduce microservices, Kubernetes or a custom auth server.
- Do not add dependencies without a concrete architectural need.
- TypeScript strictness is mandatory for application packages.
- Public contracts must be typed and schema validated at boundaries.

## Workspace Conventions

Every package should have:

- explicit package name
- clear public entrypoint
- internal/private modules separated from exported contracts
- tests near implementation or in the agreed test tree
- no circular dependency

Recommended dependency layers:

```text
apps
  ↓
contracts / BFF
  ↓
runtime
  ↓
modules
  ↓
ports
  ↓
adapters
```

`core` may be consumed by lower layers only when it contains genuinely shared primitives and no domain ownership.

## API Bootstrap

Create a single API application capable of:

- request ID generation/propagation
- structured error handling
- schema validation
- authentication context injection
- tenant/workspace context resolution
- module route registration
- health/readiness endpoints

Do not implement module business logic in the API bootstrap.

## Database Bootstrap

Create the initial migration system and baseline tables for:

- runtime module registry
- module versions
- tenant module state
- users/external identities
- workspaces/memberships
- permissions/roles
- audit events
- idempotency records
- outbox events
- feature flags

The schema must make tenant/workspace ownership explicit.

## Runtime Bootstrap

The first runtime must support:

```text
config
 → manifest discovery
 → manifest validation
 → dependency resolution
 → migration compatibility
 → route registration
 → health
```

A failed module manifest must fail safely rather than silently registering partial capabilities.

## Cloudflare Bootstrap

Define environment bindings for:

- D1
- R2
- Queues
- Vectorize

Use separate resources/configuration for local, preview, staging and production.

No production credentials or data are allowed in preview/local environments.

## CI Bootstrap

Initial pipeline:

```text
install
 → format check
 → lint
 → typecheck
 → unit tests
 → contract tests
 → build
```

Later stages add security, migration, integration and E2E gates.

## Testing Bootstrap

Create test utilities for:

- tenant/workspace context
- authenticated actors
- permission matrices
- deterministic IDs/time
- database fixtures
- event/outbox assertions
- fake provider adapters

All security and medical fixtures must be synthetic.

## First Smoke Test

The bootstrap must prove:

1. application starts
2. runtime loads manifests
3. D1 connectivity works
4. migration metadata is recognized
5. request context is created
6. health endpoint responds
7. a protected endpoint rejects unauthenticated access
8. cross-tenant access is denied

## Explicit Non-Goals

Do not implement yet:

- complete customer UI
- full AI agent
- internal payment processing
- medical diagnosis
- real-time everywhere
- custom vector database
- microservice decomposition
- complex event bus

## Completion Gate

Repository bootstrap is complete only when local and CI execution can reproducibly boot the application and run the foundation test suite without live provider dependencies.
