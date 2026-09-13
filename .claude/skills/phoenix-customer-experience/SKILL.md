---
name: phoenix-customer-experience
description: Rules for Phoenix customer-facing UX, navigation, forms, view models, interaction state, localization, accessibility, and AI actions.
---

# Phoenix Customer Experience Skill
Native Claude Code entrypoint. Read `skills/phoenix-customer-experience/SKILL.md` and `docs/CUSTOMER_EXPERIENCE_ARCHITECTURE.md` before customer-facing work.
## Rules
- Customer Experience owns presentation, navigation, forms, view models, interaction state, and composition—not domain truth.
- Identity, Catalog, Availability, Booking, Communications, CRM, and Billing remain authoritative in their modules.
- Natural-language search may create structured intent; AI never invents providers, offers, prices, availability, or booking confirmation.
- Hard eligibility precedes recommendation.
- Client state is never authoritative for booking/catalog.
- Communications requires policy, consent, authorization, and idempotency; AI can draft but not send directly.
- Personalization prefers explicit preferences and safe observable signals; do not infer sensitive attributes.
- Support RTL/LTR, locale, timezone, currency, numbers, Jalali/Gregorian adapters; UTC remains canonical.
- Medical UX is matching/information/scheduling only, never diagnosis/prescription/treatment advice.
- Accessibility and loading/empty/error/retry/permission/unavailable states are mandatory.
## Done
Verify authorization, tenant isolation, stale availability, localization, accessibility, responsive behavior, cache scope, errors, and medical boundaries.
