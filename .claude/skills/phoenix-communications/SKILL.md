# Phoenix Communications Skill

Native Claude Code entrypoint. Read `skills/phoenix-communications/SKILL.md` and `docs/NOTIFICATIONS_COMMUNICATIONS_ARCHITECTURE.md` before communications work.

## Rules
- Communications owns delivery, templates, provider adapters, preferences, schedules, retries, webhooks, and inbox projections—not domain state.
- Provider SDKs stay behind adapters.
- Outbound flow: domain command/event → policy → template → provider adapter → provider → normalized event.
- Authorization, consent, opt-out, anti-spam, recipient validation, and audit precede delivery.
- Sends and callbacks are idempotent; webhook signatures/schema/replay controls are mandatory.
- Canonical time is UTC; local scheduling uses IANA timezone and locale/calendar adapters.
- AI can draft/classify/translate/summarize but cannot bypass policy or send directly.
- Medical communications minimize sensitive information and remain operational/neutral.

## Done
Test tenant isolation, consent, idempotency, webhook security, retries, scheduling/DST, localization, rate limits, provider failure isolation, and AI boundaries.
