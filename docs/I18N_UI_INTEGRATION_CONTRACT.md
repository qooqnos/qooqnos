# I18n UI Integration Contract

## Status

Canonical contract for connecting the shared i18n package to the application UI.

## Canonical terminology

The UI translation dictionary is presentation-level, but its domain terminology is derived from the canonical architecture vocabulary. In particular:

- docs/CANONICAL_DOMAIN_DICTIONARY.md is the authoritative terminology source.
- docs/DATA_MODEL_RECONCILIATION.md resolves concept boundaries and forbidden synonym collapse.
- docs/DATABASE_MODEL.md and docs/PHYSICAL_SCHEMA_BLUEPRINT.md define the persisted meaning of domain concepts.

The locale dictionaries expose these concepts under the canonical.* namespace. UI convenience labels may reference these terms, but must not redefine them with module-specific synonyms.

Examples: Business is not Provider; Offering is not Service; Booking is not Appointment; Permission is not Entitlement; Recommendation is not authoritative domain state.

## Locale resolution

Priority is:
1. authenticated user's saved locale
2. persisted client locale
3. browser locale
4. project default (`fa`)

Supported locales: `fa`, `en`, `ar`.

## Document direction

- `fa` → `dir="rtl"`
- `ar` → `dir="rtl"`
- `en` → `dir="ltr"`

The application shell owns the document-level direction. Individual components must not independently decide the global direction.

## UI rule

All user-visible strings must resolve through the shared i18n dictionary. Components must not contain duplicated translations or language-specific business text.

Navigation, forms, validation, errors, notifications, status labels, empty states, accessibility labels, metadata labels and administrative UI follow the same contract.

## Language switching

A language switch must:
- validate the locale against the supported registry;
- persist the user preference when authenticated;
- persist a client preference for guests;
- update the active dictionary without duplicating UI implementations;
- update document direction and language metadata;
- preserve the current route and user state where possible.

## Server/client boundary

Server-rendered output must use the resolved locale for the request. Client hydration must use the same resolved locale to avoid translated-content or direction mismatches.

## Source of truth

The i18n registry and locale dictionaries are the sole translation source. UI packages consume them; they do not own alternate dictionaries.

## Domain/API rule

Canonical domain values remain language-neutral identifiers. Localization occurs at presentation boundaries. APIs must not persist translated labels as domain identifiers.

## Completion gate

UI integration is complete only when the application shell, navigation, forms, system messages and error presentation all consume this contract and changing locale changes the complete visible interface and document direction.
