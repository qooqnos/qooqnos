# Phoenix Promotion & Campaign Engine Architecture

**Status:** Architecture defined / frozen  
**Scope:** Promotions, offers, campaign eligibility, commercial incentives and campaign orchestration across all Phoenix verticals  
**Owner:** Promotion & Campaign

## 1. Purpose

Promotion & Campaign is Phoenix's reusable commercial-incentive engine. It defines, versions, evaluates and governs offers and campaign eligibility without becoming Commerce/Billing, Catalog, Booking, Loyalty, CRM, Communications or AI.

> **Promotion owns promotional policy and eligibility; other domains remain authoritative for prices, orders, payments, bookings, loyalty value and message delivery.**

The same engine serves Beauty, Fashion, Medical partners where legally permitted, and future verticals.

## 2. Ownership Boundaries

| Concern | Source of truth |
|---|---|
| Product/service base price | Catalog |
| Order/payment/financial truth | Commerce/Billing |
| Booking facts | Booking |
| Loyalty points and rewards | Loyalty |
| Customer-business relationship | CRM |
| Customer identity | Identity/Customer |
| Promotion definitions and campaign policy | Promotion & Campaign |
| Communication delivery | Communications |
| Reputation/trust | Reviews/Trust |
| Personalization/recommendation | AI |
| Authorization | Authorization |
| Reporting/measurement | Analytics |

Promotion consumes authoritative facts and never reconstructs domain truth from client state.

## 3. Core Concepts

- **Promotion:** bounded commercial incentive definition.
- **Campaign:** initiative grouping promotion rules, audience eligibility, channels, objectives and measurement.
- **Promotion Version:** immutable policy version used for evaluation and historical explanation.
- **Eligibility Rule:** deterministic policy describing who, what, when, where and under which conditions an incentive may apply.
- **Offer:** customer-visible representation of an eligible promotion; not a financial transaction.
- **Qualification:** authoritative decision that an actor/resource/event satisfies a promotion rule.
- **Reservation:** temporary claim used when concurrency or limited quantity requires protection.
- **Redemption:** recorded consumption of an approved promotion against an authoritative Commerce or Booking transaction.
- **Stack Policy:** explicit rules governing coexistence, precedence and incompatibility.
- **Campaign Audience:** policy-defined audience reference; Promotion does not become the CRM relationship source of truth.

## 4. Incentive Value Model

```text
Base Price          → Catalog / Commerce
Promotion Discount  → Promotion policy
Loyalty Points      → Loyalty
Reward              → Loyalty
Money               → Commerce / Billing
Entitlement         → Billing / Product access
```

Promotion never writes financial balances and never turns a discount into money. Loyalty rewards and promotional discounts are separate value types with explicit interoperability rules.

## 5. Promotion Types

Canonical types may include:

- PERCENTAGE_DISCOUNT
- FIXED_DISCOUNT
- FIXED_PRICE
- FREE_SERVICE
- FREE_ITEM
- BUNDLE_BENEFIT
- CONDITIONAL_BENEFIT
- SHIPPING_OR_FEE_BENEFIT where applicable
- ACCESS_OR_ENTITLEMENT_REFERENCE where owned by another domain

Verticals may configure eligible types but may not create independent promotion engines.

## 6. Scope

Supported scopes:

- PLATFORM
- ORGANIZATION
- WORKSPACE
- BUSINESS
- LOCATION
- CAMPAIGN

Scope precedence and stacking must be explicit. Narrower scope does not automatically override broader scope unless policy says so.

## 7. Lifecycle

Promotion: `draft → scheduled → active → paused → expired | retired`  
Campaign: `draft → scheduled → active → paused → completed | cancelled`  
Offer: `generated → available → reserved → redeemed | expired | revoked`

Promotion versions are immutable once used for a qualification/redemption decision.

## 8. Eligibility Architecture

`Authoritative Facts → Campaign/Premise Selection → Rule Evaluation → Conflict/Stack Resolution → Qualification → Offer/Benefit Reference`

Conditions may include date/time window, tenant/business/location scope, service/product/category, quantity, qualifying amount reference, first-time customer policy, approved customer segment reference, booking/order state, campaign participation, usage limits, geographic policy and channel.

Promotion references authoritative booking/order/catalog facts rather than copying them.

## 9. Redemption Architecture

Redemption requires authenticated actor where required, tenant/scope validation, active promotion version, eligibility validation, usage-limit validation, stacking/conflict validation, idempotency, concurrency-safe reservation where required, authoritative transaction reference and audit/provenance.

Commerce or Booking remains responsible for the authoritative transaction and final monetary calculation. Promotion provides the authorized incentive decision/reference consumed by that domain.

## 10. Stacking & Conflict Engine

Promotion stacking is deterministic and versioned. The engine defines compatible groups, mutually exclusive promotions, precedence, maximum simultaneous promotions, cumulative/non-cumulative behavior, campaign limits and tie-breaking rules.

No UI, AI or client-side code may decide which promotion wins.

## 11. Limits & Abuse Controls

Controls may include per-customer, per-promotion, per-business, per-campaign and per-period usage limits; quantity limits; velocity controls; duplicate-account signals; suspicious redemption signals; and employee/admin abuse controls.

Risk signals may be supplied by Security, Trust or Analytics. Promotion applies promotion policy and does not create a second fraud engine.

## 12. AI Boundary

