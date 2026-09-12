# Phoenix Technology & Language Standards

## 1. Purpose

This document is the canonical technology and language standard for Phoenix AI Marketplace.

It defines which languages, formats, runtimes, and technology families are used for each architectural layer. New implementation work must follow this standard unless an explicit architecture decision records an exception.

## 2. Primary Rule

Phoenix is **TypeScript-first** and **database-first**.

Primary executable languages:

1. TypeScript — application/runtime/API/frontend/module implementation
2. SQL — D1 schema, migrations, and database queries

Supporting formats:

- JSON / JSON Schema — API contracts, structured AI output, configuration data
- YAML — CI/CD and declarative automation configuration
- Markdown — architecture, implementation documentation, and Claude Code skills
- CSS — presentation styling and design-system implementation
- HTML — semantic document structure where required by the frontend framework

Python is not part of the initial Phoenix production runtime. It may be introduced later for bounded data-science, offline evaluation, experimentation, or research workloads when an architecture decision requires it.

## 3. Technology Matrix

| Area | Language | Primary technology | Rule |
|---|---|---|---|
| Edge/API runtime | TypeScript | Cloudflare Workers | Production request execution |
| Web frontend | TypeScript | React-compatible web stack | Typed, accessible, RTL/LTR |
| Styling | CSS / TypeScript | Shared design system | Semantic tokens; no ad-hoc theme logic |
| Database | SQL + TypeScript | Cloudflare D1 | D1 is relational source of truth |
| Object storage | TypeScript | Cloudflare R2 | Metadata in D1; bytes in R2 |
| Async jobs | TypeScript | Cloudflare Queues | Versioned job contracts |
| Vector retrieval | TypeScript | Cloudflare Vectorize | Derived index only; never source of truth |
| API contracts | TypeScript + JSON Schema | Versioned schemas | Contracts expose capabilities, not tables |
| AI gateway | TypeScript | Provider adapters | Structured input/output; policy constrained |
| CI/CD | YAML + shell-compatible commands | GitHub Actions / deployment tooling | Reproducible and fail-closed |
| Documentation | Markdown | `docs/` | Architecture is normative when marked as contract |
| Claude Code skills | Markdown | `.claude/skills/` | Implementation guidance derived from architecture |

Exact framework package choices may be finalized during implementation, but they must not violate the architectural boundaries in this document.

## 4. TypeScript Standards

TypeScript is the default language for all application code.

Use it for:

- runtime and module registration
- domain/application services
- repositories and infrastructure ports
- API handlers and BFF composition
- authorization policies
- jobs and event handlers
- AI orchestration and tool contracts
- frontend components and state adapters
- provider adapters
- tests

Rules:

- Prefer strict typing.
- Do not use `any` as an architectural escape hatch.
- Public module/API boundaries must have explicit types or schemas.
- Domain invariants must not depend on frontend types.
- Runtime code must not import browser-only code.
- Browser code must not access D1/R2/provider credentials directly.
- Shared packages must remain infrastructure-light.

## 5. SQL Standards

SQL is the authoritative language for D1 schema and migration work.

Use SQL for:

- table definitions
- indexes
- constraints
- migrations
- deterministic relational queries
- transactional database operations where supported

Rules:

- migrations are append-only history
- use stable IDs
- store timestamps in UTC
- use integer minor units for money
- define explicit ownership/tenant strategy
- use foreign keys and unique constraints where domain invariants require them
- create indexes from measured access patterns
- never expose raw table structure as the public API

## 6. JSON and JSON Schema

JSON is used for machine-readable contracts and configuration boundaries.

JSON Schema is preferred for validating externally supplied structured payloads and AI structured output where schema validation is required.

Use for:

- API request/response contracts where appropriate
- error contracts
- event/job payload schemas
- AI intent and tool input/output schemas
- configuration documents
- integration/webhook payload definitions

Untrusted JSON must be validated before entering domain logic.

## 7. CSS and Frontend Markup

Frontend implementation must preserve the shared design-system architecture.

CSS is responsible for presentation and responsive behavior. Theme values must come from semantic design tokens rather than component-specific hard-coded colors.

HTML/JSX-style markup must remain semantic and accessible.

Required frontend foundations:

- RTL and LTR
- Persian typography and Unicode correctness
- light/dark themes
- keyboard accessibility
- responsive layouts
- loading, empty, error, and permission states

## 8. YAML and Automation

YAML is used for CI/CD and declarative automation configuration.

CI should execute, at minimum, the repository's agreed validation sequence:

```text
install
→ format check
→ lint
→ typecheck
→ unit tests
→ contract tests
→ build
```

Security and architecture gates are release-blocking where defined by the architecture.

## 9. Markdown Standards

Markdown is the canonical format for human-facing engineering knowledge in the repository.

Use:

- `docs/` for architecture, implementation plans, contracts, and decisions
- `.claude/skills/` for actionable Claude Code implementation guidance

Architecture documents define **what must be true**. Skills define **how an implementation agent should work within those constraints**.

A skill must not silently weaken an architecture contract.

## 10. Package and Module Boundaries

Recommended executable dependency direction:

```text
apps
  ↓
API / BFF
  ↓
Runtime
  ↓
Module application/domain
  ↓
Infrastructure ports
  ↓
Cloudflare/provider adapters
```

A module should use the standard internal structure:

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

No module may directly query another module's private tables.

## 11. Database-First Rule

When a feature owns durable business truth:

```text
Domain decision
→ repository
→ D1 source of truth
→ outbox/event projection
→ derived indexes/read models
```

Vectorize, caches, analytics projections, search indexes, and frontend state are derived data and must never silently become the authoritative business record.

## 12. AI Language Boundary

AI implementation remains TypeScript in the application runtime.

AI providers are adapters behind the AI Gateway.

AI output must be treated as untrusted proposed data until:

```text
AI output
→ schema validation
→ deterministic policy validation
→ domain authorization
→ domain service
→ side effect
```

AI must not directly write to D1, call arbitrary providers, bypass authorization, or invent business state.

## 13. When Another Language Is Allowed

A different production language requires an explicit architecture decision when it introduces:

- a new runtime
- a new deployment model
- a new operational dependency
- a new data-access path
- a security boundary
- a new long-running service

The default response is to keep the feature in TypeScript unless there is a demonstrated technical reason not to.

Python may be used for offline evaluation/research workloads without becoming part of the production request path.

## 14. Prohibited Drift

Do not introduce without architecture approval:

- a second application runtime solely for convenience
- a custom authentication server
- direct browser access to Cloudflare storage/database
- a custom vector database when Vectorize is sufficient
- microservices merely to separate modules
- untyped public API payloads
- arbitrary AI tool execution
- business truth stored only in a vector index/cache

## 15. Definition of Done

A new implementation is standards-compliant when:

- its primary executable code uses TypeScript unless an approved exception exists
- database changes use SQL migrations
- public boundaries are typed/schema-validated
- tenant/security boundaries are explicit
- module ownership is respected
- Cloudflare access is isolated behind infrastructure/adapters where appropriate
- AI outputs are validated and policy constrained
- tests cover the relevant module and contract boundaries
- documentation and the relevant Claude skill are updated when the architecture changes

## 16. Canonical Decision

For the initial Phoenix implementation, the team should think in this order:

**TypeScript + SQL first; JSON/JSON Schema, CSS, YAML, and Markdown as supporting technologies; Python only for explicitly bounded non-runtime workloads.**
