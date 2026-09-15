# Phoenix AI Provider & Model Governance

> Status: Canonical architecture contract
> Scope: AI provider registry, model registry, routing, fallback, health, residency, capability eligibility, lifecycle, and governance.
> Rule: Provider/model governance is centralized in the AI Runtime. Product features never own provider clients, model registries, routing algorithms, or fallback logic.

## 1. Purpose

Phoenix may use multiple AI providers and models, but provider diversity must never become architectural fragmentation.

The canonical boundary is:

**AI Capability -> AI Runtime -> Model Routing -> Provider Adapter -> Provider**

This document governs which providers/models are eligible and how the Runtime selects them. It does not create a second execution runtime or a second data dictionary.

Canonical runtime data objects remain defined in:

- `docs/AI_RUNTIME_DATA_DICTIONARY.md`
- `docs/AI_RUNTIME_ARCHITECTURE.md`

## 2. Governance Principles

1. One canonical provider registry.
2. One canonical model registry.
3. One canonical routing decision per Runtime operation.
4. Provider SDK access only through Provider Adapters.
5. Features request semantic operation contracts, not provider implementations.
6. Routing is policy-driven and reproducible.
7. Data classification and residency are hard eligibility constraints.
8. Safety, authorization, and output-contract requirements outrank cost optimization.
9. Fallback may only use an equivalent eligible contract.
10. Model/provider health may affect routing but may never bypass policy.
11. Provider cost is an internal economic signal; Billing owns customer pricing.
12. Deprecated models cannot be silently selected for new production operations.
13. Every production selection is traceable to immutable registry/version references.

## 3. Provider Registry

`ai_provider` is the canonical provider profile.

### Required governance attributes

- `provider_id` — stable Phoenix identifier;
- provider type/category;
- adapter version;
- supported operation classes;
- supported modalities;
- supported regions;
- data-processing/residency constraints;
- authentication reference (secret material never stored in the registry itself);
- health state;
- operational status;
- policy eligibility;
- effective-from / effective-until;
- terms/compliance metadata references where required;
- fallback group membership;
- created/updated timestamps.

Provider identity is stable even when the provider changes API versions. Adapter versions are separately versioned.

### Provider lifecycle

`proposed -> evaluated -> approved -> active -> restricted -> deprecated -> retired`

A provider may be technically healthy but policy-ineligible. Health and eligibility are distinct decisions.

## 4. Model Registry

`ai_model` is the canonical model profile.

### Required governance attributes

- `model_id` — stable Phoenix model identity;
- `provider_id`;
- provider model name/reference;
- model version/revision;
- supported operation classes;
- modalities;
- context/input/output limits;
- structured-output support;
- tool/function support;
- language/localization support;
- supported data classifications;
- residency/region constraints;
- availability state;
- routing priority;
- fallback group;
- internal cost metadata;
- effective-from / effective-until;
- lifecycle status;
- evaluation status;
- created/updated timestamps.

A provider model name is implementation metadata, not a public Phoenix capability name.

## 5. Model Capability Profile

Every registered model must declare capabilities relevant to routing, including where applicable:

- text input/output;
- image input/output;
- audio input/output;
- video input/output;
- embeddings;
- structured output;
- tool calling;
- streaming;
- multilingual support;
- maximum context;
- maximum output;
- deterministic/seed support where available;
- safety/policy compatibility;
- required data-processing region.

A model that lacks a required capability is ineligible regardless of ranking score.

## 6. Operation Contract Compatibility

Routing begins from the semantic AI operation, not from a provider.

The Runtime resolves:

`operation_type + operation_version + output_schema + policy + data_classification + locale + workload requirements`

into an eligible candidate set.

Examples:

- `ai.extract` requiring structured output excludes models without compatible structured output.
- `ai.embed` excludes generative-only models.
- a regulated-data operation excludes providers/models without approved handling.
- a tool-using operation excludes models without compatible tool support.

Provider/model selection must never alter the semantic contract expected by the caller.

## 7. Eligibility Gate

Eligibility is a hard gate before optimization.

A candidate is eligible only if all required constraints pass:

1. provider is active and approved;
2. model is active and approved;
3. operation type/version is supported;
4. output schema is supported;
5. required modality is supported;
6. data classification is permitted;
7. residency/region policy is satisfied;
8. safety policy is satisfied;
9. actor/tenant policy is satisfied;
10. entitlement/quota permits execution;
11. provider/model limits can satisfy the request;
12. model evaluation status meets the operation risk requirement.

**Hard constraints eliminate candidates; scoring never resurrects an ineligible candidate.**

## 8. Routing Decision

`ai_model_routing_decision` records why a model/provider was selected.

### Required decision evidence

