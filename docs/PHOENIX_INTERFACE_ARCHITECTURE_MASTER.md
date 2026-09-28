# Phoenix — Interface Architecture Master Specification

Status: Canonical implementation specification
Date: 2026-09-28
Primary basis: supplied Phoenix UI reference image + Phoenix product proposal (qnws.pdf).

## 1. Purpose

This document turns the supplied Phoenix interface reference into an implementation-ready architecture. It defines the visual system, screen hierarchy, navigation, reusable components, states, responsive behavior, RTL rules, customer journeys, business workspace composition, vertical/occupation behavior and coding order.

Phoenix must be implemented as one coherent product. A clinic, shoe store, restaurant or salon may expose different modules and workflows, but they must share the same Phoenix shell, brand language, design tokens and capability-driven architecture.

## 2. Product Model

The proposal describes Phoenix as an intelligent assistant for real businesses. It accepts simple inputs such as image, audio, video, text, idea, product, service, request or question and turns them into actionable outcomes such as content creation/improvement, finding relevant customers, pricing, advertising, export or transaction.

Core product loop:

Understand Demand → Understand Supply → Decide → Match → Connect → Act → Learn

The proposal also defines three layers:

1. Content — raw image, audio, video, text, idea, product or service.
2. Processing — creation, editing, analysis, pricing, advertising and export.
3. Transaction — buying, selling, renting, exchange, auction and tender.

UI consequence: the interface should feel like Input → Understand → Suggest → Choose → Connect → Act, not Dashboard → Menu → Find Feature.

## 3. Experience Families

### Individual / real user
Home, Ask Phoenix, My Content, Suggestions, Transactions, Notifications and Profile.

### Organization / business
Organization identity, legal/business profile, brand, teams, roles, access, content/supply, products/services, customers/leads, negotiations, reporting, performance and customization.

### End consumer
Search → Suggestions → Review → Negotiate → Pay/Agree → Result.

These are presentation modes over shared Phoenix capabilities, not separate applications.

## 4. Visual Identity — Phoenix

The supplied image is a visual system, not merely a screen layout. Its key characteristics are:

- Phoenix orange as the primary action/accent.
- Warm white/cream application surfaces.
- Strong charcoal/black text.
- Cinematic Phoenix artwork for brand moments.
- Large rounded cards and controls.
- Soft, low-contrast shadows.
- Generous whitespace.
- Compact icon-and-label action tiles.
- Large orange rounded/pill CTAs.
- Mobile bottom navigation.
- Phoenix mark/avatar inside assistant experiences.
- Product/service imagery as an important part of the interface.
- Calm, premium, friendly and modern visual tone.

Orange is an action/focus color. It must not flood every component.

## 5. Brand Surfaces

### Brand / splash mode
Use dark cinematic Phoenix artwork, orange/gold light, white Phoenix wordmark and a single strong orange CTA. This is for welcome/splash/emotional brand moments.

### Application mode
Use warm neutral background, white/near-white cards, dark text, orange action states and subtle shadows.

Do not make the whole application dark merely because the splash screen is dark.

## 6. Design Tokens

All colors, spacing, radii, typography and shadows must be centralized. Pages must not invent their own visual values.

Required semantic token families:

- primary / primary-soft / primary-strong
- gradient-start / gradient-end
- page / card / elevated / muted / dark surfaces
- text-primary / text-secondary / text-muted / text-on-primary / text-on-dark
- border-subtle / border-default
- success / warning / danger / info
- radius-sm / radius-md / radius-card / radius-xl / radius-pill
- spacing-xs / sm / md / lg / xl
- card-shadow / elevated-shadow

The exact production color values should be calibrated against the supplied reference and canonical Phoenix brand assets; this document does not invent a final hex palette.

## 7. Typography

Persian is first-class and RTL-first.

Hierarchy:
Display → Page Title → Section Title → Card Title → Body → Secondary → Caption → Numeric/Financial → CTA.

Use strong weight for titles and important numbers, lighter weight for supporting text, and explicit formatting for mixed Persian/Latin content.

The font family must be defined centrally in the design system.

## 8. Shape and Depth

The reference uses rounded geometry throughout.

Cards: medium/large radius.
Primary CTAs: pill/large radius.
Compact controls: pill radius where appropriate.
Images: rounded corners matching their parent card.

