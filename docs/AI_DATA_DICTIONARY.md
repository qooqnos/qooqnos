# Phoenix AI Data Dictionary

> Status: Architecture-defined / canonical data dictionary
> Scope: AI Gateway, intent, retrieval, ranking, tools, agents, memory, safety, evaluation, observability, and cost governance
> Rule: This dictionary defines shared AI data concepts once. Domain modules own their authoritative business facts; AI references them and never duplicates them as source-of-truth records.

## 1. Purpose

This document is the canonical data dictionary for Phoenix AI. It refines `AI_ARCHITECTURE.md` into stable data concepts, ownership rules, invariants, provenance requirements, lifecycle semantics, and cross-module contracts.

The governing boundary is:

**LLM proposes; policy validates; domain services decide and execute.**

AI data is an intelligence/orchestration representation, not a replacement for domain truth.

## 2. Ownership Model

| Concept | Owner | AI role |
|---|---|---|
| Customer/person identity | Identity / Customer | Reference only |
| Business/provider identity | Business / Identity | Reference only |
| Authorization | Authorization | Enforced externally |
| Service/product facts | Catalog | Retrieve/reference |
| Availability/booking facts | Booking | Retrieve/reference |
| Order/payment facts | Commerce / Billing | Retrieve/reference |
| Loyalty points/rewards | Loyalty | Retrieve/reference |
| Promotion eligibility/discount policy | Promotion | Evaluate/reference |
| Relationship/customer history | CRM | Retrieve/reference |
| Reputation/reviews | Reviews / Trust | Retrieve/reference |
| Communication delivery | Communications | Invoke through capability |
| Analytics facts | Analytics | Consume/emit |
| AI request/context | AI | Own |
| AI prompt/model policy | AI | Own |
| AI retrieval/ranking state | AI | Own, non-authoritative |
| AI tool manifest/execution trace | AI | Own |
| AI memory | AI, subject to privacy ownership rules | Own within policy |

AI must reference canonical IDs and versions instead of copying mutable domain facts into private authoritative tables.

## 3. Identity and Scope Fields

All persistent or traceable AI records that can affect tenant isolation should carry, directly or through a canonical parent:

- `id` — stable unique identifier;
- `tenant_id` — tenant boundary;
- `workspace_id` — workspace boundary where applicable;
- `actor_id` — initiating subject where applicable;
- `actor_type` — customer, business user, operator, system, agent, etc.;
- `created_at` / `updated_at` — canonical timestamps;
- `policy_version` — applicable policy version;
- `schema_version` — data contract version;
- `correlation_id` / `trace_id` — cross-module traceability.

Tenant and authorization context are mandatory inputs to retrieval and tool execution, not model-generated fields.

## 4. AI Request

Represents one normalized request entering the AI Gateway.

### Canonical fields

- request ID;
- task type;
- input payload reference;
- output schema reference;
- actor context reference;
- tenant/workspace scope;
- risk level: low, medium, high, regulated;
- model policy reference;
- locale/language;
- correlation/trace ID;
- created timestamp;
- idempotency key where side effects may occur.

### Invariants

- A request cannot bypass the Gateway.
- Provider SDK details are not exposed to application features.
- Risk level cannot be lowered by model output.
- Sensitive input classification must be established before model routing.

## 5. AI Response

Represents a model result after Gateway processing.

### Canonical fields

- request ID;
- typed output;
- output schema/version;
- model/provider reference;
- token usage;
- latency;
- safety result;
- trace ID;
- grounding/provenance references where applicable;
- outcome/error classification.

### Invariants

A model response is never authoritative merely because it is valid JSON or has high confidence.

## 6. Intent

Represents structured interpretation of natural-language input.

### Canonical fields

- intent ID/type;
- extracted constraints;
- explicit user constraints;
- inferred preferences;
- locale/language;
- confidence metadata;
- provenance per field;
- source request ID;
- schema version.

### Provenance values

- `explicit_user_input`;
- `inferred_preference`;
- `retrieved_fact`;
- `system_policy`.

Explicit constraints always outrank inferred preferences.

## 7. Retrieval Query

