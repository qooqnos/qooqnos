# Phoenix Discovery & Matching Architecture

> Status: Architecture baseline
> Scope: Search, discovery, candidate retrieval, matching, ranking, recommendations, and marketplace discovery APIs

## 1. Purpose

Discovery is the marketplace engine that turns a user's natural-language need into eligible, relevant, explainable business/service results.

Core pipeline:

```text
User request
  -> Intent normalization
  -> Constraint extraction
  -> Deterministic eligibility
  -> Candidate retrieval
  -> Ranking
  -> Policy validation
  -> Explanation
  -> Results
```

AI improves understanding and ranking, but domain data and deterministic policy remain authoritative.

## 2. Core Invariants

1. An ineligible candidate can never rank into the final result set.
2. Tenant/workspace visibility is enforced before semantic retrieval results are exposed.
3. AI cannot invent price, availability, credentials, inventory, or service capability.
4. Search indexes are derived data; D1/domain services remain authoritative.
5. Ranking is reproducible from recorded signals and versions.
6. User-declared hard constraints outrank inferred preferences.
7. Medical providers must satisfy verification policy before discovery activation.
8. Country/legal rules are adapters around the Core, not embedded in ranking logic.

## 3. Discovery Domains

The engine supports multiple marketplace domains without creating separate search architectures.

Initial domains:

- beauty;
- fashion;
- medical via controlled partner/pilot.

Future domains may include:

- real estate;
- restaurants/hotels;
- education;
- automotive;
- professional services.

Each domain supplies a typed discovery adapter defining:

- searchable resources;
- hard eligibility rules;
- ranking signals;
- filters;
- explanation fields;
- safety/regulatory policy.

## 4. Canonical Search Request

The application layer should normalize all discovery requests into a typed contract.

```ts
interface DiscoveryRequest {
  actor: ActorContext;
  tenantId: string;
  locale: string;
  intent: string;
  queryText?: string;
  filters: DiscoveryFilters;
  preferences: DiscoveryPreference[];
  location?: GeoConstraint;
  budget?: MoneyRange;
  availability?: AvailabilityConstraint;
  pagination: Pagination;
}
```

The original natural-language text may be retained for traceability, but downstream services must operate on structured constraints.

## 5. Constraint Classes

Every constraint is classified as one of:

```text
hard-explicit
hard-policy
soft-explicit
soft-inferred
system-derived
```

### Hard constraints

Examples:

- provider is not verified;
- service category mismatch;
- outside requested location radius;
- price exceeds explicit maximum;
- product unavailable;
- provider is disabled;
- user has no access to the resource.

Hard constraints remove candidates.

### Soft constraints

Examples:

- preferred style;
- preferred brand;
- aesthetic similarity;
- secondary location preference;
- inferred taste.

Soft constraints affect ranking only.

## 6. Retrieval Pipeline

```text
                +------------------+
                | Structured query |
                +---------+--------+
                          |
             +------------+------------+
             |                         |
             v                         v
      deterministic filters      semantic/lexical retrieval
             |                         |
             +------------+------------+
                          v
                   candidate union
                          |
                          v
                   deduplication
                          |
                          v
                     reranking
                          |
                          v
                  policy validation
                          |
                          v
                    final results
```

The retrieval implementation may use D1 indexes, text search, Vectorize, or other approved infrastructure, but the public contract stays stable.

## 7. Deterministic Eligibility

Eligibility must run before final ranking.

Typical checks:

- tenant scope;
- resource visibility;
- account/business status;
- provider verification;
- category/service relationship;
- geographic eligibility;
- price constraints;
- inventory/status;
- legal/country policy;
- consent requirements where relevant.

The result should contain an explicit eligibility decision rather than merely a score.

## 8. Semantic Retrieval

Semantic retrieval is used to find conceptually relevant candidates when exact keywords are insufficient.

Example:

```text
"برای یک مراسم رسمی یک مدل موی طبیعی می‌خوام"
```

may map to concepts such as:

- formal occasion;
- natural hairstyle;
- hair styling;
- beauty service.

Semantic retrieval must remain scoped by tenant, locale, resource visibility, and resource status.

Vector metadata should include:

- resource ID;
- module ID;
- tenant/workspace scope;
- resource type;
- locale;
- version;
- visibility/status.

