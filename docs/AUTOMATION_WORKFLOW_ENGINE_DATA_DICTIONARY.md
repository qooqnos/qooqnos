# Phoenix Automation & Workflow Engine Data Dictionary

**Status:** Canonical data contract  
**Architecture:** `docs/AUTOMATION_WORKFLOW_ENGINE_ARCHITECTURE.md`

## 1. Scope

This dictionary defines the canonical data vocabulary for Phoenix Automation & Workflow Engine.

There is one shared automation data model across all verticals and modules.

## 2. Workflow

**Purpose:** Logical automation definition.

| Field | Meaning |
|---|---|
| `workflow_id` | Opaque workflow identifier |
| `scope` | PLATFORM / ORGANIZATION / WORKSPACE / BUSINESS |
| `name` | Human-readable name |
| `status` | DRAFT / VALIDATING / ACTIVE / PAUSED / RETIRED |
| `active_version_id` | Currently active immutable version |
| `created_by` | Creating actor |
| `created_at` | UTC creation timestamp |
| `updated_at` | UTC modification timestamp |

Invariant: an ACTIVE workflow references exactly one immutable active version.

## 3. WorkflowVersion

**Purpose:** Immutable executable definition.

| Field | Meaning |
|---|---|
| `workflow_version_id` | Opaque version identifier |
| `workflow_id` | Parent workflow |
| `version` | Monotonic version number |
| `definition` | Validated canonical workflow definition |
| `definition_hash` | Integrity/version fingerprint |
| `status` | DRAFT / VALIDATING / ACTIVE / RETIRED |
| `activated_at` | Activation timestamp |
| `created_at` | UTC timestamp |

Invariant: ACTIVE versions cannot be mutated.

## 4. Trigger

**Purpose:** Defines how a workflow starts.

| Field | Meaning |
|---|---|
| `trigger_id` | Opaque identifier |
| `workflow_version_id` | Target version |
| `type` | EVENT / SCHEDULE / COMMAND |
| `event_type` | Canonical event when type=EVENT |
| `schedule_id` | Schedule when type=SCHEDULE |
| `command_capability` | Approved capability when type=COMMAND |
| `enabled` | Whether trigger accepts new executions |

Invariant: trigger type determines exactly one authoritative trigger source.

## 5. Condition

**Purpose:** Deterministic decision predicate.

| Field | Meaning |
|---|---|
| `condition_id` | Opaque identifier |
| `workflow_version_id` | Owning version |
| `expression` | Validated condition representation |
| `evaluation_policy_version` | Policy used for evaluation |

Conditions are side-effect free.

## 6. Action

**Purpose:** Canonical capability invocation.

| Field | Meaning |
|---|---|
| `action_id` | Opaque identifier |
| `workflow_version_id` | Owning version |
| `capability` | Canonical capability name |
| `input_mapping` | Validated references/mapping |
| `timeout_policy` | Execution timeout |
| `retry_policy` | Retry policy |
| `approval_policy` | Required approval policy where applicable |
| `compensation_policy` | Versioned recovery policy: AUTOMATIC / MANUAL / NONE plus compensating capability |

Invariant: every consequential action references an existing approved capability.

## 7. Schedule

| Field | Meaning |
|---|---|
| `schedule_id` | Opaque identifier |
| `timezone` | IANA timezone |
| `recurrence` | ISO-8601 duration recurrence, e.g. `PT15M`, `PT1H`, `P1D` |
| `start_at` | UTC start |
| `end_at` | Optional UTC end |
| `misfire_policy` | SKIP / CATCH_UP_ONCE / CATCH_UP_ALL |
| `enabled` | Schedule state |
| `next_run_at` | Projected next unclaimed run |

The initial production scheduler contract uses fixed-duration UTC recurrence. `timezone` is preserved for user-facing/calendar context; calendar-aware wall-clock recurrence requires an explicit future contract before implementation. `CATCH_UP_ALL` is bounded to a worker-defined replay window.

Persisted timestamps remain UTC; user-facing interpretation uses localization/calendar contracts.

## 8. WorkflowVariable

A scoped reference used during execution.

Variables may contain:
- validated input;
- canonical resource references;
- non-sensitive execution values;
- prior capability results permitted by policy.

Secrets, credentials, access tokens, and unrestricted sensitive payloads are forbidden as workflow variables.

