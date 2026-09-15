# Phoenix AI Data Dictionary

> Status: Canonical architecture contract
> Scope: AI intent, retrieval, ranking, explanation, tools, agents, memory, evaluation, observability, and the shared AI Runtime vocabulary.
> Rule: This dictionary defines shared AI data concepts once. Domain modules own authoritative business facts; AI references them and never duplicates them as source-of-truth records.

## 1. Purpose

This document is the canonical data dictionary for Phoenix AI capabilities that sit above the shared AI Runtime. It defines intelligence/orchestration concepts and their ownership boundaries.

The canonical execution model is:

**AI Capability / Orchestrator -> Canonical AI Runtime -> Provider Adapter -> AI Provider -> validated runtime result -> owning capability/domain contract.**

The Runtime owns model execution mechanics, operation identity, provider attempts, prompt/schema resolution, runtime safety integration, usage telemetry, retries, and routing. This dictionary does not create a second execution model.

The governing domain boundary remains:

**LLM proposes; policy validates; domain services decide and execute.**

AI data is an intelligence/orchestration representation, not a replacement for domain truth.

## 2. Ownership Model

| Concept | Owner | AI role |
|---|---|---|
| Customer/person identity | Identity / Customer | Reference only |
| Business/provider identity | Business / Identity | Reference only |
| Authorization | Access / Authorization | Enforced externally |
| Service/product facts | Catalog | Retrieve/reference |
| Availability/booking facts | Booking | Retrieve/reference |
| Order/payment facts | Commerce / Billing | Retrieve/reference |
| Loyalty points/rewards | Loyalty | Retrieve/reference |
| Promotion eligibility/discount policy | Promotion | Evaluate/reference |
| Relationship/customer history | CRM / Customer | Retrieve/reference |
| Reputation/reviews | Trust / Reviews | Retrieve/reference |
| Communication delivery | Communication | Invoke through capability |
| Analytics facts | Analytics | Consume/emit |
| AI intent/context | AI | Own |
| AI retrieval/ranking state | AI / Discovery contract | Non-authoritative |
| AI tool manifest/execution orchestration | AI | Own; delegates domain behavior |
| AI memory | AI, subject to privacy policy | Own within policy |
| AI operation/model/provider/prompt/schema/usage runtime records | AI Runtime | Own; see canonical Runtime contracts |
| Customer entitlement, quota, credit, price and financial state | Billing | Reference/decision only |

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

## 4. AI Request — Compatibility Concept

Historically, `AIRequest` represented a normalized request entering the AI Gateway. The canonical implementation is now the **AI Runtime operation request** defined by `docs/AI_RUNTIME_ARCHITECTURE.md` and `docs/AI_RUNTIME_DATA_DICTIONARY.md`.

The legacy `AIRequest` concept must therefore not create a second request entity. Its semantic fields map to:

- `operation_id` / `operation_type` / `operation_version`;
- input reference/hash;
- output schema reference;
- actor and tenant/workspace context;
- risk and policy context;
- locale/language;
- correlation/request IDs;
- idempotency key;
- model-selection policy.

**Rule:** Features do not bypass the canonical Runtime by creating feature-local provider requests.

## 5. AI Response — Compatibility Concept

Historically, `AIResponse` represented a model result after Gateway processing. The canonical implementation is now `ai_runtime_result` plus its related operation/attempt/usage records.

A caller-facing AI response may expose:

- typed validated output;
- output schema/version;
- model/provider reference where appropriate;
- usage summary where permitted;
- safety/policy outcome;
- grounding/provenance references;
- warnings/abstention;
- outcome/error classification.

Provider-specific response structures never become Phoenix domain contracts.

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
- source operation/request ID;
- schema version.

### Provenance values

- `explicit_user_input`;
- `inferred_preference`;
- `retrieved_fact`;
- `system_policy`.

Explicit constraints always outrank inferred preferences. Intent is a proposal/interpretation and does not become authoritative domain state.

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

Retrieval infrastructure may use the shared AI Runtime for model-backed query transformation/embedding where applicable, but retrieval remains its own capability and does not create a provider execution stack.

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

Represents the decision context used to order eligible candidates.

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

The decision stores the policy/model/ranking version sufficient to reproduce the decision. If model-backed scoring is used, execution goes through the canonical Runtime.

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

The tool invocation may call `CAP.AI.EXECUTE_TOOL` / the AI tool orchestration contract, but actual business behavior is always delegated to the owning capability.

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

Every model-backed agent step uses the canonical AI Runtime. The Agent capability remains orchestration; it is not a second runtime.

## 14. Agent Step

Represents one bounded observe/plan/tool/observe transition.

### Canonical fields

- step number;
- run ID;
- action type;
- input/context reference;
- selected tool reference if any;
- Runtime operation reference when model execution occurs;
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

Memory retrieval/generation that uses models is executed through the canonical Runtime; memory remains an AI data/feature concern and does not own provider execution.

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

The canonical Runtime evaluates provider/model eligibility using this classification before provider execution.

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

Runtime-level policy execution and evidence use the canonical Runtime policy contracts. Feature-level safety decisions may reference that evidence but must not establish a competing safety authority.

