# Phoenix Homepage Product Contract

## Purpose

The public Homepage at `/` is the primary entry point to Phoenix's Intelligent Decision & Matching Layer.

Phoenix is fundamentally an intelligent decision and connection layer between customers and businesses.

The Homepage must communicate and demonstrate:

`Understand Demand → Understand Supply → Decide → Match → Connect → Act → Learn`

## Homepage is not Dashboard

`/` is the customer-facing Phoenix experience.

Operational surfaces belong to their dedicated routes such as `/business`, `/product-studio`, `/billing`, `/admin`, and other management routes.

Do not make revenue, KPI cards, product management, CRM, analytics, booking management, operational tables, or administrative navigation the dominant Homepage experience.

## Primary User Model

The first five seconds should communicate:

> I can tell Phoenix what I need, and Phoenix helps me find the right option.

The primary interaction is a natural-language Demand Interface, not a conventional keyword-only catalog search.

## Homepage Sections

The approved conceptual structure is:

1. Public header
2. Hero / Ask Phoenix
3. Natural-language Demand Input
4. Intent examples
5. Phoenix matching/decision demonstration
6. Phoenix loop
7. Discovery examples
8. Business / supply value
9. Seller AI supply-enrichment value
10. Final Ask Phoenix CTA
11. Footer/public shell

The exact implementation may evolve, but the product responsibility of each section must remain.

## Demand Interface

Users may express needs naturally, for example:

> برای جمعه شب یک رستوران آرام برای ۴ نفر می‌خواهم، نزدیک مرکز شهر و با قیمت متوسط.

The Homepage must not force users to understand catalog taxonomy before expressing a need.

The Demand Interface should be architected so it can later evolve from text to text + voice + image + context without replacing the entire Homepage.

## Matching

When real matching capabilities are available, Phoenix should expose useful matching context and explain why an option is relevant.

The UI must never fabricate production matching signals.

If a backend capability is not yet available, use a clean integration boundary or clearly labelled static demonstration rather than fake live intelligence.

## Business and Seller AI

Business value should be framed as supply becoming discoverable and matchable when it is relevant to customer demand.

Seller AI should be presented as supply enablement:

`Raw Seller Input → AI Extraction/Enrichment → Validation → Marketplace Supply → Discovery/Matching`

Generated commercial content remains proposed until accepted by the owning domain/policy workflow.

## Authentication

Authentication state must not automatically turn `/` into a Dashboard.

The Homepage remains the Phoenix decision/matching experience for authenticated users. Operational management remains on dedicated routes.

## Visual Direction

The Homepage should feel intelligent, calm, focused, modern, human, and trustworthy.

It should not look like an ERP, CRM, admin panel, analytics dashboard, or generic SaaS dashboard.

## Implementation Rules

Before changing `/`:

1. Read this document.
2. Read `docs/PHOENIX_PRODUCT_NORTH_STAR.md`.
3. Read `docs/CAPABILITY_DECISION_RULES.md`.
4. Read `docs/IMPLEMENTATION_LEDGER.md`.
5. Inspect existing Homepage, Discovery, matching, design-system, and authentication implementations.
6. Reuse canonical capabilities instead of creating parallel implementations.

## Acceptance Criteria

A Homepage change is acceptable only when:

- The primary action is expressing a need.
- Phoenix's decision/matching identity is obvious.
- Dashboard functionality does not dominate the page.
- The experience supports the North Star loop.
- Existing canonical capabilities are reused.
- Loading, empty, error, responsive, and accessibility states are handled where applicable.
- No fabricated production data or matching explanations are introduced.
