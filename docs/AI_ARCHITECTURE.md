# Phoenix AI Architecture

> Status: Architecture baseline
> Scope: AI runtime, retrieval, agents, tools, memory, safety, evaluation, and cost governance

## 1. Purpose

Phoenix uses AI as an intelligent orchestration and matching layer, not as a replacement for domain logic, authorization, or source-of-truth data.

The governing rule is:

**LLM proposes; policy validates; domain services decide and execute.**

AI must never obtain direct database credentials, bypass authorization, mutate private module tables directly, or create an authoritative business fact from an unverified model response.

## 2. Architectural Position

```text
User / Business / Internal Operator
            |
            v
      AI Interaction API
            |
            v
     AI Orchestrator
       /    |     \
      /     |      \
 Intent   Policy    Context
 Parser   Engine    Builder
      \     |      /
       \    |     /
        v   v    v
     Retrieval / Reranking
            |
            v
      Tool Registry
            |
            v
   Domain Application Services
            |
            v
 Repository / D1 / R2 / Vectorize
```

The AI layer is therefore downstream from identity/authorization and upstream from domain application services.

## 3. AI Responsibilities

AI may:

- understand natural-language requests;
- extract structured intent and constraints;
- classify requests;
- retrieve permitted knowledge;
- rank candidate businesses/services/products;
- generate explanations and summaries;
- propose actions through typed tools;
- maintain conversational context;
- ask clarifying questions;
- transform approved source material into user-facing language;
- perform bounded multi-step workflows.

AI may not:

- grant permissions;
- activate an unverified provider;
- diagnose a medical condition;
- prescribe or recommend medication/treatment;
- invent availability, pricing, credentials, inventory, or policy;
- write directly to another module's private data;
- execute an external side effect without the required authorization and confirmation policy;
- treat model confidence as authorization.

## 4. AI Gateway

All model access goes through one internal AI Gateway abstraction.

Responsibilities:

- provider/model abstraction;
- request normalization;
- model routing;
- timeout and retry policy;
- token and cost accounting;
- safety policy attachment;
- structured-output enforcement;
- tracing;
- redaction/classification;
- fallback/degradation;
- provider-specific adapters.

Application code must not import provider SDKs directly.

Recommended interface:

```ts
interface AIRequest<TSchema> {
  task: string;
  input: unknown;
  outputSchema: TSchema;
  actorContext: AIActorContext;
  tenantId: string;
  riskLevel: "low" | "medium" | "high" | "regulated";
  modelPolicy: ModelPolicy;
}

interface AIResponse<T> {
  output: T;
  model: string;
  provider: string;
  usage: TokenUsage;
  latencyMs: number;
  traceId: string;
  safety: SafetyResult;
}
```

## 5. Model Routing

Model selection is policy-driven, not hard-coded inside features.

Routing inputs:

- task type;
- latency target;
- context length;
- output schema complexity;
- risk level;
- language;
- tenant plan/quota;
- current provider health;
- estimated cost.

Example policy classes:

```text
fast-low-cost       -> simple classification/extraction
balanced            -> matching/explanation
high-quality        -> complex reasoning / difficult synthesis
regulated-safe      -> constrained workflows with additional checks
embedding           -> semantic retrieval
```

A model may fail over to an approved alternative, but fallback must preserve schema, policy, and data-isolation guarantees.

## 6. Intent and Structured Constraints

Natural language is converted into a typed request before retrieval.

Example:

```json
{
  "intent": "find_beauty_service",
  "category": "hair_color",
  "location": { "city": "Tehran", "radiusKm": 10 },
  "budget": { "min": null, "max": 5000000, "currency": "IRR" },
  "preferences": ["natural_result", "female_provider"],
  "time": null,
  "language": "fa"
}
```

Every extracted field has provenance:

- explicit user input;
- inferred preference;
- retrieved fact;
- system policy.

Inferred fields must never silently override explicit user constraints.

## 7. Retrieval Architecture

Phoenix uses hybrid retrieval.

```text
User request
    |
    +--> hard filters ------------------+
    |                                   |
    +--> semantic embedding -----------> Candidate set
    |                                   |
    +--> lexical/structured signals ---+
                                        |
                                        v
                                  Reranker
                                        |
                                        v
                                  Policy filter
                                        |
                                        v
                                  Final results
```

### 7.1 Hard filters first

Examples:

- tenant/workspace visibility;
- provider verification state;
- business category;
- service availability;
- location constraints;
- price range;
- inventory/status;
- country/legal eligibility;
- user permissions.

Semantic similarity must never be used to override a hard business constraint.

### 7.2 Vector retrieval

Vectorize is a retrieval accelerator, not the source of truth.

Every vector record must carry enough metadata to enforce isolation and filtering, including at minimum:

- tenant/workspace scope;
- resource type;
- resource ID;
- module ID;
- visibility;
- locale;
- content version;
- indexing timestamp.

A stale or missing vector must never make a record authoritative.

## 8. Ranking and Matching

Ranking is deterministic around AI-generated signals.

Recommended conceptual score:

```text
finalScore =
  hardEligibility
  * weighted(
      semanticFit,
      constraintFit,
      businessQuality,
      availabilityFit,
      locationFit,
      priceFit,
      preferenceFit
    )
```

`hardEligibility` is binary. Ineligible candidates are removed rather than receiving a low score.

The ranking pipeline should retain feature-level explanations for observability and user-facing explanations where appropriate.

## 9. RAG and Source of Truth

Retrieval-augmented generation is permitted only from approved sources.

Source priority:

1. current domain records;
2. verified provider/business content;
3. approved platform policies;
4. explicitly indexed documents;
5. model knowledge only for non-authoritative general context.

When an answer depends on mutable business data, the model must retrieve current data rather than rely on its pretrained knowledge.

Generated text must not be persisted as factual source data unless a domain workflow explicitly approves it.

## 10. Tool Registry

AI tools are registered module capabilities.

Each tool declares:

```ts
interface AIToolManifest {
  id: string;
  version: string;
  inputSchema: unknown;
  outputSchema: unknown;
  permissions: string[];
  sideEffect: "none" | "read" | "write" | "external";
  confirmation: "never" | "recommended" | "required";
  riskLevel: "low" | "medium" | "high" | "regulated";
  allowedActors: string[];
}
```

Tool execution pipeline:

```text
LLM intent
  -> schema validation
  -> actor/tenant context
  -> tool permission check
  -> resource policy check
  -> domain service
  -> transaction
  -> audit/outbox
  -> typed result
  -> model
```

The model never receives database credentials or arbitrary SQL capability.

## 11. Side Effects and Confirmation

Read-only tools may execute automatically when authorized.

Write/external tools require policy evaluation. High-impact actions require explicit confirmation unless a pre-authorized workflow says otherwise.

Examples requiring confirmation or equivalent policy:

- booking an appointment;
- sending a message externally;
- creating an order;
- changing a business profile;
- deleting data;
- initiating a financial transaction.

The confirmation must summarize the intended action and material parameters before execution.

## 12. Agent Loop

Phoenix supports bounded agents rather than unrestricted autonomous loops.

```text
observe
  -> plan
  -> choose tool
  -> validate
  -> execute
  -> observe result
  -> continue / ask / finish
```

Every run has:

- maximum steps;
- maximum wall-clock time;
- maximum token/cost budget;
- allowed tool set;
- risk policy;
- cancellation support;
- idempotency key where side effects exist.

The agent must stop when:

- required information is missing;
- policy denies an action;
- budget is exhausted;
- tool execution is ambiguous;
- a safety boundary is reached;
- the requested outcome is complete.

## 13. Prompt Injection Defense

External content is untrusted input.

Prompt injection can originate from:

- provider descriptions;
- uploaded documents;
- web pages;
- product metadata;
- chat messages;
- retrieved knowledge;
- tool outputs.

Controls:

- separate instructions from data;
- label untrusted content;
- never treat retrieved text as system instructions;
- constrain tool schemas;
- enforce authorization outside the model;
- validate outputs;
- apply resource-level policy after model selection;
- prevent secrets from entering model context;
- log injection detections and policy decisions.

No prompt-level instruction can replace an authorization check.

## 14. Memory

AI memory has separate classes.

### Short-term conversation memory

Used for the active conversation/session. It may contain recent messages, tool results, and temporary intent state.

### Durable preference memory

Only explicit, useful, non-sensitive preferences should become durable by default. Examples include preferred language, style, or recurring marketplace preferences.

Durable memory requires:

- defined ownership;
- retention policy;
- tenant/user scope;
- deletion/update path;
- provenance;
- privacy classification.

Sensitive information must not become durable memory merely because it appeared in a conversation.

## 15. Privacy and Data Classification

Every AI input/output path must classify data.

Minimum classes:

```text
public
internal
confidential
personal
sensitive
regulated
```

Classification controls:

- whether data may be sent to a model;
- which provider/model is permitted;
- retention policy;
- logging/redaction policy;
- retrieval scope;
- human-review requirements.

For regulated or sensitive workflows, minimize context and prefer deterministic domain data retrieval.

## 16. Medical Safety Boundary

Medical functionality is a hard policy boundary.

Phoenix AI may:

- help locate verified providers;
- organize user-provided information;
- match a request to provider/service categories;
- explain provider-published information;
- assist with scheduling/contact workflows.

Phoenix AI must not:

- diagnose;
- prescribe medication;
- recommend treatment plans;
- infer a medical diagnosis from symptoms;
- fabricate clinical claims;
- activate an unverified medical provider.

Medical workflows require explicit safety policies, verified credentials, consent for sensitive information, and additional evaluation coverage.

## 17. Structured Outputs and Hallucination Controls

Every machine-consumed AI response must use a schema.

Controls:

- strict structured output;
- enum validation;
- range validation;
- source/provenance fields;
- current-data retrieval for mutable facts;
- cross-checks for critical values;
- abstention when evidence is insufficient;
- deterministic post-processing.

For example, an AI response saying a business is open at 18:00 is not authoritative unless a domain availability source confirms it.

## 18. Confidence and Explanations

Confidence is not permission.

A confidence value may support UX and ranking, but authorization, verification, and eligibility remain deterministic.

