---
name: phoenix-discovery
description: Rules for Phoenix discovery, matching, eligibility, ranking, personalization, supply quality, cache isolation, and safety.
---

# Phoenix Discovery Skill

Native Claude Code entrypoint. Read `docs/PHOENIX_PRODUCT_NORTH_STAR.md`, `docs/CAPABILITY_DECISION_RULES.md`, `skills/phoenix-discovery/SKILL.md` and `docs/DISCOVERY_MATCHING_ARCHITECTURE.md` before discovery work.

## Product Direction
Discovery is a core part of Phoenix's intelligent decision and connection layer. Better structured and enriched seller supply improves retrieval, ranking, matching, and customer outcomes. Discovery consumes governed catalog supply; it must not create authoritative commercial facts itself.

## Rules
- Hard constraints are deterministic gates; semantic similarity never overrides eligibility.
- Authorization, tenant/resource visibility, verification, geography, price, availability, and legal policy are checked before candidate exposure.
- D1/domain services are authoritative; indexes/vector stores are projections.
- Preserve explicit vs inferred constraints; explicit hard constraints win.
- Ranking policies are versioned and evidence is observable.
- Explanations are grounded in actual signals.
- Personalized results are never globally cached.
- AI cannot invent marketplace facts or mutate ranking policy without approved mechanisms.
- Medical discovery is matching/information only; no diagnosis/treatment/medication advice.

## Done
Test hard constraints, cross-tenant isolation, supply quality effects, unverified providers, stale indexes, false positives, cold start, pagination, explanations, cache isolation, prompt injection, and medical boundaries.
