# Phoenix — Executable Workspace Stage 2

## Purpose

Freeze the executable workspace contract without changing domain behavior.

This stage turns the already-established package graph into a deterministic workspace boundary. It does not introduce microservices, new domain capabilities, or duplicate implementations.

## Canonical package layers

```text
packages/
  core/        # contracts, primitives, errors, request context
  database/    # D1 adapter, queries, transactions, persistence services
  runtime/     # module lifecycle, manifests, runtime orchestration
  onboarding/  # business onboarding domain slice
  i18n/        # localization contracts and locale primitives
```

Dependency direction:

```text
core
 ↑
database   runtime   i18n
 ↑     \      /
 onboarding
```

Rules:

- `core` depends on no Phoenix package.
- `database` may depend on `core`, never on domain packages.
- `runtime` may depend on `core`; it must not own domain persistence.
- `i18n` remains independent from domain packages.
- Domain packages may depend on foundation packages, never on sibling domain implementations.
- Cross-domain behavior is exposed through contracts/events, not direct table access.

## Root workspace contract

The repository root is an orchestration layer only. It owns workspace tooling, shared TypeScript configuration, formatting/linting/test/build orchestration, and CI configuration.

The root must not contain business logic.

Required lifecycle order:

1. install
2. format check
3. lint
4. typecheck
5. unit tests
6. contract tests
7. build

A failed earlier stage blocks later stages.

## TypeScript project graph

Each executable package owns its own `tsconfig.json`. Shared compiler policy is inherited from a root base configuration. Package references must follow the dependency direction above.

No path alias may create an undeclared dependency. Imports between packages must correspond to an explicit workspace dependency.

## Build boundary

Every executable package must expose a stable package entrypoint. Internal source files are not public API by default.

Build output is an implementation artifact and must never be imported by another package during source development.

## Testing boundary

- Unit tests remain colocated with the package they validate.
- Contract tests validate package boundaries and public interfaces.
- Integration/E2E tests belong to a dedicated test layer and are not embedded into domain packages.
- Tests must not become an alternative dependency mechanism.

## Cloudflare boundary

Cloudflare-specific bindings belong at the application/runtime adapter boundary. Core domain packages must remain portable and must not import Workers-specific globals directly.

D1 is accessed through the database package. Environment/binding resolution is an outer-layer responsibility.

## Explicit non-goals

This stage does not add:

- microservices
- Kubernetes
- a custom authentication server
- a second database abstraction
- a custom event bus
- a vector database
- realtime infrastructure everywhere
- duplicated module implementations

## Completion gate

Stage 2 is complete only when the repository can represent the declared package graph deterministically and the root orchestration contract can be implemented without violating dependency direction.

The next implementation stage is the executable root workspace/bootstrap itself, followed by package-level build/typecheck stabilization.
