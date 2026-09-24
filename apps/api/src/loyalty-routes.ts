import { LoyaltyRepository, LoyaltyService } from "@qooqnos/loyalty";
import { AuthorizationRepository } from "@qooqnos/database";
import { createAuthorizationService, type AuthorizationRegistry } from "@qooqnos/runtime";
import { AppError, brandId, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerLoyaltyRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "POST",
    path: "/api/v1/loyalty/programs",
    module: "loyalty",
    operation: "loyalty.program.create",
    permission: "loyalty.program.manage",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const program = await service.createProgram(context, {
        name: requiredString(body.name, "name", context.requestId),
        ...(body.businessId !== undefined ? { businessId: requiredId(body.businessId, "businessId", context.requestId) } : {}),
      });
      return json({ data: program }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/loyalty/programs/:programId/versions",
    module: "loyalty",
    operation: "loyalty.program.version",
    permission: "loyalty.program.manage",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const version = await service.createProgramVersion(context, {
        programId: brandId<EntityId>(requiredParam(params.programId, context.requestId)),
        version: requiredPositiveInteger(body.version, "version", context.requestId),
        rules: requiredObject(body.rules ?? {}, "rules", context.requestId),
      });
      return json({ data: version }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/loyalty/programs/:programId/activate",
    module: "loyalty",
    operation: "loyalty.program.activate",
    permission: "loyalty.program.manage",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const program = await service.activateProgram(
        context,
        brandId<EntityId>(requiredParam(params.programId, context.requestId)),
        requiredId(body.versionId, "versionId", context.requestId),
      );
      return json({ data: program }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/loyalty/memberships",
    module: "loyalty",
    operation: "loyalty.membership.enroll",
    permission: "loyalty.membership.manage",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const membership = await service.enrollMember(
        context,
        requiredId(body.programId, "programId", context.requestId),
        requiredId(body.customerId, "customerId", context.requestId),
      );
      return json({ data: membership }, 201, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/loyalty/memberships/:membershipId",
    module: "loyalty",
    operation: "loyalty.membership.read",
    permission: "loyalty.membership.read",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      const data = await service.getMembership(context, brandId<EntityId>(requiredParam(params.membershipId, context.requestId)));
      return json({ data }, 200, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/loyalty/memberships/:membershipId/ledger",
    module: "loyalty",
    operation: "loyalty.ledger.read",
    permission: "loyalty.ledger.read",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      const data = await service.listLedger(context, brandId<EntityId>(requiredParam(params.membershipId, context.requestId)));
      return json({ data }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/loyalty/ledger",
    module: "loyalty",
    operation: "loyalty.ledger.post",
    permission: "loyalty.adjust",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const entry = await service.postLedger(context, {
        membershipId: requiredId(body.membershipId, "membershipId", context.requestId),
        entryType: requiredEnum(body.entryType, "entryType", ["earn","adjustment","expire","reverse"], context.requestId),
        pointsDelta: requiredInteger(body.pointsDelta, "pointsDelta", context.requestId),
        ...(body.referenceType !== undefined ? { referenceType: requiredString(body.referenceType, "referenceType", context.requestId) } : {}),
        ...(body.referenceId !== undefined ? { referenceId: requiredString(body.referenceId, "referenceId", context.requestId) } : {}),
        idempotencyKey: requiredString(body.idempotencyKey, "idempotencyKey", context.requestId),
        ...(body.provenance !== undefined ? { provenance: requiredObject(body.provenance, "provenance", context.requestId) } : {}),
      });
      return json({ data: entry }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/loyalty/rewards",
    module: "loyalty",
    operation: "loyalty.reward.create",
    permission: "loyalty.reward.manage",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const reward = await service.createReward(context, {
        programId: requiredId(body.programId, "programId", context.requestId),
        name: requiredString(body.name, "name", context.requestId),
        pointsCost: requiredPositiveInteger(body.pointsCost, "pointsCost", context.requestId),
        rewardReference: requiredString(body.rewardReference, "rewardReference", context.requestId),
      });
      return json({ data: reward }, 201, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/loyalty/programs/:programId/rewards",
    module: "loyalty",
    operation: "loyalty.reward.read",
    permission: "loyalty.reward.read",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      const data = await service.listRewards(context, brandId<EntityId>(requiredParam(params.programId, context.requestId)));
      return json({ data }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/loyalty/rewards/:rewardId/redeem",
    module: "loyalty",
    operation: "loyalty.reward.redeem",
    permission: "loyalty.reward.redeem",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const redemption = await service.redeemReward(context, {
        rewardId: brandId<EntityId>(requiredParam(params.rewardId, context.requestId)),
        membershipId: requiredId(body.membershipId, "membershipId", context.requestId),
        benefitReference: requiredString(body.benefitReference, "benefitReference", context.requestId),
        idempotencyKey: requiredString(body.idempotencyKey, "idempotencyKey", context.requestId),
      });
      return json({ data: redemption }, 201, context.requestId);
    },
  });
}

function createService(database: D1Database | undefined, authorization: AuthorizationRegistry | undefined, requestId: EntityId): LoyaltyService {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  if (!authorization) throw new AppError({ code: "INTERNAL_ERROR", message: "Authorization registry is not configured.", requestId });
  return new LoyaltyService({
    repository: new LoyaltyRepository(database),
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
function requiredInteger(value: unknown, field: string, requestId: EntityId): number {
  if (!Number.isSafeInteger(value)) throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be an integer.", requestId });
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
