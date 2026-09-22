import { AutomationRepository, AutomationService } from "@qooqnos/automation";
import { AuthorizationRepository } from "@qooqnos/database";
import { createAuthorizationService, type AuthorizationRegistry } from "@qooqnos/runtime";
import { AppError, brandId, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerAutomationRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "POST",
    path: "/api/v1/automation/workflows",
    module: "automation",
    operation: "automation.workflow.manage",
    permission: "automation.workflow.manage",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const scope = requiredScope(body.scope, context.requestId);
      const workflow = await service.createWorkflow(context, {
        name: requiredString(body.name, "name", context.requestId),
        scope,
        ...(body.businessId !== undefined
          ? { businessId: requiredId(body.businessId, "businessId", context.requestId) }
          : {}),
      });
      return json({ data: workflow }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/automation/workflows/:workflowId/versions",
    module: "automation",
    operation: "automation.workflow.manage",
    permission: "automation.workflow.manage",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const definition = requiredObject(body.definition, "definition", context.requestId);
      const version = body.version;
      if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
        throw new AppError({ code: "VALIDATION_ERROR", message: "version must be a positive integer.", requestId: context.requestId });
      }
      const result = await service.createVersion(context, {
        workflowId: requiredParamId(params.workflowId, context.requestId),
        version,
        definition,
      });
      return json({ data: result }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/automation/workflows/:workflowId/versions/:versionId/activate",
    module: "automation",
    operation: "automation.workflow.activate",
    permission: "automation.workflow.manage",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      const workflow = await service.activateVersion(context, {
        workflowId: requiredParamId(params.workflowId, context.requestId),
        versionId: requiredParamId(params.versionId, context.requestId),
      });
      return json({ data: workflow }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/automation/workflows/:workflowId/pause",
    module: "automation",
    operation: "automation.workflow.pause",
    permission: "automation.workflow.manage",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      const workflow = await service.pauseWorkflow(context, requiredParamId(params.workflowId, context.requestId));
      return json({ data: workflow }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/automation/workflows/:workflowId/retire",
    module: "automation",
    operation: "automation.workflow.retire",
    permission: "automation.workflow.manage",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      const workflow = await service.retireWorkflow(context, requiredParamId(params.workflowId, context.requestId));
      return json({ data: workflow }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/automation/workflows/:workflowId/executions",
    module: "automation",
    operation: "automation.execution.run",
    permission: "automation.execution.run",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const execution = await service.startExecution(context, {
        workflowId: requiredParamId(params.workflowId, context.requestId),
        workflowVersionId: requiredId(body.workflowVersionId, "workflowVersionId", context.requestId),
        triggerId: requiredId(body.triggerId, "triggerId", context.requestId),
        correlationId: typeof body.correlationId === "string" && body.correlationId.trim()
          ? body.correlationId.trim()
          : context.correlationId,
        ...(body.inputReference !== undefined
          ? { inputReference: requiredString(body.inputReference, "inputReference", context.requestId) }
          : {}),
      });
      return json({ data: execution }, 201, context.requestId);
    },
  });
}

function createService(
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
  requestId: EntityId,
): AutomationService {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  if (!authorization) throw new AppError({ code: "INTERNAL_ERROR", message: "Authorization registry is not configured.", requestId });
  return new AutomationService({
    repository: new AutomationRepository(database),
    authorization: createAuthorizationService(new AuthorizationRepository(database), authorization),
    id: () => brandId<"EntityId">(crypto.randomUUID()),
    traceId: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
  });
}

async function bodyObject(request: Request, requestId: EntityId): Promise<Record<string, unknown>> {
  let value: unknown;
  try { value = await request.json(); }
  catch { throw new AppError({ code: "VALIDATION_ERROR", message: "Request body must be valid JSON.", requestId }); }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Request body must be an object.", requestId });
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, requestId: EntityId): string {
  if (typeof value !== "string" || !value.trim()) throw new AppError({ code: "VALIDATION_ERROR", message: field + " is required.", requestId });
  return value.trim();
}

function requiredId(value: unknown, field: string, requestId: EntityId): EntityId {
  return brandId<"EntityId">(requiredString(value, field, requestId));
}

function requiredParamId(value: string | undefined, requestId: EntityId): EntityId {
  if (!value) throw new AppError({ code: "NOT_FOUND", message: "Route parameter is missing.", requestId });
  return brandId<"EntityId">(value);
}

function requiredObject(value: unknown, field: string, requestId: EntityId): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be an object.", requestId });
  }
  return value as Readonly<Record<string, unknown>>;
}

function requiredScope(value: unknown, requestId: EntityId): "platform" | "organization" | "workspace" | "business" {
  const values = ["platform", "organization", "workspace", "business"] as const;
  if (typeof value === "string" && values.includes(value as (typeof values)[number])) return value as (typeof values)[number];
  throw new AppError({ code: "VALIDATION_ERROR", message: "scope is invalid.", requestId });
}
