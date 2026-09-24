# Phoenix Automation & Workflow Engine Architecture

**Status:** Canonical architecture contract  
**Scope:** Reusable event-driven workflows, triggers, conditions, actions, execution state, retries, scheduling, and operational automation across Phoenix.

## 1. Purpose

Automation is the canonical platform engine for executing deterministic, auditable workflows in response to events, schedules, or approved commands.

It is reusable across all Phoenix verticals and modules.

Automation does not own:
- business domain truth;
- customer identity;
- authorization;
- communication delivery;
- AI reasoning;
- payments;
- booking;
- fulfillment;
- CRM records.

## 2. Ownership

| Domain | Owns |
|---|---|
| Automation | Workflow definitions, triggers, conditions, actions, execution state |
| Domain modules | Authoritative business facts and capabilities |
| Authorization | Access decisions and approval policy |
| Communications | Message composition/delivery |
| AI | Reasoning, recommendations, bounded proposals |
| Analytics | Metrics and derived insights |
| Billing | Money, usage, entitlements |
| Database/Audit | Persistence and immutable evidence |

Automation invokes capabilities; it does not implement their business logic.

## 3. Canonical concepts

- **Workflow** — versioned definition of an automation.
- **WorkflowVersion** — immutable executable definition.
- **Trigger** — event, schedule, or approved command that starts execution.
- **Condition** — deterministic predicate controlling execution.
- **Action** — invocation of a canonical capability.
- **WorkflowExecution** — one runtime instance.
- **WorkflowStepExecution** — execution record for one step.
- **ExecutionAttempt** — one retryable attempt.
- **Schedule** — temporal trigger definition.
- **WorkflowVariable** — scoped execution input/reference.
- **ExecutionError** — normalized failure record.
- **Compensation** — explicit recovery action where supported.
- **AutomationPolicy** — limits, approvals, retry and safety constraints.

## 4. Execution model

```text
Event / Schedule / Command
          ↓
       Trigger
          ↓
   Workflow Version
          ↓
 Condition Evaluation
          ↓
     Action Step
          ↓
 Canonical Capability
          ↓
 Result / Event
          ↓
 Next Step / Completion
```

Every action executes through the owning domain capability and its authorization boundary.

## 5. Workflow lifecycle

```text
DRAFT → VALIDATING → ACTIVE → PAUSED → RETIRED
```

A version that is ACTIVE is immutable. Changes create a new WorkflowVersion.

## 6. Execution lifecycle

```text
PENDING → RUNNING → WAITING → COMPLETED
                    ↘
                 FAILED
                    ↘
                 CANCELLED
```

Retries create attempts, not duplicate executions.

## 7. Trigger model

Canonical trigger types:
- EVENT
- SCHEDULE
- COMMAND

Event triggers consume canonical domain events. Schedule triggers are timezone-aware and localization-compatible. Command triggers require authorization.

Triggers must be idempotent and must carry correlation context.

## 8. Conditions

Conditions are deterministic and versioned.

They may inspect:
- event payload references;
- canonical domain facts;
- workflow variables;
- authorization context;
- time/window constraints;
- approved feature/policy state.

Conditions must not mutate business state.

AI-generated conditions are proposals and require validation before activation.

## 9. Action model

An Action references a canonical capability:

```text
Action
 → Capability
 → Authorization
 → Owning Domain
 → Transaction
 → Event
```

Automation never writes directly to domain-private persistence.

Examples:
- send notification;
- create CRM task;
- create fulfillment task;
- request review;
- enroll loyalty member;
- evaluate promotion;
- schedule booking operation where authorized.

## 10. Idempotency

Every externally consequential action must have an idempotency strategy.

Canonical identity:
- workflow execution ID;
- step execution ID;
- attempt ID;
- action idempotency key;
- source event ID;
- correlation ID.

Retrying an attempt must not duplicate a successful domain command.

## 11. Failure and retry

Each action may define:
- maximum attempts;
- retryable error classes;
- backoff policy;
- timeout;
- dead-letter/terminal handling;
- compensation reference.

Non-retryable failures stop the affected execution unless an explicit fallback branch exists.

Automation must not silently retry financial, legal, or high-risk operations without policy approval.

## 12. Concurrency

Workflow execution requires:
- single active transition per execution state;
- optimistic/concurrency-safe versioning;
- idempotent event consumption;
- deterministic step ordering;
- bounded parallelism where supported.

