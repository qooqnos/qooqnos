# Phoenix API Contract / Error / Versioning Architecture

## 1. Purpose

This document defines the stable contract between Phoenix frontend, backend modules, AI orchestration, Runtime and external providers.

The API is a contract boundary, not a direct representation of database tables.

## 2. Contract Principles

- APIs expose domain capabilities, not tables.
- Every request has explicit actor, tenant and workspace context where applicable.
- Authentication and authorization are server-side.
- Request and response schemas are explicit and versioned.
- Errors are structured and safe.
- Sensitive implementation details are never returned.
- Idempotency is mandatory for retryable side effects.
- Pagination is consistent.
- Timestamps are canonical and unambiguous.
- Money uses integer minor units and ISO currency.

## 3. API Namespace

Public application APIs use:

```text
/api/v1/<module>/...
```

Examples:

```text
/api/v1/discovery/search
/api/v1/catalog/offers/:id
/api/v1/bookings
/api/v1/communications
/api/v1/reviews
/api/v1/media
/api/v1/crm
```

Admin and partner surfaces may use dedicated namespaces while still consuming module contracts.

## 4. Versioning Strategy

Use URL major versioning for externally consumed APIs:

```text
/v1
/v2
```

Within a major version, prefer additive evolution:

- add optional response fields
- add optional request fields
- add new enum values only when clients are tolerant
- add new endpoints

Breaking changes require a new major version or an explicitly controlled migration strategy.

## 5. Module API Contract

Each module exposes a contract containing:

- operation ID
- HTTP method/path
- authentication requirement
- permission requirement
- input schema
- output schema
- error schema
- idempotency behavior
- pagination behavior
- side-effect classification
- audit behavior

The contract should be machine-readable where practical.

## 6. Request Context

The server derives trusted context from authentication and routing.

Conceptually:

```text
Request
 -> request_id
 -> authenticated_actor
 -> tenant
 -> workspace
 -> membership
 -> permissions
 -> entitlement
 -> resource policy
 -> domain service
```

Client-provided tenant/workspace identifiers are treated as claims to validate, not trusted authority.

## 7. Standard Headers / Metadata

Use consistent metadata for applicable requests:

- request/correlation ID
- idempotency key for side effects
- API version
- locale preference
- timezone context where presentation-dependent

Never accept client headers as authorization evidence.

## 8. Idempotency

Required for retryable mutations such as:

- booking finalization
- booking cancellation/reschedule
- communication send requests
- billing provider webhook processing
- verification decisions
- review submission where duplicate submission is possible
- asynchronous command creation

An idempotency key must be scoped to actor/tenant and operation semantics.

The server must return the original logical result for a valid duplicate request rather than executing the side effect twice.

## 9. Pagination

Default to cursor-based pagination for mutable/high-volume collections.

A paginated response should provide:

- items
- next cursor when available
- optional previous cursor where supported
- stable ordering semantics

Do not expose database offsets as a long-term public contract for large mutable datasets.

## 10. Filtering / Sorting

Filtering and sorting parameters must be allowlisted.

Never translate arbitrary client strings into SQL expressions.

Domain-specific filters must be validated against module contracts.

## 11. Standard Success Shape

A consistent envelope may be used for APIs that benefit from it:

```json
{
  "data": {},
  "meta": {
    "request_id": "..."
  }
}
```

Simple resource endpoints may return the resource directly if the platform contract remains consistent.

Do not add envelopes solely for aesthetic uniformity when they reduce interoperability.

## 12. Standard Error Model

Errors should be machine-readable:

```json
{
  "error": {
    "code": "BOOKING_SLOT_UNAVAILABLE",
    "message": "The selected slot is no longer available.",
    "request_id": "...",
    "details": {}
  }
}
```

`message` is safe for presentation or localization mapping; `code` is the stable programmatic contract.

## 13. Error Classes

Recommended categories:

```text
AUTHENTICATION_REQUIRED
FORBIDDEN
RESOURCE_NOT_FOUND
VALIDATION_ERROR
CONFLICT
RATE_LIMITED
DEPENDENCY_UNAVAILABLE
TEMPORARY_FAILURE
POLICY_BLOCKED
STALE_DATA
IDEMPOTENCY_REPLAY
UNSUPPORTED_OPERATION
INTERNAL_ERROR
```

Domain-specific codes may extend these categories.

## 14. HTTP Mapping

Suggested baseline:

```text
400 -> malformed/invalid request
401 -> authentication required/invalid
403 -> authorization/policy denial
404 -> resource unavailable/not visible
409 -> state/conflict/idempotency conflict
422 -> semantically invalid domain input
429 -> rate limited
500 -> internal failure
502/503/504 -> dependency/service availability failures
```

Do not reveal whether a hidden resource exists when doing so would create an enumeration risk.

## 15. Validation Errors

