# Phoenix AI Tool & Agent Governance

> Status: Canonical architecture governance contract  
> Scope: AI Tools, Agent runs/steps, authorization, policy, confirmation, idempotency, domain delegation, runtime usage, audit, and anti-duplication.  
> Rule: This document reconciles existing AI, Access, Safety, Billing, Runtime, and Domain authorities. It does not create a second runtime, permission engine, policy engine, or domain capability layer.

## 1. Purpose

Phoenix Agents and AI Tools are controlled orchestration surfaces over canonical capabilities. They are not alternate implementations of business behavior.

The canonical relationship is:

```text
Agent
  -> Agent Policy / Allowed Tool Set
  -> Tool Manifest
  -> Input Validation
  -> Authorization
  -> AI Safety / Policy
  -> Confirmation when required
  -> Idempotency
  -> CAP.AI.EXECUTE_TOOL
  -> Owning Domain Capability
  -> Transaction / Audit / Outbox
  -> Authoritative Domain Result
  -> Tool Result
  -> Agent Step / Agent Run
```

For model-backed reasoning or tool selection, the Agent uses the single canonical AI Runtime. The Agent is orchestration, not execution infrastructure.

## 2. Canonical Authority Boundaries

| Concern | Canonical owner | Tool/Agent role |
|---|---|---|
| Authentication/session | Identity/Auth | consume authenticated context |
| Tenant/workspace scope | Platform/Access | carry and preserve scope |
| Permission / authorization | Access/Authorization | request decision; never infer |
| AI safety/policy | Policy/Security + AI policy contract | evaluate/enforce through canonical policy |
| AI execution | AI Runtime | use for model-backed work |
| Tool registry/manifest | AI | expose references to capabilities |
| Domain behavior/state | Owning domain capability | authoritative |
| Entitlement/quota/credits | Billing | request decision |
| Customer pricing/charge/refund | Billing | never infer or mutate |
| Audit evidence | Platform/Audit | emit/consume evidence |
| Agent orchestration | AI | bounded workflow state |

No Tool or Agent may absorb the authority of another layer.

## 3. Tool Is a Capability Adapter, Not a Business Capability

An AI Tool is a controlled interface through which an AI actor can request an existing capability.

```text
AI Tool
   != Domain Capability
   != Repository
   != Provider SDK
   != Permission Engine
   != Billing Engine
   != AI Runtime
```

A Tool manifest may describe the capability it exposes, input/output schemas, required permissions, resource scope, side-effect class, risk, confirmation policy, actor constraints, and lifecycle.

The Tool must delegate actual business behavior to the owning capability. It must not duplicate validation, pricing, inventory, availability, booking, communication, verification, or other domain rules already owned elsewhere.

## 4. Canonical Tool Contract

Every Tool definition must have a stable identity and version and conceptually include:

```text
Tool ID
Tool Version
Owner / Owning Capability
Input Schema + Version
Output Schema + Version
Required Capability / Permission
Resource Scope
Allowed Actor Classes
Side-Effect Class
Risk Class
Confirmation Policy
Idempotency Policy
AI Runtime Requirement
Lifecycle State
Policy Reference
```

The manifest is declarative metadata. It is not permission to execute.

A model choosing a Tool is never sufficient authorization.

## 5. Tool Side-Effect Classes

The canonical classes are:

| Class | Meaning | Minimum control |
|---|---|---|
| `none` | analysis/transform with no authoritative side effect | policy + schema |
| `read` | reads authoritative state | authorization + visibility + policy |
| `write` | changes Phoenix state | authorization + policy + idempotency |
| `external` | causes an external side effect | stronger policy + confirmation where required |
| `high_risk` | material financial, legal, identity, verification, safety, or irreversible impact | explicit high-risk policy + confirmation/re-auth where required |

Side-effect classification is policy metadata; the model cannot downgrade it.

## 6. Canonical Tool Invocation Flow

Each invocation is a bounded execution record.

```text
requested
  -> schema_validated
  -> scope_validated
  -> authorized
  -> policy_allowed
  -> confirmation_satisfied (if required)
  -> idempotency_validated
  -> executing
  -> succeeded | failed | denied | cancelled | ambiguous
```

The invocation carries, at minimum:

- invocation ID;
- tool/version;
- owning capability reference;
- actor ID/class;
- tenant/workspace scope;
- resource scope;
- input/schema reference;
- authorization decision reference;
- policy decision reference;
- confirmation evidence when required;
- idempotency identity when required;
- domain result reference;
- request/correlation/trace IDs;
- timestamps and outcome/error class.

