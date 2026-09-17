# Phoenix Trust & Verification Engine Data Dictionary

**Status:** Canonical data contract  
**Scope:** Trust & Verification domain.

## 1. VerificationCase

The aggregate representing one verification process for a specific subject.

| Field | Meaning |
|---|---|
| id | Opaque verification case identifier |
| tenant_id | Tenant/workspace scope |
| subject_type | Type of verified subject |
| subject_id | Subject identifier |
| policy_id | Verification policy |
| policy_version | Immutable policy version evaluated |
| status | Case lifecycle state |
| risk_class | Applicable risk classification |
| submitted_at | Submission timestamp |
| resolved_at | Resolution timestamp |
| expires_at | Case/decision expiry where applicable |
| created_at / updated_at | UTC timestamps |

## 2. VerificationSubject

Reference to the resource whose claim or credential is being verified.

| Field | Meaning |
|---|---|
| subject_type | BUSINESS, USER, PROFESSIONAL_CREDENTIAL, LOCATION, OWNERSHIP_CLAIM, OTHER |
| subject_id | Canonical owning-domain identifier |
| tenant_id | Scope |
| relationship | Why the subject is being verified |

Trust does not duplicate the subject's authoritative domain record.

## 3. VerificationRequirement

A versioned requirement that must be satisfied.

| Field | Meaning |
|---|---|
| id | Requirement identifier |
| policy_id / policy_version | Governing policy |
| subject_type | Applicable subject |
| jurisdiction | Country/region scope |
| industry | Industry scope |
| requirement_type | Identity, ownership, credential, location, compliance, etc. |
| required | Whether mandatory |
| evidence_types | Accepted evidence classes |
| human_review_required | Mandatory human review flag |
| effective_from / effective_to | Policy validity |
| expiry_rule | Expiry behavior |

## 4. VerificationEvidence

Metadata and provenance for evidence.

| Field | Meaning |
|---|---|
| id | Evidence identifier |
| case_id | Verification case |
| evidence_type | Document, registry reference, credential, etc. |
| storage_reference | Protected object-storage reference |
| content_hash | Integrity checksum |
| issuer | Issuer metadata where available |
| submitted_at | Submission time |
| expires_at | Evidence expiry |
| processing_status | Processing state |
| classification | Data sensitivity class |
| provenance | Evidence origin |
| retention_policy | Retention rule |

Binary sensitive content is not stored in ordinary relational domain rows.

## 5. VerificationCheck

An evaluation performed against a requirement.

| Field | Meaning |
|---|---|
| id | Check identifier |
| case_id | Verification case |
| requirement_id | Requirement evaluated |
| evidence_ids | Evidence used |
| check_type | Completeness, authenticity, expiry, consistency, human review, etc. |
| method | Automated or human |
| result | PASS, FAIL, INCONCLUSIVE |
| confidence | Optional bounded machine signal |
| reviewer_id | Reviewer when applicable |
| policy_version | Governing policy |
| performed_at | UTC timestamp |

A check is evidence of evaluation, not itself the final approval.

## 6. VerificationDecision

Immutable authoritative Trust decision.

| Field | Meaning |
|---|---|
| id | Decision identifier |
| case_id | Verification case |
| requirement_id | Requirement decided |
| outcome | APPROVED, REJECTED, CHANGES_REQUIRED, EXPIRED |
| actor_type | HUMAN, SYSTEM_POLICY |
| actor_id | Decision actor where applicable |
| rationale_reference | Structured rationale/reference |
| policy_version | Policy used |
| check_ids | Checks supporting decision |
| decided_at | UTC timestamp |

Decisions are append-only historical facts. Corrections create a new decision.

## 7. VerificationReview

Human review assignment and review evidence.

| Field | Meaning |
|---|---|
| id | Review identifier |
| case_id | Case |
| reviewer_id | Authorized reviewer |
| status | ASSIGNED, IN_PROGRESS, COMPLETED, ESCALATED |
| assigned_at | Assignment timestamp |
| completed_at | Completion timestamp |
| review_outcome | Review result |
| escalation_reason | Escalation reference |

Authorization remains owned by Authorization.

## 8. VerificationExpiry

Explicit representation of an expiry event or scheduled expiry.

| Field | Meaning |
|---|---|
| id | Expiry record |
| case_id | Verification case |
| requirement_id | Affected requirement |
| evidence_id | Affected evidence where applicable |
| expires_at | Expiry time |
| detected_at | Detection time |
| reevaluation_status | Pending, evaluated, blocked, etc. |
| resulting_decision_id | Resulting decision |

Expiry must trigger policy reevaluation; expired evidence must not silently remain trusted.

## 9. VerificationPolicy

Versioned rule-set defining requirements and decision constraints.

| Field | Meaning |
|---|---|
| id | Policy identifier |
| version | Immutable version |
| jurisdiction | Geographic scope |
| industry | Industry scope |
| subject_type | Subject scope |
| risk_class | Risk scope |
| effective_from / effective_to | Validity |
| human_review_rules | Human-review requirements |
| expiry_rules | Expiry behavior |
| status | DRAFT, ACTIVE, RETIRED |

Active policy versions are immutable.

## 10. TrustSignal

Derived trust indicator with provenance.

