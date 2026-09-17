# Phoenix Moderation & Safety Operations Engine Architecture

**Status:** Canonical architecture contract

## 1. Purpose

Moderation is the canonical policy-governed boundary for detecting, reviewing, restricting, restoring, and evidencing potentially harmful, abusive, deceptive, illegal, or policy-violating marketplace content and behavior.

It is operational safety governance, not a replacement for Trust, Security, Authorization, Reviews, AI Safety, or domain ownership.

## 2. Ownership

| Domain | Owns |
|---|---|
| Moderation | moderation cases, policies, actions, decisions, appeals |
| Trust | verification truth |
| Security | security threats and controls |
| Authorization | permissions |
| Reviews | review/reputation truth |
| AI | model signals and assistance |
| Business/Catalog/Content | authoritative content |
| Case & Support | general operational cases |
| Communications | message delivery |
| Analytics | derived metrics |

## 3. Canonical concepts

- ModerationCase
- ModerationPolicy
- ModerationRule
- ModerationSignal
- ModerationDecision
- ModerationAction
- ModerationReview
- ModerationAppeal
- Restriction
- EvidenceReference
- ModerationSubject

## 4. Pipeline

```text
Subject/Event
  → Policy scope
  → Signal collection
  → Rule evaluation
  → Risk/violation assessment
  → Human review where required
  → Decision
  → Action
  → Appeal/review
  → Audit
```

Detection is not enforcement. A model signal is not a violation decision.

## 5. Subjects

A subject may be:
- listing/product/service content;
- business profile content;
- review;
- message;
- media;
- user/business behavior;
- marketplace interaction.

Moderation references authoritative subjects instead of duplicating them.

## 6. Policy

Policies are versioned by:
- platform;
- jurisdiction;
- subject type;
- risk category;
- effective period.

Active policy versions are immutable.

## 7. Signals

Signals may originate from:
- deterministic rules;
- user reports;
- trusted external signals;
- AI classifiers;
- abuse detection;
- human reviewers.

Signals retain provenance and confidence where applicable.

## 8. Decisions

Decisions are explicit and auditable.

Possible outcomes:
- ALLOW;
- WARN;
- RESTRICT;
- REMOVE;
- SUSPEND;
- ESCALATE;
- NEEDS_REVIEW.

A decision must reference policy/version and supporting evidence/signals.

## 9. Actions

Moderation actions operate through authorized canonical capabilities of the owning domain where mutation is required.

Moderation must not directly write Business, Catalog, Reviews, Communications, or other domain storage to enforce an action.

## 10. Human Review

High-risk or regulated decisions may require human review.

Reviewers are authorized through Authorization.

Separation of duties may be required.

## 11. Appeals

Where policy permits, affected actors may appeal a moderation decision.

Appeals create a new review process; they do not erase historical decisions.

## 12. AI Boundary

AI may:
- classify content;
- detect likely violations;
- prioritize review;
- summarize evidence;
- suggest actions.

AI may not:
- bypass policy;
- invent evidence;
- silently remove content;
- grant itself enforcement authority;
- override human/policy-required review;
- infer sensitive attributes for enforcement without explicit policy.

## 13. Medical / Regulated Content

Moderation may enforce advertising, credential-display, safety, or regulated-content policies.

It must not convert moderation into clinical diagnosis or treatment advice.

Professional verification remains owned by Trust.

## 14. Privacy

Moderation data may be sensitive.

Required:
- least privilege;
- tenant isolation;
- classification;
- retention;
- redaction;
- access audit;
- protected evidence references.

## 15. Tenancy

Moderation records are tenant-scoped unless a platform-global policy explicitly applies.

Cross-tenant access requires explicit platform authorization.

## 16. Idempotency

Repeated reports/events must not create duplicate moderation actions.

Policy evaluation and enforcement commands require idempotency and concurrency protection.

## 17. Events

```text
moderation.case.created
moderation.review.requested
moderation.decision.created
moderation.action.applied
moderation.restriction.created
moderation.appeal.created
moderation.appeal.resolved
```

## 18. Capabilities

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

## 19. Observability

Track:
- detection volume;
- review backlog;
- decision latency;
- false-positive/appeal outcomes;
- policy version;
- signal provenance;
- action success/failure.

Analytics owns aggregate measurement.

## 20. Anti-Duplication

One Phoenix Moderation & Safety Operations Engine serves all verticals.

Forbidden:
- BeautyModeration;
- FashionModeration;
- MedicalModeration;
- ReviewModerationEngine;
- AI-only moderation engine.

Vertical differences are policies and subject adapters.

## 21. Definition of Done

The engine is canonical when policy, signals, cases, decisions, actions, review, appeals, evidence, authorization, privacy, tenancy, events, capabilities, and AI boundaries are explicit.
