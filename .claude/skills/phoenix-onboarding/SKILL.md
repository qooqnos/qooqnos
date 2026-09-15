---
name: phoenix-onboarding
description: Rules for Phoenix business onboarding, AI-assisted supply creation, verification, evidence, publication gates, auditability, provenance, localization, and regulated activation.
---
# Phoenix Business Onboarding Skill

Native Claude Code entrypoint. Read `docs/PHOENIX_PRODUCT_NORTH_STAR.md`, `docs/AI_PRODUCT_DIRECTION.md`, `docs/CAPABILITY_DECISION_RULES.md`, `skills/phoenix-onboarding/SKILL.md` and `docs/BUSINESS_ONBOARDING_VERIFICATION_ARCHITECTURE.md` before onboarding work.

## Product Direction
Onboarding is the entry point for creating trustworthy marketplace supply. Minimize seller effort by allowing structured and AI-assisted intake, while preserving verification and publication authority.

## Rules
- Publication is server-enforced, never client-only.
- Verification is requirement/check/decision data, not a single boolean.
- Unverified/blocked supply never enters public Discovery.
- AI may extract/propose catalog and business information but cannot approve credentials or activate a business.
- Verification evidence stays protected and never appears in public URLs, logs, analytics, or prompts.
- Tenant/workspace authorization and granular permissions are mandatory.
- Expired credentials require policy evaluation.
- AI-extracted values retain provenance and never silently become verification facts.
- Seller-generated/AI-generated catalog drafts require the appropriate seller/domain approval before publication.
- Material AI onboarding/supply operations must be measurable and use canonical usage/quota/billing contracts where applicable.
- Country/legal requirements belong in adapters/policy, not generic Core.
- Medical activation requires verified professional credentials and must not provide diagnosis, prescription, treatment, or medication advice.

## Done
Verify onboarding states, publication gates, evidence access, seller approval, separation of review/approval, AI provenance, AI usage accounting, audit/outbox, discovery exclusion, medical rules, localization, country policy, and abuse controls.