| Field | Meaning |
|---|---|
| id | Signal identifier |
| subject_type / subject_id | Subject |
| signal_type | Signal category |
| value | Bounded derived value |
| source_refs | Supporting evidence/decisions |
| generated_at | UTC timestamp |
| expires_at | Freshness boundary |
| policy_version | Governing policy |

Trust signals never override authoritative verification decisions.

## 11. Evidence Provenance

Every evidence item should preserve its origin:

```text
USER_SUBMITTED
VERIFIED_DOCUMENT
AUTHORITATIVE_REGISTRY
IMPORTED_SOURCE
SYSTEM_GENERATED_METADATA
```

AI extraction is provenance about processing, not evidence authority.

## 12. State Machines

### VerificationCase

```text
CREATED
  → SUBMITTED
  → UNDER_REVIEW
  → APPROVED
  → EXPIRED

UNDER_REVIEW
  → NEEDS_CHANGES → SUBMITTED
  → REJECTED
```

### Review

```text
ASSIGNED → IN_PROGRESS → COMPLETED
                         ↘ ESCALATED
```

### Evidence processing

```text
RECEIVED → PROCESSING → PROCESSED
                     ↘ FAILED
```

## 13. Relationships

Canonical relationships:

```text
VerificationCase
 ├── VerificationSubject
 ├── VerificationRequirement [1..N]
 ├── VerificationEvidence [0..N]
 ├── VerificationCheck [0..N]
 ├── VerificationReview [0..N]
 ├── VerificationDecision [0..N]
 └── VerificationExpiry [0..N]

VerificationPolicy
 └── Requirement definitions [1..N]

TrustSignal
 └── Subject [1]
```

## 14. Tenancy

All tenant-scoped verification entities carry or inherit an explicit tenant/workspace boundary.

Cross-tenant reads and mutations are forbidden.

Platform-global policies may be explicitly marked global but must not weaken subject data isolation.

## 15. Idempotency and Concurrency

Submission, evidence registration, automated checks, review completion, approval, rejection, and expiry processing must support idempotent command handling where retries are possible.

State transitions use optimistic concurrency/version validation.

Duplicate webhook/event processing must not create duplicate authoritative decisions.

## 16. Audit and Correlation

Meaningful mutations reference:

- actor/service identity;
- tenant/workspace;
- target entity;
- action;
- timestamp;
- request ID;
- correlation ID;
- trace ID where available;
- policy/version;
- outcome.

Sensitive binary evidence is never copied into audit records.

## 17. Canonical Capabilities

```text
CAP.TRUST.CREATE_VERIFICATION
CAP.TRUST.SUBMIT_VERIFICATION
CAP.TRUST.REVIEW_VERIFICATION
CAP.TRUST.APPROVE_VERIFICATION
CAP.TRUST.REJECT_VERIFICATION
CAP.TRUST.GET_VERIFICATION
CAP.TRUST.REQUEST_CHANGES
CAP.TRUST.REVERIFY
```

## 18. Canonical Events

```text
trust.verification.created
trust.verification.submitted
trust.verification.reviewed
trust.verification.approved
trust.verification.rejected
trust.verification.expired
trust.verification.changed
```

Events carry canonical identifiers, tenant scope, policy/version references, correlation context, and event version.

## 19. Ownership Matrix

| Data | Owner |
|---|---|
| User/account identity | Identity |
| Business profile | Business |
| Verification case | Trust |
| Credential/evidence metadata | Trust |
| Evidence binary | Protected Media/Storage boundary |
| Verification decision | Trust |
| Reviewer permission | Authorization |
| Business activation | Business |
| Search visibility | Discovery |
| Reputation | Reviews |

## 20. Medical Verification

For regulated medical providers, professional credential evidence and verification decisions are represented through the same canonical model.

No medical diagnosis, treatment recommendation, medication prescription, or clinical inference is represented as a Trust decision.

A verified credential means only that the configured verification policy accepted the credential/evidence for the specified scope and time.

## 21. Data Invariants

1. IDs are opaque.
2. Timestamps are UTC.
3. Decisions are immutable.
4. Active policy versions are immutable.
5. Evidence is protected according to classification.
6. Evidence provenance is preserved.
7. Expired evidence cannot silently satisfy an active requirement.
8. AI output cannot become an authoritative decision without the configured decision process.
9. Trust cannot activate a business.
10. Verification state is not equivalent to reputation.
11. Trust signals cannot replace verification decisions.
12. Tenant boundaries are mandatory.
13. Cross-domain authoritative data is referenced, not duplicated.
14. Every state-changing operation is auditable.
15. Historical decisions remain reconstructable.

## 22. Anti-Duplication Rule

Phoenix has exactly one Trust & Verification data model.

Do not create:
- BeautyVerification;
- FashionVerification;
- MedicalVerification;
- BusinessCredentialVerification;
- AITrustVerification.

Industry and jurisdiction differences belong in VerificationPolicy and VerificationRequirement.

## 23. Definition of Done

The canonical Trust data model is complete when:

- cases and subjects are explicit;
- requirements are versioned;
- evidence is protected and provenance-aware;
- checks are separate from decisions;
- human review is represented;
- decisions are immutable;
- expiry/re-verification is modeled;
- policy versions are explicit;
- tenancy and authorization boundaries are explicit;
- audit/correlation is represented;
- canonical capabilities/events are defined;
- medical verification remains strictly non-clinical;
- no vertical-specific duplicate model exists.
