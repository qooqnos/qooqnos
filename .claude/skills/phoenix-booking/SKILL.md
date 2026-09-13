---
name: phoenix-booking
description: Rules for Phoenix booking, availability, commitments, concurrency, timezone handling, idempotency, and safe AI actions.
---

# Phoenix Booking Skill
## Purpose
Turn eligible offers into controlled, auditable commitments while preserving authoritative availability and concurrency safety.
## Mandatory context
Read `docs/BOOKING_AVAILABILITY_ARCHITECTURE.md` and relevant catalog/schedule rules before booking work.
## Rules
- Availability and committed Booking state are authoritative domain data.
- Never trust client or cached availability for finalization.
- Every mutation is authenticated, tenant-scoped, permission-checked, and idempotent where retryable.
- UTC instants are canonical; IANA timezone controls local rules; Jalali is presentation/adapter only.
- Finalization requires authoritative re-read, transaction, concurrency/version check, booking + capacity update, audit/outbox.
- AI may prepare/find/cancel/reschedule through approved tools but cannot independently confirm or invent availability.
- Notifications are asynchronous.
- Medical booking stores minimum necessary data and is not clinical decision support.

## Done
Test concurrent booking of the last capacity unit, idempotency, authorization, timezone/DST, stale availability, rescheduling, and failure isolation.
