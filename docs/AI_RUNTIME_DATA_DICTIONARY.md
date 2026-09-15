# Phoenix Canonical AI Runtime Data Dictionary

> Status: Canonical architecture contract
> Scope: Data vocabulary and relationships for the shared AI execution runtime.
>
> This document defines the meaning, ownership, lifecycle, and relationships of AI Runtime records. It does not prescribe SQL, ORM classes, provider SDK objects, or implementation-specific storage.

## 1. Purpose

Phoenix has one AI execution runtime. The runtime needs a stable data vocabulary so Customer AI, Seller AI, Agents, Automation, and future AI capabilities do not create parallel models for model execution, prompts, schemas, policies, provider attempts, or usage.

The canonical relationship is:

```text
AI Operation
   |
   +--> Prompt Version
   +--> Output Schema Version
   +--> Safety/Policy Context
   +--> Model Selection
   |       |
   |       +--> Model Profile
   |       +--> Provider Profile
   |
   +--> Provider Attempts (1..N)
   |
   +--> Usage Records (0..N)
   |
   +--> Runtime Result / Error
```

## 2. Ownership Rules

| Data concept | Owner | Authority |
|---|---|---|
| AI operation identity and execution lifecycle | AI Runtime | canonical |
| Operation taxonomy/version | AI | canonical |
| Model profile | AI | canonical |
| Model routing policy | AI | canonical |
| Provider adapter/profile | AI Runtime | canonical |
| Prompt definition/version | AI | canonical |
| Output schema definition/version | AI / capability contract | canonical |
| AI safety policy reference/execution evidence | AI + policy contracts | canonical by concern |
| Provider execution attempt | AI Runtime | canonical |
| AI usage telemetry | AI Runtime / AI Usage contract | canonical |
| Customer entitlement, quota, credit and price | Billing | canonical |
| Customer charge/refund/reversal | Billing | canonical |
| Domain facts produced from AI | owning domain module | canonical |
| Audit evidence | Platform/Audit | canonical |

The runtime may reference external authorities, but must not duplicate their authoritative state.

## 3. `ai_operation`

The logical unit of AI work.

### Required fields

- `operation_id`: globally unique logical operation identifier.
- `operation_type`: semantic operation type, independent of provider.
- `operation_version`: contract version of the operation.
- `session_id`: optional parent interaction/workflow/session.
- `tenant_id`: mandatory tenant scope.
- `workspace_id`: applicable workspace scope.
- `actor_id`: initiating actor where applicable.
- `request_id`: originating request identity.
- `correlation_id`: cross-service trace correlation.
- `idempotency_key`: stable deduplication key for the logical operation.
- `status`: lifecycle state.
- `input_ref` / `input_hash`: reference and integrity identity for input.
- `output_ref`: reference to persisted output when output is not returned inline.
- `prompt_ref`: resolved prompt version.
- `schema_ref`: resolved output schema version.
- `policy_ref`: resolved policy/safety context.
- `model_selection_ref`: routing decision/reference.
- timestamps and expiry where applicable.

### Lifecycle

```text
created
  -> entitlement_checked
  -> started
  -> succeeded
  |-> partially_succeeded
  |-> failed
  |-> cancelled
  |-> expired
  |-> blocked
```

`operation_id` remains stable across retries.

## 4. `ai_operation_type`

Semantic taxonomy describing what the operation does.

Examples:

- `ai.classify`
- `ai.extract`
- `ai.generate`
- `ai.evaluate`
- `ai.embed`
- `ai.retrieve`
- `ai.safety_check`
- `seller.product.extract`
- `seller.product.classify`
- `seller.product.enrich`
- `seller.product.localize`
- `seller.product.validate_ai`
- `seller.media.analyze`
- `seller.media.enhance`
- `seller.media.generate`

Operation type must not encode provider names or customer pricing rules.

## 5. `ai_model`

A canonical profile for an AI model that Phoenix is allowed to use.

### Conceptual fields

- `model_id`
- `provider_id`
- `model_name`
- `model_version`
- supported operation classes
- supported modalities
- context/input/output limits
- structured-output support
- tool/function support
- language/locale coverage
- permitted data classifications
- permitted regions/data residency
- availability/status
- routing priority
- fallback group
- internal cost metadata reference
- effective-from/effective-to

A model profile describes capability and governance. It does not become a customer-facing pricing authority.

## 6. `ai_provider`

Canonical identity/configuration metadata for an external AI provider.

### Conceptual fields

- `provider_id`
- provider name/type
- adapter version
- supported capabilities
- supported regions
- health/status
- policy eligibility
- effective version/date

