# Phoenix Search Skill

## Purpose
Implement and review Phoenix Search/Indexing as the reusable retrieval layer beneath Discovery.

## Canonical reference
Read `docs/SEARCH_INDEXING_SEMANTIC_RETRIEVAL_ARCHITECTURE.md` before making architectural changes.

## Non-negotiable rules
- D1/domain modules remain the source of truth.
- Search indexes are derived projections only.
- Use Outbox + Queue for asynchronous indexing.
- Index consumers must be idempotent and version-aware.
- Use lexical + structured + semantic retrieval; hard eligibility cannot be weakened by semantic similarity.
- Vectorize is an accelerator, never a source of truth or permission system.
- Enforce tenant/workspace and visibility filters at query time and index time.
- Never index sensitive/private fields without an explicit policy.
- Current price, inventory, and availability must be revalidated against authoritative modules before consequential actions.
- Support Persian normalization, ZWNJ, RTL, locale-aware search, and multilingual retrieval.
- Full reindex must be observable, atomic to activate, and reversible.
- Search degradation must fail safely to supported retrieval modes.
- Ranking/reputation signals must not override safety, eligibility, verification, or moderation policy.

## Module boundaries
Search owns index documents, normalization, indexing pipelines, embeddings, index generations, retrieval primitives, freshness, replay, and search-specific quality signals.

Discovery owns intent interpretation, marketplace orchestration, ranking/reranking policy, recommendation explanations, and customer-facing matching behavior.

Catalog/Business/Booking/Reviews/CRM own their authoritative domain data.

## Implementation checklist
1. Define versioned index document contracts.
2. Publish domain changes through transactional Outbox events.
3. Consume events through bounded queue workers.
4. Normalize/enrich content without destroying original display text.
5. Build lexical and Vectorize projections.
6. Track content, schema, embedding, and ranking versions.
7. Implement incremental reindex, replay, dead-letter, and full rebuild.
8. Enforce tenant/ACL/visibility filters.
9. Add Persian and multilingual test corpora.
10. Add freshness, quality, latency, and failure metrics.
11. Connect Discovery to retrieval without creating duplicate domain truth.

## AI boundary
LLMs may help interpret queries, extract structured constraints, translate, or explain matches. They must not directly query databases, mutate indexes without validated commands, bypass authorization, or decide eligibility.
