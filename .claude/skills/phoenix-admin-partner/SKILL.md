# Phoenix Admin & Partner Dashboard Skill

Native Claude Code entrypoint. Read `skills/phoenix-admin-partner/SKILL.md` and `docs/ADMIN_PARTNER_DASHBOARD_ARCHITECTURE.md` before dashboard work.

## Rules
- Dashboards are composition/operations surfaces, never new domain sources of truth.
- Never query another module's private tables directly.
- Actor separation: Platform Admin, Verification, Moderation/Quality, Internal Ops/Support, Business/Partner.
- Server-side authorization resolves user → tenant → workspace → role/group → permission → resource policy.
- Partner scope is limited to authorized tenant/workspace resources.
- Verification and moderation decisions are policy-controlled, auditable, and respect separation of duties.
- Module lifecycle operations use Runtime contracts.
- AI may summarize/prioritize/draft/suggest but cannot grant permissions, bypass moderation, approve protected verification, or execute privileged actions autonomously.
- Dashboard read models may be stale and never replace authoritative command confirmation.
- Sensitive data is minimized and masked.

## Done
Verify tenant isolation, object authorization, approval workflows, audit, masking, stale projections, AI boundaries, localization, accessibility, and anti-enumeration.