## 9. Indexing Architecture

Search indexes are projections of domain data.

```text
D1 transaction
    |
    v
Outbox event
    |
    v
Index job
    |
    +--> lexical/structured index
    |
    +--> embedding generation
    |
    v
Vector/search projection
```

Writes to authoritative records and indexing should not be treated as one atomic operation across systems. The outbox/job pipeline provides eventual synchronization.

Every indexed document needs a version or source timestamp so stale projections can be detected.

## 10. Ranking Model

Ranking combines deterministic and learned/AI signals.

Conceptually:

```text
score = weighted(
  semanticFit,
  constraintFit,
  serviceFit,
  qualitySignal,
  locationFit,
  priceFit,
  availabilityFit,
  preferenceFit,
  freshness
)
```

The exact weights should be configurable by versioned ranking policy, not scattered through feature code.

Never allow:

```text
low eligibility + high semantic similarity = final result
```

Eligibility is a gate, not a feature.

## 11. Ranking Explainability

Each final result should have internal ranking evidence.

Example:

```json
{
  "candidateId": "...",
  "signals": {
    "serviceFit": 0.98,
    "locationFit": 0.91,
    "priceFit": 0.84,
    "preferenceFit": 0.88
  },
  "policyVersion": "beauty-ranking@1.2.0"
}
```

User-facing explanations must be generated only from actual signals and authoritative data.

## 12. Business Quality Signals

Quality signals must be defined carefully to avoid hidden or unfair ranking.

Potential signals:

- verified status;
- profile completeness;
- service quality indicators;
- portfolio completeness;
- reliable operating history;
- response behavior;
- customer feedback where governance permits;
- freshness of information.

Do not rank solely by:

- payment tier;
- advertising spend;
- raw popularity;
- model-generated sentiment.

If paid plans influence placement, the policy must be explicit, measurable, and auditable.

## 13. Cold Start

New businesses should not be invisible merely because they lack interaction history.

Cold-start signals can use:

- verified profile data;
- service/category fit;
- location;
- portfolio metadata;
- price compatibility;
- availability;
- explicit business attributes.

Historical engagement should be a supplementary signal, not a prerequisite for discoverability.

## 14. Diversity

The result set should avoid returning near-identical candidates when diversity improves user choice.

Possible diversity dimensions:

- provider/business;
- style;
- price tier;
- location;
- brand/product;
- service subtype.

Diversity is applied after eligibility and before final presentation.

## 15. Pagination

Pagination must operate on a stable result policy.

For ranking that may change rapidly:

- use cursor-based pagination where practical;
- encode ranking policy/version in the cursor;
- prevent unauthorized cursor reuse across tenants/users;
- expire cursors when appropriate.

Do not expose raw database offsets as the long-term marketplace pagination contract.

## 16. Personalization

Personalization uses explicit preferences first.

```text
explicit user constraint
    > explicit preference
    > durable approved preference
    > contextual inference
```

Personalization must never weaken:

- authorization;
- verification;
- legal eligibility;
- safety policy;
- explicit hard constraints.

## 17. Recommendation vs Search

These are related but distinct modes.

### Search

User asks for something specific.

Goal: satisfy explicit constraints and return relevant candidates.

### Recommendation

User asks what may suit them.

Goal: explore candidates using preferences and contextual signals.

The same retrieval infrastructure may serve both, but their ranking policies and explanations should be distinguishable.

## 18. Discovery API Boundary

Recommended API shape:

```text
POST /api/v1/discovery/search
POST /api/v1/discovery/recommend
GET  /api/v1/discovery/suggestions
GET  /api/v1/discovery/facets
```

The API layer performs:

- authentication context;
- tenant resolution;
- schema validation;
- rate limiting;
- request tracing.

The application layer owns discovery orchestration.

## 19. Facets and Filters

Facets should be generated from authoritative/indexed fields.

Examples:

- category;
- service;
- price range;
- location;
- rating/quality bands;
- availability;
- brand;
- style;
- verification status where user-facing.

AI may suggest filters, but cannot fabricate facet values.

## 20. Location

Location matching should use normalized geographic data.

The engine may support:

- city;
- neighborhood;
- radius;
- travel distance;
- service-at-location.

Geographic calculations belong to deterministic infrastructure, not the LLM.

