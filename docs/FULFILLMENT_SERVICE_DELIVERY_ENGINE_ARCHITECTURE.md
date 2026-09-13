# Phoenix Fulfillment & Service Delivery Engine Architecture

**Status:** Canonical architecture contract
**Scope:** Post-order physical delivery, digital delivery, and service fulfillment for all Phoenix verticals.

## 1. Purpose

Fulfillment is the canonical engine that turns an accepted Commerce Order or committed Booking into an observable fulfillment lifecycle and records whether the promised goods or service were actually delivered.

It is reusable across Beauty, Fashion, Medical, and future verticals.

Fulfillment does not own:

- catalog truth or base price;
- promotion eligibility;
- payment or financial settlement;
- booking availability or appointment creation;
- customer identity;
- communication delivery;
- AI reasoning;
- reputation/review truth.

## 2. Ownership

| Domain | Owns |
|---|---|
| Catalog | Offering/product/service definitions |
| Commerce | Order and commercial commitment |
| Booking | Reservation/appointment commitment |
| Billing/Payment | Financial authorization, capture, refund |
| Fulfillment | Delivery/service execution state and evidence |
| Communications | Message/channel delivery |
| CRM | Customer relationship |
| AI | Discovery, explanation, prediction and bounded recommendations |
| Analytics | Measurement and derived metrics |
| Authorization | Permission/policy decisions |

## 3. Canonical concepts

- **FulfillmentOrder** — aggregate coordinating fulfillment for an Order.
- **FulfillmentItem** — fulfillment obligation for an OrderLine or BookingItem.
- **FulfillmentPlan** — versioned execution plan.
- **FulfillmentTask** — atomic operational work unit.
- **Shipment** — physical delivery execution.
- **ShipmentPackage** — physical package/container.
- **TrackingEvent** — carrier or operational movement evidence.
- **DeliveryAttempt** — attempt to deliver a shipment or service.
- **ServiceDelivery** — execution record for an appointment/service obligation.
- **ServiceCompletion** — authoritative completion evidence.
- **DigitalDelivery** — controlled digital fulfillment reference.
- **FulfillmentException** — operational failure requiring resolution.
- **FulfillmentStatusHistory** — immutable lifecycle evidence.
- **FulfillmentActor** — authorized party performing operational work.

## 4. Fulfillment boundary

```text
Commerce Order / Booking Commitment
              ↓
       Fulfillment Intake
              ↓
       Fulfillment Plan
              ↓
      Fulfillment Tasks
        ↙           ↘
Physical Shipment   Service Delivery
        ↓                 ↓
Tracking/Attempts    Appointment/Execution
        ↘                 ↙
       Completion Evidence
              ↓
       Fulfillment Complete
```

Fulfillment references upstream facts; it does not recreate Order, Booking, Customer, Product, Service, or Payment as shadow entities.

## 5. Intake contract

Fulfillment may be created only from an authoritative commitment:

- confirmed Commerce Order, for physical/digital goods;
- confirmed Booking, for service fulfillment;
- another explicitly approved domain commitment in future modules.

Intake validates scope, line references, fulfillment type, destination/execution context, and required prerequisites.

## 6. Fulfillment types

Canonical types:

- `PHYSICAL`
- `DIGITAL`
- `SERVICE`
- `HYBRID`

A single order may have multiple FulfillmentItems and multiple execution paths. The model must not force one delivery method onto every order line.

## 7. Lifecycle

### FulfillmentOrder

```text
PENDING
→ PLANNED
→ READY
→ IN_PROGRESS
→ PARTIALLY_COMPLETED
→ COMPLETED
```

Alternative terminal states:

```text
CANCELLED
FAILED
CLOSED
```

### Shipment

```text
DRAFT → READY → DISPATCHED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
```

Alternative states:

`CANCELLED`, `RETURNED`, `LOST`, `FAILED`

### ServiceDelivery

```text
SCHEDULED → READY → IN_PROGRESS → COMPLETED
```

Alternative states:

`CANCELLED`, `NO_SHOW`, `FAILED`, `REQUIRES_REWORK`

Lifecycle transitions are deterministic, authorized, auditable, and versioned where policy requires.

## 8. Fulfillment item model

Each FulfillmentItem contains:

- source type and source identifier;
- source line/reference;
- quantity;
- fulfillment type;
- execution status;
- promised window where applicable;
- destination or service location reference;
- assigned actor/provider reference where applicable;
- completion evidence reference;
- exception reference where applicable.

