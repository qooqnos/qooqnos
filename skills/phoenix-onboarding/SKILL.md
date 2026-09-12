# Phoenix Business Onboarding Skill

## Purpose

Implement Business/Provider onboarding in Phoenix without violating modularity, authorization, security, verification, AI, or Discovery boundaries.

## Required Reading

Before changing onboarding code, read:

1. `CLAUDE.md`
2. `docs/PHOENIX_ARCHITECTURE.md`
3. `docs/MODULE_ARCHITECTURE.md`
4. `docs/CORE_RUNTIME_ARCHITECTURE.md`
5. `docs/AUTHORIZATION_ARCHITECTURE.md`
6. `docs/SECURITY_ARCHITECTURE.md`
7. `docs/AI_ARCHITECTURE.md`
8. `docs/DISCOVERY_MATCHING_ARCHITECTURE.md`
9. `docs/BUSINESS_ONBOARDING_VERIFICATION_ARCHITECTURE.md`

## Non-Negotiable Rules

- Never make publication a client-only state change.
- Never represent verification as a single trusted boolean.
- Never allow unverified/blocked supply into customer-facing Discovery.
- Never let AI approve credentials or activate a business.
- Never expose verification documents through public URLs.
- Never query another module's private tables directly.
- Never bypass tenant/workspace authorization.
- Never let `business.update` imply verification approval.
- Never let expired credentials remain trusted without policy evaluation.
- Never treat AI-extracted information as authoritative without provenance.
- Never put country/legal requirements directly into generic Core business logic.

## Implementation Workflow

### 1. Define the Domain

Identify:

- business aggregate
- locations
- categories
- contacts
- operating hours
- catalog references
- publication state
- verification state

Separate mutable domain state from derived Discovery state.

### 2. Build Explicit Commands

Prefer domain/application commands:

```text
createBusiness()
updateBusinessProfile()
submitOnboarding()
submitVerification()
requestChanges()
approveVerification()
rejectVerification()
publishBusiness()
suspendBusiness()
expireCredential()
```

Commands must validate:

1. current state
2. tenant/workspace context
3. actor authorization
4. policy requirements
5. domain invariants

### 3. Verification

Implement verification as requirement/check/decision data.

A requirement can be:

- pending
- passed
- failed
- expired
- waived only when an explicit policy permits it

Store evidence metadata and protected storage references. Do not copy sensitive files into logs, events, analytics, or prompts.

### 4. Publication Gate

Before `publishBusiness()` succeeds, evaluate all required gates:

```text
profileComplete
verificationPassed
policyPassed
moderationClear
workspaceActive
```

For regulated providers, include credential verification.

### 5. Events

Use outbox events after successful transactions.

Examples:

```text
business.profile.published.v1
business.profile.updated.v1
business.profile.suspended.v1
verification.status.changed.v1
```

Consumers must be idempotent.

### 6. Discovery

Do not write directly into search indexes from request handlers unless the architecture explicitly requires a small synchronous projection.

Prefer:

```text
D1 transaction
→ outbox
→ async indexing job
→ Discovery projection
```

The Discovery index must contain enough metadata to enforce tenant, publication, visibility, locale, and version boundaries.

### 7. AI Assistance

AI can assist with:

- category suggestions
- service/product extraction
- missing-field detection
- description drafting
- translation
- duplicate-risk hints
- inconsistent-claim flags

AI output must be represented as a suggestion or attributable imported value. A model output must never silently become a verification fact.

### 8. Medical Rules

Medical onboarding is high-risk.

Before activation, required professional credentials must be verified according to the configured jurisdiction/policy.

AI must not:

- diagnose
- prescribe
- recommend treatment
- infer professional qualification from text/image alone
- approve an unverified provider
- convert provider marketing into a platform-verified clinical claim

Allowed use cases include provider discovery, service matching, provider-published information, scheduling/contact, and organizing user-provided information.

### 9. Permissions

Use granular permissions such as:

```text
business.read
business.update
business.publish
business.suspend
business.verification.submit
business.verification.view
business.verification.review
business.verification.approve
business.catalog.manage
```

Enforce permissions server-side and resource-scoped.

### 10. Audit

Audit privileged transitions and verification decisions.

At minimum capture:

- actor
- tenant/workspace
- target
- action
- result
- timestamp
- request/correlation id
- relevant policy/version

Do not log raw verification documents or unnecessary sensitive data.

## Recommended Module Structure

```text
modules/business/
├── manifest.ts
├── domain/
│   ├── business.ts
│   ├── publication.ts
│   └── value-objects.ts
├── application/
│   ├── commands/
│   ├── queries/
│   └── services/
├── infrastructure/
│   ├── repositories/
│   └── policies/
├── api/
├── events/
├── jobs/
├── policies/
├── ui/
├── migrations/
├── locales/
├── tests/
└── README.md
```

Verification may be its own module when implementation complexity warrants it; otherwise preserve clear ownership boundaries inside the Business capability.

## Testing Checklist

Before commit, verify:

- [ ] tenant isolation
- [ ] workspace membership authorization
- [ ] state transition validity
- [ ] publication gates
- [ ] verification expiry
- [ ] evidence access control
- [ ] separation of review/approval permissions
- [ ] audit events
- [ ] outbox idempotency
- [ ] Discovery excludes unpublished supply
- [ ] AI suggestions retain provenance
- [ ] medical restrictions
- [ ] multilingual/RTL handling
- [ ] country-policy behavior
- [ ] abuse/rate-limit paths

## Definition of Done

A change is ready only when a reviewer can demonstrate that:

1. a business can onboard without bypassing authorization;
2. incomplete data remains non-public;
3. verification decisions are explicit and auditable;
4. publication is server-enforced;
5. sensitive evidence is protected;
6. Discovery receives only eligible published records;
7. AI remains advisory/orchestrating rather than authoritative;
8. medical onboarding remains within its safety boundary;
9. all cross-module communication follows defined contracts;
10. tests prove the critical invariants.

## Commit Discipline

Use focused direct commits on `main` for this project. Do not create Pull Requests unless the user explicitly asks for one.
