# Phoenix Discovery Skill

Native Claude Code entrypoint. Read `skills/phoenix-discovery/SKILL.md` and `docs/DISCOVERY_MATCHING_ARCHITECTURE.md` before discovery work.

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
Test hard constraints, cross-tenant isolation, unverified providers, stale indexes, false positives, cold start, pagination, explanations, cache isolation, prompt injection, and medical boundaries.
