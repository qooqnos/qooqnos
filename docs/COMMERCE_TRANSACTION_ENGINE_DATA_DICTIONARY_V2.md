# Phoenix Commerce Transaction Engine — Data Dictionary

**Status:** Architecture defined / frozen  
**Owner:** Commerce

## Canonical Entities

Cart, CartLine, CheckoutSession, PriceSnapshot, Order, OrderLine, OrderAdjustment, TransactionAttempt, FulfillmentReference, Cancellation, RefundReference, OrderEvent.

## Cart

`cart_id`, `actor_id`, `tenant_id`, `workspace_id`, `cart_status`, `currency`, `version`, `expires_at`.

CartLine: `cart_line_id`, `cart_id`, `resource_type`, `resource_id`, `variant_reference`, `quantity`, `selected_options`, `source_reference`, `created_at`, `updated_at`.

Cart is mutable intent. Catalog owns referenced resource identity and base-price facts.

## CheckoutSession

`checkout_session_id`, `cart_id`, `session_status`, `idempotency_key`, `correlation_id`, `catalog_snapshot_refs`, `promotion_qualification_refs`, `loyalty_benefit_refs`, `booking_reservation_refs`, `payment_attempt_ref`, `failure_code`, `started_at`, `completed_at`.

Checkout revalidates authoritative external facts before commitment.

## PriceSnapshot

`price_snapshot_id`, `currency`, `line_snapshots`, `subtotal`, `adjustment_total`, `tax_total`, `fee_total`, `grand_total`, `catalog_version_refs`, `promotion_version_refs`, `loyalty_version_refs`, `policy_version`, `calculated_at`, `calculation_context_hash`.

It preserves approved commercial evidence and is not a second pricing engine.

## Order

`order_id`, `tenant_id`, `workspace_id`, `business_id`, `customer_id`, `order_status`, `currency`, `subtotal`, `adjustment_total`, `tax_total`, `fee_total`, `grand_total`, `payment_status_ref`, `fulfillment_status_ref`, `source_channel`, `policy_version`, `idempotency_key`, `correlation_id`, `created_at`, `confirmed_at`, `completed_at`.

Order is the canonical Commerce aggregate after checkout.

## OrderLine

`order_line_id`, `order_id`, `resource_type`, `resource_id`, `resource_version`, `variant_reference`, `description_snapshot`, `quantity`, `unit_price_snapshot`, `line_subtotal`, `line_adjustment_total`, `line_total`, `promotion_reference`, `loyalty_reference`, `booking_reference`, `fulfillment_reference`.

Committed line snapshots are immutable.

## OrderAdjustment

`adjustment_id`, `order_id`, `order_line_id`, `adjustment_type`, `source_module`, `source_reference`, `amount`, `currency`, `policy_version`, `created_at`.

Commerce records applied commercial effects while Promotion/Loyalty remain authoritative for their policies.

## TransactionAttempt

`transaction_attempt_id`, `order_id`, `attempt_type`, `attempt_status`, `idempotency_key`, `provider_reference`, `requested_at`, `completed_at`, `failure_code`, `correlation_id`.

Raw payment credentials never belong in Commerce.

## FulfillmentReference

`fulfillment_reference_id`, `order_id`, `order_line_id`, `fulfillment_type`, `external_module`, `external_reference`, `status_reference`, `created_at`, `updated_at`.

Booking remains authoritative for appointment reservations; other fulfillment authorities are referenced explicitly.

## Cancellation

`cancellation_id`, `order_id`, `requested_by`, `reason_code`, `policy_version`, `decision`, `effective_at`, `correlation_id`, `created_at`.

Cancellation never erases order or payment history.

## RefundReference

`refund_reference_id`, `order_id`, `requested_amount`, `currency`, `reason_code`, `billing_reference`, `refund_status`, `requested_at`, `completed_at`, `correlation_id`.

Billing/Payment owns financial refund execution; Commerce owns the relationship to the process.

## OrderEvent

Every authoritative event carries `event_id`, `event_type`, `event_version`, `aggregate_type`, `aggregate_id`, tenant/workspace scope, actor/source, `occurred_at`, `correlation_id`, `causation_id`, provenance and payload references.

## Lifecycle

Cart: active / expired / converted / abandoned.  
Checkout: started / validating / committed / failed / expired.  
Order: draft / pending_confirmation / pending_payment / confirmed / in_fulfillment / completed / cancelled / refund_pending / refunded.

Payment and fulfillment status are separate dimensions.

## Ownership

| Data | Canonical Owner |
|---|---|
| Customer identity | Identity/Customer |
| Business identity | Business/Onboarding |
| Product/service | Catalog |
| Base price | Catalog |
| Promotion policy | Promotion |
| Loyalty value | Loyalty |
| Booking/reservation | Booking |
| Cart/checkout/order | Commerce |
| Money/payment/refund execution | Billing/Payment |
| Fulfillment state | Fulfillment/Booking |
| Communications | Communications |
| Analytics | Analytics |
| Authorization | Authorization |

## Core Invariants

1. Cart is mutable intent; Order is committed Commerce truth.
2. Checkout revalidates external facts before commitment.
3. Order snapshots preserve commercial evidence.
4. External domain facts are referenced, not duplicated.
5. Idempotency prevents duplicate transaction side effects.
6. Projections never replace transaction history.
7. UI and AI cannot independently calculate or authorize final transaction truth.
8. No BeautyOrder, FashionOrder or MedicalOrder variants are permitted.
9. Specialized modules retain authority over their own facts.

## Decision

This is the canonical Commerce transaction data dictionary. Future changes require a module-level ADR. Every vertical reuses this vocabulary and the single Commerce transaction engine.