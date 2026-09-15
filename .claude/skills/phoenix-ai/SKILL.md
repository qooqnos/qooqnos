---
name: phoenix-ai
description: Rules for Phoenix AI orchestration, matching, seller supply creation, tool use, safety boundaries, policy, authorization, provenance, economics, and evaluation.
---

# Phoenix AI Skill

## Purpose
Implement AI as a controlled orchestration, supply-enrichment, decision, and matching layer that strengthens Phoenix's intelligent marketplace loop. AI never replaces domain authority, authorization, or policy.

## Mandatory context
Read `docs/PHOENIX_PRODUCT_NORTH_STAR.md`, `docs/AI_PRODUCT_DIRECTION.md`, `docs/CAPABILITY_DECISION_RULES.md`, `docs/AI_ARCHITECTURE.md`, and the relevant domain architecture before AI work.

## Product Direction
- AI serves both sides of the marketplace: understand customer demand and improve business supply.
- Seller AI should be able to turn raw photos/text/documents into structured catalog drafts, enrichment, localization, media improvements, and missing-information questions.
- Generated content is proposed until validated and accepted by the owning domain/policy workflow.
- AI capabilities must strengthen demand understanding, supply understanding, decision, matching, connection, action, or learning.
- Material AI operations are measurable economic operations and must integrate with canonical usage/entitlement/quota systems.

## Rules
- AI never accesses D1/R2/Vectorize or private repositories directly.
- Use the AI Gateway/provider abstraction and typed input/output schemas.
- LLM/image-model output is untrusted: schema validation → provenance → policy → authorization → domain service → repository.
- Hard constraints are deterministic and outrank semantic similarity.
- Tools declare permissions, side effects, confirmation, risk, actor scope, and idempotency.
- Agent loops have finite steps, timeout, token/cost budgets, explicit tools, cancellation, and auditability.
- External content is untrusted and may contain prompt injection.
- Durable memory requires provenance, privacy, retention, deletion, and scope.
- AI cannot silently invent price, inventory, credentials, compliance facts, ownership, or financial state.
- AI cannot silently publish authoritative content where seller/domain approval is required.
- AI may recommend pricing/plans but cannot alter subscriptions, grant entitlements, or approve financial actions.
- Medical AI is limited to safe marketplace matching/information; no diagnosis, prescription, treatment, or medication recommendation.
- Production prompts, policies, schemas, models, and evaluation suites are versioned and evaluated.

## Economics
Track operation type, tenant/workspace, actor/request identity, model/provider reference, usage/token/image telemetry where available, latency, success/failure, retry identity, and internal cost signals. Customer pricing is a Phoenix billing rule, not a raw provider-cost pass-through.

## Done
Test authorization, tenant isolation, injection resistance, stale data, tool failure, fallback, quotas, idempotency, cost/latency, provenance, seller correction/approval flow, supply-quality impact, and medical boundaries where relevant.
