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

## Homepage Product Gate

When working on the Phoenix Homepage (`/`), read `docs/HOMEPAGE_PRODUCT_CONTRACT.md` before changing code.

The Homepage is Phoenix's Intelligent Decision & Matching experience, not a Dashboard. Its primary interaction is customer demand expressed in natural language, followed by understanding, decision, matching, connection and action.

Do not make revenue/KPI cards, product management, CRM, analytics, booking management, operational tables, or administrative navigation the dominant Homepage experience. Those capabilities belong to dedicated operational routes.

Authenticated users must not be redirected from `/` into a Dashboard merely because they are signed in.

Before changing `/`, inspect and reuse existing canonical Demand, Discovery, Matching, AI, Design System and authentication capabilities. Do not create parallel implementations or fabricate production intelligence.

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

## Canonical Continuity State

The authoritative implementation ledger is \`docs/IMPLEMENTATION_LEDGER.md\`. Do not maintain a second capability/migration ledger in this file.

Current verified architecture state is summarized in \`VERIFICATION.md\` and \`PHASE_STATUS.md\`. Always read those plus the implementation ledger before substantial continuation work.

## Agent Operating Rules

1. Never duplicate a completed capability, repository, table, service, runtime boundary, or provider owner.
2. Continue from the latest ledger/checkpoint instead of re-reviewing the entire repository.
3. For schema work, use exactly one module-owned numbered migration and preserve migration-lock integrity.
4. For runtime work, keep tenant/workspace authorization and module ownership explicit.
5. Add/update focused tests for each meaningful invariant.
6. Commit directly to \`main\` unless the user explicitly asks for a branch or PR.
7. After each meaningful slice, update \`docs/IMPLEMENTATION_LEDGER.md\` and continue to the next safe slice.
8. Stop only at a genuine external/provider/infrastructure gate or actual project completion.

## Rules

1. Never duplicate a capability marked `COMPLETED`.
2. Reuse existing services, abstractions and infrastructure.
3. Update this file after every meaningful implementation.
4. Record the commit hash for completed work.
5. Keep this file concise.
6. Do not turn this file into general documentation.
7. Detailed architecture belongs in `docs/`.
8. Implementation-specific operating rules belong in `.claude/skills/`.


## Social Commerce UI Product Gate

When working on the customer-facing social commerce experience, read `docs/SOCIAL_COMMERCE_UI_PRODUCT_CONTRACT.md` before changing code.

Phoenix may use familiar social interaction patterns such as Feed, Following, Explore, Create, Activity and Profile, but its content is primarily products and services and its purpose remains intelligent decision, matching and connection.

The Social Commerce UI must reuse canonical Discovery, Catalog, Commerce, Checkout, Trust, Seller AI and Design System capabilities. Do not create a parallel recommendation engine, commerce source of truth, product model, or fabricated personalization signals in the web app.

The first implementation slice must preserve the comparison interaction: selecting two or more comparable products exposes a visible/sticky Compare action without losing browsing context. Instant Buy must reuse the existing canonical checkout/commerce boundary.
