# Phoenix SEO/GEO Engine — Data Dictionary

## 1. Purpose

This document defines the canonical vocabulary consumed by the SEO/GEO Engine. It does not create a second domain data model. Each record is a derived representation of data owned by its source module.

## 2. Identity Fields

| Field | Meaning | Owner | Required |
|---|---|---|---|
| `entity_id` | Stable canonical entity identifier | Source domain module | Yes |
| `entity_type` | Typed entity class | Source domain module | Yes |
| `source_module` | Module owning the source of truth | Architecture registry | Yes |
| `source_version` | Version of source representation | Source module | Yes |
| `publication_state` | Draft, review, published, unpublished, deleted | Source/publishing policy | Yes |
| `visibility` | Public, restricted, private | Authorization/domain policy | Yes |

## 3. Semantic Identity

| Field | Meaning |
|---|---|
| `preferred_name` | Primary display name |
| `alternate_names` | Valid aliases and alternate labels |
| `entity_summary` | Short factual representation |
| `description` | Canonical descriptive content |
| `entity_types` | Semantic classifications applicable to the entity |
| `same_as` | Explicit relationships to external identities when verified |
| `parent_entity_id` | Canonical parent relationship |
| `related_entity_ids` | Explicit semantic relationships |

Semantic identity must be factual and provenance-aware. The engine must never invent aliases, credentials, relationships, or claims merely to increase discoverability.

## 4. Localization Fields

| Field | Meaning |
|---|---|
| `locale` | Content locale |
| `language` | Language code |
| `country` | Country context |
| `translation_of` | Canonical source entity/representation |
| `translation_status` | Translation lifecycle state |
| `locale_canonical_id` | Canonical representation for the locale |
| `alternate_locale_ids` | Related localized representations |

Localization remains owned by the Localization module.

## 5. Geographic Dictionary

| Field | Meaning |
|---|---|
| `location_id` | Canonical location identifier |
| `location_type` | Country, region, city, district, neighborhood, branch, service area |
| `address` | Public canonical address where permitted |
| `postal_code` | Public postal locality information where appropriate |
| `latitude` / `longitude` | Coordinates where publication is permitted |
| `located_in` | Geographic parent relationship |
| `service_area` | Area in which the entity serves customers |
| `service_radius` | Radius where the business model explicitly uses one |
| `remote_available` | Whether service is available remotely/online |
| `geo_precision` | Exact, branch, city, region, country, service-area level |

The engine must never infer that a business serves an area solely because it is physically located there.

## 6. URL Dictionary

| Field | Meaning |
|---|---|
| `canonical_url` | One canonical public URL |
| `url_key` | Stable URL generation key |
| `slug` | Locale-aware human-readable path component |
| `url_scope` | Entity, category, location, collection, content |
| `canonical_of` | Relationship to canonical representation |
| `redirect_target` | Approved redirect destination |
| `indexability` | Index, noindex, restricted, excluded |

URL policy is centrally owned by SEO/GEO.

## 7. Search Metadata

| Field | Meaning |
|---|---|
| `title` | Search-result title candidate |
| `meta_description` | Search-result description candidate |
| `heading_outline` | Semantic heading structure |
| `alt_texts` | Accessible image descriptions |
| `internal_link_targets` | Approved contextual links |
| `search_intent` | Informational, navigational, commercial, local, transactional, or mixed |
| `topic_terms` | Derived topical vocabulary |

Search metadata must describe canonical content rather than create claims absent from it.

## 8. Structured Data Dictionary

| Field | Meaning |
|---|---|
| `schema_type` | Approved structured-data type |
| `schema_payload` | Derived structured representation |
| `schema_source_entities` | Entities supporting the payload |
| `schema_validation_state` | Valid, invalid, review-required |
| `schema_policy_version` | Version of generation policy |

Structured data is derived output, never a source of truth.

## 9. GEO Answer Dictionary

| Field | Meaning |
|---|---|
| `answer_id` | Stable answer representation identifier |
| `question` | User-facing factual question |
| `answer` | Concise canonical answer |
| `fact_units` | Atomic factual statements |
| `evidence_refs` | References to source entities/content |
| `provenance` | Origin and verification information |
| `freshness_at` | Last known freshness timestamp |
| `confidence_state` | Verified, sourced, pending review, restricted |
| `citation_context` | Context required to attribute the fact correctly |

GEO output must remain attributable and must not expose private or sensitive source information.

## 10. Trust & Provenance Dictionary

| Field | Meaning |
|---|---|
| `source_entity_id` | Entity providing the fact |
| `source_module` | Owning module |
| `source_record_version` | Source version |
| `verified_at` | Last verification timestamp |
| `verified_by_policy` | Verification policy used |
| `credential_state` | Relevant verification state |
| `editorial_state` | Editorial review state |
| `provenance_chain` | Chain of supporting sources |

For regulated domains, publication eligibility is determined by policy rather than by the SEO/GEO engine alone.

## 11. Content Quality Dictionary

| Field | Meaning |
|---|---|
| `completeness_score` | Required factual fields present |
| `clarity_score` | Clarity of representation |
| `originality_state` | Original, derived, duplicate, or review-required |
| `freshness_score` | Freshness relative to entity policy |
| `thin_content_state` | Whether representation is materially insufficient |
| `duplicate_state` | Duplicate/canonical conflict status |
| `quality_gate` | Publication eligibility result |

Scores are diagnostic signals, not replacements for policy decisions.

## 12. Geographic Relevance Dictionary

| Field | Meaning |
|---|---|
| `geo_intent` | Geographic intent represented by the content |
| `geo_scope` | Exact, branch, city, region, country, service area |
| `proximity_signal` | Approved proximity input |
| `local_entity_links` | Related local entities |
| `local_service_match` | Whether service availability matches geographic scope |
| `jurisdiction` | Legal/regulatory jurisdiction reference |

Legal jurisdiction is distinct from geographic relevance and remains governed by legal/country adapters.

## 13. Indexing Lifecycle

Every indexable representation follows:

```text
source created
  → source verified according to policy
  → semantic representation generated
  → quality/policy evaluation
  → publication eligible
  → indexable representation published
  → updates trigger dependency invalidation
  → unpublished/deleted state propagates
```

An entity must never become indexable merely because a row exists in the source database.

## 14. Dependency Model

A derived SEO/GEO artifact records the source dependencies required to regenerate it.

Example:

```text
Business
 ├─ Service A
 ├─ Service B
 ├─ Location
 ├─ Reviews
 └─ Credential
       ↓
Business SEO/GEO representation
```

Changes invalidate only affected representations where dependency analysis permits.

## 15. Privacy Boundary

The dictionary explicitly excludes private customer data, authentication secrets, internal permissions, confidential business information, medical symptoms/history, and other restricted data from public SEO/GEO representations.

Sensitive source data may influence an internal policy decision but must not automatically become published content.

## 16. Vertical Reuse

Beauty, fashion, medical, and future verticals reuse these fields. Vertical-specific facts are represented through typed extensions and policies rather than duplicated SEO/GEO schemas.

## 17. Completion Gate

The SEO/GEO data dictionary is complete when:

- every public entity type has a canonical representation;
- ownership of every field is explicit;
- localization and geography are separated correctly;
- location and service-area semantics cannot be confused;
- URLs have one owner;
- structured data is derived;
- GEO facts have provenance;
- privacy boundaries are explicit;
- regulated publication has policy gates;
- verticals do not duplicate the dictionary;
- derived artifacts can be invalidated deterministically.

**Status: Frozen as the SEO/GEO semantic contract.**