- routing decision ID;
- operation ID;
- routing policy/version;
- candidate model/provider IDs;
- eligibility results;
- selected model/provider;
- fallback group;
- decision factors;
- policy constraints;
- health snapshot/reference;
- timestamp.

The decision must be sufficient to explain why the selected candidate was eligible and preferred.

## 9. Routing Optimization

After hard eligibility, the Runtime may optimize using policy-defined signals such as:

- task quality/evaluation score;
- required modality/capability fit;
- expected latency;
- provider/model health;
- context capacity;
- locale quality;
- reliability;
- internal provider cost;
- workload capacity;
- routing priority.

The weighting and thresholds are versioned routing policy, not hidden feature logic.

Cost must not outrank safety, authorization, residency, or minimum quality thresholds.

## 10. Routing Policy

A routing policy is a versioned governance artifact.

Minimum dimensions:

- operation classes covered;
- eligible provider/model set or selection rules;
- hard constraints;
- quality thresholds;
- latency targets;
- cost ceilings or preferences;
- region/residency requirements;
- data classification requirements;
- fallback rules;
- rollout percentage/canary rules;
- effective time window;
- emergency disable controls;
- evaluation requirement.

Changing routing behavior in production creates a new policy version and leaves prior decisions reproducible.

## 11. Health and Availability

Health is not a single boolean.

Recommended states/signals include:

- `healthy`;
- `degraded`;
- `rate_limited`;
- `unavailable`;
- `maintenance`;
- `unknown`.

Signals may include:

- recent success rate;
- timeout rate;
- latency percentile;
- provider rate-limit state;
- transport error rate;
- schema-validation failure rate;
- safety/policy compatibility;
- recent capacity signals.

Health signals influence routing only after hard policy eligibility is established.

## 12. Fallback Governance

Fallback is a controlled continuation of the same logical AI operation, not a new business operation.

A fallback candidate must preserve:

- same semantic operation contract;
- same operation version;
- same output schema contract or an explicitly compatible schema;
- same authorization context;
- same tenant scope;
- same safety policy;
- same data classification/residency guarantees;
- acceptable quality threshold;
- allowed operation economics according to Billing policy.

A provider failure does not authorize arbitrary substitution.

### Fallback triggers

Possible triggers include:

- provider unavailable;
- timeout;
- rate limit;
- transient provider error;
- capacity exhaustion;
- explicit policy disablement.

Invalid model output may permit fallback only when policy says the failure is recoverable and the retry remains within the same contract.

## 13. Retry vs Fallback

These are distinct:

- **Retry:** repeat the same provider/model path when safe and policy-approved.
- **Fallback:** select another eligible provider/model.

Both remain attempts of the same logical `operation_id` and use the canonical idempotency model.

A retry/fallback can create additional provider cost. Customer usage/charge treatment remains a Billing decision.

## 14. Data Residency and Classification

Provider/model governance must encode where data may be processed.

Minimum decision inputs:

- data classification;
- tenant/workspace policy;
- required region/residency;
- provider processing location;
- model processing characteristics;
- contractual/compliance eligibility.

For `personal`, `sensitive`, and `regulated` data, routing must fail closed when required governance metadata is missing or incompatible.

## 15. Evaluation Gate

A model may be technically available without being approved for every operation.

Approval should be operation-specific where risk warrants it.

Evaluation should cover:

- schema correctness;
- semantic quality;
- extraction accuracy;
- classification accuracy;
- retrieval/ranking quality where relevant;
- tool correctness;
- grounding;
- safety/policy compliance;
- multilingual behavior;
- latency;
- reliability;
- internal cost;
- adversarial robustness;
- domain-specific risk.

A model change or materially changed provider adapter requires the appropriate evaluation before production activation.

## 16. Canary and Rollout

New models/providers must support controlled rollout.

Recommended lifecycle:

`registered -> evaluated -> shadow/canary -> limited production -> active -> restricted/deprecated`

Rollout policy must be versioned and auditable.

A failed canary must be reversible by routing policy/version change without modifying application feature code.

## 17. Deprecation and Retirement

### Deprecation

A model/provider is marked deprecated when it should no longer receive new production traffic.

Existing operations may continue only if policy explicitly permits completion.

### Retirement

Retired models/providers are ineligible for new or retried execution.

Historical operation records retain immutable references to the retired model/provider/adapter versions for audit and reproducibility.

No feature should need a code release merely to stop using a retired provider/model.

## 18. Emergency Controls

Operations must support centralized emergency controls such as:

- disable provider;
- disable model;
- disable model/operation combination;
- restrict region;
- tighten data classification eligibility;
- force fallback group;
- raise minimum quality threshold;
- stop new traffic while allowing safe in-flight completion where possible.

Emergency controls belong to Runtime governance/policy administration, not feature code.