Represents a policy-scoped retrieval operation.

### Canonical fields

- query ID;
- normalized query/intent reference;
- tenant/workspace scope;
- actor context;
- hard-filter set;
- lexical query representation;
- semantic query representation;
- requested resource types;
- locale;
- policy version;
- source/version constraints;
- timestamp.

Retrieval must apply authorization, tenant visibility, verification, legal and other hard filters before semantic ranking.

## 8. Retrieval Candidate

Represents a non-authoritative candidate returned by retrieval.

### Required metadata

- resource type;
- canonical resource ID;
- owner/module ID;
- tenant/workspace scope;
- visibility;
- locale;
- content/data version;
- indexing timestamp;
- source reference;
- retrieval method;
- eligibility/filter result.

Vector/index records are accelerators. They never become the authoritative business record.

## 9. Ranking Decision

Represents the deterministic decision context used to order eligible candidates.

### Signals

- hard eligibility;
- semantic fit;
- constraint fit;
- business quality;
- availability fit;
- location fit;
- price fit;
- preference fit;
- explanation features.

`hardEligibility` is binary. Ineligible candidates are removed, not merely assigned a lower score.

The decision stores the policy/model/ranking version sufficient to reproduce the decision.

## 10. Grounding / Provenance

Represents evidence supporting an AI-generated statement or decision.

### Source priority

1. current domain records;
2. verified provider/business content;
3. approved platform policies;
4. explicitly indexed documents;
5. model knowledge only for non-authoritative general context.

### Canonical fields

- source type;
- source module;
- source resource ID;
- source version;
- retrieval timestamp;
- relevant evidence reference;
- freshness status;
- authorization scope.

Mutable marketplace facts require current retrieval or an explicitly valid versioned source.

## 11. AI Tool Manifest

Defines one capability exposed to AI.

### Canonical fields

- tool ID/version;
- owner module;
- input schema;
- output schema;
- permissions/capabilities required;
- side-effect class: none, read, write, external;
- confirmation policy;
- risk level;
- allowed actor classes;
- resource scope;
- lifecycle state.

Tools are references to canonical module capabilities. AI must not create parallel business operations.

## 12. Tool Invocation

Represents one attempted AI tool execution.

### State model

`requested -> validated -> authorized -> executing -> succeeded | failed | denied | cancelled`

### Required evidence

- invocation ID;
- tool/version;
- actor/tenant context;
- input schema/version;
- authorization decision;
- policy decision;
- domain result reference;
- idempotency key when required;
- confirmation evidence when required;
- timestamps;
- trace/correlation ID.

A successful model message is not evidence of successful execution; the domain tool result is authoritative.

## 13. Agent Run

Represents a bounded multi-step AI workflow.

### Canonical fields

- run ID;
- objective/request reference;
- actor/tenant scope;
- allowed tool set;
- risk policy;
- maximum steps;
- wall-clock budget;
- token/cost budget;
- idempotency context;
- current state;
- cancellation state;
- outcome;
- trace ID;
- timestamps.

### Lifecycle

`created -> running -> waiting | completed | failed | cancelled | policy_stopped`

An agent must stop on missing required information, denied policy, exhausted budget, ambiguous tool execution, safety boundary, cancellation, or completion.

## 14. Agent Step

Represents one bounded observe/plan/tool/observe transition.

### Canonical fields

- step number;
- run ID;
- action type;
- input/context reference;
- selected tool reference if any;
- validation result;
- execution result;
- policy result;
- latency/cost;
- timestamp.

Agent steps are append-oriented execution evidence; they do not become domain truth.

## 15. Memory

AI memory has distinct classes.

### 15.1 Conversation Context

Temporary active-session context containing recent messages, tool results, and temporary intent state.

### 15.2 Durable Preference Memory

Explicit, useful, non-sensitive preferences permitted to persist under policy.

### Required fields

- memory ID;
- subject ID/type;
- tenant/workspace scope;
- memory class;
- content/value reference;
- provenance;
- privacy classification;
- retention policy;
- version;
- lifecycle state;
- created/updated/expiry timestamps.

Sensitive information must not become durable memory merely because it appeared in conversation.