Depth should come mainly from spacing, surface contrast and typography. Shadows are soft and restrained.

## 9. Layout and Spacing

Use a 4px base spacing rhythm with common steps around 4, 8, 12, 16, 20, 24, 32, 40, 48 and 64.

The reference intentionally leaves large quiet areas. Do not compress the interface merely to show more information.

## 10. Logo and Phoenix Mark

Phoenix has three UI roles:
1. brand identity;
2. assistant identity;
3. active/navigation identity.

Use canonical assets for the Phoenix bird. Do not approximate the bird with CSS or substitute an unrelated icon.

Recommended asset variants: full logo, mark, assistant avatar, dark-brand mark and monochrome mark.

## 11. Iconography

Use one coherent icon family. Selected/action icons use Phoenix orange; inactive icons use neutral gray/charcoal. Critical actions always retain text labels. Directional icons must respect RTL.

## 12. Imagery

Three major image classes:
- Phoenix brand imagery;
- product/service/business imagery;
- profile/avatar/cover imagery.

Use fixed aspect-ratio containers, appropriate object-fit behavior, rounded corners, lazy loading where safe, and graceful fallbacks.

## 13. Mobile Shell

The supplied reference is strongly mobile-oriented.

Standard structure:
Context Header → Page Content → Bottom Navigation.

Bottom navigation should contain at most five stable primary destinations. Temporary workflows do not belong in the bottom bar.

Reference-compatible destinations can be:
- خانه
- محتوا
- معاملات
- پیام‌ها/فعالیت
- پروفایل

The exact labels can be capability-aware while the shell remains stable.

## 14. Header System

Home header: greeting, avatar, notifications and optional context.
Detail header: back, title and optional action.
Assistant header: Phoenix mark, Phoenix name and assistant subtitle.
Business header: business identity, workspace context, role, notifications and optional workspace switcher.

Headers should remain compact and should not compete with the primary task.

## 15. Welcome / Splash

The first reference screen is a brand moment:
full-screen dark Phoenix artwork → Phoenix identity → short promise → orange CTA.

The visual message is emotional and simple: Phoenix accompanies the user's path to success.

## 16. Home

Home is the primary intelligent entry point. It must NOT look like an ERP dashboard.

Recommended composition:
1. Greeting
2. Ask Phoenix
3. Phoenix assistant/hero card
4. Quick actions
5. Today's suggestions
6. Relevant supply/activity
7. Optional personalized modules
8. Bottom navigation

The proposal explicitly defines Home around the main question, personalized suggestions and quick shortcuts.

## 17. Ask Phoenix

Ask Phoenix is the core interaction primitive.

Visual elements:
- soft input surface
- microphone
- text input
- optional media attachment
- Phoenix identity
- send action.

Prompt examples:
- «امروز دنبال چه نتیجه‌ای هستی؟»
- «چی می‌خوای انجام بدی؟»
- «چطور کمکت کنم؟»

Inputs may be text, voice, image, video, product, service or request.

## 18. Assistant Conversation

The supplied assistant screen shows Phoenix identity at the top, a short greeting, a clear question, suggested actions and a bottom composer.

Assistant responses should prefer:
Explanation → Suggested Action

Example action chips:
- متن محصول را بنویس
- قیمت را بررسی کن
- مخاطب مناسب پیدا کن
- آگهی بساز

Do not turn the assistant into a long-form chatbot when a concrete next action is available.

## 19. Quick Action Tiles

Reference actions include content upload, transaction market, services and consultation/education.

Possible capability-driven extensions:
- خرید
- فروش
- اجاره
- معاوضه
- مزایده
- مناقصه
- مشاوره
- آموزش

Each tile has icon + short label + optional short explanation.

## 20. Recommendations

Reference recommendation cards contain image, title, provider/context, price when authoritative and one clear action.

Example pattern:
پژو ۴۰۵ → فروش خودرو در شوشتر → مشاهده

Recommendation content must come from canonical Discovery/Matching capabilities. Never fabricate personalized recommendations.

## 21. Discovery / Explore / Following

Phoenix may use familiar social patterns:
- برای تو
- دنبال‌شده‌ها
- اکسپلور

