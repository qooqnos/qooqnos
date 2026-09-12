# Phoenix Billing Skill

## Mission

Implement plans, subscriptions, entitlements, usage, quotas, and future marketplace monetization without leaking financial authority into other modules.

## Ownership

Billing owns:

- plans/prices
- subscriptions
- entitlements
- usage meters/events
- invoices when enabled
- payment provider references
- reconciliation
- future ledger and transaction fees

Billing does not own Catalog prices, Booking state, Identity, CRM, or Communications delivery.

## Plans and Entitlements

Keep Plan separate from Price.
Keep Plan/Price separate from Authorization permissions.

Product modules must ask the entitlement service instead of reading subscription tables.

Free must be an explicit plan with explicit limits.

## Money

- integer minor units only;
- ISO currency code;
- explicit rounding rules;
- never use floating point for financial arithmetic;
- never silently convert currencies.

## Quotas

Quota checks must be safe under concurrency.
Use atomic/reservation-based enforcement for scarce resources.
Usage events must be idempotent.

## Provider Boundary

Payment provider SDKs belong behind Billing adapters.
Never spread provider-specific objects through the domain.

Provider webhooks are untrusted and require signature verification, schema validation, replay protection, and idempotency.

## Reconciliation

Never assume local payment state is permanently authoritative when an external provider is involved.
Run reconciliation and create explicit discrepancy cases.

## Transaction Fees

Future marketplace transaction fees belong to Billing.
Do not implement fee logic inside Booking, Catalog, or customer UI.

Keep separate concepts:

- business subscription
- customer marketplace payment
- platform transaction fee
- provider payout/settlement

## AI

AI may explain plans, summarize usage, and recommend plans from explicit business needs.
AI must not invent prices, change subscriptions, grant entitlements, calculate authoritative financial obligations, or approve refunds/credits outside the Billing workflow.

## Security

Never log payment credentials, provider secrets, or unnecessary financial data.
High-risk billing operations require elevated permission and audit; dual approval may be required by policy.

## Downgrades

Never destructively delete business data just because a plan is downgraded.
Prefer preserving data while blocking new creation beyond limits, subject to explicit retention policy.

## Testing

Test entitlement decisions, concurrent quota consumption, idempotency, subscription transitions, grace periods, downgrade behavior, tenant isolation, webhook security, reconciliation, money arithmetic, rounding, currency handling, and AI boundaries.

## Definition of Done

A billing feature is done only when financial ownership is clear, entitlements are centralized, quotas are concurrency-safe, provider integration is isolated, money handling is exact, and all sensitive actions are authorized and audited.