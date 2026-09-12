# Phoenix Reviews, Reputation & Trust Architecture

## 1. Purpose

Reviews and reputation are a trust layer for the Phoenix marketplace. They improve customer confidence and provide quality signals for Discovery, while remaining independent from authoritative identity, catalog, booking, communications, and billing domains.

Core invariant:

> A review is evidence about an interaction; it is not permission to publish, verify, or bypass marketplace policy.

## 2. Ownership

The Reviews module owns:

- reviews and ratings
- review eligibility and publication state
- review responses
- moderation/report workflow
- reputation projections and quality aggregates
- review-derived trust signals
- anti-abuse signals specific to reviews

Other modules remain authoritative for:

- Identity: actor identity
- Business/Onboarding: provider verification and publication eligibility
- Catalog: offers/services/products
- Booking: reservations and interaction facts
- Communications: message delivery
- Billing: payments and financial facts
- Discovery: candidate retrieval and ranking execution
- CRM: customer relationship/timeline projections

Reviews must never duplicate these sources of truth.

## 3. Review eligibility

A review should normally be tied to a verifiable marketplace interaction, such as a completed booking or another explicitly approved interaction type.

Eligibility must be computed server-side from authoritative records. The client cannot assert that an interaction occurred.

Recommended lifecycle:

`eligible → draft → submitted → pending_moderation → published`

Alternative terminal states:

`rejected`, `withdrawn`, `removed`, `expired`

A review that cannot be linked to a valid eligible interaction must not enter the trusted reputation calculation unless an explicit policy permits another source.

## 4. Review model

Minimum conceptual fields:

- review_id
- tenant_id / workspace_id where applicable
- author_actor_id
- subject_business_id
- subject_offer_id when applicable
- interaction_reference
- rating
- title/body
- locale
- status
- moderation_state
- created_at / updated_at
- published_at
- policy_version
- content_version

Ratings use bounded integer scales. The scale is configuration, not an implicit frontend assumption.

## 5. Reputation is derived

Raw reviews remain the evidence layer. Reputation is a derived projection and must be recalculable.

Do not permanently encode a mutable aggregate as the only source of truth.

Useful signals include:

- verified interaction count
- published review count
- rating distribution
- recent rating trend
- review recency
- cancellation/no-show context where policy permits
- moderation history
- response rate/time where appropriate
- complaint/report rate
- suspicious-review indicators

Reputation must avoid rewarding volume alone. A provider with many low-quality or suspicious reviews must not automatically outrank a smaller, healthier provider.

## 6. Discovery integration

Discovery may consume derived reputation signals as ranking inputs.

Ordering principle:

1. hard eligibility
2. policy/compliance constraints
3. availability and freshness
4. relevance/matching quality
5. quality and reputation signals
6. personalization

Reputation can improve ranking among eligible candidates but cannot make an ineligible business eligible.

Sponsored placement, if introduced later, must remain clearly labeled and cannot override hard eligibility or safety policy.

## 7. Moderation and abuse prevention

Moderation supports:

- spam
- harassment
- threats
- personal data exposure
- fabricated claims
- coordinated review manipulation
- review bombing
- incentivized undisclosed reviews
- duplicate submissions
- provider/customer retaliation
- prohibited content

Use risk signals rather than a single opaque score. Signals can include account age, interaction linkage, submission velocity, repeated text patterns, shared infrastructure indicators, abnormal rating distributions, and report history.

Risk scoring is advisory. Enforcement requires explicit policy and authorization.

## 8. Separation of duties

Recommended permissions:

- `reviews.read`
- `reviews.create`
- `reviews.edit_own`
- `reviews.respond`
- `reviews.report`
- `reviews.moderate`
- `reviews.remove`
- `reviews.reputation.read`
- `reviews.reputation.rebuild`
- `reviews.policy.manage`

A reviewer who submits a moderation decision should not automatically be able to approve their own exception. Protected moderation and reputation operations require elevated authorization and audit records.

## 9. Business responses

A business may respond to a published review through an authorized command.

Responses are independently moderated. A business response cannot edit the customer's review and cannot suppress a negative review merely because it is unfavorable.

