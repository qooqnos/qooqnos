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
];