## 16. Data Classification

Minimum classification vocabulary:

`public`, `internal`, `confidential`, `personal`, `sensitive`, `regulated`.

Classification governs:

- model/provider eligibility;
- retention;
- logging/redaction;
- retrieval scope;
- human review;
- tool availability.

## 17. Safety Decision

Represents policy evaluation applied to an AI request, output, retrieval, memory operation, or tool invocation.

### Canonical fields

- decision ID;
- policy ID/version;
- risk class;
- decision: allow, deny, constrain, escalate, abstain;
- reasons/rule references;
- actor/tenant scope;
- evidence references;
- timestamp;
- trace ID.

Safety decisions are deterministic policy evidence, not model confidence.

## 18. Prompt Definition / Version

A production prompt is a versioned artifact.

### Canonical fields

- stable prompt ID;
- semantic version;
- owner/module;
- task;
- input contract;
- output contract;
- safety policy reference;
- evaluation status;
- release timestamp;
- rollback target;
- immutable content reference.

A production prompt change creates a new version.

## 19. Model Policy

Defines permitted model-routing behavior.

### Canonical dimensions

- task class;
- permitted providers/models;
- risk class;
- language/locale;
- context requirements;
- latency target;
- cost ceiling;
- tenant plan/quota constraints;
- provider health/fallback rules;
- output requirements.

Features must reference policy rather than hard-code model selection.

## 20. Evaluation Case / Evaluation Run

### Evaluation Case

Contains:

- case ID;
- task type;
- input;
- expected schema/constraints;
- expected safety boundary;
- expected retrieval/ranking/tool behavior where applicable;
- classification: positive, negative, ambiguous, adversarial, boundary;
- locale/domain metadata.

### Evaluation Run

Contains:

- run ID;
- dataset/version;
- model/prompt/policy versions;
- metrics;
- failures;
- regression status;
- timestamp.

Required evaluation dimensions include schema correctness, retrieval relevance, ranking quality, tool selection, policy compliance, grounding, multilingual behavior, latency/cost, adversarial resistance, and medical/regulatory safety where applicable.

## 21. AI Trace

One trace links a complete AI interaction across Gateway, retrieval, tools, policy, and domain outcomes.

### Minimum fields

- request ID;
- tenant/workspace;
- actor class;
- task;
- prompt/policy version;
- model/provider;
- retrieval identifiers;
- tool invocations;
- policy decisions;
- latency;
- token usage;
- estimated cost;
- outcome/error class;
- redaction/classification metadata.

Sensitive content must be redacted according to Security/Data Classification policy.

## 22. Usage / Cost Record

Represents AI consumption for metering and governance.

### Dimensions

- tenant;
- workspace;
- feature/task;
- model/provider;
- request/run reference;
- input tokens;
- output tokens;
- embedding units;
- model calls;
- tool calls;
- cache hits;
- estimated monetary cost;
- timestamp.

Quotas are enforced outside the model and before expensive execution.

## 23. Cache Entry

Represents reusable AI output or retrieval acceleration under explicit freshness/privacy policy.

### Canonical key dimensions

`tenant + locale + task + normalized_input + policy_version + data_version`

### Invariants

- No tenant-private result may be globally shared.
- Mutable marketplace facts require short TTL or explicit source-version invalidation.
- Cache validity must be explainable from freshness and policy dimensions.

## 24. Async AI Job

Represents deferred work such as extraction, classification, embedding generation, re-indexing, large summaries, or evaluations.

### Lifecycle

`queued -> running -> completed | failed | cancelled`

### Required fields

- job ID/type;
- input/output references;
- tenant/workspace scope;
- policy/model version;
- idempotency key;
- retry state;
- attempt count;
- scheduling timestamps;
- outcome/error class;
- trace ID.

Workers must be idempotent and observable.

## 25. Medical Safety Boundary

Medical AI records require regulated classification and explicit policy references where applicable.

AI may support provider discovery, organization of user-provided information, category matching, explanation of provider-published information, and scheduling/contact workflows.

AI must not create authoritative diagnosis, prescription, treatment recommendation, clinical claim, or unverified-provider activation records.

