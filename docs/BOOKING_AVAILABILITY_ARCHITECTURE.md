# Phoenix Booking & Availability Architecture

## 1. Purpose

Booking converts a discovered offer into a controlled commitment between customer and provider. Availability determines what can actually be booked; Booking owns the reservation lifecycle.

## 2. Core Invariant

> Discovery can suggest a slot. Availability determines whether it is bookable. Booking atomically claims it. AI never guarantees a reservation.

## 3. Boundaries

- `catalog`: authoritative offer/service/product facts.
- `availability`: schedules, resources, capacity and bookable slots.
- `booking`: appointments/reservations and lifecycle.
- `business`: provider/location identity.
- `notifications`: reminders and transactional communication.
- `crm`: customer relationship history.
- `billing`: future payment/subscription concerns.
- `ai`: intent, recommendation and orchestration only.

No direct private-table access across these boundaries.

## 4. Booking Types

The model must support:

- appointment booking for services;
- reservation-style booking for resources;
- product reservation in future phases;
- configurable capacity for group services.

Do not force product checkout into appointment semantics.

## 5. Availability Model

Conceptual hierarchy:

```text
Provider / Business
  └── Location
      └── Resource / Staff / Room (optional)
          └── Schedule
              └── Rules / Exceptions
                  └── Bookable Slots
```

Availability may be derived rather than permanently materialized. Materialized slots are an optimization, not the authoritative business rule.

## 6. Time Model

Persist canonical instants in UTC.

Store or derive the relevant IANA timezone for the business/location.

User-facing local dates/times are rendered using the booking location timezone unless the business explicitly supports another convention.

Jalali dates are presentation/calendar adapters and must never replace canonical timestamps.

DST and timezone transitions must be tested.

## 7. Schedule Rules

A schedule can define:

- weekly recurring hours
- breaks
- holidays
- provider-specific exceptions
- location closures
- capacity
- lead time
- booking horizon
- minimum/maximum duration
- buffer before/after service

Exceptions override recurring rules according to deterministic precedence.

## 8. Slot Generation

Slot generation pipeline:

```text
catalog service
→ schedule rules
→ timezone normalization
→ exceptions/closures
→ duration + buffers
→ capacity constraints
→ existing commitments
→ bookable slot projection
```

Generated slots must carry a schedule/version reference so changes can invalidate stale projections.

## 9. Availability States

At minimum:

- `available`
- `held`
- `booked`
- `blocked`
- `expired`
- `unknown`

`unknown` must never be presented as available.

## 10. Holds

A short-lived hold prevents two customers from completing the same scarce slot concurrently.

A hold has:

- opaque ID
- tenant ID
- resource/slot ID
- actor/session reference
- expiration timestamp
- creation/version metadata

Expired holds must become reclaimable automatically.

Do not create long-lived holds merely to improve UX.

## 11. Concurrency

Booking correctness requires an atomic finalization path.

Conceptual flow:

```text
request
→ authenticate
→ tenant context
→ permission/policy
→ re-read authoritative availability
→ transaction
→ verify capacity/version
→ create booking
→ consume/reduce capacity
→ write audit + outbox
→ commit
```

The operation must fail safely when another booking wins the race.

Use optimistic versioning or an equivalent transactional concurrency mechanism; never trust a client-provided availability result.

## 12. Booking State Machine

```text
requested
  ↓
pending_confirmation
  ↓
confirmed
  ├── rescheduled
  ├── cancelled
  ├── completed
  └── no_show
```

Provider/customer cancellation policies must be explicit and versioned.

Terminal states must not be silently reopened.

## 13. Confirmation

A booking is `confirmed` only after the authoritative booking service commits it.

AI, UI optimistic state, cached availability and external messages cannot establish confirmation.

## 14. Rescheduling

Rescheduling is a controlled transition, not a mutable timestamp update.

It must:

1. authorize the actor;
2. validate cancellation/reschedule policy;
3. verify target availability;
4. atomically release old capacity and claim new capacity;
5. record an audit event;
6. emit a versioned event.

## 15. Cancellation and No-show

Policies should support:

- customer cancellation window
- provider cancellation
- late cancellation
- no-show classification
- optional fee/reference to future billing

No financial charge is executed by Booking unless a future billing contract explicitly authorizes it.

## 16. Idempotency

Mutation endpoints must accept an idempotency key for retryable client operations.

The same authenticated actor + tenant + idempotency key must not create duplicate bookings.

Store sufficient request/result metadata to safely replay a successful result or return the original outcome.

## 17. Authorization

Representative permissions:

- `availability.read`
- `availability.manage`
- `booking.read`
- `booking.create`
- `booking.manage`
- `booking.cancel`
- `booking.reschedule`
- `booking.confirm`
- `booking.complete`
- `booking.review`

