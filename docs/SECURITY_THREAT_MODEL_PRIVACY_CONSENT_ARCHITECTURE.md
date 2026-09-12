# Phoenix Security Threat Model / Privacy / Consent Architecture

## 1. Purpose

Phoenix is a multi-tenant AI marketplace with customer, partner, admin and internal-team actors. Security therefore protects not only infrastructure, but also tenant boundaries, permissions, business data, sensitive files, AI context and regulated workflows.

## 2. Security Invariants

1. Authentication never implies authorization.
2. Every privileged request has an explicit actor and workspace/tenant context.
3. Cross-tenant access is denied by default.
4. Domain services enforce authorization-sensitive business invariants; UI checks are never sufficient.
5. AI cannot bypass identity, permissions, resource policy or domain services.
6. Verification and regulated approvals require separation of duties.
7. Sensitive data is classified before storage, processing or analytics use.
8. Secrets are never stored in source control or ordinary logs.
9. Public object URLs never constitute authorization.
10. Security failures fail closed for sensitive operations.

## 3. Threat Model

Primary threat actors:

- unauthenticated internet attackers
- compromised customer accounts
- compromised partner accounts
- malicious or compromised internal users
- automated bots and scraping systems
- malicious businesses attempting ranking/review manipulation
- prompt-injection content authors
- compromised third-party providers
- accidental developer/operator misuse

## 4. Assets

Critical assets include:

- identities and sessions
- workspace memberships and permissions
- business verification evidence
- private media and documents
- customer contact information
- booking information
- communications
- billing/entitlement data
- audit/security events
- AI prompts/context/tool results
- marketplace ranking signals
- country/legal policy configuration

## 5. Trust Boundaries

```text
Internet
  -> Edge
  -> Application
  -> Identity / Authorization
  -> Domain Services
  -> D1 / R2 / Queues / Vectorize
  -> External Providers
```

Additional trust boundary:

```text
Untrusted content
  -> Retrieval / AI context
  -> AI Gateway
  -> Tool Policy
  -> Domain Service
```

Retrieved text is data, not instructions.

## 6. Authentication

Use a managed identity provider rather than building a custom authentication server initially.

Sessions should be:

- short-lived where appropriate
- revocable
- rotated
- protected with secure HttpOnly cookies
- SameSite-aware
- bound to the authenticated identity

High-risk actions require step-up authentication/MFA where supported.

## 7. Authorization Pipeline

Every sensitive operation follows:

```text
Actor
 -> Authentication
 -> Tenant/Workspace Context
 -> Membership
 -> Role/Permission
 -> Entitlement
 -> Resource Policy
 -> Domain Rule
 -> Execute
 -> Audit
```

Examples of step-up operations:

- changing privileged permissions
- exporting sensitive data
- accessing restricted verification material
- financial administration
- destructive actions
- security-setting changes

## 8. Tenant Isolation

Tenant/workspace identity must be explicit in:

- request context
- repositories
- cache keys
- queues/jobs
- analytics
- search/index metadata
- media references
- audit events

Repositories should make accidental unscoped queries difficult or impossible.

Never trust a client-provided tenant ID without server-side membership validation.

## 9. Privilege Escalation Defense

Do not derive permissions from client claims alone.

Server-side authorization must verify:

- active membership
- role assignment
- permission
- workspace scope
- resource ownership/scope
- entitlement when relevant
- policy restrictions

Role changes and privileged invitations are auditable and preferably require step-up authentication.

## 10. Account Security

Protect against:

- credential stuffing
- session theft
- session fixation
- recovery abuse
- invitation abuse
- account enumeration
- brute force
- suspicious login automation

Recovery tokens must be short-lived, one-time and replay-resistant.

Security responses should avoid revealing whether a target account exists.

## 11. Web/API Security

Baseline controls:

- strict input/schema validation
- output encoding
- CSRF protection where cookie authentication requires it
- secure CORS policy
- content-type validation
- request size limits
- rate limiting
- abuse detection
- safe error responses
- dependency/security scanning
- security headers where applicable

Never interpolate untrusted input into SQL or executable commands.

## 12. Data Classification

Use at least:

- Public
- Internal
- Confidential
- Personal
- Sensitive
- Regulated

Classification determines storage, logging, analytics, access, retention and deletion behavior.

## 13. Privacy by Design

For every new data field ask:

1. Why is it needed?
2. What purpose permits its use?
3. Who can access it?
4. How long should it live?
5. Can it be minimized, derived or avoided?
6. Is consent required?
7. Can it safely enter analytics or AI context?

Collecting data merely because it may be useful later is discouraged.

## 14. Consent Architecture

Consent is purpose-specific, versioned and auditable.

A consent record should support:

```text
subject_id
purpose
policy_version
status
given_at
withdrawn_at
source
locale
```

Examples of purposes:

- marketing communication
- personalization
- optional analytics
- sensitive-data processing
- document processing

Transactional communications may follow a different legal basis from marketing; the policy engine decides applicability.

Withdrawal must prevent future processing for that purpose where legally required. Historical records are retained only where another lawful retention requirement applies.

## 15. Medical / Regulated Data

Phoenix medical workflows must not diagnose, prescribe, recommend medication or recommend treatment.

