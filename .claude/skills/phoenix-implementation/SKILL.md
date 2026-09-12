# Phoenix Implementation Skill

## Purpose

Turn Phoenix architecture into implementation work using `docs/IMPLEMENTATION_BLUEPRINT_FOUNDATION.md`.

## Rules

- Implement vertically, not as disconnected infrastructure layers.
- Keep modules as the owners of domain invariants and private persistence.
- Treat D1 as relational source of truth; R2 stores bytes; Queues run async work; Vectorize is derived retrieval infrastructure.
- Never expose database tables as the public API contract.
- Every protected operation resolves actor, tenant/workspace, membership, permission, entitlement and resource policy.
- Use typed contracts, stable error codes and idempotency for side effects.
- Build the shared frontend shell before duplicating UI patterns.
- AI may interpret, retrieve, rank and propose; it cannot bypass authorization, policy or domain services.
- Do not introduce microservices or infrastructure complexity without an explicit architectural reason.
- Security, tenant isolation and critical domain invariants are release-blocking from the first implementation.

## First Vertical Slice

Implement in this order:

1. Repository/bootstrap
2. Runtime + D1 foundation
3. Identity + authorization
4. Business onboarding + verification
5. Catalog/service offers
6. Discovery/search
7. AI intent + matching
8. Customer/partner/admin frontend slice
9. Booking
10. Communications

## Completion Criteria

A foundation implementation is not complete until a business can be onboarded and verified, a Beauty offer can be published and indexed, and a customer can discover it through the typed API and frontend while tenant/security tests pass.
