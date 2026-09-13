---
name: phoenix-catalog
description: Rules for Phoenix catalog ownership, offers, services, products, pricing, publication, localization, and medical-content boundaries.
---

# Phoenix Catalog Skill
## Purpose
Own the authoritative marketplace representation of business offers, services, products, variants, pricing, publication state, and localized catalog content.
## Mandatory context
Read `docs/CATALOG_SERVICE_PRODUCT_ARCHITECTURE.md` and relevant module contracts before catalog work.
## Rules
- Catalog is the source of truth for offers/services/products.
- Tenant context and server-side authorization are mandatory.
- Published state is explicit; drafts never enter public Discovery.
- Money uses integer minor units + ISO currency.
- Availability, inventory, and booking remain owned by their domains.
- Discovery is a derived projection.
- AI may propose/extract data but cannot silently publish or mutate authoritative facts.
- No cross-module private SQL, provider SDK leakage, secrets, or arbitrary AI SQL.
- Medical publication requires verification/policy and cannot provide diagnosis, prescription, treatment, or medication recommendations.
## Done
Verify lifecycle, tenant isolation, authorization, money, outbox/idempotency, discovery projection, localization, and medical boundaries.
