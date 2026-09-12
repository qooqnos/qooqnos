# Phoenix AI Marketplace — System Architecture

## Positioning
Phoenix is an AI Marketplace, not a simple CRM. It sits between customer and business: businesses provide structured content/data; AI understands customer needs; Phoenix matches needs to suitable options.

## Recommended initial stack
- Web: React + TypeScript + Vite
- API: Hono on Cloudflare Workers
- DB: Cloudflare D1
- Object storage: R2
- Async: Queues
- Stateful coordination: Durable Objects where justified
- Semantic retrieval: Vectorize
- AI: provider abstraction over Workers AI and external providers
- Security: WAF, Turnstile, rate limiting, strict server authorization
- Delivery: GitHub Actions → Cloudflare

## Architecture style
Modular monolith initially. Core modules include identity, tenancy, authorization, marketplace, business, catalog, services, media, discovery, AI, booking, CRM, loyalty, messaging, notifications, billing, analytics, localization, documents/PDF/printing, audit, moderation and medical.

## Matching
`natural language → intent → structured constraints → hard filters → candidate retrieval → semantic retrieval → scoring/ranking → policy checks → explanation`.

## Dashboards
Admin, Business/Partner, Customer and internal team experiences share a common dashboard framework with permission-aware navigation and widgets.

## Internationalization
Multilingual and RTL/LTR are foundational. Store canonical timestamps consistently and render according to locale/timezone/calendar. Do not bake Persian/Jalali assumptions into the core domain model.

## Security
Tenant isolation, server-side authorization, schema validation, secure sessions/cookies, strict CORS/CSP, rate limiting, safe uploads, audit logs, dependency/security scanning and no secrets in source control.

## Medical boundary
Medical is a later module/partner-pilot domain. Professional verification and informed consent are required. AI must not diagnose, prescribe or recommend treatment; it only assists with matching within approved policies.
