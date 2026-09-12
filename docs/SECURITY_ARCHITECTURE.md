# Phoenix AI Marketplace — Security Architecture

> Status: Security Baseline  
> Scope: Web, API, Cloudflare, identity, data, AI, storage, operations and supply chain

## 1. Security Objective

Phoenix is a multi-tenant AI marketplace. Security must protect customer data, business data, credentials, AI interactions, sensitive industry information and platform administration while preserving speed and usability.

Security is designed as a layered system rather than a single product or middleware.

## 2. Security Principles

1. Secure by default.
2. Least privilege.
3. Default deny.
4. Tenant isolation is mandatory.
5. Validate untrusted input at every trust boundary.
6. Never trust the browser.
7. Secrets never enter source control or logs.
8. AI output is untrusted input.
9. High-risk actions require stronger controls and auditability.
10. Security controls must be observable and testable.
11. Minimize collection and retention of sensitive data.
12. Prefer reversible, staged changes over destructive operations.

## 3. Threat Model

Primary threat classes:

```text
Account takeover
Credential theft
Session theft
Cross-tenant access
IDOR / object enumeration
Privilege escalation
Injection
XSS / CSRF
Abuse / automation
Data exfiltration
Malicious uploads
Supply-chain compromise
AI prompt injection
AI tool abuse
Insider misuse
Configuration mistakes
Denial of service
```

Threat modeling is required for new high-risk modules and workflows.

## 4. Trust Boundaries

```text
Browser
  ↓ untrusted
Edge / WAF
  ↓
Worker API
  ↓
Auth + Authorization
  ↓
Domain Services
  ↓
Repositories
  ↓
D1 / R2 / Vectorize

External AI Provider
  ↕ controlled gateway

Queue / Worker
  ↓ explicit service identity
```

Every boundary validates input and authorization appropriate to the operation.

## 5. Cloudflare Edge Security

Recommended edge controls:

- WAF rules
- rate limiting
- bot/abuse controls where appropriate
- TLS
- secure headers
- Turnstile for abuse-sensitive public flows
- Cloudflare Access for private administrative/staging surfaces where appropriate
- cache rules that never expose private responses

Security must not depend on one edge control; application authorization remains mandatory.

## 6. HTTP Security Headers

The web/API layer should establish an appropriate baseline including:

```text
Content-Security-Policy
Strict-Transport-Security
X-Content-Type-Options: nosniff
Referrer-Policy
Permissions-Policy
```

Use CSP deliberately. Avoid broad `unsafe-inline`/`unsafe-eval` allowances unless an explicitly documented requirement exists.

## 7. Content Security Policy

CSP should restrict:

- scripts
- frames
- objects
- connections
- images
- styles
- fonts

Third-party origins must be explicitly allowlisted.

Changes to CSP require testing because an overly broad policy weakens security while an overly strict policy can break the application.

## 8. Authentication

Authentication must be centralized in `packages/auth`.

Requirements:

- secure session design
- short-lived credentials where appropriate
- refresh/re-authentication controls for sensitive actions
- secure cookie attributes for cookie-based sessions
- session revocation
- account status enforcement
- protection against credential stuffing and brute force
- MFA support for privileged accounts

Do not build a custom cryptographic protocol.

## 9. Session Security

Session cookies, when used, should normally use:

```text
Secure
HttpOnly
SameSite=Lax or Strict where compatible
```

Session identifiers must be random, opaque and treated as secrets.

Never log raw session tokens.

Sensitive actions may require recent authentication or step-up authentication.

## 10. CSRF

For cookie-authenticated state-changing requests, implement CSRF protection appropriate to the chosen authentication architecture.

Do not assume SameSite alone solves every deployment scenario.

For bearer-token APIs, protect token acquisition/storage and avoid putting access tokens in URLs.

## 11. CORS

Use an explicit allowlist.

Avoid:

```text
Access-Control-Allow-Origin: *
```

for credentialed/private APIs.

CORS is not authorization; the server still validates identity and permissions.

## 12. Input Validation

All external input must be validated at the boundary.

Use runtime schemas for:

- JSON bodies
- query parameters
- path parameters
- headers where relevant
- webhook payloads
- AI tool arguments
- uploaded-file metadata

Reject malformed input early.

## 13. Injection Defense

Use parameterized queries exclusively.

Never concatenate user input into SQL, shell commands or dynamic code.

For rendered HTML/content:

- escape by default
- sanitize intentionally trusted rich text
- avoid dangerous HTML execution paths

## 14. XSS

Treat user-generated business descriptions, reviews, messages, portfolio content and AI-generated text as untrusted.

The UI should render data safely and use sanitization only where rich text is explicitly required.

## 15. File Upload Security

Uploads to R2 must be treated as untrusted.

Controls:

- size limits
- MIME/type validation
- extension validation
- content validation where appropriate
- generated object keys rather than user-controlled paths
- malware scanning where risk justifies it
- private-by-default storage for sensitive files
- signed/time-limited access URLs where appropriate
- image transformation in controlled pipelines

