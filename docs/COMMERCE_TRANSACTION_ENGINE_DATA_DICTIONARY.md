# Phoenix Commerce Transaction Engine — Data Dictionary

**Status:** Architecture defined / frozen  
**Owner:** Commerce

## 1. Purpose

This dictionary defines the canonical data vocabulary for Cart, Checkout, Order and transaction orchestration. Commerce owns transaction truth but does not duplicate Catalog, Booking, Billing/Payment, Loyalty or Promotion facts.

## 2. Cart

| Field | Meaning | Owner |
|---|---|---|
| `cart_id` | Stable cart identifier | Commerce |
| `actor_id` | Customer/actor reference | Identity |
| `tenant_id` | Tenant scope | Scope/Authorization |
| `workspace_id` | Workspace scope where applicable | Scope/Authorization |
| `cart_status` | active / expired / converted / abandoned | Commerce |
| `currency` | Checkout currency context | Commerce policy |
| `version` | Optimistic concurrency version | Commerce |
| `expires_at` | Cart expiration | Commerce |

### CartLine

- `cart_line_id`
- `cart_id`
- `resource_type`
- `resource_id`
- `variant_reference`
- `quantity`
- `selected_options`
- `source_reference`
- `created_at`
- `updated_at`

`resource_id` points to Catalog-owned goods/services. Cart data is intent, not final commercial truth.

## 3. Checkout Session

| Field | Meaning | Owner |
|---|---|---|
| `checkout_session_id` | Stable checkout attempt identifier | Commerce |
| `cart_id` | Source cart | Commerce |
| `session_status` | started / validating / committed / failed / expired | Commerce |
| `idempotency_key` | Duplicate-prevention key | Commerce |
| `correlation_id` | Cross-module trace identifier | Platform |
| `catalog_snapshot_refs` | Validated catalog references/versions | Catalog reference |
| `promotion_qualification_refs` | Approved promotion decisions | Promotion |
| `loyalty_benefit_refs` | Approved loyalty benefits | Loyalty |
| `booking_reservation_refs` | Reservation references where required | Booking |
| `payment_attempt_ref` | Payment attempt reference | Billing/Payment |
| `failure_code` | Stable failure classification | Commerce |
| `started_at` | Start timestamp | Commerce |
| `completed_at` | Completion timestamp | Commerce |

## 4. Price Snapshot

A PriceSnapshot is the immutable commercial evidence used by the order.

Fields:

- `price_snapshot_id`
- `currency`
- `line_snapshots`
- `subtotal`
- `adjustment_total`
- `tax_total`
- `fee_total`
- `grand_total`
- `catalog_version_refs`
- `promotion_version_refs`
- `loyalty_version_refs`
- `policy_version`
- `calculated_at`
- `calculation_context_hash`

The snapshot records approved results and provenance; it does not become a second pricing engine.

## 5. Order

| Field | Meaning | Owner |
|---|---|---|
| `order_id` | Stable canonical order identifier | Commerce |
| `tenant_id` | Tenant scope | Scope |
| `workspace_id` | Workspace scope | Scope |
| `business_id` | Seller/business reference | Business |
| `customer_id` | Canonical customer reference | Identity/Customer |
| `order_status` | Commerce lifecycle state | Commerce |
| `currency` | Order currency | Commerce |
| `subtotal` | Approved line subtotal | Commerce snapshot |
| `adjustment_total` | Approved commercial adjustments | Commerce snapshot |
| `tax_total` | Approved tax amount/reference | Commerce/Billing policy |
| `fee_total` | Approved fee amount/reference | Commerce/Billing policy |
| `grand_total` | Final committed commercial total | Commerce snapshot |
| `payment_status_ref` | Payment state reference | Billing/Payment |
| `fulfillment_status_ref` | Fulfillment state reference | Fulfillment/Booking |
| `source_channel` | web / app / agent / API / AI-tool | Commerce |
| `policy_version` | Policy set used | Commerce |
| `idempotency_key` | Creation command key | Commerce |
| `correlation_id` | Cross-module trace | Platform |
| `created_at` | Creation timestamp | Commerce |
| `confirmed_at` | Confirmation timestamp | Commerce |
| `completed_at` | Completion timestamp | Commerce |

## 6. OrderLine

- `order_line_id`
- `order_id`
- `resource_type`
- `resource_id`
- `resource_version`
- `variant_reference`
- `description_snapshot`
- `quantity`
- `unit_price_snapshot`
- `line_subtotal`
- `line_adjustment_total`
- `line_total`
- `promotion_reference`
- `loyalty_reference`
- `booking_reference`
- `fulfillment_reference`

