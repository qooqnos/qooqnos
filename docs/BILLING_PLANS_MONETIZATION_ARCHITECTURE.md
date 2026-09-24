# Phoenix Billing, Plans & Monetization Architecture

**Status:** Architecture Baseline  
**Scope:** Plans, subscriptions, entitlements, usage, quotas, invoicing foundations, future transaction fees  
**Architecture:** Modular Monolith

## 1. Purpose

Billing is the financial authority for Phoenix. It must remain independent from Catalog, Booking, CRM, Communications, and AI.

Core rule:

> Product features ask Billing whether an entitlement exists; they never calculate financial authority themselves.

Initial monetization should support free/pro business plans while preserving a clean path to future marketplace transaction fees.

## 2. Financial Ownership

Billing owns:

- plans
- prices
- subscriptions
- subscription lifecycle
- entitlements
- usage meters
- quotas
- invoices/receivables when introduced
- payment provider references
- transaction fee records when marketplace transactions are introduced

Billing does not own:

- product/service prices in Catalog
- booking state
- customer identity
- business identity
- communication delivery

## 3. Plan Model

Separate a **Plan** from a **Price**.

Plan describes commercial capabilities:

- `free`
- `pro`
- future enterprise/custom plans

Price describes a purchasable commercial version:

- currency
- billing interval
- amount
- effective dates
- tax treatment reference where applicable
- provider price reference

Never hard-code plan limits inside frontend code.

## 4. Entitlements

Entitlements are the bridge between Billing and product modules.

Examples:

```text
catalog.offers.max
catalog.media.storage
booking.monthly_limit
crm.customer_limit
ai.requests.monthly
ai.priority
analytics.level
team.members.max
communications.marketing_access
```

An entitlement has a stable key and typed value.

Product modules ask an Entitlement Service for authorization rather than reading subscription tables directly.

## 5. Subscription Lifecycle

Recommended states:

`trialing → active → past_due → grace_period → suspended → cancelled → expired`

Transitions must be driven by authoritative billing events/provider reconciliation.

A UI displaying `active` is never sufficient proof for a privileged product operation.

## 6. Free Plan

Free should be a real plan, not absence of billing data.

Benefits:

- explicit entitlements
- deterministic quotas
- clear upgrade path
- measurable usage
- predictable feature behavior

This allows product modules to behave consistently for every business.

## 7. Pro Plan

Pro may unlock higher limits and advanced capabilities such as:

- more catalog capacity
- higher media limits
- larger CRM capacity
- higher AI usage quota
- advanced analytics
- additional team members
- enhanced communications capabilities

Exact commercial values are product decisions and should live in plan configuration, not code.

## 8. Usage Metering

Usage must be event-based and idempotent.

Potential meters:

- AI requests/tokens where commercially relevant
- storage
- active catalog offers
- bookings
- communication volume
- team seats

Usage records should include:

- tenant/workspace
- meter key
- quantity
- period
- source event id
- timestamp
- aggregation/version metadata

Never count the same source event twice.

## 9. Quota Enforcement

Flow:

`Request → Tenant → Entitlement → Current Usage → Policy → Allow/Deny → Usage Event`

For scarce resources, enforcement must be atomic or reservation-based to prevent concurrent requests from exceeding limits.

Soft limits may warn; hard limits deny.

## 10. AI Cost Controls

AI is a variable-cost capability and requires dedicated controls.

Track at minimum:

- request count
- model/provider
- input/output token usage where available
- estimated cost
- tenant
- feature/module
- success/failure

Do not expose internal provider costs to customers unless product policy explicitly requires it.

AI quotas should degrade safely rather than silently creating uncontrolled spend.

## 11. Transaction Fee Foundation

Although internal marketplace payment is deferred, the architecture must reserve a transaction-fee boundary.

Future flow:

`Booking/Order → Transaction Event → Billing → Fee Calculation → Ledger/Receivable → Payment Provider`

Booking remains authoritative for booking state.

Billing calculates financial obligations from versioned commercial rules.

Do not embed transaction-fee calculations inside Booking or Catalog.

## 12. Ledger Principle

When real money movement is introduced, use an append-oriented financial ledger rather than mutable balance fields.

Every financial entry should have:

- immutable entry id
- account/reference
- amount
- currency
- direction
- source event
- idempotency key
- created timestamp
- reversal/reference relationship where applicable

Balances are projections of ledger entries.

## 13. Currency and Money

- Store monetary values as integer minor units.
- Store ISO currency code.
- Never use floating point for financial arithmetic.
- Define rounding rules explicitly.
- Never silently convert currencies.

Catalog price and Billing financial records remain separate authorities.

## 14. Taxes and Legal Rules

Tax and invoicing requirements vary by jurisdiction.

Core Billing should expose policy adapters for country/jurisdiction rules rather than embedding country-specific logic in the core domain.

Do not claim tax compliance merely because a tax field exists.

## 15. Payment Provider Abstraction

Payment providers must be behind adapters.

Billing should store provider/customer/payment/subscription references, not depend on provider-specific data structures throughout the application.

Provider webhooks are untrusted input and require:

- signature verification
- schema validation
- idempotency
- replay protection
- reconciliation

## 16. Reconciliation

