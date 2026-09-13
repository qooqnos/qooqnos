# Phoenix Repository Deep Audit — 2026-09-13

## Purpose

This audit records the architecture-to-code review of the repository after the foundation, database runtime, authorization, onboarding, localization, security, API, frontend, infrastructure, analytics, search, media, billing, notifications, dashboards, reviews and related contracts were established.

The goal is to prevent duplicated capabilities, hidden cross-module invariants, unsafe tenancy assumptions, and implementation drift.

## Reviewed areas

- Core/runtime boundaries and request context
- Database adapter, repositories, transactions and services
- Migration catalog/runner and SQL migrations
- Identity and workspace foundations
- Authorization runtime and policy boundaries
- Onboarding module, authorization, repository and atomicity paths
- i18n/localization foundation
- Security architecture and implementation skill
- API contract/error/versioning architecture
- Marketplace discovery/search architecture
- Media architecture
- Analytics architecture
- Customer experience, dashboards and billing contracts
- Notifications, reviews/reputation and related skills
- Repository bootstrap, implementation blueprint and technology standards
- Claude Code source-of-truth conventions
- README/repository documentation alignment

## Findings and remediation

### 1. Fresh-D1 migration bootstrap — fixed

The migration runner previously queried `schema_migrations` before guaranteeing that the metadata table existed. On a truly empty D1 this made the runner unable to bootstrap migration 0001.

Remediation: the runner now creates `schema_migrations` with `CREATE TABLE IF NOT EXISTS` before reading migration history. Migration 0001 remains idempotent with the same table definition.

### 2. Idempotency race — fixed

The previous idempotency claim path performed a read followed by an insert. Concurrent identical requests could both observe no record and race to claim the same key.

Remediation: claim is now a single SQLite UPSERT. A live key is left unchanged; an expired key can be atomically replaced. The result metadata determines ownership, and a conflicting live fingerprint is rejected.

### 3. Onboarding optimistic concurrency — fixed

The service checked the expected status before issuing the update, but the update itself did not include the expected status predicate. Two concurrent transitions could therefore pass the initial read and both write.

Remediation: transactional status updates now use compare-and-swap semantics (`... AND status = expectedStatus`) and require exactly one changed row before audit/outbox statements are accepted as part of the transaction.

### 4. Onboarding owner tenancy — fixed at repository boundary

The owner foreign key proves user existence but does not prove that the owner is an active member of the target workspace or that the workspace belongs to the supplied organization.

Remediation: onboarding creation now verifies an active membership joined through the target workspace and its organization before inserting the profile.

### 5. Organization/workspace consistency — guarded, structural hardening remains

The current foundation schema carries organization and workspace identifiers in multiple records. Some relationships are enforced through foreign keys while cross-entity consistency is additionally guarded by repository/service context checks.

Decision: do not perform a destructive schema rewrite during foundation stabilization. A future migration may introduce composite constraints where they materially improve invariant enforcement without duplicating domain logic.

### 6. Migration checksum model — acceptable for current foundation, hardening planned

The runtime validates the checksum declared by each migration definition against the SQL source and validates applied checksums against the runtime definition. This detects post-application source drift.

Remaining limitation: a modified migration source with a correspondingly modified declared checksum is not prevented by runtime code alone on first deployment. A committed, independently reviewed migration manifest/lock should be added before production migration automation is considered complete.

### 7. Build/CI completeness — next implementation gate

Architecture contracts define an install → format → lint → typecheck → unit → contract → build verification chain, but the repository still needs the complete root workspace/tooling/CI layer to make that contract executable end-to-end.

This is the next foundation implementation area after the current correctness fixes.

### 8. Documentation source-of-truth — aligned

`CLAUDE.md` establishes `.claude/skills/` as the authoritative Claude Code skill location. The README previously pointed generically to `skills/`; it now points explicitly to `docs/` and `.claude/skills/`.

## Non-negotiable architectural invariants

1. D1 is the relational source of truth.
2. Every request requiring tenant context must carry organization/workspace context explicitly.
3. Authorization is enforced at runtime boundaries, not only in UI/API handlers.
4. Resource access must be tenant-scoped and workspace-scoped where applicable.
5. Cross-tenant ownership cannot be inferred from a user foreign key alone.
6. State transitions that emit audit/outbox records must be atomic.
7. Concurrent state transitions must use compare-and-swap or equivalent database-level guards.
8. Idempotency claims must be atomic at the database boundary.
9. AI output is constrained by schema, policy and domain rules.
10. Medical capabilities remain non-diagnostic and non-prescriptive and require appropriate verification/privacy controls.
11. Each capability is implemented once in its owning module and reused through stable contracts.
12. New architecture decisions must be recorded in `docs/` and reflected in the relevant `.claude/skills/` contract before implementation expands.

## Current implementation gate

Foundation correctness is ahead of feature breadth. The repository should not accelerate into additional marketplace features until the root build/CI contract, migration lock strategy, and automated tests for the repaired invariants are in place.

## Progress

- Architecture/documentation baseline: approximately 90%
- Foundation/runtime/database correctness: approximately 82%
- Executable build/test/CI foundation: approximately 35%
- Marketplace feature implementation: intentionally early; architecture exists ahead of feature code

These percentages are directional architecture-progress indicators, not product-completion metrics.
