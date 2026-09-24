---
name: phoenix-billing
description: Rules for Phoenix billing, plans, entitlements, AI usage, monetization, quotas, money, payments, reconciliation, and financial authorization.
---

# Phoenix Billing Skill
## Purpose
Keep money, plans, entitlements, usage, AI-assisted operations, and future marketplace fees authoritative, auditable, and isolated from unrelated domains.
## Mandatory context
Read `docs/PHOENIX_PRODUCT_NORTH_STAR.md`, `docs/AI_PRODUCT_DIRECTION.md`, `docs/CAPABILITY_DECISION_RULES.md`, and `docs/BILLING_PLANS_MONETIZATION_ARCHITECTURE.md` before billing work.
## Rules
- Billing owns plans, prices, subscriptions, entitlements, usage, quotas, invoices when enabled, provider references, reconciliation, and future transaction fees.
- AI-assisted operations are measurable usage and may be included, quota-based, credit-based, per-operation, tiered, or hybrid priced.
- AI provider token/model cost is an internal cost signal; Phoenix customer pricing is a product/business rule.
- Track AI operation identity, tenant/workspace, actor/request, usage telemetry, idempotency, internal cost signal, and customer-facing usage/charge outcome where applicable.
- Keep plans/prices separate; entitlements are not authorization permissions.
- Free is an explicit plan.
- Money uses integer minor units + ISO currency; never floating point.
- Usage is idempotent and scarce quotas are concurrency-safe.
- Payment providers stay behind adapters; webhooks require signature validation, replay protection, and idempotency.
- Marketplace payments, transaction fees, payouts, and business subscriptions remain distinct.
- AI may explain/recommend plans but cannot alter subscriptions, grant entitlements, invent prices, or approve financial actions.
- Sensitive financial actions require elevated authorization and audit.
## Done
Verify tenant isolation, lifecycle transitions, AI usage metering, quota concurrency, idempotency, reconciliation, money arithmetic, audit, and security.


## Payment Provider Adapters
- Payment provider SDK/API calls must stay behind `PaymentProviderAdapter` and `PaymentProviderRegistry`.
- Propagate idempotency keys to providers; normalize provider status and failure class before domain handling.
- Verify webhook signatures against the raw payload, enforce replay-age constraints when timestamps are supplied, validate event shape, and keep webhook processing idempotent.
- Provider credentials and signing secrets are runtime configuration only; never persist them in Billing or Commerce tables.
- Record normalized external references through `BillingRepository.recordProviderReference`.
- Commerce must never call a provider SDK directly.

## Settlement
- Settlement is Billing-owned financial truth; Commerce may reference it but must not implement payout state.
- Settlement amounts use integer minor units and immutable settlement items.
- Enforce gross = fee + refund + net and reconcile item net total before ledger posting.
- Require approval separation from requester before processing.
- Execute provider payouts only through `PaymentProviderAdapter.payoutSettlement` with an idempotency key.
- Record provider references as execution evidence; never store provider credentials in the financial schema.
- Post settlement accounting only after item reconciliation and use immutable double-entry ledger transactions.