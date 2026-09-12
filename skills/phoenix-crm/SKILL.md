# Phoenix CRM Skill

## Mission

Implement and evolve the Phoenix CRM module as the relationship/workflow layer between customers and businesses.

## Non-Negotiable Boundaries

1. Identity owns user/customer identity.
2. Business/Onboarding owns business identity and verification.
3. Catalog owns services/products.
4. Availability owns current capacity.
5. Booking owns reservation state.
6. Communications owns message/notification delivery.
7. Billing owns money, subscriptions, credits, and financial ledgers.
8. CRM owns relationships, relationship timeline projections, notes, tasks, segmentation, and engagement workflows.
9. Never create a second source of truth for another module.

## Data Rules

- Every tenant-owned record is tenant/workspace scoped.
- Apply centralized authorization plus resource-level visibility checks.
- Treat private staff notes as private unless an explicit permitted workflow exposes them.
- Do not put sensitive personal or medical data in logs, analytics, prompts, or durable memory without a justified policy basis.
- Use integer minor units only if CRM ever references monetary values; financial authority remains Billing.

## Event Rules

- Consume versioned domain events through the Outbox/event infrastructure.
- Make every consumer idempotent using source module + source event id.
- Handle duplicate and out-of-order delivery safely.
- Do not fabricate timeline events to make projections look complete.
- Keep source references so projections can be rebuilt.

## Relationship Rules

- Lead/prospect/customer/returning-customer are relationship states, not account types.
- Relationship state changes must be explicit and auditable.
- Prefer small state machines over an oversized sales CRM.
- Tasks require owner, status, due time, priority, tenant scope, and audit metadata.

## Communication Rules

CRM may issue commands to Communications but never sends directly.

Required flow:

`CRM → Communications command → provider → delivery event → CRM projection`

Always evaluate consent, opt-out, authorization, and anti-spam policy before outbound communication.

## AI Rules

AI may:

- summarize permitted timeline data;
- suggest follow-ups;
- classify relationship intent;
- propose tags/segments;
- draft communications;
- identify missing or duplicate relationship data.

AI may not:

- bypass authorization;
- expose private notes;
- send messages autonomously;
- mutate booking or billing state directly;
- infer sensitive attributes for prohibited segmentation;
- write arbitrary SQL;
- access another tenant's data.

For side effects:

`LLM → schema validation → actor/tenant → permission → policy → CRM service → domain command → audit/outbox`

## Privacy Rules

- Respect retention, export, deletion, and consent policies.
- Propagate eligible deletion to projections and relevant AI memory.
- Do not treat CRM as a clinical record.
- Medical workflows may retain operational relationship facts such as appointment status and communication preferences, but not unnecessary clinical content.

## API Rules

Use `/api/v1/crm/...` and explicit commands for mutations with meaningful side effects.
Prefer cursor pagination for timelines and projection-backed reads for dashboards.

## Testing Requirements

Every CRM change should consider:

- tenant isolation;
- role/resource authorization;
- visibility of notes;
- event idempotency;
- duplicate/out-of-order events;
- relationship transitions;
- consent and opt-out;
- export/delete behavior;
- AI policy boundaries;
- side-effect confirmation;
- projection rebuildability.

## Implementation Sequence

1. Manifest/registry
2. Relationship aggregate
3. Timeline ingestion and projections
4. Notes
5. Tasks/follow-ups
6. Consent integration
7. Dashboard projections
8. Segments/tags
9. Loyalty/engagement
10. Opportunities if needed
11. AI assistance
12. Advanced analytics

## Definition of Done

A CRM feature is done only when it preserves domain ownership, tenant isolation, authorization, privacy, idempotent events, auditable side effects, and appropriate tests.