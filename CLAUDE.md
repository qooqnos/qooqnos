# Phoenix Implementation Ledger

> Persistent implementation state for all Claude Code sessions.
>
> This file prevents duplicate implementation and unnecessary repository re-analysis.


## Phoenix Product North Star

Phoenix is fundamentally an intelligent decision and connection layer between customers and businesses.

Canonical loop:

`Understand Demand → Understand Supply → Decide → Match → Connect → Act → Learn`

Marketplace, Catalog, Discovery, Booking, CRM, Billing and AI are supporting capabilities that strengthen this loop; they are not independent product identities.

Before designing or coding a capability, verify that it strengthens the Phoenix loop. A technically correct capability that does not strengthen the loop requires explicit product justification.

Canonical product-direction documents:

- `docs/PHOENIX_PRODUCT_NORTH_STAR.md`
- `docs/AI_PRODUCT_DIRECTION.md` when AI is involved
- `docs/CAPABILITY_DECISION_RULES.md`
- `docs/SELLER_AI_PRODUCT_CREATION_CONTRACT.md` for seller-side AI supply creation

## Implementation Continuation Protocol

Every session continues from `docs/IMPLEMENTATION_LEDGER.md`, not from memory or a fresh repository re-analysis.

When the user says `ادامه`, `continue`, or otherwise asks to keep implementing:

1. inspect the ledger and latest verified checkpoint;
2. continue the highest-priority open capability without asking for confirmation unless a real external dependency blocks execution;
3. reuse completed canonical implementations and never create a parallel owner/source of truth;
4. make a small coherent implementation slice;
5. add or update tests for critical invariants;
6. commit the slice directly to `main` unless the user explicitly requests a branch/PR;
7. update `docs/IMPLEMENTATION_LEDGER.md` with the capability, files, migration ids, tests, commit and remaining gate;
8. continue to the next safe slice automatically.

Do not stop merely because the current slice is complete. Stop only at a real external/provider/infrastructure gate or when the project completion criteria are actually satisfied.

## Current Architecture Guard

D1 is the canonical relational source of truth. Do not reintroduce PostgreSQL, ORM-specific schema ownership, a second in-memory database path, or duplicate domain tables. Physical schema evolution must use a new numbered migration and preserve `migrations/migration-lock.json` integrity.

Read `docs/IMPLEMENTATION_LEDGER.md`, `docs/DATABASE_PHYSICAL_RECONCILIATION.md`, and `docs/PHYSICAL_SCHEMA_BLUEPRINT.md` before substantial schema work.

## Status Definitions

* `PLANNED` — Not implemented.
* `IN_PROGRESS` — Currently being implemented.
* `COMPLETED` — Implemented, verified and committed.
* `BLOCKED` — Cannot proceed without resolving a dependency.
* `NEEDS_REVIEW` — Existing implementation requires investigation.
* `DEPRECATED` — No longer part of the active architecture.

---

## Completed Capabilities

| Capability | Module | Status | Implementation | Tests | Commit |
| ---------- | ------ | ------ | -------------- | ----- | ------ |
| —          | —      | —      | —              | —     | —      |

---

## In Progress

| Capability | Module | Status | Current Work | Files |
| ---------- | ------ | ------ | ------------ | ----- |
| —          | —      | —      | —            | —     |

---

## Remaining Work

| Capability | Module | Status | Dependencies | Notes |
| ---------- | ------ | ------ | ------------ | ----- |
| —          | —      | —      | —            | —     |

---

## Architectural Implementations

| Component | Location | Status | Commit | Do Not Duplicate |
| --------- | -------- | ------ | ------ | ---------------- |
| —         | —        | —      | —      | —                |

---

## Database / Migration Implementations

| Domain | Tables / Migration | Status | Commit |
| ------ | ------------------ | ------ | ------ |
| —      | —                  | —      | —      |

---

## Important Existing Services

| Service / Abstraction | Location | Purpose | Status |
| --------------------- | -------- | ------- | ------ |
| —                     | —        | —       | —      |

---

## Session Continuation Notes

Only record information required for the next implementation session.

* Current implementation area:
* Next capability:
* Blocking issue:
* Important dependency:
* Last commit:
* Last verification:

---

## Rules

1. Never duplicate a capability marked `COMPLETED`.
2. Reuse existing services, abstractions and infrastructure.
3. Update this file after every meaningful implementation.
4. Record the commit hash for completed work.
5. Keep this file concise.
6. Do not turn this file into general documentation.
7. Detailed architecture belongs in `docs/`.
8. Implementation-specific operating rules belong in `.claude/skills/`.
