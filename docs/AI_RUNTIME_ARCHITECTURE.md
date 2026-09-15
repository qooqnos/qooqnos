# Phoenix Canonical AI Runtime Architecture

> Status: Canonical architecture contract
> Scope: Shared execution runtime for every AI operation across Customer AI, Seller AI, Agents, Automation, and future AI capabilities.

## 1. Purpose

Phoenix must have exactly one canonical AI execution runtime. Every material model-backed operation uses this runtime instead of implementing provider calls, retries, schema validation, safety, usage accounting, or model selection independently.

The runtime is an execution layer, not a domain authority.

The governing rule is:

**Caller defines the business intent; AI Runtime executes a governed AI operation; domain capabilities remain the authority.**

The runtime consolidates the existing AI Gateway responsibilities with the AI Operation and AI Operation Economics contracts.

## 2. Canonical Position

```text
Customer / Seller / Agent / Workflow / Module
                    |
                    v
          AI Capability / Orchestrator
                    |
                    v
          Canonical AI Runtime
                    |
       +------------+-------------+
       |            |             |
       v            v             v
 Operation      Policy       Model/Prompt/Schema
 Identity       & Safety          Resolution
       |            |             |
       +------------+-------------+
                    |
                    v
            Provider Adapter
                    |
                    v
              AI Provider
                    |
                    v
       Parse -> Validate -> Safety
                    |
                    v
          Runtime Result + Usage
                    |
          +---------+---------+
          |                   |
          v                   v
       AI Caller            Billing
                              |
                              v
                    Usage / Charge Outcome
```

The runtime is the only approved boundary between Phoenix application code and external model providers.

## 3. Ownership Boundaries

| Concern | Canonical owner |
|---|---|
| AI operation taxonomy and execution state | AI Runtime / AI |
| Provider adapter | AI Runtime / AI |
| Model metadata and routing policy | AI |
| Prompt/template version | AI |
| Machine output schema | AI / owning capability contract |
| Safety policy execution | AI + Policy/Access contracts |
| Authentication/authorization | Identity + Access |
| Tenant/workspace isolation | Platform + Access |
| Plans, entitlements, quotas, credits, customer pricing | Billing |
| Provider/internal cost telemetry | AI Runtime |
| Customer usage/charge outcome | Billing |
| Product/service/offer facts | Catalog |
| Inventory | Inventory/Commerce capability |
| Availability | Booking/Availability capability |
| Verification/credentials | Trust/Verification |
| Search projection | Discovery |
| Domain mutation | Owning domain capability |
| Audit evidence | Platform/Audit |

No runtime component may become a second source of truth for these domain concerns.

## 4. Canonical Runtime Contract

The canonical runtime entry point is conceptually:

```text
execute(operationRequest) -> operationResult
```

The request must identify at minimum:

- `operation_id`
- `operation_type`
- `operation_version`
- optional `session_id`
- tenant/workspace context
- actor/request/correlation context
- idempotency key
- input reference or normalized input
- prompt/instruction contract reference
- output schema reference
- safety/policy context
- model-selection policy
- execution constraints such as timeout and budget

The result must expose at minimum:

- operation identity and status
- validated output or output reference
- output schema/version
- provider/model actually used
- usage telemetry where available
- safety decision
- provenance metadata
- warnings/abstention information
- retry/fallback information
- typed error classification when unsuccessful

Provider-specific response shapes must not leak into caller-facing domain contracts.

## 5. Runtime Pipeline

Every material operation follows the same governed sequence:

```text
1. Authenticate caller context
2. Validate tenant/workspace scope
3. Check permission
4. Resolve operation definition/version
5. Check Billing entitlement/quota/credit policy
6. Establish operation identity + idempotency
7. Resolve prompt/instructions
8. Resolve output schema
9. Resolve safety/data-classification policy
10. Resolve approved model/provider
11. Build and classify model context
12. Execute provider adapter
13. Normalize provider response
14. Record usage and internal cost telemetry
15. Parse and schema-validate output
16. Apply post-execution safety/policy checks
17. Record operation outcome
18. Return typed result to caller
19. Emit canonical events
```