But content remains primarily Phoenix supply: products, services, businesses and commercial content.

Only supported actions appear on a card: like, comment, save, compare, instant buy, book, contact, ask price, etc.

## 22. Social Commerce Card

Canonical composition:
Publisher header → media → product/service title → description → price → engagement/actions → primary transaction action.

The visual style should feel social and modern without turning Phoenix into a generic social network.

Follow/Like/Save/Comment must be persisted through the canonical Social Engagement boundary. UI must never claim persistence before API success.

## 23. Content Upload / Studio

The reference has a dedicated content upload surface with image, video, audio, service and idea options.

Content creation is an entry into the Phoenix processing layer, not merely posting to a social feed.

Distinguish raw input from published supply.

## 24. AI Content Creation

Implementation flow:
Upload → AI interpretation → draft/proposed fields → user review → edit → accept → publish/save.

AI may propose title, description, category, attributes, price suggestion, media enhancement and audience/process suggestions.

AI must not silently publish authoritative business information.

## 25. My Content

Content list cards should show thumbnail, title, type, created time, process status and next recommended action.

Possible states:
- draft
- processing
- needs review
- published
- active
- archived
- rejected
- failed.

Primary bottom action may be «+ آپلود جدید».

## 26. Suggestions

The «پیشنهادهای ققنوس» surface is a decision-support screen.

Suggestions can include process suggestions, content improvements, pricing suggestions, audience opportunities and promotion suggestions.

Every suggestion should answer two questions:
Why am I seeing this?
What can I do now?

## 27. Transactions

The reference presents a dedicated transaction surface with:
- خرید
- فروش
- اجاره
- معاوضه
- مزایده
- مناقصه
- مشاوره.

Each transaction type must open a real workflow, not merely a renamed product list.

## 28. Transaction State

Generic state model:
Draft → Submitted → Matching/Review → Negotiation → Agreement → Payment/Settlement → Fulfillment → Completed.

Specific transaction types may have different states. The UI must render the canonical backend state rather than invent transitions.

## 29. Buy Flow

Reference model:
Need → Search → Compare → Negotiate → Pay → Deliver.

Typical screens: search, results, detail, compare, negotiation if required, checkout, payment, order, fulfillment, result/review.

## 30. Sell Flow

Reference model:
Supply → Introduce → Negotiate → Agree → Pay → Complete.

Typical screens: create offer, content/product setup, price, publish, relevant audience, messages/negotiation, agreement, payment and completion.

## 31. Rent / Exchange / Auction / Tender

Rent: Request → Conditions → Selection → Contract → Payment → Return.
Exchange: Asset A + Asset B → Valuation → Agreement → Transfer.
Auction: Item → Rules → Bids → Winner → Settlement.
Tender: Need → Offers → Evaluation → Selection → Contract.

Each flow should reuse a common workflow shell.

## 32. Notifications

The reference notification center contains category tabs such as all, important, messages and transactions.

Notification cards contain icon, title, short message, relative time and optional CTA.

Examples from the reference/proposal include new message, Phoenix suggestion, financial event, transaction request and rank/status update.

Notifications must come from real event sources.

## 33. Profile

Profile is an identity + trust + activity surface, not just a personal information page.

Reference structure:
cover/hero → avatar → name/handle → verification/role → rank/progress → financial status → metrics → personal sections → bottom navigation.

Proposal-backed concepts include verified contact information, identity verification where required, account status, activity history, rank, completed processes, successful transactions, feedback and internal credit.

## 34. Profile Progress and Finance

Progress may represent real score/rank/completion data.

Financial cards may show internal credit, receivables/payables, transaction trend or credit status when authorized.

Never show decorative percentages or invented financial numbers.

## 35. Business Workspace

Business mode changes information density and capabilities while preserving Phoenix visual identity.

Business Home should answer:
- What is happening?
- What needs attention?
- What opportunity is next?
- What is the team doing?
- What is the commercial state?

Do not make the first business screen an analytics wall by default.

## 36. Business Modules

Shared module families:
- Overview
- Organization Profile
- Content
- Products
- Services
- Customers/Leads
- Messages
- Transactions
- Bookings
- Payments/Finance
- Team
- Roles/Permissions
- Analytics
- Verification
- Settings.

