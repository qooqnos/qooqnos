# Phoenix Capability Decision Rules

> Status: Product architecture governance

## Purpose

These rules determine whether a proposed feature belongs in Phoenix, where it belongs, and whether it strengthens the product North Star.

## Rule 1 — Start from the Marketplace Loop

Every meaningful capability must identify its role in:

`Understand Demand → Understand Supply → Decide → Match → Connect → Act → Learn`

A feature with no meaningful relationship to this loop requires explicit product approval.

## Rule 2 — Core vs Supporting Capability

A capability is **core** when it directly improves:
- demand understanding
- supply understanding/quality
- decision quality
- matching/ranking
- connection
- conversion/action
- measurable marketplace learning

A capability is **supporting** when it enables those outcomes without being the outcome itself, such as billing, authorization, notifications, analytics, documents, or operational administration.

Supporting capabilities remain important but must not redefine Phoenix's product identity.

## Rule 3 — Seller Features Must Improve Supply

Seller-facing capabilities should reduce the effort required to create trustworthy, discoverable supply.

Prefer:
- "Upload a photo and let Phoenix build a draft product"
- "Give Phoenix a service description and let it structure the offering"
- "Let Phoenix find missing information and ask only what is necessary"

Over:
- large manual catalog forms as the default experience
- duplicate content-entry workflows
- isolated business tooling with no marketplace effect

## Rule 4 — Customer Features Must Improve Decisions

Customer-facing capabilities should reduce search effort, improve relevance, clarify trade-offs, or accelerate a useful action.

Prefer:
- intent understanding
- contextual recommendations
- explainable ranking
- comparison and qualification
- conversational discovery

Do not optimize for engagement without evidence that it improves customer outcomes.

## Rule 5 — AI Must Be Grounded in Domain Authority

AI can propose, extract, transform, summarize, rank, and recommend.

AI cannot silently become the source of truth for:
- price
- inventory/availability
- credentials/verification
- financial state
- authorization
- ownership
- legal/compliance facts

The owning domain remains authoritative.

## Rule 6 — Every Paid AI Operation Needs an Economic Contract

When an AI capability materially consumes model/provider resources, define:
- operation identity
- usage measurement
- quota/entitlement behavior
- internal cost telemetry
- customer pricing or inclusion rule
- retry/idempotency behavior
- audit/financial trace where applicable

The product may charge per operation, consume credits, include usage in plans, or use hybrid pricing.

## Rule 7 — Do Not Confuse Provider Cost with Customer Price

Model/token cost is an internal economic signal.

Customer pricing is a Phoenix product rule and may account for:
- model cost
- image generation cost
- storage/processing cost
- value delivered
- plan economics
- margins
- bundled services

Never hard-code retail price as a direct pass-through of a provider's raw token price.

## Rule 8 — Reuse Canonical Capabilities

Before creating a new service or module, inspect existing contracts.

Do not create separate implementations for the same underlying capability such as:
- AI usage metering
- product generation
- media optimization
- localization
- matching
- billing
- authorization
- audit

Create the capability once at its canonical layer and expose it through contracts.

## Rule 9 — Measure Business Outcomes

A capability is not successful because it works technically.

Where applicable, define outcome metrics such as:
- seller effort/time saved
- supply completeness
- seller correction rate
- publication success
- match relevance
- qualified connection rate
- booking/purchase/lead conversion
- customer effort reduction
- AI cost per successful outcome

## Rule 10 — Reject Feature Drift

A feature should be challenged when it:
- primarily increases feature count
- creates an isolated SaaS utility
- duplicates another module
- increases manual seller work without improving supply quality
- consumes AI without measurable value
- weakens trust, provenance, authorization, or policy controls
- makes Phoenix more like a generic back-office system than an intelligent marketplace

## Mandatory Proposal Questions

Before substantial implementation, the proposal should answer:

1. Which part of the North Star does this improve?
2. Is it demand-side, supply-side, decision/matching, connection/action, or supporting infrastructure?
3. Which existing canonical capability should it reuse?
4. What authoritative domain owns the resulting data?
5. Does AI participate? If yes, what is proposed versus authoritative?
6. What usage/cost/entitlement implications exist?
7. What measurable product outcome should improve?
8. What prevents the feature from drifting away from the Phoenix marketplace loop?
