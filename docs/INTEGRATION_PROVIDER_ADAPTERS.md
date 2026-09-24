# Integration Provider Adapter Contract

## Purpose

The Integration module owns the boundary between Phoenix and external systems. Domain modules must never contain provider SDK calls, provider-specific payload models, credentials, or webhook verification logic.

The canonical execution path is:

```text
Phoenix capability/domain
        ↓
Integration Service
        ↓
Integration Provider Registry
        ↓
Provider Adapter Contract
        ↓
Credential Resolver
        ↓
Actual Provider
```

## Provider adapter contract

`IntegrationProviderAdapter` is the only runtime boundary for provider-specific integration behavior.

An adapter declares:

- `providerId`
- supported webhook types
- supported sync types
- normalized webhook processing
- normalized sync processing

The durable Integration worker owns claim/finish, retry, tenant context and external-reference persistence. Provider adapters do not own those concerns.

## Credential contract

Provider secrets are not stored in Integration domain tables.

`IntegrationCredentialResolver` resolves a credential by:

- provider id
- credential reference

The default implementation is environment-backed for deployment/runtime configuration. A secret-manager implementation can satisfy the same contract without changing Integration domain code.

Credential references are safe identifiers; secret values must never be written to D1, logs, API responses, external-reference metadata, or domain records.

## Configurable HTTP adapter

`createHttpIntegrationProviderAdapter` provides the common operational adapter for HTTP providers.

It provides:

- runtime credential injection
- bearer/API-key authorization
- correlation propagation
- bounded normalized HTTP error classification
- transient/permanent failure classification
- sync cursor/checkpoint forwarding
- normalized external-reference results
- signed HMAC webhook verification with replay-age protection

Provider-specific differences remain configuration or a dedicated adapter implementation:

- endpoint paths
- authentication scheme
- webhook event names
- payload mapping
- external resource mapping
- provider status normalization where the generic adapter is insufficient

## Webhook semantics

Inbound provider webhooks must be:

1. received without trusting the payload;
2. signature-verified by the provider adapter or its verifier;
3. normalized to Phoenix event identity/type;
4. persisted through the canonical Integration webhook boundary;
5. deduplicated by the provider event identity;
6. processed by the durable worker;
7. acknowledged/retried according to the provider contract.

Invalid or stale signatures fail closed.

## Provider onboarding

Operational activation checklist: `docs/INTEGRATION_VENDOR_ONBOARDING_RUNBOOK.md`.

A concrete provider is complete only when all of the following exist:

- registered `integration_providers` record;
- concrete adapter;
- credential provisioning/configuration;
- provider webhook verification and event mapping;
- provider-specific sync mapping where synchronization is supported;
- integration tests against the provider contract;
- documented operational configuration.

The repository currently provides the reusable runtime contract and configurable HTTP implementation. No provider-specific vendor is invented without an explicit provider contract; therefore concrete vendor onboarding remains an operational deployment task rather than a new domain implementation.
