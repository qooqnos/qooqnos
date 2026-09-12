# Phoenix Customer Experience Architecture

**Status:** Architecture Baseline  
**Scope:** Customer-facing journey from entry to discovery, matching, offer evaluation, booking, communication, history, and personalization  
**Architecture:** Modular Monolith

## 1. Product Principle

Phoenix is an AI marketplace, not a conventional directory or CRM.

The customer journey is:

`Intent → AI Understanding → Eligible Matches → Explainable Recommendations → Offer/Profile → Contact/Booking → Communication → History → Feedback/Personalization`

The UI must make this journey feel simple even though the underlying system is modular.

## 2. Customer Experience Shell

The customer application should have a stable shell containing:

- global search/AI entry
- location/context selector
- language and appearance controls
- notification center
- account/profile
- saved items
- recent activity
- support/help

Modules contribute pages and UI slots without owning the global shell.

## 3. Primary Customer Surfaces

### Home

Purpose: capture intent quickly.

Components:

- AI search prompt
- popular categories
- contextual recommendations
- recently viewed/saved items
- location-aware discovery where permitted

### Discovery

Shows matching businesses, services, and products.

Must support:

- natural-language query
- deterministic filters
- sorting
- location
- price range
- availability
- category
- language
- personalization

AI recommendations must remain explainable and policy-filtered.

### Business Profile

Business profile should present verified, relevant information:

- business identity
- verification/publication status
- services/products
- pricing where available
- portfolio/media
- location
- hours/availability summary
- contact channels
- reviews where available
- booking entry points

Do not expose private verification documents or internal notes.

### Offer Detail

Offer detail is the customer view of a catalog service/product.

For services:

- duration
- price
- provider
- availability
- relevant policies
- booking/contact CTA

For products:

- variants
- price
- availability/inventory state
- seller
- contact/purchase CTA

### Booking

Booking should minimize friction while preserving authoritative availability.

Flow:

`Offer → Date/Time → Availability Re-check → Customer Details → Confirmation → Booking Result`

The final confirmation must come from Booking, never from AI or stale UI state.

## 4. AI-First Search Experience

The customer should not need to know marketplace taxonomy.

Examples of intent dimensions:

- what they need
- location
- budget
- style/preferences
- timing
- constraints

AI converts natural language into structured intent. The UI may show interpreted constraints so the customer can correct them.

Example:

> "برای آخر هفته یک سالن خوب نزدیک مرکز شهر برای رنگ مو، حدود ۲ میلیون"

The interface should expose interpreted constraints such as category, date window, location, service, and budget for confirmation/editing.

## 5. Match Result Design

Every result should distinguish:

- hard eligibility
- recommendation relevance
- availability
- quality signals
- personalization

Never imply that a result is available if Availability has not confirmed it.

Recommendation explanations should be concise and grounded in current data.

Examples:

- "با بودجه شما مطابقت دارد"
- "این سرویس برای زمان انتخابی شما ظرفیت دارد"
- "به دلیل ترجیح ثبت‌شده شما پیشنهاد شده"

Do not expose internal ranking formulas or sensitive signals.

## 6. Comparison and Shortlisting

Customers should be able to:

- save a business/offer
- compare a small number of candidates
- share a result
- return to recent searches

Comparison must use normalized fields and clearly indicate missing data rather than inventing values.

## 7. Contact and Communication

Customer actions such as chat, WhatsApp, call, or other supported channels must go through Communications policy and authorization.

UI should clearly distinguish:

- platform message
- provider contact
- booking confirmation
- marketing communication

AI may prepare a message but sending must pass the Communications pipeline.

## 8. Customer Account

Account areas:

- profile
- preferences
- saved items
- bookings
- communications
- notification preferences
- privacy/consent
- activity history

Identity remains owned by the Identity/Auth boundary.

Customer preferences are explicit data whenever possible.

## 9. Personalization

Personalization may use:

- explicit preferences
- language
- location context
- recent interactions
- saved items
- booking history
- feedback

Avoid sensitive inference.

Medical or highly sensitive attributes must not silently become durable personalization data.

Customers should be able to understand and control meaningful personalization settings.

## 10. Booking History

Customer history should be a read model assembled from authoritative modules.

It may show:

- booking status
- business/offer
- scheduled time
- communication history relevant to the booking
- cancellation/reschedule state

