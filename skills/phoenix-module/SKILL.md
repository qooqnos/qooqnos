# Phoenix Module Skill

## Role

Act as the Phoenix Module Architect and implementation guardian. Build capabilities as explicit, versioned modules that follow `docs/MODULE_ARCHITECTURE.md`, `docs/AUTHORIZATION_IMPLEMENTATION.md`, and `docs/SECURITY_ARCHITECTURE.md`.

## Mandatory workflow

1. Read the repository `CLAUDE.md`.
2. Read the relevant architecture and module documents before coding.
3. Inspect existing Core contracts and modules.
4. Define or update the module manifest before implementation.
5. Declare dependencies, permissions, routes, events, jobs, migrations, settings, UI extensions, and AI tools as applicable.
6. Keep domain ownership inside the module.
7. Use Core services for identity, tenancy, authorization, audit, storage, i18n, and common infrastructure.
8. Never access another module's private tables directly.
9. Never let an LLM bypass authorization or domain services.
10. Add tests and documentation with the implementation.
11. Run the relevant checks before declaring completion.

## Module design rules

### Boundaries

- Core is generic.
- Modules own domain concepts and rules.
- Cross-module communication uses public services, commands, or versioned events.
- Dependencies must form a DAG.
- Optional dependencies require deterministic fallback behavior.

### Database

- Module migrations live with the module contract.
- Repository access is tenant-safe.
- Queries are parameterized.
- No cross-module private-table SQL.
- Destructive migrations require explicit review.
- Backfills must be production-safe.

### Authorization

Every sensitive operation must pass the central authorization pipeline:

```text
identity
→ membership
→ permission
→ tenant
→ workspace/branch
→ ownership/resource policy
→ resource state
→ module state
→ approval
```

Frontend permission checks are UX only. Server-side authorization is authoritative.

### AI

AI is an untrusted caller.

```text
LLM
→ schema validation
→ actor context
→ permission
→ policy
→ module domain service
→ repository
→ data store
```

AI tools must declare input/output schemas, permissions, data classification, side-effect level, confirmation requirements, and cost/rate policy.

### Events

- Use versioned event names.
- Prefer outbox publication for transactional domain events.
- Consumers must be idempotent.
- Never rely on exactly-once delivery.
- Do not put secrets or unnecessary sensitive data into events.

### Jobs

Long-running or retryable work belongs in queues/workflows. Jobs must be idempotent, observable, permission-aware, and safe to retry.

### UI

Use the Phoenix Design System. Extend predefined UI slots rather than injecting arbitrary global UI. Every extension must define visibility requirements, loading/empty/error states, localization, and responsive behavior.

### Localization

Use shared locale infrastructure. Support language, direction, timezone, currency, number format, and calendar adapters. Keep canonical database dates locale-neutral.

### Feature flags

Flags must be scoped, owned, documented, auditable, and eventually retired. Do not use feature flags as a substitute for authorization or module enablement.

### Security

Treat all module input as untrusted. Apply validation, rate limiting, output encoding, secure uploads, audit logging, and data classification. Sensitive modules require explicit policy and approval controls.

## Forbidden patterns

Do not:

- create microservices merely to separate modules;
- duplicate Core authentication or authorization;
- give AI direct SQL/database access;
- trust client-side permission checks;
- query another module's private tables;
- hard-code country rules into Core;
- hard-code Persian/Jalali assumptions into canonical storage;
- put secrets in source control or logs;
- create unversioned events;
- perform destructive migrations casually;
- introduce a new dependency when an existing Core contract is sufficient.

## Required implementation artifacts

For a new module, prefer this structure:

```text
modules/<module-id>/
├── manifest.ts
├── domain/
├── application/
├── infrastructure/
├── api/
├── events/
├── jobs/
├── policies/
├── ui/
├── ai/
├── migrations/
├── locales/
├── tests/
└── README.md
```

Do not create every directory mechanically. Create only what the module needs.

## Verification checklist

Before completion verify:

- [ ] manifest validates
- [ ] dependency graph validates
- [ ] permissions are registered
- [ ] authorization tests exist
- [ ] tenant isolation tests exist
- [ ] migrations run cleanly
- [ ] API schemas validate
- [ ] events are versioned/idempotent
- [ ] jobs are retry-safe
- [ ] settings are validated
- [ ] feature flags are scoped
- [ ] UI uses shared components
- [ ] AI tools cannot bypass policy
- [ ] localization is wired
- [ ] audit/observability is present
- [ ] security tests pass
- [ ] docs are updated

## Commit discipline

Prefer small, reviewable commits. Use conventional commit messages such as:

- `feat(module): add booking module contract`
- `feat(module): implement booking domain`
- `test(module): add booking authorization coverage`
- `docs(module): document booking lifecycle`

Never commit secrets, credentials, private keys, production tokens, or generated sensitive data.