Credentials and secrets are references to the platform secret-management boundary, not fields exposed to callers or model requests.

## 7. `ai_model_routing_decision`

The runtime decision explaining why a particular approved model/provider was selected.

### Conceptual fields

- decision ID
- operation ID
- routing policy/version
- candidate models considered
- selected model/provider
- fallback group
- decision factors
- policy constraints applied
- timestamp

Routing evidence is operational metadata, not domain truth.

## 8. `ai_prompt`

Stable identity of a production prompt/instruction contract.

### Conceptual fields

- `prompt_id`
- operation type/version
- owner
- purpose
- locale
- variable/input contract reference
- safety policy reference
- output schema reference
- lifecycle/release status

The prompt identity is stable; production content changes create a new version.

## 9. `ai_prompt_version`

Immutable released version of a prompt.

### Conceptual fields

- `prompt_id`
- semantic version
- instruction/template references
- content checksum
- compatible operation versions
- compatible schema version
- evaluation status
- release timestamp
- effective timestamp
- rollback target

User content, retrieved documents, seller content, and tool results are data inputs and must not silently become higher-priority instructions.

## 10. `ai_schema`

Stable identity of a machine-consumed output contract.

### Conceptual fields

- `schema_id`
- purpose/operation class
- owner
- compatibility policy
- validation mode

## 11. `ai_schema_version`

Immutable version of an output schema.

### Conceptual fields

- schema ID
- semantic version
- structural definition/reference
- required fields
- enum/range rules
- nullability/optional semantics
- provenance requirements
- abstention/unknown representation
- compatibility status
- release/effective timestamps

A schema-valid AI response is still untrusted business input.

## 12. `ai_policy`

Reference to the policy set governing an AI operation.

Policy may include:

- data classification eligibility;
- permitted provider/model classes;
- safety requirements;
- regulated workflow restrictions;
- tool/side-effect restrictions;
- human-review requirements;
- retention/logging rules;
- output validation requirements.

Policy ownership remains with the relevant policy/security/access authority. AI Runtime stores references and execution evidence rather than creating a competing authorization system.

## 13. `ai_policy_decision`

An immutable decision/evidence record for a policy check.

### Conceptual fields

- decision ID
- operation ID
- policy ID/version
- decision type
- allow/deny/block result
- reason/code
- relevant classification/risk context
- evaluator version
- timestamp

A policy decision is not permission unless the canonical authorization contract says so.

## 14. `ai_provider_attempt`

One concrete provider execution attempt belonging to a logical AI operation.

### Required conceptual fields

- `attempt_id`
- `operation_id`
- `attempt_number`
- provider ID
- model ID/version
- provider request ID when available
- request/response references
- status
- error classification/code
- started/completed timestamps
- latency
- input/output usage units
- timeout/retry/fallback metadata
- internal cost estimate

Relationship:

```text
one ai_operation -> one or more ai_provider_attempt
```

A provider timeout may leave execution ambiguous. The attempt must retain that ambiguity rather than assuming non-execution.

## 15. `ai_runtime_result`

Canonical normalized result returned by the runtime.

### Conceptual fields

- operation ID
- status
- validated output/reference
- schema version
- provider/model used
- safety outcome
- provenance metadata
- warnings
- abstention information
- attempt summary
- typed error classification
- created timestamp

Provider-specific response structures do not belong in this contract.

## 16. `ai_usage_record`

Technical/economic telemetry describing AI resource consumption.

### Conceptual fields

- usage record ID
- operation ID
- attempt ID where applicable
- tenant/workspace/actor
- operation type/version
- meter unit
- quantity
- provider/model
- usage status
- idempotency key
- entitlement decision reference
- Billing usage/charge reference where applicable
- created timestamp

Possible meter units:

- operation count
- input tokens
- output tokens
- image units
- audio duration
- pages
- embedding units
- compute units
- provider-specific normalized units

Usage is not automatically a financial charge.

## 17. Relationship to Billing

The runtime does not own customer economics.

```text
AI Operation
    |
    v
Billing entitlement decision
    |
    v
Provider attempt(s)
    |
    v
AI usage record(s)
    |
    v
Billing customer usage / charge outcome
```

Billing remains authoritative for:

- plans;
- entitlements;
- quotas;
- credits;
- customer pricing;
- charges;
- refunds;
- reversals.

Provider/internal cost remains an AI operational signal.

## 18. Version Relationship

The following versions are independently versioned but linked at execution time:

