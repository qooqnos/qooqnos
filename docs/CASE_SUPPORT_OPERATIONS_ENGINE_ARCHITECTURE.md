# Phoenix Case & Support Operations Engine Architecture

**Status:** Canonical architecture contract  
**Scope:** Customer support cases, operational requests, complaints, escalations, internal queues, assignments, and resolution evidence.

## 1. Purpose

Case & Support Operations is the reusable operational layer for work that requires a human or controlled workflow to investigate, coordinate, resolve, or escalate an issue.

It converts an operational request into a traceable case without taking ownership of the domain truth that caused the case.

## 2. Ownership

| Domain | Owns |
|---|---|
| Case & Support | Case lifecycle, queue, assignment, escalation, resolution record |
| Customer | Customer identity/profile |
| Business | Business relationship/profile |
| Booking | Appointment truth |
| Commerce | Order truth |
| Billing | Financial truth |
| Fulfillment | Delivery/service execution truth |
| Reviews | Review/reputation truth |
| Trust | Verification truth |
| Communications | Message delivery |
| Authorization | Access and privileged actions |
| AI | Classification, summarization, suggestions |
| Analytics | Operational metrics |

A case references authoritative domain records; it does not copy them as competing truth.

## 3. Core Concepts

- Case
- CaseType
- CasePriority
- CaseStatus
- CaseQueue
- CaseAssignment
- CaseParticipant
- CaseEvent
- CaseNote
- CaseEvidenceReference
- CaseEscalation
- CaseResolution
- CaseSLA
- CaseLink
- CaseAction
- CaseTemplate

## 4. Case Types

Initial types may include:

- CUSTOMER_SUPPORT
- COMPLAINT
- BOOKING_ISSUE
- ORDER_ISSUE
- PAYMENT_ISSUE
- DELIVERY_ISSUE
- PROVIDER_ISSUE
- VERIFICATION_REVIEW
- SAFETY_REVIEW
- PLATFORM_ABUSE
- TECHNICAL_SUPPORT

New types must reuse the same engine.

## 5. Lifecycle

```text
OPEN
  → TRIAGED
  → ASSIGNED
  → IN_PROGRESS
  → WAITING
  → RESOLVED
  → CLOSED

Any active state may → ESCALATED
ESCALATED → IN_PROGRESS
RESOLVED → REOPENED
REOPENED → IN_PROGRESS
```

State changes are explicit commands and auditable.

## 6. Intake

Cases may originate from:

- customer request;
- business request;
- internal operator;
- automated domain event;
- policy/risk signal;
- AI suggestion requiring human review.

The originating source and correlation ID are mandatory.

## 7. Queue and Assignment

Cases are routed to queues according to deterministic routing policy.

Routing may consider:
- case type;
- tenant/workspace;
- language;
- jurisdiction;
- priority;
- required capability;
- business relationship;
- regulated/high-risk status.

Assignment requires Authorization.

No user-supplied field may directly grant privileged routing or access.

## 8. Priority

Priority is separate from severity and SLA.

Priority may be represented as:
- LOW
- NORMAL
- HIGH
- URGENT

Policy may derive an initial priority, but authorized operators may adjust it with an auditable reason.

## 9. SLA

An SLA defines operational expectations.

It may contain:
- first-response target;
- resolution target;
- business calendar;
- timezone;
- pause conditions;
- escalation thresholds.

SLA timers must use canonical calendar/timezone rules rather than UI-local assumptions.

## 10. Escalation

Escalation creates an explicit operational transition.

Reasons may include:
- SLA breach/risk;
- regulated issue;
- safety concern;
- unresolved complaint;
- financial dispute;
- fraud/abuse signal;
- required authority unavailable.

Escalation never silently changes the underlying domain truth.

## 11. Evidence

A case may reference:

- messages;
- orders;
- bookings;
- fulfillment records;
- verification evidence;
- media;
- audit references;
- external case references.

Sensitive evidence remains owned/protected by its source module or protected storage boundary.

