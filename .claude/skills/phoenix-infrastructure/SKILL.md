# Phoenix Infrastructure Skill

## Purpose

Implement and review Cloudflare infrastructure, deployment, environments and CI/CD according to `docs/CLOUDFLARE_INFRASTRUCTURE_DEPLOYMENT_CICD_ARCHITECTURE.md`.

## Non-Negotiable Rules

- Phoenix remains a modular monolith.
- Production deployments are tied to immutable Git commits.
- Preview/staging/production resources and credentials are isolated.
- Secrets never live in Git, client bundles or ordinary logs.
- D1 is authoritative transactional storage; R2 stores bytes; Queues handle async work; Vectorize is derived retrieval infrastructure.
- Module migrations are registered, ordered and observable.
- Prefer expand/contract migrations and backward-compatible events.
- Analytics/search/index failures must not block core transactions.
- External providers are accessed through adapters.
- Background jobs are tenant-aware, idempotent, observable and replayable.

## CI/CD Gates

Validate formatting/lint, types, tests, module contracts, security, migrations, build integrity and deployment smoke tests before production.

## Production Safety

Track deployment commit/version, migration state and health. Use feature flags for progressive rollout and prefer known-good redeployment or forward-compatible recovery over destructive database rollback.

## Completion Criteria

Verify environment isolation, secret handling, migration compatibility, health checks, observability, queue idempotency, provider isolation, rollback/recovery, disaster-rebuild paths and cost controls before completion.