## 19. Provider Adapter Boundary

Provider adapters are the only integration layer allowed to understand provider-specific API mechanics.

Adapter responsibilities:

- provider authentication mechanism;
- request/response translation;
- streaming translation;
- provider request IDs;
- provider usage extraction;
- provider error normalization;
- provider-specific limits.

Adapters must not own:

- Phoenix authorization;
- Billing decisions;
- customer pricing;
- domain mutations;
- business policy;
- seller/customer identity;
- independent retry ledgers;
- independent prompt/schema registries.

Application code must never import a provider SDK directly.

## 20. Economics Boundary

Routing may consume internal cost metadata to optimize operational economics.

It must never infer authoritative customer price from provider cost.

The economic chain remains:

**Runtime operation -> usage record -> Billing entitlement/usage decision -> customer charge outcome**

Billing remains the only authority for:

- plans;
- entitlements;
- quotas;
- credits;
- customer prices;
- charges;
- refunds;
- reversals.

## 21. Observability

Every production routing decision should be traceable through:

- operation ID;
- routing decision ID;
- routing policy/version;
- model/provider ID/version;
- adapter version;
- candidate set and eligibility outcome;
- selected candidate;
- fallback/retry history;
- provider request ID;
- latency;
- usage;
- estimated internal cost;
- safety/policy outcome;
- final operation outcome.

Sensitive payloads must obey data classification and redaction policy.

## 22. Security Rules

1. Provider credentials are secrets, never model/provider business data.
2. Provider access occurs only from trusted server-side Runtime boundaries.
3. Tenant context is established before routing.
4. Model selection cannot expand actor permissions.
5. Untrusted content cannot modify routing policy.
6. Prompt injection cannot change provider governance constraints.
7. Provider responses remain untrusted until Runtime validation/safety processing.
8. Cross-tenant cache or telemetry leakage is prohibited.
9. Emergency disable controls are authenticated, authorized, and audited.

## 23. Failure Semantics

If no eligible provider/model remains:

`operation -> denied/unavailable` with a typed reason.

The Runtime must not silently downgrade to an unapproved model.

If execution is ambiguous after timeout, the Runtime records the ambiguity and follows the canonical retry/reconciliation policy; it does not assume non-execution.

If fallback succeeds after the first attempt fails, the logical operation remains one operation with multiple attempts.

## 24. Anti-Duplication Matrix

| Concern | Canonical owner | Forbidden duplicate |
|---|---|---|
| Provider registry | AI Runtime | Feature provider list |
| Model registry | AI Runtime | Feature model list |
| Routing | AI Runtime | Per-feature router |
| Fallback | AI Runtime | Per-feature fallback chain |
| Provider SDK | Provider Adapter | Direct feature SDK import |
| Prompt registry | AI Runtime | Feature prompt store |
| Output schema registry | AI Runtime | Feature schema registry |
| Usage telemetry | AI Runtime + Billing contract | Feature usage ledger |
| Customer pricing | Billing | Runtime/provider pricing |
| Authorization | Access | Provider/model selection as permission |
| Domain mutation | Domain capability | Provider callback/model output |
| Safety authority | Policy/Security + Runtime integration | Provider-specific safety shortcut |

## 25. Canonical References

This contract is subordinate to and must remain consistent with:

- `docs/AI_RUNTIME_ARCHITECTURE.md`;
- `docs/AI_RUNTIME_DATA_DICTIONARY.md`;
- `docs/AI_OPERATION_ECONOMICS_ARCHITECTURE.md`;
- `docs/AI_DATA_DICTIONARY.md`;
- `docs/AI_CAPABILITY_RUNTIME_RECONCILIATION.md`;
- `docs/CAPABILITY_CONTRACT_MATRIX.md`;
- `docs/SECURITY_ARCHITECTURE.md`.

The Runtime data dictionary remains the canonical vocabulary for `ai_provider`, `ai_model`, and `ai_model_routing_decision`. This document defines governance rules around those existing objects and does not redefine their schema.

## 26. Completion Gate

Provider/model governance is complete when:

- one provider registry exists;
- one model registry exists;
- all provider SDK calls pass through adapters;
- every selection is policy/version traceable;
- hard eligibility precedes optimization;
- data classification/residency are enforced;
- health is separated from policy eligibility;
- retry and fallback are distinct and idempotent;
- model approval is evaluation-backed;
- canary/rollout/deprecation are centrally controlled;
- emergency disable is available without feature rewrites;
- provider cost remains separate from customer pricing;
- no feature contains a private provider/model/router implementation;
- historical operations remain reproducible through immutable references;
- Customer AI, Seller AI, Agent, Automation, and future AI capabilities all consume the same governance boundary.
