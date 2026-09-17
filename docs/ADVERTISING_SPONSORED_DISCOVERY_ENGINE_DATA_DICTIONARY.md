# Phoenix Advertising & Sponsored Discovery Engine Data Dictionary

**Status:** Canonical data contract

## 1. Advertiser

Reference to the business/organization authorized to advertise.

Fields:
- id;
- owner_type;
- owner_id;
- tenant_id;
- status;
- created_at;
- updated_at.

Business remains authoritative for business identity.

## 2. AdvertisingAccount

Operational advertising account.

Fields:
- id;
- advertiser_id;
- billing_account_reference;
- currency;
- status;
- spending_limit_reference;
- created_at;
- updated_at.

Billing owns monetary truth.

## 3. Campaign

Advertising campaign aggregate.

Fields:
- id;
- advertising_account_id;
- name;
- objective;
- status;
- budget_id;
- targeting_policy_version;
- moderation_reference;
- start_at;
- end_at;
- created_at;
- updated_at.

## 4. CampaignVersion

Immutable configuration snapshot.

Fields:
- id;
- campaign_id;
- version;
- targeting_rules;
- placement_rules;
- pacing_policy;
- creative_references;
- effective_from;
- effective_to;
- status.

## 5. Ad

Deliverable sponsored unit.

Fields:
- id;
- campaign_version_id;
- subject_type;
- subject_id;
- creative_id;
- status;
- moderation_reference;
- created_at;
- updated_at.

## 6. AdCreative

Creative content reference.

Fields:
- id;
- media_references;
- copy_reference;
- locale;
- claims_reference;
- moderation_status;
- policy_version;
- created_at;
- expires_at.

Creative binaries remain owned by Media.

## 7. TargetingRule

Rule describing an allowed targeting constraint.

Fields:
- id;
- campaign_version_id;
- attribute;
- operator;
- value_reference;
- scope;
- policy_version;
- status.

Sensitive targeting requires explicit policy authorization.

## 8. EligibilityDecision

Decision on whether an ad may be served.

Fields:
- id;
- ad_id;
- placement_id;
- decision;
- reasons;
- policy_version;
- evaluated_at;
- source_references.

## 9. Placement

Defined sponsored inventory location.

Fields:
- id;
- placement_type;
- surface;
- context;
- eligibility_policy_version;
- status.

## 10. DeliveryDecision

Decision record for a delivery opportunity.

Fields:
- id;
- ad_id;
- placement_id;
- targeting_result;
- eligibility_result;
- budget_result;
- pacing_result;
- experiment_reference;
- decision;
- policy_version;
- decided_at.

## 11. Budget

Configured spending boundary.

Fields:
- id;
- campaign_id;
- total_limit;
- daily_limit;
- currency;
- effective_from;
- effective_to;
- reserved_amount_reference;
- spent_amount_reference;
- status.

Amounts are references to Billing/usage accounting where financial authority is required.

## 12. PacingPolicy

Controls delivery rate.

Fields:
- id;
- campaign_id;
- mode;
- rate_limit;
- frequency_limit;
- policy_version;
- effective_from;
- effective_to.

## 13. Impression

Evidence that an ad was served/rendered according to the configured measurement definition.

Fields:
- id;
- delivery_decision_id;
- timestamp;
- context_reference;
- deduplication_key;
- measurement_version.

## 14. Click

Recorded click interaction.

Fields:
- id;
- impression_id;
- timestamp;
- deduplication_key;
- context_reference.

## 15. ConversionReference

Reference to an authoritative conversion.

Fields:
- id;
- campaign_id;
- source_module;
- source_type;
- source_id;
- attribution_reference;
- occurred_at.

Advertising does not duplicate order/payment/booking truth.

## 16. SpendLedgerReference

Reference to billable delivery/spend accounting.

Fields:
- id;
- campaign_id;
- billing_reference;
- usage_type;
- quantity;
- currency;
- amount_reference;
- idempotency_key;
- recorded_at.

Billing remains authoritative for money.

## 17. AdvertisingExperiment

Controlled delivery experiment.

Fields:
- id;
- campaign_id;
- variant_definitions;
- allocation_policy;
- measurement_policy;
- status;
- policy_version.

## 18. State Machines

Campaign:
```text
DRAFT → REVIEWING → ACTIVE → PAUSED → COMPLETED
                  ↘ REJECTED
```

Ad:
```text
DRAFT → REVIEWING → APPROVED → ACTIVE → PAUSED/EXPIRED
                  ↘ REJECTED
```

## 19. Ownership Matrix

| Data | Owner |
|---|---|
| Advertiser identity | Business |
| Campaign/ad delivery | Advertising |
| Product/service truth | Catalog |
| Organic discovery | Discovery |
| Offers/discounts | Promotion |
| Media | Media |
| Verification | Trust |
| Moderation | Moderation |
| Financial truth | Billing |
| Customer identity | Customer/Identity |
| Consent | Privacy/Security |
| Metrics | Analytics |

## 20. AI Provenance

AI recommendations record:
- model/version;
- input references;
- policy version;
- recommendation;
- generated_at;
- approval status.

AI cannot become the financial, moderation, or policy authority.

## 21. Tenancy and Privacy

Campaigns, accounts, targeting, and measurements are tenant-scoped unless explicitly platform scoped.

Consent and privacy restrictions are evaluated before personalized targeting.

## 22. Audit

Material campaign changes and delivery decisions reference actor, policy, authorization, correlation, timestamp, and outcome.

## 23. Capabilities

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

## 24. Events

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

## 25. Invariants

1. Sponsored content is distinguishable from organic results.
2. Advertising cannot mutate organic ranking.
3. Financial truth belongs to Billing.
4. Sensitive targeting requires explicit policy authorization.
5. Moderation approval is enforced where required.
6. AI cannot bypass policy or spending limits.
7. Conversion truth remains in the source domain.
8. Delivery events are idempotent.
9. Tenant isolation is mandatory.
10. Active campaign versions are immutable.

## 26. Anti-Duplication

One advertising data model serves every vertical.

No BeautyAdvertising, FashionAdvertising, or MedicalAdvertising data models may be created.

## 27. Definition of Done

Advertiser, account, campaign/version, ads, creatives, targeting, eligibility, placement, delivery, budget, pacing, measurement, conversion references, spend references, experiments, privacy, moderation, authorization, tenancy, capabilities, and events are canonical.
