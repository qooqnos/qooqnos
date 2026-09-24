import { ApprovalRepository } from "@qooqnos/database";
import { ApprovalService } from "@qooqnos/runtime";
import { AuthorizationRepository } from "@qooqnos/database";
import { createAuthorizationService, type AuthorizationRegistry } from "@qooqnos/runtime";
import { AppError, brandId, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerAuthorizationGovernanceRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "POST",
    path: "/api/v1/authorization/approval-requests",
    module: "authorization",
    operation: "authorization.approval.create",
    permission: "authorization.approval.create",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const record = await service.create(context, {
        requestedBy: context.actorId ?? brandId<EntityId>("system"),
        action: requiredString(body.action, "action", context.requestId),
        resourceType: requiredString(body.resourceType, "resourceType", context.requestId),
        resourceId: requiredId(body.resourceId, "resourceId", context.requestId),
        reason: requiredString(body.reason, "reason", context.requestId),
        ...(body.requiredApproverRole !== undefined ? { requiredApproverRole: requiredString(body.requiredApproverRole, "requiredApproverRole", context.requestId) } : {}),
        idempotencyKey: requiredString(body.idempotencyKey, "idempotencyKey", context.requestId),
        ...(body.expiresAt !== undefined ? { expiresAt: requiredString(body.expiresAt, "expiresAt", context.requestId) } : {}),
      });
      return json({ data: record }, 201, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/authorization/approval-requests/:approvalId",
    module: "authorization",
    operation: "authorization.approval.read",
    permission: "authorization.approval.read",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      const record = await service.get(context, brandId<EntityId>(requiredParam(params.approvalId, context.requestId)));
      return json({ data: record }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/authorization/approval-requests/:approvalId/approve",
    module: "authorization",
    operation: "authorization.approval.approve",
    permission: "authorization.approval.approve",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      if (!context.actorId) throw new AppError({ code: "UNAUTHORIZED", message: "Authenticated actor is required.", requestId: context.requestId });
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const record = await service.approve(
        context,
        brandId<EntityId>(requiredParam(params.approvalId, context.requestId)),
        context.actorId,
        requiredString(body.reason, "reason", context.requestId),
      );
      return json({ data: record }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/authorization/approval-requests/:approvalId/reject",
    module: "authorization",
    operation: "authorization.approval.reject",
    permission: "authorization.approval.reject",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      if (!context.actorId) throw new AppError({ code: "UNAUTHORIZED", message: "Authenticated actor is required.", requestId: context.requestId });
      const body = await bodyObject(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const record = await service.reject(
        context,
        brandId<EntityId>(requiredParam(params.approvalId, context.requestId)),
        context.actorId,
        requiredString(body.reason, "reason", context.requestId),
      );
      return json({ data: record }, 200, context.requestId);
    },
  });
}

function createService(database: D1Database | undefined, authorization: AuthorizationRegistry | undefined, requestId: EntityId): ApprovalService {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  if (!authorization) throw new AppError({ code: "INTERNAL_ERROR", message: "Authorization registry is not configured.", requestId });
  return new ApprovalService({
    repository: new ApprovalRepository(database),
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
function requiredId(value: unknown, field: string, requestId: EntityId): EntityId {
  return brandId<EntityId>(requiredString(value, field, requestId));
}
function requiredParam(value: string | undefined, requestId: EntityId): string {
  if (!value) throw new AppError({ code: "NOT_FOUND", message: "Route parameter is missing.", requestId });
  return value;
}