External payment state can differ temporarily from local state.

Implement reconciliation jobs that compare:

`Local Billing State ↔ Provider State`

Discrepancies become explicit operational cases rather than silent mutations.

## 17. Billing and Permissions

Billing entitlements can influence product access, but Billing must not grant platform authorization.

Example:

`Pro plan → analytics.advanced entitlement`

does not mean:

`Pro plan → admin.analytics.read permission`

Permissions remain an Authorization concern.

## 18. Tenant Isolation

Every billing record is tenant/workspace scoped where applicable.

Never allow one business to query another business's subscription, usage, invoice, or payment metadata.

Platform finance roles may access cross-tenant data only with explicit permission and audit.

## 19. Customer vs Business Billing

Initial monetization should primarily bill businesses/partners for platform plans.

Customer-facing transaction payments are a future capability and must not be mixed into business subscription logic.

Keep these concepts separate:

- Business platform subscription
- Customer marketplace payment
- Platform transaction fee
- Provider payout/settlement

## 20. Cancellation and Grace Period

Cancellation should be a controlled lifecycle transition.

Product access during grace periods must be explicitly defined by entitlement policy.

Do not immediately delete business data when a subscription ends.

Data retention and downgrade behavior must be explicit.

## 21. Downgrade Behavior

If a business exceeds a lower plan's limits:

- preserve existing data where policy allows;
- prevent new creation beyond quota;
- avoid destructive automatic deletion;
- clearly identify affected resources;
- offer upgrade/remediation.

## 22. Webhooks and Events

Billing events should be versioned:

- `billing.subscription.started.v1`
- `billing.subscription.renewed.v1`
- `billing.subscription.past_due.v1`
- `billing.subscription.cancelled.v1`
- `billing.entitlement.changed.v1`
- `billing.usage.recorded.v1`
- future `billing.transaction_fee.assessed.v1`

Consumers must be idempotent.

## 23. API Surface

Initial internal/customer-facing shape:

```text
GET  /api/v1/billing/plans
GET  /api/v1/billing/subscription
GET  /api/v1/billing/entitlements
GET  /api/v1/billing/usage
POST /api/v1/billing/checkout
POST /api/v1/billing/subscription/cancel
GET  /api/v1/billing/invoices
```

Checkout/payment endpoints should be enabled only when the corresponding provider/payment capability is implemented.

## 24. Data Model

Recommended tables:

- `billing_plans`
- `billing_prices`
- `billing_plan_entitlements`
- `billing_subscriptions`
- `billing_subscription_events`
- `billing_usage_meters`
- `billing_usage_events`
- `billing_entitlement_snapshots`
- `billing_invoices` (when invoicing is active)
- `billing_payment_provider_refs`
- `billing_reconciliation_cases`
- `billing_refunds`
- `billing_ledger_accounts`
- `billing_ledger_transactions`
- `billing_ledger_entries`
- future `billing_transaction_fees`

## 25. Security

Never log payment credentials or provider secrets.

Sensitive financial metadata must have strict authorization.

Billing operations require strong auditability.

High-risk actions such as refunds, manual credits, fee overrides, or subscription overrides should require elevated permissions and potentially dual approval.

## 26. AI Integration

AI may:

- explain plans;
- summarize usage;
- recommend an appropriate plan based on explicit business needs;
- forecast usage where supported by data.

AI may not:

- alter subscription state directly;
- grant entitlements without Billing authorization;
- invent prices;
- calculate authoritative financial obligations outside Billing;
- approve refunds/credits without the required workflow.

## 27. Observability

Track:

- subscription lifecycle transitions
- entitlement decisions
- quota denials
- usage ingestion failures
- payment provider latency/failures
- reconciliation mismatches
- invoice failures
- transaction fee calculations when enabled
- billing-related support cases

## 28. Performance

Entitlement checks are on hot paths and should be fast.

Use carefully scoped caching with invalidation/versioning.

Usage aggregation may be asynchronous, but hard quota enforcement must use sufficiently current state.

## 29. Testing

Required tests:

- plan/price separation
- entitlement evaluation
- quota boundaries
- concurrent quota consumption
- idempotent usage events
- subscription transitions
- grace-period behavior
- downgrade behavior
- tenant isolation
- payment webhook verification
- reconciliation
- money arithmetic/rounding
- currency handling
- transaction-fee versioning
- permission vs entitlement separation
- AI billing boundaries

## 30. Implementation Order

1. plan schema
2. entitlement registry
3. subscription model
4. entitlement evaluation service
5. usage meter/event model
6. quota enforcement
7. business billing UI
8. payment provider adapter
9. subscription checkout
10. webhook/reconciliation
11. invoice foundation
12. AI usage/cost metering
13. future marketplace transaction ledger
14. future transaction fees/payouts

## 31. Definition of Done

Billing is ready when:

- Free/Pro are explicit plans;
- entitlements are centralized and typed;
- product modules do not read subscription internals;
- quotas are safe under concurrency;
- usage is idempotent;
- provider integrations are isolated;
- reconciliation exists;
- money uses integer minor units;
- tenant isolation and audit are enforced;
- future transaction fees have a clean boundary without prematurely implementing marketplace payments.
