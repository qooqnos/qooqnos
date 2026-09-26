
# Phoenix Master UI Product Contract

**Status:** Canonical UI/Product contract  
**Scope:** Customer, individual, organization/business, occupational/vertical, transaction, content, dashboard, navigation, responsive behavior, RTL, accessibility, states and UI composition  
**Reference:** Phoenix UI direction supplied by product design on 2026-09-26  
**Architecture:** Shared UI platform + capability-driven experiences + module-owned workflows

---

## 1. Purpose

This document is the comprehensive UI contract for Phoenix (ققنوس).

It translates the approved Phoenix product direction and the supplied multi-screen UI reference into an implementation-level UX model.

Phoenix is not a collection of unrelated dashboards and screens.

Phoenix is one intelligent decision and connection layer that presents different experiences according to:

    Actor → Identity → Context → Organization → Role → Business Type → Capabilities → Workflow → Action

The core product loop remains:

    Understand Demand → Understand Supply → Decide → Match → Connect → Act → Learn

Marketplace, Discovery, Catalog, Booking, Commerce, CRM, Billing, Content, Social Commerce and AI are supporting capabilities of that loop.

---

## 2. Design Reference Interpretation

The supplied reference is treated as a product architecture reference, not merely a visual mood board.

It presents three major experience families:

1. **کاربر حقیقی / فرد عادی** — an individual user who can express needs, discover, create content, buy/sell/trade, request consultation and manage personal activity.
2. **کاربر حقوقی / شرکت / کسب‌وکار** — an organization/business workspace with organizational identity, team management, commercial content, transactions, collaboration and operational management.
3. **کاربر نهایی / مصرف‌کننده** — a simplified consumption-oriented experience focused on discovery, decision, purchase, payment, messages, loyalty/trust and everyday convenience.

These are not three independent applications.

They are three presentation modes over shared Phoenix capabilities.

---

## 3. Master Experience Model

    Phoenix
    │
    ├── Individual Experience
    │   ├── Home / Ask Phoenix
    │   ├── Discover
    │   ├── Following
    │   ├── Explore
    │   ├── Create Content
    │   ├── Transactions
    │   ├── Messages
    │   ├── Notifications
    │   ├── Saved / Compare
    │   ├── Payments / Orders
    │   └── Personal Profile
    │
    ├── Organization / Business Experience
    │   ├── Organization Profile
    │   ├── Business Workspace
    │   ├── Overview
    │   ├── Team & Management
    │   ├── Commercial Content
    │   ├── Products / Services
    │   ├── Transactions / Requests
    │   ├── Customers / CRM
    │   ├── Communications
    │   ├── Availability / Booking
    │   ├── Finance
    │   ├── Analytics
    │   └── Settings
    │
    └── Consumer Outcome Experience
        ├── Discover
        ├── Offer / Product Detail
        ├── Compare
        ├── Buy
        ├── Book
        ├── Pay
        ├── Track
        ├── Message
        ├── Review
        └── Loyalty / Reputation

The same user may move between these modes without creating a second account.

---

## 4. Identity Model

### 4.1 Person Identity

The person is the authenticated human actor.

The person owns:

- account
- personal profile
- preferences
- saved items
- personal activity
- follows
- social engagement
- personal transactions
- notifications
- messages

The personal identity must not be confused with an organization identity.

### 4.2 Organization Identity

A business/company/clinic/store/restaurant/etc. has an organizational identity.

It owns or operates:

- business profile
- locations
- catalog
- services
- products
- availability
- commercial content
- transactions
- team
- operational configuration
- organization-level communications
- analytics

### 4.3 Membership and Role

A person can be a member of one or more organizations.

    Person
      ↓
    Organization
      ↓
    Membership
      ↓
    Role / Group
      ↓
    Permissions
      ↓
    Capabilities

The UI must never use a simple role-name check as authoritative authorization.

Frontend capability visibility is UX only. Server authorization remains authoritative.

---

## 5. Entry and Onboarding Experience

### 5.1 Welcome Screen

The first interaction should communicate the Phoenix promise:

> فقط بگو چی می‌خوای؛ ققنوس کمک می‌کند مسیر مناسب را پیدا کنی.

The welcome experience must not feel like an enterprise admin panel.

Primary CTA:

- شروع کنیم

Secondary actions may include:

- ورود
- ثبت‌نام
- تغییر زبان
- تغییر ظاهر

