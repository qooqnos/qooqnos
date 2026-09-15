# Phoenix AI Marketplace — Master Architecture Recommendations

> Status: Proposed architecture baseline

## Vision
Phoenix is an intelligent decision and connection layer between customers and businesses. It understands customer natural-language needs, understands and structures business supply, discovers suitable businesses/services/products, ranks candidates, explains the match and connects the customer to the provider.

Phoenix is not primarily a CRM, ERP, directory, booking system, storefront, or generic AI chatbot. Those are capabilities that strengthen the marketplace decision loop.

## Product loop
`Understand Demand → Understand Supply → Decide → Match → Connect → Act → Learn`

Demand intelligence and supply intelligence are equally important. A business should be able to provide minimal raw information and have Phoenix help turn it into structured, trustworthy, discoverable marketplace supply.

## AI-assisted supply creation
Seller AI may accept product/service photos, text, documents, imports, or other approved raw inputs and propose structured catalog drafts, titles, descriptions, attributes, variants, localized content, media improvements and missing-information questions.

AI-generated commercial content remains proposed until the owning domain validates and the seller/policy workflow accepts it. AI must not silently invent price, inventory, credentials, compliance facts, ownership, or other authoritative facts.

The target seller loop is:
`Raw Seller Input → AI Extraction → Enrichment → Validation → Seller Review → Publication → Discovery/Matching`

## AI operation economics
Material AI operations consume provider/model resources and therefore are measurable economic activity. AI usage must integrate with the canonical Billing usage/entitlement/quota model.

Support:
`AI Operation → Usage Event → Quota/Credit/Entitlement → Pricing Rule → Charge or Included Usage`

Provider token/model cost is an internal cost signal, not the customer pricing authority.

## Architecture
Use a **Modular Monolith on Cloudflare Edge** initially. Avoid premature microservices. Preserve module boundaries through domain interfaces, permissions, events, manifests, migrations and tests. A module may later be extracted only when measurable scaling, reliability, deployment or ownership needs justify it.

## Cloudflare-first stack
- GitHub: source control, CI/CD and documentation
- Cloudflare Workers: application/API runtime
- D1: relational source of truth
- R2: media/documents/PDFs
- Queues: asynchronous work
- Durable Objects: stateful coordination where needed
- Vectorize: semantic retrieval
- AI Gateway/model-provider abstraction: controlled AI access
- WAF/Turnstile/rate limiting: edge security

## Core modules
Identity, tenancy, authorization, marketplace, business, catalog, services, media, discovery, AI, booking, CRM, loyalty, messaging, notification, billing, analytics, content, localization, documents, PDF, printing, calendar, audit, moderation and medical.

## Multi-tenancy
Model organization, workspace, location/branch, membership and user. Every tenant-scoped data access path must establish tenant context server-side. Never rely on URL IDs or UI checks for isolation.

## Authorization
Use RBAC + ABAC. RBAC defines permissions; ABAC evaluates tenant/workspace/branch/ownership/resource-state and policy attributes. Authorization is a domain boundary.

## Module contract
Each module should define a manifest containing id, version, dependencies, permissions, routes, events, migrations and settings. Modules communicate through contracts/domain services/events, not internal table coupling.

## AI matching
`Natural Language → Intent → Hard Constraints → Candidate Retrieval → Semantic Retrieval → Availability → Quality/Trust → Ranking → Policy Check → Explanation`.

Hard constraints cannot be overridden by semantic similarity. Match runs must be versioned so ranking/model changes are measurable and reversible.

## AI safety boundary
`LLM/Image Model → schema validation → provenance → policy validation → authorization → domain service → database`.

AI never gets arbitrary SQL access and never bypasses authorization. For Medical, AI must not diagnose, prescribe or recommend treatment. Provider credentials must be verified before activation and sensitive health data requires consent/privacy controls.

## UI platform
Use a shared dashboard shell with permission-aware navigation, workspace switching, notifications, widgets, theme and i18n. Build Admin, Partner/Business and Customer experiences from shared primitives rather than unrelated dashboard codebases.

Theme uses design tokens for colors, typography, spacing, radius, shadows, motion and density. Support light/dark/system. i18n supports locale, direction, calendar, number format, currency and timezone; Persian/Jalali is not hard-coded into the core database model.

## Document engine
PDF, printing and export are reusable modules: `Template → Data → Renderer → PDF/Print/Export`. Heavy rendering should use asynchronous jobs and object storage.

## Security
Strict tenant isolation, server authorization, input validation, secure cookies, CSRF where applicable, strict CORS/CSP, rate limiting, WAF/bot protection, safe uploads, secrets isolation, dependency scanning, audit logs and security tests.

## Performance
Use indexes, pagination, caching for safe public reads, image variants, background jobs, streaming where useful and read replication where appropriate. Establish measurable budgets rather than assuming performance.

## Observability
Measure request/API latency, errors, DB/query latency, queues, cache hit rate, search latency, AI latency/cost, AI-assisted seller operation success, match quality, conversion and module failures. Propagate request/correlation IDs.

## Delivery order
1. Foundation: repo, CI/CD, Workers/D1/R2, auth, tenancy, RBAC/ABAC, i18n, theme, audit
2. Marketplace core: businesses, categories, services/products, media, search, reviews
3. AI: seller supply creation/enrichment, intent, semantic retrieval, matching, ranking, explanations, conversation
4. Beauty
5. Fashion
6. Commerce
7. Medical partner/pilot with verification, consent and compliance
8. Additional industries

## Product governance
Before adding a meaningful capability, read:
- `docs/PHOENIX_PRODUCT_NORTH_STAR.md`
- `docs/AI_PRODUCT_DIRECTION.md` for AI work
- `docs/CAPABILITY_DECISION_RULES.md`

## Principles
Security before convenience. Database integrity before AI convenience. AI proposes; policy and domain services decide. Measure before optimizing. Keep providers replaceable. Keep industry-specific logic out of Phoenix Core. Avoid premature microservices. Build toward the intelligent decision and connection layer, not feature count.