Do not duplicate sensitive documents into case records merely for convenience.

## 12. Resolution

Resolution records:

- outcome code;
- summary;
- resolver;
- resolved timestamp;
- authoritative references;
- customer/business communication reference;
- follow-up requirement.

A case resolution does not mutate another domain unless it invokes that domain's canonical capability.

## 13. Domain Action Boundary

Examples:

```text
Case
 ↓
CAP.BOOKING.CANCEL
CAP.COMMERCE.CREATE_RETURN
CAP.BILLING.REVIEW_REFUND
CAP.TRUST.REQUEST_CHANGES
CAP.FULFILLMENT.CREATE_EXCEPTION
```

Case owns coordination; the target domain owns mutation.

## 14. AI Boundary

AI may:
- classify cases;
- summarize history;
- detect duplicate cases;
- suggest priority;
- suggest routing;
- draft responses;
- identify missing evidence;
- summarize customer sentiment where policy permits;
- recommend next actions.

AI may not:
- close a regulated/safety case without policy authorization;
- issue refunds directly;
- alter booking/order/payment truth directly;
- approve verification;
- bypass Authorization;
- invent evidence;
- suppress audit history.

High-impact AI suggestions require configured human/policy approval.

## 15. Communications

Communications owns delivery through email, SMS, push, WhatsApp, chat, or other channels.

Case stores message references and communication state relevant to the case, not a second messaging engine.

## 16. Privacy

Case data can contain sensitive personal and commercial information.

Required controls:
- tenant isolation;
- least-privilege access;
- field/data classification;
- retention policy;
- redaction;
- audit;
- access logging;
- secure evidence references.

Case search must respect the same authorization boundary as direct case access.

## 17. Multi-Tenant Model

Every case has an explicit tenant/workspace scope.

Internal platform operations may use platform scope with explicit authorization.

Cross-tenant case access is prohibited unless an approved platform-level operation explicitly permits it.

## 18. Idempotency and Concurrency

Case creation from retried events must be idempotent.

Assignment, escalation, resolution, reopening, and domain actions must use concurrency/version checks.

Duplicate inbound events must not create duplicate operational cases.

## 19. Automation Integration

Automation may create or update cases only through canonical Case capabilities.

Case workflows may wait for human action, SLA timers, or external events.

Automation cannot bypass case permissions or domain capabilities.

## 20. Analytics

Operational analytics may measure:
- volume;
- backlog;
- first response;
- resolution time;
- reopen rate;
- escalation rate;
- SLA compliance;
- queue load;
- category distribution.

Analytics is derived and does not own case state.

## 21. Capabilities

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

## 22. Events

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

Events are versioned, tenant-scoped, correlated, and idempotently consumable.

## 23. Security and Abuse

Protect against:
- unauthorized case access;
- fraudulent complaints;
- spam case creation;
- evidence manipulation;
- agent impersonation;
- privilege escalation;
- malicious content/prompt injection;
- cross-tenant leakage.

Security/risk policy supplies controls; Case coordinates their operational handling.

## 24. Internationalization

Support:
- multilingual case content;
- RTL/LTR;
- local calendars;
- jurisdiction;
- timezone;
- business calendars;
- localized SLA policies.

Case logic remains language-neutral.

## 25. Performance

Interactive case reads/writes should remain strongly consistent.

Heavy operations such as:
- attachment processing;
- AI summarization;
- duplicate detection;
- analytics aggregation;
- notification delivery

are asynchronous.

## 26. Anti-Duplication

Phoenix has one Case & Support Operations Engine.

Forbidden:
- BeautySupport;
- FashionSupport;
- MedicalSupport;
- BookingSupportEngine;
- CommerceSupportEngine;
- AI Case Engine.

Verticals and domains create case types and adapters, not separate engines.

## 27. Definition of Done

The engine is complete when case intake, lifecycle, queues, assignments, priority, SLA, escalation, evidence references, resolution, authorization, privacy, automation integration, AI boundaries, capabilities, events, tenancy, and auditability are canonical.