### 5.2 Individual Onboarding

Collect only information needed to improve the initial experience.

Potential steps:

- name/display identity
- language
- location/context when explicitly provided or permitted
- preferences
- optional profile image
- optional interests

Do not force marketplace taxonomy before the user expresses a need.

### 5.3 Organization Onboarding

Organization onboarding is separate from individual onboarding.

Minimum concepts:

- organization/business name
- business type
- industry/category
- location
- contact information
- operating information
- initial products/services
- team owner
- verification requirements
- publication state

The business may submit information before it is eligible for public publication.

---

## 6. Individual Home / Phoenix Home

### 6.1 Core Principle

The individual Home is **not a dashboard**.

It is the user's intelligent entry point into Phoenix.

Primary interaction:

> بگو چی می‌خوای؟

### 6.2 Home Structure

Recommended structure:

1. Header
2. Greeting
3. Ask Phoenix
4. Quick action categories
5. Today's suggestions
6. Recent activity
7. Following/social content where applicable
8. Contextual recommendations
9. Bottom navigation on mobile

### 6.3 Ask Phoenix

The input should support future multimodal expansion:

- text
- voice
- image
- contextual inputs

The initial implementation may expose text first.

Example:

> برای جمعه یک پزشک خوب نزدیک مرکز شهر می‌خواهم که عصر وقت داشته باشد.

Phoenix should interpret the need and route into canonical Discovery/Matching.

### 6.4 Quick Intent Actions

The reference shows direct actions such as:

- ایجاد محتوا
- خرید
- فروش
- مشاوره
- آموزش
- معاملات

These are intent/action entry points, not separate product identities.

Selecting an action should open the relevant canonical workflow.

---

## 7. Individual Navigation

The customer-facing shell should converge on a stable navigation model.

### Primary

- خانه
- اکسپلور / کشف
- ایجاد
- فعالیت / اعلان‌ها
- پروفایل

### Contextual

- دنبال‌شده‌ها
- ذخیره‌شده‌ها
- مقایسه
- سفارش‌ها
- رزروها
- پیام‌ها
- پرداخت‌ها

Mobile should prefer bottom navigation for primary destinations.

Desktop may use a sidebar or hybrid navigation.

Operational business management must not contaminate the customer navigation shell.

---

## 8. Search, Discovery and Explore

### 8.1 Search

Search accepts natural-language demand.

It must preserve the user's original intent across navigation.

Example route shape:

    /discover?q=...

Query state must survive SPA navigation.

### 8.2 Discovery Result

Each result should communicate:

- what it is
- who provides it
- relevant price if authoritative
- availability if authoritative
- trust signals where available
- why it may match the need
- available action

### 8.3 Explore

Explore is a discovery surface, not a generic social-media clone.

Content may include:

- products
- services
- business content
- creator/seller content
- relevant Phoenix recommendations

Recommendation/ranking remains a canonical backend capability.

The UI must never fabricate personalization.

### 8.4 Following

Users can follow:

- users
- businesses
- sellers/brands

Following is both a social action and a potential future preference signal.

---

## 9. Social Commerce Feed

Phoenix may use familiar social interaction patterns while keeping commercial supply as the primary content model.

### 9.1 Post Card

A product/service post may contain:

- avatar
- publisher name
- follow state
- media
- product/service title
- description
- price
- trust indicator
- like
- comment
- save
- share
- compare
- ask price
- book
- request service
- instant buy

Actions must be capability-driven.

### 9.2 Truthfulness

The UI must not claim that an action was persisted unless the canonical backend confirms success.

Presentation-only states must be explicitly labelled during development.

### 9.3 Activity

Activity is an authenticated surface backed by canonical social events.

Do not create a second synthetic timeline store in the frontend.

---

## 10. Create / Content Studio

The reference makes content creation a first-class Phoenix capability.

### 10.1 Create Entry

Create can be reached from:

- Home
- Social shell
- Business workspace
- Product/Service workflows

### 10.2 Content Types

Potential content types include:

- تصویر
- ویدئو
- صوت
- مقاله / متن
- محصول
- خدمت
- معرفی تجاری
- offer/request where supported

The exact options must come from canonical capabilities.

### 10.3 Commercial Content

A critical distinction:

A Phoenix post is not merely a social post.

