# Phoenix Discovery & Matching Data Dictionary

**Status:** Canonical data contract  
**Scope:** Search, discovery, eligibility, retrieval, ranking, recommendation, explanation, and discovery observability.

## 1. DiscoveryRequest

Canonical normalized request.

Fields:
- id;
- actor_context;
- tenant_id;
- locale;
- intent;
- query_text;
- filters;
- preferences;
- location_constraint;
- budget_constraint;
- availability_constraint;
- pagination;
- ranking_policy_version;
- created_at.

Natural-language input may be retained for traceability, but decisions operate on normalized structures.

## 2. DiscoveryIntent

Normalized representation of the user's request.

Fields:
- intent_id;
- intent_type;
- normalized_terms;
- entities;
- constraints;
- confidence;
- source;
- provenance.

AI interpretation is a proposal until validated by deterministic policy.

## 3. DiscoveryConstraint

A normalized user/system constraint.

Types:
- HARD_EXPLICIT;
- HARD_POLICY;
- SOFT_EXPLICIT;
- SOFT_INFERRED;
- SYSTEM_DERIVED.

Fields:
- id;
- type;
- attribute;
- operator;
- value;
- source;
- confidence where applicable;
- priority;
- provenance.

Hard constraints are eligibility gates.

## 4. Candidate

A discoverable resource projected from an authoritative domain.

Fields:
- candidate_id;
- resource_type;
- resource_id;
- owner_business_id;
- tenant_scope;
- location_refs;
- category_refs;
- searchable_attributes;
- visibility_status;
- verification_state;
- source_version;
- indexed_at;
- locale.

Candidate data is derived; the owning domain remains authoritative.

## 5. CandidateEligibilityDecision

Deterministic decision on whether a candidate may enter final ranking.

Fields:
- candidate_id;
- decision;
- exclusion_reasons;
- policy_version;
- evaluated_constraints;
- evaluated_at;
- source_versions.

Possible decisions:
- ELIGIBLE;
- INELIGIBLE;
- INCONCLUSIVE.

INELIGIBLE candidates cannot be promoted into final results by ranking.

## 6. RetrievalResult

Candidate returned by one retrieval strategy.

Fields:
- candidate_id;
- retrieval_source;
- retrieval_version;
- lexical_score;
- semantic_score;
- retrieval_rank;
- retrieved_at.

Sources may include lexical, structured, semantic/vector, or approved hybrid retrieval.

## 7. RankingPolicy

Versioned ranking configuration.

Fields:
- id;
- version;
- scope;
- signal definitions;
- weights;
- hard-gate rules;
- diversity rules;
- effective_from;
- effective_to;
- status.

Published ranking policies are immutable.

## 8. RankingEvidence

Evidence explaining a candidate's ranking.

Fields:
- candidate_id;
- ranking_policy_version;
- signals;
- signal_values;
- contribution_values;
- eligibility_reference;
- generated_at.

User-facing explanations may only use grounded ranking evidence and authoritative facts.

## 9. RankingResult

Final ranked candidate representation.

Fields:
- candidate_id;
- rank;
- score;
- eligibility_reference;
- ranking_policy_version;
- evidence_reference;
- diversity_adjustment;
- generated_at.

Scores are versioned and reproducible from recorded inputs where practical.

## 10. DiscoveryResultSet

A complete response projection.

Fields:
- request_id;
- result_ids;
- total/estimated_count;
- cursor;
- ranking_policy_version;
- query_version;
- generated_at;
- degradation_state.

Personalized result sets must not be globally cached.

## 11. DiscoveryFilter

Structured filter used by search/recommendation.

Examples:
- category;
- service;
- price;
- location;
- availability;
- brand;
- style;
- verification;
- quality band.

Filters must originate from authoritative/indexed fields.

## 12. DiscoveryPreference

A non-hard preference used for ranking.

Fields:
- id;
- subject_id;
- attribute;
- value;
- source;
- persistence;
- confidence;
- created_at;
- expires_at.

Explicit preferences outrank contextual inference.

## 13. GeoConstraint

Normalized geographic requirement.

Fields:
- mode;
- country;
- region;
- city;
- neighborhood;
- coordinates where permitted;
- radius;
- travel_distance;
- service_location_type.

Geographic calculations are deterministic.

## 14. BudgetConstraint

Normalized monetary constraint.

Fields:
- currency;
- min_minor_units;
- max_minor_units;
- pricing_mode;
- source;
- normalized_at.

Discovery does not invent prices.

## 15. AvailabilityConstraint

Requested availability requirement.

Fields:
- start;
- end;
- timezone;
- duration;
- location;
- freshness_policy;
- source_version.

Availability remains authoritative in Booking/owning domain sources.

## 16. SearchProjection

Derived searchable representation.

Fields:
- projection_id;
- resource_type;
- resource_id;
- source_module;
- source_version;
- tenant_scope;
- locale;
- lexical_fields;
- structured_fields;
- semantic_reference;
- visibility;
- indexed_at.

Search projections can be rebuilt without changing authoritative data.

## 17. EmbeddingReference

Reference to a semantic representation.