Resource policies must also verify ownership/access to the relevant business, location, service and booking.

## 18. AI Boundary

AI may:

- interpret natural-language scheduling intent;
- find candidate dates/times;
- explain availability;
- prepare a booking request;
- ask for missing required details.

AI may not:

- invent availability;
- confirm a booking without domain confirmation;
- bypass permissions;
- alter cancellation policy;
- directly write booking tables;
- claim payment success without authoritative billing confirmation.

For side-effectful booking actions, explicit user confirmation should be required unless a separately approved product workflow defines otherwise.

## 19. API Contract

Representative endpoints:

```text
GET  /api/v1/availability/services/:serviceId
GET  /api/v1/availability/services/:serviceId/slots
POST /api/v1/booking/holds
POST /api/v1/booking
GET  /api/v1/booking/:id
POST /api/v1/booking/:id/confirm
POST /api/v1/booking/:id/cancel
POST /api/v1/booking/:id/reschedule
POST /api/v1/booking/:id/complete
POST /api/v1/booking/:id/no-show
```

All request bodies and query parameters are schema validated.

## 20. Events

Examples:

```text
availability.slot.updated.v1
availability.schedule.changed.v1
booking.hold.created.v1
booking.hold.expired.v1
booking.created.v1
booking.confirmed.v1
booking.cancelled.v1
booking.rescheduled.v1
booking.completed.v1
booking.no_show.v1
```

Outbox publication must occur transactionally with the authoritative mutation.

## 21. Notifications

Booking emits domain events. Notifications consumes them.

Booking must not contain WhatsApp/email/SMS provider implementations.

Notification delivery is eventually consistent and independently retryable.

## 22. Customer Experience

The UI should distinguish:

- `recommended time`
- `available time`
- `held`
- `confirmed`
- `pending`
- `unavailable`

Never show a recommendation as a confirmed appointment.

## 23. Privacy

Booking records may contain personal information. Access is least-privilege and tenant-scoped.

Sensitive medical context should not be copied into ordinary booking notes unless necessary, consented and policy-approved.

For medical bookings, the platform should store the minimum information required for scheduling and operations.

## 24. Internationalization

Booking supports:

- locale
- IANA timezone
- currency reference where relevant
- country policy adapter
- localized calendar display
- RTL/LTR UI

Core booking semantics remain country-neutral; regulated rules belong to policy adapters.

## 25. Caching

Availability caches must be short-lived and clearly non-authoritative.

Cache keys include tenant, service/resource, timezone/context and schedule/index version.

Final booking always revalidates authoritative state.

## 26. Performance Targets

Initial targets:

- availability read p95: < 300 ms under normal load;
- booking mutation p95: < 500 ms excluding external notifications;
- notification delivery: asynchronous;
- slot generation: cached/materialized where profiling demonstrates value.

Do not prematurely introduce a distributed lock service. Start with D1 transactional guarantees and carefully scoped coordination primitives; add stronger coordination only when measured contention requires it.

## 27. Failure Handling

If availability cannot be authoritatively checked, do not create a confirmed booking.

If outbox delivery fails after commit, the booking remains valid and the event is retried.

If notification fails, booking state is unaffected.

If an external integration later fails, expose the failure as an integration state rather than rolling back an already committed internal booking unless the contract explicitly requires atomic external confirmation.

## 28. Testing

Required tests:

- timezone/DST boundaries
- Jalali presentation
- recurring schedule calculation
- exceptions/closures
- capacity
- concurrent booking race
- hold expiration
- idempotent retry
- cancellation/reschedule policy
- authorization and tenant isolation
- stale availability rejection
- event/outbox delivery
- notification failure isolation
- medical privacy boundaries

Load tests must include high contention for a single popular slot.

## 29. Implementation Order

1. Availability domain contracts
2. Schedule/rule engine
3. Slot calculation
4. Booking state machine
5. Transactional finalization
6. Holds + idempotency
7. Events/outbox
8. Customer/provider APIs
9. Notifications integration
10. AI scheduling tools
11. Beauty appointment pilot
12. Fashion/product reservation only if justified by business requirements

## 30. Definition of Done

Booking is production-ready only when:

- authoritative availability is revalidated at commit;
- concurrent booking cannot create over-capacity commitments;
- state transitions are explicit and auditable;
- mutations are idempotent;
- all access is tenant- and permission-controlled;
- notifications are decoupled;
- AI cannot claim or create confirmation independently;
- timezone/DST/Jalali behavior is tested;
- stale caches cannot establish booking truth;
- outbox events are transactional and idempotent.
