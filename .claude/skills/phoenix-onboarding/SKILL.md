---
name: phoenix-onboarding
description: Rules for Phoenix business onboarding, verification, evidence, publication gates, auditability, provenance, localization, and regulated activation.
---
# Phoenix Business Onboarding Skill

Native Claude Code entrypoint. Read `skills/phoenix-onboarding/SKILL.md` and `docs/BUSINESS_ONBOARDING_VERIFICATION_ARCHITECTURE.md` before onboarding work.

## Rules
- Publication is server-enforced, never client-only.
- Verification is requirement/check/decision data, not a single boolean.
- Unverified/blocked supply never enters public Discovery.
- AI cannot approve credentials or activate a business.
- Verification evidence stays protected and never appears in public URLs, logs, analytics, or prompts.
- Tenant/workspace authorization and granular permissions are mandatory.
- Expired credentials require policy evaluation.
- AI-extracted values retain provenance and never silently become verification facts.
- Country/legal requirements belong in adapters/policy, not generic Core.
- Medical activation requires verified professional credentials and must not provide diagnosis, prescription, treatment, or medication advice.

## Done
Verify onboarding states, publication gates, evidence access, separation of review/approval, audit/outbox, discovery exclusion, AI provenance, medical rules, localization, country policy, and abuse controls.
