# Phoenix Current Verification

**Status:** Current engineering verification snapshot  
**Last verified:** 2026-09-23  
**Authoritative sources:** `docs/IMPLEMENTATION_LEDGER.md`, `PHASE_STATUS.md`, GitHub Actions

## Verification result

The latest code-bearing `main` checkpoint verified in GitHub Actions is:

`e5ffb4f87eb05f5e3521f9d81fad53ea5a913944`

Both required workflows passed:

- **CI:** run `35867835880` — success
- **Phoenix verification:** run `35867835863` — success

The verification path passed format/lint checks, migration-lock verification, TypeScript typecheck, workspace build, and the unit-test suite: **69 test files / 195 tests passed**.

The current `main` head is `a2542730d92a57c5554a590b62e5cbd9baf99cae`; commits after the latest code-bearing checkpoint are documentation/status reconciliation only, so the verified application code remains unchanged.

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

Current canonical migrations reach `0053_ai_runtime_worker_leases.sql`.

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

1. Scheduled Automation polling, misfire handling, and CapabilityRegistry-backed scheduled action execution are implemented; compensation remains gated by concrete rollback contracts.
2. Integration durable claim/sync workers and provider-neutral adapter boundary are implemented; provider-specific adapters and credential contracts remain external integration work.
3. Privacy consent expiry is live; export/delete/retention workers with subject-level identity validation remain.
4. External Communication provider adapters plus consent/anti-spam policy remain gated; template registry and provider-neutral dispatch are live.
5. AI durable worker lease/claim/reclaim infrastructure is implemented; production scheduler execution remains gated by an explicit canonical input/payload resolver.
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
