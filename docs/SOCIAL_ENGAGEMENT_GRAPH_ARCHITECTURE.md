# Phoenix Social Engagement & Graph Architecture

## Purpose
Phoenix Social Commerce requires a canonical backend boundary for social graph and engagement. This capability persists real user interactions and publishes trustworthy signals into Discovery/Matching without creating a second recommendation engine.

Social interactions strengthen: `Understand Demand → Understand Supply → Decide → Match → Connect → Act → Learn`.

## Ownership
- Identity owns users, authentication and account lifecycle.
- Business owns businesses and workspace-scoped business supply.
- Catalog owns products/services.
- Social Engagement owns follows, likes, saves, comments and their lifecycle.
- Discovery owns discovery queries and ranking.
- Matching owns decision/matching logic.
- Trust/Moderation owns abuse, moderation and reputation policy.
- Analytics/Matching Learning may consume published interaction events; Social Engagement does not rank users or products.

CRM customer relationships remain customer↔business operational relationships and must not be reused as the social graph.

## V1 Graph
A follow edge is `actor user → target user | business`.
- User→user follows are global user relationships.
- User→business follows are organization/workspace-scoped to the target business.
- Self-follow is rejected.
- Duplicate active edges are idempotent.
- Unfollow is a state transition, not destructive history.
- Deleted/suspended users cannot create new social edges.

## V1 Engagement
Supported persistent interactions: Like/unlike, Save/unsave, Comment, Follow/unfollow.
The target reference is polymorphic (`target_type`, `target_id`) because Catalog/Business remain authoritative for their entities. Social Engagement validates that a target is visible and supported before persisting an interaction.

## Event Contract
Every state-changing operation writes its domain record and outbox event transactionally.
Canonical events:
- `social.follow.created` / `social.follow.removed`
- `social.like.created` / `social.like.removed`
- `social.save.created` / `social.save.removed`
- `social.comment.created` / `social.comment.removed`
Consumers use the outbox event ID for idempotency. Events are inputs to preference/intent learning, never a client-side ranking score.

## Security and Privacy
- Mutations require an authenticated actor.
- Actor identity comes from `RequestContext.actorId`; clients cannot choose another actor.
- Business targets enforce organization/workspace boundaries.
- Deleted/suspended users cannot create new edges.
- Comments are subject to moderation and abuse controls.
- Rate limits belong at the API/security boundary.

## Idempotency and Concurrency
- Follow/like/save use unique active-state keys.
- Removal only changes an existing active record.
- Comment creation accepts an idempotency key.
- State changes emit one outbox event per effective transition.
- Repeated no-op requests do not emit duplicate semantic events.

## API Boundary
- `POST /api/v1/social/follows`
- `DELETE /api/v1/social/follows/:id`
- `POST /api/v1/social/likes`
- `DELETE /api/v1/social/likes/:id`
- `POST /api/v1/social/saves`
- `DELETE /api/v1/social/saves/:id`
- `POST /api/v1/social/comments`
- `DELETE /api/v1/social/comments/:id`
- `GET /api/v1/social/activity`

The API returns canonical persisted state. UI-only toasts are not a substitute once this boundary is available.

## Activity Feed
- `GET /api/v1/social/activity` is a canonical activity read boundary for the authenticated actor.
- V1 activity is derived from durable outbox events; it does not create a second social timeline store.
- Activity consumers must treat event payloads as signals, not ranking instructions.

## Frontend Integration Gate
The Social Commerce UI may call this boundary only after the API capability is registered and verified. It must not recreate social state in localStorage.
Compare selection remains client-side because it is browsing state, not a social engagement record.

## Non-goals
- Parallel recommendation/ranking engine.
- Second product/content model.
- Generic social publishing unrelated to Phoenix supply.
- CRM relationship semantics.
- Follower-count ranking formula.
- Fabricated personalization.

## Acceptance Criteria
1. Persistent Follow/Like/Save/Comment records exist in the canonical database.
2. Effective state changes are transactionally paired with outbox events.
3. Actor/tenant/workspace authorization is enforced.
4. Duplicate commands are idempotent.
5. Removal and moderation states are auditable.
6. Discovery/Matching consumes events without depending on Social Engagement internals.
7. Web UI can replace presentation-only actions with real API calls without a second source of truth.