It must not duplicate Booking as a second source of truth.

## 11. Notifications

Notification center consumes the Communications inbox projection.

Customer can:

- read notifications
- follow deep links
- manage applicable preferences

Security and required transactional notifications must not be hidden behind marketing preference controls.

## 12. Reviews and Feedback

Reviews belong to a dedicated review/feedback capability when implemented.

Customer UX should support:

- rating
- structured feedback
- optional text
- report abuse

Review eligibility should be tied to authoritative completed interactions where appropriate.

AI may summarize aggregated reviews but must not fabricate reviews or manipulate ratings.

## 13. Accessibility

Customer UI must support:

- keyboard navigation
- screen readers
- visible focus states
- adequate contrast
- semantic controls
- reduced-motion preferences
- responsive layouts
- RTL/LTR

Accessibility is part of Definition of Done, not a later enhancement.

## 14. Multilingual UX

Internationalization is foundational.

Support:

- locale-aware content
- RTL/LTR
- translated UI strings
- provider/customer content language
- timezone-aware dates
- currency formatting
- Jalali/Gregorian calendar adapters
- locale-aware numbers

Never mix localized presentation values with canonical storage values.

## 15. Loading and Empty States

Every async surface must have explicit:

- loading
- empty
- partial-data
- error
- retry
- permission-denied
- unavailable

states.

An AI search with no valid results should explain that no eligible match was found and offer safe refinements rather than hallucinating candidates.

## 16. Trust and Safety UX

Customer-visible trust signals may include:

- verified provider status
- verified professional status where applicable
- clear pricing/source labels
- availability freshness
- sponsored labeling if sponsored placement is ever introduced

Sponsored placement must never override hard eligibility and must be clearly labeled.

Medical marketplace surfaces require stronger trust and consent presentation.

## 17. Medical Customer Experience Boundary

Medical customer UX may support:

- provider/service discovery
- verified-provider presentation
- availability/contact
- appointment booking
- organization of user-provided information

It must not present Phoenix AI as diagnosing, prescribing, or recommending treatment/medication.

The interface should use neutral language such as matching, information, scheduling, and provider-published content.

## 18. Performance Budgets

Initial targets:

- app shell p95 < 1.5s server response where practical
- discovery API p95 aligned with Discovery target
- interactive booking operations aligned with Booking target
- optimistic UI only for non-authoritative presentation state

Do not optimize by weakening authorization, freshness, or tenant isolation.

## 19. State Management

Separate:

- server/source-of-truth state
- local UI state
- transient form state
- cached read models

Do not place authoritative booking/catalog state solely in client storage.

Caches must be scoped by tenant/user and invalidated by version/event where necessary.

## 20. Module Integration

Customer Experience consumes module contracts:

- Identity/Auth
- Discovery
- Business
- Catalog
- Availability
- Booking
- Communications
- CRM where customer-facing relationship features are appropriate
- Reviews when implemented

The frontend must not reach directly into another module's private database tables.

## 21. API/BFF Boundary

The customer UI may use a customer-facing API/BFF composition layer for page-oriented data.

The BFF may compose authorized read models but must not become a second domain source of truth.

Commands must route to owning modules.

## 22. Security

Every customer-facing request must enforce:

- authentication where required
- tenant/workspace context
- object-level authorization
- privacy policy
- consent rules
- CSRF/session protections as applicable
- input/output schema validation
- safe rendering of provider content

Provider-generated text, uploaded content, and AI output are untrusted content.

## 23. Implementation Order

1. design system/customer shell
2. authentication/account surfaces
3. AI search entry
4. discovery result experience
5. business profile
6. offer detail
7. save/shortlist
8. booking flow
9. notification center
10. communications/contact UX
11. history
12. preferences/privacy
13. reviews/feedback
14. personalization
15. accessibility/performance hardening

## 24. Definition of Done

Customer Experience is ready when:

- the primary journey works from natural-language intent to verified match;
- results respect deterministic eligibility and current availability;
- customer commands route to owning modules;
- booking confirmation is authoritative;
- communications respect consent and policy;
- personalization is explicit/safe;
- multilingual/RTL/Jalali support is foundational;
- loading/error/empty states are complete;
- accessibility and performance budgets are tested;
- medical UX respects all AI safety boundaries.
