# Phoenix Commerce Transaction Engine Architecture

> Status: Architecture baseline
> Scope: cart, checkout, order lifecycle, transaction orchestration, pricing snapshot, fulfillment handoff, cancellation/refund boundaries, and commerce events.

## 1. Purpose

Commerce is the canonical business transaction boundary for goods and paid services. It converts an approved commercial intent into an auditable order and coordinates payment, inventory, booking, promotion, and fulfillment without owning those domains.

Governing rule:

**Commerce owns transaction truth; specialized modules own their own facts.**

Commerce must not become Catalog, Billing/Payment, Booking, Loyalty, Promotion, CRM, Communications, or Fulfillment.

## 2. Architectural Position

```text
Customer / Business / AI
          |
          v
   Commerce Application API
          |
          v
     Cart / Checkout
          |
          v
   Transaction Orchestrator
     /    |      |      \
    /     |      |       \
 Catalog Promotion Loyalty Booking
    \     |      |       /
     \    |      |      /
          v
      Order Aggregate
          |
    +-----+------+
    |            |
 Billing/Payment Fulfillment
    |            |
    +-----+------+
          |
          v
       Events
```

## 3. Ownership Boundaries

- **Catalog:** product/service identity, published base price, options, inventory facts.
- **Promotion:** promotion policy, qualification, benefit calculation inputs.
- **Loyalty:** points, rewards, membership benefits.
- **Booking:** appointment/resource reservation facts for bookable services.
- **Billing/Payment:** invoices, payment instruments, settlement, refunds and financial ledger.
- **Commerce:** cart, checkout attempt, order, order lines, commercial snapshot, transaction state, and orchestration evidence.
- **Fulfillment:** delivery/service fulfillment state when that module exists.
- **CRM:** customer relationship history.
- **Communications:** message delivery.
- **AI:** discovery, explanation and bounded recommendations; never authoritative transaction mutation.

## 4. Canonical Concepts

- Cart
- CartLine
- CheckoutSession
- PriceSnapshot
- Order
- OrderLine
- OrderAdjustment
- TransactionAttempt
- FulfillmentReference
- Cancellation
- Return/RefundReference
- OrderEvent

Commerce records references to external authoritative facts rather than duplicating their domain state.

## 5. Value and Truth Model

```text
Catalog Base Price ---------> Commerce Price Snapshot
Promotion Benefit -----------> Commerce Adjustment
Loyalty Reward/Points -------> Commerce Benefit Reference
Tax/Fee Policy --------------> Billing/Commerce policy reference
Money -----------------------> Billing/Payment
Inventory -------------------> Catalog/Inventory
Appointment -----------------> Booking
Order -----------------------> Commerce
```

An order stores the commercial snapshot required to explain what was purchased and under which approved policies. It does not replace the source-of-truth records of other modules.

## 6. Cart

Cart is mutable pre-order intent.

Required invariants:

- scoped to actor/tenant/workspace as applicable;
- every line references a canonical catalog resource;
- quantity and option constraints are policy-validated;
- prices are revalidated at checkout;
- stale catalog, promotion, loyalty, or booking facts cannot silently become final order facts;
- cart mutations are idempotent where retries are possible.

Cart expiration is policy-driven and must never imply an order.

## 7. Checkout

Checkout is a controlled transition from mutable intent to an order candidate.

Canonical sequence:

1. authenticate actor and establish tenant/workspace scope;
2. load cart and validate ownership;
3. revalidate catalog/resource state;
4. obtain applicable promotion qualification;
5. obtain applicable loyalty benefit reference;
6. validate booking/resource constraints when applicable;
7. calculate the commercial snapshot;
8. create checkout attempt with idempotency key;
9. create order atomically with the approved snapshot;
10. initiate payment through Billing/Payment when required;
11. emit authoritative order events;
12. hand off fulfillment/booking work through explicit contracts.

UI and AI must never independently calculate the final payable amount.

## 8. Order Aggregate

Order is the canonical commerce aggregate after checkout.

Minimum conceptual data:

- stable order identifier;
- tenant/workspace/business scope;
- customer reference;
- currency;
- order status;
- line snapshots;
- subtotal;
- adjustments;
- taxes/fees references or approved values;
- total;
- payment status reference;
- fulfillment status reference;
- source/channel;
- applied policy/version references;
- idempotency and correlation identifiers;
- created/updated timestamps;
- audit/provenance references.

Order totals are immutable after the transaction reaches its defined commitment point. Later changes use explicit amendment/cancellation/refund flows.

## 9. Order Lifecycle

```text
DRAFT
  -> PENDING_CONFIRMATION
  -> PENDING_PAYMENT
  -> CONFIRMED
  -> IN_FULFILLMENT
  -> COMPLETED

Alternative terminal paths:
PENDING_* -> CANCELLED
CONFIRMED -> CANCELLED
CONFIRMED -> REFUND_PENDING -> REFUNDED
```

Exact states may be extended by module ADRs, but state meaning must remain deterministic and versioned.

Payment state and fulfillment state are separate dimensions. An order must not overload one status field to represent both.

## 10. Transaction Orchestration

Commerce coordinates cross-module work through typed application contracts.

The orchestrator must provide:

- deterministic step ordering;
- idempotency;
- retry-safe transitions;
- compensation for partial external work;
- correlation IDs;
- audit evidence;
- explicit failure states;
- concurrency protection.

Distributed rollback is not assumed. Each participating module remains authoritative for its own successful side effect, with compensation where supported.

## 11. Payment Boundary

Commerce may request payment authorization/capture through Billing/Payment.

Commerce must not store raw payment credentials or implement its own financial ledger.

Payment success alone does not mean fulfillment success. Payment and fulfillment transitions are independently observable.

## 12. Booking Boundary

For bookable services, Booking remains authoritative for slot/resource reservation. Commerce references the reservation and coordinates order commitment.

A booking conflict must fail or compensate the commerce transaction according to an explicit policy; it must never be hidden by the AI or UI layer.

## 13. Promotion and Loyalty Boundary

Promotion returns an approved qualification/benefit reference. Loyalty returns an approved reward/benefit reference.

Commerce records the applied commercial effect in the order snapshot for auditability, while the originating module remains authoritative for the policy itself.

## 14. Cancellation, Amendment and Refund

Cancellation is a commerce decision governed by policy and lifecycle state.

- cancellation does not directly erase payment history;
- refund execution belongs to Billing/Payment;
- booking release belongs to Booking;
- inventory release belongs to Catalog/Inventory;
- loyalty reversal belongs to Loyalty;
- promotion usage reversal belongs to Promotion where applicable.

Every compensation is linked to the originating order and correlation chain.

## 15. Idempotency and Concurrency

Checkout, order creation, payment initiation, cancellation, and other externally retriable commands require idempotency keys.

The same logical command must not create duplicate orders or duplicate financial/fulfillment side effects.

Concurrency controls must protect:

- checkout commitment;
- order transitions;
- limited inventory/resources;
- promotion reservations;
- booking reservations.

## 16. Security and Authorization

Every commerce command passes Authorization before domain execution.

Authorization determines who may perform an operation; Commerce determines whether the operation is valid for the order lifecycle.

Sensitive payment data stays outside Commerce. Customer data is referenced through canonical identity/customer records and exposed according to consent and authorization policy.

## 17. AI Boundary

AI may:

- discover products/services;
- explain an order;
- suggest alternatives;
- summarize checkout information;
- propose a bounded cart mutation through an authorized tool.

AI may not:

- invent price, availability, promotion or payment status;
- bypass checkout validation;
- create authoritative orders through direct persistence;
- override authorization, policy, or lifecycle transitions;
- claim payment or fulfillment success without authoritative evidence.

## 18. Events

Canonical event families:

- `commerce.cart.created`
- `commerce.cart.updated`
- `commerce.checkout.started`
- `commerce.checkout.failed`
- `commerce.order.created`
- `commerce.order.confirmed`
- `commerce.order.cancelled`
- `commerce.order.completed`
- `commerce.order.refund_requested`
- `commerce.order.refunded`
- `commerce.fulfillment.updated`

Events carry stable entity IDs, tenant/workspace scope, actor/source, event version, timestamp, correlation ID, and provenance reference.

## 19. Data Model Outline

Canonical persistence boundary:

- `commerce_carts`
- `commerce_cart_lines`
- `commerce_checkout_sessions`
- `commerce_price_snapshots`
- `commerce_orders`
- `commerce_order_lines`
- `commerce_order_adjustments`
- `commerce_transaction_attempts`
- `commerce_fulfillment_references`
- `commerce_cancellations`
- `commerce_refund_references`
- `commerce_order_events`

No vertical-specific commerce tables such as BeautyOrder or FashionOrder are permitted. Vertical behavior is represented through referenced catalog/resource types and policy configuration.

## 20. Canonical Capabilities

- `CAP.COMMERCE.CART.CREATE`
- `CAP.COMMERCE.CART.UPDATE`
- `CAP.COMMERCE.CART.GET`
- `CAP.COMMERCE.CART.CLEAR`
- `CAP.COMMERCE.CHECKOUT.START`
- `CAP.COMMERCE.CHECKOUT.CONFIRM`
- `CAP.COMMERCE.ORDER.CREATE`
- `CAP.COMMERCE.ORDER.GET`
- `CAP.COMMERCE.ORDER.CANCEL`
- `CAP.COMMERCE.ORDER.AMEND`
- `CAP.COMMERCE.ORDER.REQUEST_REFUND`
- `CAP.COMMERCE.ORDER.COMPLETE`

Authorization owns capability enforcement; Commerce owns business validity.

## 21. Cross-Module Reuse Rule

There is exactly one Commerce transaction engine.

Beauty, Fashion, Medical, and future verticals reuse the same cart, checkout, order, orchestration, idempotency, audit, and event mechanisms. Vertical-specific rules remain configuration/policy at the appropriate domain boundary.

## 22. Architectural Decision

Commerce is the canonical transaction orchestration module for Phoenix Marketplace. Billing/Payment remains the canonical financial authority; Booking remains the canonical reservation authority; Catalog remains the canonical resource/price authority; Loyalty and Promotion remain the canonical benefit/policy authorities.

This architecture is frozen as the baseline. Future changes require module-level ADRs and must not introduce a duplicate transaction engine.