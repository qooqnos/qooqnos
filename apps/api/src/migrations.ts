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
];