Medical data should be:

- purpose-limited
- minimized
- consent-aware where required
- access-controlled
- excluded from generic analytics by default
- excluded from durable AI memory by default
- audited when accessed for privileged operational purposes

Provider credentials must be verified before activation.

Regulated provider claims require policy review where applicable.

## 16. File / Media Security

Verification documents and sensitive uploads are private by default.

Security requirements:

- short-lived upload targets
- MIME/content validation
- malware scanning
- isolated processing
- opaque object keys
- short-lived scoped download URLs
- access logging
- retention/deletion policy

Deleting a reference must not accidentally expose or orphan sensitive bytes.

## 17. AI Threat Model

AI-specific threats:

- prompt injection
- indirect prompt injection through provider/catalog/review content
- tool abuse
- privilege confusion
- data exfiltration
- malicious tool arguments
- hallucinated availability/price/credentials
- cross-tenant context leakage
- excessive agent loops
- sensitive memory persistence

Required control:

```text
Untrusted input
 -> AI Gateway
 -> structured intent
 -> permission/policy checks
 -> domain service
```

Never allow an LLM to execute arbitrary SQL, call arbitrary URLs, choose an unrestricted tenant, or directly mutate authoritative storage.

## 18. Prompt Injection Defense

Treat all retrieved content as untrusted data.

Controls:

- separate instructions from retrieved content
- strict tool schemas
- allowlisted tools
- permission checks outside the model
- resource-policy checks outside the model
- output validation
- bounded tool loops
- confirmation for high-impact side effects
- audit tool executions

A model's confidence is never an authorization decision.

## 19. Search / Ranking Abuse

Protect against:

- keyword stuffing
- fake profiles
- fake reviews
- review bombing
- coordinated engagement
- fabricated claims
- spam listings
- manipulation of recommendation signals

Sponsored or promoted results, if introduced, must be clearly distinguishable and cannot bypass hard eligibility or safety rules.

## 20. Rate Limiting

Rate limits should be risk- and resource-aware rather than one global number.

Potential dimensions:

- IP/network
- actor
- workspace
- endpoint
- resource
- authentication state
- tool
- provider

High-risk operations receive stricter controls.

## 21. Secrets Management

Secrets must live in the platform's secret/configuration facilities, never:

- Git
- client bundles
- D1 records unless specifically designed as encrypted secret storage
- logs
- analytics events
- error messages

Rotate provider credentials and invalidate compromised credentials quickly.

## 22. Encryption

Use encrypted transport for external and internal network communication where applicable and platform-managed encryption at rest.

Application-level encryption should be introduced for particularly sensitive fields when justified by the threat model and operational requirements.

Keys must be separated from encrypted data and managed through secure secret/key infrastructure.

## 23. Audit Logging

Audit security-sensitive actions:

- authentication/security changes
- membership changes
- permission changes
- sensitive-data access
- verification decisions
- moderation decisions
- financial administration
- data exports
- destructive actions
- privileged AI tool execution

Audit records should include actor, scope, action, target, outcome, time, request/correlation ID and policy context where useful.

Audit logs are append-oriented and protected from ordinary business-user mutation.

## 24. Privacy Requests

The architecture should support policy-driven:

- access/export
- correction
- deletion
- consent withdrawal
- retention expiration
- restricted processing

Deletion must propagate to derived stores where applicable, including search indexes, analytics datasets, caches and AI memory.

Legal retention may require selective preservation; this must be explicit and auditable.

## 25. Incident Response

Security events should support:

```text
Detect
 -> Triage
 -> Contain
 -> Investigate
 -> Remediate
 -> Recover
 -> Review
```

High-risk events may trigger session revocation, credential rotation, account suspension, provider isolation or feature disablement.

Incident actions must be auditable.

## 26. Security Headers / Browser Boundary

The web application should establish a deliberate browser security baseline including an appropriate Content Security Policy, frame restrictions, referrer policy, MIME sniffing protection and secure cookie configuration.

Exact headers should be validated against the frontend architecture before production rollout.

## 27. Security Testing

Required test families:

- cross-tenant access
- cross-workspace access
- horizontal privilege escalation
- vertical privilege escalation
- suspended-member access
- session revocation
- recovery replay
- invitation replay
- enumeration
- CSRF where applicable
- schema/input abuse
- rate-limit enforcement
- private media access
- signed URL expiry
- prompt injection
- malicious tool arguments
- AI cross-tenant leakage
- sensitive logging regression
- retention/deletion propagation

## 28. Security Architecture Review Gate

Before enabling a new module, verify:

- data classification
- permission matrix
- resource policies
- tenant boundaries
- audit events
- rate limits
- secrets requirements
- privacy/consent requirements
- retention/deletion
- AI exposure, if any
- abuse cases
- failure behavior

## 29. Definition of Done

Security/privacy work is complete only when:

- trust boundaries are documented
- authentication and authorization are separated
- tenant isolation is enforced server-side
- privileged operations have appropriate step-up controls
- sensitive data is classified and minimized
- consent is purpose/version aware where required
- private media is policy-protected
- AI cannot bypass policy/domain authorization
- audit coverage exists for high-risk actions
- retention/deletion behavior is defined
- security and privacy tests cover critical abuse paths