AI may discover relevant active offers, explain conditions, suggest campaigns/eligible offers and optimize recommendations within approved policy.

AI may not invent discounts, alter policy directly, bypass eligibility, override stacking rules, mutate redemption outside canonical capabilities or infer sensitive/regulated eligibility without explicit approved policy.

`AI Recommendation → Policy Validation → Authorization → Promotion Capability → authoritative domain`

## 13. Campaign Architecture

Campaigns own orchestration metadata, not downstream business facts. A campaign may define objective, promotion references, audience reference, active window, geographic/channel scope, budget/quota reference, experiment assignment, frequency policy, measurement hooks and communication request references.

Communications sends messages; CRM owns relationship/timeline data; Analytics measures results.

## 14. Canonical Capabilities

```text
CAP.PROMOTION.CREATE
CAP.PROMOTION.UPDATE
CAP.PROMOTION.SCHEDULE
CAP.PROMOTION.ACTIVATE
CAP.PROMOTION.PAUSE
CAP.PROMOTION.RETIRE
CAP.PROMOTION.GET
CAP.PROMOTION.EVALUATE_ELIGIBILITY
CAP.PROMOTION.QUALIFY
CAP.PROMOTION.RESERVE
CAP.PROMOTION.RELEASE_RESERVATION
CAP.PROMOTION.REDEEM
CAP.PROMOTION.REVOKE
CAP.PROMOTION.RESOLVE_STACK
CAP.CAMPAIGN.CREATE
CAP.CAMPAIGN.UPDATE
CAP.CAMPAIGN.SCHEDULE
CAP.CAMPAIGN.ACTIVATE
CAP.CAMPAIGN.PAUSE
CAP.CAMPAIGN.COMPLETE
CAP.CAMPAIGN.GET
CAP.CAMPAIGN.GET_ELIGIBLE_OFFERS
```

These are the single reusable promotion/campaign behaviors. API, UI, AI, automation and plugins consume them; none may implement parallel promotion logic.

## 15. Data Model Outline

Canonical records/read models may include:

- `promotions`
- `promotion_versions`
- `promotion_rules`
- `promotion_scopes`
- `promotion_stack_policies`
- `promotion_qualifications`
- `promotion_reservations`
- `promotion_redemptions`
- `promotion_usage_counters`
- `campaigns`
- `campaign_versions`
- `campaign_audiences`
- `campaign_promotion_links`
- `campaign_experiments`
- `campaign_measurements`
- `promotion_abuse_signals`

Authoritative redemption/financial outcomes remain in the consuming domain. Promotion preserves the policy decision and references required for audit and reconciliation.

## 16. Event Contract

Produced events may include:

- `promotion.scheduled`
- `promotion.activated`
- `promotion.paused`
- `promotion.expired`
- `promotion.qualified`
- `promotion.reserved`
- `promotion.redeemed`
- `promotion.revoked`
- `campaign.activated`
- `campaign.completed`

All events are tenant-scoped, versioned, idempotent and emitted through the canonical event/outbox architecture.

## 17. Integration Rules

**Catalog:** supplies base product/service facts and prices; Promotion references them.  
**Booking:** supplies authoritative booking facts; Promotion never calculates booking state independently.  
**Commerce/Billing:** owns transaction and monetary truth; Promotion supplies an approved incentive reference/policy result.  
**Loyalty:** remains separate; promotions may trigger approved Loyalty capabilities and Loyalty may define rewards.  
**CRM:** supplies approved audience/segment references; Promotion does not duplicate relationship state.  
**Communications:** delivers campaign/promotion messages through the canonical capability.  
**AI:** recommends; Promotion policy decides.  
**Analytics:** measures performance; it is not the promotion policy source of truth.

## 18. Localization & Legal Policy

Promotion presentation supports localized names, descriptions, dates, currencies and eligibility messaging through Localization.

Country/legal adapters may restrict promotion types, claims, regulated categories, geographic availability and required disclosures. Core promotion semantics remain global.

Medical promotions require explicit legal/compliance policy review. Promotion must never use clinical information as a targeting shortcut or create unapproved medical claims.

## 19. Privacy

Use only the minimum customer data required for eligibility. Audience membership should be represented through approved references rather than copying sensitive CRM/customer attributes into promotion records.

Sensitive or regulated attributes require explicit policy authorization before use. Eligibility decisions must be explainable and auditable.

## 20. Anti-Duplication Rule

```text
Existing Promotion capability?
        ↓ yes → reuse
        ↓ no
Existing capability extension?
        ↓ yes → version/extend
        ↓ no
New Promotion capability + one owner
```

No `BeautyPromotion`, `FashionPromotion`, `MedicalPromotion` or campaign-specific promotion engines are permitted. Vertical behavior is configuration/policy over the canonical engine.

## 21. Definition of Done

Promotion & Campaign architecture is complete when ownership is unique; promotion/campaign/offer/qualification/redemption are separated; monetary truth is separated from incentive policy; versioning is deterministic and auditable; eligibility and stacking semantics are defined; limits and abuse boundaries are defined; capabilities, tenant/scope rules and events are canonical; all domain integration boundaries are explicit; localization, privacy and regulated-market constraints are defined; and no vertical-specific duplicate engine is permitted.

**Decision:** Promotion & Campaign Engine architecture is frozen. Future work is limited to module-level extensions and explicit ADRs; Core architecture is not reopened.
