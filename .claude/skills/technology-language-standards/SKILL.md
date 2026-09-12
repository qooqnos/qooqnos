# Phoenix Technology & Language Standards Skill

## Purpose

Apply the repository's canonical technology and language rules whenever implementing or modifying Phoenix code.

## Mandatory Defaults

- Use **TypeScript** for production application, API, runtime, module, job, AI orchestration, adapter, frontend, and test code.
- Use **SQL** for D1 schema, migrations, constraints, indexes, and relational queries.
- Use **JSON / JSON Schema** for machine-readable contracts and structured AI boundaries.
- Use **CSS** for presentation and design-system styling.
- Use **YAML** for CI/CD configuration.
- Use **Markdown** for architecture documentation and Claude Code skills.
- Do not introduce Python into the production request/runtime path unless an explicit architecture decision approves it.

## Before Coding

1. Identify the owning module.
2. Identify whether the change is runtime, frontend, domain, persistence, contract, adapter, job, or documentation work.
3. Select the standard language from the layer's technology matrix.
4. Confirm tenant, authorization, source-of-truth, and AI boundaries.
5. Check whether the change requires a migration or contract update.

## TypeScript Rules

- Keep strict typing enabled.
- Avoid `any`.
- Define explicit types at public boundaries.
- Validate untrusted input before domain execution.
- Keep domain logic independent of frontend/browser APIs.
- Keep provider and Cloudflare-specific details behind adapters/infrastructure boundaries where the architecture requires them.

## SQL Rules

- Treat D1 as the relational source of truth.
- Create append-only migrations.
- Use UTC timestamps.
- Use stable IDs and integer minor units for money.
- Add explicit tenant/workspace ownership.
- Use constraints and indexes for real domain/access-pattern requirements.
- Never make a database table schema the public API contract.

## Contract Rules

Public APIs, events, jobs, webhooks, and AI tool boundaries must have explicit schemas/types.

Use the standard API error/versioning conventions already defined in the repository.

AI flow:

```text
model output
→ schema validation
→ policy validation
→ authorization
→ domain service
→ side effect
```

Never allow an AI model to bypass the domain layer or directly mutate authoritative data.

## Frontend Rules

Preserve:

- RTL/LTR
- light/dark themes
- semantic design tokens
- accessibility
- responsive behavior
- typed API clients
- explicit loading/error/empty/permission states

Do not hard-code theme semantics into individual components.

## Module Boundary Rules

Follow:

```text
apps
→ API/BFF
→ Runtime
→ Module application/domain
→ Infrastructure ports
→ Cloudflare/provider adapters
```

Do not import frontend code into domain modules.
Do not query another module's private tables directly.
Do not create a second runtime or microservice merely for convenience.

## Database-First Rule

For durable business truth, implement:

```text
domain decision
→ repository
→ D1
→ outbox/event
→ derived projection
```

Search indexes, Vectorize, analytics, caches, and frontend state remain derived.

## Exception Rule

If another language or runtime appears necessary:

1. Stop before introducing it into production architecture.
2. Document the technical reason.
3. Record the new runtime/deployment/security/data-access implications.
4. Obtain an explicit architecture decision.

Python can be used for bounded offline research/evaluation workloads when it does not become part of the production request path.

## Validation Checklist

Before declaring the work complete:

- [ ] Correct language chosen for the layer
- [ ] TypeScript is strict and typed
- [ ] SQL changes are migration-based
- [ ] Public contracts are typed/schema-validated
- [ ] Tenant and authorization boundaries are explicit
- [ ] Source of truth is D1 where durable business truth is involved
- [ ] AI output is validated and policy constrained
- [ ] Tests cover the changed boundary
- [ ] Documentation/architecture is updated if a standard changes
