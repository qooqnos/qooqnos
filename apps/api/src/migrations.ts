import foundation from "../../../migrations/0001_foundation.sql";
import onboarding from "../../../migrations/0002_onboarding.sql";
import identitySessions from "../../../migrations/0003_identity_sessions.sql";
import business from "../../../migrations/0004_business.sql";
import catalog from "../../../migrations/0005_catalog.sql";
import catalogProductGuards from "../../../migrations/0006_catalog_product_guards.sql";
import catalogIntegrityGuards from "../../../migrations/0007_catalog_integrity_guards.sql";
import permissionCatalog from "../../../migrations/0008_permission_catalog.sql";
import media from "../../../migrations/0009_media.sql";
import discovery from "../../../migrations/0010_discovery.sql";
import aiSellerCreation from "../../../migrations/0011_ai_seller_creation.sql";
import aiSellerCatalogLink from "../../../migrations/0012_ai_seller_catalog_link.sql";
import aiSellerIdempotencyFingerprint from "../../../migrations/0013_ai_seller_idempotency_fingerprint.sql";
import catalogOfferingIntegrity from "../../../migrations/0014_catalog_offering_integrity.sql";
import businessPrimaryCategoryIntegrity from "../../../migrations/0015_business_primary_category_integrity.sql";
import catalogAttributeVocabulary from "../../../migrations/0016_catalog_attribute_vocabulary.sql";
import catalogAttributeValues from "../../../migrations/0017_catalog_attribute_values.sql";
import customerCore from "../../../migrations/0018_customer_core.sql";
import crmCustomerRelationships from "../../../migrations/0019_crm_customer_relationships.sql";
import crmTimelineEvents from "../../../migrations/0020_crm_timeline_events.sql";
import verificationCaseAndDocuments from "../../../migrations/0021_verification_case_and_documents.sql";
import verificationPolicyRequirements from "../../../migrations/0022_verification_policy_requirements.sql";
import verificationChecks from "../../../migrations/0023_verification_checks.sql";
import verificationDecisions from "../../../migrations/0024_verification_decisions.sql";
import verificationReviewExpiry from "../../../migrations/0025_verification_review_expiry.sql";
import customerAddresses from "../../../migrations/0026_customer_addresses.sql";
import businessStatusHistory from "../../../migrations/0027_business_status_history.sql";
import bookingCore from "../../../migrations/0028_booking_core.sql";
import availabilitySchedules from "../../../migrations/0029_availability_schedules.sql";
import bookingHoldsHistory from "../../../migrations/0030_booking_holds_history.sql";
import commerceTransactionCore from "../../../migrations/0031_commerce_transaction_core.sql";
import commerceIntegrityHardening from "../../../migrations/0032_commerce_integrity_hardening.sql";
import billingCore from "../../../migrations/0033_billing_core.sql";
import billingUsageCounters from "../../../migrations/0034_billing_usage_counters.sql";
import communicationCore from "../../../migrations/0035_communication_core.sql";
import automationCore from "../../../migrations/0036_automation_core.sql";
import aiRuntimeCore from "../../../migrations/0037_ai_runtime_core.sql";
import integrationCore from "../../../migrations/0038_integration_core.sql";
import privacyConsentRequests from "../../../migrations/0039_privacy_consent_requests.sql";
import demandMatchingCore from "../../../migrations/0040_demand_matching_core.sql";
import demandMatchingIntegrity from "../../../migrations/0041_demand_matching_integrity.sql";
import reviewsCore from "../../../migrations/0042_reviews_core.sql";
import integrityUpdateGuards from "../../../migrations/0043_integrity_update_guards.sql";
import billingCounterScope from "../../../migrations/0044_billing_counter_scope.sql";
import reviewTargetIntegrity from "../../../migrations/0045_review_target_integrity.sql";
import bookingFinalizationGuards from "../../../migrations/0046_booking_finalization_guards.sql";
import bookingCapacityUpdateGuards from "../../../migrations/0047_booking_capacity_update_guards.sql";
import reviewsModerationReputation from "../../../migrations/0048_reviews_moderation_reputation.sql";
import fulfillmentCore from "../../../migrations/0049_fulfillment_core.sql";
import caseSupportCore from "../../../migrations/0050_case_support_core.sql";
import communicationTemplates from "../../../migrations/0051_communication_templates.sql";
import moderationCases from "../../../migrations/0052_moderation_cases.sql";
import aiRuntimeWorkerLeases from "../../../migrations/0053_ai_runtime_worker_leases.sql";
import discoveryIndexObservability from "../../../migrations/0054_discovery_index_observability.sql";
import communicationPolicyConsent from "../../../migrations/0055_communication_policy_consent.sql";
import communicationRequiredSuppression from "../../../migrations/0056_communication_required_suppression.sql";
import matchingLearningSignals from "../../../migrations/0057_matching_learning_signals.sql";
import billingFinancialAuditTrail from "../../../migrations/0058_billing_financial_audit_trail.sql";
import billingRefundFinancialAccounting from "../../../migrations/0059_billing_refund_financial_accounting.sql";
import billingInvoiceSystem from "../../../migrations/0060_billing_invoice_system.sql";
import billingSettlement from "../../../migrations/0061_billing_settlement.sql";
import billingReconciliationHardening from "../../../migrations/0062_billing_reconciliation_hardening.sql";
import catalogAttributeCutover from "../../../migrations/0063_catalog_attribute_cutover.sql";
import trustSignalsAntiAbuse from "../../../migrations/0064_trust_signals_anti_abuse.sql";
import communicationPushChannel from "../../../migrations/0067_communication_push_channel.sql";
import automationCompensationContract from "../../../migrations/0069_automation_compensation_contract.sql";
import automationCompensationPairing from "../../../migrations/0070_automation_compensation_pairing.sql";
import matchingActOutcomeLinks from "../../../migrations/0071_matching_act_outcome_links.sql";
import localizationRegistry from "../../../migrations/0072_localization_registry.sql";
import caseQueueProviderDispatch from "../../../migrations/0073_case_queue_provider_dispatch.sql";
import crmTimelineProjection from "../../../migrations/0074_crm_timeline_projection.sql";
import analyticsPlatform from "../../../migrations/0075_analytics_platform.sql";
import aiMemory from "../../../migrations/0076_ai_memory.sql";
import seoGeoEngine from "../../../migrations/0077_seo_geo_engine.sql";
import seoGeoGraph from "../../../migrations/0078_seo_geo_graph.sql";
import seoOperationalControlPlane from "../../../migrations/0079_seo_operational_control_plane.sql";
import promotionCore from "../../../migrations/0080_promotion_core.sql";
import loyaltyCore from "../../../migrations/0081_loyalty_core.sql";
import advertisingCore from "../../../migrations/0082_advertising_core.sql";
import authorizationApproval from "../../../migrations/0083_authorization_approval_workflow.sql";
import seoPublicRenderIndex from "../../../migrations/0084_seo_public_render_index.sql";
import seoAuditQualityGate from "../../../migrations/0085_seo_audit_quality_gate.sql";
import seoVisibilityMeasurements from "../../../migrations/0086_seo_visibility_measurements.sql";
import seoCompetitiveIntelligence from "../../../migrations/0087_seo_competitive_intelligence.sql";
import seoCompetitorPageSnapshots from "../../../migrations/0088_seo_competitor_page_snapshots.sql";
import seoCompetitiveKeywordGaps from "../../../migrations/0089_seo_competitive_keyword_gaps.sql";
import seoCompetitiveLinkGaps from "../../../migrations/0090_seo_competitive_link_gaps.sql";
import commerceFulfillmentPolicies from "../../../migrations/0091_commerce_fulfillment_policies.sql";
import type { MigrationSource } from "@qooqnos/database";

