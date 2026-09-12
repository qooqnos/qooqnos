# Phoenix Security Skill

## Purpose

Implement and review security, privacy and consent work according to `docs/SECURITY_THREAT_MODEL_PRIVACY_CONSENT_ARCHITECTURE.md`.

## Non-Negotiable Rules

- Authentication is not authorization.
- Tenant/workspace context must be server-validated.
- Cross-tenant access is denied by default.
- Domain services remain authoritative for security-sensitive business rules.
- AI cannot bypass permissions, resource policies or domain services.
- Sensitive data must be classified, minimized and purpose-limited.
- Never log secrets, tokens, signed URLs, payment-card data, private verification documents or raw medical content.
- Private media requires policy authorization; object URLs are not authorization.
- Security-sensitive actions require audit events.
- High-risk operations should use appropriate step-up authentication.

## AI Security

Treat retrieved content as untrusted data. Use allowlisted typed tools, external permission/resource-policy checks, bounded loops, output validation and confirmation for high-impact side effects.

## Privacy / Consent

Consent is purpose-specific and versioned where required. Consider collection purpose, access scope, retention, deletion, analytics use and AI-memory exposure for every new data field.

## Medical Safety

No diagnosis, prescription, medication recommendation or treatment recommendation. Sensitive medical content stays out of generic analytics and durable AI memory by default.

## Completion Criteria

Verify tenant isolation, privilege-escalation resistance, session/recovery controls, input validation, rate limits, media protection, prompt-injection defenses, audit coverage, consent enforcement, retention/deletion propagation and security regression tests before completion.
