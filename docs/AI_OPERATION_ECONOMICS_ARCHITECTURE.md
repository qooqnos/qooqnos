# Phoenix AI Operation Economics Architecture

**Status:** Canonical architecture contract
**Scope:** AI operation identity, usage metering, entitlement, quota, internal cost telemetry, customer charge outcomes, retries, failures, refunds, and economic observability.

> This document defines the economic boundary for every material AI operation in Phoenix. It does not make AI the financial authority. Billing remains the authority for plans, entitlements, quotas, pricing, charges, credits, refunds, and financial state.

## 1. Core Principle

Every material AI operation is both:

1. a computational operation performed by AI; and
2. a measurable economic event that may consume entitlement, quota, credits, or paid usage.

The canonical boundary is:

`AI Operation → Usage Event → Billing Entitlement Decision → AI Execution → Usage Measurement → Cost Telemetry → Customer Usage/Charge Outcome`

Provider/model cost and customer price are intentionally separate concepts.

## 2. Ownership

| Concern | Canonical owner |
|---|---|
| AI execution and interpretation | AI |
| Operation taxonomy | AI |
| Operation identity and execution state | AI |
| Provider/model telemetry | AI |
| Internal provider cost estimate | AI / internal cost telemetry |
| Plans | Billing |
| Prices | Billing |
| Entitlements | Billing |
| Quotas / credits | Billing |
| Customer usage accounting | Billing |
| Customer pricing / charge | Billing |
| Refund / credit decision | Billing |
| Authorization | Access/Authorization |
| Audit evidence | Platform/Audit |
| Domain mutation | Owning domain capability |

No AI provider SDK, model gateway, Seller AI flow, Agent, Plugin, or domain module may become a second Billing authority.

## 3. Economic Operation Identity

Every material AI operation must have a stable identity and execution context.

Minimum conceptual fields:

```text
operation_id
operation_type
operation_version
session_id (when applicable)
tenant_id
workspace_id
actor_id
request_id
correlation_id
idempotency_key
input_reference / input_hash
provider_reference
model_reference
attempt_number
status
started_at
completed_at
```

`operation_id` identifies the logical operation. `attempt_number` identifies an execution attempt. A retry must not accidentally become a new billable logical operation.

## 4. Operation Taxonomy

Operation types are versioned semantic contracts, not provider API names.

Examples:

```text
ai.classify
ai.extract
ai.generate
ai.evaluate
ai.embed
ai.retrieve
ai.safety_check
seller.product.extract
seller.product.classify
seller.product.enrich
seller.product.localize
seller.media.analyze
seller.media.enhance
seller.media.generate
```

A new product workflow should reuse an existing operation type when semantics are the same rather than inventing a workflow-specific duplicate.

## 5. Pre-Execution Entitlement Gate

Before a chargeable or quota-consuming operation begins, the owning workflow must obtain a Billing decision when policy requires it.

Canonical sequence:

```text
Request
  ↓
Authenticate / Authorize
  ↓
Resolve Tenant + Workspace
  ↓
Create Operation Identity
  ↓
Billing Entitlement / Quota Decision
  ↓
Allowed? ── No → blocked_by_entitlement
  ↓ Yes
AI Execution
```

The entitlement decision must be bound to the operation identity and policy/version context.

## 6. Entitlement Decision

A Billing decision may result in:

- included usage;
- quota consumption;
- credit consumption;
- per-operation charge eligibility;
- tiered usage;
- hybrid pricing;
- denial;
- temporary unavailable state requiring retry later.

Conceptual decision fields:

```text
entitlement_decision_id
operation_id
tenant_id
workspace_id
entitlement_key
policy_version
decision
meter_key
reserved_quantity (when applicable)
pricing_reference (when applicable)
reason
created_at
```

AI must not reinterpret or override this decision.

## 7. Usage Metering

Usage is recorded independently from internal model cost.

Potential meter dimensions include:

- operation count;
- input tokens;
- output tokens;
- total tokens;
- image units;
- audio duration;
- document pages;
- embedding units;
- compute/runtime units;
- custom product-defined units.

A usage event should include:

```text
usage_event_id
operation_id
operation_type
meter_key
quantity
unit
status
idempotency_key
entitlement_decision_id
charge_reference (when applicable)
occurred_at
```