It may become marketplace-ready supply.

    Raw Seller Input
      ↓
    AI Extraction / Enrichment
      ↓
    Structured Product / Service
      ↓
    Validation
      ↓
    Seller Acceptance
      ↓
    Published Supply
      ↓
    Discovery / Matching

AI-generated content remains proposed until the owning workflow accepts it.

---

## 11. Transaction Model

The reference distinguishes transaction/deal from simple buying.

Phoenix should treat transaction as a broader canonical concept.

    Transaction / Deal
    ├── Purchase
    ├── Sale
    ├── Booking
    ├── Exchange
    ├── Auction
    ├── Consultation
    ├── Collaboration
    ├── Service Request
    └── Quote / Negotiation

Not every vertical supports every transaction type.

Capabilities determine what the UI exposes.

---

## 12. Purchase Experience

### 12.1 Product Detail

Product detail should present:

- media
- title
- seller
- price
- variants
- availability
- attributes
- delivery
- warranty where authoritative
- trust/review signals where available
- compare
- save
- instant buy

### 12.2 Instant Buy

Canonical flow:

    Product
      ↓
    Options
      ↓
    Delivery
      ↓
    Payment
      ↓
    Confirmation

The UI must reuse canonical Commerce/Checkout.

No parallel checkout source of truth may be introduced.

---

## 13. Compare Experience

Compare is a first-class decision-support feature.

### 13.1 Selection

One selected product:

- selection is visible

Two or more selected:

- sticky/visible Compare control appears
- count is shown
- user can continue browsing

Maximum initial comparison size:

- 4 products

### 13.2 Comparison Surface

Compare normalized canonical facts:

- price
- brand
- category
- variants
- availability
- shipping
- warranty
- relevant attributes
- trust/reviews when available

Missing facts must be shown as unavailable/unknown, never invented.

### 13.3 Ask Phoenix in Compare

Future capability may allow:

> تفاوت اصلی این سه محصول چیست؟

or:

> برای نیاز من کدام ویژگی‌ها مهم‌تر هستند؟

Any answer must be grounded in available canonical facts and explicit user context.

---

## 14. Booking / Appointment Experience

Booking is contextual.

If a selected business/service supports booking, the UI should expose:

- رزرو
- زمان‌های موجود
- مدت
- provider/staff where relevant
- policies
- confirmation

The customer should not see booking controls for supply that does not support booking.

### 14.1 Example: Doctor / Clinic

    Doctor / Clinic
      ↓
    Services
      ↓
    Doctor / Provider
      ↓
    Available Times
      ↓
    Book
      ↓
    Confirmation

The medical UI must remain within the platform medical safety boundary.

Phoenix must not present AI as diagnosing, prescribing or recommending treatment.

---

## 15. Consultation Experience

Consultation is a supported action type.

Possible flow:

    Need
      ↓
    Consultation
      ↓
    Suitable Provider
      ↓
    Availability
      ↓
    Book / Contact
      ↓
    Consultation
      ↓
    Possible follow-up transaction

The exact workflow depends on the service capability.

---

## 16. Organization / Business Workspace

### 16.1 Core Principle

There is **one canonical Business Workspace shell**.

Do not build a separate dashboard application for every occupation.

Instead:

    Business Workspace
       ↓
    Business Type
       ↓
    Capabilities
       ↓
    Modules
       ↓
    Role Permissions
       ↓
    Vertical Workflow

### 16.2 Organization Home

The first business screen should answer:

- What needs attention?
- What happened recently?
- What should I do next?
- What is waiting for me?
- What is the status of my business?

It should not be a vanity analytics wall.

### 16.3 Core Workspace Modules

Potential shared modules:

- Overview
- Organization Profile
- Products
- Services
- Commercial Content
- Customers / CRM
- Messages
- Orders
- Bookings
- Availability
- Payments / Finance
- Reviews
- Analytics
- Team
- Permissions
- Verification
- Settings

Only authorized and enabled modules appear.

---

## 17. Occupation / Vertical Dashboard Model

This is a core Phoenix UI principle.

Every occupation can have a specialized operational experience without creating a separate frontend architecture.

### 17.1 Capability Formula

    Business Type
       +
    Business State
       +
    Enabled Modules
       +
    Role Permissions
       +
    Branch/Location
       ↓
    Dashboard Composition

### 17.2 Clinic

Example modules:

- امروز
- نوبت‌ها
- تقویم
- پزشکان
- خدمات
- مراجعان
- ساعات کاری
- پیام‌ها
- پرداخت
- محتوا
- گزارش‌ها
- تیم

