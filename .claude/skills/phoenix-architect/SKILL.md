---
name: phoenix-architect
description: Rules for Phoenix modular architecture, security, database authority, tenancy, AI boundaries, and architectural workflow.
---

# Phoenix Architect Skill
## Purpose
Keep Phoenix modular, secure, database-first, multilingual, multi-tenant, and evolvable as an intelligent marketplace decision and connection platform.
## Mandatory context
Before substantial work, read `docs/PHOENIX_PRODUCT_NORTH_STAR.md`, `docs/PHOENIX_MASTER_RECOMMENDATIONS.md`, `docs/CAPABILITY_DECISION_RULES.md`, the relevant architecture documents, and this skill.
## Product Direction
- Phoenix's core loop is `Understand Demand → Understand Supply → Decide → Match → Connect → Act → Learn`.
- Marketplace, catalog, discovery, booking, CRM, billing, and AI are supporting capabilities around this loop.
- Seller-facing systems should reduce the effort required to create trustworthy, discoverable supply.
- AI-assisted seller operations may turn raw photos/text/documents into structured drafts, enrichment, and missing-information questions, but authoritative domain facts remain governed by their owning domains.
- Material AI operations must be measurable and connected to canonical Billing usage/entitlement/quota mechanisms.
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
Understand → Identify the North Star outcome → Inspect → Plan → ADR if needed → Implement → Test → Security Review → Performance Review → Product-alignment Review → Document → Verify.
## Definition of Done
Implementation, types, tests, authorization, tenant isolation, migrations, documentation, product-direction alignment, and relevant checks are verified before completion.