Fields:
- resource_id;
- embedding_model_version;
- vector_reference;
- source_version;
- locale;
- generated_at;
- status.

Embedding data is derived and replaceable.

## 18. DiscoveryExplanation

Grounded explanation for a result.

Fields:
- result_id;
- explanation_type;
- evidence_refs;
- authoritative_fact_refs;
- ranking_policy_version;
- locale;
- generated_at.

Explanations cannot introduce facts absent from evidence.

## 19. RecommendationContext

Context used when the request is recommendation rather than direct search.

Fields:
- actor;
- explicit_preferences;
- approved_durable_preferences;
- contextual_signals;
- consent_scope;
- policy_version;
- created_at.

Contextual inference cannot override explicit hard constraints.

## 20. DiversityDecision

Post-ranking diversity adjustment.

Fields:
- result_id;
- dimension;
- adjustment;
- policy_version;
- reason;
- generated_at.

Diversity is applied only after eligibility.

## 21. DiscoveryCursor

Opaque pagination state.

Must encode or reference:
- request scope;
- tenant;
- normalized query/filter hash;
- ranking policy version;
- ordering state;
- expiry.

A cursor must not be reusable across unauthorized scopes.

## 22. DiscoveryPolicyDecision

Policy outcome for discovery.

Fields:
- policy_id;
- policy_version;
- candidate_id/request_id;
- decision;
- reasons;
- jurisdiction;
- evaluated_at.

Country/legal policies remain adapters around Core discovery.

## 23. DiscoveryQueryTrace

Operational trace for a discovery request.

Fields:
- request_id;
- tenant_scope;
- normalized_intent;
- candidate_counts;
- retrieval_sources;
- policy_exclusions;
- ranking_policy;
- cache_status;
- latency;
- degradation;
- result_ids;
- created_at.

Sensitive query content follows canonical privacy and AI logging rules.

## 24. DiscoveryEvaluationRecord

Evaluation evidence for search/matching quality.

Dimensions may include:
- eligibility precision;
- retrieval recall;
- ranking quality;
- constraint satisfaction;
- diversity;
- explanation grounding;
- latency;
- cost;
- safety.

Evaluation records reference dataset and policy/model versions.

## 25. Domain Adapter

A typed adapter exposing domain-specific discovery semantics without creating another engine.

Required concepts:
- searchable resources;
- eligibility rules;
- ranking signals;
- filters;
- explanation fields;
- safety/regulatory policy.

Beauty, fashion, medical, and future industries reuse the same Discovery engine.

## 26. State Rules

### Search projection

```text
PENDING → INDEXING → ACTIVE
                  ↘ FAILED → RETRY
```

### Ranking policy

```text
DRAFT → VALIDATING → ACTIVE → RETIRED
```

Active versions are immutable.

## 27. Ownership Matrix

| Data | Owner |
|---|---|
| Business facts | Business |
| Product/service facts | Catalog |
| Inventory | Catalog |
| Availability | Booking/owning domain |
| Verification | Trust |
| Customer identity/preferences | Customer/Identity |
| Reputation | Reviews |
| Search projection | Discovery |
| Ranking policy | Discovery |
| AI interpretation | AI |
| Final domain mutation | Owning domain |

## 28. Canonical Capabilities

```text
CAP.DISCOVERY.SEARCH
CAP.DISCOVERY.RECOMMEND
CAP.DISCOVERY.GET_SUGGESTIONS
CAP.DISCOVERY.GET_FACETS
CAP.DISCOVERY.EVALUATE_ELIGIBILITY
CAP.DISCOVERY.RANK
CAP.DISCOVERY.EXPLAIN
CAP.DISCOVERY.INDEX
```

## 29. Canonical Events

```text
discovery.projection.updated
discovery.projection.failed
discovery.ranking_policy.activated
discovery.ranking_policy.retired
discovery.query.completed
discovery.query.degraded
```

Events carry tenant/scope, source versions, correlation context, and event version.

## 30. Data Invariants

1. Ineligible candidates never enter final results.
2. Hard constraints cannot be weakened by AI.
3. Domain truth remains outside Discovery.
4. Search indexes are disposable projections.
5. Ranking policies are versioned.
6. Ranking evidence is traceable.
7. Prices and availability are never fabricated.
8. Verification state comes from Trust.
9. Medical discovery is provider/service matching only.
10. Country/legal rules are policy adapters.
11. Personalized results are scope-safe.
12. Cursors are opaque and scope-bound.
13. Tenant isolation is mandatory.
14. Sensitive query data follows privacy policy.
15. AI explanations must be grounded.

## 31. Anti-Duplication

Phoenix has one Discovery & Matching Engine.

Forbidden:
- Beauty Search Engine;
- Fashion Search Engine;
- Medical Search Engine;
- separate AI Matching Engine;
- separate recommendation engine per vertical.

Vertical differences belong in typed adapters and policies.

## 32. Definition of Done

Discovery data is canonical when request, intent, constraints, candidates, eligibility, retrieval, ranking, evidence, explanations, personalization context, policies, projections, pagination, evaluation, ownership, tenancy, and anti-duplication rules are all explicit.
