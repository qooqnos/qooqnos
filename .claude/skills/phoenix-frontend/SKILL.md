# Phoenix Frontend Skill

## Purpose

Implement and review Phoenix UI according to `docs/FRONTEND_DESIGN_SYSTEM_UI_ARCHITECTURE.md`.

## Rules

- Use the shared design system and semantic tokens.
- Customer, Partner, Admin and Internal experiences share primitives but may have distinct navigation.
- RTL/LTR, Persian localization, Jalali presentation and theme switching are first-class.
- Server authorization is authoritative; hiding a UI action is never a security control.
- Server state, UI state and durable explicit preferences remain separate.
- BFF composition may aggregate module data but cannot become a second source of truth.
- AI-generated actions require preview/confirmation where side effects exist.
- Never fabricate unavailable price, availability, verification or medical information.
- Private/tenant-restricted data must not leak through caches, SEO metadata or analytics.
- Every important screen handles loading, empty, error, retry, forbidden and unavailable states.
- Accessibility and responsive behavior are part of Definition of Done.

## Completion Criteria

Verify typed API usage, responsive layouts, light/dark themes, RTL/LTR, localization, accessibility, security-aware UX, component tests and relevant E2E journeys before completion.
