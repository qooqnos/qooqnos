# Phoenix Notifications & Communications Architecture

**Status:** Architecture Baseline  
**Scope:** In-app, WhatsApp, SMS, Email, communication preferences, templates, delivery, retries, provider abstraction  
**Architecture:** Modular Monolith

## 1. Purpose

Communications is Phoenix's delivery layer. It delivers approved messages across channels while keeping business intent in domain modules such as Booking and CRM.

Core rule:

> Domain modules decide what should happen; Communications decides how an authorized message is delivered.

Communications is not the source of truth for booking, CRM, catalog, identity, or billing state.

## 2. Supported Channels

Initial channel abstraction:

- In-app notifications
- WhatsApp
- SMS
- Email

The architecture must allow additional providers/channels without changing domain modules.

Recommended interface:

```text
CommunicationRequest
  intent
  recipient
  channel
  template/version
  locale
  variables
  priority
  idempotency_key
  scheduled_at
  policy_context
```

## 3. Communication Intent

Messages must originate from a typed intent rather than arbitrary text whenever practical.

Examples:

- `booking.confirmed`
- `booking.reminder`
- `booking.cancelled`
- `booking.rescheduled`
- `crm.follow_up`
- `account.security_alert`
- `business.verification_update`

Intent defines allowed channels, template family, required policy checks, and whether user confirmation is required.

## 4. Provider Abstraction

Never couple Booking or CRM directly to Twilio, WhatsApp providers, SMTP vendors, or another external provider.

Flow:

`Domain Command/Event → Communications Service → Policy → Template → Provider Adapter → Provider → Delivery Event`

Provider adapters normalize:

- accepted
- queued
- sent
- delivered
- read
- failed
- rejected
- expired

Provider-specific payloads remain inside the adapter boundary.

## 5. Templates

Templates are versioned, localized, and typed.

Template metadata should include:

- template id
- version
- intent
- channel
- locale
- variables schema
- status
- approval state where required
- created/updated metadata

Do not construct uncontrolled provider-specific messages in domain code.

For WhatsApp, template approval requirements of the selected provider/platform must be respected.

## 6. Localization

Every message should resolve:

- language/locale
- direction (LTR/RTL)
- timezone
- date/time formatting
- currency/number formatting where relevant
- calendar adapter where relevant

Persian/Jalali presentation must be handled by the localization/calendar layer; canonical timestamps remain UTC.

## 7. Consent and Communication Preferences

Communication preferences are policy inputs, not merely UI settings.

Preference categories may include:

- transactional
- security
- marketing
- reminders
- product updates

Rules must distinguish legally/operationally required transactional messages from optional marketing communications.

Opt-out must propagate to all applicable outbound paths.

A business cannot override a customer's global communication restrictions unless an explicit lawful transactional exception applies.


## 7.1 Consent and policy enforcement

Before enqueueing an outbound notification, Communications evaluates the registered intent policy, allowed channel, recipient preference state, and active suppression records. The result and policy version are persisted as Communication-owned decision evidence. Policy-denied/suppressed notifications are retained for audit but never published to Outbox dispatch.

## 8. Authorization and Policy

Before sending:

1. authenticate initiating actor/system;
2. resolve tenant/workspace;
3. validate intent schema;
4. check authorization;
5. evaluate consent/preferences;
6. evaluate anti-spam/rate limits;
7. resolve recipient safely;
8. render approved template;
9. enqueue delivery;
10. audit the decision.

AI cannot bypass this pipeline.

## 9. Delivery Lifecycle

Recommended message state machine:

`created → policy_checked → queued → provider_accepted → sent → delivered → read`

Failure paths:

`queued → failed`

`provider_accepted → rejected/failed`

Messages may also be:

- cancelled before delivery where supported
- expired
- suppressed by policy

A provider saying "accepted" does not mean the recipient received the message.

## 10. Retry Strategy

Retries must distinguish transient from permanent failures.

Transient examples:

- timeout
- temporary provider outage
- rate limit
- network failure

Permanent examples:

- invalid recipient
- revoked authorization
- invalid template
- policy rejection

