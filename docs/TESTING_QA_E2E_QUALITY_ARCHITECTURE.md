# Phoenix Testing / QA / E2E / Quality Architecture

## 1. Purpose

Phoenix quality must validate not only individual functions, but the architectural invariants that make the marketplace safe: modular boundaries, tenant isolation, authorization, AI safety, transactional correctness, privacy, search quality and reliable deployment.

## 2. Testing Pyramid

```text
                 E2E / Critical Journeys
                       /       \
                Contract / Integration
                    /           \
              Module / Domain Tests
                 /               \
             Unit / Pure Logic Tests
```

Use the cheapest reliable test at the lowest appropriate layer.

## 3. Test Categories

### Unit

Validate pure domain logic:

- ranking calculations
- policy decisions
- state transitions
- money/date/calendar formatting
- availability rules
- permission predicates
- normalization
- parsers/validators

### Module Tests

Validate a module as a bounded unit:

- public service contracts
- repositories
- commands
- events
- permissions
- lifecycle
- migration compatibility

### Integration Tests

Validate real collaboration between infrastructure and modules:

- D1 transactions
- Outbox
- Queues
- R2 metadata/object workflows
- Vectorize adapters
- provider adapters
- authorization/resource policy

### Contract Tests

Every public module interface and versioned event has contract coverage.

Contract tests must detect breaking changes before deployment.

### E2E

Validate critical user journeys through the real application boundary.

## 4. Architectural Invariants

The following must have automated tests:

- cross-tenant access is denied
- cross-workspace access is denied
- suspended membership cannot perform protected actions
- permissions are enforced server-side
- entitlements do not replace authorization
- AI tools cannot bypass policy
- AI cannot directly execute arbitrary SQL
- private Media assets cannot be fetched without authorization
- unverified businesses cannot enter eligible Discovery results
- unpublished offers cannot appear as published marketplace results
- stale availability cannot be presented as confirmed availability
- unknown availability is never treated as available
- review eligibility cannot be fabricated by the client
- medical AI cannot diagnose, prescribe or recommend treatment/medication

## 5. Identity / Authorization Test Matrix

Test combinations of:

```text
Actor
× Workspace
× Membership State
× Role/Permission
× Entitlement
× Resource Ownership
× Resource Sensitivity
× Action
```

Important cases:

- customer accessing another customer's resource
- partner accessing another tenant
- admin without required privileged permission
- suspended member
- removed member with stale session
- background job with explicit system identity
- AI tool with insufficient permission
- sensitive resource without required purpose/consent

## 6. Tenant Isolation

Tenant isolation is a release-blocking security property.

Tests must cover:

- API parameters
- repository queries
- cache keys
- queues
- search indexes
- Vectorize metadata filters
- Media object references
- analytics events
- audit records
- AI context

A tenant ID must never be inferred from untrusted resource identifiers alone.

## 7. Module Boundary Tests

Verify:

- modules use public contracts for cross-module operations
- no direct SQL against another module's private tables
- dependency graph has no cycles
- disabled modules cannot expose active capabilities
- event schemas are versioned
- commands validate actor and context
- UI extensions respect module contracts

## 8. Database Testing

Each migration should have:

- clean-install test
- upgrade-from-previous-version test
- compatibility test
- data-preservation test
- backfill test where applicable

Critical transactions must test concurrency.

Examples:

- two users attempting the same slot
- duplicate booking request
- duplicate webhook
- duplicate queue delivery
- concurrent inventory/availability updates

## 9. Booking / Availability QA

Test:

- timezone boundaries
- DST transitions
- Jalali/Gregorian conversion
- holidays/exceptions
- buffers
- capacity
- lead time
- booking horizon
- short-lived holds
- hold expiry
- finalization race
- cancellation
- rescheduling
- no-show
- idempotency

A test must prove that two concurrent finalizations cannot oversell the same capacity.

## 10. Search / Discovery QA

Test both correctness and quality.

Correctness:

- hard filters
- tenant isolation
- visibility
- publication
- verification
- locale
- geospatial constraints
- stale data handling

Quality:

- precision@k
- recall@k
- nDCG
- zero-result rate
- click-through
- contact conversion
- booking conversion

Create golden query sets for Persian, multilingual and natural-language queries.

## 11. Persian / Localization QA

Test:

- Persian and Arabic character normalization
- ZWNJ/half-space
- mixed Persian/Latin text
- numerals
- RTL layout
- LTR layout
- Jalali/Gregorian presentation
- timezone/DST
- pluralization
- localized currency
- fallback locale behavior

UI tests must verify that localization does not change authorization or business meaning.

## 12. AI Safety and Reliability QA

AI is tested as an untrusted probabilistic component.

Test:

- malformed structured output
- hallucinated availability
- hallucinated price
- fabricated credentials
- prompt injection
- indirect prompt injection through catalog/media content
- unauthorized tool invocation
- privilege confusion
- cross-tenant retrieval
- sensitive-memory leakage
- excessive agent loops
- timeout/cancellation
- provider failure
- fallback behavior

Golden tests should assert policy outcomes, not exact wording.

## 13. Medical Safety Test Suite

A dedicated blocking suite must verify that medical flows do not:

- diagnose
- prescribe
- recommend medication
- recommend treatment
- fabricate clinical facts
- activate unverified providers
- expose sensitive medical information unnecessarily

Allowed-flow tests should cover provider discovery, service matching, provider-published information summaries, contact and scheduling.

## 14. Media Security QA

Test:

- upload authorization
- MIME/content mismatch
- oversized files
- malformed files
- decompression/resource exhaustion
- malware/quarantine workflow
- private object access
- signed URL expiry
- object key isolation
- derivative generation
- retention/deletion
- access audit

## 15. Communications QA

Test:

- consent policy
- marketing opt-out
- transactional messages
- template versioning
- localization
- retries
- permanent vs transient failures
- webhook signature validation
- duplicate webhook
- provider outage
- sensitive-data minimization

## 16. Billing QA

Test:

- plan lifecycle
- entitlement evaluation
- quota boundaries
- usage metering
- idempotent webhooks
- provider failure
- currency minor units
- invoice/charge state transitions when enabled
- no raw payment-card data in Phoenix storage

## 17. Reviews / Reputation QA

Test:

- verified interaction eligibility
- duplicate review prevention
- moderation states
- report flows
- business response moderation
- reputation recalculation
- abuse signals
- tenant isolation
- AI inability to publish/remove/manipulate reputation

## 18. Privacy / Consent QA

Test:

- consent purpose isolation
- withdrawal propagation
- access/export requests
- deletion propagation
- retention enforcement
- sensitive data masking
- analytics exclusion
- AI memory exclusion/default minimization
- audit coverage

Deletion tests must verify propagation to derived stores such as search, analytics, caches and AI memory where applicable.

## 19. API / Web Security QA

Automate checks for:

- schema validation
- authentication
- authorization
- rate limits
- request-size limits
- CORS policy
- CSRF protection where applicable
- safe error responses
- output encoding
- security headers
- injection resistance
- enumeration resistance

## 20. Property-Based / Fuzz Testing

Use property-oriented tests for high-risk pure logic:

- money arithmetic
- date/calendar conversion
- ranking bounds
- query normalization
- state transitions
- permission composition
- parsers

Useful invariants:

- monetary values never use floating-point semantics
- invalid state transitions are rejected
- unauthorized actors never gain permission through malformed input
- normalization never crosses tenant/resource boundaries

## 21. Load / Performance Testing

Test representative workloads:

- search bursts
- availability reads
- concurrent booking
- login/recovery abuse
- media upload bursts
- queue spikes
- AI request bursts
- webhook storms

Track p50/p95/p99 latency, error rate, throughput and resource consumption.

## 22. Failure / Chaos Scenarios

Simulate:

- D1 latency/error
- Queue delay/duplicate delivery
- R2 unavailable
- Vectorize unavailable
- AI provider unavailable
- messaging provider unavailable
- billing provider unavailable
- stale search index
- partial deployment

Core transactional workflows must fail closed or degrade safely according to their domain policy.

## 23. E2E Critical Journeys

Minimum critical journeys:

### Customer

1. register/login
2. choose language/location
3. natural-language discovery
4. inspect recommendation
5. inspect offer/profile
6. contact business
7. request/confirm booking
8. receive communication
9. view history
10. provide eligible review

### Business

1. onboard
2. submit verification
3. create offer
4. publish after required gates
5. configure availability
6. receive booking
7. communicate
8. inspect CRM/analytics
9. manage team permissions

### Admin

1. inspect verification queue
2. review evidence
3. approve/reject according to policy
4. moderate content
5. inspect audit/security events
6. manage feature/module state

## 24. Test Data Strategy

Use generated deterministic fixtures.

Separate:

- unit fixtures
- integration fixtures
- E2E seed data
- staging test data

Never copy production customer data into test environments unless explicitly sanitized and approved.

Sensitive/medical fixtures must be synthetic.

## 25. Test Isolation

Each test should isolate:

- tenant
- workspace
- actor
- database state
- queue messages
- external provider mocks
- feature flags

Tests must not depend on execution order.

## 26. CI Test Tiers

### Every commit

- lint/format
- typecheck
- unit tests
- module tests
- security static checks

### Main branch

- integration
- contract
- migration
- architectural invariant tests

### Release

- full E2E
- performance smoke
- security suite
- production-like migration test

### Scheduled

- extended load tests
- fuzz tests
- dependency/security audit
- AI evaluation suite

## 27. Quality Gates

Release is blocked by:

- failed critical tests
- tenant isolation regression
- authorization regression
- migration incompatibility
- medical safety regression
- critical security finding
- broken module contract
- corrupted financial invariant
- booking oversell race

## 28. Observability of Tests

Publish test results with:

- commit SHA
- environment
- test suite/version
- duration
- failure classification
- artifact/log reference

Flaky tests must be tracked, not silently ignored.

## 29. Definition of Done

A feature is complete only when:

- unit/domain tests exist
- module contract tests exist where applicable
- authorization/tenant tests exist
- integration tests cover infrastructure boundaries
- E2E covers critical user impact
- security/privacy tests pass
- localization is covered where relevant
- observability is present
- failure behavior is tested
- migrations are tested
- documentation/skill rules are updated
