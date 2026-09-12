# Phoenix Frontend / Design System / UI Architecture

## 1. Purpose

Phoenix needs one coherent product experience across Customer, Business/Partner, Admin and Internal Operations without creating separate frontend architectures.

The UI is a presentation and orchestration layer. Domain truth, authorization, policy and transactions remain server-side.

## 2. Core Principles

1. One shared design system.
2. Separate experiences, shared primitives.
3. Responsive by default.
4. RTL/LTR is a first-class capability.
5. Theme switching is a first-class capability.
6. Accessibility is part of Definition of Done.
7. Server state is distinct from UI state.
8. BFF/composition may aggregate data but cannot become a second domain source of truth.
9. UI permissions are for UX; server authorization is authoritative.
10. AI interaction must remain explainable and bounded by server policy.

## 3. Experience Architecture

```text
Phoenix UI Shell
├── Customer Experience
├── Partner / Business Experience
├── Platform Admin
└── Internal Operations

Shared
├── Design System
├── Navigation
├── Forms
├── Tables
├── Feedback
├── AI Interaction Components
├── Localization
├── Accessibility
└── Security-aware primitives
```

These experiences may have different navigation and information architecture while sharing the same visual language and technical foundations.

## 4. Application Shell

The shell owns:

- global navigation
- authentication/session state presentation
- workspace context
- locale
- direction
- theme
- notifications entry point
- responsive layout
- global search entry point
- account menu
- error boundary
- loading boundary

The shell must not own business rules belonging to domain modules.

## 5. Route Architecture

Use explicit route groups:

```text
/
/discover
/offers/:id
/businesses/:id
/bookings
/account

/partner
/partner/profile
/partner/catalog
/partner/availability
/partner/bookings
/partner/customers
/partner/communications
/partner/analytics
/partner/team

/admin
/admin/verification
/admin/moderation
/admin/tenants
/admin/modules
/admin/security
/admin/audit
/admin/operations
```

Actual route names may evolve, but access must be protected by server authorization and route-level capability checks.

## 6. Module UI Extensions

Modules may register:

- routes
- navigation entries
- dashboard widgets
- detail-page panels
- actions
- settings sections
- AI interaction surfaces

The Runtime/module registry remains the source of enabled capabilities.

A disabled module must not leave active navigation or executable UI actions.

## 7. Design System Layers

### Foundation

- typography
- spacing
- sizing
- radius
- elevation
- motion
- breakpoints
- iconography

### Primitives

- Button
- Input
- Select
- Checkbox
- Radio
- Switch
- Badge
- Avatar
- Tooltip
- Dialog
- Drawer
- Tabs
- Dropdown

### Composition

- Form sections
- Data tables
- Cards
- Filters
- Empty states
- Pagination
- Command/search palette
- Timeline
- Status panels
- Dashboard cards

### Domain-aware patterns

Domain patterns may consume module contracts but must not duplicate domain logic.

## 8. Theme Architecture

Support at least:

- light
- dark
- system

Theme preference is presentation state.

No business rule may depend on theme.

Avoid hard-coded colors throughout feature components. Use semantic design tokens.

## 9. Color and Semantic Tokens

Use semantic tokens such as:

```text
background
foreground
muted
surface
border
primary
secondary
success
warning
danger
info
focus
```

Components consume semantic tokens rather than raw values.

## 10. Typography

Typography must support Persian and Latin content without layout instability.

Test:

- Persian headings
- mixed Persian/English text
- numbers
- long business names
- long translated strings
- truncation/overflow

## 11. RTL / LTR

Direction is determined by locale/application context, not individual developer assumptions.

Avoid CSS/layout patterns that hard-code left/right semantics when logical properties are available.

Prefer:

```text
margin-inline
padding-inline
inset-inline
border-inline
text-align: start/end
```

Icons that communicate direction must be direction-aware where appropriate.

## 12. Localization UI

The UI must support:

- translated labels
- locale-specific dates
- Jalali presentation
- Gregorian presentation
- timezone display
- currency formatting
- localized numbers
- pluralization
- fallback locale

Domain timestamps remain canonical and are localized at presentation boundaries.

## 13. Accessibility

Target WCAG 2.2 AA-level practices where applicable.

Required patterns:

- keyboard navigation
- visible focus
- semantic HTML
- accessible labels
- error association
- sufficient contrast
- reduced motion support
- screen-reader-friendly status updates
- accessible dialogs/drawers
- no color-only meaning

Accessibility tests belong in component and E2E suites.

## 14. Responsive Architecture

Design for:

- mobile
- tablet
- desktop
- wide desktop

Customer experiences should be mobile-first where appropriate.

Admin/partner workflows may prioritize desktop while remaining usable on smaller screens.

Do not create separate business logic for mobile and desktop.

## 15. State Management

Separate state into:

### Server state

Authoritative remote data:

- offers
- bookings
- availability
- business profile
- permissions
- notifications

### UI state

Transient presentation:

- dialog open state
- filters not yet submitted
- selected tab
- expanded rows
- temporary draft input

### Durable user preferences

Explicit preferences such as:

- language
- theme
- display settings

AI-derived assumptions must not silently become durable UI preferences.

## 16. Data Fetching

Prefer typed API clients generated or derived from server contracts.

UI components should not construct raw database queries or provider calls.

Use request cancellation and stale-response protection for search/autocomplete.

## 17. BFF / Composition Layer

A BFF may compose data for screens requiring multiple modules.

Example:

```text
Customer Discovery Page
 -> Discovery
 -> Catalog
 -> Reviews
 -> Media
 -> Availability snapshot
```

The BFF may compose but must not duplicate ownership or bypass module services.

## 18. Loading / Error / Empty States

Every important screen must define:

- initial loading
- partial loading where appropriate
- empty
- error
- retry
- unauthorized
- forbidden
- unavailable/stale
- offline/degraded where relevant

Never show fabricated business data while a source is unavailable.

## 19. Forms

Forms should use:

- typed schemas
- client-side validation for UX
- server-side validation as authority
- field-level errors
- submission state
- duplicate-submit protection
- unsaved-change handling where necessary

Client validation must never replace authorization or domain validation.

## 20. Customer AI UX

The AI search experience should expose enough interpretation to build trust.

Example:

```text
User: "یه سالن خوب برای رنگ مو نزدیک من، حدود ۲ میلیون"

Understood:
- Service: hair coloring
- Location: current selected area
- Budget: approximately 2,000,000
- Quality preference: high
```

The UI may allow users to edit interpreted constraints before search.

AI responses must distinguish:

- verified/current data
- recommendations
- general information
- unavailable/unknown information

## 21. AI Actions UX

For side-effecting AI actions such as booking or messaging:

```text
Intent
 -> Preview
 -> Show material details
 -> User confirmation
 -> Server authorization
 -> Domain command
 -> Result
```

The browser must never treat an AI-generated action as already executed.

## 22. Trust Signals

Use consistent visual indicators for:

- verified business/provider
- published offer
- availability freshness
- review/reputation signals
- sponsored placement if introduced
- AI-generated summaries where relevant

Trust indicators must correspond to authoritative server data.

## 23. Medical UX Boundary

Medical experiences must never present Phoenix AI as a diagnostic or treatment authority.

The UI must not encourage:

- diagnosis
- prescription
- treatment recommendation
- medication recommendation

Allowed experiences include provider/service discovery, matching, provider-published information, contact and scheduling.

## 24. Dashboard Architecture

Partner and Admin dashboards should use reusable:

- KPI cards
- data tables
- filters
- detail drawers
- timeline panels
- approval queues
- status badges
- audit views

Dashboard read models may be optimized for UI but remain derived from authoritative modules.

## 25. Security-Aware UI

Hide or disable actions when the actor lacks capability for UX clarity, but assume a malicious client can call the API directly.

Every mutation must be protected server-side.

Sensitive values should be masked by default in privileged interfaces and revealed only when policy permits.

## 26. Performance

Initial UI targets:

- fast application shell
- route-level code splitting
- lazy-load heavy modules
- optimized media
- avoid unnecessary client hydration/work
- cache safe public assets
- cancel obsolete search requests
- virtualize large tables/lists where useful

Customer shell target: p95 <1.5s where practical.

## 27. SEO / Public Marketplace

Public discovery and business/offer pages should be designed for crawlability where appropriate.

Do not expose private or tenant-restricted information through SEO metadata, previews or cached responses.

## 28. Observability

Capture frontend telemetry for:

- route performance
- API latency
- client errors
- failed actions
- search interactions
- booking funnel steps
- accessibility regressions where tooling supports it

Do not send sensitive/medical content to generic frontend analytics.

## 29. Component Testing

Every reusable component should have:

- normal state
- loading where applicable
- error where applicable
- keyboard interaction
- RTL test where relevant
- dark/light theme test where relevant
- accessibility test

## 30. E2E UI Coverage

Critical E2E paths must exercise real permissions and server state rather than mocked authorization.

At minimum cover:

- customer discovery
- offer inspection
- contact
- booking
- partner onboarding/catalog
- availability
- booking management
- admin verification
- moderation
- permission denial
- tenant isolation

## 31. Frontend Package Boundary

Recommended structure:

```text
apps/web/
packages/ui/
packages/design-tokens/
packages/i18n/
packages/api-client/
packages/frontend-auth/
packages/frontend-analytics/
```

Domain-specific UI belongs close to its module while consuming shared primitives.

## 32. Definition of Done

A UI feature is complete when:

- responsive states are implemented
- light/dark themes work
- RTL/LTR is correct where relevant
- localization is complete
- accessibility checks pass
- server authorization is respected
- loading/error/empty states exist
- API contracts are typed
- analytics/privacy rules are respected
- unit/component tests exist
- relevant E2E coverage exists
- performance is acceptable
- no domain logic is duplicated in the UI