## 9. WorkflowExecution

**Purpose:** Durable runtime instance.

| Field | Meaning |
|---|---|
| `execution_id` | Opaque execution identifier |
| `workflow_id` | Workflow |
| `workflow_version_id` | Exact immutable version |
| `trigger_id` | Trigger |
| `scope` | Tenant/workspace/business scope |
| `status` | PENDING / RUNNING / WAITING / COMPLETED / FAILED / CANCELLED |
| `input_reference` | Input reference |
| `correlation_id` | Cross-module correlation |
| `trace_id` | Observability trace |
| `started_at` | UTC |
| `completed_at` | UTC, when terminal |

Invariant: an execution is permanently associated with one workflow version.

## 10. WorkflowStepExecution

| Field | Meaning |
|---|---|
| `step_execution_id` | Opaque identifier |
| `execution_id` | Parent execution |
| `step_id` | Definition step |
| `status` | PENDING / RUNNING / WAITING / COMPLETED / FAILED / SKIPPED |
| `sequence` | Deterministic execution order |
| `input_reference` | Resolved input reference |
| `output_reference` | Result reference |
| `started_at` | UTC |
| `completed_at` | UTC |

## 11. ExecutionAttempt

| Field | Meaning |
|---|---|
| `attempt_id` | Opaque identifier |
| `step_execution_id` | Parent step |
| `attempt_number` | Monotonic attempt |
| `idempotency_key` | Consequential-operation key |
| `status` | RUNNING / SUCCEEDED / FAILED / CANCELLED |
| `error_reference` | Normalized error reference |
| `started_at` | UTC |
| `completed_at` | UTC |

Invariant: retries create attempts; they do not create duplicate workflow executions.

## 12. ExecutionError

Normalized failure evidence.

| Field | Meaning |
|---|---|
| `error_id` | Opaque identifier |
| `execution_id` | Execution |
| `step_execution_id` | Optional step |
| `attempt_id` | Optional attempt |
| `error_class` | Canonical error category |
| `retryable` | Retry eligibility |
| `safe_message` | Non-sensitive diagnostic |
| `provider_reference` | External reference where applicable |
| `created_at` | UTC |

Secrets and raw sensitive provider responses are not stored as diagnostics.

## 13. AutomationPolicy

Defines execution constraints.

Canonical policy dimensions:
- maximum workflow duration;
- maximum steps;
- maximum retries;
- timeout;
- concurrency;
- approval requirements;
- allowed capabilities;
- data classification;
- retention;
- emergency disable behavior.

## 14. ApprovalReference

Reference to centralized Authorization approval.

| Field | Meaning |
|---|---|
| `approval_reference_id` | Opaque reference |
| `authorization_request_id` | Authorization request |
| `policy_version` | Applied policy |
| `status` | PENDING / APPROVED / REJECTED / EXPIRED |
| `expires_at` | UTC expiry |

Automation never owns approval truth.

## 15. CompensationReference

Explicit recovery action reference for saga-style compensation. A reference belongs to one workflow execution and one previously completed action.

| Field | Meaning |
|---|---|
| `compensation_reference_id` | Opaque identifier |
| `failed_action_id` | Completed prior action whose successful side effect is being compensated; the triggering failed action is captured in recovery evidence |
| `compensation_capability` | Approved capability |
| `execution_id` | Workflow execution being recovered |
| `failed_step_execution_id` | Failed step/attempt lineage where known |
| `failed_attempt_id` | Failed attempt lineage where known |
| `compensation_capability` | Approved compensating capability |
| `status` | DEFINED / REQUESTED / COMPLETED / FAILED |
| `input_reference` | Recovery input lineage |
| `output_reference` | Compensating capability result |
| `evidence_reference` | Durable recovery evidence |
| `idempotency_key` | Stable compensation operation key |
| `attempt_number` | Compensation attempt number |
| `error_reference` | Normalized compensation failure evidence |
| `requested_at` | Recovery request timestamp |
| `completed_at` | Recovery terminal timestamp |

Compensation is not assumed to be universally possible. Automatic compensation runs in reverse order over previously completed actions only. Compensating capabilities must be idempotent. Automation never performs distributed domain rollback; each domain remains authoritative for its side effect.

## 16. Scope and Tenancy

Every workflow and execution resolves scope explicitly:

`PLATFORM → ORGANIZATION → WORKSPACE → BUSINESS`