The meter unit is a product/commercial abstraction. It does not have to equal the provider's native billing unit.

## 8. Internal Provider Cost

AI should capture provider/model cost telemetry where available or estimable.

Examples:

```text
provider
model
input_units
output_units
estimated_provider_cost
cost_currency
cost_estimation_version
latency
```

This information is operational economics data, not automatically customer pricing.

Provider cost can change without changing the customer plan price. Customer pricing changes only through Billing/product policy.

## 9. Customer Charge Outcome

A successful AI execution does not automatically imply a customer charge.

Possible outcomes:

```text
not_billable
included
quota_consumed
credit_consumed
chargeable
charged
partially_charged
waived
refunded
reversed
```

The outcome is authoritative only when determined by Billing.

## 10. Lifecycle

The logical operation lifecycle is:

`created → entitlement_checked → authorized → running → succeeded`

Exceptional states include:

`blocked_by_entitlement`
`blocked_by_authorization`
`failed`
`partially_succeeded`
`cancelled`
`timed_out`
`retried`
`refunded`
`reversed`

AI execution status and Billing financial status must remain separately modeled even when correlated by `operation_id`.

## 11. Failure Semantics

Failure must not create ambiguous financial state.

Rules:

- An operation that is denied before execution consumes no AI provider resources.
- If execution starts and fails, Billing policy determines whether usage is consumed.
- A partial result must be represented explicitly; successful work should be reusable.
- A retry must use idempotency and attempt identity.
- Retrying must not silently double-consume a scarce quota.
- Provider timeout does not by itself prove that execution did not happen.
- Unknown financial outcomes require reconciliation rather than blind recharging or blind refunding.

## 12. Reservation and Quota Safety

For scarce quotas, simple read-then-write accounting is insufficient.

Preferred conceptual flow:

`Entitlement Check → Reserve → Execute → Commit Usage / Release Reservation`

If Billing uses a direct atomic consume operation instead, it must provide equivalent concurrency safety.

The implementation choice belongs to Billing; AI only consumes the canonical contract.

## 13. Retry Semantics

Retry identity is split into:

- logical `operation_id`;
- execution `attempt_number`;
- stable `idempotency_key`.

A retry may produce new provider cost, but whether it produces additional customer usage/charge is a Billing policy decision.

Examples:

- infrastructure retry with no customer charge;
- retry consumes another quota unit;
- retry is allowed only after failed attempt;
- retry requires explicit seller/customer approval for paid operations.

## 14. Partial Success

AI workflows may contain multiple sub-operations.

Example:

```text
seller.product.extract       ✓
seller.product.classify      ✓
seller.product.enrich        ✓
seller.media.enhance         ✗
```

The workflow must preserve successful outputs and identify the failed operation independently.

The seller should not be forced to repeat successful work merely because one downstream operation failed.

Billing records each economically relevant operation according to its own meter and policy rather than charging an opaque workflow total unless the commercial contract explicitly defines a bundled meter.

## 15. Bundled Product Operations

A user-facing feature may be sold as a bundle even though it executes multiple AI operations.

Example:

`Seller Product Preparation` may internally call extraction, classification, enrichment, localization, and media operations.

Billing may define one bundled commercial unit while AI continues to record the underlying operation telemetry.

Therefore:

`Technical operation granularity ≠ Customer pricing granularity`

Both layers must remain observable.

## 16. Refunds, Reversals, and Credits

Refunds or quota reversals are Billing operations.

AI may report evidence such as:

- provider failure;
- duplicate execution;
- invalid model response;
- safety block;
- infrastructure failure;
- partial completion.

AI cannot itself issue a financial refund or credit.

Billing determines whether the event causes:

- no charge;
- usage reversal;
- credit restoration;
- monetary refund;
- no adjustment.

## 17. Safety and Policy Blocks

A safety or policy decision may prevent execution or publication.

The system must distinguish:

`blocked_before_execution`

from:

`executed_then_blocked_from_publication`

These cases can have different resource consumption and billing consequences.

A policy block must never be silently converted into a successful paid outcome without Billing policy.

## 18. Domain Mutation Boundary

AI economic tracking never authorizes direct domain mutation.

For example:

```text
AI operation
   ↓
Billing decision
   ↓
AI result
   ↓
Schema + provenance + policy validation
   ↓
Authorized domain capability
   ↓
Canonical state change
```

