# Phoenix AI Skill

Native Claude Code entrypoint. Before AI work, read `skills/phoenix-ai/SKILL.md` and `docs/AI_ARCHITECTURE.md`.

## Rules
- AI never accesses D1/R2/Vectorize/private repositories directly.
- Use AI Gateway and typed input/output schemas.
- LLM output is untrusted: schema validation → policy → authorization → domain service → repository.
- Hard constraints are deterministic and outrank semantic similarity.
- Tools declare permissions, side effects, confirmation, risk, actor scope, and idempotency.
- Agents have finite steps, timeout, cost/token budget, explicit tools, cancellation, and auditability.
- External content is untrusted and may contain prompt injection.
- Durable memory requires provenance, privacy, retention, deletion, and scope.
- Medical AI is limited to safe marketplace matching/information; no diagnosis, prescription, treatment, or medication recommendation.
- Production prompts/policies are versioned and evaluated.

## Done
Test authorization, tenant isolation, injection, stale data, tool failure, fallback, quota, cost/latency, and medical boundaries where relevant.
