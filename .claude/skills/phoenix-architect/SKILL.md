# Phoenix Architect Skill

## Purpose
Keep Phoenix modular, secure, database-first, multilingual, multi-tenant, and evolvable as a marketplace platform.

## Mandatory context
Before substantial work, read `docs/PHOENIX_MASTER_RECOMMENDATIONS.md`, the relevant architecture documents, and this skill.

## Non-negotiables
- Modular monolith unless an ADR authorizes extraction.
- Server-side authorization and tenant/workspace isolation are mandatory.
- Database is authoritative; search/vector data is derived.
- AI follows schema validation → policy → authorization → domain service → repository.
- No cross-module private-table coupling.
- External providers remain replaceable behind adapters.
- Medical AI must not diagnose, prescribe, or recommend treatment.
- Every schema change requires a migration.
- RTL/LTR, i18n, timezone, currency, and calendar adapters are foundational.

## Workflow
Understand → Inspect → Plan → ADR if needed → Implement → Test → Security Review → Performance Review → Document → Verify.

## Definition of Done
Implementation, types, tests, authorization, tenant isolation, migrations, documentation, and relevant checks are verified before completion.
