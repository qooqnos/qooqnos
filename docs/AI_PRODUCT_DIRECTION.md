# Phoenix AI Product Direction

> Status: Product and AI strategy baseline

## 1. Role of AI in Phoenix

AI is a controlled product capability whose purpose is to increase Phoenix's ability to understand demand, understand supply, make decisions, and connect the two.

AI is not the product by itself. It must operate inside domain, policy, authorization, billing, provenance, and safety boundaries.

## 2. Two Primary AI Jobs

### A. Customer-side intelligence
AI converts natural language and interaction signals into structured demand, retrieves candidates, ranks them, explains recommendations, and assists the customer toward a useful action.

Canonical flow:

`Natural Language → Intent → Constraints → Retrieval → Ranking → Policy → Explanation → Action`

### B. Business-side intelligence
AI reduces the effort required for businesses to create and maintain marketplace supply.

Canonical flow:

`Raw Seller Input → Extract → Normalize → Enrich → Validate → Seller Review → Publish → Project to Discovery`

Raw seller input may include:
- product photographs
- service descriptions
- PDFs or documents
- spreadsheets/structured imports
- voice/text descriptions
- incomplete catalog records

Possible AI-assisted outputs include:
- product/service title
- description
- category suggestions
- attributes
- tags
- variant suggestions
- localized content
- search-friendly content
- missing-data questions
- image enhancement or generation where permitted
- structured catalog fields

AI-generated facts are not automatically authoritative. Commercial facts such as price, availability, inventory, legal/compliance claims, credentials, and business policies require appropriate source/validation rules.

## 3. Seller AI Copilot Principle

Phoenix should aim for a seller experience in which a business can provide minimal raw input and Phoenix does most of the catalog preparation work.

Example:

1. Seller uploads a photo of a product.
2. Phoenix identifies likely product type and visible attributes.
3. Phoenix proposes structured catalog fields.
4. Phoenix generates draft title and description.
5. Phoenix proposes category, tags, variants, and localization.
6. Phoenix identifies missing or uncertain facts.
7. Seller confirms or corrects the draft.
8. Phoenix publishes only after required validation and policy gates.
9. The resulting structured supply becomes usable by Discovery and Matching.

This experience is a strategic product capability, not merely an internal AI utility.

## 4. AI Must Improve Supply Quality

Bad or incomplete supply produces bad matching.

Therefore AI may be used to:
- improve completeness
- normalize terminology
- detect conflicts or ambiguity
- identify duplicate/near-duplicate content
- improve media quality
- generate localized variants
- create searchable semantic representations
- explain missing requirements to sellers

Supply quality improvements should be measurable and observable.

## 5. AI Operation Economics

Every material AI operation is an economic operation because it consumes model/provider resources.

AI operations must support:
- operation type
- model/provider reference where appropriate
- tenant/workspace context
- actor/request identity
- input/output size or token telemetry where available
- latency
- success/failure
- retry/idempotency identity
- estimated/internal cost signal
- customer-facing usage/charge outcome when applicable

Use the Billing system for plans, entitlements, usage, quotas, credits, and pricing. Do not make AI providers the billing authority.

Customer pricing may be:
- included in a plan
- quota/credit based
- per operation
- bundled
- usage-tiered
- hybrid

Do not expose raw model-provider cost as the only pricing abstraction.

## 6. AI Boundaries

AI output is untrusted input:

`LLM/Image Model → Schema Validation → Provenance → Policy Validation → Authorization → Domain Service → Repository`

AI cannot:
- invent authoritative prices or inventory
- approve verification or credentials
- silently publish content when approval is required
- bypass authorization
- write arbitrary SQL
- change entitlements or financial state without domain authorization
- fabricate customer/workspace identity

## 7. Evaluation

AI product capabilities must be evaluated on business outcomes, not only model quality.

Track relevant measures such as:
- seller time saved
- percentage of catalog successfully created from raw input
- seller correction rate
- content completeness
- publication acceptance rate
- search/discovery quality
- match precision/relevance
- customer conversion after AI-assisted matching
- AI cost per successful operation/outcome
- latency and failure rate

## 8. Provider Strategy

Keep model providers replaceable.

Prompt, model, policy, schema, evaluation, and cost controls should be versioned. AI capabilities must degrade safely when providers fail or quotas are exhausted.

## 9. Strategic Rule

When a new AI capability is proposed, first identify which part of the Phoenix market loop it improves:

`Demand Understanding / Supply Understanding / Decision / Matching / Connection / Action / Learning`

Capabilities that do not strengthen this loop require explicit product justification.