A model-generated statement that an action succeeded is not evidence of success. The authoritative result comes from the delegated capability.

## 7. Authorization Boundary

Tool authorization uses the existing Access authority.

The canonical rule is:

```text
Authenticated Actor
   -> Tenant/Workspace Context
   -> Required Permission / Capability
   -> Resource Policy / Scope
   -> Allow or Deny
```

The Tool layer must not implement a parallel RBAC/ABAC evaluator.

A Tool manifest's `required_permission` is a declaration of the authorization requirement, not an authorization decision.

Agent identity, model confidence, previous successful steps, or user wording cannot grant permission.

## 8. Safety and Policy Boundary

Authorization and safety are independent gates.

```text
Authorization allow
        AND
Policy allow
        AND
Entitlement allow where applicable
        AND
Confirmation satisfied where required
        AND
Runtime/tool/domain preconditions satisfied
        => execution may proceed
```

Untrusted model, user, seller, retrieved, uploaded, external, memory, and tool-result content cannot:

- grant permissions;
- change tenant scope;
- disable safety;
- alter Billing decisions;
- change tool risk classification;
- bypass confirmation;
- publish authoritative domain facts;
- suppress audit evidence.

## 9. Confirmation Semantics

Confirmation is required whenever the applicable policy says the side effect is material or high risk.

Confirmation must bind to the exact intended action, including where relevant:

```text
Tool ID + version
Capability
Resource(s)
Material parameters
Side-effect summary
Expected consequence
Operation / invocation identity
Policy version
```

A generic earlier approval must not silently authorize a materially different action.

Changing a material parameter, target resource, financial amount, recipient, permission scope, or other policy-defined risk factor invalidates confirmation when required.

Confirmation is evidence, not authorization; Access still decides whether the actor is permitted.

## 10. Idempotency and Retry

Every mutating Tool must have an explicit idempotency policy.

The canonical identity relationship is:

```text
Agent Run
  -> Agent Step
     -> Tool Invocation
        -> Domain Command
```

The logical operation must remain identifiable across retries. A retry may create another technical attempt, but it must not accidentally create duplicate domain state or customer charges.

Rules:

1. Mutation commands use the owning domain capability's transaction/idempotency contract.
2. Tool orchestration does not invent a second idempotency store.
3. Ambiguous external execution is represented as `ambiguous`; it is not blindly retried.
4. Billing consequences are determined by Billing, not the Tool or Agent.
5. Provider/runtime retries remain governed by the canonical AI Runtime.

## 11. Domain Delegation

The Tool boundary ends before authoritative domain mutation.

```text
Tool Invocation
   -> authorized + policy-allowed request
   -> canonical domain capability
   -> transaction
   -> audit/outbox/event
   -> authoritative result
```

Examples:

- Catalog Tool -> Catalog capability
- Booking Tool -> Booking capability
- Commerce Tool -> Commerce capability
- Communication Tool -> Communication capability
- Trust/Verification Tool -> Trust capability
- Access Tool -> Access capability, subject to stronger policy

These examples are mappings, not new capabilities.

A Tool must never write another module's tables directly.

## 12. Agent Governance

An Agent is a bounded orchestrator that observes state, reasons through the canonical AI Runtime, and requests Tools/capabilities.

Every Agent Run must have explicit bounds, conceptually including:

```text
Run ID
Objective / Request Reference
Actor / Tenant / Workspace
Allowed Tool Set
Policy / Risk Context
Maximum Steps
Wall-Clock Budget
Token / AI Cost Budget
Idempotency Context
Cancellation State
Current State
Outcome
Trace / Correlation IDs
```

Canonical Agent lifecycle:

```text
created
 -> running
 -> waiting
 -> completed
 |-> failed
 |-> cancelled
 |-> policy_stopped
 |-> budget_exhausted
```

An Agent must stop when required authorization/policy/confirmation is denied, a tool execution is ambiguous, a safety boundary is reached, required data is missing, the budget is exhausted, or cancellation is requested.

## 13. Agent Step Governance

An Agent Step is bounded execution evidence, not domain truth.

A step may represent:

```text
observe
plan
runtime_reasoning
tool_request
tool_result
finalize
```

When model execution occurs, the step references the canonical `ai_operation`/Runtime result. When a Tool executes, the step references the canonical Tool Invocation and domain result.

Agent steps must be append-oriented and traceable. They must not become a shadow copy of Catalog, Booking, Commerce, Access, Billing, or Trust state.

## 14. Agent Tool Selection