Use exponential backoff with jitter and bounded retry attempts.

Never retry a message whose policy decision has expired without re-evaluating the required policy.

## 11. Idempotency and Duplicate Prevention

Every externally meaningful communication request should have an idempotency key.

Recommended key composition:

`tenant + intent + source_event_id + recipient + channel + template_version`

The exact composition may vary by intent, but duplicate sends must be prevented at the application/provider boundary.

Consumers of provider callbacks must also be idempotent.

## 12. Scheduling

Scheduled notifications should use a durable job model rather than in-memory timers.

Examples:

- booking reminder 24 hours before
- booking reminder 2 hours before
- CRM follow-up at a specific local time

Scheduling must respect the recipient's applicable timezone and daylight-saving transitions.

If a booking changes, stale scheduled reminders must be cancelled/replaced safely.

## 13. Event Architecture

Communications consumes domain events through the existing Outbox/event infrastructure.

Examples:

- `booking.confirmed.v1`
- `booking.rescheduled.v1`
- `booking.cancelled.v1`
- `booking.completed.v1`
- `business.verification.completed.v1`
- `crm.task.due.v1`

Provider callbacks generate normalized communication events such as:

- `communication.accepted.v1`
- `communication.sent.v1`
- `communication.delivered.v1`
- `communication.read.v1`
- `communication.failed.v1`

All consumers must be idempotent.

## 14. Notification Inbox

In-app notifications should have their own lightweight read model.

Recommended fields:

- notification id
- recipient
- tenant/workspace
- intent
- title/body or template reference
- deep-link target
- priority
- created_at
- read_at
- expires_at

Unread counts should be projection-backed and cacheable with correct authorization scope.

## 15. Delivery Receipts and Webhooks

Provider webhooks are untrusted external input.

Required controls:

- signature verification
- provider/event validation
- replay protection where supported
- idempotency
- timestamp tolerance
- payload schema validation
- tenant/provider mapping validation
- audit logging without sensitive payload leakage

Never trust a provider callback to mutate Booking or CRM directly. Emit a normalized event and let the owning module decide how to react.

## 16. Security

Never log:

- authentication tokens
- provider secrets
- full message bodies when sensitive
- unnecessary phone/email data
- medical content

Provider credentials belong in the platform secret/configuration layer, not module records.

Recipient resolution must prevent cross-tenant leakage and must not allow arbitrary user-supplied destination addresses to bypass identity/policy checks.

## 17. Privacy and Data Retention

Communication data should be minimized.

Separate:

1. delivery metadata needed for operations;
2. message content required for user experience;
3. audit/security records requiring longer retention.

Retention must be configurable by data class and legal requirements.

Deletion/export workflows must account for both local records and provider-side capabilities/limitations.

## 18. Medical Communication Boundary

For medical partners:

- prefer operational notifications such as appointment confirmation/reminder;
- minimize health information in message bodies;
- do not include diagnosis or treatment details unless explicitly authorized and legally appropriate;
- never let AI generate clinical advice as a notification;
- maintain consent and privacy controls.

A reminder should prefer a neutral message such as appointment date/time and provider name rather than unnecessary clinical details.

## 19. AI Integration

AI may:

- classify communication intent;
- draft permitted message content;
- translate/localize drafts;
- summarize delivery history;
- suggest optimal follow-up timing where policy permits.

AI may not:

- directly call a provider API;
- bypass consent;
- bypass authorization;
- invent booking availability;
- send marketing messages without valid permission;
- expose private CRM notes;
- generate prohibited medical advice.

Any AI-created outbound message passes the same schema, policy, consent, authorization, template, audit, and delivery pipeline as a human-created message.

## 20. Rate Limits and Anti-Spam

Consent/intent/suppression policy is implemented in Communication. Edge/platform rate limiting and anomaly detection remain infrastructure/security controls rather than domain policy tables.

Apply limits at multiple scopes:

- per actor
- per business/tenant
- per recipient
- per channel
- per intent
- platform-wide/provider-wide

Use anomaly detection for bursts and suspicious campaigns.

Transactional traffic must be isolated from marketing traffic so a campaign cannot starve booking/security messages.

