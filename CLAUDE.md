# Phoenix AI Marketplace — Claude Code Project Instructions

## Mission
Build Phoenix as a secure, modular, multilingual, multi-tenant AI marketplace. The platform understands customer needs, understands business supply, and makes useful decisions that connect customers with suitable businesses, services and products.

## Product North Star — Mandatory
Phoenix is fundamentally an **intelligent decision and connection layer between customers and businesses**.

The canonical product loop is:
`Understand Demand → Understand Supply → Decide → Match → Connect → Act → Learn`

Marketplace, catalog, discovery, booking, CRM, billing and AI are capabilities that strengthen this loop; they are not independent product identities.

Before designing or coding a meaningful capability, read:
- `docs/PHOENIX_PRODUCT_NORTH_STAR.md`
- `docs/AI_PRODUCT_DIRECTION.md` when AI is involved
- `docs/CAPABILITY_DECISION_RULES.md`

A technically correct feature that does not strengthen the Phoenix marketplace loop requires explicit product justification.

## Seller AI Product Principle
Phoenix should make it possible for a business to provide minimal raw input and receive marketplace-ready structured supply.

Example:
`Product photo → AI extraction → structured draft → title/description/enrichment → missing-information questions → seller confirmation → publication → discovery/matching`

AI-generated content is proposed until validated by the owning domain and accepted according to policy. AI must not silently invent prices, inventory, credentials, compliance facts, ownership, or other authoritative commercial facts.

AI-assisted seller operations are economic operations. Material AI usage must be measurable and integrate with the canonical Billing usage/entitlement/quotas model. Provider token cost is an internal cost signal, not the customer pricing authority.

## Mandatory architecture
- Modular monolith first; no premature microservices.
- Cloudflare-first: Workers, D1, R2, Queues, Durable Objects where justified, Vectorize for semantic retrieval.
- Database is the source of truth.
- Tenant isolation and server-side authorization are mandatory.
- Use RBAC + ABAC.
- Every meaningful capability should be a module with permissions, dependencies, migrations, events and tests.
- AI cannot directly execute arbitrary SQL or bypass domain services.
- AI output is untrusted input: schema validation → policy validation → authorization → domain service → repository.
- Medical functionality must not diagnose, prescribe or recommend treatment; credential verification and consent are required.
- UTC is canonical for stored timestamps; locale/timezone/calendar are presentation/domain adapters.
- RTL/LTR and multilingual support are foundational.
- Heavy work belongs in queues/background jobs.

## Native Claude Code skills — single source of truth
Repository skills live under `.claude/skills/<skill-name>/SKILL.md`. The `.claude/skills/` tree is the only canonical Claude Code skill source.

Available Phoenix skills:
- `phoenix-architect`
- `phoenix-ai`
- `phoenix-admin-partner`
- `phoenix-billing`
- `phoenix-booking`
- `phoenix-catalog`
- `phoenix-communications`
- `phoenix-crm`
- `phoenix-customer-experience`
- `phoenix-database`
- `phoenix-discovery`
- `phoenix-module`
- `phoenix-onboarding`

Do not reference or recreate the retired `skills/` tree. Architecture details belong in `docs/`; skill-specific operating rules belong in `.claude/skills/`.

## Before coding
1. Read `docs/PHOENIX_PRODUCT_NORTH_STAR.md`.
2. Read `docs/PHOENIX_MASTER_RECOMMENDATIONS.md`.
3. Read `docs/DATABASE_MODEL.md` for persistence work.
4. Read the relevant architecture document(s).
5. Read the relevant native skill under `.claude/skills/`.
6. Read `docs/AI_PRODUCT_DIRECTION.md` and `docs/CAPABILITY_DECISION_RULES.md` when the work touches product strategy, AI, seller experience, catalog, discovery, or billing.
7. Inspect existing implementation before introducing new structure.

For substantial architectural changes, create an ADR.

## Git workflow
- Work directly on `main` unless the user explicitly requests another workflow.
- Do not create Pull Requests unless the user explicitly asks for one.
- Prefer focused, reviewable commits.
- Never make destructive or irreversible changes without separate approval.

## Definition of Done
Code + types + tests + migrations + authorization + tenant-isolation tests + documentation + product-direction alignment + lint/typecheck/build must be considered together. Never claim completion without relevant verification.