## 10. Privacy and sensitive data

Reviews are public or tenant-visible only according to explicit visibility policy.

Do not expose:

- private notes
- hidden moderation evidence
- internal risk signals
- private customer contact information
- sensitive health information
- credentials or verification documents

For medical marketplace scenarios, reviews must not become a channel for diagnosis, treatment recommendations, medication advice, or disclosure of sensitive patient information. Moderation must be able to remove or restrict such content according to policy.

## 11. AI boundaries

AI may:

- classify review content
- detect probable spam or manipulation
- summarize review themes
- suggest moderation queues
- translate content
- draft a business response
- identify duplicate/near-duplicate content

AI may not:

- directly publish or remove reviews
- grant review eligibility
- fabricate interaction evidence
- alter reputation aggregates directly
- override moderation policy
- expose private moderation evidence
- make medical diagnoses or treatment recommendations

Flow:

`AI proposal → schema validation → policy → authorization → Reviews domain service → repository → audit/outbox`

## 12. Events

Recommended events:

- `review.eligible`
- `review.submitted`
- `review.published`
- `review.rejected`
- `review.withdrawn`
- `review.reported`
- `review.moderated`
- `review.response.published`
- `reputation.recalculation.requested`
- `reputation.updated`

Events are versioned, tenant-scoped, idempotent, and emitted through the platform outbox.

## 13. Read models

Recommended projections:

- business reputation summary
- offer reputation summary
- recent published reviews
- moderation queue
- abuse/risk queue
- customer review history
- provider response metrics

Read models may be stale. Final moderation and other state-changing commands must re-read authoritative state.

## 14. Caching and freshness

Public reputation summaries may be cached with explicit versioning and invalidation/rebuild strategy.

Never cache authorization-sensitive moderation data without actor/tenant-aware keys.

A stale reputation value must never be treated as proof of current verification, availability, or policy compliance.

## 15. Data model outline

Core tables/read models may include:

- `reviews`
- `review_targets`
- `review_reports`
- `review_moderation_cases`
- `review_moderation_decisions`
- `review_responses`
- `review_risk_signals`
- `reputation_summaries`
- `reputation_versions`

Risk evidence should be retained only as long as justified by policy and privacy requirements.

## 16. API outline

Customer-facing:

- `POST /api/v1/reviews`
- `GET /api/v1/reviews`
- `GET /api/v1/reviews/eligibility`
- `POST /api/v1/reviews/{id}/report`

Business-facing:

- `POST /api/v1/reviews/{id}/response`
- `GET /api/v1/reputation`

Admin/moderation:

- `GET /api/v1/admin/reviews/moderation`
- `POST /api/v1/admin/reviews/{id}/moderate`
- `POST /api/v1/admin/reputation/rebuild`

All mutations require authentication, tenant scope, permission checks, resource policy checks, validation, and idempotency where retryable.

## 17. Anti-gaming rules

The system should resist:

- self-reviewing
- review exchanges
- paid/incentivized manipulation without disclosure
- repeated account creation
- coordinated rating attacks
- provider retaliation
- deleting legitimate negative evidence solely to improve ranking

Quality controls should be explainable enough for operators to investigate without exposing abuse-detection internals to attackers.

## 18. Localization

Review content preserves its source locale. Display supports translated presentation without replacing the original evidence.

Rating labels, moderation policy, date/time, numbers, and direction follow the user's locale. Jalali/Gregorian is presentation-aware; stored timestamps remain canonical UTC instants.

## 19. Testing

Required tests include:

- eligibility derived from authoritative interaction state
- tenant isolation
- object-level authorization
- duplicate/idempotent submission
- moderation transitions
- review response authorization
- reputation recalculation determinism
- suspicious-review handling
- concurrent moderation updates
- stale projection behavior
- privacy masking
- multilingual content
- medical-content boundaries
- ranking integration without eligibility bypass

## 20. Definition of Done

A Reviews implementation is complete only when domain ownership, schema/migrations, authorization, tenant isolation, moderation workflow, reputation projections, anti-abuse controls, audit/outbox, APIs, tests, localization, privacy review, and Discovery integration are documented and verified.
