---
name: phoenix-module
description: Rules for Phoenix module boundaries, product North Star alignment, ownership, dependency DAG, authorization, migrations, events, jobs, UI integration, and security.
---
# Phoenix Module Skill

Native Claude Code entrypoint. Read `docs/PHOENIX_PRODUCT_NORTH_STAR.md`, `docs/CAPABILITY_DECISION_RULES.md`, `skills/phoenix-module/SKILL.md`, `docs/MODULE_ARCHITECTURE.md`, and `docs/AUTHORIZATION_IMPLEMENTATION.md` before module work.

## Product Alignment
- Every module must state which part of `Understand Demand → Understand Supply → Decide → Match → Connect → Act → Learn` it strengthens.
- Supporting infrastructure modules remain subordinate to marketplace outcomes.
- Modules must reuse canonical capabilities instead of creating duplicate AI, billing, authorization, media, localization, or matching implementations.

## Rules
- Core is generic; modules own domain concepts/rules.
- Cross-module communication uses public services, commands, or versioned events.
- Dependencies form a DAG.
- Module migrations are versioned and tenant-safe.
- Never query another module's private tables.
- Central authorization is server-side and resource-scoped.
- AI is an untrusted caller and follows schema → actor → permission → policy → domain service → repository.
- AI-assisted seller supply creation is a product capability, but catalog remains authoritative and seller/domain approval rules apply.
- Material AI operations use canonical usage/entitlement/quota contracts where applicable.
- Events are versioned and idempotent; jobs are retry-safe and observable.
- UI uses shared design system/slots; localization is foundational.
- Feature flags are not authorization or module enablement.
- No premature microservices, arbitrary AI SQL, secrets, unversioned events, or casual destructive migrations.

## Done
Verify manifest, product alignment, dependency graph, permissions, tenant isolation, migrations, API schemas, events, jobs, UI, AI usage/accounting, localization, audit, observability, and security tests.