Validation responses should identify safe field-level errors where useful:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "fields": {
        "price": "must be greater than zero"
      }
    }
  }
}
```

Never include secrets, credentials or sensitive internal stack information.

## 16. Domain Errors

Domain services return typed outcomes/errors.

Examples:

- `OFFER_NOT_PUBLISHED`
- `BUSINESS_NOT_VERIFIED`
- `SLOT_UNAVAILABLE`
- `BOOKING_ALREADY_CANCELLED`
- `REVIEW_NOT_ELIGIBLE`
- `MEDIA_ACCESS_DENIED`
- `CONSENT_REQUIRED`
- `MEDICAL_POLICY_BLOCKED`

HTTP handlers map these to API contracts without moving business rules into controllers.

## 17. Stale / Unknown Data

The API must distinguish:

- current/verified
- stale
- unknown
- unavailable

Critical marketplace facts such as availability, price and verification state must never be fabricated to make a response look complete.

## 18. Partial Responses

For composite/BFF responses, individual sections may carry availability state:

```text
available
stale
unavailable
forbidden
not_applicable
```

The UI can then render a truthful partial experience.

## 19. Search / Discovery Contract

Search responses should expose enough structured metadata for explainability:

- interpreted query/constraints where appropriate
- candidate/result IDs
- relevance metadata safe for clients
- trust/verification signals
- availability freshness
- pagination

Internal ranking weights and abuse-detection signals need not be exposed.

## 20. AI API Contract

AI endpoints must return structured results, not require clients to parse free-form prose.

Conceptually:

```text
intent
constraints
results
explanations
warnings
actions
```

Side-effecting actions include explicit state:

```text
proposed
requires_confirmation
authorized
executing
completed
failed
```

A client must never infer `completed` from an AI message alone.

## 21. Async Command Contract

Long-running operations return a durable operation reference when appropriate:

```text
POST -> 202 Accepted
       operation_id
       status_url
```

The operation can expose:

- queued
- running
- succeeded
- failed
- cancelled

Operations must be tenant-scoped and access-controlled.

## 22. Webhooks

Inbound webhooks are provider-specific at the adapter boundary and normalized internally.

Required controls:

- signature verification
- replay protection
- idempotency
- schema validation
- provider event ID
- timestamp tolerance where supported
- auditability

Provider payloads must not directly mutate domain tables.

## 23. Events vs APIs

Use APIs/commands for intentional synchronous actions.

Use versioned events for facts that have occurred.

Example:

```text
POST /bookings -> command
booking.confirmed.v1 -> fact
```

Events must be backward compatible and processed idempotently.

## 24. Provider Adapter Contract

External providers are isolated behind typed interfaces.

Adapters normalize:

- request/response formats
- provider errors
- timeout semantics
- retryability
- rate limits
- webhook events

Domain modules must not depend on provider-specific object IDs as their only identity.

## 25. Authorization Contract

Every protected mutation follows:

```text
Authenticate
 -> Resolve tenant/workspace
 -> Membership
 -> Permission
 -> Entitlement
 -> Resource policy
 -> Domain rule
 -> Execute
 -> Audit
```

The API layer may reject early, but the domain service remains responsible for critical invariants.

## 26. Sensitive Data Contract

Responses must follow data minimization.

Depending on actor and purpose, sensitive fields may be:

- omitted
- masked
- summarized
- explicitly authorized

Medical/sensitive data must never be included merely because it is technically available to the backend.

## 27. Caching Contract

Only cache responses that are safe for the cache scope.

Cache keys must include relevant:

- tenant/workspace
- actor/permission context where needed
- locale
- resource version
- feature/policy version

Never serve private data from a public/shared cache.

## 28. API Deprecation

Deprecated endpoints require:

- documented replacement
- deprecation metadata
- migration window
- usage monitoring
- removal criteria

Do not silently break active consumers.

## 29. Schema Governance

Schemas should be stored alongside module contracts and versioned in Git.

Changes require:

- compatibility check
- affected-client analysis
- test updates
- migration plan where needed

## 30. Frontend Integration

Frontend API clients should be generated or strongly typed from canonical contracts.

UI code should depend on typed domain DTOs, not database models.

Error handling should branch on stable error codes rather than fragile message strings.

## 31. Security Testing

Contract tests must verify:

- unauthorized request rejection
- tenant isolation
- hidden-resource behavior
- schema validation
- rate limiting
- idempotency
- sensitive field minimization
- safe error responses
- webhook replay protection

## 32. Performance

API contracts should document expected latency class:

- simple reads: low latency
- search: interactive
- availability: interactive and fresh
- booking: transactional
- AI: potentially asynchronous
- heavy processing: async operation

Do not force long-running work into synchronous request lifetimes.

## 33. Definition of Done

API architecture is complete when:

- module contracts are explicit
- schemas are versioned
- errors have stable codes
- idempotency is defined for side effects
- pagination/filtering are standardized
- authorization context is explicit
- sensitive fields are minimized
- async operations are modeled
- events and APIs have clear responsibilities
- provider adapters are isolated
- deprecation strategy exists
- frontend clients can consume typed contracts
- security and contract tests exist
