import { PromotionRepository, PromotionService, type PromotionRecord } from "@qooqnos/promotion";
import { AuthorizationRepository } from "@qooqnos/database";
import { createAuthorizationService, type AuthorizationRegistry } from "@qooqnos/runtime";
import { AppError, brandId, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerPromotionRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "POST",
    path: "/api/v1/promotions",
    module: "promotion",
    operation: "promotion.create",
    permission: "promotion.create",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const promotion = await service.create(context, {
        name: requiredString(body.name, "name", context.requestId),
        promotionType: requiredString(body.promotionType, "promotionType", context.requestId),
        scope: requiredScope(body.scope, context.requestId),
        ...(body.businessId !== undefined ? { businessId: requiredId(body.businessId, "businessId", context.requestId) } : {}),
      });
      return json({ data: promotion }, 201, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/promotions/:promotionId",
    module: "promotion",
    operation: "promotion.read",
    permission: "promotion.read",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      const promotion = await service.get(context, brandId<EntityId>(requiredParam(params.promotionId, context.requestId)));
      if (!promotion) throw new AppError({ code: "NOT_FOUND", message: "Promotion not found.", requestId: context.requestId });
      return json({ data: promotion }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/promotions/:promotionId/versions",
    module: "promotion",
    operation: "promotion.version.manage",
    permission: "promotion.version.manage",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const version = await service.createVersion(context, {
        promotionId: brandId<EntityId>(requiredParam(params.promotionId, context.requestId)),
        version: requiredPositiveInteger(body.version, "version", context.requestId),
        benefit: requiredObject(body.benefit, "benefit", context.requestId),
        eligibilityRules: requiredObject(body.eligibilityRules, "eligibilityRules", context.requestId),
        stackPolicy: requiredObject(body.stackPolicy ?? {}, "stackPolicy", context.requestId),
        effectiveFrom: requiredString(body.effectiveFrom, "effectiveFrom", context.requestId),
        ...(body.effectiveTo !== undefined ? { effectiveTo: requiredString(body.effectiveTo, "effectiveTo", context.requestId) } : {}),
      });
      return json({ data: version }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/promotions/:promotionId/activate",
    module: "promotion",
    operation: "promotion.activate",
    permission: "promotion.activate",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const promotion = await service.activate(
        context,
        brandId<EntityId>(requiredParam(params.promotionId, context.requestId)),
        requiredId(body.versionId, "versionId", context.requestId),
      );
      return json({ data: promotion }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/promotions/evaluate",
    module: "promotion",
    operation: "promotion.evaluate",
    permission: "promotion.evaluate",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const result = await service.evaluate(context, {
        promotionId: requiredId(body.promotionId, "promotionId", context.requestId),
        subjectId: requiredId(body.subjectId, "subjectId", context.requestId),
        idempotencyKey: requiredString(body.idempotencyKey, "idempotencyKey", context.requestId),
        ...(body.now !== undefined ? { now: requiredString(body.now, "now", context.requestId) } : {}),
        ...(body.channel !== undefined ? { channel: requiredString(body.channel, "channel", context.requestId) } : {}),
        ...(body.amountMinor !== undefined ? { amountMinor: requiredNonNegativeInteger(body.amountMinor, "amountMinor", context.requestId) } : {}),
        ...(body.businessId !== undefined ? { businessId: requiredId(body.businessId, "businessId", context.requestId) } : {}),
      });
      return json({ data: result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/promotions/:promotionId/redeem",
    module: "promotion",
    operation: "promotion.redeem",
    permission: "promotion.redeem",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const redemption = await service.redeem(context, {
        qualificationId: requiredId(body.qualificationId, "qualificationId", context.requestId),
        promotionId: brandId<EntityId>(requiredParam(params.promotionId, context.requestId)),
        promotionVersionId: requiredId(body.promotionVersionId, "promotionVersionId", context.requestId),
        subjectId: requiredId(body.subjectId, "subjectId", context.requestId),
        transactionType: requiredString(body.transactionType, "transactionType", context.requestId),
        transactionId: requiredId(body.transactionId, "transactionId", context.requestId),
        benefitReference: requiredString(body.benefitReference, "benefitReference", context.requestId),
        idempotencyKey: requiredString(body.idempotencyKey, "idempotencyKey", context.requestId),
      });
      return json({ data: redemption }, 201, context.requestId);
    },
  });
}

function createService(database: D1Database | undefined, authorization: AuthorizationRegistry | undefined, requestId: EntityId): PromotionService {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  if (!authorization) throw new AppError({ code: "INTERNAL_ERROR", message: "Authorization registry is not configured.", requestId });
  return new PromotionService({
    repository: new PromotionRepository(database),
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
function requiredScope(value: unknown, requestId: EntityId): PromotionRecord["scope"] {
  const values: PromotionRecord["scope"][] = ["platform","organization","workspace","business","location","campaign"];
  if (typeof value === "string" && values.includes(value as PromotionRecord["scope"])) return value as PromotionRecord["scope"];
  throw new AppError({ code: "VALIDATION_ERROR", message: "scope is invalid.", requestId });
}