Customer actions:

- مشاهده
- خدمات
- رزرو
- تماس
- پیام

Sensitive medical records require separate privacy/authorization boundaries.

### 17.3 Shoe Store

Example modules:

- فروش امروز
- محصولات
- مدل‌ها
- سایز
- رنگ
- موجودی
- سفارش‌ها
- مرجوعی
- مشتریان
- تخفیف‌ها
- محتوای محصول
- مقایسه
- گزارش فروش

Customer actions:

- مشاهده
- مقایسه
- پرسش قیمت
- خرید فوری
- ذخیره

### 17.4 Restaurant

Example modules:

- سفارش‌های امروز
- منو
- میزها
- رزرو
- آشپزخانه
- تحویل
- مشتریان
- تخفیف
- پرداخت
- گزارش

Customer actions:

- مشاهده منو
- سفارش
- رزرو
- تحویل/دریافت

### 17.5 Beauty Salon

Example modules:

- وقت‌های امروز
- خدمات
- متخصصان
- تقویم
- مشتریان
- ظرفیت
- پرداخت
- پیشنهادها
- محتوا

Customer actions:

- مشاهده خدمت
- انتخاب متخصص
- رزرو
- تماس

### 17.6 Future Verticals

The architecture must support:

- education
- automotive
- real estate
- repair/service businesses
- travel
- legal services
- professional services
- fitness
- events
- manufacturing
- wholesale
- other occupations

New verticals should normally be implemented by composing existing capabilities and adding only genuinely new workflow/domain requirements.

---

## 18. Role-Specific Business UI

The same organization may expose different navigation/actions to different members.

Example:

    Owner
    ├── Overview
    ├── Finance
    ├── Team
    ├── Analytics
    └── Settings

    Sales Manager
    ├── Customers
    ├── Orders
    ├── Products
    └── Messages

    Doctor / Specialist
    ├── Appointments
    ├── Services
    ├── Schedule
    └── Customer-facing profile

    Finance
    ├── Payments
    ├── Transactions
    └── Financial reports

This is permission-driven, not a collection of hard-coded dashboards.

---

## 19. Team and Management

The reference explicitly includes team management.

Business UI must support:

- team list
- invitations
- role assignment
- permissions
- status
- activity
- branch/location scope where applicable

Example organizational structure:

    Organization
    ├── Owner
    ├── Admin
    ├── Manager
    ├── Sales
    ├── Marketing
    ├── Finance
    ├── Specialist
    └── Staff

A role is a permission bundle, not an authorization shortcut.

---

## 20. Organization Profile

The organization profile is the public supply identity.

It may include:

- name
- logo
- cover/media
- description
- category
- business type
- locations
- opening hours
- products
- services
- portfolio
- social content
- verification/trust indicators
- reviews
- contact options
- booking/order actions

Private organizational information must never leak into the public profile.

---

## 21. Business Onboarding and Verification UI

Business onboarding must show a clear state.

Possible states:

    Draft
    Submitted
    Under Review
    Needs Changes
    Approved
    Active
    Suspended
    Archived

The UI must distinguish:

- business status
- verification status
- catalog item status

These are not one boolean.

Verification evidence is only visible to authorized users.

---

## 22. Business Content and Seller AI

Seller AI should reduce the effort required to turn raw information into quality supply.

Example:

    Upload shoe photo
           ↓
    AI identifies candidate attributes
           ↓
    Seller reviews
           ↓
    Edit price / size / stock
           ↓
    Accept
           ↓
    Product created
           ↓
    Publish
           ↓
    Discoverable

The AI must not silently publish or invent authoritative facts.

---

## 23. Customer-to-Business Connection

The connection layer is central.

Possible connection actions:

- message
- call where supported
- booking
- purchase
- request quote
- request service
- consultation
- follow
- save
- ask price

The action set is generated from canonical capabilities.

---

## 24. Messaging

Messages should clearly distinguish:

- customer ↔ business
- customer ↔ user
- transactional message
- booking message
- support message
- marketing message

Sending remains under Communications authorization and policy.

AI may draft messages but cannot silently send side-effecting messages.

---

## 25. Notifications and Activity

Notification center may include:

- new message
- booking update
- order update
- payment event
- followed business activity
- social engagement
- system notification
- required action

Activity must use canonical event sources.

