# Phoenix Fulfillment & Service Delivery Engine Data Dictionary

**Status:** Canonical architecture contract  
**Scope:** Canonical data vocabulary for physical, digital, and service fulfillment.

## 1. Purpose

This document defines the canonical data model vocabulary for the Fulfillment & Service Delivery Engine. It does not create a second shipment, dispatch, service-completion, or logistics model.

## 2. Ownership

| Entity / Fact | Owner |
|---|---|
| Product / service definition | Catalog |
| Order / OrderLine | Commerce |
| Booking / Appointment | Booking |
| Payment / Refund | Billing / Commerce |
| Fulfillment execution | Fulfillment |
| Customer identity | Identity |
| Authorization | Authorization |
| Delivery message | Communications |
| Evidence media | Media |
| Derived metrics | Analytics |
| Recommendations / predictions | AI |

## 3. FulfillmentOrder

Canonical aggregate representing execution obligations originating from an authoritative commitment.

Fields:
- `id`
- `tenant_id`
- `workspace_id`
- `business_id`
- `source_type`
- `source_id`
- `status`
- `fulfillment_type`
- `plan_id`
- `created_at`
- `updated_at`
- `completed_at`
- `cancelled_at`

Invariant: source commercial or booking truth is referenced, not copied.

## 4. FulfillmentItem

Represents one executable fulfillment obligation.

Fields:
- `id`
- `fulfillment_id`
- `source_type`
- `source_id`
- `source_line_id`
- `quantity`
- `fulfillment_type`
- `status`
- `promised_from`
- `promised_to`
- `destination_ref`
- `service_location_ref`
- `assigned_actor_ref`
- `completion_evidence_ref`
- `exception_id`

Commercial price is not owned here.

## 5. FulfillmentPlan

Versioned execution plan.

Fields:
- `id`
- `fulfillment_id`
- `version`
- `status`
- `strategy`
- `created_by`
- `created_at`
- `activated_at`
- `supersedes_plan_id`

A historical plan remains reconstructable.

## 6. FulfillmentTask

Atomic operational work unit.

Fields:
- `id`
- `fulfillment_id`
- `fulfillment_item_id`
- `task_type`
- `status`
- `priority`
- `assigned_actor_ref`
- `scheduled_from`
- `scheduled_to`
- `started_at`
- `completed_at`
- `failure_reason_code`

Tasks do not become a second workflow engine.

## 7. FulfillmentAssignment

Records authorized operational assignment.

Fields:
- `id`
- `fulfillment_task_id`
- `actor_ref`
- `actor_type`
- `assigned_by`
- `assigned_at`
- `unassigned_at`
- `status`

Identity and authorization remain externally owned.

## 8. Shipment

Physical execution aggregate.

Fields:
- `id`
- `fulfillment_item_id`
- `carrier_ref`
- `service_level`
- `tracking_reference`
- `origin_ref`
- `destination_ref`
- `status`
- `dispatched_at`
- `delivered_at`
- `proof_of_delivery_ref`

Carrier-specific fields are adapter data, not canonical domain vocabulary.

## 9. ShipmentPackage

Physical package/container.

Fields:
- `id`
- `shipment_id`
- `package_reference`
- `package_type`
- `weight_ref`
- `dimensions_ref`
- `status`

A shipment may contain multiple packages.

## 10. TrackingEvent

Immutable normalized evidence from a carrier or operational source.

Fields:
- `id`
- `shipment_id`
- `event_type`
- `occurred_at`
- `received_at`
- `source`
- `external_event_id`
- `location_ref`
- `normalized_status`
- `provider_payload_ref`
- `event_version`
- `deduplication_key`

Events are append-only evidence; current shipment state is a derived operational projection.

## 11. DeliveryAttempt

Records an attempt to complete delivery.

Fields:
- `id`
- `shipment_id`
- `attempt_number`
- `attempted_at`
- `actor_ref`
- `status`
- `failure_reason_code`
- `evidence_ref`
- `next_action_ref`

## 12. ServiceDelivery

Execution record for a booked service.

Fields:
- `id`
- `fulfillment_item_id`
- `booking_ref`
- `provider_ref`
- `service_location_ref`
- `status`
- `scheduled_from`
- `scheduled_to`
- `started_at`
- `ended_at`
- `completion_id`
- `exception_id`

