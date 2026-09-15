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
