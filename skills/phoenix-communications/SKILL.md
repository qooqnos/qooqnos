# Phoenix Communications Skill

## Mission

Implement Phoenix's channel-independent communication and notification delivery layer.

## Ownership

Communications owns delivery, templates, provider adapters, preferences, delivery state, schedules, retries, webhooks, and notification inbox projections.

It does NOT own:

- identity;
- business verification;
- catalog;
- availability;
- booking state;
- CRM relationship state;
- billing/financial state.

## Provider Boundary

Never import a provider SDK into Booking, CRM, Catalog, or AI code.

Required flow:

`Domain Event/Command → Communications → Policy → Template → Provider Adapter → Provider → Normalized Event`

## Consent and Authorization

Before outbound delivery:

1. resolve actor and tenant;
2. validate communication intent;
3. check authorization;
4. check consent/preferences;
5. apply anti-spam/rate limits;
6. resolve recipient safely;
7. render approved template;
8. enqueue durable delivery;
9. audit the decision.

AI cannot bypass these steps.

## Idempotency

- Every meaningful send requires an idempotency key.
- Provider callbacks must be idempotent.
- Use source event identifiers where possible.
- Never duplicate a notification because of at-least-once event delivery.

## Templates

Templates are typed, versioned, localized, and channel-specific.
Never put uncontrolled provider message construction inside domain modules.

## Time and Localization

- Store canonical timestamps in UTC.
- Use IANA timezone for local scheduling.
- Use localization/calendar adapters for Persian, Jalali, RTL, and formatted output.
- Test daylight-saving transitions.

## Retries

Classify failures as transient or permanent.
Use bounded exponential backoff with jitter.
Re-check policy when a delayed message's original authorization/consent decision may no longer be valid.

## Webhooks

Treat provider callbacks as untrusted input.
Require signature verification, schema validation, replay/idempotency controls, and provider/tenant mapping validation.
Never mutate Booking or CRM directly from a webhook handler; emit normalized domain events.

## AI Rules

AI can draft, classify, translate, summarize, or suggest.
AI cannot:

- call provider APIs directly;
- bypass consent or authorization;
- send marketing without permission;
- expose private CRM data;
- generate prohibited medical advice.

AI-generated content must pass the same policy and delivery pipeline as human-created content.

## Medical Rules

Prefer neutral operational messages.
Minimize health information in message bodies.
Do not send diagnosis, treatment, or medication recommendations as AI-generated communications.

## Security

Never log secrets, tokens, provider credentials, or unnecessary message content.
Keep provider secrets outside ordinary business data tables.
Prevent arbitrary user-supplied recipients from bypassing identity and policy checks.

## Performance

Keep synchronous enqueue operations fast; external provider latency belongs in asynchronous jobs.
Use durable queues and isolate provider/channel failures.

## Testing

Every communication feature should test:

- tenant isolation;
- authorization;
- consent/opt-out;
- template validation;
- idempotency;
- webhook verification;
- retry classification;
- scheduling and DST;
- localization/RTL/Jalali;
- rate limits;
- provider failure isolation;
- fallback policy;
- sensitive-data minimization;
- AI policy boundaries.

## Definition of Done

A communications feature is done only when provider independence, consent, authorization, idempotency, privacy, observability, localization, and failure handling are covered.