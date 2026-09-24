---
name: phoenix-communications
description: Rules for Phoenix communications delivery, templates, providers, consent, scheduling, retries, webhooks, and AI boundaries.
---

# Phoenix Communications Skill
Native Claude Code entrypoint. Read `skills/phoenix-communications/SKILL.md` and `docs/NOTIFICATIONS_COMMUNICATIONS_ARCHITECTURE.md` before communications work.
## Rules
- Communications owns delivery, templates, provider adapters, preferences, schedules, retries, webhooks, and inbox projections—not domain state.
- Provider SDKs stay behind adapters.
- External provider adapters use runtime-only endpoint/credential configuration; provider secrets never enter Communication tables or source control.
- Dispatch rate limits cover tenant, recipient, channel, provider and platform scopes; provider `429` / `Retry-After` is normalized as transient delivery state.
- Burst anomaly detection is bounded and advisory; distributed edge/platform enforcement remains authoritative in production.
- Outbound flow: domain command/event → policy → template → provider adapter → provider → normalized event.
- Authorization, consent, opt-out, anti-spam, recipient validation, and audit precede delivery.
- Sends and callbacks are idempotent; webhook signatures/schema/replay controls are mandatory.
- Canonical time is UTC; local scheduling uses IANA timezone and locale/calendar adapters.
- AI can draft/classify/translate/summarize but cannot bypass policy or send directly.
- Medical communications minimize sensitive information and remain operational/neutral.
## Done
Test tenant isolation, consent, idempotency, webhook security, retries, scheduling/DST, localization, rate limits, provider failure isolation, and AI boundaries.
