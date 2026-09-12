# Phoenix API Skill

## Purpose

Implement and review API contracts according to `docs/API_CONTRACT_ERROR_VERSIONING_ARCHITECTURE.md`.

## Rules

- APIs expose domain capabilities, not database tables.
- Use `/api/v1/<module>/...` for externally consumed module APIs.
- Breaking changes require explicit versioning/migration strategy.
- Every protected operation validates authenticated actor, tenant/workspace, membership, permission, entitlement, resource policy and domain rules.
- Use stable machine-readable error codes; clients must not depend on error message strings.
- Use idempotency for retryable side effects.
- Use cursor pagination for large mutable collections.
- Never translate arbitrary client filters into SQL.
- Distinguish current, stale, unknown and unavailable data.
- Long-running operations should use durable async operation contracts.
- Webhooks require signature validation, replay protection, schema validation and idempotency.
- APIs/commands represent intentional actions; versioned events represent facts that occurred.
- Sensitive and medical data is minimized according to actor, purpose and policy.
- Private data must never leak through shared/public caches.
- External providers are isolated behind typed adapters.

## Completion Criteria

Verify schema compatibility, authorization, tenant isolation, idempotency, error contracts, pagination, sensitive-data minimization, provider isolation, contract tests and deprecation strategy.
