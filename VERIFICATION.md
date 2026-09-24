# Phoenix Current Verification

**Status:** Verification snapshot; pending post-checkpoint verification  
**Last verified:** 2026-09-24  
**Authoritative sources:** `docs/IMPLEMENTATION_LEDGER.md`, `PHASE_STATUS.md`, GitHub Actions

## Verification result

The latest fully verified checkpoint remains:

`3f3192819a9879fb453070e82e04785b3fea5e80`

Current `main` contains subsequent implementation/documentation commits and has not yet produced a new successful CI/Phoenix verification run. The prior checkpoint remains the verification baseline.

Both required workflows passed for the prior verified checkpoint:

- **CI:** current head verification run `35918117117` — success
- **Phoenix verification:** current head run `35918117178` — success

The prior verification run completed successfully. Validation on that checkpoint includes migration-lock integrity, canonical-source legacy boundary, runtime-module registry completeness, migration-history checks, lint, typecheck, build, Cloudflare Worker dry-run and unit tests.

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

Current canonical migrations reach `0063_catalog_attribute_cutover.sql`.

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
- Billing owns commercial entitlement/usage authority; invoice/refund financial truth and the provider execution adapter boundary are implemented under Billing/Payment, with provider credentials kept outside domain storage.
- Booking slots remain derived projections; there is no authoritative slots table.

## Repository continuity guards

- `npm run verify:migrations` validates the canonical SQL migrations and their lock manifest.
- `npm run verify:source-boundary` fails if canonical application packages reintroduce legacy InMemory/PostgreSQL/database compatibility paths outside the explicit compatibility allowlist.
- `npm run verify:runtime-registry` fails if a package manifest is missing from the canonical API runtime module registry.

## Remaining completion gates

The physical schema is intentionally broad but not every operational concern is closed. Remaining work is primarily execution rather than schema invention:

1. Scheduled Automation polling, misfire handling, and CapabilityRegistry-backed scheduled action execution are implemented; only concrete rollback/compensation contracts remain gated.
2. Integration durable claim/sync workers and provider-neutral adapter boundary are implemented; the credential resolver contract, runtime-configured HTTP adapter and signed webhook verification are implemented. Concrete vendor onboarding remains external operational work.
3. Privacy consent expiry, subject scope validation, approved-request orchestration and the domain PrivacyProcessor registry are live; Customer export/delete processors and the tenant-safe retention sweep are implemented.
4. Communication intent/consent/suppression policy, template registry, provider-neutral dispatch, runtime-configured HTTP provider adapters, scoped dispatch rate limits and bounded burst-anomaly detection are implemented; provider credentials remain runtime configuration.
5. AI durable worker lease/claim/reclaim infrastructure and the Seller AI production scheduler/input resolver are implemented; new AI operation types require an explicit resolver contract.
6. Matching learning signals and broader Act integrations beyond the canonical Customer relationship/Connect path.
7. CustomerProfile is resolved as a logical aggregate over existing Customer-owned records; CRM timeline is already physically implemented as events/projection input.
8. Localization context interfaces are implemented; physical country/legal/profile registries, Documents and Analytics remain contract-gated.
9. Case queue/provider dispatch remains external-provider gated; CaseAction approval/completion and CapabilityRegistry-backed execution are implemented. Production D1 is externally provisioned; credentialed remote migration/application and final binding configuration remain the infrastructure gate.

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
