# Phoenix Billing Skill

Native Claude Code entrypoint. Read `skills/phoenix-billing/SKILL.md` and `docs/BILLING_PLANS_MONETIZATION_ARCHITECTURE.md` before billing work.

## Rules
- Billing owns plans, prices, subscriptions, entitlements, usage, quotas, invoices when enabled, provider references, reconciliation, and future transaction fees.
- Keep Plan separate from Price and entitlements separate from Authorization permissions.
- Free is an explicit plan.
- Money uses integer minor units + ISO currency; never floating point.
- Usage is idempotent; scarce quotas are concurrency-safe.
- Payment providers stay behind adapters; webhooks require signature validation, replay protection, and idempotency.
- Future marketplace payments, transaction fees, and payouts remain distinct from business subscriptions.
- AI may explain/recommend plans but cannot alter subscriptions, grant entitlements, invent prices, or approve financial actions.
- Sensitive financial actions require elevated authorization and audit.

## Done
Verify tenant isolation, lifecycle, quota concurrency, idempotency, reconciliation, money arithmetic, and security.