Steps must not be reimplemented by Seller AI, Customer AI, Agent, or individual modules.

## 6. Operation Identity and Idempotency

`operation_id` identifies the logical AI operation. Provider attempts are separate executions of that operation.

Required semantics:

```text
logical operation
    operation_id
        attempt 1
        attempt 2
        attempt 3
```

A retry keeps the logical operation identity and increments `attempt_number`.

The runtime must prevent duplicate logical results and duplicate customer charging. Billing remains the authority for usage consumption and financial outcome.

A timeout does not prove that a provider did not execute. Ambiguous provider execution must be represented explicitly and reconciled rather than silently replayed as a new billable operation.

## 7. Model Registry and Routing

Model selection is centralized.

A model profile should describe, conceptually:

- stable model identifier;
- provider identifier;
- supported operation/capability classes;
- supported modalities;
- context/output limits;
- structured-output capability;
- tool/function capability where applicable;
- language/localization coverage;
- data-classification restrictions;
- region/data-residency restrictions;
- availability/status;
- routing priority/fallback group;
- internal cost metadata;
- effective version/date.

Features must request a model policy, not name a provider SDK or hard-code a provider model unless an explicit architecture exception exists.

Routing may consider task, quality target, latency target, context size, risk, locale, entitlement limits, provider health, and internal cost signal.

## 8. Provider Adapter Contract

External providers are adapters behind the runtime.

An adapter is responsible for translating the canonical runtime request into provider-specific requests and translating provider responses/errors back into the canonical runtime form.

Adapters may handle:

- authentication with the provider;
- provider-specific request format;
- streaming protocol;
- provider-specific usage fields;
- provider request identifiers;
- provider error normalization.

Adapters must not own Phoenix authorization, Billing rules, domain mutation, or customer pricing.

Application code must never import a provider SDK directly.

## 9. Prompt and Instruction Registry

Prompts are versioned production artifacts.

A prompt definition contains, conceptually:

- stable prompt ID;
- semantic version;
- operation type/version;
- locale;
- instruction/template references;
- variable/input contract;
- output schema reference;
- safety policy reference;
- evaluation status;
- release/effective timestamp;
- rollback target;
- content checksum.

Production prompt changes require a new version. Runtime callers reference a contract, not an editable prompt string.

Untrusted retrieved content, seller content, uploaded documents, and user content must remain data rather than silently becoming higher-priority instructions.

## 10. Output Schema Registry

Every machine-consumed model result must have a versioned output contract.

Schema responsibilities include:

- structural validation;
- required fields;
- enums and ranges;
- nullable/optional semantics;
- compatibility/version policy;
- provenance fields where needed;
- abstention/unknown representation where evidence is insufficient.

Schema validation is mandatory before a result is passed to a domain capability or persisted as a draft.

A schema-valid result is still untrusted business input. Validation does not make an AI-generated fact authoritative.

## 11. Safety and Policy Boundary

Safety is applied both before and after provider execution where required.

Pre-execution controls may include:

- data classification;
- provider/model eligibility;
- prompt-injection defenses;
- sensitive-data minimization;
- regulated-workflow restrictions;
- tool/side-effect policy;
- tenant/resource policy.

Post-execution controls may include:

- safety classification;
- schema validation;
- grounding/provenance checks;
- policy validation;
- high-risk value checks;
- abstention or human-review requirements.

Authorization is never delegated to the model or represented by model confidence.

## 12. Data Classification and Provider Eligibility

The runtime must know the classification of model context before provider execution.

Minimum classes:

```text
public
internal
confidential
personal
sensitive
regulated
```

Provider/model policy may restrict which classifications can be sent to which providers, regions, or models.

Secrets, credentials, access tokens, database credentials, and unnecessary personal/sensitive data must not enter model context.

Logging follows the same classification boundary and must redact protected content.

## 13. Billing and Economics Boundary

The runtime does not calculate authoritative customer pricing.

Canonical economic flow:

```text
AI Runtime Operation
      |
      v
Billing entitlement/quota/credit decision
      |
      v
provider execution
      |
      v
usage measurement + internal cost telemetry
      |
      v
Billing customer usage/charge outcome
```

Rules:

- no execution of a chargeable operation without the required entitlement decision;
- no customer charge directly from provider cost;
- no entitlement grant by AI;
- no subscription mutation by AI;
- usage recording must be idempotent;
- concurrent quota consumption must be safe;
- retries must not create accidental duplicate customer charges;
- refunds/reversals/credits belong to Billing.

Provider cost is an operational signal for routing, capacity, and economics. It is not automatically the customer price.

## 14. Failure, Retry, and Degradation

The runtime classifies failures so callers can distinguish:

- authorization denied;
- entitlement denied;
- policy blocked;
- invalid input;
- provider unavailable;
- provider timeout;
- provider rate limit;
- provider execution error;
- invalid model output;
- safety blocked;
- ambiguous execution;
- cancelled;
- expired.

Retries are policy-driven, bounded, and idempotent. They must not retry unsafe side effects merely because the model request failed.

Fallback to another model/provider is allowed only when the fallback satisfies the same operation contract, data policy, safety policy, and authorization constraints.

When AI is unavailable, deterministic domain capabilities remain authoritative and usable where implemented.

## 15. Partial Success

A bundled AI workflow may contain multiple logical sub-operations.

Example:

```text
seller.product.create
  -> classify       succeeded
  -> extract        succeeded
  -> enrich         failed
  -> localize       pending
```

Successful results must be retained and reusable. Recovery must continue from the failed/pending boundary rather than rerunning every successful operation.

Technical operation granularity and customer billing granularity are separate concerns.

## 16. Caching

Caching is allowed only when freshness, privacy scope, and policy compatibility are explicit.

A conceptual cache key may include:

```text
tenant + operation + normalized-input + prompt-version + schema-version + policy-version + source-version
```

Tenant-private results must never leak through a shared cache.

Mutable marketplace facts require source-version invalidation or an appropriate freshness policy.

## 17. Observability

Every runtime execution should correlate:

- request ID;
- correlation ID;
- operation ID;
- attempt number;
- tenant/workspace;
- actor class;
- operation type/version;
- prompt version;
- schema version;
- model/provider;
- provider request ID;
- policy/safety decisions;
- latency;
- usage units;
- internal cost estimate;
- fallback count;
- outcome/error class.

Sensitive model content must not be logged merely for observability.

## 18. Canonical Events

The runtime reuses the AI Operation Economics event vocabulary:

- `ai.operation.created.v1`
- `ai.operation.started.v1`
- `ai.operation.succeeded.v1`
- `ai.operation.failed.v1`
- `ai.operation.partially_succeeded.v1`
- `ai.operation.retried.v1`
- `ai.operation.cancelled.v1`
- `ai.usage.recorded.v1`

Billing remains responsible for customer-economic events such as entitlement decisions, charge assessment, usage reversal, and refunds.

## 19. Runtime Does Not Own Domain State

The runtime may return structured proposals, decisions, classifications, or generated content.

It must never directly:

- write Catalog tables;
- change Business records;
- alter Booking availability;
- create Commerce financial state;
- approve Trust verification;
- grant Access permissions;
- alter Billing subscriptions or prices;
- publish authoritative marketplace facts without the owning capability/policy.

A caller must invoke the canonical domain capability after runtime output is validated and authorized.

Canonical pattern:

```text
AI Runtime
   -> validated proposal
   -> caller/orchestrator
   -> canonical domain capability
   -> transaction
   -> audit/outbox/event
```

## 20. Relationship to AI Capabilities

The runtime is infrastructure behind existing AI capabilities; it is not a replacement for them.

Examples:

```text
CAP.AI.CLASSIFY
CAP.AI.EXTRACT
CAP.AI.GENERATE
CAP.AI.EVALUATE
CAP.AI.APPLY_SAFETY_POLICY
CAP.AI.RUN_AGENT
CAP.AI.EXECUTE_TOOL
CAP.AI.SELLER.GENERATE_PRODUCT_DRAFT
```