Only enabled and authorized modules appear.

## 37. Occupation-Specific Architecture

Do NOT create a separate dashboard application for every occupation.

Canonical composition:
Business Type → Capabilities → Modules → Role Permissions → Vertical Workflow.

Clinic example:
appointments, calendar, providers, services, availability, customers, communications, payments, content.

Shoe-store example:
products, variants, sizes, colors, inventory, orders, returns, promotions, customers, content.

Restaurant example:
menu, orders, tables, booking, kitchen, delivery, customers, payments.

Salon example:
services, specialists, schedule, appointments, customers, payments, offers.

The shell remains Phoenix; the modules and workflows make the business feel native to its occupation.

## 38. UI Capability Registry

Implement a capability-driven UI registry conceptually shaped like:

UIModuleDefinition:
- id
- label
- icon
- requiredCapabilities
- requiredPermissions
- route
- mobilePriority
- dashboardSlot.

Example: booking.manage → Booking module → business/bookings → booking widget → customer Book CTA.

Example: catalog.product.manage → Product module → business/products → product widget → Create Product CTA.

The actual implementation should integrate with the existing Phoenix runtime/module architecture rather than create a second capability system.

## 39. Role-Aware Business UI

Owner: overview, finance, team, analytics, settings and enabled operational modules.
Sales: customers, leads, products, messages and transactions.
Specialist: services, schedule, appointments and customer-facing profile.
Finance: payments, transactions and reports.

Role affects navigation and UX. Server-side authorization remains authoritative.

## 40. Shared Component System

Shell: AppShell, MobileShell, BusinessShell, Header, BottomNav, Sidebar, WorkspaceSwitcher.
Brand: PhoenixLogo, PhoenixMark, PhoenixAssistantAvatar, PhoenixBrandHero.
Navigation: TabBar, SegmentedControl, Breadcrumb, BackButton.
Content: ProductCard, ServiceCard, BusinessCard, ContentCard, RecommendationCard, TransactionCard.
Assistant: AskPhoenix, AssistantMessage, SuggestedAction, ActionChip, PromptList.
Commerce: PriceBlock, CompareButton, InstantBuyButton, BookingButton, CheckoutSummary.
Business: ModuleCard, MetricCard, QueueCard, TeamCard, StatusBadge, ActivityList.
Feedback: Toast, Alert, EmptyState, LoadingState, ErrorState, ConfirmDialog.

Build primitives before duplicating pages.

## 41. Component State Contract

Every interactive component must define default, hover, focus, pressed, selected, disabled and loading states. Data components additionally require success, error and empty states.

Mutation lifecycle:
idle → submitting → success
or validation error / authorization error / conflict / provider error.

Never convert a failed mutation into a success-looking UI.

## 42. Button System

Primary: Phoenix orange filled rounded/pill button.
Secondary: light/white surface.
Tertiary: text/icon.
Destructive: semantic danger.

Use one dominant primary CTA per card/screen when possible.

## 43. Card System

Required variants:
- Card
- CardInteractive
- CardHero
- CardRecommendation
- CardTransaction
- CardMetric
- CardAssistant
- CardMedia
- CardProfile
- CardStatus.

Card hierarchy: Title → Context → Data → Action.

## 44. Input System

Types: text, textarea, search, amount, date, time, select, file, image, voice and location.

Inputs must be RTL-safe, accessible and visually consistent with the soft Phoenix surface language.

## 45. Responsive Architecture

Mobile: one column, bottom navigation, large touch targets, short labels, compact cards and fixed primary CTA where useful.

Tablet: adaptive two-column layouts.

Desktop: sidebar, wider content canvas, optional right rail, multi-column operational layouts and persistent compare/action trays.

Do not simply stretch the mobile layout.

## 46. RTL / Persian

Use logical CSS properties such as margin-inline, padding-inline and inset-inline. Avoid hard-coded left/right assumptions.

Handle Persian/Latin mixed strings, localized numbers, currency and locale-aware dates/times. The visual system must be RTL-first rather than an LTR design mirrored at the end.

## 47. Accessibility

Definition of Done includes semantic HTML, keyboard navigation, visible focus, screen-reader labels, sufficient contrast, touch target sizing, reduced motion, correct form error association and logical RTL reading order.