## 21. Availability

Availability is mutable and must be retrieved from the booking/domain source when it affects a decision.

Cached/indexed availability may be used only where the freshness policy permits it.

The AI must never claim that a slot is available based solely on generated text.

## 22. Price

Money must remain canonical in domain representation.

Discovery should normalize:

- currency;
- minor units;
- minimum/maximum price;
- package pricing where defined.

AI may interpret phrases such as “اقتصادی” or “تا پنج میلیون”، but the normalized budget must be validated before ranking.

## 23. Medical Discovery Boundary

Medical discovery is provider/service matching only.

Allowed signals:

- verified professional/provider status;
- specialty/service category;
- location;
- availability;
- provider-published information;
- user-requested service category.

Forbidden behavior:

- diagnosing from symptoms;
- ranking a doctor because the model believes the user has a condition;
- recommending medication/treatment;
- presenting unverified clinical claims as facts.

Sensitive health information must be minimized and handled according to consent/privacy policy.

## 24. Country and Legal Adapters

Core discovery must remain country-neutral.

Country adapters can define:

- required verification states;
- restricted categories;
- advertising rules;
- currency;
- location conventions;
- regulated-service requirements.

Example:

```ts
interface DiscoveryPolicyAdapter {
  canDiscover(resource: ResourceContext): PolicyDecision;
  getRequiredVerification(resourceType: string): VerificationRequirement;
  filterRestrictedCategories(input: DiscoveryRequest): PolicyDecision;
}
```

## 25. Abuse and Manipulation Resistance

Marketplace discovery is vulnerable to ranking manipulation.

Controls should include:

- rate limits;
- anomaly detection;
- duplicate/fake listing detection;
- review integrity controls;
- audit trails for ranking policy changes;
- bounded influence of engagement signals;
- human moderation workflows.

No business should be able to directly manipulate its ranking score through client-supplied fields.

## 26. Caching

Cache safe derived results where freshness allows.

Cache keys must include privacy and policy scope, for example:

```text
tenant + locale + normalized-query + filter-hash + ranking-policy-version
```

Do not cache personalized results globally.

Mutable data such as availability requires explicit TTL/version invalidation.

## 27. Observability

Record:

- request ID;
- tenant/workspace;
- normalized intent;
- filter set;
- candidate counts by pipeline stage;
- ranking policy version;
- retrieval source/version;
- latency;
- cache status;
- final result IDs;
- policy exclusions;
- error/degradation state.

Sensitive query content must follow AI/data-classification logging rules.

## 28. Evaluation

Discovery evaluation should use datasets covering:

- exact queries;
- natural-language queries;
- Persian/multilingual queries;
- ambiguous queries;
- budget constraints;
- location constraints;
- unavailable candidates;
- unverified providers;
- cold-start businesses;
- adversarial ranking manipulation;
- prompt injection in indexed content.

Measure at least:

- eligibility precision;
- retrieval recall;
- ranking quality;
- constraint satisfaction;
- diversity;
- explanation grounding;
- latency;
- cost.

Medical discovery requires separate safety datasets.

## 29. Implementation Sequence

1. Define `DiscoveryRequest` and result contracts.
2. Implement deterministic filters.
3. Implement domain discovery adapters.
4. Build indexed projections from D1/outbox.
5. Add lexical/structured retrieval.
6. Add Vectorize semantic retrieval.
7. Add ranking policy engine.
8. Add explanations from ranking evidence.
9. Add personalized recommendations.
10. Add diversity/cold-start controls.
11. Add evaluation harness.
12. Optimize caching and latency.

## 30. Definition of Done

Discovery is production-ready when:

- [ ] request/result schemas are versioned;
- [ ] tenant isolation is tested;
- [ ] hard eligibility is deterministic;
- [ ] search indexes are derived from authoritative data;
- [ ] stale index behavior is defined;
- [ ] ranking policy is versioned;
- [ ] ranking signals are observable;
- [ ] explanations are grounded;
- [ ] pagination is stable;
- [ ] personalization cannot override hard constraints;
- [ ] cold-start behavior exists;
- [ ] abuse/manipulation controls exist;
- [ ] multilingual behavior is tested;
- [ ] medical boundaries are tested where applicable;
- [ ] latency and cost are measurable.