Sensitive health information requires consent and privacy controls from the owning security/privacy architecture.

## 26. Canonical Events

AI events are operational/intelligence events, not replacements for domain events.

Recommended vocabulary:

- `ai.request.created`
- `ai.response.completed`
- `ai.retrieval.completed`
- `ai.ranking.completed`
- `ai.tool.invocation.requested`
- `ai.tool.invocation.completed`
- `ai.tool.invocation.denied`
- `ai.agent.run.started`
- `ai.agent.run.completed`
- `ai.agent.run.failed`
- `ai.memory.created`
- `ai.memory.updated`
- `ai.memory.expired`
- `ai.safety.denied`
- `ai.safety.escalated`
- `ai.evaluation.completed`
- `ai.usage.recorded`
- `ai.job.completed`

Event payloads should carry stable IDs, tenant/workspace scope, schema version, timestamps, and correlation IDs.

## 27. Canonical Capabilities

AI exposes infrastructure capabilities; domain modules expose domain capabilities.

Canonical AI capabilities include:

- `CAP.AI.REQUEST`
- `CAP.AI.INTENT.EXTRACT`
- `CAP.AI.RETRIEVE`
- `CAP.AI.RANK`
- `CAP.AI.EXPLAIN`
- `CAP.AI.TOOL.INVOKE`
- `CAP.AI.AGENT.RUN`
- `CAP.AI.MEMORY.READ`
- `CAP.AI.MEMORY.WRITE`
- `CAP.AI.MEMORY.UPDATE`
- `CAP.AI.MEMORY.EXPIRE`
- `CAP.AI.EVALUATE`
- `CAP.AI.TRACE.READ`
- `CAP.AI.USAGE.READ`

Authorization remains the canonical authority for who may invoke each capability.

## 28. Cross-Module Contract Rules

1. AI never owns another module's business truth.
2. AI references canonical resource IDs and versions.
3. AI never calculates authoritative price, availability, payment status, inventory, credential validity, or promotion eligibility independently.
4. AI never bypasses Authorization.
5. AI never writes directly to domain-private tables.
6. AI tool execution always passes through the owning domain service.
7. Domain services return authoritative results to AI.
8. AI-generated explanations must be grounded in actual evidence/signals.
9. Explicit user constraints outrank inferred preferences.
10. Tenant isolation applies to retrieval, memory, cache, tools, traces, and evaluations.
11. Prompt/model/policy versions required for reproducibility are immutable references.
12. Sensitive/regulated data follows classification and retention policy.
13. Medical safety restrictions are hard policy boundaries.

## 29. Anti-Duplication Rule

There is one shared AI engine.

Do not create:

- Beauty AI engine;
- Fashion AI engine;
- Medical AI engine;
- separate ranking engines per vertical;
- separate memory engines per dashboard;
- separate tool registries per feature.

Vertical differences are expressed through typed intents, domain data, policies, prompts, evaluation cases, and module-owned tools.

## 30. Canonical Data Objects Summary

```text
AIRequest
AIResponse
Intent
RetrievalQuery
RetrievalCandidate
RankingDecision
GroundingEvidence
AIToolManifest
ToolInvocation
AgentRun
AgentStep
MemoryEntry
DataClassification
SafetyDecision
PromptVersion
ModelPolicy
EvaluationCase
EvaluationRun
AITrace
AIUsageRecord
AICacheEntry
AIJob
```

## 31. Completion Gate

The AI data model is considered complete when:

- every AI-owned persistent concept has a defined owner and scope;
- every model/tool decision has policy and provenance references;
- retrieval candidates cannot become authoritative by accident;
- domain facts remain owned by domain modules;
- memory has explicit privacy/retention semantics;
- agent execution is bounded and auditable;
- usage and cost are attributable;
- medical safety is represented as a hard policy boundary;
- verticals reuse the same canonical objects;
- future changes require a module-level ADR rather than a second competing data model.

**Decision:** This document is the canonical AI data dictionary. Future changes extend it through explicit AI module ADRs; new verticals must reuse these objects rather than introduce parallel AI data models.