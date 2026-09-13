# Phoenix Promotion Data Model

**Status:** Architecture defined / frozen
**Owner:** Promotion

This document defines the canonical data vocabulary for the Promotion module.

## Canonical entities

- Promotion
- PromotionVersion
- Benefit
- Rule
- Scope
- StackPolicy
- Qualification
- Offer
- Reservation
- Redemption
- UsageCounter
- Campaign
- CampaignAudience
- CampaignPromotionLink
- CampaignExperiment
- CampaignMeasurement
- AbuseSignal

## Identity fields

Every Promotion-owned entity uses a stable identifier, tenant scope where applicable, lifecycle state, creation timestamp, update timestamp, and policy/version reference where applicable.

## Decision fields

Qualification and redemption records retain the promotion version, policy version, actor reference, evidence references, decision state, timestamp, idempotency key and correlation identifier.

## Separation of truth

Catalog owns base product/service facts. Booking owns booking facts. Commerce/Billing owns order, payment and monetary facts. Loyalty owns loyalty value. CRM owns relationship state. Communications owns delivery. Analytics owns measurement. Promotion owns incentive policy and campaign orchestration.

## Invariants

1. A used policy version is immutable.
2. Qualification is not a transaction.
3. Reservation is not settlement.
4. Usage counters do not replace redemption history.
5. AI cannot independently resolve policy conflicts.
6. UI cannot independently calculate eligibility.
7. Vertical modules reuse the same Promotion model.
8. Canonical facts owned by another module are referenced, not duplicated.

## Lifecycle vocabulary

Promotion: draft, scheduled, active, paused, expired, retired.  
Campaign: draft, scheduled, active, paused, completed, cancelled.  
Offer: generated, available, reserved, redeemed, expired, revoked.  
Redemption: recorded, reversed, revoked.

## Event vocabulary

`promotion.scheduled`  
`promotion.activated`  
`promotion.paused`  
`promotion.expired`  
`promotion.qualified`  
`promotion.reserved`  
`promotion.redeemed`  
`promotion.revoked`  
`campaign.activated`  
`campaign.completed`

**Decision:** This is the canonical Promotion data model. Future changes require an explicit module-level ADR.
