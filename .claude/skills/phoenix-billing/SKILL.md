---
name: phoenix-billing
description: Rules for Phoenix billing, plans, entitlements, usage, money, payments, reconciliation, and financial authorization.
---

# Phoenix Billing Skill
## Purpose
Keep money, plans, entitlements, usage, and future marketplace fees authoritative, auditable, and isolated from unrelated domains.
## Mandatory context
Read `docs/BILLING_PLANS_MONETIZATION_ARCHITECTURE.md` before billing work.
## Rules
- Billing owns plans, prices, subscriptions, entitlements, usage, quotas, invoices when enabled, provider references, reconciliation, and future transaction fees.
- Keep plans/prices separate; entitlements are not authorization permissions.
- Free is an explicit plan.
- Money uses integer minor units + ISO currency; never floating point.
- Usage is idempotent and scarce quotas are concurrency-safe.
- Payment providers stay behind adapters; webhooks require signature validation, replay protection, and idempotency.
- Marketplace payments, transaction fees, and payouts remain distinct from business subscriptions.
- AI may explain/recommend plans but cannot alter subscriptions, grant entitlements, invent prices, or approve financial actions.
- Sensitive financial actions require elevated authorization and audit.

## Done
Verify tenant isolation, lifecycle transitions, quota concurrency, idempotency, reconciliation, money arithmetic, audit, and security.
