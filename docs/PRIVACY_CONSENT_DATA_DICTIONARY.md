# Phoenix Privacy & Consent Data Dictionary

**Status:** Canonical cross-cutting data contract  
**Scope:** Consent, privacy purpose, data classification, retention, deletion, and subject-rights references.

## 1. PrivacyPurpose

Defines why a data operation is permitted.

Fields:
- id;
- code;
- description;
- legal_basis_reference;
- data_categories;
- processing_scope;
- jurisdiction;
- policy_version;
- effective_from;
- effective_to;
- status.

## 2. ConsentRecord

Immutable record of a consent action where consent is the applicable basis.

Fields:
- id;
- subject_type;
- subject_id;
- purpose_id;
- scope;
- status;
- policy_version;
- consent_version;
- source;
- captured_at;
- withdrawn_at;
- expires_at;
- evidence_reference.

Withdrawal creates historical evidence; it does not erase the prior consent event.

## 3. ConsentScope

Defines the boundary of consent.

Examples:
- platform;
- organization;
- workspace;
- business;
- feature;
- communication_channel;
- data_category;
- processing_purpose.

Consent must not be interpreted more broadly than its explicit scope.

## 4. DataClassification

Canonical sensitivity classification.

Possible levels:
- PUBLIC;
- INTERNAL;
- CONFIDENTIAL;
- SENSITIVE;
- HIGHLY_SENSITIVE.

Classification determines storage, access, logging, retention, and deletion controls.

## 5. RetentionPolicy

Defines how long a data class/purpose may be retained.

Fields:
- id;
- data_category;
- purpose_id;
- jurisdiction;
- retention_period;
- legal_hold_behavior;
- deletion_method;
- effective_from;
- effective_to;
- policy_version.

## 6. DataSubjectRequest

Reference to a privacy-right request.

Types may include:
- ACCESS;
- EXPORT;
- RECTIFICATION;
- DELETION;
- RESTRICTION;
- OBJECTION.

Fields:
- id;
- subject_type;
- subject_id;
- request_type;
- scope;
- status;
- received_at;
- resolved_at;
- policy_version;
- authorization_reference.

## 7. ProcessingRestriction

Explicit restriction on a processing purpose or data scope.

Fields:
- id;
- subject_id;
- purpose_id;
- data_category;
- restriction_type;
- effective_from;
- effective_to;
- source_reference.

## 8. PrivacyPolicyVersion

Versioned privacy rules.

Fields:
- id;
- version;
- jurisdiction;
- effective_from;
- effective_to;
- data_categories;
- purposes;
- rights;
- retention_rules;
- status.

Active versions are immutable.

## 9. Consent Evidence

Consent evidence must preserve:
- subject;
- purpose;
- scope;
- policy/version;
- source;
- timestamp;
- consent version;
- withdrawal state.

Do not store unnecessary raw personal content as evidence.

## 10. State Machines

Consent:
```text
GRANTED → WITHDRAWN
GRANTED → EXPIRED
```

Request:
```text
RECEIVED → VALIDATING → IN_PROGRESS → COMPLETED
                         ↘ REJECTED
```

## 11. Ownership

| Data | Owner |
|---|---|
| Consent/privacy policy | Privacy/Security boundary |
| Identity | Identity |
| Customer representation | Customer |
| Business | Business |
| Communications delivery | Communications |
| AI processing | AI |
| Audit evidence | Database/Audit |
| Authorization | Authorization |

## 12. Authorization

Reading or mutating sensitive privacy records requires explicit authorization.

A consent record never grants application permission by itself; Authorization evaluates access separately.

## 13. AI Boundary

AI may assist with:
- classification;
- policy interpretation proposals;
- data discovery for a subject request;
- redaction suggestions.

AI may not:
- fabricate consent;
- infer consent from silence;
- silently broaden consent scope;
- override withdrawal;
- bypass retention/legal-hold rules.

## 14. Tenant Isolation

Tenant/workspace scope is explicit for tenant-owned consent and privacy records.

Platform-global policy may coexist with tenant data but cannot weaken tenant isolation.

## 15. Audit

Material consent/privacy operations record actor, target, purpose, scope, policy version, timestamp, correlation, and outcome.

Raw sensitive data is not copied into audit logs.

## 16. Canonical Capabilities

```text
CAP.PRIVACY.GET_CONSENT
CAP.PRIVACY.RECORD_CONSENT
CAP.PRIVACY.WITHDRAW_CONSENT
CAP.PRIVACY.GET_POLICY
CAP.PRIVACY.CREATE_SUBJECT_REQUEST
CAP.PRIVACY.GET_SUBJECT_REQUEST
CAP.PRIVACY.APPLY_RESTRICTION
```

## 17. Canonical Events

```text
privacy.consent.granted
privacy.consent.withdrawn
privacy.consent.expired
privacy.subject_request.created
privacy.subject_request.completed
privacy.processing_restricted
```

## 18. Invariants

1. Consent is purpose and scope bound.
2. Withdrawal cannot be silently ignored.
3. Consent is not authorization.
4. Historical consent evidence remains auditable.
5. Active policy versions are immutable.
6. Data classification governs controls.
7. Retention is policy-driven.
8. Legal holds prevent prohibited deletion.
9. AI cannot manufacture or broaden consent.
10. Tenant isolation is mandatory.

## 19. Anti-Duplication

There is one Phoenix Privacy & Consent data contract.

Modules may reference consent state, but may not create:
- MarketingConsent;
- MedicalConsent;
- BeautyConsent;
- FashionConsent;
- AIConsent

as competing consent systems.

Purpose, scope, policy, and data category express contextual differences.

## 20. Definition of Done

Consent, purpose, scope, classification, retention, subject requests, restrictions, policy versions, authorization, audit, capabilities, events, tenancy, and AI boundaries are canonical.