Tool selection is a constrained decision, not a free-form model action.

The eligible tool set is computed from deterministic context such as:

- actor and tenant scope;
- allowed actor class;
- capability/permission requirements;
- resource scope;
- policy/risk restrictions;
- data classification;
- tool lifecycle state;
- domain preconditions;
- entitlement where applicable.

The model may choose among eligible tools, but it cannot expand the eligible set.

Semantic relevance cannot override a hard eligibility constraint.

## 15. Result Integrity

Tool results must distinguish at least:

```text
success
failure
denied
cancelled
ambiguous
partial
```

For successful mutations, the authoritative result is the owning domain capability result.

For reads, freshness/visibility rules remain those of the owning domain or projection.

For partial workflows, successful prior steps remain valid evidence and must not be replayed unnecessarily.

## 16. Billing and AI Economics

Tool and Agent execution must reuse the canonical AI economics model.

Model-backed steps use:

```text
AI Operation
 -> Usage Event
 -> Billing Entitlement / Quota / Credit Decision
 -> AI Runtime
 -> Usage Measurement / Cost Telemetry
 -> Billing Outcome
```

A Tool invocation may be chargeable, included, quota-consuming, or non-billable according to Billing policy. The Tool/Agent cannot decide customer price, charge, refund, or credit restoration.

A workflow bundle may have a commercial meter different from its technical AI operation count; both remain observable.

## 17. Memory and Agent Context

Agent memory/context is input to orchestration, not authority.

Memory, prior tool results, retrieved content, and model-generated plans cannot:

- grant permission;
- prove verification;
- establish ownership;
- establish current availability;
- establish financial state;
- replace current domain truth;
- change policy or tool definitions.

Mutable facts must be re-read from their canonical authority when required by freshness policy.

## 18. Prompt Injection and Tool Abuse

All model-visible external content is untrusted.

Instruction hierarchy remains:

```text
Platform/system policy
  > Runtime safety constraints
  > Capability contract
  > Authorized tool contract
  > User request
  > Retrieved/external/seller content
```

A malicious document, web page, seller description, tool result, or memory entry cannot instruct an Agent to bypass its allowed Tool Set or authorization boundary.

Tool results are data. They do not become new system instructions merely because they are returned by a trusted adapter.

## 19. Cancellation, Timeout, and Ambiguity

Cancellation does not guarantee that an external side effect has not already occurred.

For internal transactional domain commands, cancellation follows the owning capability's transaction semantics.

For external side effects, timeout may create an ambiguous outcome:

```text
request sent
 -> response unknown
 -> state = ambiguous
 -> reconciliation / status query
```

Blind retry is forbidden when duplication could cause material harm.

## 20. Audit and Observability

Every material Tool/Agent action should be traceable using non-sensitive evidence including, as applicable:

- request/correlation/trace ID;
- tenant/workspace/actor;
- run/step/invocation IDs;
- tool/version;
- capability;
- authorization decision;
- policy decision;
- confirmation evidence;
- resource scope;
- Runtime operation/attempt references;
- outcome/error code;
- timestamps.

Sensitive prompts, outputs, documents, and personal data must not be logged merely for observability; retention and redaction follow canonical privacy policy.

## 21. Lifecycle and Governance

Tool and Agent definitions are versioned artifacts.

A Tool lifecycle should support at least:

```text
proposed -> evaluated -> approved -> active -> restricted -> deprecated -> retired
```

An Agent definition/policy should similarly distinguish draft, active, restricted, deprecated, and retired states as appropriate.

A retired Tool cannot be selected for new work. Existing in-flight work follows explicit compatibility and migration policy; it must not silently change behavior.

## 22. Failure and Recovery Rules

The system must distinguish:

- validation failure;
- authorization denial;
- policy denial;
- confirmation missing/expired;
- entitlement denial;
- domain precondition failure;
- domain transaction failure;
- provider/runtime failure;
- external ambiguous outcome;
- cancellation;
- budget exhaustion.

Recovery must use the owner of the failed concern. Tool/Agent orchestration may coordinate recovery but may not reimplement the underlying authority.

Examples:

```text
authorization failure -> Access
billing failure -> Billing
AI execution failure -> AI Runtime
Catalog mutation failure -> Catalog
external delivery ambiguity -> owning external-capability reconciliation
```

## 23. Anti-Duplication Matrix

