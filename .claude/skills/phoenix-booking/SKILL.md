# Phoenix Booking Skill

Native Claude Code entrypoint. Read `skills/phoenix-booking/SKILL.md` and `docs/BOOKING_AVAILABILITY_ARCHITECTURE.md` before booking work.

## Rules
- Availability and committed Booking state are authoritative domain data.
- Never trust client/cached availability for finalization.
- Every mutation is authenticated, tenant-scoped, permission-checked, and idempotent where retryable.
- UTC instants are canonical; IANA timezone controls local rules; Jalali is presentation/adapter only.
- Finalization requires authoritative re-read, transaction, concurrency/version check, booking + capacity update, audit/outbox.
- AI can prepare/find/cancel/reschedule through approved tools but cannot independently confirm.
- Notifications are asynchronous.
- Medical booking stores minimum necessary data and is not clinical decision support.

## Done
Test concurrent booking of the last capacity unit, idempotency, authorization, timezone/DST, stale availability, and failure isolation.
