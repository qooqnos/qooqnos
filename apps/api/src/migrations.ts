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
];
