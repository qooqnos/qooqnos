# Phoenix Search, Indexing & Semantic Retrieval Architecture

**Status:** Proposed / implementation-ready  
**Scope:** Search and indexing infrastructure shared by Discovery, Catalog, Business, Reviews, CRM projections, and future marketplace modules.

## 1. Purpose

Phoenix search is a derived read system. The relational/domain model remains the source of truth. Search indexes exist to make eligible marketplace resources discoverable quickly through lexical, structured, geographic, and semantic retrieval.

Core invariant:

> **Domain data decides truth and eligibility; indexes accelerate retrieval.**

Search must never become a second authoritative database.

## 2. Boundary

The Search/Indexing module owns:

- index document contracts;
- normalization and enrichment pipelines;
- lexical indexing;
- embedding generation and Vectorize projections;
- incremental and full reindexing;
- index versioning and migration;
- query normalization;
- hybrid candidate retrieval;
- freshness and index-health monitoring;
- replay/dead-letter handling;
- search-specific anti-abuse signals.

It does **not** own:

- business identity or verification;
- catalog truth;
- booking capacity;
- customer identity;
- financial truth;
- permissions as an alternative to the Authorization module;
- reputation as an alternative to Reviews;
- AI provider/model ownership.

Discovery owns marketplace ranking/orchestration. Search supplies retrieval primitives and index health.

## 3. Source-of-Truth Flow

```text
Domain transaction
      |
      v
Authoritative D1 tables
      |
      v
Transactional Outbox
      |
      v
Queue / indexing job
      |
      +--> normalize/enrich
      +--> lexical projection
      +--> embedding projection --> Vectorize
      |
      v
Versioned search index
      |
      v
Discovery retrieval
      |
      v
Policy + ranking + authoritative revalidation
```

A domain write must not synchronously depend on successful indexing.

## 4. Index Document Contract

Every searchable document should carry at least:

```text
id
resource_type
resource_id
tenant_id
workspace_id
module_id
visibility
publication_status
verification_state
locale
supported_locales
content_version
index_schema_version
embedding_model_version
searchable_text
normalized_text
structured_attributes
geo.latitude
geo.longitude
price_snapshot (non-authoritative)
availability_snapshot (non-authoritative)
quality/reputation references
created_at
updated_at
indexed_at
```

Sensitive or private source fields must never be copied into a public search document merely because they exist in the source database.

## 5. Indexability Gates

A resource is indexable only when its owning module says it is eligible for discovery.

Typical gates:

1. tenant/workspace is active;
2. resource is published;
3. provider/business publication is allowed;
4. required verification gates are satisfied;
5. visibility policy permits marketplace discovery;
6. resource is not suspended/archived;
7. locale/content requirements are satisfied.

Medical providers and regulated content require the existing verification/moderation policies. Search must never infer eligibility from text.

## 6. Incremental Indexing

Domain events should include a stable resource identifier and content version, for example:

- `business.published.v1`
- `business.updated.v1`
- `catalog.offer.published.v1`
- `catalog.offer.updated.v1`
- `catalog.offer.suspended.v1`
- `review.reputation.updated.v1`
- `availability.changed.v1`

Index workers must be idempotent. If an older event arrives after a newer content version, the worker must not overwrite the newer projection.

Recommended job key:

```text
{tenant_id}:{resource_type}:{resource_id}:{content_version}:{index_schema_version}
```

## 7. Full Reindex

Full rebuilds are first-class operations, not emergency scripts.

Required capabilities:

- create a new index generation;
- backfill from authoritative D1 data;
- process embeddings asynchronously;
- validate document counts and representative samples;
- compare health metrics with the active generation;
- atomically switch the active generation;
- retain the previous generation for rollback;
- record operator, reason, schema version, and timestamps.

A rebuild must not require taking marketplace search offline.

## 8. Versioning

Track independently:

- `index_schema_version` — document structure and fields;
- `content_version` — authoritative resource revision;
- `embedding_model_version` — embedding representation;
- `ranking_version` — Discovery ranking logic/configuration.

Never silently mix incompatible embedding generations in a way that changes retrieval semantics without an explicit migration strategy.