```text
operation_version
     |
     +--> prompt_version
     +--> schema_version
     +--> policy_version
     +--> model_version
     +--> provider_adapter_version
```

A historical operation must retain the exact resolved versions/references required to reproduce or explain the execution contract, subject to privacy/retention rules.

Changing one artifact does not silently mutate the meaning of historical executions.

## 19. Input and Output Provenance

Runtime records may reference provenance but domain modules remain authoritative for business facts.

Minimum provenance classes remain:

- `seller_input`
- `seller_confirmed`
- `ai_extracted`
- `ai_generated`
- `system_derived`
- `external_verified`
- `policy_validated`

Confidence states may include:

- `confirmed`
- `high_confidence`
- `needs_review`
- `unknown`
- `conflicting`
- `rejected`

Confidence never grants authority.

## 20. Idempotency and Retry Identity

Canonical identity model:

```text
idempotency_key
      |
      v
operation_id
      |
 +----+----+
 |         |
attempt 1 attempt 2 ...
```

Rules:

1. Same logical retry retains `operation_id`.
2. Each provider execution gets a distinct `attempt_id`.
3. Usage recording is idempotent.
4. Customer charging is controlled by Billing and cannot double-charge because of runtime retry.
5. Ambiguous provider execution is explicitly represented and reconciled.

## 21. Partial Success

Bundled workflows must preserve sub-operation results.

Example:

```text
seller.product workflow
  classify  -> succeeded
  extract   -> succeeded
  enrich    -> failed
  localize  -> pending
```

Recovery resumes from the failed/pending boundary. Successful results are not discarded or unnecessarily re-billed.

## 22. Tenant and Privacy Boundary

Every operation, attempt, usage record, and persisted runtime artifact must carry or derive an explicit tenant boundary where applicable.

Runtime data classification controls:

- provider eligibility;
- model eligibility;
- retention;
- logging/redaction;
- retrieval scope;
- human review.

Cross-tenant aggregation may exist only as authorized operational analytics and must not expose tenant-private content.

## 23. Audit and Observability

Audit evidence should correlate:

- request ID;
- correlation ID;
- operation ID;
- attempt ID;
- tenant/workspace;
- actor;
- operation/prompt/schema/policy/model versions;
- provider request ID;
- policy decisions;
- usage;
- outcome/error class.

Sensitive prompts, outputs, documents, and personal data must not be logged merely to improve traceability.

## 24. Canonical Anti-Duplication Matrix

| Requirement | Use this | Do not create |
|---|---|---|
| model execution | `ai_operation` + Runtime | feature-specific AI runner |
| provider call | `ai_provider_attempt` | provider SDK call inside module |
| model metadata | `ai_model` | per-feature model table |
| prompt | `ai_prompt` + version | prompt columns scattered across features |
| output contract | `ai_schema` + version | feature-specific response schema registry |
| safety/policy reference | `ai_policy` / canonical policy contract | feature-local safety authority |
| usage | `ai_usage_record` | seller/customer-specific AI usage table |
| retry | operation + attempt identity | independent retry identity per feature |
| customer charge | Billing | AI runtime charge calculator |
| domain result | owning domain entity | AI shadow copy of domain state |

## 25. Mapping to Existing Phoenix Contracts

This dictionary extends and reconciles the existing AI contracts; it does not replace them.

- `docs/AI_ARCHITECTURE.md` remains the broad AI architecture baseline.
- `docs/AI_OPERATION_ECONOMICS_ARCHITECTURE.md` remains the canonical economics boundary.
- `docs/SELLER_AI_PRODUCT_CREATION_DATA_DICTIONARY.md` remains the Seller AI workflow vocabulary.
- `docs/CAPABILITY_CONTRACT_MATRIX.md` remains the capability ownership contract.
- `docs/AI_RUNTIME_ARCHITECTURE.md` defines runtime behavior and execution boundaries.
- This document defines the canonical runtime data vocabulary and relationships.

Where terminology overlaps, the more specific canonical contract wins without creating a second owner.

## 26. Definition of Done

The runtime data model is architecturally complete when:

- one logical AI operation has one canonical identity;
- provider attempts are children of that operation;
- models and providers are centrally registered;
- prompts and schemas are immutable/versioned production artifacts;
- policy decisions are versioned and attributable;
- usage is tied to operation/attempt identity;
- Billing remains the only customer-economic authority;
- retries and ambiguous execution are representable;
- partial success is recoverable;
- historical executions retain their effective contract versions;
- tenant/privacy boundaries are explicit;
- no AI feature needs a parallel runtime data model.
