# Phoenix Loyalty & Retention Engine — Data Dictionary

**Status:** Architecture defined / frozen
**Owner:** Loyalty

## 1. Purpose

Canonical vocabulary for Loyalty. This dictionary does not create a second source of truth for Customer, CRM, Booking, Commerce, Billing, Catalog, Communications, Reviews, or AI.

## 2. Program & Scope

| Field | Meaning | Owner |
|---|---|---|
| `program_id` | Stable loyalty program identifier | Loyalty |
| `program_version_id` | Immutable program configuration version | Loyalty |
| `program_status` | draft / active / paused / retired | Loyalty |
| `scope_type` | PLATFORM / ORGANIZATION / WORKSPACE / BUSINESS / CAMPAIGN | Loyalty |
| `scope_id` | Identifier of declared scope | Scope owner |
| `policy_version` | Rules/policy version | Loyalty |
| `effective_from` | Start of applicability | Loyalty |
| `effective_until` | End of applicability | Loyalty |
| `default_locale` | Default presentation locale | Localization |
| `supported_locales` | Supported locales | Localization |
| `stacking_policy` | Rules for combining programs/rewards | Loyalty |

## 3. Membership

| Field | Meaning | Owner |
|---|---|---|
| `membership_id` | Stable program membership identifier | Loyalty |
| `customer_id` | Canonical customer reference | Identity/Customer |
| `membership_status` | invited / active / suspended / expired | Loyalty |
| `enrolled_at` | Enrollment timestamp | Loyalty |
| `status_changed_at` | Last status change | Loyalty |
| `current_tier_id` | Current tier reference | Loyalty |
| `tier_effective_at` | Effective time of tier | Loyalty |
| `consent_state` | Relevant consent state where required | Policy/Consent |

Membership never duplicates customer identity.

## 4. Tier

| Field | Meaning |
|---|---|
| `tier_id` | Stable tier identifier |
| `tier_code` | Machine-readable code |
| `tier_name` | Localized name |
| `tier_order` | Relative ordering |
| `qualification_rule_id` | Qualification rule reference |
| `qualification_window` | Evaluation period |
| `benefit_set_id` | Associated benefits |
| `tier_version` | Criteria version |

Historical evaluations retain the rule/version used.

## 5. Rule & Eligibility

| Field | Meaning |
|---|---|
| `rule_id` | Stable rule identifier |
| `rule_version` | Immutable rule version |
| `rule_type` | earning / redemption / tier / milestone / referral / eligibility / expiration |
| `trigger_type` | Event or capability condition |
| `conditions` | Versioned declarative conditions |
| `effect` | Approved loyalty outcome |
| `priority` | Evaluation precedence |
| `effective_from` | Activation time |
| `effective_until` | Expiration time |
| `policy_state` | active / review-required / suspended / retired |

Rules reference authoritative domain facts and do not reproduce other modules' business logic.

## 6. Loyalty Ledger

The ledger is the authoritative record of loyalty-value changes.

| Field | Meaning |
|---|---|
| `ledger_entry_id` | Immutable entry identifier |
| `membership_id` | Receiving membership |
| `entry_type` | earn / adjustment / expiration / reversal / redemption / reinstatement |
| `amount` | Signed loyalty-value quantity |
| `unit` | Program loyalty unit |
| `source_event_id` | Authoritative triggering event |
| `source_module` | Module owning triggering fact |
| `source_record_id` | Source record reference |
| `source_record_version` | Source version used |
| `rule_id` | Producing rule |
| `rule_version` | Rule version used |
| `idempotency_key` | Duplicate-prevention key |
| `expires_at` | Expiration timestamp |
| `created_at` | Creation timestamp |
| `created_by` | Actor/system responsible |
| `correlation_id` | Cross-module trace identifier |

Ledger history is not rewritten; corrections use compensating entries.

## 7. Balance Projection

`loyalty_balance` is derived and rebuildable from the ledger.

Recommended fields:

- `available_amount`
- `reserved_amount`
- `expired_amount`
- `lifetime_earned`
- `lifetime_redeemed`
- `projection_version`
- `calculated_at`

## 8. Reward & Redemption

Reward fields:

- `reward_id`
- `reward_code`
- `reward_type`
- `reward_name`
- `reward_description`
- `cost_amount`
- `availability_policy_id`
- `benefit_reference`
- `valid_from`
- `valid_until`
- `reward_status`

Redemption fields:

- `redemption_id`
- `membership_id`
- `reward_id`
- `redemption_status`
- `cost_amount`
- `idempotency_key`
- `benefit_reference`
- `consumed_by_module`
- `reserved_at`
- `redeemed_at`
- `cancelled_at`
- `policy_version`

