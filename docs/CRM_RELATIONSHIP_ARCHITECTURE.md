# Phoenix CRM & Relationship Architecture

**Status:** Architecture Baseline  
**Scope:** Customer–business relationship, interaction history, leads, follow-up, segmentation, loyalty/engagement  
**Architecture:** Modular Monolith  

## 1. Purpose

CRM is Phoenix's relationship and engagement layer. It records and orchestrates the relationship between customers and businesses without becoming a second identity system, booking system, messaging system, or catalog database.

Core rule:

> CRM owns relationship state and relationship workflows; each domain module remains the source of truth for its own business data.

## 2. Ownership Boundaries

| Concern | Source of Truth |
|---|---|
| User/customer identity | Identity/Auth |
| Business identity | Business/Onboarding |
| Business verification | Verification |
| Services/products | Catalog |
| Availability | Availability |
| Reservations | Booking |
| Messages/notifications | Communications/Notifications |
| Relationship/timeline | CRM |
| AI memory/preferences | AI/Memory with explicit privacy rules |
| Billing/subscription | Billing |

CRM may maintain projections or references to these domains, but must not duplicate authoritative records.

## 3. Core CRM Concepts

### 3.1 Relationship

A relationship represents a customer-to-business connection inside a tenant/workspace.

Recommended lifecycle:

`unknown → lead → prospect → customer → returning_customer → inactive`

These labels are relationship states, not new user-account types.

### 3.2 Contact Timeline

The timeline is an ordered, append-oriented view of meaningful relationship events:

- business discovery/match
- profile or offer interaction
- inquiry
- message/call reference
- booking requested/confirmed/completed/cancelled
- follow-up task
- customer note
- review/feedback
- loyalty event
- consent change

The originating module remains authoritative. CRM stores a normalized event reference and projection for fast timeline reads.

### 3.3 Tasks and Follow-ups

CRM owns explicit relationship tasks:

- follow-up required
- callback
- quotation follow-up
- appointment reminder preparation
- customer retention action

Tasks require owner, status, due time, priority, tenant/workspace scope, and audit information.

### 3.4 Notes

Notes are tenant-scoped relationship records. Visibility must be explicit. Private staff notes must never become customer-visible through AI, search, APIs, or exports unless a permitted workflow explicitly exposes them.

## 4. Leads and Opportunities

A lead is a relationship state plus contextual intent, not a duplicate customer record.

Optional opportunity data may include:

- source
- interested offer/service
- estimated value
- stage
- expected decision date
- assigned staff/team
- loss reason

Do not introduce a complex sales pipeline before the marketplace needs it. The initial implementation should support a small, extensible state machine.

## 5. Segmentation

Segments are derived groups used for legitimate personalization and operational workflows.

Supported inputs may include:

- explicit preferences
- relationship state
- booking history
- offer interactions
- engagement recency
- geography where permitted
- language/locale
- business-defined tags

Sensitive attributes must not be inferred or used for segmentation merely because an AI model can predict them. Regulated/sensitive categories require explicit policy and consent where applicable.

Segments should be reproducible: store definition/version and evaluation timestamp rather than silently changing historical membership.

## 6. Loyalty and Engagement

Loyalty should begin as an engagement capability, not a full financial wallet.

Initial concepts:

- visit/booking count
- engagement milestones
- business-defined rewards eligibility
- referral/retention signals

Any monetary balance, credit, payment entitlement, or financial ledger belongs to Billing/Payments rather than CRM.

## 7. Event-Driven Timeline

CRM consumes versioned domain events through the Outbox/event infrastructure.

Examples:

- `business.verified.v1`
- `catalog.offer.published.v1`
- `discovery.match.created.v1`
- `booking.created.v1`
- `booking.confirmed.v1`
- `booking.completed.v1`
- `booking.cancelled.v1`
- `communication.message.sent.v1`
- `communication.message.received.v1`
- `review.created.v1`
- `consent.updated.v1`

Consumers must be idempotent. Timeline projections must tolerate duplicate delivery and out-of-order events.

## 8. Customer Privacy and Consent

CRM data may contain personal information and therefore follows Phoenix data classification, retention, export, deletion, and tenant-isolation rules.

Required controls:

- tenant/workspace isolation
- field-level visibility where needed
- explicit consent records for communication preferences
- opt-out propagation
- retention policies
- customer export/delete workflows
- audit trail for privileged access
- no sensitive data in logs

Medical relationships require stricter minimization. CRM may record operational relationship facts such as appointment status or communication preference, but should not become a clinical record.

## 9. Communication Boundaries

CRM can request communication actions but does not own delivery.

Flow:

`CRM task/workflow → Communications command → provider/channel → delivery event → CRM timeline projection`

Consent and anti-spam policies must be evaluated before outbound communication.

AI must never bypass these policies.

## 10. AI Integration

AI can assist CRM with:

- timeline summarization
- intent extraction from permitted conversations
- suggested follow-up timing
- draft replies
- segmentation suggestions
- lead classification
- churn/engagement signals when policy permits
- duplicate/missing-data detection

AI cannot autonomously:

- change authoritative identity
- expose private notes
- send messages without authorization
- alter booking state
- create financial commitments
- infer sensitive attributes for prohibited use

Side-effecting actions follow:

`LLM → schema validation → actor/tenant → permission → policy → CRM service → domain command → audit/outbox`

## 11. Data Model

Recommended tables/read models:

- `crm_relationships`
- `crm_relationship_tags`
- `crm_timeline_events`
- `crm_timeline_projections`
- `crm_notes`
- `crm_tasks`
- `crm_segments`
- `crm_segment_memberships`
- `crm_opportunities` (optional MVP+)
- `crm_loyalty_events`
- `crm_consents` (or reference the centralized consent service if introduced)

Every tenant-owned record includes tenant/workspace scope and standard audit fields.

Timeline events should include:

- event id
- source module
- source event id
- event type/version
- relationship id
- occurred_at
- received_at
- actor reference where applicable
- visibility
- redaction class
- payload/projection version

## 12. Authorization

Examples:

- `crm.relationship.read`
- `crm.relationship.write`
- `crm.timeline.read`
- `crm.notes.read`
- `crm.notes.write`
- `crm.tasks.manage`
- `crm.segments.manage`
- `crm.export`
- `crm.delete`

Authorization is evaluated centrally and resource policies must enforce tenant/workspace and visibility boundaries.

## 13. API Surface

Initial API shape:

```text
GET    /api/v1/crm/relationships
GET    /api/v1/crm/relationships/:id
GET    /api/v1/crm/relationships/:id/timeline
POST   /api/v1/crm/relationships/:id/notes
POST   /api/v1/crm/relationships/:id/tasks
PATCH  /api/v1/crm/tasks/:id
GET    /api/v1/crm/segments
POST   /api/v1/crm/segments
POST   /api/v1/crm/relationships/:id/actions/follow-up
```

Commands must be explicit for side effects. Read APIs should prefer projections for timeline and dashboard workloads.

## 14. Consistency and Idempotency

- Domain events are delivered at least once.
- Timeline consumers use `(source_module, source_event_id)` as an idempotency key.
- CRM writes use transaction boundaries appropriate to the relationship aggregate.
- Projections may be eventually consistent; authoritative booking/catalog/identity reads must be used when making decisions that require current truth.
- Cache keys must include tenant, visibility, user/role scope, and projection version where relevant.

## 15. Search and Discovery Integration

CRM personalization may provide preference signals to Discovery, but Discovery must remain usable without CRM.

CRM should not rewrite the marketplace ranking directly. It can supply approved preference/context features to the ranking layer, subject to policy.

## 16. Dashboard Design

Business dashboard:

- customer/relationship list
- recent activity
- pending follow-ups
- upcoming bookings reference
- engagement indicators
- segments/tags

Customer dashboard:

- relationship history that is customer-visible
- bookings
- communications
- loyalty/engagement status
- privacy and communication preferences

Admin dashboard:

- relationship health metrics
- abuse/spam indicators
- policy/audit views
- tenant-level controls

## 17. Retention, Export, and Deletion

CRM must support lifecycle policies from the beginning.

Deletion must distinguish:

1. hard-delete eligible CRM records;
2. legal/audit records that require retention;
3. source-domain records owned elsewhere;
4. derived projections that must be rebuilt or deleted.

A customer deletion request must propagate to CRM projections and AI memory where legally and technically applicable.

## 18. Anti-Abuse

Protect against:

- mass unsolicited messaging
- contact scraping
- bulk export
- fake lead generation
- tag/segment abuse
- unauthorized staff access
- timeline poisoning through fabricated events

Rate limits and anomaly detection belong at appropriate platform/security layers; CRM supplies domain context.

## 19. Performance Targets

Initial targets:

- relationship list p95 < 300 ms for normal tenant workloads
- timeline p95 < 300 ms for recent activity
- task mutation p95 < 500 ms excluding external communication providers
- asynchronous projection lag target < 10 seconds under normal load

Large timelines must paginate/cursor rather than load all history.

## 20. Testing

Required tests:

- tenant isolation
- authorization/resource visibility
- event idempotency
- duplicate/out-of-order event handling
- timeline ordering
- consent/opt-out enforcement
- note visibility
- export/delete propagation
- AI suggestion policy boundaries
- communication side-effect confirmation
- segment reproducibility
- retention rules
- performance under high-volume timelines

## 21. Implementation Order

1. CRM module manifest and registry integration
2. relationship aggregate
3. timeline event ingestion/projection
4. notes and visibility
5. tasks/follow-ups
6. consent/communication policy integration
7. dashboard read models
8. segments/tags
9. loyalty/engagement primitives
10. optional opportunities
11. AI assistance
12. advanced analytics/evaluation

## 22. Claude Code Rules

Claude Code must:

- treat Identity, Business, Catalog, Booking, Communications, and Billing as separate authorities;
- never duplicate source-of-truth data merely for convenience;
- use versioned events and idempotent consumers;
- enforce tenant/workspace and visibility checks on every read/write path;
- keep private notes out of customer-visible responses;
- never send communication directly from an LLM;
- require permission/policy/confirmation for side effects;
- minimize sensitive and medical data;
- add tests for every relationship state transition and event consumer.

## 23. Definition of Done

CRM architecture is considered implemented when:

- relationships are tenant-safe and permissioned;
- timeline is built from versioned, idempotent domain events;
- CRM does not duplicate domain ownership;
- notes/tasks have explicit visibility and auditability;
- consent and communication policies are enforced;
- export/deletion/retention behavior is defined;
- AI assistance cannot bypass domain or privacy rules;
- customer and business dashboards use projection/read-model patterns;
- integration tests cover booking, communication, discovery, and privacy boundaries.