| Concern | Canonical authority | Forbidden duplicate in Tool/Agent |
|---|---|---|
| Authentication | Identity/Auth | model-derived identity |
| Permission | Access | local RBAC/ABAC evaluator |
| Tenant isolation | Platform/Access | agent-selected tenant |
| Safety policy | Policy/Security + AI policy | feature-local safety engine |
| AI execution | AI Runtime | agent-local provider/runtime |
| Provider/model routing | AI Runtime governance | tool-specific model router |
| Entitlement/quota/price | Billing | tool-local billing rules |
| Domain mutation | Owning capability | direct repository/table writes |
| Idempotency | owning command/runtime contract | second generic mutation store |
| Audit | Platform/Audit | hidden agent-only audit log |
| Confirmation policy | canonical policy | ad-hoc UI-only confirmation |
| Tool registry | AI | feature-local tool registry |
| Agent orchestration | AI | duplicated workflow engine per feature |

## 24. Capability Mapping

The existing canonical AI capabilities remain:

```text
CAP.AI.CREATE_AGENT
CAP.AI.RUN_AGENT
CAP.AI.EXECUTE_TOOL
CAP.AI.MANAGE_MEMORY
```

`CAP.AI.RUN_AGENT` orchestrates bounded Agent execution.

`CAP.AI.EXECUTE_TOOL` validates and delegates Tool invocation; it does not own the business behavior of the Tool.

`CAP.AI.MANAGE_MEMORY` owns AI memory behavior, subject to consent/retention policy; memory is not domain authority.

No new generic `CAP.AI.EXECUTE_OPERATION` or parallel Tool Runtime is introduced.

## 25. Relationship to Canonical AI Runtime

```text
Agent / Tool Capability
        |
        +--> Canonical AI Runtime (for model-backed work)
        |
        +--> Access / Authorization
        |
        +--> AI Safety / Policy
        |
        +--> Billing (when applicable)
        |
        +--> Owning Domain Capability
```

The Runtime remains the sole model execution boundary. Tool execution remains the sole controlled delegation path from AI into domain capabilities.

## 26. Production Readiness Gate

Before enabling a Tool in production, verify:

- stable Tool ID/version;
- owning capability identified;
- input/output schemas registered;
- required permissions defined;
- tenant/resource scope enforced;
- side-effect/risk class defined;
- policy and confirmation rules defined;
- idempotency semantics defined for mutation;
- Billing behavior defined where applicable;
- domain capability delegation verified;
- no direct repository/table access;
- audit evidence defined;
- cancellation/timeout/ambiguity behavior defined;
- lifecycle state approved;
- prompt-injection/tool-abuse tests pass;
- cross-tenant and authorization tests pass.

Before enabling an Agent, additionally verify:

- bounded Tool Set;
- maximum steps and wall-clock budget;
- AI token/cost budget where applicable;
- cancellation behavior;
- policy-stop behavior;
- ambiguous-tool handling;
- traceability of every model operation and Tool invocation;
- no domain truth stored in Agent state.

## 27. Non-Negotiable Invariants

1. Model choice never equals authorization.
2. Tool selection never equals authorization.
3. Agent memory never equals domain truth.
4. AI confidence never equals permission or verification.
5. Tool manifests never become a second capability registry for business behavior.
6. Tools never write domain storage directly.
7. Agents never create a second AI Runtime.
8. Provider SDKs remain behind the canonical Runtime adapters.
9. Billing remains the sole authority for customer economics.
10. Access remains the sole authority for authorization.
11. Policy remains the sole authority for safety/confirmation requirements.
12. Domain modules remain the sole authority for their facts and mutations.
13. Retries never silently duplicate material side effects.
14. Untrusted content cannot elevate its instruction priority.
15. Every material Tool/Agent action is traceable without unnecessary sensitive-content retention.

## 28. Reconciliation with Existing Contracts

This document intentionally reuses the existing contracts rather than redefining them:

- `CAPABILITY_CONTRACT_MATRIX.md` for capability ownership and anti-duplication;
- `AI_RUNTIME_ARCHITECTURE.md` for the single model execution boundary;
- `AI_RUNTIME_DATA_DICTIONARY.md` for canonical runtime execution records;
- `AI_DATA_DICTIONARY.md` for Tool Invocation and Agent Run/Step vocabulary;
- `AI_SAFETY_POLICY_GOVERNANCE.md` for policy, risk, confirmation, and fail-closed rules;
- `AI_OPERATION_ECONOMICS_ARCHITECTURE.md` for usage and Billing boundaries;
- `AI_PROVIDER_MODEL_GOVERNANCE.md` for provider/model eligibility and fallback governance.

No document listed above should be replaced by a duplicate Tool/Agent architecture.
