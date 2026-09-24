# Phoenix Case & Support Operations Engine Data Dictionary

**Status:** Canonical data contract  
**Scope:** Operational cases, support, complaints, escalations, queues, SLA, assignment, evidence references, and resolution.

## 1. Case

Canonical operational aggregate.

Fields:
- id;
- tenant_id;
- case_type;
- status;
- priority;
- severity;
- subject_type;
- subject_id;
- requester_type;
- requester_id;
- source_type;
- source_reference;
- queue_id;
- assignee_id;
- sla_id;
- version;
- opened_at;
- resolved_at;
- closed_at;
- created_at;
- updated_at.

## 2. CaseType

Versioned classification of operational work.

Fields:
- id;
- code;
- description;
- required_capabilities;
- default_priority;
- default_sla;
- policy_version;
- status.

Examples:
CUSTOMER_SUPPORT, COMPLAINT, BOOKING_ISSUE, ORDER_ISSUE, PAYMENT_ISSUE, DELIVERY_ISSUE, VERIFICATION_REVIEW, SAFETY_REVIEW, PLATFORM_ABUSE.

## 3. CaseQueue

Operational work queue.

Fields:
- id;
- tenant_scope;
- name;
- supported_case_types;
- required_capabilities;
- language_scope;
- jurisdiction_scope;
- status;
- routing_policy_version;
- dispatch_provider_id?;
- dispatch_route_reference?;
- dispatch_enabled.

## 4. CaseAssignment

Assignment history.

Fields:
- id;
- case_id;
- queue_id;
- assignee_type;
- assignee_id;
- assigned_by;
- reason;
- assigned_at;
- unassigned_at.

Assignment history is append-only.

## 5. CaseParticipant

Actor associated with a case.

Fields:
- id;
- case_id;
- actor_type;
- actor_id;
- role;
- visibility_scope;
- joined_at;
- left_at.

## 6. CaseEvent

Immutable lifecycle/event evidence.

Fields:
- id;
- case_id;
- event_type;
- actor_type;
- actor_id;
- from_status;
- to_status;
- payload_reference;
- correlation_id;
- occurred_at.

## 7. CaseNote

Internal or permitted operational note.

Fields:
- id;
- case_id;
- author_id;
- visibility;
- content_reference;
- classification;
- created_at;
- edited_at.

Sensitive content follows privacy policy.

## 8. CaseEvidenceReference

Reference to evidence owned elsewhere.

Fields:
- id;
- case_id;
- source_module;
- source_type;
- source_id;
- evidence_type;
- classification;
- access_policy_reference;
- created_at.

The case does not become owner of another module's evidence.

## 9. CaseLink

Relationship to authoritative domain records or other cases.

Fields:
- id;
- case_id;
- linked_type;
- linked_id;
- relationship;
- created_at.

Examples:
ORDER, BOOKING, BUSINESS, CUSTOMER, VERIFICATION_CASE, FULFILLMENT_ORDER, REVIEW.

## 10. CaseEscalation

Explicit escalation record.

Fields:
- id;
- case_id;
- escalation_type;
- reason;
- target_queue_id;
- target_actor_id;
- policy_version;
- requested_by;
- escalated_at;
- resolved_at.

## 11. CaseResolution

Resolution record.

Fields:
- id;
- case_id;
- outcome_code;
- summary_reference;
- resolver_id;
- authoritative_references;
- follow_up_required;
- resolved_at.

A resolution does not itself mutate another domain.

## 12. CaseSLA

Operational service-level policy.

Fields:
- id;
- case_type_id;
- scope;
- first_response_target;
- resolution_target;
- calendar_id;
- timezone;
- pause_conditions;
- escalation_thresholds;
- policy_version;
- effective_from;
- effective_to.

## 13. CaseAction

Controlled action initiated from a case.

Fields:
- id;
- case_id;
- capability;
- target_reference;
- requested_by;
- authorization_reference;
- idempotency_key;
- status;
- result_reference;
- created_at;
- completed_at.

Case actions invoke canonical domain capabilities rather than private persistence.

## 14. CaseTemplate

Reusable case configuration.

Fields:
- id;
- case_type_id;
- required_fields;
- routing_policy;
- default_sla;
- default_priority;
- response_templates;
- policy_version;
- status.

## 15. CaseDispatch

Durable external-provider dispatch record created from an authorized queue assignment.

Fields:
- id;
- case_id;
- assignment_id;
- queue_id;
- provider_id;
- route_reference;
- idempotency_key;
- status;
- external_reference;
- failure_code;
- failure_class;
- attempts;
- available_at;
- accepted_at;
- last_attempt_at;
- created_at;
- updated_at.

