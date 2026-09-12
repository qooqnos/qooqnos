# Phoenix Localization / Country Policy Skill

## Purpose

Implement and review localization, internationalization, country, legal, consent, calendar, currency, and regulated-industry work according to `docs/LOCALIZATION_I18N_COUNTRY_LEGAL_ARCHITECTURE.md`.

## Non-Negotiable Rules

- Core marketplace behavior must remain country-agnostic.
- Do not scatter country/language conditionals through domain services.
- Locale and country are separate concepts.
- RTL/LTR are first-class UI capabilities.
- Canonical timestamps remain UTC; local timezone is explicit.
- Calendar conversion, including Jalali, is presentation/domain-format adaptation.
- Money uses integer minor units plus ISO currency; never floating-point financial state.
- Legal and regulated decisions are policy-driven and versioned.
- Consent is purpose-specific and auditable when required.
- Medical safety invariants cannot be weakened by country adapters.
- Localized AI output must not silently alter authoritative facts.

## Context Contracts

Prefer shared typed contracts such as:

- `LocaleContext`
- `MarketContext`
- `PolicyContext`
- `MoneyFormatter`
- `CalendarAdapter`
- `TranslationService`

## Persian Requirements

Support Unicode normalization, Persian/Arabic character variants, ZWNJ, RTL, Persian presentation digits where appropriate, Jalali presentation, and search-safe normalization while preserving original display text.

## Completion Criteria

Verify translation fallback, RTL/LTR rendering, timezone/DST behavior, Jalali boundaries, currency formatting, country-policy versioning, consent enforcement, medical restrictions, authorization scope, and absence of scattered jurisdiction logic.