Historical commercial values remain in Commerce snapshots. Fulfillment stores execution facts, not a second price model.

## 9. Physical shipment

Shipment owns execution of physical delivery.

It may reference:

- origin;
- destination;
- package(s);
- carrier/provider;
- service level;
- tracking reference;
- dispatch timestamp;
- delivery timestamp;
- proof-of-delivery reference.

Carrier integrations are adapters. Carrier-specific schemas must not become the canonical Phoenix shipment model.

## 10. Tracking

TrackingEvent is immutable evidence received from a carrier or operational source.

Canonical fields include:

- event type;
- occurred_at;
- received_at;
- source;
- external reference;
- location where available;
- raw-provider reference where retention policy permits;
- normalized status mapping.

Provider events may be duplicated or arrive out of order. Fulfillment derives current operational state through deterministic reconciliation without rewriting historical evidence.

## 11. Service delivery

ServiceDelivery represents execution of a service commitment.

It references Booking/Appointment rather than recreating scheduling truth.

Canonical evidence includes:

- appointment reference;
- assigned provider/resource reference;
- service start/end;
- execution status;
- completion actor;
- completion timestamp;
- customer/provider confirmation where required;
- exception or rework reference.

For medical services, Fulfillment records execution only. It never records diagnosis or treatment decisions as fulfillment authority.

## 12. Digital delivery

DigitalDelivery supports controlled fulfillment of digital goods/services.

It may reference:

- entitlement/certificate/access reference owned by the relevant domain;
- delivery channel;
- issuance timestamp;
- recipient scope;
- access expiry where applicable;
- delivery evidence.

Credentials, secrets, private download tokens, and payment data are not stored as ordinary fulfillment fields.

## 13. Completion

Completion requires authoritative evidence appropriate to fulfillment type.

Examples:

- physical: carrier delivery/proof-of-delivery or approved manual evidence;
- service: authorized service completion evidence;
- digital: successful issuance/access event.

AI cannot declare fulfillment complete without authoritative evidence.

## 14. Exceptions and rework

FulfillmentException represents an operational problem such as:

- failed delivery;
- damaged/lost package;
- unavailable recipient;
- service no-show;
- service failure;
- provider delay;
- invalid destination;
- digital issuance failure.

An exception may create remediation tasks, but it does not mutate upstream Order or Booking truth without using their canonical capabilities.

## 15. Returns and refunds boundary

Fulfillment may record that an item was returned or a service failed, but it does not become the financial authority.

```text
Fulfillment evidence
        ↓
Commerce/Billing policy
        ↓
Refund / credit / financial transaction
```

Return logistics belong to Fulfillment; monetary refund truth belongs to Commerce/Billing.

## 16. Cancellation boundary

Cancellation of an Order remains Commerce-owned. Cancellation of a Booking remains Booking-owned.

Fulfillment responds to authoritative cancellation events and transitions its own execution state accordingly.

## 17. Assignment

Fulfillment may assign execution to an approved provider, worker, carrier, resource, or service actor.

Assignment does not create a new identity system. Actors come from Identity/Authorization and provider relationships from the owning domain.

## 18. Multi-tenant isolation

Every tenant-owned fulfillment aggregate is scoped to its authoritative tenant/workspace/business context.

Cross-tenant shipment, task, tracking, or service-delivery references are forbidden.

Repository/data access must enforce scope; UI filtering is not a security boundary.

## 19. Authorization

Sensitive actions require centralized authorization:

- create/plan fulfillment;
- assign task;
- dispatch shipment;
- update operational state;
- confirm delivery;
- confirm service completion;
- resolve exception;
- cancel fulfillment task;
- view protected delivery evidence.

No Fulfillment-specific RBAC/ABAC engine is permitted.

## 20. Idempotency and reconciliation

External carrier/provider callbacks must be idempotent.

Canonical controls:

- external event identity;
- source/provider identity;
- correlation ID;
- deduplication key;
- received timestamp;
- normalized event version.

Reprocessing the same provider event must not create duplicate operational state transitions.

## 21. Event contract

Canonical events include:

- `fulfillment.created`
- `fulfillment.planned`
- `fulfillment.started`
- `fulfillment.partially_completed`
- `fulfillment.completed`
- `fulfillment.cancelled`
- `fulfillment.failed`
- `shipment.dispatched`
- `shipment.in_transit`
- `shipment.out_for_delivery`
- `shipment.delivered`
- `shipment.returned`
- `service_delivery.started`
- `service_delivery.completed`
- `fulfillment.exception.created`
- `fulfillment.exception.resolved`

