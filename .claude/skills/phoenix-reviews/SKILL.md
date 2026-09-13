---
name: phoenix-reviews
description: Rules for Phoenix reviews, reputation, moderation, trust, eligibility, anti-abuse controls, privacy, and derived ranking signals.
---
# Phoenix Reviews, Reputation & Trust Skill

Use `docs/REVIEWS_REPUTATION_TRUST_ARCHITECTURE.md` as the canonical architecture reference before Reviews, reputation, moderation, or trust work.

## Non-negotiables
- Reviews are evidence of marketplace interactions, not a source of identity, verification, booking, or billing truth.
- Review eligibility is determined server-side from authoritative interaction state.
- Reputation is a recalculable derived projection, never the sole source of truth.
- Hard eligibility and policy constraints always outrank reputation in Discovery.
- Moderation and reputation operations require server-side authorization, tenant isolation, auditability, and separation of duties.
- AI is advisory: classify, summarize, translate, detect probable abuse, or draft; it cannot directly publish/remove, grant eligibility, alter aggregates, or bypass policy.
- Never expose private moderation evidence, risk signals, customer private data, or sensitive health information.
- Medical review content must not become diagnosis, treatment, or medication advice.
- Anti-gaming controls must address self-review, manipulation, spam, retaliation, bombing, and coordinated abuse.
- Cross-module access uses public contracts/events, never private-table SQL.

## Workflow
Inspect authoritative interaction state → validate eligibility → apply policy → authorize → execute domain command → audit/outbox → update projections → verify Discovery effects.

## Done
Verify migrations/schema, eligibility, tenant isolation, object authorization, moderation, reputation recalculation, anti-abuse behavior, privacy/masking, localization, idempotency, audit/outbox, tests, and ranking integration.
