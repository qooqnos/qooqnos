# Phoenix Catalog Skill

Native Claude Code entrypoint. Read `skills/phoenix-catalog/SKILL.md` and `docs/CATALOG_SERVICE_PRODUCT_ARCHITECTURE.md` before catalog work.

## Rules
- Catalog is source of truth for offers/services/products.
- Tenant context and server-side authorization are mandatory.
- Published state is explicit; drafts never enter public Discovery.
- Money uses integer minor units + ISO currency.
- Availability/inventory/booking remain owned by their domains.
- Discovery is a derived projection.
- AI may propose/extract data but cannot silently publish or mutate authoritative facts.
- No cross-module private SQL, provider SDK leakage, secrets, or arbitrary AI SQL.
- Medical publication requires verification/policy and cannot provide diagnosis, prescription, treatment, or medication recommendations.

## Done
Verify lifecycle, tenant isolation, authorization, money, outbox/idempotency, discovery projection, localization, and medical boundaries.
