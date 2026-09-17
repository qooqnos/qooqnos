# Phoenix Moderation & Safety Operations Engine Data Dictionary

**Status:** Canonical data contract

## 1. ModerationCase

Fields:
- id;
- tenant_id;
- subject_type;
- subject_id;
- source_type;
- source_id;
- policy_id;
- policy_version;
- status;
- risk_level;
- created_at;
- resolved_at.

## 2. ModerationPolicy

Versioned enforcement policy.

Fields:
- id;
- version;
- jurisdiction;
- subject_types;
- risk_categories;
- rules;
- required_human_review;
- effective_from;
- effective_to;
- status.

## 3. ModerationRule

Policy rule defining a deterministic evaluation.

Fields:
- id;
- policy_id;
- version;
- category;
- condition_reference;
- threshold;
- action_class;
- human_review_required.

## 4. ModerationSignal

Non-authoritative detection evidence.

Fields:
- id;
- case_id;
- source_type;
- source_reference;
- signal_type;
- category;
- confidence;
- provenance;
- generated_at;
- expires_at.

## 5. ModerationDecision

Immutable policy-governed decision.

Fields:
- id;
- case_id;
- outcome;
- policy_version;
- rule_references;
- signal_references;
- reviewer_id;
- rationale_reference;
- decided_at.

## 6. ModerationAction

Enforcement action.

Fields:
- id;
- case_id;
- action_type;
- target_type;
- target_id;
- capability;
- authorization_reference;
- status;
- idempotency_key;
- created_at;
- completed_at.

## 7. ModerationReview

Human review record.

Fields:
- id;
- case_id;
- reviewer_id;
- status;
- assigned_at;
- completed_at;
- outcome;
- escalation_reason.

## 8. ModerationAppeal

Appeal against an existing decision.

Fields:
- id;
- decision_id;
- appellant_type;
- appellant_id;
- reason_reference;
- status;
- reviewer_id;
- outcome;
- created_at;
- resolved_at.

Historical decisions remain intact.

## 9. Restriction

Active enforcement state derived from a moderation decision.

Fields:
- id;
- target_type;
- target_id;
- restriction_type;
- source_decision_id;
- starts_at;
- expires_at;
- status.

Restrictions must have a clear owner/action reference.

## 10. EvidenceReference

Reference to authoritative or protected evidence.

Fields:
- id;
- case_id;
- source_module;
- source_type;
- source_id;
- classification;
- provenance;
- created_at.

Binary sensitive evidence is not duplicated into moderation records.

## 11. ModerationSubject

Reference to the moderated resource.

Fields:
- subject_type;
- subject_id;
- tenant_scope;
- ownership_module.

## 12. State Machines

Case:
```text
OPEN → REVIEWING → DECIDED → ACTIONED → CLOSED
              ↘ ESCALATED
```

Review:
```text
ASSIGNED → IN_PROGRESS → COMPLETED
```

Appeal:
```text
OPEN → REVIEWING → RESOLVED
```

## 13. Ownership

| Data | Owner |
|---|---|
| Moderation decision | Moderation |
| Policy/rules | Moderation |
| Detection model signal | AI/Security source |
| Verification | Trust |
| Subject content | Owning domain |
| Permission | Authorization |
| Operational case coordination | Case & Support |
| Aggregate metrics | Analytics |

## 14. AI Provenance

AI-generated signals record:
- model/provider reference;
- policy/version;
- input provenance;
- confidence;
- generated_at.

AI signals are never equivalent to final enforcement decisions.

## 15. Tenancy

Tenant/workspace scope is mandatory for tenant-owned moderation records.

Platform-global moderation is explicit and separately authorized.

## 16. Audit

Material operations reference actor, target, policy/version, authorization, correlation, timestamp, and outcome.

Sensitive content is not unnecessarily copied into audit records.

## 17. Canonical Capabilities

```text
CAP.MODERATION.CREATE_CASE
CAP.MODERATION.GET_CASE
CAP.MODERATION.REVIEW
CAP.MODERATION.DECIDE
CAP.MODERATION.APPLY_ACTION
CAP.MODERATION.RESTRICT
CAP.MODERATION.ESCALATE
CAP.MODERATION.CREATE_APPEAL
CAP.MODERATION.RESOLVE_APPEAL
```

## 18. Canonical Events

```text
moderation.case.created
moderation.review.requested
moderation.decision.created
moderation.action.applied
moderation.restriction.created
moderation.appeal.created
moderation.appeal.resolved
```

## 19. Data Invariants

1. Signals are not decisions.
2. Decisions reference immutable policy versions.
3. Enforcement requires authorization.
4. Domain mutations use owning-domain capabilities.
5. Appeals do not erase history.
6. Evidence is referenced, not duplicated.
7. AI cannot bypass required human review.
8. Tenant isolation is mandatory.
9. Sensitive data follows classification and retention policy.
10. Duplicate reports/actions are idempotently handled.

## 20. Anti-Duplication

One moderation data model serves every vertical.

No BeautyModeration, FashionModeration, MedicalModeration, or ReviewModeration data models may be introduced.

## 21. Definition of Done

Policy, rules, signals, cases, decisions, actions, reviews, appeals, restrictions, evidence references, provenance, tenancy, authorization, audit, capabilities, and events are explicit and canonical.