## 48. Motion

Motion should communicate state rather than decorate the interface.

Use subtle transitions for page changes, card press, selected tabs, loading, success and assistant responses. Respect prefers-reduced-motion.

## 49. Empty / Loading / Error

Every major list must have a meaningful empty state that answers what is empty, why it matters and what to do next.

Use layout-preserving skeletons for loading.

Errors should state what failed, whether data was preserved and whether retry is possible.

Never expose raw technical errors as the primary user message.

## 50. Trust, Privacy and Security

The proposal explicitly requires separation of public/private data, access control, transparent notification/data use, secure login, session management, suspicious-activity warnings, transparent transaction states, buyer/seller role separation, dispute handling, content reporting and verification status.

UI hiding is not authorization. Every mutation must be protected by the server.

## 51. AI UX Safety

AI can understand intent, summarize, suggest, classify, enrich, draft and assist discovery.

For side effects use:
Suggestion → Preview → User Review → Confirmation → Canonical Command → Result.

AI must not silently publish supply, make payments, book consequential appointments, send consequential messages, approve verification or alter financial truth.

## 52. Medical Vertical

Clinic UI may expose provider profile, services, availability, booking, organization information and contact.

Sensitive medical information needs stricter access control.

Phoenix must not present AI as diagnosing, prescribing or deciding medical treatment.

## 53. Routes

Customer examples:
/
/discover
/discover?tab=following
/discover?tab=explore
/compare
/product-studio
/profile
/activity
/notifications
/checkout
/orders
/messages

Business examples:
/business
/business/profile
/business/content
/business/products
/business/services
/business/customers
/business/messages
/business/transactions
/business/bookings
/business/team
/business/finance
/business/analytics
/business/settings

Occupation-specific UX should normally compose these canonical routes rather than duplicate the entire route tree.

SPA navigation must preserve query strings and hashes when they represent state.

## 54. State Ownership

Server state: products, transactions, bookings, notifications, profiles, business modules and social activity.
UI state: open modal, selected tab, temporary input, filters and compare selection.
Persistent client preference: theme, locale and safe display preferences.

Never use localStorage as the authoritative source for domain truth.

## 55. Compare

One selected item: selection visible.
Two to four: sticky/visible Compare control.
More than four: block new selection.

Comparison facts must come from canonical product/service data. Missing facts must be shown as unavailable, not invented.

## 56. Social State

Follow/Like/Save/Comment use the canonical Social Engagement APIs. Submit → confirm success → update UI → truthful feedback.

Do not create a second frontend persistence model for social engagement.

## 57. Activity

Activity should use canonical event sources. Do not synthesize fake activity to populate a screen.

Visual structure: category tabs → activity cards → timestamp → optional CTA.

## 58. Business Dashboard Composition

Business Context → Enabled Capabilities → Role Permissions → Attention/Priority → Dashboard Modules → Widgets → Actions.

Clinic widgets may prioritize today's appointments, availability, services and messages.
Retail widgets may prioritize today's sales, low stock, orders and products.
Restaurant widgets may prioritize current orders, reservations, kitchen queue and tables.

Visual density can increase in operational mode while the brand language remains unchanged.

## 59. Cross-Surface Continuity

Customer journey example:
Home → Ask Phoenix → Discovery → Product/Service → Compare → Decision → Instant Buy/Book → Checkout/Payment → Order/Booking → Result.

Business journey example:
Business Workspace → Product Studio → AI enrichment → Seller review → Publish → Discovery → Customer interaction → Order/Booking → Business activity.

Context must not be lost when moving between these surfaces.

## 60. Anti-Patterns

Never:
- make Home look like ERP;
- create a separate frontend application per occupation;
- duplicate product/service models;
- create a second checkout;
- create fake social persistence;
- fabricate recommendations, activity, inventory or availability;
- hard-code authorization in UI;
- show booking when unsupported;
- show buying when unsupported;
- let AI silently perform consequential actions;
- expose private business/customer data;
- invent page-specific colors or card styles;
- overcrowd mobile;
- treat the reference as a pixel-copy instead of a system.

## 61. Definition of Done

