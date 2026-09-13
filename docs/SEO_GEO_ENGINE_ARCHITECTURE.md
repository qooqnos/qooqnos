# Phoenix SEO & GEO Engine Architecture

## 1. Purpose

The SEO/GEO Engine is a platform capability responsible for making Phoenix entities understandable, discoverable, indexable, locally relevant, and citable by both traditional search engines and generative/answer engines.

SEO and GEO are one coordinated capability, but they are not the same optimization problem.

- **SEO** optimizes discoverability, crawlability, indexing, relevance, technical quality, and search-result presentation.
- **GEO (Generative Engine Optimization)** optimizes the quality, structure, provenance, clarity, entity relationships, and answerability of Phoenix content so retrieval and answer systems can correctly understand and reference it.
- **Local SEO / Geo relevance** handles geographic intent, locality, service areas, addresses, and location entities. It is a sub-capability of the same engine, not a separate duplicated system.

## 2. Architectural Principle

SEO/GEO must be generated from canonical domain data. It must never become a second source of truth.

Canonical domain data → semantic representation → SEO/GEO policy → generated artifacts → distribution/measurement.

A business name, service, product, price, address, availability, credential, review, or policy is owned by its domain module. SEO/GEO consumes it through contracts.

## 3. Ownership

The SEO/GEO Engine owns:

- optimization policies
- crawl/index directives
- canonical URL policy
- metadata generation
- structured-data generation
- entity/topic representation
- internal linking recommendations
- sitemap/index generation
- robots policy
- geographic relevance signals
- answer-oriented content representation
- citation/provenance metadata
- SEO/GEO quality scoring
- diagnostics and recommendations
- measurement contracts

It does **not** own:

- businesses
- customers
- products
- services
- bookings
- reviews
- locations
- payments
- identity
- source-of-truth content

## 4. Core Pipeline

```text
Domain Modules
     ↓
Canonical Content Contract
     ↓
Entity & Semantic Graph
     ↓
SEO/GEO Policy Engine
     ↓
Optimization Planner
     ↓
Artifact Generators
     ├── HTML metadata
     ├── canonical URLs
     ├── structured data
     ├── sitemap
     ├── robots directives
     ├── internal-link graph
     ├── answer-ready content
     └── geographic signals
     ↓
Publication Layer
     ↓
Crawler / Search / Answer Ecosystem
     ↓
Measurement & Diagnostics
     ↺
```

## 5. Canonical Entity Model

The engine works primarily with typed entities rather than arbitrary pages.

Minimum entity classes:

- Organization
- Business
- Person/Professional
- Service
- Product
- Offer
- Location
- Branch
- Category
- Collection
- Review
- FAQ
- Article/Guide
- Event
- Brand
- Credential/Trust signal

Each entity has:

- stable canonical identity
- entity type
- localized names
- descriptions
- relationships
- source module
- publication state
- locale
- geographic scope
- freshness timestamp
- provenance
- visibility/indexability policy

## 6. URL Architecture

URLs are generated from canonical identity and locale/location policy.

Rules:

1. One canonical representation per indexable entity and locale.
2. Query parameters must not create uncontrolled duplicate indexable pages.
3. URL generation is centralized.
4. Redirect and canonical decisions are policy-driven.
5. Locale and geographic variants must have explicit relationship semantics.
6. Deleted or unpublished entities must have deterministic lifecycle handling.

The SEO engine must never allow individual modules to invent incompatible canonical URL schemes.

## 7. SEO Layers

### Technical SEO

- crawlability
- indexability
- canonicalization
- redirects
- robots directives
- XML sitemaps
- sitemap indexes
- status-code correctness
- rendering discoverability
- duplicate-content control
- pagination strategy
- image/media discoverability
- performance-related metadata contracts

### On-page SEO

- title
- meta description
- headings
- semantic content structure
- image alternative text
- contextual internal links
- entity references
- FAQ content
- content freshness

### Structured SEO

Structured data is generated from canonical entities and policy rules. The architecture supports schema families appropriate to each domain without allowing schema markup to become a parallel data model.

### Local SEO

- country
- region/state
- city
- district/neighborhood
- postal locality
- branch
- service area
- opening hours
- contact channels
- geographic coordinates where appropriate
- local entity relationships

Location data must come from the canonical Location model.

## 8. GEO Architecture

GEO is designed around **retrieval and answerability**, not keyword stuffing.

The engine should make important facts:

- explicit
- atomic
- consistent
- attributable
- current
- semantically related
- easy to retrieve
- easy to cite

A GEO representation should clearly expose:

- who the entity is
- what it offers
- where it operates
- who it serves
- important qualifications/credentials
- prices or price ranges where public
- availability where appropriate
- differentiators
- policies
- evidence/provenance
- relationships to other entities

The engine must not fabricate facts to improve visibility.

## 9. Entity Graph

The SEO/GEO Engine maintains a derived semantic graph, not a replacement domain database.

Example:

```text
Business
 ├── offers → Service
 ├── sells → Product
 ├── operates_at → Location
 ├── belongs_to → Category
 ├── has → Review
 ├── has → Credential
 └── serves → GeographicArea
```

The graph is used for:

- internal linking
- semantic relevance
- structured data
- contextual retrieval
- GEO answer generation
- duplicate/entity resolution
- diagnostics

## 10. Content Strategy Engine

The engine supports several content classes:

1. Entity pages
2. Category pages
3. Location pages
4. Service/product pages
5. Comparison pages
6. FAQ pages
7. Guides
8. Editorial content
9. Answer-oriented summaries

