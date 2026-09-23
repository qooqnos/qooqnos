# Phoenix Current Verification

**Status:** Current engineering verification snapshot  
**Last verified:** 2026-09-23  
**Authoritative sources:** `docs/IMPLEMENTATION_LEDGER.md`, `PHASE_STATUS.md`, GitHub Actions

## Verification result

The latest verified `main` checkpoint is:

`076e7863073fa10a1e78624de9467531464242fb`

Current `main` head is `076e7863073fa10a1e78624de9467531464242fb`; this head is covered by the latest successful CI and Phoenix verification runs.

Both required workflows passed:

- **CI:** current head verification run `35896040161` — success
- **Phoenix verification:** current head run `35896039974` — success

The latest verification run on the current `main` head completed successfully. The repository's CI/verification workflows are now the authoritative validation result for build, typecheck, migration integrity and tests on this head.

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

Current canonical migrations reach `0054_discovery_index_observability.sql`.

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

1. Scheduled Automation polling, misfire handling, and CapabilityRegistry-backed scheduled action execution are implemented; only concrete rollback/compensation contracts remain gated.
2. Integration durable claim/sync workers and provider-neutral adapter boundary are implemented; provider-specific adapters and credential contracts remain external integration work.
3. Privacy consent expiry and subject-level organization/workspace validation are live; export/delete/retention workers remain.
4. External Communication provider adapters plus consent/anti-spam policy remain gated; template registry and provider-neutral dispatch are live.
5. AI durable worker lease/claim/reclaim infrastructure and the Seller AI production scheduler/input resolver are implemented; new AI operation types require an explicit resolver contract.
6. Matching learning signals and broader Act integrations beyond the canonical Customer relationship/Connect path.
7. CustomerProfile is resolved as a logical aggregate over existing Customer-owned records; CRM timeline is already physically implemented as events/projection input.
8. Localization context interfaces are implemented; physical country/legal/profile registries, Documents and Analytics remain contract-gated.
9. Case queue/provider dispatch remains external-provider gated; CaseAction approval/completion and CapabilityRegistry-backed execution are implemented. Remote D1 provisioning and production binding configuration remain the final infrastructure gate.

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