Do not synthesize fake activity for visual completeness.

---

## 26. Payments

Payment UI should remain simple and contextual.

Customer:

- amount
- merchant/provider
- transaction context
- payment method
- status
- confirmation

Business:

- incoming payments
- transaction status
- refunds
- reconciliation where authorized

Billing remains canonical; UI must not duplicate financial truth.

---

## 27. Orders and Fulfillment

Customer:

    Order
      ↓
    Payment
      ↓
    Processing
      ↓
    Fulfillment
      ↓
    Delivered / Completed
      ↓
    Review

Business:

    New
      ↓
    Accepted
      ↓
    Processing
      ↓
    Ready
      ↓
    Fulfilled

Actual state is owned by Commerce/Fulfillment.

---

## 28. Reviews, Ratings and Trust

Customer-facing trust may show:

- verified status
- provider/business status
- review summary
- freshness
- availability
- published facts

Do not create fake review counts, ratings or trust badges.

Business users can view and respond to permitted reviews according to canonical Review/Trust capability.

---

## 29. Personal Profile

Personal profile should contain:

- avatar
- name
- bio where applicable
- following/followers where supported
- saved items
- posts/content
- activity
- preferences
- settings

Personal profile is distinct from organization profile.

---

## 30. Responsive Architecture

### Mobile

Priorities:

1. Ask Phoenix
2. Discover
3. Content
4. Action
5. Activity
6. Profile

Use bottom navigation for stable primary destinations.

### Tablet

Use adaptive two-column layouts where useful.

### Desktop

Use:

- sidebar navigation
- content canvas
- contextual right rail where useful
- persistent comparison/action trays

Do not simply stretch mobile layouts.

---

## 31. RTL / Persian First

Phoenix must be RTL-first for Persian while remaining fully locale-aware.

Rules:

- logical CSS properties
- no hard-coded left/right layout assumptions
- mirrored navigation where appropriate
- localized numbers
- currency formatting
- Jalali/Gregorian adapters
- locale-aware date/time
- correct icon direction for directional actions
- mixed Persian/Latin content must remain readable

Canonical storage values remain locale-neutral.

---

## 32. Visual Language

The supplied reference suggests:

- warm Phoenix orange as primary accent
- soft neutral backgrounds
- high whitespace
- rounded cards
- clear hierarchy
- large touch targets
- restrained shadows
- calm premium feel
- friendly Phoenix branding
- strong visual focus on the next action

The final implementation must use the canonical Phoenix design tokens rather than scattering hard-coded colors and spacing.

---

## 33. Component System

Shared primitives should include:

### Navigation

- AppHeader
- Sidebar
- BottomNav
- WorkspaceSwitcher
- Breadcrumbs
- Tabs

### Inputs

- AskPhoenixInput
- SearchInput
- Select
- DatePicker
- TimePicker
- FilterBar
- Upload

### Content

- ProductCard
- ServiceCard
- BusinessCard
- SocialPostCard
- MediaCard
- ProfileHeader

### Actions

- PrimaryButton
- SecondaryButton
- CompareButton
- InstantBuyButton
- BookButton
- FollowButton
- SaveButton
- ShareButton

### Feedback

- Toast
- Alert
- EmptyState
- LoadingState
- ErrorState
- ConfirmationDialog

### Business

- DashboardWidget
- CapabilityNav
- TeamTable
- PermissionMatrix
- StatusBadge
- ActivityTimeline
- QueueTable

---

## 34. Capability-Driven UI Composition

UI modules should declare their capability requirements.

Conceptual example:

    interface UIModuleDefinition {
      id: string;
      label: string;
      requiredCapabilities: string[];
      requiredPermissions?: string[];
      routes: string[];
      dashboardSlots?: string[];
    }

Example:

    booking.manage
    → Booking module
    → business workspace navigation
    → appointment widgets
    → customer booking actions

Example:

    catalog.product.manage
    → Product module
    → product dashboard
    → product creation
    → product publishing

The Runtime/module registry remains the canonical source of enabled capabilities.

---

## 35. Capability → UI Mapping

    Capability
        ↓
    Module
        ↓
    Navigation Entry
        ↓
    Page
        ↓
    Widgets
        ↓
    Actions
        ↓
    Workflow

Do not implement occupation-specific UI by copying an entire page tree.