## 16. CaseDispatchAttempt

Append-only evidence for one provider dispatch attempt.

Fields:
- id;
- dispatch_id;
- attempt_number;
- status;
- provider_reference;
- failure_code;
- failure_class;
- occurred_at.

## 17. Priority and Severity

Priority represents operational ordering:
- LOW;
- NORMAL;
- HIGH;
- URGENT.

Severity describes impact and is distinct from priority.

Policy may derive defaults; operator changes require an auditable reason.

## 18. State Machine

```text
OPEN → TRIAGED → ASSIGNED → IN_PROGRESS → WAITING → RESOLVED → CLOSED
                         ↘
                        ESCALATED → IN_PROGRESS

RESOLVED → REOPENED → IN_PROGRESS
```

State transitions are explicit commands.

## 19. SLA State

Derived operational state may include:
- ON_TRACK;
- AT_RISK;
- BREACHED;
- PAUSED;
- COMPLETED.

SLA state is derived from canonical case timestamps and policy.

## 20. Ownership Matrix

| Data | Owner |
|---|---|
| Case lifecycle | Case & Support |
| Customer identity | Customer/Identity |
| Order | Commerce |
| Booking | Booking |
| Payment/financial truth | Billing |
| Fulfillment | Fulfillment |
| Verification | Trust |
| Messages | Communications |
| Authorization | Authorization |
| AI inference | AI |
| Metrics | Analytics |

## 21. Tenancy

Case and queue records are tenant/workspace scoped unless explicitly platform-global.

All reads, writes, searches, assignments, and escalations must enforce authorization and scope.

## 22. Idempotency and Concurrency

Case creation from events uses an idempotency key derived from source event identity.

State-changing commands require expected version/concurrency validation.

Duplicate automation or inbound events must not create duplicate cases or duplicate domain actions.

## 23. AI Provenance

AI-generated classification, summary, priority suggestion, routing suggestion, or draft response must retain:
- model/policy version;
- source references;
- generation timestamp;
- confidence where applicable;
- human approval status where required.

AI output is not authoritative case truth.

## 24. Audit

Audit references include:
- actor/service identity;
- tenant;
- action;
- target;
- timestamp;
- request/correlation ID;
- authorization reference;
- policy version;
- outcome.

Sensitive evidence itself is never copied into audit logs.

## 25. Canonical Capabilities

```text
CAP.CASE.CREATE
CAP.CASE.GET
CAP.CASE.UPDATE
CAP.CASE.TRIAGE
CAP.CASE.ASSIGN
CAP.CASE.ESCALATE
CAP.CASE.ADD_NOTE
CAP.CASE.ADD_EVIDENCE_REFERENCE
CAP.CASE.RESOLVE
CAP.CASE.CLOSE
CAP.CASE.REOPEN
CAP.CASE.LIST
```

## 26. Canonical Events

```text
case.created
case.triaged
case.assigned
case.started
case.waiting
case.escalated
case.resolved
case.closed
case.reopened
case.sla_risk
case.sla_breached
```

## 27. Medical Boundary

Medical-related cases may coordinate support, verification, safety, booking, billing, or complaints.

The Case engine never becomes a clinical decision engine.

It must not:
- diagnose;
- prescribe;
- recommend treatment;
- convert support content into clinical truth.

Clinical facts remain outside Case ownership.

## 28. Data Invariants

1. Case is operational coordination, not domain truth.
2. State transitions are explicit.
3. Assignment requires authorization.
4. Evidence is referenced, not duplicated.
5. Domain mutations use canonical capabilities.
6. SLA is policy/version based.
7. Priority and severity remain distinct.
8. AI output is non-authoritative unless explicitly approved through policy.
9. Tenant isolation is mandatory.
10. Case history remains auditable.
11. Closed cases remain historically reconstructable.
12. Duplicate source events are idempotently handled.

## 29. Anti-Duplication

There is exactly one Phoenix Case & Support Operations data model.

Do not create vertical-specific support tables or engines such as:
- BeautySupport;
- FashionSupport;
- MedicalSupport;
- BookingSupport;
- CommerceSupport.

Differences are expressed through CaseType, policy, routing, and domain links.

## 30. Definition of Done

The canonical model is complete when case intake, type, queue, assignment, participants, lifecycle, evidence references, links, escalation, SLA, actions, resolution, AI provenance, authorization, tenancy, audit, capabilities, and events are explicit.
