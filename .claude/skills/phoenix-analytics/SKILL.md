---
name: phoenix-analytics
description: Rules for Phoenix analytics, observability, data platform, privacy, event integrity, metrics, and AI evaluation.
---

# Phoenix Analytics Skill

## Purpose

Implement and review Analytics, Observability, and Data Platform work according to `docs/ANALYTICS_OBSERVABILITY_DATA_PLATFORM_ARCHITECTURE.md`.

## Non-Negotiable Rules

- Domain modules and D1 remain transactional Source of Truth.
- Analytics is derived; never use analytical data as an implicit transactional authority.
- Use versioned, tenant-aware, idempotent events through the outbox flow.
- Separate operational telemetry, product/business analytics, and AI evaluation/cost data.
- Minimize, classify, redact, and restrict sensitive data.
- Partner analytics must be workspace-scoped.
- Analytics access follows authorization; dashboards cannot grant extra data access.
- Never log secrets, signed URLs, payment-card data, raw medical content, or unnecessary sensitive AI prompts/responses.
- Analytics failure must not block core marketplace transactions.

## Required Event Context
Where applicable preserve:
- event ID/version
- occurrence time
- source module
- tenant/workspace
- request/trace correlation
- resource reference
- locale/context
- privacy classification

## AI Observability
Record model/provider, prompt, policy, tool, retrieval/index versions, latency, usage/cost, and outcome categories without unnecessarily retaining sensitive content.

## Metrics
Metric definitions must document formula, owner, source events, timezone/calendar semantics, attribution window, privacy class, and version.

## Completion Criteria
Verify tenant isolation, consent/privacy enforcement, event idempotency, schema compatibility, timezone/Jalali boundaries, data-quality handling, analytics-outage resilience, dashboard authorization, and AI trace integrity before declaring work complete.