Instead:

    Clinic
     = Business Core
     + Booking
     + Availability
     + Service
     + Team
     + Customer
     + Communication
     + Medical policy adapters

    Shoe Store
     = Business Core
     + Catalog
     + Inventory
     + Commerce
     + Customer
     + Content
     + Social Commerce

---

## 36. State Design

Every asynchronous surface must support:

- loading
- empty
- partial data
- success
- error
- retry
- unavailable
- permission denied
- stale data where applicable

For command flows:

- idle
- submitting
- success
- validation error
- authorization error
- conflict
- provider failure

Never convert a failed mutation into a success-looking UI.

---

## 37. AI UX Rules

AI can:

- understand intent
- summarize
- suggest
- classify
- enrich
- draft
- explain
- assist discovery

AI must not silently:

- authorize itself
- publish business supply
- approve verification
- make financial commitments
- book without required confirmation
- send messages without required authorization/confirmation
- fabricate facts

For side-effecting AI actions:

    Intent
      ↓
    Preview
      ↓
    Material details
      ↓
    User confirmation
      ↓
    Server authorization
      ↓
    Canonical command
      ↓
    Result

---

## 38. Medical UI Boundary

Medical business UI is a vertical composition of common capabilities plus medical policy.

Allowed:

- provider profile
- service discovery
- verified credentials where authoritative
- availability
- booking
- contact
- provider-published information
- organization management

Not allowed:

- AI diagnosis
- AI prescription
- treatment recommendation
- fabricated medical qualification
- presenting unverified provider status as verified

Sensitive medical information requires explicit access control and privacy handling.

---

## 39. Accessibility

Definition of Done includes:

- keyboard navigation
- semantic HTML
- screen-reader labels
- visible focus
- adequate contrast
- touch targets
- reduced motion
- error identification
- form labels
- logical reading order
- RTL accessibility
- mobile accessibility

Accessibility is not a later phase.

---

## 40. Performance

UI architecture should use:

- route-level code splitting
- lazy-loaded heavy modules
- optimized media
- cached safe public assets
- cancellation of obsolete search requests
- virtualization for large tables/lists
- minimal unnecessary hydration

Customer-facing surfaces should remain fast even when the backend composes multiple modules.

---

## 41. Security-Aware UI

The UI may hide actions the actor cannot use, but this is never security.

Every mutation must be protected server-side.

Do not reveal unauthorized resources through:

- counts
- autocomplete
- notifications
- search
- error messages
- cached content
- dashboard widgets

Sensitive values should be minimized and masked where appropriate.

---

## 42. Navigation Rules

Routes should express user intent and context.

Examples:

    /
    /discover
    /discover?tab=following
    /discover?tab=explore
    /compare
    /product-studio
    /profile
    /activity
    /checkout
    /business
    /business/products
    /business/services
    /business/bookings
    /business/team
    /business/settings

Query parameters must survive SPA navigation when they are part of state.

Do not create duplicate routes for every occupation unless the workflow genuinely requires a distinct route.

---

## 43. Data Ownership

UI does not own domain truth.

Examples:

    Identity → account identity
    Business → organization/business
    Catalog → products/services
    Discovery → discovery/index
    Matching → matching decisions
    Booking → appointments
    Commerce → transactions
    Billing → financial truth
    Communication → messages/delivery
    Social Engagement → follow/like/save/comment
    Trust → verification/reputation policy

The frontend composes these capabilities.

---

## 44. Anti-Patterns

Do not:

- create one dashboard app per occupation
- duplicate product models for social posts
- create a second checkout
- create a second recommendation engine
- create a second CRM relationship model for social follows
- fabricate activity
- fabricate personalization
- fabricate inventory/availability
- hard-code authorization in UI
- expose private verification data
- make Home look like ERP
- treat every business as a generic store
- force every business to show every module

---

## 45. Reference Screen Inventory

The supplied reference should be translated into these canonical screen families.

### Individual

1. Welcome
2. Home
3. Ask Phoenix
4. Suggestions
5. Create Content
6. Content Details
7. Transaction Selection
8. Discovery
9. Following
10. Explore
11. Product Detail
12. Service Detail
13. Compare
14. Booking
15. Checkout
16. Payment
17. Orders
18. Messages
19. Notifications
20. Profile
21. Saved
22. Activity
23. Settings

### Organization