Never execute uploaded content.

## 16. Secrets Management

Secrets include:

```text
API keys
AI provider keys
session secrets
signing keys
webhook secrets
database credentials where applicable
```

Rules:

- never commit secrets
- never print secrets
- never place secrets in frontend bundles
- use platform secret/configuration mechanisms
- rotate secrets periodically and after suspected exposure
- use separate credentials per environment where practical

## 17. Environment Isolation

At minimum:

```text
development
staging
production
```

Production credentials must never be reused casually in development.

Production data must not be copied into development without an explicit privacy-safe process.

## 18. Tenant Isolation

Tenant isolation is both an authorization and data-access invariant.

Every tenant-owned repository operation must require tenant context.

A security test must prove that a valid object ID from Tenant B cannot be accessed by Tenant A.

## 19. Authorization

Use the centralized authorization system defined by:

- `AUTHORIZATION_ARCHITECTURE.md`
- `AUTHORIZATION_IMPLEMENTATION.md`

Security-sensitive endpoints must not implement ad-hoc role checks.

## 20. Rate Limiting and Abuse Prevention

Rate-limit based on the risk and identity of the operation.

Examples:

```text
login attempts
OTP requests
password/reset attempts
public search
AI requests
message sending
file uploads
booking creation
review submission
verification submission
```

Use stronger controls for anonymous and suspicious traffic.

Rate limiting must be designed so one tenant cannot trivially starve shared platform resources.

## 21. Turnstile / Human Verification

For abuse-sensitive public flows, human verification can be added as a defense-in-depth control.

Validation must happen server-side. Client-side presence of a token is never sufficient.

Tokens are short-lived and one-use; failed verification must fail closed for the protected action.

## 22. Abuse Controls

Track signals such as:

```text
request velocity
IP reputation signals
account age
failed authentication
repeated verification failures
AI usage spikes
unusual export behavior
mass messaging
mass booking creation
```

Use these signals for throttling, review and fraud/risk workflows rather than relying on one binary score.

## 23. Data Classification

Define at least:

```text
Public
Internal
Confidential
Restricted
Highly Restricted
```

Examples:

- public business profile → Public
- internal operational notes → Internal/Confidential
- identity verification documents → Restricted
- sensitive medical information → Highly Restricted
- credentials/secrets → Restricted and never application-readable unless required

Classification should drive access, retention, logging and storage policy.

## 24. Privacy by Design

Collect only data needed for a defined product purpose.

Support:

- informed consent where required
- purpose limitation
- retention policies
- deletion/anonymization workflows where legally and technically appropriate
- export/data portability where required
- access auditing for sensitive data

Do not treat privacy as a frontend-only feature.

## 25. Medical Data Boundary

Medical information requires stronger controls than ordinary marketplace data.

Requirements include:

- explicit access permissions
- purpose-aware access policies
- consent records where applicable
- provider credential verification
- audit of sensitive-data access
- restricted AI processing
- region/country-specific compliance review before market launch

Phoenix must not position the AI as a diagnostic or treatment authority.

## 26. Encryption

Use encryption in transit and rely on managed encryption at rest provided by the infrastructure where appropriate.

Highly sensitive application data may require application-level encryption, but key management must be designed before implementation.

Do not invent custom encryption schemes.

## 27. Audit Logging

Audit high-risk security events:

```text
login/security events
role changes
permission changes
privileged access
impersonation
verification decisions
sensitive-data reads
exports
refunds
module activation
security setting changes
```

Audit records should be tamper-resistant from ordinary application users.

Do not put passwords, tokens or unnecessary sensitive payloads into logs.

## 28. Logging Policy

Application logs should be structured and include a request/correlation ID.

Never log:

```text
passwords
session tokens
API keys
full payment secrets
raw medical data unless explicitly required and protected
```

Use redaction at the logging boundary as defense in depth.

## 29. AI Security

AI introduces additional attack surfaces:

```text
prompt injection
indirect prompt injection
malicious retrieved content
tool abuse
data exfiltration
model hallucination
unsafe generated code
cross-user context leakage
provider data handling risk
```

Treat all retrieved content and model output as untrusted.

## 30. AI Tool Sandboxing

AI tools should have:

- explicit schemas
- explicit permissions
- bounded inputs
- bounded outputs
- timeouts
- rate limits
- resource scope
- audit events for high-risk actions

A model should never receive unrestricted database or infrastructure credentials.

## 31. AI Prompt Injection Defense

Do not assume system prompts can make untrusted content safe.

Separate:

```text
trusted instructions
user input
retrieved business content
external web content
tool output
```

Apply authorization and validation after model reasoning, before side effects.

## 32. AI Provider Isolation

Use an AI provider abstraction so Phoenix can route workloads without coupling business logic to one provider.

The provider layer must not receive data beyond the minimum required for the request.

Sensitive data should be excluded or redacted from external providers when policy requires it.

## 33. AI Cost / Abuse Controls

