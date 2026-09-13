---
name: phoenix-ai
description: Rules for Phoenix AI orchestration, matching, tool use, safety boundaries, policy, authorization, provenance, and evaluation.
---

# Phoenix AI Skill

## Purpose
Implement AI as a controlled orchestration and matching layer, never as a replacement for domain authority, authorization, or policy.

## Mandatory context
Read `docs/AI_ARCHITECTURE.md` and the relevant domain architecture before AI work.

## Rules
- AI never accesses D1/R2/Vectorize or private repositories directly.
- Use the AI Gateway/provider abstraction and typed input/output schemas.
- LLM output is untrusted: schema validation → policy → authorization → domain service → repository.
- Hard constraints are deterministic and outrank semantic similarity.
- Tools declare permissions, side effects, confirmation, risk, actor scope, and idempotency.
- Agent loops have finite steps, timeout, token/cost budgets, explicit tools, cancellation, and auditability.
- External content is untrusted and may contain prompt injection.
- Durable memory requires provenance, privacy, retention, deletion, and scope.
- Medical AI is limited to safe marketplace matching/information; no diagnosis, prescription, treatment, or medication recommendation.
- Production prompts and policies are versioned and evaluated.

## Done
Test authorization, tenant isolation, injection resistance, stale data, tool failure, fallback, quotas, cost/latency, provenance, and medical boundaries where relevant.