Parallel actions must declare whether ordering or isolation is required.

## 13. Scheduling

Schedules include:
- timezone;
- start/end window;
- recurrence definition;
- enabled state;
- misfire policy;
- next-run reference.

User-facing calendars use the Localization/Calendar contract. UTC remains the persistence baseline.

## 14. Waiting and timers

A workflow may wait for:
- time;
- event;
- approval;
- external result.

Waiting state must be durable and resumable. No in-memory timer is authoritative.

## 15. Approvals and high-risk actions

Actions that change permissions, financial state, regulated state, or other high-risk state may require explicit approval.

Automation consumes the Authorization approval contract and cannot self-approve.

## 16. AI boundary

AI may:
- propose workflows;
- suggest conditions/actions;
- summarize failed executions;
- recommend automation opportunities;
- optimize bounded parameters.

AI may not:
- bypass authorization;
- invent capabilities;
- execute undeclared tools;
- silently activate workflows;
- mutate workflow definitions without permission;
- claim an action succeeded without authoritative result evidence.

## 17. Observability and audit

Every execution records:
- workflow/version;
- trigger;
- actor or system identity;
- tenant/workspace scope;
- correlation/trace IDs;
- step and attempt state;
- timing;
- result/error;
- policy/version references.

Sensitive payloads are referenced or redacted according to security policy.

## 18. Multi-tenancy

Workflows and executions are tenant-scoped unless explicitly defined as platform-global.

Tenant/workspace/business scope is validated before trigger acceptance and before consequential actions.

Cross-tenant workflow references are forbidden.

## 19. Communications boundary

Automation may invoke Communications capabilities but never becomes a messaging engine.

## 20. Domain event boundary

Automation consumes facts and invokes capabilities. Events remain facts, not automation commands.

A workflow must not infer authoritative state from stale projections when the owning capability requires fresh validation.

## 21. Canonical capabilities

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

## 22. Canonical events

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

## 23. Security invariants

1. Default deny through centralized Authorization.
2. No direct writes to domain-private tables.
3. Tenant isolation is mandatory.
4. Workflow versions are immutable once active.
5. Executions are auditable.
6. Retries are idempotent.
7. Secrets are never workflow variables.
8. External payloads are untrusted.
9. High-risk actions require policy/approval where applicable.
10. AI cannot bypass automation or authorization controls.

## 24. Anti-duplication

There is exactly one Phoenix Automation & Workflow Engine.

Forbidden:
- Beauty automation engine;
- Fashion automation engine;
- Medical automation engine;
- CRM workflow engine separate from Automation;
- notification scheduler separate from Automation;
- AI-only workflow engine;
- fulfillment-specific workflow engine.

Domain modules may define domain-specific events and capabilities; Automation orchestrates them through canonical contracts.

## 25. Definition of Done

Architecture is complete when workflow definition/versioning, triggers, conditions, actions, execution state, retries, scheduling, waiting, approvals, tenancy, audit, AI boundaries, capabilities, and events are canonical and reusable.

## 26. Final decision

Phoenix uses one centralized Automation & Workflow Engine as the reusable orchestration layer:

```text
Events / Schedules / Commands
            ↓
        Automation
            ↓
 Conditions + Actions
            ↓
     Domain Capabilities
            ↓
       Domain Truth
            ↓
          Events
```

## Compensation / rollback contract

Automation uses saga-style compensation rather than distributed rollback. When an action fails after prior actions completed, the executor walks prior completed actions in reverse sequence order and applies each action's immutable compensation policy.

```text
Failed Action
  ↓
Compensation Policy
  ↓
Completed prior actions (reverse order)
  ↓
CapabilityRegistry
  ↓
Compensation Reference
  ↓
Evidence
```

Action compensation policy is versioned with the workflow action and has three modes: `automatic`, `manual`, and `none`. Automatic compensation invokes an approved compensating capability; manual compensation records operational recovery work; none explicitly records that no automatic reversal exists.

Every compensation reference is scoped to the execution and original action, has a stable idempotency key, and records output/error/evidence references. Compensation capabilities must be idempotent because a worker crash can leave a requested operation with an unknown external outcome.

Automation never mutates domain truth to simulate rollback. Booking, Commerce, Billing, Fulfillment, Communication, and other domains remain authoritative for their successful side effects. Compensation only invokes the domain-owned capability that reverses or reconciles that side effect.