## 21. Priority and Queues

Recommended priority classes:

1. security/critical
2. transactional
3. operational
4. customer engagement
5. marketing

Queues should support bounded concurrency and provider-specific rate limits.

A failure in one provider must not block unrelated channels.

## 22. Observability

Track:

- queue latency
- provider latency
- delivery latency
- delivery success/failure rate
- retry count
- suppression count
- policy rejection count
- provider rate-limit events
- template failures
- webhook failures
- cost per channel/provider where available

Trace IDs must propagate from originating domain event through communication job and provider callback.

## 23. Data Model

Recommended tables:

- `communication_messages`
- `communication_deliveries`
- `communication_templates`
- `communication_template_versions`
- `communication_preferences`
- `communication_provider_accounts`
- `communication_provider_events`
- `communication_schedules`
- `communication_inbox_notifications`
- `communication_suppression_records`

Secrets themselves must not be stored as ordinary database values.

## 24. API Surface

Initial shape:

```text
GET    /api/v1/communications/preferences
PATCH  /api/v1/communications/preferences
GET    /api/v1/communications/messages/:id
GET    /api/v1/notifications
POST   /api/v1/notifications/:id/read
POST   /api/v1/communications/preview
POST   /api/v1/communications/send
POST   /api/v1/communications/schedules
DELETE /api/v1/communications/schedules/:id
```

`send` must be permissioned and policy-controlled. Domain modules should normally use typed internal commands/events rather than calling this generic endpoint directly.

## 25. Failure and Degradation

If a provider is unavailable:

- retain the durable message intent;
- retry transient failures;
- fall back to an approved alternate channel only when policy allows;
- never silently downgrade a privacy-sensitive communication;
- expose delivery state to the originating module through events.

Example: if WhatsApp fails, SMS may be a valid fallback for a transactional booking reminder only when the recipient has appropriate consent/preference and the intent allows SMS fallback.

## 26. Performance Targets

Initial targets:

- notification inbox p95 < 200 ms
- enqueue communication p95 < 300 ms
- policy evaluation p95 < 100 ms for normal workloads
- asynchronous delivery processing with bounded queue latency

External provider latency is excluded from synchronous API targets.

## 27. Testing

Required tests:

- tenant isolation
- recipient authorization
- consent/opt-out
- transactional vs marketing policy
- template schema validation
- locale/RTL/Jalali rendering
- idempotent sends
- duplicate webhook handling
- retry classification
- provider rate limiting
- scheduling across DST
- stale reminder cancellation
- provider failure isolation
- fallback policy
- medical-content minimization
- secret redaction
- AI policy boundaries

## 28. Implementation Order

1. module manifest/registry
2. communication intent and schemas
3. preference/consent integration
4. template registry/versioning
5. durable message/delivery model
6. queue/job processing
7. in-app notification inbox
8. provider adapter abstraction
9. Email/SMS integration
10. WhatsApp integration
11. webhook normalization
12. scheduling/reminders
13. retry/fallback/rate limits
14. observability/cost controls
15. AI-assisted drafting/optimization

## 29. Claude Code Rules

Claude Code must:

- keep provider SDKs behind adapters;
- never put provider calls in Booking, CRM, Catalog, or AI code;
- require policy + consent + authorization before outbound delivery;
- use idempotency for sends and webhook processing;
- never trust provider callbacks without verification;
- never log secrets or unnecessary message content;
- preserve UTC canonical time and use timezone/calendar adapters for presentation/scheduling;
- treat AI-generated communication exactly like human-generated communication at the policy boundary;
- keep transactional and marketing traffic isolated.

## 30. Definition of Done

Communications is ready when:

- domain modules can request delivery without knowing provider details;
- preferences and consent are enforced;
- templates are versioned and localized;
- sends and callbacks are idempotent;
- retries and failures are bounded and observable;
- in-app notifications work through a projection/read model;
- provider webhooks are authenticated and normalized;
- WhatsApp/SMS/Email can evolve independently;
- medical notifications minimize sensitive data;
- AI cannot bypass communication policy or delivery controls.
