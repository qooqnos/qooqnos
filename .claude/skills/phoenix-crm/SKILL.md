---
name: phoenix-crm
description: Rules for Phoenix CRM ownership, relationships, notes, tasks, engagement workflows, projections, privacy, and AI boundaries.
---

# Phoenix CRM Skill
Native Claude Code entrypoint. Read `skills/phoenix-crm/SKILL.md` before CRM work.
## Rules
- CRM owns relationships, timeline projections, notes, tasks, segmentation, and engagement workflows.
- Identity owns customer identity; Business owns business identity; Catalog owns offers; Availability/Booking own capacity/reservations; Communications owns delivery; Billing owns money.
- Never create a second source of truth or query another module's private tables.
- Tenant/workspace scope and resource authorization are mandatory.
- Private staff notes remain private unless an explicit permitted workflow exposes them.
- Consume versioned outbox events idempotently; handle duplicates/out-of-order delivery and preserve source references.
- CRM issues commands to Communications; it never sends directly.
- AI may summarize/suggest/draft/classify but cannot send, mutate booking/billing, expose private notes, infer prohibited sensitive attributes, or cross tenants.
- Respect retention, export, deletion, and consent policies.
## Done
Verify relationship transitions, notes visibility, event idempotency, consent/opt-out, export/delete, authorization, tenant isolation, AI boundaries, and projection rebuildability.
