# Phoenix Loyalty & Retention Engine Architecture

**Status:** Architecture defined / frozen
**Scope:** Loyalty, engagement, rewards, tiers, milestones, referrals, retention and personalization hooks across all Phoenix verticals
**Owner:** Loyalty

## 1. Purpose

Loyalty is Phoenix's reusable customer-engagement engine. It increases repeat engagement and retention without becoming a payment system, wallet, CRM, booking engine, catalog, or notification provider.

Core rule:

> **Loyalty owns loyalty value and eligibility; other domains remain authoritative for money, orders, bookings, identity and communication delivery.**

The same engine serves Beauty, Fashion, Medical partners, and future verticals.

## 2. Ownership Boundaries

| Concern | Source of truth |
|---|---|
| Customer identity | Identity/Customer |
| Customer-business relationship | CRM |
| Booking facts | Booking |
| Order/payment facts | Commerce/Billing |
| Catalog prices | Catalog |
| Promotions/loyalty rules | Loyalty |
| Loyalty membership/tier | Loyalty |
| Loyalty points/reward ledger | Loyalty |
| Message delivery | Communications |
| Reputation | Reviews/Trust |
| Personalization/model decisions | AI |

Loyalty consumes authoritative events/capabilities and never reconstructs domain truth from UI state.

## 3. Core Concepts

### Program
A configured loyalty program with owner, scope, lifecycle, locale/currency presentation and policy version.

### Membership
A customer's participation in a program. Membership is not a second customer identity.

### Tier
A program-defined level such as Basic, Silver, Gold or Platinum. Tier criteria are versioned and reproducible.

### Ledger
The authoritative append-oriented record of loyalty value changes. Every earning, adjustment, expiration, reversal and redemption has provenance.

### Reward
A non-authoritative representation of a benefit that can be granted or redeemed under policy.

### Rule
A versioned eligibility/earning/redemption rule. Rules reference domain events/capabilities rather than duplicating booking or commerce logic.

### Milestone
A measurable achievement such as completed visits, purchases, referrals or engagement thresholds.

### Referral
A tracked referral relationship with anti-abuse controls and explicit attribution rules.

### Campaign Hook
A controlled integration point for promotions or campaigns. Campaign systems may trigger Loyalty capabilities but cannot create a second loyalty ledger.

## 4. Value Model

Phoenix must distinguish:

```text
Money             → Commerce / Billing
Discount          → applicable commercial/promotion policy
Loyalty Points    → Loyalty ledger
Reward            → Loyalty benefit definition
Entitlement       → Billing/product access
```

Points are not money, cannot silently become a financial balance, and cannot be used to bypass Billing or Commerce controls.

If monetary wallets are introduced later, they require a separate financial architecture and ledger.

## 5. Program Scope

Supported scopes:

- PLATFORM
- ORGANIZATION
- WORKSPACE
- BUSINESS
- CAMPAIGN

A customer may participate in multiple programs where policy permits. Program precedence and stacking rules must be explicit; accidental double-rewarding is forbidden.

## 6. Lifecycle

Program:

`draft → active → paused → retired`

Membership:

`invited → active → suspended → expired`

Reward:

`defined → available → reserved → redeemed | expired | revoked`

Ledger entries are immutable business evidence. Corrections create compensating entries rather than rewriting historical entries.

## 7. Earning Architecture

Loyalty can react to approved events such as:

- booking.completed
- commerce.order.completed
- review.published where policy permits
- referral.completed
- milestone.completed
- campaign-qualified engagement

Flow:

`Authoritative Event → Loyalty Rule Evaluation → Eligibility → Ledger Entry → Reward/Tier Projection → CRM/Analytics Events`

Loyalty must not infer a completed booking, payment or purchase from client claims.

## 8. Redemption Architecture

Redemption is a command and requires:

- authenticated actor
- tenant/program scope
- membership eligibility
- reward availability
- sufficient loyalty value where applicable
- rule/policy validation
- idempotency
- atomic reservation/consumption semantics
- audit trail

Commerce or Booking remains responsible for applying its own authoritative transaction state. Loyalty supplies an authorized benefit/reference rather than mutating another domain's ledger.

## 9. Tier Engine

Tier evaluation must be deterministic and versioned.

Inputs may include:

- qualifying bookings/orders
- qualifying spend references
- completed visits
- referral outcomes
- engagement milestones
- program-defined time windows

The engine stores the rule/version used for evaluation so historical tier decisions remain explainable.

## 10. Retention Intelligence

Loyalty provides retention signals, not a second CRM.

Signals may include:

- recency
- frequency
- milestone progress
- tier progression
- reward utilization
- referral participation
- churn-risk indicators derived from permitted behavioral data

AI may recommend an eligible reward or engagement action. It cannot grant prohibited benefits, alter the ledger, or bypass policy.

## 11. Referral Architecture

Referral flow:

`referral.created → attribution window → qualifying interaction → anti-abuse evaluation → qualification → reward decision`

Controls include:

- self-referral prevention
- duplicate-account signals
- velocity limits
- attribution rules
- cooling periods where needed
- tenant/program boundaries
- manual review for anomalous cases

Referral rewards are issued only after the qualifying condition is authoritative.

## 12. Anti-Abuse

Loyalty must defend against:

- self-referral
- duplicate accounts
- synthetic bookings/orders
- repeated cancellations designed to earn rewards
- reward farming
- automated redemption abuse
- coordinated manipulation
- employee/admin abuse

Risk signals are advisory. Enforcement is policy-driven, permission-controlled and auditable.

## 13. Permissions

Canonical permission families include:

```text
loyalty.program.read
loyalty.program.manage
loyalty.membership.read
loyalty.membership.manage
loyalty.ledger.read
loyalty.adjust
loyalty.reward.read
loyalty.reward.manage
loyalty.reward.redeem
loyalty.tier.read
loyalty.tier.manage
loyalty.referral.read
loyalty.referral.manage
loyalty.policy.manage
```

Customer access is restricted to their own membership, balance/ledger views and eligible rewards. Administrative adjustments require elevated authorization and audit.

## 14. Canonical Capabilities

```text
CAP.LOYALTY.CREATE_PROGRAM
CAP.LOYALTY.UPDATE_PROGRAM
CAP.LOYALTY.ACTIVATE_PROGRAM
CAP.LOYALTY.SUSPEND_PROGRAM
CAP.LOYALTY.ENROLL_MEMBER
CAP.LOYALTY.SUSPEND_MEMBER
CAP.LOYALTY.GET_MEMBERSHIP
CAP.LOYALTY.EVALUATE_EARNING
CAP.LOYALTY.POST_LEDGER_ENTRY
CAP.LOYALTY.GET_LEDGER
CAP.LOYALTY.EVALUATE_TIER
CAP.LOYALTY.GET_TIER
CAP.LOYALTY.CREATE_REWARD
CAP.LOYALTY.GET_REWARDS
CAP.LOYALTY.REDEEM_REWARD
CAP.LOYALTY.REVOKE_REWARD
CAP.LOYALTY.CREATE_REFERRAL
CAP.LOYALTY.QUALIFY_REFERRAL
CAP.LOYALTY.GET_RETENTION_SIGNALS
```

These are the single reusable loyalty behaviors. API, UI, AI, automation and plugins consume them; none may implement parallel loyalty logic.

## 15. Data Model Outline

Canonical domain records/read models may include:

- `loyalty_programs`
- `loyalty_program_versions`
- `loyalty_memberships`
- `loyalty_tiers`
- `loyalty_tier_evaluations`
- `loyalty_rules`
- `loyalty_ledger_entries`
- `loyalty_rewards`
- `loyalty_reward_redemptions`
- `loyalty_milestones`
- `loyalty_milestone_progress`
- `loyalty_referrals`
- `loyalty_abuse_signals`

Ledger entries are authoritative; balances, progress and summaries are recalculable projections.

## 16. Event Contract

Produced events may include:

- `loyalty.program.activated`
- `loyalty.member.enrolled`
- `loyalty.ledger.posted`
- `loyalty.tier.changed`
- `loyalty.milestone.completed`
- `loyalty.reward.available`
- `loyalty.reward.redeemed`
- `loyalty.reward.revoked`
- `loyalty.referral.qualified`

All events are versioned, tenant-scoped, idempotent and emitted through the canonical event/outbox architecture.

## 17. Integration Rules

### CRM
CRM consumes loyalty events for timeline and relationship projections. Loyalty does not duplicate CRM relationship state.

### Booking
Completed/cancelled booking facts come from Booking. Loyalty never calculates booking completion independently.

### Commerce/Billing
Financial truth remains in Commerce/Billing. Loyalty may issue a benefit/reference consumed by those domains.

### Communications
Loyalty requests communication through the canonical Communications capability.

### AI
AI can explain progress, recommend eligible rewards and suggest retention actions. All mutations go through Loyalty capabilities.

### Analytics
Analytics consumes events and projections; it does not become the loyalty source of truth.

## 18. Localization

Programs support localized names, descriptions, reward presentation, dates, numbers and locale-aware messaging. Canonical timestamps remain UTC. Currency presentation follows the existing localization/money architecture.

## 19. Privacy

Use the minimum customer data required for program operation. Sensitive or regulated attributes must not be used for loyalty targeting merely because they are technically available. Medical loyalty programs, if ever allowed, require explicit policy review and must never expose or infer clinical information.

## 20. Anti-Duplication Rule

Before adding any retention/reward feature:

```text
Existing Loyalty capability?
        ↓ yes → reuse
        ↓ no
Existing capability extension?
        ↓ yes → version/extend
        ↓ no
New Loyalty capability + one owner
```

No vertical may create `BeautyLoyalty`, `FashionLoyalty`, or `MedicalLoyalty` engines. Vertical-specific rules are configuration/policy over the canonical Loyalty engine.

## 21. Definition of Done

Loyalty architecture is complete when:

- ownership is unique;
- program/membership/tier/ledger/reward/referral concepts are separated;
- money is separated from loyalty value;
- capabilities are canonical;
- earning and redemption semantics are defined;
- tier/rule versioning is defined;
- anti-abuse boundaries are defined;
- permissions and tenant scope are defined;
- event contracts are defined;
- CRM/Booking/Commerce/AI/Communications integration boundaries are defined;
- privacy and medical boundaries are defined;
- no vertical-specific duplicate engine is permitted.

**Decision:** Loyalty & Retention Engine architecture is frozen. Future work is limited to module-level extensions and explicit ADRs; Core architecture is not reopened.