Seller AI may therefore prepare a Catalog draft, but Catalog remains authoritative for Product, Offer, Price, Inventory, and publication state.

## 19. Events

Recommended canonical event vocabulary:

```text
ai.operation.created.v1
ai.operation.started.v1
ai.operation.succeeded.v1
ai.operation.failed.v1
ai.operation.partially_succeeded.v1
ai.operation.retried.v1
ai.operation.cancelled.v1
ai.usage.recorded.v1
billing.ai.entitlement.checked.v1
billing.ai.usage.recorded.v1
billing.ai.charge.assessed.v1
billing.ai.usage.reversed.v1
billing.ai.refund.issued.v1
```

Exact event ownership follows the owning module. AI owns AI execution events; Billing owns financial events.

## 20. Security and Tenant Isolation

Every operation and usage record must carry sufficient tenant/workspace context for authorization and isolation.

Rules:

- never trust tenant identity supplied only by model output;
- never infer billing ownership from prompt content;
- validate actor/workspace authorization before execution;
- prevent cross-tenant usage attribution;
- do not log secrets or sensitive prompt content unnecessarily;
- audit high-risk overrides, credits, refunds, and manual adjustments.

## 21. Observability

Minimum operational metrics:

- operation success/failure rate;
- latency;
- provider/model distribution;
- usage quantity by meter;
- internal cost by provider/model/feature/tenant;
- customer usage by plan;
- quota denial rate;
- retry rate;
- duplicate/idempotency conflict rate;
- partial-success recovery rate;
- cost per successful business outcome;
- revenue or charge per successful outcome where applicable;
- unexplained financial-state cases.

## 22. Economic Invariants

The following invariants are mandatory:

1. No charge without an authoritative Billing rule.
2. No entitlement without Billing authority.
3. No authorization from Billing entitlement alone.
4. No customer price derived solely from provider cost.
5. No duplicate charge caused by retry.
6. No double quota consumption caused by concurrent execution.
7. No cross-tenant usage attribution.
8. No financial mutation directly from AI output.
9. No lost successful work because of unrelated partial failure.
10. No hidden provider dependency in customer pricing contracts.

## 23. Capability Mapping

This architecture reuses the existing canonical capabilities:

| Need | Canonical capability |
|---|---|
| AI extraction | `CAP.AI.EXTRACT` |
| AI classification | `CAP.AI.CLASSIFY` |
| AI generation | `CAP.AI.GENERATE` |
| Safety policy | `CAP.AI.APPLY_SAFETY_POLICY` |
| Entitlement | `CAP.BILLING.CHECK_ENTITLEMENT` |
| Usage recording | `CAP.BILLING.RECORD_USAGE` |
| Authorization | `CAP.ACCESS.CHECK_PERMISSION` / `CAP.ACCESS.CHECK_POLICY` |
| Idempotency | `CAP.PLATFORM.IDEMPOTENCY` |
| Audit | `CAP.PLATFORM.AUDIT` |
| Event publication | `CAP.PLATFORM.PUBLISH_EVENT` |

No separate `Seller AI Billing`, `Agent Billing`, `Plugin Billing`, or provider-specific customer billing capability should be introduced.

## 24. Implementation Boundary

The architecture does not prescribe whether usage is synchronously recorded, asynchronously projected, or reservation-based internally.

It does require that the externally visible contract preserves:

- deterministic identity;
- tenant isolation;
- idempotency;
- authoritative Billing decisions;
- auditable usage;
- recoverable failure semantics;
- separate provider cost and customer price;
- versioned policies;
- reconciliation for ambiguous outcomes.

## 25. Definition of Done

AI Operation Economics is architecturally complete when:

- every material AI operation has a canonical identity;
- operation taxonomy is reusable across workflows;
- Billing is the sole commercial authority;
- entitlement and quota decisions are explicit;
- usage is idempotent;
- retries and partial failures are economically defined;
- provider cost is separated from customer price;
- refunds/reversals remain Billing operations;
- tenant isolation is preserved;
- AI, Billing, Access, Platform, and domain ownership boundaries are explicit;
- the same economic contract can serve Customer AI, Seller AI, Agents, Automation, and future AI features without duplication.
