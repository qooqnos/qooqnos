# Phoenix Localization / Internationalization / Country & Legal Architecture

## 1. Purpose

Phoenix is international by architecture, not by later translation.

The Core Marketplace must remain stable while language, direction, timezone, currency, calendar, country rules, regulated-industry requirements, and local legal constraints vary by market.

The central rule is:

> **Core defines marketplace behavior; adapters define market-specific behavior.**

## 2. Separation of Concerns

```text
Phoenix Core
  ├── Identity
  ├── Catalog
  ├── Discovery
  ├── Booking
  ├── CRM
  ├── Communications
  ├── Reviews
  ├── Billing
  └── AI

Adapters
  ├── Locale / Language
  ├── Direction
  ├── Timezone
  ├── Currency / Money
  ├── Calendar
  ├── Country
  ├── Legal / Privacy
  └── Regulated Industry
```

Core modules must not contain scattered country-specific `if/else` logic.

## 3. Locale Model

A locale represents language and regional presentation.

Examples:

- `fa-IR`
- `en-US`
- `ar-SA`
- `tr-TR`

Locale configuration can define:

- language
- script
- text direction
- number formatting
- date formatting
- default calendar presentation
- pluralization rules
- localized content fallback

Locale is not the same as country.

## 4. Direction / RTL

The UI must support LTR and RTL as first-class modes.

Rules:

- use logical CSS properties rather than left/right assumptions
- icons with semantic direction must be mirrored appropriately
- numeric identifiers and codes must remain readable
- mixed Persian/Latin/Arabic content requires Unicode-safe rendering
- layouts must be tested at both directions

RTL is a system capability, not a theme hack.

## 5. Translation Architecture

Translation keys belong to product/domain concepts, not individual screens.

Recommended structure:

```text
module
  locale
    namespace
      key
```

Example:

```text
booking.confirmed.title
booking.cancelled.title
catalog.service.duration
```

Never use translated display text as a programmatic identifier.

## 6. Translation Rules

Translations must support:

- pluralization
- interpolation
- gender where linguistically required
- contextual variants
- long/short labels
- accessibility labels
- validation/error messages
- system notifications
- AI-generated localized explanations

Missing translations must have deterministic fallback behavior.

User-visible raw translation keys are a defect except in controlled development environments.

## 7. Content Localization

Static UI strings and business-generated content are different.

Business content may have:

- original language
- translated versions
- translation status
- translator/provider source
- content version
- review state

AI translation is assistive. It must not silently alter authoritative business facts such as price, credential status, opening hours, or medical claims.

## 8. Country Context

Country context should be explicit:

```text
country_code
market_code
legal_profile
currency_profile
timezone_profile
locale_profile
```

A country adapter can control:

- supported payment methods
- tax presentation
- privacy requirements
- communication constraints
- business verification requirements
- regulated advertising rules
- required disclosures
- data residency requirements
- age/consent requirements
- industry restrictions

Country adapters must expose typed policies rather than leaking implementation details into domain modules.

## 9. Legal Policy Layer

Legal rules are policy inputs, not arbitrary frontend conditions.

Example policy contract:

```text
can_publish_offer
can_send_marketing_message
requires_explicit_consent
requires_provider_verification
requires_claim_review
allowed_data_purposes
required_disclosures
retention_policy
```

A policy decision should include:

- policy ID
- policy version
- jurisdiction
- effective date
- decision
- reason/code

## 10. Policy Versioning

Rules change over time.

Never overwrite historical decisions as if the old policy never existed.

Persist the policy version used for important decisions such as:

- verification
- regulated claim review
- consent enforcement
- publication
- billing/tax treatment
- data retention

Future policy changes should be testable before activation.

## 11. Industry Rules

Industry-specific constraints are separate from country rules.

Examples:

```text
Core Marketplace
  + Country: Iran
  + Industry: Medical

Core Marketplace
  + Country: X
  + Industry: Beauty
```

This allows the same Core to operate across countries while applying different regulatory profiles.

## 12. Medical Safety Boundary

The medical marketplace has stricter rules.

Phoenix may:

- discover verified providers
- match user needs to provider/service information
- summarize provider-published information
- support scheduling/contact
- organize user-provided information

Phoenix must not:

- diagnose
- prescribe
- recommend medication
- recommend treatment
- fabricate clinical claims
- activate unverified providers

Country and medical policy adapters may impose additional restrictions, but must never weaken these platform-wide safety invariants.

## 13. Currency / Money

Money remains numeric and canonical, never localized strings.

Store:

```text
amount_minor
currency_code
```

Never use floating-point values for financial state.

Formatting belongs to the locale/currency adapter.

Example presentation can differ while the underlying amount remains stable.

## 14. Currency Conversion

If multi-currency conversion is introduced:

- original amount remains authoritative
- source currency is preserved
- conversion rate/source/time are recorded
- converted amount is derived
- historical financial records are immutable

Do not silently rewrite stored money because an exchange rate changed.

## 15. Timezone

Canonical timestamps are UTC.

Every relevant business/location schedule has an IANA timezone.

Rules:

- store instants in UTC
- interpret local schedules in the location timezone
- perform date-boundary calculations in the relevant timezone
- convert to Jalali/Gregorian only for presentation/reporting
- test DST transitions

## 16. Calendar Adapter

Calendar is a presentation/domain-format adapter, not a replacement for canonical timestamps.

Supported architecture should allow:

- Gregorian
- Jalali/Persian
- future calendars if needed

A booking at an instant remains the same booking regardless of displayed calendar.

## 17. Persian Language Requirements

Persian support must include:

- Arabic/Persian character normalization
- Persian digits where presentation requires them
- ZWNJ handling
- half-space-safe search/indexing
- diacritic tolerance where useful
- RTL layout
- Persian plural/context rules
- Jalali date presentation

Search normalization must not destroy the original display text.

## 18. Number / Formatting

Formatting should be adapter-driven for:

- decimal separators
- grouping separators
- digits
- percentages
- distances
- durations
- phone-number presentation
- currency

The canonical value must remain locale-independent.

## 19. Phone / Address

Phone numbers should use canonical international representation internally where possible, while presentation follows locale.

Addresses require country-specific structures.

Do not assume every country has the same:

- administrative levels
- postal-code format
- address ordering
- state/province model

Address validation belongs behind a country-aware adapter.

## 20. Communications Localization

Communications templates are versioned and localized.

A message selection flow is:

```text
communication intent
 -> actor/tenant policy
 -> recipient locale
 -> channel capability
 -> template version
 -> localized rendering
 -> provider
```

Fallback locale must be deterministic.

Transactional and marketing consent remain separate.

## 21. AI Localization

AI should receive locale/context explicitly rather than guessing it from text when the system already knows it.

AI operations should preserve:

- input locale
- desired output locale
- country context
- terminology policy
- safety policy

AI-generated translation or rewriting must not change authoritative values.

Search and ranking should support multilingual/cross-lingual retrieval without changing domain truth.

## 22. Country / Legal Configuration

Configuration should be data-driven and versioned.

Conceptual structure:

```text
country_profiles
legal_policies
industry_policies
locale_profiles
currency_profiles
calendar_profiles
policy_versions
```

Activation requires validation and should be auditable.

## 23. No Scattered Jurisdiction Logic

Forbidden pattern:

```text
if country == "X" then ...
if language == "fa" then ...
```

inside arbitrary domain services.

Preferred:

```text
policy = policyRegistry.resolve(context)
policy.canPublishOffer(input)
```

Domain services consume stable contracts.

## 24. Data Residency / Privacy

If a jurisdiction requires regional storage or processing:

- classify affected data
- determine allowed storage/processing regions
- route through infrastructure policy
- preserve tenant isolation
- record policy version
- avoid silent cross-border transfer

Sensitive and regulated data must have stricter handling than ordinary marketplace content.

## 25. Consent

Consent is purpose-specific.

Examples:

- essential service
- analytics
- personalization
- marketing
- sensitive-data processing
- AI-assisted processing

A single generic `consent=true` flag is insufficient.

Consent state should be auditable and versioned when legally significant.

## 26. Accessibility / Localization Interaction

Localization must not break accessibility.

Test:

- RTL screen readers
- localized labels
- text expansion
- keyboard navigation
- focus order
- mixed-script content
- large text
- error messages

## 27. Testing Matrix

At minimum test combinations of:

| Dimension | Examples |
|---|---|
| Locale | fa, en, ar |
| Direction | RTL, LTR |
| Calendar | Jalali, Gregorian |
| Timezone | UTC, local, DST region |
| Currency | multiple ISO currencies |
| Country | at least multiple legal profiles |
| Industry | beauty, fashion, medical |

Critical policy combinations must have automated tests.

## 28. Module Contract

Modules should request context through a shared localization/policy interface:

```text
LocaleContext
MarketContext
PolicyContext
MoneyFormatter
CalendarAdapter
TranslationService
```

They should not instantiate country-specific implementations directly.

## 29. API / UI Behavior

API responses should return canonical values plus enough metadata for safe presentation.

Examples:

```text
amount_minor + currency
instant + timezone context
localized content + source locale
policy decision + policy version
```

The frontend must not become the only place where legal rules are enforced.

## 30. Implementation Order

1. Locale/context contracts
2. Translation infrastructure
3. RTL/LTR design-system support
4. Timezone/calendar adapters
5. Money/currency formatting
6. Country profile registry
7. Legal policy registry
8. Consent/purpose model
9. Industry policy adapters
10. Persian search/localization hardening
11. Data residency policy hooks
12. Automated localization/legal test matrix

## 31. Definition of Done

This architecture is ready when:

- Core modules contain no scattered jurisdiction logic
- locale and country are explicitly modeled
- RTL/LTR are first-class
- Persian/Jalali are supported without corrupting canonical data
- money and timestamps remain locale-independent
- legal decisions are policy-driven and versioned
- consent is purpose-specific
- medical safety invariants cannot be weakened by adapters
- partner/customer/admin views respect jurisdiction and authorization
- localized communications are versioned
- AI receives explicit locale/policy context
- privacy/data-residency hooks exist before international expansion