A UI slice is complete only when it:
- follows Phoenix visual language;
- uses centralized tokens;
- reuses shared components;
- uses canonical APIs;
- does not duplicate domain truth;
- implements loading/empty/error/success states;
- works on mobile/tablet/desktop;
- is RTL-safe;
- is accessible;
- provides truthful action feedback;
- respects permissions;
- confirms consequential AI side effects;
- has a clear primary action;
- avoids unnecessary dashboard density.

## 62. Coding Order

1. Audit current CSS/component architecture.
2. Extract Phoenix design tokens.
3. Normalize AppShell/MobileShell/BusinessShell.
4. Implement Phoenix brand assets and assistant identity.
5. Rebuild Home visual layer.
6. Rebuild Ask Phoenix.
7. Normalize cards/buttons/inputs/navigation.
8. Apply visual system to Discovery/Social Commerce.
9. Apply to Compare/Product/Service detail.
10. Apply to Notifications/Profile/Transactions.
11. Build Business Workspace shell.
12. Implement capability-driven module navigation.
13. Add vertical composition registry.
14. Implement clinic/retail/restaurant/salon modules incrementally.
15. Run responsive/RTL/accessibility verification after every slice.
16. Run end-to-end customer and business journeys.

## 63. Final Product Rule

Build one Phoenix interface system, not many dashboards.

Change the composition according to identity, capability, role and business type while preserving the same visual language and canonical domain boundaries.

The desired result is that a clinic feels like a clinic, a shoe store feels like a shoe store, and a restaurant feels like a restaurant — while all three unmistakably feel like Phoenix.

## Appendix — Reference Screen Inventory

Recognizable reference screens include:
- Phoenix brand/splash;
- individual Home;
- Phoenix assistant;
- notifications;
- content upload;
- My Content;
- Phoenix Suggestions;
- Transactions;
- Profile;
- product/recommendation content;
- financial/status content;
- business-oriented workspace patterns.

The proposal additionally establishes organization registration, legal/business profile, brand, team/role/access management, content and supply management, customer/lead management, negotiation, reporting, performance and customization as business capabilities.

## Appendix — Source Alignment

The product proposal states that Phoenix should simplify complex work, suggest the next path and help teams decide and execute faster; that it is customizable to business needs; that inputs can be image/audio/video/text/idea/product/service/request; and that each recommendation should end in a practical action.

The proposal also defines individual Home, My Content, Profile, Notifications and Transactions; organization/business management; consumer search/suggestion/review/negotiation/payment/result; multiple transaction types; trust/security/privacy; and staged product development.

This interface specification preserves those concepts and adds the implementation-level visual architecture needed to code them consistently.

## Business Workspace Module Routing Contract — 2026-09-28
Business occupation modules use stable semantic routes of the form `/business/workspace/<vertical>/<module>`. The vertical is a capability composition key (`clinic`, `retail`, `restaurant`, `salon`, or `default`); the module segment is a registry-owned stable slug, not a localized label. Legacy query navigation `/business?vertical=...&module=...` remains accepted as an entry point, but new module navigation should emit the stable path.

The route identifies presentation context only. Domain ownership, authorization, source-of-truth and mutations remain in the canonical Business, Catalog, Booking, Customer, Commerce, Communication, Billing, Promotion, Trust and Operations boundaries. A module page must never infer permissions from route visibility and must not create a parallel domain store.


## 43. Vertical Workflow UI Framework — Canonical Contract

The business workspace uses one shared Vertical Workflow UI Framework across clinic, retail, restaurant and salon. A vertical module is a presentation/composition layer over an existing domain capability; it is not a second backend model.

Each module definition provides:

- layout class: command, calendar, catalog, people, commerce, operations or communication;
- interaction mode: command, browse, configure or review;
- three foundation blocks that identify the module context, its canonical source and its connected surfaces;
- a primary canonical action when one exists;
- a shared UI state contract: connected, requires-input, readonly, unavailable.

The four verticals reuse the same shell, navigation and state language while composing different module blueprints. Unsupported capabilities remain explicit and do not receive fabricated metrics, mock records or parallel state.

Canonical vertical composition remains:

Business Type → Capability → Module Blueprint → Role/Permission → Canonical Workflow

The module page therefore answers four UI questions before showing operational data: what is this surface, what source owns its truth, what action can the user take, and what states can the UI honestly represent.