These capabilities use the runtime. They must not implement provider access, prompt execution, schema enforcement, retries, or usage accounting a second time.

Seller AI therefore remains an orchestration workflow while the runtime remains the shared execution mechanism.

## 21. Security Invariants

1. Provider SDKs are accessible only through runtime adapters.
2. No direct model-to-database access.
3. No cross-tenant context or cache leakage.
4. Authorization is evaluated outside the model.
5. Billing authority is outside the model and runtime.
6. No secrets in model context.
7. Every machine-consumed output is schema validated.
8. Safety policy is applied independently of model confidence.
9. Runtime output cannot directly mutate authoritative domain state.
10. Provider fallback cannot weaken data, safety, authorization, or tenant guarantees.
11. Retry cannot create accidental duplicate customer charges.
12. Partial success is recoverable.
13. Provider-specific details do not become Phoenix domain contracts.
14. Every material execution is traceable without requiring sensitive content logging.

## 22. Testing Contract

Before production, the runtime requires contract coverage for:

- provider adapter conformance;
- model routing;
- prompt/version resolution;
- schema validation;
- safety/policy enforcement;
- tenant isolation;
- authorization boundary;
- entitlement/quota enforcement;
- idempotency;
- retry and timeout ambiguity;
- fallback safety;
- partial success recovery;
- usage attribution;
- internal cost telemetry;
- customer charge boundary;
- redaction/classification;
- prompt-injection resistance;
- cancellation and expiry.

Each provider adapter must pass the same canonical contract suite.

## 23. Implementation Boundary

The preferred package boundary is:

```text
packages/ai/
├── runtime/          # canonical execution boundary
├── providers/        # provider adapters only
├── models/           # model registry/routing metadata
├── prompts/          # prompt definitions/versioning
├── schemas/          # machine-output contracts
├── safety/           # safety integration
├── tools/            # AI tool manifests/execution delegation
├── retrieval/        # retrieval infrastructure
├── ranking/          # AI/ranking support
├── memory/           # AI memory
├── evaluation/       # evaluation harness
└── observability/    # runtime telemetry
```

Exact package layout may evolve, but ownership must remain equivalent. Provider adapters must not become alternative runtimes.

## 24. Non-Duplication Rule

Before adding any AI feature, ask:

1. Does it need model execution? Use the canonical runtime.
2. Does it need provider access? Add/use a runtime provider adapter.
3. Does it need model selection? Use the model registry/routing contract.
4. Does it need a prompt? Register a versioned prompt.
5. Does it need structured output? Register/reuse a schema.
6. Does it need safety? Attach the canonical policy.
7. Does it consume AI usage? Use the canonical operation/usage contract.
8. Does it change domain state? Invoke the owning domain capability.
9. Does it need permissions? Use Access.
10. Does it need entitlement/quota/price? Use Billing.

If a feature introduces a second implementation of one of these concerns, it is an architectural defect.

## 25. Definition of Done

The canonical AI runtime is considered architecturally complete when:

- every material AI operation has one execution boundary;
- all providers are adapters behind that boundary;
- model selection is centralized and policy-driven;
- prompts are versioned;
- output schemas are versioned and validated;
- pre/post safety controls are explicit;
- operation identity and idempotency are mandatory;
- usage is integrated with Billing without transferring financial authority;
- internal provider cost is separated from customer pricing;
- retries, timeouts, fallback, and partial success have explicit semantics;
- tenant isolation and data classification are enforced;
- observability is standardized;
- domain mutation remains owned by domain capabilities;
- Customer AI, Seller AI, Agents, Automation, and future AI features can reuse the same runtime without creating parallel execution stacks.

## 26. Strategic Outcome

Phoenix should be able to add a new AI capability by defining its business contract, prompt/schema/policy requirements, and domain integration—**not by building another AI gateway, provider client, retry system, usage meter, safety wrapper, or billing path.**

That is the canonical runtime principle for the entire platform.
