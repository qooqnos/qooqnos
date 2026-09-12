# Phoenix Module Skill

Native Claude Code entrypoint. Read `skills/phoenix-module/SKILL.md`, `docs/MODULE_ARCHITECTURE.md`, and `docs/AUTHORIZATION_IMPLEMENTATION.md` before module work.

## Rules
- Core is generic; modules own domain concepts/rules.
- Cross-module communication uses public services, commands, or versioned events.
- Dependencies form a DAG.
- Module migrations are versioned and tenant-safe.
- Never query another module's private tables.
- Central authorization is server-side and resource-scoped.
- AI is an untrusted caller and follows schema → actor → permission → policy → domain service → repository.
- Events are versioned and idempotent; jobs are retry-safe and observable.
- UI uses shared design system/slots; localization is foundational.
- Feature flags are not authorization or module enablement.
- No premature microservices, arbitrary AI SQL, secrets, unversioned events, or casual destructive migrations.

## Done
Verify manifest, dependency graph, permissions, tenant isolation, migrations, API schemas, events, jobs, UI, AI, localization, audit, observability, and security tests.