1. Organization Welcome
2. Organization Overview
3. Organization Profile
4. Commercial Content
5. Content Creation
6. Product/Service Management
7. Transaction/Deal Requests
8. Customers
9. Messages
10. Booking/Availability
11. Team
12. Roles & Permissions
13. Payments/Finance
14. Reviews
15. Analytics
16. Verification
17. Settings

### Vertical Extensions

The same organization shell can expose specialized screens.

Clinic:

- appointments
- calendar
- providers
- services
- customer-facing scheduling
- availability

Retail:

- products
- variants
- inventory
- orders
- returns
- promotions

Restaurant:

- menu
- orders
- tables
- reservations
- kitchen
- delivery

Salon:

- services
- specialists
- schedules
- appointments
- customers

---

## 46. Cross-Surface Continuity

A user's journey must not reset when crossing surfaces.

Example:

    Home
      ↓
    Ask Phoenix:
    "یک کفش برای دویدن می‌خواهم تا ۵ میلیون"
      ↓
    Discovery
      ↓
    Product A
      ↓
    Compare A
      ↓
    Product B
      ↓
    Compare 2
      ↓
    Ask Phoenix:
    "برای دویدن کدام مناسب‌تر است؟"
      ↓
    Product decision
      ↓
    Instant Buy
      ↓
    Checkout
      ↓
    Payment
      ↓
    Order
      ↓
    Review

Business-side continuity:

    Business Workspace
      ↓
    Product Studio
      ↓
    AI enrichment
      ↓
    Seller approval
      ↓
    Catalog publication
      ↓
    Discovery
      ↓
    Customer interaction
      ↓
    Order / Booking
      ↓
    Business activity

---

## 47. Product Principle for Vertical UI

The occupation does not define a separate Phoenix product.

The occupation defines a **different composition of Phoenix capabilities**.

Formally:

    Vertical UX
    =
    Shared Phoenix Core
    +
    Vertical Capabilities
    +
    Vertical Workflow
    +
    Role Permissions
    +
    Policy

This is the canonical rule for all future occupations.

---

## 48. Acceptance Criteria

The Master UI is considered architecturally aligned when:

- / remains the intelligent Phoenix decision/matching experience;
- individual users can express needs naturally;
- customers can discover, compare and act;
- social commerce actions use canonical backend boundaries;
- businesses have a shared workspace;
- occupations compose specialized capabilities without duplicated dashboards;
- organization roles change available modules/actions;
- booking appears only where supported;
- buying appears only where supported;
- transaction types are capability-driven;
- content creation can feed canonical supply;
- Seller AI remains proposal/acceptance based;
- team management is permission-aware;
- business and personal identity remain separate;
- public profiles do not expose private workspace data;
- AI side effects require confirmation and authorization where applicable;
- medical UI follows the medical safety boundary;
- RTL/Persian is first-class;
- responsive behavior is intentional;
- loading/empty/error/permission states are implemented;
- accessibility is part of Definition of Done;
- no second source of truth is introduced in the frontend.

---

## 49. Implementation Order

Recommended implementation sequence:

1. Master design tokens and shared shell
2. Individual Home / Ask Phoenix
3. Customer navigation
4. Discovery / Explore / Following
5. Social commerce post cards
6. Compare
7. Product/Service detail
8. Checkout/Payment continuity
9. Activity/Notifications
10. Personal profile
11. Business Workspace shell
12. Capability-driven navigation
13. Organization profile
14. Team/Roles/Permissions
15. Business overview
16. Catalog/Product/Service modules
17. Booking/Availability modules
18. Commerce/Orders modules
19. CRM/Communications modules
20. Content Studio/Seller AI
21. Vertical capability registry
22. Clinic workflow
23. Retail workflow
24. Restaurant workflow
25. Salon workflow
26. Additional occupations
27. Accessibility/performance hardening
28. E2E cross-surface journeys

---

## 50. Final Product Rule

Phoenix should feel like **one product that understands the person, the business and the situation**, not a collection of dashboards.

For a customer:

> «بگو چی می‌خوای.»

For a business:

> «بگو چه کسب‌وکاری داری؛ ققنوس ابزارهای مناسبش را در اختیارت می‌گذارد.»

For every workflow:

> «ققنوس نیاز را می‌فهمد، گزینه را پیدا می‌کند، تصمیم را ساده می‌کند و اقدام را به نتیجه متصل می‌کند.»

The UI is successful when the user does not need to understand Phoenix's internal modules in order to accomplish the task.
