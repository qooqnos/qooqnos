---
name: phoenix-admin-partner
description: Rules for Phoenix admin and partner dashboards, AI-assisted supply creation, authorization, moderation, verification, audit, masking, and AI boundaries.
---

# Phoenix Admin & Partner Dashboard Skill

Native Claude Code entrypoint. Read `docs/PHOENIX_PRODUCT_NORTH_STAR.md`, `docs/AI_PRODUCT_DIRECTION.md`, `docs/CAPABILITY_DECISION_RULES.md`, `skills/phoenix-admin-partner/SKILL.md` and `docs/ADMIN_PARTNER_DASHBOARD_ARCHITECTURE.md` before dashboard work.

## Seller Product Direction
The Business/Partner experience should reduce the work required to create trustworthy, discoverable marketplace supply. Prefer AI-assisted creation and enrichment over forcing sellers through large manual forms.

Examples:
- upload a product photo and receive a structured product draft
- submit a service description and receive a structured service draft
- identify missing information and ask targeted questions
- generate draft titles, descriptions, localization, tags, and permitted media improvements

AI-generated content remains a draft until the owning domain and required seller/policy gates accept it.

## Rules
- Dashboards are composition/operations surfaces, never new domain sources of truth.
- Never query another module's private tables directly.
- Actor separation: Platform Admin, Verification, Moderation/Quality, Internal Ops/Support, Business/Partner.
- Server-side authorization resolves user → tenant → workspace → role/group → permission → resource policy.
- Partner scope is limited to authorized tenant/workspace resources.
- Verification and moderation decisions are policy-controlled, auditable, and respect separation of duties.
- Module lifecycle operations use Runtime contracts.
- AI may summarize/prioritize/draft/suggest and assist supply creation, but cannot grant permissions, bypass moderation, approve protected verification, silently publish protected facts, or execute privileged actions autonomously.
- Material AI operations must use canonical usage/entitlement/quota and billing contracts where applicable.
- Dashboard read models may be stale and never replace authoritative command confirmation.
- Sensitive data is minimized and masked.

## Done
Verify tenant isolation, object authorization, seller approval workflows, AI provenance, usage accounting, audit, masking, stale projections, AI boundaries, localization, accessibility, and anti-enumeration.
