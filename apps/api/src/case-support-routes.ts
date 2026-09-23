import { CaseSupportRepository, CaseSupportService } from "@qooqnos/case-support";
import { AuthorizationRepository, type D1Database } from "@qooqnos/database";
import { createAuthorizationService, type AuthorizationRegistry } from "@qooqnos/runtime";
import { AppError, brandId, type EntityId } from "@qooqnos/core";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerCaseSupportRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "POST",
    path: "/api/v1/cases",
    module: "case-support",
    operation: "case.create",
    permission: "case.create",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const result = await service.create(context, {
        caseTypeId: requiredId(body.caseTypeId, "caseTypeId", context.requestId),
        priority: requiredEnum(body.priority, "priority", ["low","normal","high","urgent"], context.requestId),
        severity: requiredString(body.severity, "severity", context.requestId),
        subjectType: requiredString(body.subjectType, "subjectType", context.requestId),
        subjectId: requiredId(body.subjectId, "subjectId", context.requestId),
        requesterType: requiredString(body.requesterType, "requesterType", context.requestId),
        requesterId: requiredId(body.requesterId, "requesterId", context.requestId),
        sourceType: requiredString(body.sourceType, "sourceType", context.requestId),
        ...(body.sourceReference !== undefined ? { sourceReference: requiredString(body.sourceReference, "sourceReference", context.requestId) } : {}),
        ...(body.queueId !== undefined ? { queueId: requiredId(body.queueId, "queueId", context.requestId) } : {}),
        ...(body.slaId !== undefined ? { slaId: requiredId(body.slaId, "slaId", context.requestId) } : {}),
      });
      return json({ data: result }, 201, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/cases",
    module: "case-support",
    operation: "case.list",
    permission: "case.list",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const limit = new URL(request.url).searchParams.get("limit");
      const result = await service.list(context, limit ? Number(limit) : 100);
      return json({ data: result }, 200, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/cases/:caseId",
    module: "case-support",
    operation: "case.get",
    permission: "case.get",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      const result = await service.get(context, brandId<"EntityId">(requiredParam(params.caseId, context.requestId)));
      if (!result) throw new AppError({ code: "NOT_FOUND", message: "Case not found.", requestId: context.requestId });
      return json({ data: result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/cases/:caseId/first-response",
    module: "case-support",
    operation: "case.update",
    permission: "case.update",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      await service.recordFirstResponse(
        context,
        brandId<"EntityId">(requiredParam(params.caseId, context.requestId)),
      );
      return json({ recorded: true }, 202, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/cases/:caseId/status",
    module: "case-support",
    operation: "case.update",
    permission: "case.update",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const result = await service.transition(context, {
        id: brandId<"EntityId">(requiredParam(params.caseId, context.requestId)),
        status: requiredEnum(body.status, "status", ["open","triaged","assigned","in_progress","waiting","escalated","resolved","closed","reopened"], context.requestId),
        expectedVersion: requiredPositiveInteger(body.expectedVersion, "expectedVersion", context.requestId),
        ...(body.reason !== undefined ? { reason: requiredString(body.reason, "reason", context.requestId) } : {}),
      });
      return json({ data: result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/cases/:caseId/assign",
    module: "case-support",
    operation: "case.assign",
    permission: "case.assign",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const result = await service.assign(context, {
        id: brandId<"EntityId">(requiredParam(params.caseId, context.requestId)),
        ...(body.queueId !== undefined ? { queueId: requiredId(body.queueId, "queueId", context.requestId) } : {}),
        assigneeType: requiredString(body.assigneeType, "assigneeType", context.requestId),
        assigneeId: requiredString(body.assigneeId, "assigneeId", context.requestId),
        assignedBy: requiredString(body.assignedBy, "assignedBy", context.requestId),
        ...(body.reason !== undefined ? { reason: requiredString(body.reason, "reason", context.requestId) } : {}),
        expectedVersion: requiredPositiveInteger(body.expectedVersion, "expectedVersion", context.requestId),
      });
      return json({ data: result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/cases/:caseId/notes",
    module: "case-support",
    operation: "case.add_note",
    permission: "case.add_note",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      await service.addNote(context, {
        caseId: brandId<"EntityId">(requiredParam(params.caseId, context.requestId)),
        authorId: requiredString(body.authorId, "authorId", context.requestId),
        visibility: requiredString(body.visibility, "visibility", context.requestId),
        contentReference: requiredString(body.contentReference, "contentReference", context.requestId),
        classification: requiredString(body.classification, "classification", context.requestId),
      });
      return json({ accepted: true }, 202, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/cases/:caseId/evidence",
    module: "case-support",
    operation: "case.add_evidence_reference",
    permission: "case.add_evidence_reference",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      await service.addEvidence(context, {
        caseId: brandId<"EntityId">(requiredParam(params.caseId, context.requestId)),
        sourceModule: requiredString(body.sourceModule, "sourceModule", context.requestId),
        sourceType: requiredString(body.sourceType, "sourceType", context.requestId),
        sourceId: requiredString(body.sourceId, "sourceId", context.requestId),
        evidenceType: requiredString(body.evidenceType, "evidenceType", context.requestId),
        classification: requiredString(body.classification, "classification", context.requestId),
        ...(body.accessPolicyReference !== undefined ? { accessPolicyReference: requiredString(body.accessPolicyReference, "accessPolicyReference", context.requestId) } : {}),
      });
      return json({ accepted: true }, 202, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/cases/:caseId/escalate",
    module: "case-support",
    operation: "case.escalate",
    permission: "case.escalate",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const result = await service.escalate(context, {
        caseId: brandId<"EntityId">(requiredParam(params.caseId, context.requestId)),
        escalationType: requiredString(body.escalationType, "escalationType", context.requestId),
        reason: requiredString(body.reason, "reason", context.requestId),
        ...(body.targetQueueId !== undefined ? { targetQueueId: requiredId(body.targetQueueId, "targetQueueId", context.requestId) } : {}),
        ...(body.targetActorId !== undefined ? { targetActorId: requiredString(body.targetActorId, "targetActorId", context.requestId) } : {}),
        policyVersion: requiredString(body.policyVersion, "policyVersion", context.requestId),
        requestedBy: requiredString(body.requestedBy, "requestedBy", context.requestId),
        expectedVersion: requiredPositiveInteger(body.expectedVersion, "expectedVersion", context.requestId),
      });
      return json({ data: result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/cases/:caseId/actions/:actionId/approve",
    module: "case-support",
    operation: "case.update",
    permission: "case.update",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      await service.approveAction(context, {
        caseId: brandId<"EntityId">(requiredParam(params.caseId, context.requestId)),
        actionId: brandId<"EntityId">(requiredParam(params.actionId, context.requestId)),
        authorizationReference: requiredString(body.authorizationReference, "authorizationReference", context.requestId),
      });
      return json({ approved: true }, 202, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/cases/:caseId/actions/:actionId/cancel",
    module: "case-support",
    operation: "case.update",
    permission: "case.update",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      await service.cancelAction(context, {
        caseId: brandId<"EntityId">(requiredParam(params.caseId, context.requestId)),
        actionId: brandId<"EntityId">(requiredParam(params.actionId, context.requestId)),
      });
      return json({ cancelled: true }, 202, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/cases/:caseId/actions/:actionId/complete",
    module: "case-support",
    operation: "case.update",
    permission: "case.update",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const status = requiredEnum(body.status, "status", ["succeeded","failed"], context.requestId);
      await service.completeAction(context, {
        caseId: brandId<"EntityId">(requiredParam(params.caseId, context.requestId)),
        actionId: brandId<"EntityId">(requiredParam(params.actionId, context.requestId)),
        status,
        ...(body.resultReference !== undefined ? { resultReference: requiredString(body.resultReference, "resultReference", context.requestId) } : {}),
      });
      return json({ completed: true, status }, 202, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/cases/:caseId/resolve",
    module: "case-support",
    operation: "case.resolve",
    permission: "case.resolve",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const result = await service.resolve(context, {
        caseId: brandId<"EntityId">(requiredParam(params.caseId, context.requestId)),
        outcomeCode: requiredString(body.outcomeCode, "outcomeCode", context.requestId),
        summaryReference: requiredString(body.summaryReference, "summaryReference", context.requestId),
        resolverId: requiredString(body.resolverId, "resolverId", context.requestId),
        authoritativeReferences: requiredStringArray(body.authoritativeReferences, "authoritativeReferences", context.requestId),
        followUpRequired: body.followUpRequired === true,
        expectedVersion: requiredPositiveInteger(body.expectedVersion, "expectedVersion", context.requestId),
      });
      return json({ data: result }, 200, context.requestId);
    },
  });
}

function createService(database: D1Database | undefined, authorization: AuthorizationRegistry | undefined, requestId: EntityId): CaseSupportService {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  if (!authorization) throw new AppError({ code: "INTERNAL_ERROR", message: "Authorization registry is not configured.", requestId });
  return new CaseSupportService({
    repository: new CaseSupportRepository(database),
    authorization: createAuthorizationService(new AuthorizationRepository(database), authorization),
    id: () => brandId<"EntityId">(crypto.randomUUID()),
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
function requiredId(value: unknown, field: string, requestId: EntityId): EntityId { return brandId<"EntityId">(requiredString(value, field, requestId)); }
function requiredPositiveInteger(value: unknown, field: string, requestId: EntityId): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be a positive integer.", requestId });
  return value as number;
}
function requiredEnum<T extends string>(value: unknown, field: string, values: readonly T[], requestId: EntityId): T {
  const parsed = requiredString(value, field, requestId) as T;
  if (!values.includes(parsed)) throw new AppError({ code: "VALIDATION_ERROR", message: field + " is invalid.", requestId });
  return parsed;
}
function requiredStringArray(value: unknown, field: string, requestId: EntityId): readonly string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim())) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be a non-empty string array.", requestId });
  }
  return value.map((item) => String(item).trim());
}
function requiredParam(value: string | undefined, requestId: EntityId): string {
  if (!value) throw new AppError({ code: "NOT_FOUND", message: "Route parameter is missing.", requestId });
  return value;
}