Booking remains authoritative for appointment truth.

## 13. ServiceCompletion

Authoritative evidence that a service obligation was completed.

Fields:
- `id`
- `service_delivery_id`
- `completed_by_actor_ref`
- `completed_at`
- `confirmation_type`
- `customer_confirmation_ref`
- `provider_confirmation_ref`
- `evidence_ref`
- `status`

For medical services, this records execution evidence only and never diagnosis or treatment authority.

## 14. DigitalDelivery

Controlled digital fulfillment record.

Fields:
- `id`
- `fulfillment_item_id`
- `entitlement_ref`
- `delivery_channel`
- `recipient_scope_ref`
- `issued_at`
- `expires_at`
- `delivery_status`
- `evidence_ref`

Secrets and private access tokens are not ordinary domain fields.

## 15. FulfillmentException

Operational issue requiring resolution.

Fields:
- `id`
- `fulfillment_id`
- `fulfillment_item_id`
- `exception_type`
- `severity`
- `status`
- `reason_code`
- `detected_at`
- `detected_by`
- `resolution_code`
- `resolved_at`
- `resolved_by`
- `rework_task_ref`

Resolution changes Fulfillment state only; upstream financial/order truth changes through owning capabilities.

## 16. FulfillmentStatusHistory

Immutable lifecycle evidence.

Fields:
- `id`
- `aggregate_type`
- `aggregate_id`
- `from_status`
- `to_status`
- `changed_by`
- `changed_at`
- `reason_code`
- `correlation_id`
- `policy_version`

No historical status row is overwritten.

## 17. CompletionEvidence

Logical evidence reference used by completion decisions.

Fields:
- `evidence_type`
- `evidence_ref`
- `source`
- `captured_at`
- `captured_by`
- `verification_status`
- `metadata_ref`

Evidence may be owned by Media or an external provider; Fulfillment references it.

## 18. State machines

### FulfillmentOrder
`PENDING → PLANNED → READY → IN_PROGRESS → PARTIALLY_COMPLETED → COMPLETED`

Terminal alternatives: `CANCELLED`, `FAILED`, `CLOSED`.

### Shipment
`DRAFT → READY → DISPATCHED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED`

Alternatives: `CANCELLED`, `RETURNED`, `LOST`, `FAILED`.

### ServiceDelivery
`SCHEDULED → READY → IN_PROGRESS → COMPLETED`

Alternatives: `CANCELLED`, `NO_SHOW`, `FAILED`, `REQUIRES_REWORK`.

## 19. Scope and tenancy

All tenant-owned entities carry or inherit authoritative:
- `tenant_id`
- `workspace_id`
- `business_id` where applicable
- location/resource references where applicable.

Cross-tenant references are invalid.

## 20. External provider normalization

Provider-specific data maps into:
`source → external_event_id → event_type → occurred_at → normalized_status`.

Duplicate and out-of-order events must remain safe to ingest.

## 21. Idempotency and correlation

Provider callbacks and command operations use:
- idempotency/deduplication key;
- external event identity;
- correlation ID;
- request ID;
- event version;
- received timestamp.

Repeated processing must not create duplicate completion or status transitions.

## 22. Capability references

Canonical Fulfillment capabilities are:
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

## 23. Event vocabulary

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

## 24. Data invariants

1. Fulfillment never owns product, order, booking, payment, or customer master data.
2. Completion requires appropriate authoritative evidence.
3. Tracking history is immutable.
4. Provider callbacks are idempotent.
5. Current state never replaces historical evidence.
6. Return logistics and financial refunds remain separate.
7. Booking owns appointment truth.
8. Commerce owns commercial commitment.
9. Billing owns financial settlement.
10. Authorization is centralized.
11. AI cannot fabricate or directly mutate fulfillment truth.
12. Vertical-specific fulfillment entities are forbidden.

## 25. Anti-duplication

There is one canonical data model for Beauty, Fashion, Medical, and future verticals. Differences are expressed through fulfillment type, configuration, policy, provider adapter, and regulated constraints.

## 26. Definition of Done

The data model is complete when every canonical fulfillment concept has defined ownership, identity, scope, lifecycle, evidence, integration references, and invariants, with no shadow copy of upstream domain truth.

## 27. Final decision

Phoenix uses one canonical Fulfillment & Service Delivery data model for physical, digital, service, and hybrid execution.