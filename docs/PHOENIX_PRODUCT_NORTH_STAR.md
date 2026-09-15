# Phoenix Product North Star

> Status: Product strategy baseline

## 1. Product North Star

Phoenix is fundamentally an **intelligent decision and connection layer between customers and businesses**.

Phoenix is not primarily a CRM, ERP, directory, booking system, storefront, or generic AI chatbot. Those are capabilities that exist to strengthen the core loop:

`Understand Demand → Understand Supply → Decide → Match → Connect → Enable Action → Learn`

The product becomes more valuable as it becomes better at understanding both sides of the market and making useful, explainable, policy-safe decisions between them.

## 2. The Two-Sided Intelligence Model

Phoenix must continuously improve two intelligence surfaces:

### Demand Intelligence
Understand what the customer actually needs, even when the customer cannot express it in product/category terminology.

Examples:
- natural-language needs
- preferences and constraints
- budget, availability, location, timing
- implicit requirements
- comparison and trade-off signals
- previous interactions where policy permits

### Supply Intelligence
Turn a business's raw or incomplete information into structured, trustworthy, discoverable marketplace supply.

A business should not be forced to become a catalog-management expert.

A core Phoenix experience is:

`Seller input → AI extraction → AI enrichment → structured product/service draft → validation → seller confirmation → publication → discovery/matching`

Example:

`Seller uploads a product photo → Phoenix identifies product attributes → proposes category/title/description/features/variants → improves or generates permitted media → asks for missing facts → seller confirms → product becomes marketplace-ready.`

AI must never silently invent authoritative commercial facts. Generated content is proposed content until validated and accepted according to domain policy.

## 3. AI Is a Value-Creation Layer

AI is not only for answering customer questions.

AI should reduce the cost and effort required to:
- create and maintain business supply
- understand customer intent
- enrich catalog content
- normalize and localize content
- retrieve relevant candidates
- rank and explain matches
- assist conversations and workflows
- identify missing information
- recommend safe next actions

Every AI capability should strengthen at least one part of the demand/supply/decision loop.

## 4. Canonical Marketplace Loop

`Business → Supply Creation/Enrichment → Quality/Policy → Marketplace Supply → Discovery/Retrieval → Customer Need → Matching/Ranking → Explanation → Connection → Booking/Purchase/Lead → Outcome Signals`

Catalog quality is therefore not only a merchant feature. It is an input to Phoenix's decision engine.

## 5. Business Value

For businesses:
- reduce catalog creation effort
- reduce content-production cost
- make supply easier to discover
- improve relevance of incoming customers
- increase conversion and utilization
- provide measurable AI-assisted operational value

For customers:
- reduce search effort
- translate vague needs into useful choices
- compare suitable options
- understand why options were recommended
- reach the right provider faster

For Phoenix:
- capture value from subscriptions and marketplace activity
- meter and monetize AI-assisted operations
- improve matching quality as supply quality improves
- build defensible marketplace intelligence from structured, governed signals

## 6. AI Usage Is Metered Economic Activity

AI execution consumes scarce provider/model resources and must be treated as measurable usage.

AI-heavy seller operations may include:
- product/service extraction from images or documents
- title and description generation
- attribute extraction
- variant suggestions
- localization/translation
- SEO/content enrichment
- image enhancement or generation
- catalog quality checks
- customer matching and ranking

Each billable AI operation must have a clear usage identity, tenant context, idempotency strategy, cost/usage telemetry, entitlement/quota behavior, and auditable financial outcome where applicable.

The exact pricing model may evolve, but architecture must support:

`AI Operation → Usage Event → Quota/Credit/Entitlement → Pricing Rule → Charge or Included Usage`

AI token/model cost is an internal cost signal; customer pricing is a product/business rule and must not be hard-coded to raw provider cost.

## 7. Product Design Test

When proposing a feature, ask:

1. Does it improve understanding of customer demand?
2. Does it improve understanding or quality of business supply?
3. Does it improve decision quality, matching, connection, or action?
4. Does it reduce friction for a customer or business in the marketplace loop?
5. Does it create measurable value or learning for Phoenix?

If a feature cannot answer these questions, it requires explicit product justification before becoming part of Phoenix Core.

## 8. North Star Metric Direction

Phoenix should optimize toward outcomes such as:
- successful customer-to-provider matches
- qualified connections
- successful bookings/purchases/leads
- customer effort reduction
- business conversion/utilization
- supply completeness and quality
- AI-assisted catalog creation and maintenance success
- AI operation value relative to cost

Operational metrics matter, but they are not substitutes for marketplace value.

## 9. Non-Goals

Do not turn Phoenix into a collection of disconnected SaaS utilities.

Do not optimize for feature count, dashboard count, AI calls, token consumption, or CRUD completeness as primary product goals.

Do not allow business-facing tooling to become disconnected from marketplace supply quality and customer matching.

## 10. Decision Statement

**Phoenix exists to make the market easier to understand, easier to enter, and easier to navigate by using AI to understand demand and supply and make better connections between them.**
