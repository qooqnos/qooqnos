# Phoenix Discovery Skill

## Purpose

Use this skill when implementing, reviewing, or changing Phoenix search, discovery, matching, ranking, recommendation, facets, or marketplace retrieval.

## Required Reading

Read before implementation:

1. `CLAUDE.md`
2. `docs/PHOENIX_ARCHITECTURE.md`
3. `docs/MODULE_ARCHITECTURE.md`
4. `docs/CORE_RUNTIME_ARCHITECTURE.md`
5. `docs/AI_ARCHITECTURE.md`
6. `docs/DISCOVERY_MATCHING_ARCHITECTURE.md`
7. `docs/AUTHORIZATION_ARCHITECTURE.md`
8. `docs/SECURITY_ARCHITECTURE.md`

Also read the owning domain module and its manifest.

## Non-Negotiable Rules

- Hard constraints are deterministic gates.
- Semantic similarity can never override eligibility.
- Tenant/resource authorization happens before exposing candidates.
- D1/domain services are authoritative; search/vector indexes are projections.
- AI cannot invent price, availability, inventory, credentials, or capabilities.
- User-explicit hard constraints outrank inferred preferences.
- Ranking policies are versioned.
- Ranking evidence must be observable.
- User-facing explanations must be grounded in actual signals.
- Personalized results must never be globally cached.
- Medical discovery is matching/discovery only; no diagnosis or treatment advice.

## Implementation Workflow

### 1. Normalize the Request

Create a typed `DiscoveryRequest` containing:

- actor context;
- tenant/workspace;
- locale;
- intent;
- filters;
- preferences;
- location;
- budget;
- availability;
- pagination.

Preserve the distinction between explicit and inferred values.

### 2. Apply Eligibility

Before semantic retrieval, enforce:

- authorization;
- tenant isolation;
- resource visibility;
- provider/business status;
- verification;
- category/service compatibility;
- geographic constraints;
- price hard limits;
- inventory/availability policy;
- legal/country restrictions.

Never implement eligibility as a ranking penalty.

### 3. Retrieve Candidates

Use a combination of:

- structured retrieval;
- lexical retrieval;
- semantic retrieval.

All retrieval must preserve tenant, locale, visibility, and resource metadata filters.

### 4. Rank

Use a versioned ranking policy.

Candidate ranking may consider:

- semantic fit;
- constraint fit;
- service fit;
- quality;
- location;
- price;
- availability;
- preference fit;
- freshness.

Do not introduce payment tier or popularity as a ranking signal without explicit product/governance approval.

### 5. Explain

Generate explanations from recorded ranking evidence.

Bad:

```text
"This salon is the best for you."
```

Good:

```text
"It matches your requested service, area, budget, and style preference."
```

### 6. Index Correctly

Domain mutation flow:

```text
D1 transaction -> outbox -> index job -> search/vector projection
```

Index jobs must be idempotent and version-aware.

Never make the vector index the source of truth.

## AI Integration

AI may:

- parse natural language;
- extract intent;
- suggest filters;
- retrieve semantic candidates;
- rerank candidates;
- generate grounded explanations.

AI may not:

- bypass authorization;
- override hard filters;
- fabricate marketplace facts;
- mutate ranking policy dynamically without an approved policy mechanism.

## Medical Boundary

For medical discovery:

Allowed:

- verified provider discovery;
- specialty/service matching;
- location and availability matching;
- provider-published information.

Forbidden:

- diagnosis;
- medication recommendation;
- treatment recommendation;
- inferring a disease and ranking providers based on that diagnosis;
- clinical claims not backed by approved provider/domain data.

## Pagination

Prefer cursor-based pagination for ranked results.

The cursor must be scoped to the actor/tenant and compatible with the ranking policy version.

Do not expose raw offsets as the permanent marketplace contract.

## Testing Requirements

Every discovery feature should test:

- explicit hard constraints;
- conflicting constraints;
- unauthorized resources;
- cross-tenant leakage;
- unverified providers;
- stale indexes;
- semantic false positives;
- cold-start businesses;
- ranking ties;
- pagination consistency;
- explanation grounding;
- cache isolation;
- prompt injection from indexed content.

Medical discovery additionally requires safety-boundary tests.

## Performance Rules

- Filter early.
- Select only required fields.
- Avoid N+1 domain queries.
- Batch embedding/index jobs.
- Cache only safe derived results.
- Keep personalized caches private.
- Measure each pipeline stage separately.
- Prefer asynchronous indexing after domain writes.

Do not sacrifice tenant isolation or correctness for latency.

## Claude Code Acceptance Checklist

- [ ] Discovery request/result contracts are typed.
- [ ] Domain adapter exists.
- [ ] Eligibility is deterministic.
- [ ] Authorization precedes result exposure.
- [ ] Indexes are derived data.
- [ ] Semantic retrieval is metadata-scoped.
- [ ] Ranking policy is versioned.
- [ ] Ranking signals are observable.
- [ ] Explanations are grounded.
- [ ] Cursor/pagination is tenant-safe.
- [ ] Personalization respects hard constraints.
- [ ] Cold-start behavior exists.
- [ ] Abuse/ranking manipulation is considered.
- [ ] Multilingual cases are tested.
- [ ] Medical boundaries are tested when relevant.
