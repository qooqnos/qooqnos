# Phoenix Commerce Transaction Engine — Data Dictionary

**Status:** Architecture defined / frozen  
**Owner:** Commerce

## Canonical entities

Cart, CartLine, CheckoutSession, PriceSnapshot, Order, OrderLine, OrderAdjustment, TransactionAttempt, FulfillmentReference, Cancellation, RefundReference, OrderEvent.

## Ownership

Commerce owns cart, checkout, order and transaction orchestration. Catalog owns product/service identity and base price. Promotion owns promotion policy. Loyalty owns loyalty value. Booking owns reservations. Billing/Payment owns money and financial settlement. Authorization owns capability enforcement. Analytics owns measurement.

## Core invariants

1. Cart is mutable intent; Order is committed Commerce truth.
2. Checkout revalidates external authoritative facts before commitment.
3. Order snapshots preserve commercial evidence and policy/version references.
4. External domain facts are referenced, not duplicated.
5. Idempotency prevents duplicate transaction side effects.
6. Payment and fulfillment status remain separate dimensions.
7. UI and AI cannot independently calculate or authorize final transaction truth.
8. No BeautyOrder, FashionOrder or MedicalOrder variants are permitted.

## Canonical fields

Cart: `cart_id`, `actor_id`, `tenant_id`, `workspace_id`, `cart_status`, `currency`, `version`, `expires_at`.

CartLine: `cart_line_id`, `cart_id`, `resource_type`, `resource_id`, `variant_reference`, `quantity`, `selected_options`.

CheckoutSession: `checkout_session_id`, `cart_id`, `session_status`, `idempotency_key`, `correlation_id`, external catalog/promotion/loyalty/booking/payment references, failure code and timestamps.

PriceSnapshot: `price_snapshot_id`, `currency`, line snapshots, subtotal, adjustments, taxes, fees, grand total, catalog/promotion/loyalty version references, policy version, calculation timestamp and context hash.

Order: `order_id`, tenant/workspace/business/customer references, `order_status`, currency, committed totals, payment/fulfillment status references, source channel, policy version, idempotency/correlation identifiers and lifecycle timestamps.

OrderLine: resource identity/version, description snapshot, quantity, unit price, line totals, promotion/loyalty/booking/fulfillment references.

OrderAdjustment: type, source module/reference, amount, currency and policy version.

TransactionAttempt: type, status, idempotency key, provider reference, timestamps, failure code and correlation ID. Raw payment credentials never belong in Commerce.

FulfillmentReference: fulfillment type plus explicit external module/reference and status reference.

Cancellation: order, actor, reason, policy version, decision, effective time and correlation ID.

RefundReference: order, requested amount/currency, reason, Billing reference, refund status and timestamps.

OrderEvent: event ID/type/version, aggregate identity, tenant/workspace scope, actor/source, timestamps, correlation/causation IDs and provenance.

## Lifecycle

Cart: active / expired / converted / abandoned.  
Checkout: started / validating / committed / failed / expired.  
Order: draft / pending_confirmation / pending_payment / confirmed / in_fulfillment / completed / cancelled / refund_pending / refunded.

## Decision

This is the single canonical Commerce data dictionary. Future changes require a module-level ADR. Every vertical reuses this vocabulary and the single Commerce transaction engine.