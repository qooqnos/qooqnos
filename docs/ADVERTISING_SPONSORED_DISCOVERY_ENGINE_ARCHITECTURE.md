# Phoenix Advertising & Sponsored Discovery Engine Architecture

**Status:** Canonical architecture contract

## 1. Purpose

Advertising is the reusable commercial visibility layer for paid or sponsored exposure of eligible marketplace entities.

It controls campaign delivery, eligibility, placement, budgets, pacing, measurement, and billing references.

Advertising must never replace organic Discovery ranking or Promotion rules.

## 2. Ownership

| Domain | Owns |
|---|---|
| Advertising | campaigns, ad units, delivery decisions, budgets, pacing, measurements |
| Discovery | organic search/recommendation and candidate truth |
| Promotion | customer-facing offers/discount rules |
| Catalog | product/service truth |
| Business | advertiser identity |
| Billing | charges, invoices, financial truth |
| Analytics | aggregate analytics |
| AI | bounded optimization/recommendation |
| Moderation | ad/content safety |
| Trust | verification |
| Authorization | access |

## 3. Concepts

- Advertiser
- AdvertisingAccount
- Campaign
- CampaignVersion
- Ad
- AdCreative
- TargetingRule
- EligibilityRule
- Placement
- DeliveryDecision
- Budget
- PacingPolicy
- Impression
- Click
- ConversionReference
- SpendLedger
- AdvertisingExperiment

## 4. Delivery Boundary

```text
Advertiser
 → Campaign
 → Eligibility
 → Targeting
 → Placement
 → Budget/Pacing
 → Delivery Decision
 → Impression/Click
 → Conversion Reference
 → Billing/Analytics
```

## 5. Organic Discovery Separation

Sponsored delivery is explicitly labeled.

Advertising may request eligible placement from Discovery, but must not modify organic ranking scores.

Organic results and sponsored results remain distinguishable.

## 6. Eligibility

Before delivery:
- advertiser active;
- campaign active;
- ad approved by policy;
- target entity eligible;
- jurisdiction allowed;
- budget available;
- placement available;
- frequency/pacing limits satisfied.

Moderation and Trust outcomes may be prerequisites.

## 7. Targeting

Targeting can use:
- geography;
- category;
- context;
- approved audience;
- language;
- device/context where lawful.

Sensitive attributes must not be used for targeting unless explicitly permitted by applicable policy.

Customer preferences are not automatically advertising targeting permissions.

## 8. Budget and Pacing

Budget may be:
- total campaign budget;
- daily budget;
- placement budget.

Pacing controls delivery rate.

Financial truth belongs to Billing. Advertising records spend references and delivery accounting.

## 9. Delivery

Delivery decision records why an eligible ad was or was not selected.

Factors can include:
- eligibility;
- targeting;
- placement;
- pacing;
- budget;
- frequency;
- policy;
- experiment assignment.

AI optimization is bounded by configured policy.

## 10. Measurement

Canonical measurement:
- impression;
- click;
- conversion reference;
- spend reference;
- reach/frequency where supported.

Raw event collection remains governed by privacy and analytics policy.

## 11. Billing Boundary

Advertising does not own money.

It emits billable usage/charge references to Billing.

Billing owns:
- monetary amount;
- invoice;
- payment;
- refund;
- financial ledger.

## 12. AI Boundary

AI may:
- recommend targeting;
- optimize approved bids/weights;
- predict delivery;
- detect anomalies;
- suggest creatives;
- summarize campaign performance.

AI may not:
- target prohibited sensitive attributes;
- bypass moderation;
- fabricate performance;
- spend outside approved limits;
- activate campaigns without authorization;
- override billing controls.

## 13. Moderation

All sponsored creatives and claims follow Moderation policy.

Regulated/medical advertising requires applicable policy review.

Verification status may be an eligibility input but does not become an advertising decision itself.

## 14. Lifecycle

### Campaign
```text
DRAFT → REVIEWING → ACTIVE → PAUSED → COMPLETED
                     ↓
                  REJECTED
```

### Ad
```text
DRAFT → REVIEWING → APPROVED → ACTIVE → PAUSED/EXPIRED
                  ↘ REJECTED
```

Active versions are immutable.

## 15. Tenancy

Advertising accounts and campaigns are tenant scoped.

Platform campaigns are explicitly platform scoped.

Cross-tenant targeting and reporting are prohibited unless an explicitly authorized aggregate operation permits it.

## 16. Idempotency

Impression, click, conversion, spend, and delivery events require idempotent event identity.

Budget reservation and spend accounting must prevent double charging.

## 17. Events

```text
advertising.campaign.created
advertising.campaign.activated
advertising.campaign.paused
advertising.campaign.completed
advertising.ad.approved
advertising.ad.rejected
advertising.delivery.served
advertising.impression.recorded
advertising.click.recorded
advertising.conversion.recorded
advertising.budget.threshold_reached
```

## 18. Capabilities

```text
CAP.ADVERTISING.CREATE_CAMPAIGN
CAP.ADVERTISING.UPDATE_CAMPAIGN
CAP.ADVERTISING.ACTIVATE_CAMPAIGN
CAP.ADVERTISING.PAUSE_CAMPAIGN
CAP.ADVERTISING.CREATE_AD
CAP.ADVERTISING.SUBMIT_FOR_REVIEW
CAP.ADVERTISING.GET_CAMPAIGN
CAP.ADVERTISING.GET_REPORT
CAP.ADVERTISING.MANAGE_BUDGET
CAP.ADVERTISING.DELIVER
```

## 19. Privacy and Compliance

Advertising must respect:
- consent;
- purpose limitation;
- jurisdictional restrictions;
- retention;
- user controls;
- prohibited targeting policies.

Personalized advertising requires explicit policy authorization; ordinary discovery personalization does not automatically authorize advertising personalization.

## 20. Performance

Delivery decisions must be low-latency.

Heavy operations such as creative generation, analytics aggregation, anomaly detection, and reporting are asynchronous.

## 21. Anti-Duplication

There is exactly one Advertising & Sponsored Discovery Engine.

Do not create BeautyAdvertising, FashionAdvertising, MedicalAdvertising, or separate vertical ad engines.

Vertical differences use policy, targeting configuration, placement definitions, and domain adapters.

## 22. Definition of Done

Advertising is canonical when campaign lifecycle, ads/creatives, targeting, eligibility, placement, budget/pacing, delivery, measurement, billing boundary, moderation, privacy, AI boundaries, capabilities, events, tenancy, and anti-duplication are explicit.
