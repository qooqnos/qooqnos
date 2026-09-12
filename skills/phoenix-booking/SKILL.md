# Phoenix Booking Skill

## Mission

Implement booking and availability as deterministic transactional domain capabilities. Booking must never rely on AI, cached search results, or client state for final correctness.

## Read First

- `CLAUDE.md`
- `docs/PHOENIX_ARCHITECTURE.md`
- `docs/MODULE_ARCHITECTURE.md`
- `docs/CORE_RUNTIME_ARCHITECTURE.md`
- `docs/AUTHORIZATION_ARCHITECTURE.md`
- `docs/SECURITY_ARCHITECTURE.md`
- `docs/AI_ARCHITECTURE.md`
- `docs/DISCOVERY_MATCHING_ARCHITECTURE.md`
- `docs/CATALOG_SERVICE_PRODUCT_ARCHITECTURE.md`
- `docs/BOOKING_AVAILABILITY_ARCHITECTURE.md`

## Non-Negotiables

1. Availability is authoritative only in the Availability domain.
2. Booking is authoritative only after transactional commit.
3. Never trust client availability or cached availability at finalization.
4. AI cannot confirm a booking independently.
5. Every mutation is authenticated, tenant-scoped and permission-checked.
6. Use idempotency keys for retryable booking mutations.
7. UTC instants are canonical; IANA timezone governs local rendering/rules.
8. Jalali is a calendar adapter, not the persistence time model.
9. Notifications are asynchronous consumers of booking events.
10. Never introduce a distributed lock merely as a first solution; measure contention first.
11. Never expose arbitrary SQL or direct private-table access to AI/UI layers.
12. Medical booking stores only the minimum necessary information and never turns booking into clinical decision support.

## Module Shape

```text
modules/booking/
├── manifest.ts
├── domain/
│   ├── booking/
│   ├── availability/
│   ├── holds/
│   └── policies/
├── application/
├── infrastructure/
├── api/
├── events/
├── jobs/
├── tests/
└── README.md
```

## Implementation Workflow

### 1. Define State Machines

Document booking and availability states before writing handlers.

### 2. Define Schedule Rules

Make recurrence, breaks, exceptions, capacity, buffers, lead time and booking horizon deterministic.

### 3. Calculate Candidate Slots

Use location timezone and schedule version. Treat generated availability as a projection that must be revalidated.

### 4. Implement Transactional Finalization

```text
actor
→ auth
→ tenant
→ permission/policy
→ authoritative availability read
→ transaction
→ concurrency/version check
→ booking + capacity update
→ audit + outbox
→ commit
```

### 5. Add Idempotency

Persist the actor/tenant/idempotency key relationship and original result sufficiently to safely retry.

### 6. Add Holds

Use short TTL holds only where contention/UX requires them. Expiration must be deterministic.

### 7. Emit Events

Use transactional outbox and idempotent consumers.

## Time Rules

Always test:

- timezone conversion
- DST spring/fall transitions
- midnight boundaries
- recurring schedules crossing local dates
- Persian/Jalali presentation

Never persist a Jalali date in place of the canonical instant when the event represents an actual point in time.

## AI Integration

AI can call tools such as:

```text
availability.findSlots
booking.prepare
booking.create
booking.cancel
booking.reschedule
```

Tool execution must pass through normal permission/resource-policy/domain-service checks.

For booking creation, require explicit confirmation for side effects unless a separately approved product workflow defines a safe equivalent.

The tool result must clearly distinguish:

- candidate
- held
- confirmed
- unavailable
- failed

## Concurrency Test

Always include a test where two actors attempt to book the same final unit of capacity concurrently. Exactly one must succeed when capacity is one.

## Failure Rules

- Availability read failure → do not confirm.
- Notification failure → booking remains committed.
- Outbox failure → retry asynchronously.
- Stale cache → re-read authoritative state.
- Duplicate request → return original idempotent result.

## Security Checklist

- [ ] tenant isolation
- [ ] permission enforcement
- [ ] resource ownership
- [ ] no client-authoritative availability
- [ ] idempotency
- [ ] audit for sensitive lifecycle changes
- [ ] minimal personal/medical data
- [ ] no secrets
- [ ] no direct AI database access

## Definition of Done

A booking change is complete only when lifecycle, availability, transactionality, concurrency, authorization, idempotency, events, timezone handling, tests and documentation are aligned.