Rewards are benefits, not money or payment state.

## 9. Milestones

| Field | Meaning |
|---|---|
| `milestone_id` | Stable milestone identifier |
| `milestone_code` | Machine-readable code |
| `milestone_type` | visit / purchase / referral / engagement / custom |
| `target_value` | Required threshold |
| `measurement_unit` | Progress unit |
| `qualification_rule_id` | Qualification rule |
| `reward_id` | Optional completion reward |
| `valid_from` | Activation |
| `valid_until` | Expiration |

Progress is represented separately by `progress_id`, `membership_id`, `current_value`, `progress_state`, `last_source_event_id`, `completed_at`, and `rule_version`.

## 10. Referral

| Field | Meaning |
|---|---|
| `referral_id` | Stable referral identifier |
| `referrer_membership_id` | Referring membership |
| `referred_customer_id` | Canonical customer reference |
| `attribution_code` | Referral attribution token |
| `attribution_window` | Valid attribution period |
| `qualification_event_id` | Authoritative qualifying event |
| `referral_status` | created / attributed / qualified / rejected / expired |
| `abuse_state` | clear / flagged / review-required / rejected |
| `reward_decision_id` | Resulting reward decision |

## 11. Reward Decision

| Field | Meaning |
|---|---|
| `reward_decision_id` | Stable decision identifier |
| `decision_type` | grant / deny / defer / revoke |
| `eligibility_state` | eligible / ineligible / review-required |
| `rule_id` | Rule used |
| `rule_version` | Rule version |
| `evidence_refs` | Supporting authoritative references |
| `policy_version` | Governing policy |
| `decision_at` | Decision timestamp |
| `decision_actor` | Decision actor/system |
| `reason_code` | Controlled reason |

AI may recommend; it cannot replace the authoritative decision.

## 12. Retention & Abuse Signals

Retention signal vocabulary:

`retention_signal_id`, `membership_id`, `recency_signal`, `frequency_signal`, `tier_progress_signal`, `reward_utilization_signal`, `milestone_signal`, `referral_signal`, `churn_risk_signal`, `model_version`, `calculated_at`, `expires_at`.

Abuse signal vocabulary:

`abuse_signal_id`, `subject_type`, `subject_id`, `signal_type`, `severity`, `confidence`, `evidence_refs`, `review_state`, `created_at`.

Signals are derived inputs, not authoritative identity or CRM truth.

## 13. Audit & Provenance

Mutations affecting programs, memberships, rewards, redemptions, tier decisions or ledger value retain:

- actor reference;
- action;
- target type/id;
- policy version;
- correlation identifier;
- timestamp;
- relevant before/after references.

Audit records are distinct from the loyalty ledger: the ledger records loyalty value; audit records actions.

## 14. Events

Canonical events:

```text
loyalty.program.activated
loyalty.program.paused
loyalty.member.enrolled
loyalty.member.suspended
loyalty.ledger.posted
loyalty.tier.changed
loyalty.milestone.completed
loyalty.reward.available
loyalty.reward.redeemed
loyalty.reward.revoked
loyalty.referral.created
loyalty.referral.qualified
loyalty.referral.rejected
```

Events use the canonical event/outbox envelope with tenant scope, version, source, occurred-at, correlation and idempotency data.

## 15. Ownership Matrix

| Data | Owner |
|---|---|
| Customer identity | Identity/Customer |
| Customer relationship | CRM |
| Booking truth | Booking |
| Order/payment truth | Commerce/Billing |
| Catalog truth | Catalog |
| Communication delivery | Communications |
| Reputation | Reviews/Trust |
| Program/rules | Loyalty |
| Membership/tier | Loyalty |
| Loyalty ledger | Loyalty |
| Rewards/redemptions | Loyalty |
| Retention signals | Loyalty/Analytics boundary |
| AI model state | AI |
| Authorization | Authorization |

## 16. Privacy & Reuse

Loyalty must not duplicate authentication secrets, payment credentials, private customer data not required for operation, confidential risk information, or other restricted data.

Beauty, Fashion, Medical and future verticals reuse this same dictionary. Vertical differences belong in configuration, policy and authorized benefit references—not separate loyalty schemas or ledgers.

## 17. Anti-Duplication Rule

```text
Existing canonical fact elsewhere? → reference it
Loyalty-specific fact? → Loyalty owns it
Neither? → do not add it to Loyalty
```

This dictionary is the canonical vocabulary for Loyalty UI, API, AI, automation and integrations.

**Decision: Loyalty & Retention Data Dictionary is frozen. Future changes require an explicit module-level ADR.**
