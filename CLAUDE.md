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

## Before coding
Read:
1. `docs/PHOENIX_MASTER_RECOMMENDATIONS.md`
2. `docs/DATABASE_ARCHITECTURE.md`
3. relevant module skill under `skills/`
4. existing implementation

For substantial architectural changes, create an ADR.

## Definition of Done
Code + types + tests + migrations + authorization + tenant-isolation tests + documentation + lint/typecheck/build must be considered together. Never claim completion without relevant verification.
