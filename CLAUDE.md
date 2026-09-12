# Phoenix AI Marketplace — Claude Code Project Instructions

## Mission
Build Phoenix as a secure, modular, multilingual, multi-tenant AI marketplace. The platform understands customer needs and matches them to suitable businesses, services and products.

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

## Native Claude Code skills
Repository skills live under `.claude/skills/<skill-name>/SKILL.md` and are the native Claude Code skill-discovery location.

Available Phoenix skills include:

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

The legacy `skills/` tree remains the canonical reference during this migration. Native skill entrypoints must stay aligned with it until the legacy tree is intentionally retired.

## Before coding
Read:
1. `docs/PHOENIX_MASTER_RECOMMENDATIONS.md`
2. `docs/DATABASE_ARCHITECTURE.md`
3. the relevant native skill under `.claude/skills/`
4. the canonical legacy skill under `skills/` when the native entrypoint directs you there
5. existing implementation

For substantial architectural changes, create an ADR.

## Git workflow
- Work directly on `main` for this project unless the user explicitly requests another workflow.
- Do not create Pull Requests unless the user explicitly asks for one.
- Prefer focused, reviewable commits.
- Never make destructive or irreversible changes without separate approval.

## Definition of Done
Code + types + tests + migrations + authorization + tenant-isolation tests + documentation + lint/typecheck/build must be considered together. Never claim completion without relevant verification.
