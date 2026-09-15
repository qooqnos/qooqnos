# Phoenix AI Capability ↔ Canonical Runtime Reconciliation

> Status: Canonical architecture reconciliation
> Scope: Maps existing AI capabilities to the single canonical AI Runtime without creating parallel AI execution capabilities.

## 1. Purpose

Phoenix already defines AI capabilities for classification, extraction, generation, evaluation, safety, agents, tools, memory, and Seller AI workflows.

The canonical rule is:

```text
AI Capability Contract
        |
        v
Canonical AI Runtime
        |
        v
Provider Adapter
```

The capability expresses **what Phoenix wants AI to accomplish**. The Runtime expresses **how a governed model-backed operation is executed**.

No capability in this document creates a second execution engine.

## 2. Reconciliation Decision

There is intentionally **no new public `CAP.AI.EXECUTE_OPERATION` capability** added to the capability matrix.

Reason:

- Runtime execution is an internal AI execution boundary, not a new business capability exposed to consumers.
- Adding a generic public execution capability would invite callers to bypass semantic AI contracts, safety requirements, schemas, and domain-specific authorization.
- Existing AI capabilities remain the correct public contracts.
- They internally invoke the canonical Runtime.

Therefore:

```text
Public/Reusable AI capability
        ↓
Runtime execution contract
        ↓
Provider adapter
```

## 3. Canonical Mapping

| Existing capability | Capability role | Runtime usage | Direct domain mutation |
|---|---|---|---|
| `CAP.AI.CLASSIFY` | semantic classification decision | execute governed classification operation | no |
| `CAP.AI.EXTRACT` | structured extraction decision | execute governed extraction operation | no |
| `CAP.AI.GENERATE` | content generation decision | execute governed generation operation | no |
| `CAP.AI.EVALUATE` | evaluation decision | execute governed evaluation operation | no |
| `CAP.AI.APPLY_SAFETY_POLICY` | safety decision | execute policy/safety operation where model-backed | no |
| `CAP.AI.RUN_AGENT` | AI orchestration | invokes Runtime repeatedly through governed operations | only through domain capabilities |
| `CAP.AI.EXECUTE_TOOL` | tool orchestration/delegation | tool invocation may use Runtime when model-backed | delegated to owning capability |
| `CAP.AI.MANAGE_MEMORY` | AI memory lifecycle | uses Runtime when interpretation/generation is required | AI memory only |
| `CAP.AI.SELLER.GENERATE_PRODUCT_DRAFT` | Seller AI orchestration | invokes extract/classify/generate/validate Runtime operations | Catalog only through Catalog capability |

## 4. Runtime Responsibilities

Every mapping above uses the same Runtime responsibilities:

1. operation identity;
2. operation version resolution;
3. idempotency;
4. entitlement gate handoff to Billing;
5. model/provider routing;
6. prompt version resolution;
7. output schema resolution and validation;
8. data classification;
9. pre/post safety controls;
10. provider execution;
11. retry/fallback policy;
12. usage telemetry;
13. internal provider cost telemetry;
14. normalized result/error;
15. canonical AI events;
16. observability and correlation.

A capability must not reimplement any of these concerns.

## 5. What Capabilities Own Instead

AI capabilities own semantic intent and orchestration-specific behavior.

### `CAP.AI.CLASSIFY`

Owns:

- classification contract;
- classification input meaning;
- classification output meaning;
- domain-specific interpretation;
- required provenance.

Does not own:

- provider invocation;
- model selection implementation;
- retry engine;
- usage meter;
- prompt registry.

### `CAP.AI.EXTRACT`

Owns:

- extraction target contract;
- extraction semantics;
- field/provenance expectations;
- domain interpretation of extracted data.

Runtime owns execution.

### `CAP.AI.GENERATE`

Owns:

- generation purpose;
- allowed output contract;
- business context;
- domain-specific acceptance rules.

Runtime owns prompt/model/provider execution and normalized output.

### `CAP.AI.EVALUATE`

Owns:

- evaluation objective;
- evaluation criteria contract;
- interpretation of evaluation results.

Runtime owns model execution when evaluation is model-backed.

### `CAP.AI.APPLY_SAFETY_POLICY`

Owns the AI-facing safety decision contract and policy integration.

It must not become a parallel provider gateway or generic middleware framework.

### `CAP.AI.RUN_AGENT`

Owns:

- agent lifecycle;
- finite loop/orchestration;
- tool selection policy;
- conversation/task state;
- confirmation and side-effect orchestration.

Runtime owns each model-backed reasoning/generation operation inside the loop.

### `CAP.AI.EXECUTE_TOOL`

Owns:

- safe delegation from AI to a declared capability/tool;
- tool permission/risk/confirmation contract;
- idempotent invocation boundary.

It does not copy the implementation of the target capability.

### Seller AI

Seller AI owns the workflow state:

```text
raw input
 → analysis
 → draft
 → missing information
 → seller review
 → confirmation
```

Runtime owns each model-backed sub-operation.

Catalog remains the authority for product/service/offer facts and persistence.

## 6. Operation Type Resolution

Each capability should resolve to a semantic operation type rather than a provider-specific request.

Examples:

```text
CAP.AI.CLASSIFY
    → ai.classify

CAP.AI.EXTRACT
    → ai.extract

CAP.AI.GENERATE
    → ai.generate

CAP.AI.EVALUATE
    → ai.evaluate

CAP.AI.SELLER.GENERATE_PRODUCT_DRAFT
    → orchestration
       ├─ seller.product.extract
       ├─ seller.product.classify
       ├─ seller.product.enrich
       ├─ seller.product.localize
       └─ seller.product.validate_ai
```

An orchestration capability may create multiple logical AI operations. Each operation receives its own canonical operation identity and usage semantics.

## 7. Agent Runtime Rule

Agent loops must never become an alternative runtime.

Canonical flow:

```text
Agent
  → decide next action
  → Runtime operation
  → normalized result
  → tool/capability selection
  → canonical capability
  → result
  → Runtime operation
  → ...
```

The Agent owns orchestration state; Runtime owns model execution state.

## 8. Tool Boundary

AI tools are capability adapters.

```text
Model output
    ↓
Tool manifest
    ↓
Authorization / policy / confirmation
    ↓
Canonical capability
    ↓
Domain authority
```

The model cannot directly select a repository, database table, provider SDK, or financial operation.

## 9. Seller AI Runtime Mapping

Seller product creation uses the Runtime as follows:

```text
Raw seller input
      ↓
Seller AI orchestration
      ↓
CAP.AI.EXTRACT ─────────→ Runtime
CAP.AI.CLASSIFY ────────→ Runtime
CAP.AI.GENERATE ────────→ Runtime
CAP.AI.EVALUATE ────────→ Runtime where required
CAP.AI.APPLY_SAFETY_POLICY
      ↓
Draft + provenance + confidence
      ↓
Seller confirmation
      ↓
CAP.CATALOG.CREATE_PRODUCT / UPDATE_PRODUCT
      ↓
Publication / Discovery
```

Media analysis/enhancement similarly delegates model execution to Runtime while Media remains authoritative for assets.

## 10. Customer AI Mapping

Customer-side intelligent discovery uses the same Runtime:

```text
Customer need
      ↓
AI intent understanding
      ↓
CAP.AI.CLASSIFY / EXTRACT / GENERATE as required
      ↓
Runtime
      ↓
Matching / Discovery capabilities
      ↓
Rank / Explain
      ↓
Customer action
```

Matching, Discovery, Booking, Commerce, and Customer modules remain domain authorities.

## 11. Economics Mapping

Every model-backed capability invocation is associated with the existing AI Operation Economics contract.

```text
AI capability
      ↓
AI operation
      ↓
Billing entitlement decision
      ↓
Runtime execution
      ↓
Usage record
      ↓
Billing usage / charge outcome
```

Technical Runtime operations and customer billing units are not required to be one-to-one.

For example, Seller AI may perform five technical operations while Billing treats the workflow as one bundled entitlement unit.

## 12. Error Ownership

The Runtime normalizes execution errors.

The calling capability decides what the error means for its business workflow.

| Error | Runtime meaning | Caller responsibility |
|---|---|---|
| authorization denied | execution cannot proceed | surface/handle according to capability contract |
| entitlement denied | Billing disallows execution | explain/request upgrade or alternate path |
| policy blocked | operation not eligible | follow policy workflow |
| provider timeout | provider execution uncertain/failed | preserve operation and recovery state |
| invalid model output | output contract failed | retry/recover/escalate according to capability policy |
| safety blocked | output/input not permitted | abstain, ask for correction, or escalate |
| partial success | some sub-operation succeeded | preserve successful work |

Runtime must not decide domain-specific recovery by itself.

## 13. Anti-Bypass Rules

The following are architectural defects:

- AI capability importing a provider SDK;
- Agent calling a provider directly;
- Seller AI implementing its own prompt executor;
- Customer AI maintaining a second usage meter;
- feature-local model selection tables;
- feature-local retry/circuit-breaker systems;
- capability-local schema registry;
- AI feature calculating customer price from provider cost;
- AI writing Catalog/Booking/Commerce/Trust/Billing state directly;
- Tool implementation duplicating the target domain capability.

## 14. Capability Contract Changes Required Later in Implementation

When executable contracts are implemented, every model-backed AI capability should expose references to:

- operation type/version;
- input schema;
- output schema;
- prompt contract/version policy;
- safety policy;
- entitlement requirement;
- tenant scope;
- idempotency semantics;
- domain capability dependencies.

These references are contract metadata, not an invitation to expose Runtime internals to every caller.

## 15. Architectural Invariants

1. Existing AI capabilities remain the semantic API.
2. Canonical AI Runtime is the sole provider execution boundary.
3. No generic public execution capability is introduced.
4. Provider-specific details never become capability contracts.
5. Every model-backed execution has canonical operation identity.
6. Every machine-consumed result has a versioned schema.
7. Every execution is subject to the applicable safety/data policy.
8. Billing remains the commercial authority.
9. Domain modules remain domain authorities.
10. Agent and Seller AI orchestration do not duplicate Runtime behavior.

## 16. Definition of Done

This reconciliation is complete when:

- every existing AI capability has an explicit Runtime relationship;
- no AI capability directly accesses a provider;
- no feature creates a parallel execution stack;
- operation types remain semantic and provider-independent;
- Agent and Seller AI use the same Runtime as Customer AI;
- tool calls terminate at canonical capabilities;
- usage/entitlement flows through the existing economics contract;
- domain mutation remains behind domain capability contracts;
- the Capability Contract Matrix and AI Runtime documentation tell the same architectural story.