## 9. Persian / RTL Search

Normalization must preserve the original display value while maintaining a canonical searchable representation.

Handle at minimum:

- Arabic/Persian character variants;
- Unicode normalization;
- ZWNJ/half-space variations;
- whitespace normalization;
- Arabic/Persian digits;
- diacritics;
- common punctuation variants;
- common spelling variants where confidence is safe;
- tokenization of Persian compounds;
- RTL display independent from internal search representation.

Never replace the original user/provider text with normalized text.

Transliteration may be added as an additional retrieval signal, not as a destructive transformation.

## 10. Multilingual Search

Each supported locale should have locale-aware searchable fields and, where supported, locale-specific embeddings.

Preferred retrieval order:

1. exact/structured match;
2. same-locale lexical retrieval;
3. cross-lingual semantic retrieval when reliable;
4. locale fallback;
5. ranking based on explicit user language preference.

Country/legal rules remain adapters around Core search and must not fork the retrieval engine.

## 11. Hybrid Retrieval

Discovery should combine:

- hard structured filters;
- lexical retrieval;
- semantic/vector retrieval;
- geographic candidate filtering;
- freshness signals;
- ranking/reranking;
- policy checks.

Hard eligibility must not be weakened by semantic similarity.

Example:

```text
query
 -> normalized intent
 -> hard eligibility filters
 -> lexical candidates
 -> semantic candidates
 -> merge/deduplicate
 -> policy filter
 -> ranking/reranking
 -> authoritative freshness checks when needed
 -> explainable results
```

Vector similarity is a candidate-generation signal, never a permission signal.

## 12. Geographic Retrieval

Index documents may contain public service-location coordinates.

Supported primitives:

- radius search;
- bounding box;
- distance scoring;
- neighborhood/city metadata;
- optional geohash/grid acceleration.

Exact distance and serviceability rules should be calculated from canonical location data where precision matters.

Private addresses or sensitive location information must never become searchable by default.

## 13. Price, Inventory & Availability Freshness

Search may use snapshots for ranking, but snapshots are not authoritative.

For user-visible claims that can cause a commitment, such as:

- current price;
- current inventory;
- current appointment availability;

Phoenix must revalidate against the owning module before final action.

A stale index must degrade to uncertainty, not fabricate certainty.

## 14. Authorization & Tenant Isolation

Tenant/workspace isolation is enforced twice:

1. index-time metadata and namespace/filtering;
2. query-time authorization and visibility filtering.

No search endpoint may accept a resource identifier and return it solely because it exists in the index.

Search results must be filtered using the same actor/tenant/resource policy model used elsewhere in Phoenix.

## 15. Vectorize Role

Cloudflare Vectorize is a retrieval accelerator.

It stores embeddings and minimal retrieval metadata such as:

```text
vector_id
tenant_id
workspace_id
resource_type
resource_id
locale
content_version
visibility
index_schema_version
```

The authoritative content remains in D1/domain modules.

If Vectorize is unavailable, the system must be able to fall back to lexical/structured retrieval for supported queries.

## 16. Freshness SLO

Initial operational target:

- ordinary published/updated content: searchable within seconds to a few minutes;
- high-priority visibility changes (suspension/removal): propagated as quickly as operationally possible and never treated as safe merely because the index is stale;
- full rebuild: asynchronous, observable, and reversible.

Measure actual lag rather than assuming freshness.

Key metric:

```text
index_freshness_lag = now - authoritative_updated_at
```

## 17. Failure Handling

Required states:

- queued;
- processing;
- succeeded;
- retryable_failure;
- permanent_failure;
- dead_letter;
- superseded;
- cancelled.

Retry transient failures with bounded exponential backoff. Permanent failures go to a dead-letter queue with enough context for replay.

If embedding generation fails, lexical search must remain available.

If the active index is degraded, Discovery should reduce semantic functionality rather than return unauthorized or stale critical facts.

## 18. Caching

Cache normalized query plans and safe retrieval results only when the authorization scope is represented in the key.

Cache keys should include relevant dimensions such as:

```text
tenant/workspace
locale
query normalization version
filter signature
ranking version
index generation
```

