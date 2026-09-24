import { AdvertisingRepository, AdvertisingService } from "@qooqnos/advertising";
import { AuthorizationRepository } from "@qooqnos/database";
import { createAuthorizationService, type AuthorizationRegistry } from "@qooqnos/runtime";
import { AppError, brandId, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerAdvertisingRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "POST",
    path: "/api/v1/advertising/accounts",
    module: "advertising",
    operation: "advertising.account.create",
    permission: "advertising.create_account",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const account = await service.createAccount(context, {
        businessId: requiredId(body.businessId, "businessId", context.requestId),
        currency: requiredString(body.currency, "currency", context.requestId),
      });
      return json({ data: account }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/advertising/campaigns",
    module: "advertising",
    operation: "advertising.campaign.create",
    permission: "advertising.campaign.manage",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const campaign = await service.createCampaign(context, {
        advertisingAccountId: requiredId(body.advertisingAccountId, "advertisingAccountId", context.requestId),
        name: requiredString(body.name, "name", context.requestId),
        objective: requiredString(body.objective, "objective", context.requestId),
      });
      return json({ data: campaign }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/advertising/campaigns/:campaignId/versions",
    module: "advertising",
    operation: "advertising.campaign.version",
    permission: "advertising.campaign.manage",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const version = await service.createCampaignVersion(context, {
        campaignId: brandId<EntityId>(requiredParam(params.campaignId, context.requestId)),
        version: requiredPositiveInteger(body.version, "version", context.requestId),
        targetingRules: requiredObject(body.targetingRules ?? {}, "targetingRules", context.requestId),
        placementRules: requiredObject(body.placementRules ?? {}, "placementRules", context.requestId),
        pacingPolicy: requiredObject(body.pacingPolicy ?? {}, "pacingPolicy", context.requestId),
        effectiveFrom: requiredString(body.effectiveFrom, "effectiveFrom", context.requestId),
        ...(body.effectiveTo !== undefined ? { effectiveTo: requiredString(body.effectiveTo, "effectiveTo", context.requestId) } : {}),
      });
      return json({ data: version }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/advertising/campaigns/:campaignId/activate",
    module: "advertising",
    operation: "advertising.campaign.activate",
    permission: "advertising.campaign.activate",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const campaign = await service.activateCampaign(
        context,
        brandId<EntityId>(requiredParam(params.campaignId, context.requestId)),
        requiredId(body.versionId, "versionId", context.requestId),
      );
      return json({ data: campaign }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/advertising/ads",
    module: "advertising",
    operation: "advertising.ad.create",
    permission: "advertising.ad.manage",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const ad = await service.createAd(context, {
        campaignVersionId: requiredId(body.campaignVersionId, "campaignVersionId", context.requestId),
        subjectType: requiredString(body.subjectType, "subjectType", context.requestId),
        subjectId: requiredId(body.subjectId, "subjectId", context.requestId),
        creativeReference: requiredString(body.creativeReference, "creativeReference", context.requestId),
        moderationStatus: requiredString(body.moderationStatus, "moderationStatus", context.requestId),
      });
      return json({ data: ad }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/advertising/budgets",
    module: "advertising",
    operation: "advertising.budget.create",
    permission: "advertising.budget.manage",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const budget = await service.createBudget(context, {
        campaignId: requiredId(body.campaignId, "campaignId", context.requestId),
        ...(body.totalLimitMinor !== undefined ? { totalLimitMinor: requiredNonNegativeInteger(body.totalLimitMinor, "totalLimitMinor", context.requestId) } : {}),
        ...(body.dailyLimitMinor !== undefined ? { dailyLimitMinor: requiredNonNegativeInteger(body.dailyLimitMinor, "dailyLimitMinor", context.requestId) } : {}),
        currency: requiredString(body.currency, "currency", context.requestId),
      });
      return json({ data: budget }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/advertising/delivery",
    module: "advertising",
    operation: "advertising.delivery",
    permission: "advertising.deliver",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const decision = await service.decideDelivery(context, {
        adId: requiredId(body.adId, "adId", context.requestId),
        placementId: requiredId(body.placementId, "placementId", context.requestId),
        decision: requiredEnum(body.decision, "decision", ["served","rejected"], context.requestId),
        ...(body.reason !== undefined ? { reason: requiredString(body.reason, "reason", context.requestId) } : {}),
        policyVersion: requiredString(body.policyVersion, "policyVersion", context.requestId),
        deduplicationKey: requiredString(body.deduplicationKey, "deduplicationKey", context.requestId),
      });
      return json({ data: decision }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/advertising/impressions",
    module: "advertising",
    operation: "advertising.impression.record",
    permission: "advertising.deliver",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const impression = await service.recordImpression(context, {
        deliveryDecisionId: requiredId(body.deliveryDecisionId, "deliveryDecisionId", context.requestId),
        ...(body.contextReference !== undefined ? { contextReference: requiredString(body.contextReference, "contextReference", context.requestId) } : {}),
        deduplicationKey: requiredString(body.deduplicationKey, "deduplicationKey", context.requestId),
      });
      return json({ data: impression }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/advertising/clicks",
    module: "advertising",
    operation: "advertising.click.record",
    permission: "advertising.deliver",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const click = await service.recordClick(context, {
        impressionId: requiredId(body.impressionId, "impressionId", context.requestId),
        deduplicationKey: requiredString(body.deduplicationKey, "deduplicationKey", context.requestId),
      });
      return json({ data: click }, 201, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/advertising/campaigns/:campaignId/report",
    module: "advertising",
    operation: "advertising.report.read",
    permission: "advertising.report.read",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      const report = await service.report(context, brandId<EntityId>(requiredParam(params.campaignId, context.requestId)));
      return json({ data: report }, 200, context.requestId);
    },
  });
}

function createService(database: D1Database | undefined, authorization: AuthorizationRegistry | undefined, requestId: EntityId): AdvertisingService {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  if (!authorization) throw new AppError({ code: "INTERNAL_ERROR", message: "Authorization registry is not configured.", requestId });
  return new AdvertisingService({
    repository: new AdvertisingRepository(database),
    authorization: createAuthorizationService(new AuthorizationRepository(database), authorization),
    id: () => brandId<EntityId>(crypto.randomUUID()),
    now: () => new Date().toISOString(),
  });
}

async function bodyObject(request: Request, requestId: EntityId): Promise<Record<string, unknown>> {
  const value = await request.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError({ code: "VALIDATION_ERROR", message: "Request body must be an object.", requestId });
  return value as Record<string, unknown>;
}
function requiredString(value: unknown, field: string, requestId: EntityId): string {
  if (typeof value !== "string" || !value.trim()) throw new AppError({ code: "VALIDATION_ERROR", message: field + " is required.", requestId });
  return value.trim();
}
function requiredId(value: unknown, field: string, requestId: EntityId): EntityId { return brandId<EntityId>(requiredString(value, field, requestId)); }
function requiredParam(value: string | undefined, requestId: EntityId): string {
  if (!value) throw new AppError({ code: "NOT_FOUND", message: "Route parameter is missing.", requestId });
  return value;
}
function requiredPositiveInteger(value: unknown, field: string, requestId: EntityId): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be a positive integer.", requestId });
  return value as number;
}
function requiredNonNegativeInteger(value: unknown, field: string, requestId: EntityId): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be a non-negative integer.", requestId });
  return value as number;
}
function requiredObject(value: unknown, field: string, requestId: EntityId): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be an object.", requestId });
  return value as Readonly<Record<string, unknown>>;
}
function requiredEnum<T extends string>(value: unknown, field: string, values: readonly T[], requestId: EntityId): T {
  if (typeof value === "string" && values.includes(value as T)) return value as T;
  throw new AppError({ code: "VALIDATION_ERROR", message: field + " is invalid.", requestId });
}
