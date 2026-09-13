# Phoenix AI Marketplace

Phoenix is a modular, multilingual, multi-tenant AI marketplace designed to understand customer needs and connect them with suitable businesses, services and products.

## Current architecture baseline

- Cloudflare-first
- Modular monolith
- D1 relational source of truth
- R2 object storage
- Queues for asynchronous work
- Vectorize for semantic retrieval
- RBAC + ABAC authorization
- Strong tenant isolation
- AI constrained by schema/policy/domain layers
- Shared dashboard/design-system architecture
- RTL/LTR + i18n from the foundation

## Roadmap

1. Foundation
2. Marketplace Core
3. AI Matching
4. Beauty
5. Fashion
6. Commerce
7. Medical partner/pilot
8. Additional industries

Architecture contracts are maintained in `docs/`. Claude Code implementation skills are maintained in `.claude/skills/`, which is the authoritative skills location.
