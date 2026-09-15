---
name: phoenix-catalog
description: Rules for Phoenix catalog ownership, AI-assisted seller supply creation, offers, services, products, pricing, publication, localization, and medical-content boundaries.
---

# Phoenix Catalog Skill
## Purpose
Own the authoritative marketplace representation of business offers, services, products, variants, pricing, publication state, and localized catalog content.
## Mandatory context
Read `docs/PHOENIX_PRODUCT_NORTH_STAR.md`, `docs/AI_PRODUCT_DIRECTION.md`, `docs/CAPABILITY_DECISION_RULES.md`, `docs/CATALOG_SERVICE_PRODUCT_ARCHITECTURE.md` and relevant module contracts before catalog work.
## Seller AI Direction
- Seller catalog creation is a strategic Phoenix capability, not merely a CRUD form.
- Raw seller inputs may include product photos, service text, documents, or structured imports.
- AI may extract attributes and propose titles, descriptions, categories, tags, variants, localized content, media improvements, and missing-information questions.
- The target experience is `Raw Input → AI Draft → Validation → Seller Review → Publish → Discovery/Matching`.
- AI-generated values retain provenance and cannot silently become authoritative commercial facts.
- Price, inventory, availability, credentials, compliance, ownership, and other authoritative facts require domain-owned validation.
## Rules
- Catalog is the source of truth for offers/services/products.
- Tenant context and server-side authorization are mandatory.
- Published state is explicit; drafts never enter public Discovery.
- Money uses integer minor units + ISO currency.
- Availability, inventory, and booking remain owned by their domains.
- Discovery is a derived projection.
- AI may propose/extract data but cannot silently publish or mutate authoritative facts.
- Material AI operations must emit usage/cost telemetry and use canonical Billing usage/entitlement/quota contracts where customer charging applies.
- No cross-module private SQL, provider SDK leakage, secrets, or arbitrary AI SQL.
- Medical publication requires verification/policy and cannot provide diagnosis, prescription, treatment, or medication recommendations.
## Done
Verify lifecycle, tenant isolation, authorization, money, AI provenance, seller approval flow, usage/idempotency, outbox, discovery projection, localization, and medical boundaries.
