# Phoenix Architect Skill

This is the native Claude Code entrypoint for the Phoenix Architect skill.

## Mandatory context
Before substantial work, read the canonical skill at `skills/phoenix-architect/SKILL.md`, then read the relevant architecture documents.

## Non-negotiables
- Modular monolith unless an ADR authorizes extraction.
- Server-side authorization and tenant isolation are mandatory.
- Database is authoritative; search/vector data is derived.
- AI follows schema validation → policy → authorization → domain service → repository.
- No cross-module private-table coupling.
- External providers remain replaceable.
- Medical AI must not diagnose, prescribe, or recommend treatment.
- Every schema change requires a migration.
- RTL/LTR and i18n are foundational.

## Workflow
Understand → Inspect → Plan → ADR if needed → Implement → Test → Security Review → Performance Review → Document → Verify.

## Definition of Done
Implementation, types, tests, authorization, tenant isolation, migrations, documentation, and relevant checks must be verified before completion.