## 18. Prompt Definition / Version

Prompts are canonical Runtime artifacts defined by `docs/AI_RUNTIME_DATA_DICTIONARY.md`.

This dictionary may reference a prompt version for AI capabilities, but must not define a second prompt registry.

A production prompt change creates a new immutable version. Untrusted user, seller, retrieved, uploaded, and tool content remains data and cannot silently become higher-priority instructions.

## 19. Model Policy

Defines permitted model-routing behavior at the AI policy layer.

### Canonical dimensions

- task/operation class;
- permitted providers/models;
- risk class;
- language/locale;
- context requirements;
- latency target;
- cost ceiling;
- tenant plan/quota constraints;
- provider health/fallback rules;
- output requirements;
- data classification and residency restrictions.

The policy selects from centrally registered models/providers through the Runtime. Features must reference policy rather than hard-code provider SDKs or provider model names.

The detailed model/provider records and routing decision vocabulary are owned by `docs/AI_RUNTIME_DATA_DICTIONARY.md`; this section is a semantic AI-policy reference only.

## 20. Evaluation Case / Evaluation Run

### Evaluation Case

Contains:

- case ID;
- task/operation type;
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
- operation/model/prompt/policy versions;
- metrics;
- failures;
- regression status;
- timestamp.

Required evaluation dimensions include schema correctness, retrieval relevance, ranking quality, tool selection, policy compliance, grounding, multilingual behavior, latency/cost, adversarial resistance, and medical/regulatory safety where applicable.

Production model/prompt/schema changes must not bypass the evaluation/versioning contract of the canonical Runtime.

## 21. AI Trace

One trace links a complete AI interaction across capabilities, Runtime operations, retrieval, tools, policy, and domain outcomes.

### Minimum fields

- request ID;
- tenant/workspace;
- actor class;
- task;
- operation IDs;
- prompt/policy/schema versions;
- model/provider references;
- retrieval identifiers;
- tool invocations;
- policy decisions;
- latency;
- token/resource usage;
- estimated internal cost;
- outcome/error class;
- redaction/classification metadata.

Sensitive content must be redacted according to Security/Data Classification policy.

## 22. Usage / Cost Record — Compatibility Concept

AI usage is canonicalized by `ai_usage_record` in the AI Runtime data dictionary and the AI Operation Economics contract.

Feature-level records may summarize usage, but must not create a competing financial or usage authority.

Canonical dimensions include:

- tenant;
- workspace;
- actor;
- operation/feature;
- operation type/version;
- model/provider;
- operation/attempt reference;
- meter unit and quantity;
- usage status;
- entitlement decision reference;
- Billing usage/charge reference where applicable;
- internal provider cost estimate.

**Usage is not automatically a customer charge. Billing remains the only authority for entitlement, quota, credits, pricing, charges, refunds, and reversals.**

## 23. Cache Entry

Represents reusable AI output or retrieval acceleration under explicit freshness/privacy policy.

### Canonical key dimensions

`tenant + locale + task + normalized_input + policy_version + data_version`

For model-backed AI output, prompt/schema/model/operation contract versions must also participate where they materially affect validity.

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
- policy/model/operation version references;
- idempotency key;
- retry state;
- attempt count;
- scheduling timestamps;
- outcome/error class;
- trace ID.

Workers execute model-backed work through the canonical Runtime and remain idempotent and observable.

## 25. Medical Safety Boundary

Medical AI records require regulated classification and explicit policy references where applicable.

AI may support provider discovery, organization of user-provided information, category matching, explanation of provider-published information, and scheduling/contact workflows.

AI must not create authoritative diagnosis, prescription, treatment recommendation, clinical claim, or unverified-provider activation records.

Sensitive health information requires consent and privacy controls from the owning security/privacy architecture.

## 26. Canonical Events

AI capability events are operational/intelligence events, not replacements for domain events.

Runtime operation/usage events are canonicalized by `AI_OPERATION_ECONOMICS_ARCHITECTURE.md` and `AI_RUNTIME_ARCHITECTURE.md`.

Capability-level events may include:

- `ai.request.created`;
- `ai.response.completed`;
- `ai.retrieval.completed`;
- `ai.ranking.completed`;
- `ai.tool.invocation.requested`;
- `ai.tool.invocation.completed`;
- `ai.tool.invocation.denied`;
- `ai.agent.run.started`;
- `ai.agent.run.completed`;
- `ai.agent.run.failed`;
- `ai.memory.created`;
- `ai.memory.updated`;
- `ai.memory.expired`;
- `ai.safety.denied`;
- `ai.safety.escalated`;
- `ai.evaluation.completed`;
- `ai.job.completed`.

Runtime events remain:

- `ai.operation.created.v1`;
- `ai.operation.started.v1`;
- `ai.operation.succeeded.v1`;
- `ai.operation.failed.v1`;
- `ai.operation.partially_succeeded.v1`;
- `ai.operation.retried.v1`;
- `ai.operation.cancelled.v1`;
- `ai.usage.recorded.v1`.