User-facing explanations should be grounded in actual matching signals:

```text
Recommended because:
- within your requested area;
- offers the requested service;
- price fits your range;
- matches your stated style preference.
```

Avoid fabricated explanations that were not derived from ranking features or source data.

## 19. Async AI Jobs

Expensive operations run asynchronously.

Examples:

- document extraction;
- portfolio classification;
- embedding generation;
- bulk re-indexing;
- large summaries;
- evaluation suites.

Workers must be idempotent and observable. User-facing requests should not block on work that can safely be deferred.

## 20. Prompt and Policy Versioning

Prompts are production artifacts.

Each prompt/policy must have:

- stable ID;
- semantic version;
- owner/module;
- intended task;
- input/output contract;
- safety policy;
- evaluation status;
- release timestamp;
- rollback target.

Do not silently edit a production prompt while treating it as the same version.

## 21. Evaluation

AI features require automated evaluation before production release.

Evaluation layers:

1. schema correctness;
2. retrieval relevance;
3. ranking quality;
4. tool selection;
5. policy compliance;
6. hallucination/grounding;
7. multilingual behavior;
8. latency and cost;
9. adversarial/prompt-injection resistance;
10. medical/regulatory safety where applicable.

Evaluation datasets should include positive, negative, ambiguous, adversarial, and boundary cases.

Production traces may feed an anonymized/approved evaluation corpus according to retention and privacy policy.

## 22. Observability

Every AI run should have a trace containing:

- request ID;
- tenant/workspace;
- actor class;
- task/prompt version;
- model/provider;
- retrieval identifiers;
- tool calls;
- policy decisions;
- latency;
- token usage;
- estimated cost;
- outcome/error class.

Sensitive content must be redacted according to classification policy.

## 23. Cost and Quotas

AI consumption is metered by tenant and feature.

Track:

- input tokens;
- output tokens;
- embedding units;
- model calls;
- tool calls;
- estimated monetary cost;
- cache hits.

Quotas must be enforced outside the model and before expensive execution.

Plans may define different limits, but no plan may bypass safety or authorization.

## 24. Caching

Cache only when the result's freshness and privacy scope are understood.

Cache keys should include relevant dimensions such as:

```text
tenant + locale + task + normalized-input + policy-version + data-version
```

Never share tenant-private AI results through a global cache.

Mutable marketplace facts require short TTLs or explicit source-version invalidation.

## 25. Multilingual and Localization

AI must support the platform's i18n contract rather than inventing localization rules.

Important dimensions:

- language;
- locale;
- direction;
- timezone;
- currency;
- number formatting;
- calendar system.

Persian/Jalali dates must be normalized to canonical timestamps for domain logic and rendered through the localization layer.

## 26. Failure and Degradation

AI is an enhancement layer, not the only path to core data access.

When AI is unavailable:

- structured marketplace search remains available where implemented;
- domain records remain authoritative;
- users can retry or use deterministic flows;
- queued jobs retry according to policy;
- no partial side effect is reported as successful.

A failed model call must not create a false domain state.

## 27. Security Invariants

1. No direct LLM-to-database access.
2. No AI bypass of authorization.
3. No cross-tenant retrieval.
4. No model-controlled permission changes.
5. No side effect without domain validation.
6. No unverified medical provider activation.
7. No medical diagnosis/prescription/treatment recommendation.
8. No secrets in prompts or model context.
9. No arbitrary tool execution.
10. Every write tool is auditable.
11. Every machine-consumed output is schema validated.
12. Every regulated workflow has explicit policy and evaluation coverage.

## 28. Package Boundaries

Recommended packages:

```text
packages/ai/
├── gateway/
├── models/
├── prompts/
├── policies/
├── tools/
├── retrieval/
├── ranking/
├── memory/
├── safety/
├── evaluation/
├── observability/
└── cost/
```

Modules own their domain-specific AI tools and prompts under their module boundary; shared AI infrastructure stays in `packages/ai`.

## 29. Implementation Order

1. AI Gateway contract and provider adapters.
2. Structured intent schema.
3. AI policy engine integration.
4. Tool registry and secure executor.
5. Hybrid retrieval interfaces.
6. Embedding/index pipeline.
7. Matching/ranking engine.
8. Conversation context and safe memory.
9. Agent runner with budgets/limits.
10. Prompt registry/versioning.
11. Evaluation harness.
12. AI telemetry/cost accounting.
13. Beauty marketplace AI workflow.
14. Fashion workflow.
15. Medical pilot with dedicated safety gates.

## 30. Definition of Done

An AI capability is production-ready only when:

- its domain owner is identified;
- its AI contract is typed;
- all tools have manifests and permissions;
- retrieval is tenant-safe;
- mutable facts come from authoritative sources;
- outputs are schema validated;
- side effects pass domain authorization;
- prompt/policy versions are recorded;
- evaluation cases exist;
- adversarial cases exist;
- cost/latency are measurable;
- auditability exists for writes;
- failure/degradation behavior is defined;
- localization behavior is defined;
- sensitive-data handling is documented;
- medical/regulatory boundaries are tested where applicable.
