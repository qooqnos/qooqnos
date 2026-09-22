# Phoenix Current Verification

**Status:** Current engineering verification snapshot  
**Last verified:** 2026-09-23  
**Authoritative sources:** `docs/IMPLEMENTATION_LEDGER.md`, `PHASE_STATUS.md`, GitHub Actions

## Verification result

The current `main` commit verified in GitHub Actions is:

`586959738b01c635dd5022fb24b2aa7f25dcb439`

Both required workflows passed:

- **CI:** run `35785791295` — success
- **Phoenix verification:** run `35785791200` — success

The verification path passed migration-lock verification, TypeScript typecheck, workspace build, lint/migration checks, and the unit-test suite.

## Canonical runtime baseline

Phoenix is implemented around:

- Cloudflare Workers runtime
- Cloudflare D1 as the canonical relational source of truth
- Cloudflare R2 for object storage
- Cloudflare Queues for asynchronous processing
- SQL migrations under `migrations/`
- migration catalog + lock verification
- repository-level organization/workspace isolation
- modular capability ownership

The product loop remains:

`Understand Demand → Understand Supply → Decide → Match → Connect → Act → Learn`

## Canonical implementation coverage

Current canonical migrations reach `0048_reviews_moderation_reputation.sql`.

Implemented core capability families include:

- Identity / tenancy / authorization
- Business and Catalog
- Media and Discovery projections
- Seller AI Product Creation
- Customer / CRM relationships / addresses / timeline events
- Trust / Verification / Reviews
- Booking / Availability / Holds / Finalization / Capacity guards
- Commerce transaction boundary
- Billing / entitlements / usage / quota counters
- Communication / notifications / delivery dispatch
- Automation workflow/execution state
- AI Runtime persistence
- Integration accounts / webhooks / sync state / external references
- Privacy / Consent
- Demand / Matching
- Matching `Connect` through canonical CustomerRelationship ownership

## Important implementation boundaries

- No second database architecture is permitted.
- No new table should be created when an existing canonical capability already owns the fact.
- AI output remains non-authoritative until accepted by the owning domain capability.
- Matching candidates reference canonical Business/Offering authority and do not duplicate supply truth.
- Match decisions are append-only.
- Matching Connect requires an explicit selected candidate and reuses the canonical Customer↔Business relationship.
- Communication delivery state is provider-neutral; provider adapters remain behind the Communication boundary.
- Billing owns commercial entitlement/usage authority; Payment execution, invoices and financial ledger remain separate ownership gates.
- Booking slots remain derived projections; there is no authoritative slots table.

## Remaining completion gates

The physical schema is intentionally broad but not every operational concern is closed. Remaining work is primarily execution rather than schema invention:

1. Durable Automation scheduler/worker execution and capability invocation.
2. Integration provider adapters and durable sync workers.
3. Privacy export/delete/retention workers with subject-level identity validation.
4. External Communication provider adapters plus template/policy/consent layers.
5. AI Runtime provider routing/validation workers.
6. Matching learning signals and Connect/Act integrations beyond the canonical Customer relationship.
7. CustomerProfile and CRM timeline projection only when field-level contracts are explicit.
8. Localization / Documents / Analytics contracts where their canonical ownership is explicit.
9. Remote D1 provisioning and production binding configuration.

## Source-of-truth documents

Read these before making substantial changes:

- `docs/PHOENIX_PRODUCT_NORTH_STAR.md`
- `docs/CAPABILITY_DECISION_RULES.md`
- `docs/CAPABILITY_CONTRACT_MATRIX.md`
- `docs/DATABASE_MODEL.md`
- `docs/PHYSICAL_SCHEMA_BLUEPRINT.md`
- `docs/DATABASE_PHYSICAL_RECONCILIATION.md`
- `docs/IMPLEMENTATION_LEDGER.md`
- `PHASE_STATUS.md`

This document is a current verification snapshot. Historical implementation narratives remain in git history and must not override the canonical documents above.