The same logical event must not be emitted twice by separate layers merely because both observed the same operation.

## 27. Canonical Capabilities

AI capabilities are business/intelligence contracts. The shared Runtime is an internal execution boundary, not a parallel business capability.

Canonical AI capability families include:

- `CAP.AI.CLASSIFY`;
- `CAP.AI.EXTRACT`;
- `CAP.AI.GENERATE`;
- `CAP.AI.EVALUATE`;
- `CAP.AI.APPLY_SAFETY_POLICY`;
- `CAP.AI.CREATE_AGENT`;
- `CAP.AI.RUN_AGENT`;
- `CAP.AI.EXECUTE_TOOL`;
- `CAP.AI.MANAGE_MEMORY`;
- `CAP.AI.SELLER.*` capabilities defined by the Seller AI contract;
- intent, retrieval, ranking, explanation, trace, and usage capabilities defined in the Capability Contract Matrix.

`CAP.AI.REQUEST` is a compatibility/legacy term and must not be implemented as a second provider execution entry point. New implementation must use the canonical Runtime operation contract.

There is deliberately no generic public `CAP.AI.EXECUTE_OPERATION`. Model/provider execution is an internal Runtime responsibility.

Authorization remains the canonical authority for who may invoke each capability. Billing remains the authority for entitlement and usage economics.

## 28. Cross-Module Contract Rules

1. AI never owns another module's business truth.
2. AI references canonical resource IDs and versions.
3. AI never calculates authoritative price, availability, payment status, inventory, credential validity, or promotion eligibility independently.
4. AI never bypasses Authorization.
5. AI never writes directly to domain-private tables.
6. AI tool execution always passes through the owning domain capability.
7. Domain services return authoritative results to AI.
8. AI-generated explanations must be grounded in actual evidence/signals.
9. Explicit user constraints outrank inferred preferences.
10. Tenant isolation applies to retrieval, memory, cache, tools, traces, and evaluations.
11. Prompt/model/policy/schema versions required for reproducibility are immutable references.
12. Sensitive/regulated data follows classification and retention policy.
13. Medical safety restrictions are hard policy boundaries.
14. Every model-backed operation uses the canonical AI Runtime.
15. No feature may import a provider SDK directly.
16. No feature may create a feature-local prompt registry, model registry, provider adapter, usage ledger, retry identity, or execution runtime.
17. Runtime output remains untrusted until schema/policy validation and appropriate domain authorization.

## 29. Anti-Duplication Rule

There is one shared AI execution runtime and one canonical runtime data model.

Do not create:

- Beauty AI engine;
- Fashion AI engine;
- Medical AI engine;
- separate ranking engines per vertical;
- separate memory engines per dashboard;
- separate tool registries per feature;
- feature-local provider clients;
- feature-local model/prompt/schema registries;
- feature-local AI billing or usage authorities.

Vertical differences are expressed through typed intents, domain data, policies, prompts, evaluation cases, and module-owned tools while model execution remains centralized.

## 30. Canonical Data Objects Summary

### AI capability-layer objects

```text
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
ModelPolicy
EvaluationCase
EvaluationRun
AITrace
AICacheEntry
AIJob
```

### Canonical Runtime objects

Defined once in `docs/AI_RUNTIME_DATA_DICTIONARY.md`:

```text
AI Operation
AI Operation Type
AI Model
AI Provider
AI Model Routing Decision
AI Prompt
AI Prompt Version
AI Schema
AI Schema Version
AI Policy
AI Policy Decision
AI Provider Attempt
AI Runtime Result
AI Usage Record
```

This separation is intentional: capability-layer concepts compose the Runtime; they do not redefine it.

## 31. Canonical References and Completion Gate

This dictionary must remain consistent with:

- `docs/AI_ARCHITECTURE.md` — broad AI architecture baseline;
- `docs/AI_RUNTIME_ARCHITECTURE.md` — canonical execution boundary;
- `docs/AI_RUNTIME_DATA_DICTIONARY.md` — canonical Runtime data vocabulary;
- `docs/AI_OPERATION_ECONOMICS_ARCHITECTURE.md` — canonical AI economics boundary;
- `docs/SELLER_AI_PRODUCT_CREATION_DATA_DICTIONARY.md` — Seller AI workflow vocabulary;
- `docs/CAPABILITY_CONTRACT_MATRIX.md` — capability ownership contract;
- `docs/AI_CAPABILITY_RUNTIME_RECONCILIATION.md` — Capability/Runtime reconciliation.

The AI data architecture is considered complete for this layer when:

- no feature owns a parallel provider execution path;
- AI capabilities compose the single Runtime;
- legacy Gateway/request/response concepts map to Runtime concepts without creating duplicate entities;
- model/provider/prompt/schema/routing records have one canonical vocabulary;
- usage and customer economics have one canonical ownership boundary;
- tool and agent execution remain bounded and auditable;
- domain facts remain owned by domain modules;
- tenant, authorization, provenance, safety, and privacy boundaries are explicit;
- historical Runtime executions can be explained through immutable version references;
- new vertical AI features require configuration/contracts, not a new AI engine.
