# Phoenix Trust & Verification Engine Architecture

**Status:** Canonical architecture contract  
**Scope:** Identity/business verification, credential verification, evidence evaluation, trust decisions, expiry, review, and verification history.

## 1. Purpose

Trust is the canonical engine for determining whether submitted claims or credentials have passed an explicit verification policy.

Trust produces evidence-backed verification decisions. It does not own business profiles, identity accounts, catalog data, or marketplace ranking.

## 2. Ownership

| Domain | Owns |
|---|---|
| Trust | Verification cases, requirements, evidence metadata, checks, decisions, expiry |
| Identity | Actor identity and account ownership |
| Business | Business profile and lifecycle |
| Media | Binary media/document storage and processing metadata |
| Authorization | Access and approval authority |
| Security/Policy | Risk, privacy, legal and country-specific policy |
| Discovery | Derived visibility projections |
| Reviews | Reputation evidence and derived reputation |

## 3. Canonical concepts

- VerificationCase
- VerificationRequirement
- VerificationEvidence
- VerificationCheck
- VerificationDecision
- VerificationReview
- VerificationSubject
- VerificationPolicy
- VerificationExpiry
- TrustSignal

A verification subject may be a business, user, professional credential, location, ownership claim, or other explicitly supported resource.

## 4. Lifecycle

```text
CREATED → SUBMITTED → UNDER_REVIEW
                    ├→ NEEDS_CHANGES → SUBMITTED
                    ├→ REJECTED
                    └→ APPROVED
                             ↓
                         EXPIRED
```

Approval is a decision for a specific requirement/case under a specific policy version. It is never a permanent universal fact.

## 5. Evidence

Evidence may reference protected documents or external authoritative sources.

Trust stores metadata, integrity references, provenance, classification, expiry, and processing state. Binary sensitive material belongs in protected storage.

Evidence must never be exposed through public profile URLs or copied into unrelated domain records.

## 6. Verification requirements

Requirements are versioned and policy-driven by combinations such as:
- jurisdiction;
- industry;
- subject type;
- risk class;
- credential type;
- effective dates.

Examples:
- identity;
- business ownership;
- location;
- professional credential;
- content/compliance requirement.

## 7. Checks

Checks evaluate evidence against a requirement.

Check types may include:
- completeness;
- authenticity/issuer validation;
- expiry;
- consistency;
- duplicate detection;
- policy rule;
- human review.

Automated checks produce evidence/signals. The configured policy determines whether human approval is mandatory.

## 8. Decisions

A decision records:
- subject;
- case;
- requirement;
- policy version;
- outcome;
- decision actor;
- rationale/reference;
- evidence/check references;
- timestamp.

Decisions are immutable historical records. A changed decision creates a new decision/history entry.

## 9. Human review

Reviewers are authorized through centralized Authorization.

Separation of duties may be required for high-risk verification.

Trust cannot grant reviewer permissions itself.

## 10. Expiry and re-verification

Credentials and verification states may expire.

Expiry triggers policy reevaluation and appropriate domain events. Expired evidence must not silently remain trusted.

Re-verification creates new checks/decisions while preserving historical evidence.

## 11. Business activation boundary

Business owns activation. Trust supplies verification outcomes.

Therefore:

```text
Trust decision
   ↓
Business policy gate
   ↓
Business activation
   ↓
Discovery eligibility
```

Trust must never directly publish or activate a business.

## 12. Medical safety

For regulated medical providers, required professional credentials must be verified before activation according to applicable jurisdictional policy.

Trust verifies credentials/evidence; it does not:
- diagnose;
- recommend treatment;
- prescribe medication;
- infer professional qualification from AI output;
- convert marketing claims into verified clinical facts.

Sensitive health-related evidence requires explicit access, retention, consent, and audit controls.

## 13. AI boundary

AI may:
- extract fields from evidence;
- classify documents;
- detect missing information;
- suggest checks;
- flag inconsistencies;
- assist reviewers.

AI may not:
- approve verification;
- fabricate evidence;
- invent credentials;
- override policy;
- silently alter a decision;
- treat a prediction as verification.

## 14. Trust signals

Trust signals are derived indicators and never replace authoritative decisions.

Examples:
- verification completeness;
- freshness;
- evidence quality;
- decision recency;
- repeated failed checks.

Signals must retain provenance and must not be used to infer sensitive attributes without explicit policy.

## 15. Events

Canonical events:
- `trust.verification.created`
- `trust.verification.submitted`
- `trust.verification.reviewed`
- `trust.verification.approved`
- `trust.verification.rejected`
- `trust.verification.expired`
- `trust.verification.changed`

Events contain canonical IDs, policy/version references where relevant, tenant scope, and correlation context.

## 16. Capabilities

- `CAP.TRUST.CREATE_VERIFICATION`
- `CAP.TRUST.SUBMIT_VERIFICATION`
- `CAP.TRUST.REVIEW_VERIFICATION`
- `CAP.TRUST.APPROVE_VERIFICATION`
- `CAP.TRUST.REJECT_VERIFICATION`
- `CAP.TRUST.GET_VERIFICATION`
- `CAP.TRUST.REQUEST_CHANGES`
- `CAP.TRUST.REVERIFY`

## 17. Tenancy and authorization

Verification cases are tenant-scoped unless explicitly platform-global.

Sensitive evidence access always requires explicit authorization and is auditable.

Cross-tenant access is prohibited.

## 18. Audit and provenance

Every meaningful verification transition records:
- actor/system identity;
- tenant/workspace;
- target;
- action;
- timestamp;
- policy version;
- evidence/check references;
- correlation/trace;
- outcome.

Raw sensitive evidence is not duplicated into audit logs.

## 19. Anti-duplication

There is one Phoenix Trust & Verification Engine.

Forbidden:
- Beauty verification engine;
- Fashion verification engine;
- Medical verification engine;
- Business-specific credential engines;
- AI verification engine.

Industry and jurisdiction differences are expressed through policy and requirements.

## 20. Definition of Done

Trust is complete when requirements, protected evidence references, checks, decisions, reviews, expiry, policy versions, authorization, audit, events, capabilities, tenancy, AI boundaries, and business activation boundaries are canonical.

## 21. Final decision

Trust is the authoritative verification boundary:

```text
Evidence + Policy
       ↓
     Trust
       ↓
Verification Decision
       ↓
Owning Domain Policy
       ↓
Activation / Eligibility / Visibility
```