Never cache private results under a global key.

## 19. Anti-Abuse & Search Quality

Search must resist:

- keyword stuffing;
- duplicate listings;
- fake locations;
- manipulated reviews/reputation;
- misleading claims;
- spam businesses;
- coordinated ranking manipulation;
- hidden text intended only for retrieval.

Sponsored placement, if introduced later, must be explicitly labeled and cannot bypass hard eligibility or safety policy.

## 20. Explainability & Provenance

For AI-assisted discovery, each important recommendation should be traceable to signals such as:

- matched service/category;
- location/radius;
- price constraint;
- availability;
- language;
- verified business state;
- reputation/trust signals;
- explicit customer preference.

Do not expose internal fraud/risk scores or private moderation data to customers.

## 21. APIs

Public/customer-facing:

```text
GET  /api/v1/search
POST /api/v1/search/interpret
```

Internal/admin operations:

```text
POST /api/v1/search/index/rebuild
POST /api/v1/search/index/reindex
POST /api/v1/search/index/replay
GET  /api/v1/search/index/health
GET  /api/v1/search/index/jobs
```

These endpoints remain subject to centralized authorization and tenant scope.

## 22. Metrics

Operational:

- indexing throughput;
- queue depth;
- indexing failure rate;
- dead-letter count;
- freshness lag p50/p95/p99;
- active index generation;
- embedding generation latency;
- Vectorize error rate;
- reindex duration.

Search quality:

- zero-result rate;
- recall@k;
- precision@k;
- nDCG;
- click-through rate;
- save/contact/booking conversion;
- reformulation rate;
- stale-result incidents.

Business metrics must be analyzed without allowing engagement alone to override safety, eligibility, or trust policy.

## 23. Performance Targets

Initial target for the retrieval layer:

- p95 retrieval latency < 300 ms under normal load;
- overall discovery target remains approximately < 1 second where practical, excluding long-running LLM operations;
- asynchronous indexing must not block transactional writes.

Measure cold-cache and warm-cache behavior separately.

## 24. Testing

Mandatory tests include:

- tenant isolation;
- ACL/visibility filtering;
- Persian normalization;
- ZWNJ and spelling variants;
- multilingual retrieval;
- geographic filtering;
- version ordering;
- duplicate event delivery;
- replay/dead-letter recovery;
- stale price/availability handling;
- suspended resource removal;
- Vectorize outage fallback;
- full rebuild and rollback;
- index-generation switching;
- ranking-version compatibility;
- prompt/query injection resilience;
- anti-keyword-stuffing behavior.

Search quality should additionally have a curated evaluation set for Persian, multilingual, beauty, fashion, and later medical discovery scenarios.

## 25. Claude Code Implementation Rules

When implementing Search:

1. Never create a second source of truth for business/catalog/booking/reputation data.
2. Never bypass centralized authorization.
3. Never treat vector similarity as eligibility or permission.
4. Never expose sensitive/private source fields through indexes.
5. Every indexing consumer must be idempotent.
6. Every event must be versioned.
7. Every index generation must be observable and reversible.
8. Critical current facts must be revalidated against authoritative modules.
9. Persian/RTL and localization are requirements, not post-MVP polish.
10. Search failures must degrade safely to supported retrieval modes.

## 26. Definition of Done

Search architecture is considered implementation-ready when:

- index contracts are typed and versioned;
- Outbox → Queue → Index pipeline exists;
- incremental and full rebuild paths exist;
- Vectorize is integrated as a derived retrieval layer;
- tenant/authorization filters are enforced;
- Persian and multilingual normalization are tested;
- stale critical facts are revalidated;
- dead-letter/replay exists;
- index generations can be rolled back;
- search quality and freshness metrics are observable;
- Discovery consumes Search without taking ownership of its source data.

## 27. Architectural Decision

Phoenix should implement Search as a reusable **Search/Indexing module** beneath Discovery rather than embedding indexing logic inside Catalog, Business, or AI.

This keeps the marketplace extensible: future real estate, restaurants, hotels, education, automotive, and other modules can publish the same versioned indexing contract without rebuilding the retrieval architecture.