Enforce per-user/tenant quotas and rate limits where appropriate.

Track:

```text
provider
model
input units
output units
latency
error rate
estimated cost
request purpose
```

These metrics support both security and economics.

## 34. Dependency Security

CI should include:

- dependency vulnerability scanning
- lockfile review
- secret scanning
- static analysis
- type checking
- tests
- build verification

High-risk dependency changes require review.

Do not blindly auto-upgrade production dependencies without compatibility testing.

## 35. Supply Chain Security

Protect the build pipeline:

```text
GitHub
 ↓
CI validation
 ↓
Build
 ↓
Deployment credentials
 ↓
Cloudflare
```

Use least-privilege deployment credentials and keep them out of source code.

Pin or constrain important build dependencies appropriately.

## 36. Git Security

Never commit:

```text
.env
API keys
private keys
production dumps
customer exports
verification documents
medical records
```

Use repository secret scanning and pre-commit/CI checks where appropriate.

## 37. Webhook Security

Webhook handlers must validate:

- signature
- timestamp/replay constraints where supported
- expected event type
- payload schema
- idempotency

Never trust a webhook because it came from a public URL.

## 38. Idempotency

Security-sensitive mutations that may be retried should use idempotency where appropriate.

Examples:

```text
payment/refund
booking creation
verification submission
notification dispatch
```

This prevents retries from becoming accidental repeated actions.

## 39. Backup and Recovery

Security includes availability and recoverability.

Define:

- backup strategy
- retention
- point-in-time recovery where supported
- restore procedure
- recovery objectives
- periodic restore tests

A backup that has never been restored is not a proven recovery strategy.

## 40. Incident Response

Define an incident lifecycle:

```text
Detect
 ↓
Triage
 ↓
Contain
 ↓
Eradicate
 ↓
Recover
 ↓
Review
 ↓
Improve
```

Security incidents must produce actionable follow-up rather than only an alert.

## 41. Security Observability

Monitor:

```text
authentication failures
authorization denials
cross-tenant attempts
rate-limit triggers
suspicious exports
privileged actions
AI tool denials
upload anomalies
webhook failures
CI security failures
```

Alerting thresholds should evolve with actual traffic patterns.

## 42. Security Testing Strategy

### Unit

- policy decisions
- validation
- permission resolution
- sanitization

### Integration

- tenant isolation
- repository scope
- authentication/session behavior
- webhook verification

### E2E

- login
- privileged workflows
- customer isolation
- admin controls

### Security

- IDOR
- privilege escalation
- CSRF
- XSS
- injection
- upload abuse
- rate-limit bypass
- AI tool abuse

## 43. Threat-Driven Acceptance Tests

Each critical feature should answer:

```text
What happens if the user changes the ID?
What happens if the user changes tenant/workspace fields?
What happens if the request is replayed?
What happens if the user is suspended?
What happens if the module is disabled?
What happens if AI returns malicious tool arguments?
What happens if an uploaded file is malicious?
What happens if the request is sent without the frontend?
```

## 44. Security Levels by Operation

### Low risk

Public reads and ordinary discovery.

### Medium risk

Account/profile changes, messaging, booking mutations.

### High risk

Role changes, exports, verification approval, refunds, impersonation, sensitive-data access.

### Critical

Platform security settings, deployment credentials, cryptographic/signing material and equivalent infrastructure control.

Controls should become stronger as risk increases.

## 45. Secure Development Workflow

For every new feature:

```text
Threat model
 ↓
Data classification
 ↓
Authorization design
 ↓
Input validation
 ↓
Implementation
 ↓
Negative security tests
 ↓
Observability
 ↓
Documentation
```

Security review is part of Definition of Done.

## 46. Claude Code Security Rules

Claude Code must:

1. Read relevant architecture/security documents before changing protected flows.
2. Never add secrets to the repository.
3. Never bypass authorization to make tests pass.
4. Never weaken CSP, CORS or authentication without an explicit ADR.
5. Add negative tests for new protected endpoints.
6. Treat AI output as untrusted.
7. Avoid logging sensitive payloads.
8. Preserve tenant isolation in every query.
9. Prefer managed cryptography/security primitives.
10. Document material security decisions in Markdown.

## 47. Security Definition of Done

A feature is security-complete only when:

- threat model considered
- data classification considered
- authentication requirements defined
- authorization implemented server-side
- tenant isolation tested
- input validation implemented
- abuse controls considered
- secrets reviewed
- sensitive logging reviewed
- negative security tests pass
- observability exists for important failures
- documentation is updated

## 48. Final Decision

Phoenix security will use a defense-in-depth architecture across:

```text
Edge
+ HTTP Security
+ Authentication
+ Authorization
+ Tenant Isolation
+ Input Validation
+ Data Protection
+ AI Guardrails
+ Abuse Prevention
+ Audit
+ Observability
+ CI/Supply Chain
+ Backup/Recovery
```

No single control is considered sufficient. Security is a platform capability shared by every Phoenix module.