The descriptive and commercial snapshot is immutable after order commitment.

## 7. OrderAdjustment

| Field | Meaning |
|---|---|
| `adjustment_id` | Stable adjustment identifier |
| `order_id` | Parent order |
| `order_line_id` | Optional affected line |
| `adjustment_type` | promotion / loyalty / fee / tax / manual-approved |
| `source_module` | Module supplying authority |
| `source_reference` | Qualification/benefit/policy reference |
| `amount` | Signed monetary effect |
| `currency` | Adjustment currency |
| `policy_version` | Policy used |
| `created_at` | Creation timestamp |

## 8. Transaction Attempt

- `transaction_attempt_id`
- `order_id`
- `attempt_type`
- `attempt_status`
- `idempotency_key`
- `provider_reference`
- `requested_at`
- `completed_at`
- `failure_code`
- `correlation_id`

Raw payment credentials are never stored here.

## 9. Fulfillment Reference

- `fulfillment_reference_id`
- `order_id`
- `order_line_id`
- `fulfillment_type`
- `external_module`
- `external_reference`
- `status_reference`
- `created_at`
- `updated_at`

For appointments, `external_module=Booking`; for delivery/service fulfillment, the appropriate fulfillment authority is referenced.

## 10. Cancellation

- `cancellation_id`
- `order_id`
- `requested_by`
- `reason_code`
- `policy_version`
- `decision`
- `effective_at`
- `correlation_id`
- `created_at`

Cancellation does not erase the order or payment history.

## 11. Refund Reference

Commerce records the relationship between the order and a refund request/result; Billing/Payment owns financial execution.

Fields:

- `refund_reference_id`
- `order_id`
- `requested_amount`
- `currency`
- `reason_code`
- `billing_reference`
- `refund_status`
- `requested_at`
- `completed_at`
- `correlation_id`

## 12. Order Event

Every authoritative event carries:

- `event_id`
- `event_type`
- `event_version`
- `aggregate_type`
- `aggregate_id`
- `tenant_id`
- `workspace_id`
- `actor_reference`
- `source`
- `occurred_at`
- `correlation_id`
- `causation_id`
- `provenance_reference`
- `payload_reference`

## 13. Lifecycle Vocabulary

**Cart:** `active`, `expired`, `converted`, `abandoned`  
**Checkout:** `started`, `validating`, `committed`, `failed`, `expired`  
**Order:** `draft`, `pending_confirmation`, `pending_payment`, `confirmed`, `in_fulfillment`, `completed`, `cancelled`, `refund_pending`, `refunded`

Payment and fulfillment statuses remain separate dimensions.

## 14. Core Invariants

1. Cart is mutable intent; Order is committed commerce truth.
2. Checkout revalidates external facts before commitment.
3. Order snapshots preserve the commercial evidence used at commitment.
4. Catalog remains authoritative for resource/base-price facts.
5. Promotion remains authoritative for promotion policy.
6. Loyalty remains authoritative for loyalty value.
7. Booking remains authoritative for reservation state.
8. Billing/Payment remains authoritative for money and financial settlement.
9. Refund references do not become a second financial ledger.
10. Counters/projections never replace immutable transaction history.
11. Idempotency prevents duplicate transaction side effects.
12. AI and UI never independently calculate or authorize final transaction truth.
13. No BeautyOrder/FashionOrder/MedicalOrder variants are permitted.
14. Cross-module facts are referenced, not duplicated as competing sources of truth.

## 15. Ownership Matrix

| Data | Canonical Owner |
|---|---|
| Customer identity | Identity/Customer |
| Business identity | Business/Onboarding |
| Product/service | Catalog |
| Base price | Catalog |
| Promotion policy | Promotion |
| Loyalty points/rewards | Loyalty |
| Booking/reservation | Booking |
| Order/cart/checkout | Commerce |
| Money/payment/refund execution | Billing/Payment |
| Fulfillment state | Fulfillment/Booking |
| Communication delivery | Communications |
| Analytics/metrics | Analytics |
| Authorization | Authorization |

## 16. Canonical References

Commerce records stable references to external authoritative entities and versions. Reference loss, staleness, or invalidation must result in an explicit validation failure or compensating flow, never silent substitution.

## 17. Decision

This is the canonical Commerce transaction data dictionary. Future changes require a module-level ADR. Any new vertical must reuse these entities and contracts rather than creating a second commerce vocabulary.