Rules:
1. Child scope cannot escape parent scope.
2. Cross-tenant references are prohibited.
3. Authorization is evaluated at action time.
4. Platform-global workflows must still declare their permitted target scope.

## 17. Idempotency and Correlation

Canonical execution identity chain:

`source_event_id → execution_id → step_execution_id → attempt_id → idempotency_key`

All consequential actions must be traceable through this chain.

## 18. State Machines

### Workflow
`DRAFT → VALIDATING → ACTIVE → PAUSED → RETIRED`

### Execution
`PENDING → RUNNING → WAITING → COMPLETED`

Failure/cancellation may occur from non-terminal operational states according to policy.

### Attempt
`RUNNING → SUCCEEDED | FAILED | CANCELLED`

Terminal states are immutable.

## 19. Compensation Policy Contract

Action-level `compensation_policy` is immutable with the workflow version. Canonical shape: `{ version, mode, capability }`. `mode=automatic` invokes the capability after a later action fails; `mode=manual` records recovery work without automatic invocation; `mode=none` explicitly accepts non-compensatable work. Missing or malformed policy is recorded as evidence and never treated as successful compensation.

Recovery input is a bounded envelope containing execution ID, original action ID, failed action ID, original output, original input reference when available, and compensation reference ID. Compensation evidence is operational evidence and never becomes domain truth.

## 20. Canonical Capabilities

- `CAP.AUTOMATION.WORKFLOW.CREATE`
- `CAP.AUTOMATION.WORKFLOW.UPDATE`
- `CAP.AUTOMATION.WORKFLOW.ACTIVATE`
- `CAP.AUTOMATION.WORKFLOW.PAUSE`
- `CAP.AUTOMATION.WORKFLOW.RETIRE`
- `CAP.AUTOMATION.WORKFLOW.GET`
- `CAP.AUTOMATION.EXECUTION.START`
- `CAP.AUTOMATION.EXECUTION.GET`
- `CAP.AUTOMATION.EXECUTION.CANCEL`
- `CAP.AUTOMATION.EXECUTION.RETRY`
- `CAP.AUTOMATION.EXECUTION.RESUME`

## 21. Canonical Events

- `automation.workflow.activated`
- `automation.workflow.paused`
- `automation.workflow.retired`
- `automation.execution.started`
- `automation.execution.waiting`
- `automation.execution.completed`
- `automation.execution.failed`
- `automation.execution.cancelled`
- `automation.step.started`
- `automation.step.completed`
- `automation.step.failed`

Event payloads reference canonical IDs and versions and carry tenant/correlation context.

## 22. Ownership Matrix

| Data | Owner |
|---|---|
| Workflow definition | Automation |
| Workflow execution | Automation |
| Business facts | Owning domain |
| Customer identity | Customer/Identity |
| Authorization/approval | Authorization |
| Message delivery | Communications |
| Financial state | Billing/Commerce |
| Reservation state | Booking |
| Fulfillment state | Fulfillment |
| AI proposal/reasoning | AI |

## 23. Data Invariants

1. Opaque IDs are canonical.
2. UTC is the persistence timestamp standard.
3. Active workflow versions are immutable.
4. Execution always pins an exact workflow version.
5. Conditions have no side effects.
6. Actions use canonical capabilities.
7. Consequential actions are idempotent.
8. Authorization is evaluated through the centralized boundary.
9. Domain truth remains in the owning module.
10. Sensitive data follows classification, consent, access, and retention policies.
11. Terminal execution evidence is auditable.
12. Automation never becomes a source of truth for another domain.

## 24. Anti-Duplication Rule

No vertical-specific copies of:
- Workflow;
- Trigger;
- Condition;
- Action;
- Execution;
- Retry;
- Schedule;
- AutomationPolicy.

Beauty, Fashion, Medical, CRM, Commerce, Booking, Fulfillment, and AI all use the same canonical Automation model.

## 25. Definition of Done

The Automation data contract is complete when definitions, versions, triggers, conditions, actions, schedules, executions, attempts, errors, policies, approvals, compensation references, scope, idempotency, states, capabilities, events, ownership, and invariants are represented by one canonical vocabulary.

## 26. Final Decision

Phoenix has one canonical Automation & Workflow Engine data model. Domain modules own domain truth; Automation owns orchestration state and execution evidence.
