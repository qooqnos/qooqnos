# Phoenix Current Verification

**Status:** Current engineering verification snapshot  
**Last verified:** 2026-09-23  
**Authoritative sources:** `docs/IMPLEMENTATION_LEDGER.md`, `PHASE_STATUS.md`, GitHub Actions

## Verification result

The current `main` commit verified in GitHub Actions is:

`2441bb4bd34cc423b31ac7a3e6d6e72a05b3516d`

Both required workflows passed:

- **CI:** run `35835340923` — success
- **Phoenix verification:** run `35835340833` — success

The verification path passed migration-lock verification, TypeScript typecheck, workspace build, lint/migration checks, and the unit-test suite: **64 test files / 184 tests passed**.

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

Current canonical migrations reach `0052_moderation_cases.sql`.

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
- Fulfillment / Service Delivery core and lifecycle evidence
- Case Support lifecycle / SLA / CaseAction execution
- Communication template registry
- Generic ModerationCase coordination

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

1. Scheduled Automation polling and misfire semantics are implemented; scheduled action execution still requires canonical CapabilityRegistry composition.
2. Integration provider adapters and durable sync workers; adapter payload/credential contracts remain provider-specific.
3. Privacy consent expiry is live; export/delete/retention workers with subject-level identity validation remain.
4. External Communication provider adapters plus consent/anti-spam policy remain gated; template registry and provider-neutral dispatch are live.
5. AI provider routing/validation execution beyond the current in-process Runtime/registry, specifically durable/asynchronous worker orchestration where required.
6. Matching learning signals and broader Act integrations beyond the canonical Customer relationship/Connect path.
7. CustomerProfile only when its field-level contract is explicit; CRM timeline is already physically implemented as events/projection input.
8. CustomerProfile field-level contract, plus Localization / Documents / Analytics contracts where canonical ownership is explicit.
9. Case queue dispatch and cross-domain CaseAction execution through canonical capabilities, then remote D1 provisioning and production binding configuration.

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
