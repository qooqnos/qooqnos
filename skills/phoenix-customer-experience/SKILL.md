# Phoenix Customer Experience Skill

## Mission

Implement the customer-facing Phoenix journey without moving domain ownership into the frontend.

## Core Journey

`Intent → AI Understanding → Eligible Matches → Recommendation → Offer/Profile → Contact/Booking → Communication → History → Feedback`

## Ownership Rules

Customer Experience owns presentation, navigation, forms, view models, interaction state, and customer-facing composition.

It does not own authoritative:

- identity;
- catalog;
- availability;
- booking;
- communication delivery;
- CRM relationship state;
- billing.

## AI Search

Natural-language input may be transformed into structured intent.
Show meaningful interpreted constraints so the customer can correct them.
Never let AI invent providers, offers, prices, availability, or booking confirmation.

## Results

Hard eligibility comes first.
Availability must come from the Availability/Booking contracts.
Recommendation explanations must use grounded current data.
Do not expose sensitive ranking signals or internal scoring formulas.

## Commands

Customer actions must call the owning domain module.
Examples:

- booking → Booking
- save/favorite → appropriate customer/profile capability
- communication → Communications
- account → Identity/Auth

The frontend must never write another module's private database tables.

## State

Separate:

- authoritative server state
- cached read models
- local UI state
- transient form state

Never treat client storage as authoritative booking or catalog state.

## Communications

Chat, WhatsApp, SMS, email, and other outbound actions must pass Communications policy, consent, authorization, and idempotency controls.

AI can draft a message but cannot send it directly.

## Personalization

Prefer explicit preferences and observable interactions.
Do not silently infer sensitive attributes.
Do not turn sensitive/medical information into durable preference memory without explicit, appropriate controls.

## Localization

All customer surfaces must support:

- RTL/LTR
- locale-aware text
- timezone
- currency
- localized numbers
- Jalali/Gregorian adapters

Canonical backend timestamps remain UTC.

## Trust and Safety

Show meaningful verification/trust indicators.
Sponsored results, if introduced, must be clearly labeled and can never override hard eligibility.
Provider and AI content is untrusted and must be safely rendered.

## Medical UX

Use language such as matching, information, scheduling, and provider-published content.
Do not present Phoenix AI as a diagnosing, prescribing, or treatment-recommending system.

## Accessibility

Every customer surface must support keyboard navigation, semantic controls, focus states, screen readers, responsive layouts, contrast, and reduced-motion preferences where applicable.

## Async UX

Every async flow needs explicit loading, empty, partial, error, retry, permission-denied, and unavailable states.

## Security

Enforce authentication, tenant context, object-level authorization, privacy/consent policy, input validation, output safety, and safe rendering.

Never trust client-provided authorization claims or object ownership.

## Performance

Keep page-oriented APIs/BFF composition efficient.
Avoid unnecessary waterfalls.
Use scoped caching and event/version invalidation.
Do not sacrifice authorization or freshness for performance.

## Testing

Cover:

- authorization and tenant isolation
- natural-language intent mapping
- empty/no-match behavior
- stale availability
- booking confirmation authority
- communication consent
- localization/RTL/Jalali
- accessibility
- responsive behavior
- cache scoping
- error/retry states
- medical safety boundaries

## Definition of Done

A customer feature is done only when its owning domain contract is respected, security and policy are enforced, all important UI states exist, localization/accessibility are covered, and no client-side state becomes a hidden source of truth.