Events are facts, not commands.

## 22. Capability contract

Canonical capabilities:

- `CAP.FULFILLMENT.CREATE`
- `CAP.FULFILLMENT.GET`
- `CAP.FULFILLMENT.PLAN`
- `CAP.FULFILLMENT.ASSIGN`
- `CAP.FULFILLMENT.START`
- `CAP.FULFILLMENT.UPDATE_STATUS`
- `CAP.FULFILLMENT.CONFIRM_DELIVERY`
- `CAP.FULFILLMENT.CONFIRM_SERVICE_COMPLETION`
- `CAP.FULFILLMENT.CREATE_EXCEPTION`
- `CAP.FULFILLMENT.RESOLVE_EXCEPTION`
- `CAP.FULFILLMENT.CANCEL`
- `CAP.FULFILLMENT.GET_TRACKING`

Provider/carrier adapter capabilities remain implementation adapters behind the canonical contract.

## 23. AI boundary

AI may:

- predict delivery delays;
- summarize tracking history;
- recommend operational prioritization;
- explain status;
- propose bounded task actions.

AI may not:

- invent delivery status;
- mark an order paid;
- mark a booking completed without evidence;
- override authorization;
- fabricate tracking events;
- directly mutate fulfillment storage.

## 24. Communications boundary

Fulfillment emits facts. Communications decides channel/template/delivery.

Examples:

```text
fulfillment.created → notification policy
shipment.dispatched → customer notification
shipment.delivered → completion communication
exception.created → operational alert
```

Fulfillment does not implement email, SMS, WhatsApp, push, or chat delivery.

## 25. Analytics boundary

Analytics consumes fulfillment events and computes:

- delivery time;
- on-time rate;
- completion rate;
- failure rate;
- exception rate;
- provider performance;
- fulfillment cost metrics where financially sourced.

Derived analytics are not fulfillment truth.

## 26. Localization and geography

Destination addresses, time zones, calendars, business hours, holidays, and country rules are consumed through canonical platform/domain contracts.

Fulfillment must support localized delivery windows and international addresses without creating country-specific fulfillment engines.

## 27. Privacy and retention

Fulfillment may contain address, recipient, service execution, and delivery evidence.

Data minimization, classification, retention, deletion, and access follow platform privacy/security policy.

Proof-of-delivery and sensitive evidence should be referenced rather than duplicated when owned by Media or another evidence subsystem.

## 28. Data model outline

Canonical aggregates/entities:

```text
fulfillments
fulfillment_items
fulfillment_plans
fulfillment_tasks
shipments
shipment_packages
tracking_events
service_deliveries
service_completions
digital_deliveries
delivery_attempts
fulfillment_exceptions
fulfillment_status_history
fulfillment_assignments
```

These are logical entities. Physical schema decisions belong to the data model/schema phase.

## 29. Anti-duplication rule

There is exactly one Phoenix Fulfillment & Service Delivery Engine.

Forbidden without an explicit architecture decision:

- Beauty fulfillment engine;
- Fashion shipping engine;
- Medical service-delivery engine;
- separate delivery tracking engine;
- separate provider dispatch engine;
- Commerce-owned duplicate shipment lifecycle;
- Booking-owned duplicate service-completion lifecycle.

Vertical differences are configuration, policy, fulfillment type, provider integration, and regulated constraints.

## 30. Definition of Done

Architecture is complete when:

- physical, digital, and service fulfillment share one model;
- upstream ownership boundaries are explicit;
- shipment and service delivery lifecycles are defined;
- completion evidence is authoritative;
- exceptions/rework are modeled;
- returns/refunds boundaries are explicit;
- idempotent provider events are defined;
- authorization, audit, communication, AI, analytics, and localization boundaries are explicit;
- canonical capabilities/events are defined;
- no vertical-specific duplicate engine is required.

## 31. Final decision

Phoenix uses **one reusable Fulfillment & Service Delivery Engine** between commercial/service commitments and real-world execution.

```text
Order / Booking
      ↓
 Fulfillment
   ↙       ↘
Shipment   Service Delivery
   ↓           ↓
Tracking    Completion
   ↘           ↙
      Evidence
         ↓
     Completion
```