export const migrationSources: readonly MigrationSource[] = [
  { path: "migrations/0001_foundation.sql", sql: foundation },
  { path: "migrations/0002_onboarding.sql", sql: onboarding },
  { path: "migrations/0003_identity_sessions.sql", sql: identitySessions },
  { path: "migrations/0004_business.sql", sql: business },
  { path: "migrations/0005_catalog.sql", sql: catalog },
  { path: "migrations/0006_catalog_product_guards.sql", sql: catalogProductGuards },
  { path: "migrations/0007_catalog_integrity_guards.sql", sql: catalogIntegrityGuards },
  { path: "migrations/0008_permission_catalog.sql", sql: permissionCatalog },
  { path: "migrations/0009_media.sql", sql: media },
  { path: "migrations/0010_discovery.sql", sql: discovery },
  { path: "migrations/0011_ai_seller_creation.sql", sql: aiSellerCreation },
  { path: "migrations/0012_ai_seller_catalog_link.sql", sql: aiSellerCatalogLink },
  { path: "migrations/0013_ai_seller_idempotency_fingerprint.sql", sql: aiSellerIdempotencyFingerprint },
  { path: "migrations/0014_catalog_offering_integrity.sql", sql: catalogOfferingIntegrity },
  { path: "migrations/0015_business_primary_category_integrity.sql", sql: businessPrimaryCategoryIntegrity },
  { path: "migrations/0016_catalog_attribute_vocabulary.sql", sql: catalogAttributeVocabulary },
  { path: "migrations/0017_catalog_attribute_values.sql", sql: catalogAttributeValues },
  { path: "migrations/0018_customer_core.sql", sql: customerCore },
  { path: "migrations/0019_crm_customer_relationships.sql", sql: crmCustomerRelationships },
  { path: "migrations/0020_crm_timeline_events.sql", sql: crmTimelineEvents },
  { path: "migrations/0021_verification_case_and_documents.sql", sql: verificationCaseAndDocuments },
  { path: "migrations/0022_verification_policy_requirements.sql", sql: verificationPolicyRequirements },
  { path: "migrations/0023_verification_checks.sql", sql: verificationChecks },
  { path: "migrations/0024_verification_decisions.sql", sql: verificationDecisions },
  { path: "migrations/0025_verification_review_expiry.sql", sql: verificationReviewExpiry },
  { path: "migrations/0026_customer_addresses.sql", sql: customerAddresses },
  { path: "migrations/0027_business_status_history.sql", sql: businessStatusHistory },
  { path: "migrations/0028_booking_core.sql", sql: bookingCore },
  { path: "migrations/0029_availability_schedules.sql", sql: availabilitySchedules },
  { path: "migrations/0030_booking_holds_history.sql", sql: bookingHoldsHistory },
  { path: "migrations/0031_commerce_transaction_core.sql", sql: commerceTransactionCore },
  { path: "migrations/0032_commerce_integrity_hardening.sql", sql: commerceIntegrityHardening },
  { path: "migrations/0033_billing_core.sql", sql: billingCore },
  { path: "migrations/0034_billing_usage_counters.sql", sql: billingUsageCounters },
  { path: "migrations/0035_communication_core.sql", sql: communicationCore },
  { path: "migrations/0036_automation_core.sql", sql: automationCore },
  { path: "migrations/0037_ai_runtime_core.sql", sql: aiRuntimeCore },
  { path: "migrations/0038_integration_core.sql", sql: integrationCore },
  { path: "migrations/0039_privacy_consent_requests.sql", sql: privacyConsentRequests },
  { path: "migrations/0040_demand_matching_core.sql", sql: demandMatchingCore },
  { path: "migrations/0041_demand_matching_integrity.sql", sql: demandMatchingIntegrity },
  { path: "migrations/0042_reviews_core.sql", sql: reviewsCore },
  { path: "migrations/0043_integrity_update_guards.sql", sql: integrityUpdateGuards },
  { path: "migrations/0044_billing_counter_scope.sql", sql: billingCounterScope },
  { path: "migrations/0045_review_target_integrity.sql", sql: reviewTargetIntegrity },
  { path: "migrations/0046_booking_finalization_guards.sql", sql: bookingFinalizationGuards },
  { path: "migrations/0047_booking_capacity_update_guards.sql", sql: bookingCapacityUpdateGuards },
  { path: "migrations/0048_reviews_moderation_reputation.sql", sql: reviewsModerationReputation },
  { path: "migrations/0049_fulfillment_core.sql", sql: fulfillmentCore },
  { path: "migrations/0050_case_support_core.sql", sql: caseSupportCore },
  { path: "migrations/0051_communication_templates.sql", sql: communicationTemplates },
  { path: "migrations/0052_moderation_cases.sql", sql: moderationCases },
  { path: "migrations/0053_ai_runtime_worker_leases.sql", sql: aiRuntimeWorkerLeases },
  { path: "migrations/0054_discovery_index_observability.sql", sql: discoveryIndexObservability },
  { path: "migrations/0055_communication_policy_consent.sql", sql: communicationPolicyConsent },
  { path: "migrations/0056_communication_required_suppression.sql", sql: communicationRequiredSuppression },
  { path: "migrations/0057_matching_learning_signals.sql", sql: matchingLearningSignals },
  { path: "migrations/0058_billing_financial_audit_trail.sql", sql: billingFinancialAuditTrail },
  { path: "migrations/0059_billing_refund_financial_accounting.sql", sql: billingRefundFinancialAccounting },
  { path: "migrations/0060_billing_invoice_system.sql", sql: billingInvoiceSystem },
  { path: "migrations/0061_billing_settlement.sql", sql: billingSettlement },
  { path: "migrations/0062_billing_reconciliation_hardening.sql", sql: billingReconciliationHardening },
  { path: "migrations/0063_catalog_attribute_cutover.sql", sql: catalogAttributeCutover },
  { path: "migrations/0064_trust_signals_anti_abuse.sql", sql: trustSignalsAntiAbuse },
  { path: "migrations/0067_communication_push_channel.sql", sql: communicationPushChannel },
  { path: "migrations/0069_automation_compensation_contract.sql", sql: automationCompensationContract },
  { path: "migrations/0070_automation_compensation_pairing.sql", sql: automationCompensationPairing },
  { path: "migrations/0071_matching_act_outcome_links.sql", sql: matchingActOutcomeLinks },
  { path: "migrations/0072_localization_registry.sql", sql: localizationRegistry },
  { path: "migrations/0073_case_queue_provider_dispatch.sql", sql: caseQueueProviderDispatch },
  { path: "migrations/0074_crm_timeline_projection.sql", sql: crmTimelineProjection },
  { path: "migrations/0075_analytics_platform.sql", sql: analyticsPlatform },
  { path: "migrations/0076_ai_memory.sql", sql: aiMemory },
  { path: "migrations/0077_seo_geo_engine.sql", sql: seoGeoEngine },
  { path: "migrations/0078_seo_geo_graph.sql", sql: seoGeoGraph },
  { path: "migrations/0079_seo_operational_control_plane.sql", sql: seoOperationalControlPlane },
    { path: "migrations/0080_promotion_core.sql", sql: promotionCore },
  { path: "migrations/0081_loyalty_core.sql", sql: loyaltyCore },
  { path: "migrations/0082_advertising_core.sql", sql: advertisingCore },
  { path: "migrations/0083_authorization_approval_workflow.sql", sql: authorizationApproval },
  { path: "migrations/0084_seo_public_render_index.sql", sql: seoPublicRenderIndex },
  { path: "migrations/0085_seo_audit_quality_gate.sql", sql: seoAuditQualityGate },
  { path: "migrations/0086_seo_visibility_measurements.sql", sql: seoVisibilityMeasurements },
  { path: "migrations/0087_seo_competitive_intelligence.sql", sql: seoCompetitiveIntelligence },
  { path: "migrations/0088_seo_competitor_page_snapshots.sql", sql: seoCompetitorPageSnapshots },
  { path: "migrations/0089_seo_competitive_keyword_gaps.sql", sql: seoCompetitiveKeywordGaps },
  { path: "migrations/0090_seo_competitive_link_gaps.sql", sql: seoCompetitiveLinkGaps },
  { path: "migrations/0091_commerce_fulfillment_policies.sql", sql: commerceFulfillmentPolicies },
  ];