Generated content must have a clear owner, provenance, locale, freshness policy, and publication state.

Mass-generated low-value pages are prohibited.

## 11. GEO Answer Layer

The engine exposes an answer-ready representation of canonical information.

It should support:

- concise fact extraction
- question/answer pairs
- entity summaries
- comparison facts
- location-specific facts
- evidence/provenance references
- freshness indicators
- source attribution

This layer is designed so that AI retrieval systems can consume reliable Phoenix facts without requiring unrestricted access to internal databases.

## 12. Geographic Intent Engine

Geographic relevance is calculated from explicit structured location information and user/search intent signals.

Supported dimensions:

- exact location
- branch location
- city
- region
- country
- service radius
- service area
- remote/online availability
- language/locale

The geographic engine must distinguish:

**where the business is located** from **where the business serves customers**.

It must also distinguish geographic SEO from legal/regulatory jurisdiction. Legal rules remain owned by the country/legal adapter architecture.

## 13. Internationalization

SEO/GEO is locale-aware from day one.

Every generated artifact may carry:

- locale
- language
- country
- geographic scope
- canonical relationship
- translation relationship

The engine must cooperate with the Localization module and must not create a second translation system.

## 14. Trust & Provenance

Trust is a first-class GEO signal.

For relevant content the engine should be able to associate:

- source entity
- source module
- publication timestamp
- last verification timestamp
- credential status where applicable
- review provenance
- editorial status
- confidence/state

Sensitive or regulated domains require stricter publication policies.

For medical content in particular, the SEO/GEO engine must never convert user symptoms or health information into diagnosis, treatment, medication recommendations, or misleading medical claims.

## 15. SEO/GEO Policy Engine

Policies determine whether and how an entity becomes indexable.

Policy inputs include:

- entity lifecycle state
- verification state
- visibility
- locale
- country
- legal jurisdiction
- content quality
- duplicate state
- freshness
- business configuration
- category restrictions

Possible outcomes:

- index
- noindex
- canonicalize
- redirect
- exclude from sitemap
- require review
- publish with restricted representation

No module should implement these decisions independently.

## 16. Quality Scoring

The engine provides separate scores rather than one opaque score:

- Technical SEO Score
- Content Quality Score
- Entity Completeness Score
- Local Relevance Score
- Structured Data Score
- GEO Answerability Score
- Trust/Provenance Score
- Freshness Score

An aggregate score may be displayed for convenience, but the underlying dimensions remain inspectable.

## 17. Automation

The engine may automatically:

- generate metadata
- update sitemaps
- produce structured data
- detect missing fields
- detect duplicate canonical candidates
- identify broken internal links
- identify stale content
- suggest FAQ opportunities
- identify weak entity descriptions
- identify geographic gaps
- generate optimization recommendations

Automatic publication of high-risk claims or regulated content requires policy approval.

## 18. Event Integration

The engine reacts to canonical domain changes through stable contracts/events such as:

- entity published
- entity updated
- entity unpublished
- entity deleted
- location changed
- service/product changed
- review published
- credential status changed
- locale published

Events trigger recalculation of only affected SEO/GEO artifacts.

## 19. Caching & Invalidation

SEO/GEO artifacts should be cacheable and deterministic.

Cache invalidation follows entity dependency relationships.

Example:

```text
Service changed
   ↓
Service representation invalidated
   ↓
Business page affected
   ↓
Category/location aggregates affected
   ↓
Relevant sitemap/index metadata refreshed
```

Full-site regeneration is not the default strategy.

## 20. Measurement

Measurement must distinguish:

- impressions
- clicks
- indexed entities
- crawl/index errors
- ranking/discoverability signals
- local visibility
- referral traffic
- organic conversions
- AI/answer-engine referrals where observable
- citation/mention observations where measurable
- GEO answerability changes

The engine must not claim AI citations or rankings that cannot actually be observed.

## 21. Security & Abuse Prevention

The engine must prevent:

- SEO spam
- automated page explosion
- malicious keyword injection
- fake reviews or claims
- unauthorized metadata changes
- unauthorized canonical changes
- sensitive-data exposure
- prompt-injection content from being blindly promoted into SEO/GEO artifacts

All generated artifacts pass the same authorization and publication boundaries as their source entities.

## 22. Module Boundary

The SEO/GEO Engine is a **single reusable platform capability**.

Beauty, fashion, medical, and future marketplace verticals consume the same engine through domain contracts.

Vertical-specific SEO/GEO rules are policy/configuration extensions, not separate SEO engines.

## 23. Non-Goals

The initial architecture does not require:

- a separate SEO microservice
- a separate GEO microservice
- a custom search engine
- a custom vector database
- guaranteed placement in search engines
- guaranteed citation by AI systems
- automatic generation of unlimited SEO pages
- keyword-stuffing automation
- a second domain/content database

## 24. Architectural Completion Criteria

SEO/GEO architecture is considered complete when:

- every indexable entity has a canonical identity
- URL generation is centralized
- SEO and GEO consume canonical domain contracts
- local/geographic semantics are explicit
- localization integration is defined
- structured data is generated from canonical entities
- sitemap/robots/canonical policies have one owner
- GEO answer representations have provenance
- regulated content has policy gates
- quality scoring is decomposable
- invalidation follows dependency relationships
- measurement does not invent unavailable signals
- no vertical duplicates the engine

## 25. Status

**SEO/GEO Engine Architecture: Defined and frozen for implementation.**

This document is an architecture contract. Implementation details belong to the later implementation phase and must not introduce a second source of truth or duplicate SEO/GEO capability in individual modules.
