import {
  PrivacyRepository,
  PrivacyService,
  type PrivacyRequestStatus,
  type PrivacyRequestType,
  type PrivacySubjectType,
} from "@qooqnos/privacy";
import { AuthorizationRepository } from "@qooqnos/database";
import { createAuthorizationService, type AuthorizationRegistry } from "@qooqnos/runtime";
import { AppError, brandId, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerPrivacyRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "POST",
    path: "/api/v1/privacy/consents",
    module: "privacy",
    operation: "privacy.consent.manage",
    permission: "privacy.consent.manage",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const consent = await service.grantConsent(context, {
        subjectType: requiredSubjectType(body.subjectType, context.requestId),
        subjectId: requiredId(body.subjectId, "subjectId", context.requestId),
        purpose: requiredString(body.purpose, "purpose", context.requestId),
        consentVersion: requiredString(body.consentVersion, "consentVersion", context.requestId),
        source: requiredString(body.source, "source", context.requestId),
        ...(body.evidenceReference !== undefined ? { evidenceReference: requiredString(body.evidenceReference, "evidenceReference", context.requestId) } : {}),
        ...(body.grantedAt !== undefined ? { grantedAt: requiredString(body.grantedAt, "grantedAt", context.requestId) } : {}),
        ...(body.expiresAt !== undefined ? { expiresAt: requiredString(body.expiresAt, "expiresAt", context.requestId) } : {}),
      });
      return json({ data: consent }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/privacy/consents/:consentId/revoke",
    module: "privacy",
    operation: "privacy.consent.manage",
    permission: "privacy.consent.manage",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      const consent = await service.revokeConsent(
        context,
        brandId<"EntityId">(requiredParam(params.consentId, context.requestId)),
      );
      return json({ data: consent }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/privacy/requests",
    module: "privacy",
    operation: "privacy.request.manage",
    permission: "privacy.request.manage",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const requestRecord = await service.createRequest(context, {
        subjectType: requiredSubjectType(body.subjectType, context.requestId),
        subjectId: requiredId(body.subjectId, "subjectId", context.requestId),
        requestType: requiredRequestType(body.requestType, context.requestId),
        requestedBy: requiredString(body.requestedBy, "requestedBy", context.requestId),
        ...(body.dueAt !== undefined ? { dueAt: requiredString(body.dueAt, "dueAt", context.requestId) } : {}),
      });
      return json({ data: requestRecord }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/privacy/requests/:requestId/status",
    module: "privacy",
    operation: "privacy.request.manage",
    permission: "privacy.request.manage",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const status = requiredRequestStatus(body.status, context.requestId);
      const requestRecord = await service.transitionRequest(
        context,
        brandId<"EntityId">(requiredParam(params.requestId, context.requestId)),
        status,
        {
          ...(body.resultReference !== undefined ? { resultReference: requiredString(body.resultReference, "resultReference", context.requestId) } : {}),
          ...(body.rejectionReason !== undefined ? { rejectionReason: requiredString(body.rejectionReason, "rejectionReason", context.requestId) } : {}),
        },
      );
      return json({ data: requestRecord }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/privacy/requests/:requestId/processing",
    module: "privacy",
    operation: "privacy.request.manage",
    permission: "privacy.request.manage",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      await service.recordProcessing(context, {
        requestId: brandId<"EntityId">(requiredParam(params.requestId, context.requestId)),
        moduleId: requiredString(body.moduleId, "moduleId", context.requestId),
        action: requiredString(body.action, "action", context.requestId),
        ...(body.resourceReference !== undefined ? { resourceReference: requiredString(body.resourceReference, "resourceReference", context.requestId) } : {}),
        status: requiredProcessingStatus(body.status, context.requestId),
        ...(body.errorReference !== undefined ? { errorReference: requiredString(body.errorReference, "errorReference", context.requestId) } : {}),
        ...(body.processedAt !== undefined ? { processedAt: requiredString(body.processedAt, "processedAt", context.requestId) } : {}),
      });
      return json({ data: { recorded: true } }, 201, context.requestId);
    },
  });
}

function createService(
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
  requestId: EntityId,
): PrivacyService {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  if (!authorization) throw new AppError({ code: "INTERNAL_ERROR", message: "Authorization registry is not configured.", requestId });
  return new PrivacyService({
    repository: new PrivacyRepository(database),
    authorization: createAuthorizationService(new AuthorizationRepository(database), authorization),
    id: () => brandId<"EntityId">(crypto.randomUUID()),
    now: () => new Date().toISOString(),
  });
}

async function bodyObject(request: Request, requestId: EntityId): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Request body must be valid JSON.", requestId });
  }
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

function requiredParam(value: string | undefined, requestId: EntityId): string {
  if (!value) throw new AppError({ code: "NOT_FOUND", message: "Route parameter is missing.", requestId });
  return value;
}

function requiredSubjectType(value: unknown, requestId: EntityId): PrivacySubjectType {
  const values: readonly PrivacySubjectType[] = ["customer", "user", "member", "actor"];
  if (typeof value === "string" && values.includes(value as PrivacySubjectType)) return value as PrivacySubjectType;
  throw new AppError({ code: "VALIDATION_ERROR", message: "subjectType is invalid.", requestId });
}

function requiredRequestType(value: unknown, requestId: EntityId): PrivacyRequestType {
  const values: readonly PrivacyRequestType[] = ["access", "export", "delete", "restrict", "correct"];
  if (typeof value === "string" && values.includes(value as PrivacyRequestType)) return value as PrivacyRequestType;
  throw new AppError({ code: "VALIDATION_ERROR", message: "requestType is invalid.", requestId });
}

function requiredRequestStatus(value: unknown, requestId: EntityId): PrivacyRequestStatus {
  const values: readonly PrivacyRequestStatus[] = ["requested", "validating", "approved", "processing", "completed", "rejected", "cancelled"];
  if (typeof value === "string" && values.includes(value as PrivacyRequestStatus)) return value as PrivacyRequestStatus;
  throw new AppError({ code: "VALIDATION_ERROR", message: "status is invalid.", requestId });
}

function requiredProcessingStatus(
  value: unknown,
  requestId: EntityId,
): "queued" | "processing" | "completed" | "failed" | "skipped" {
  const values = ["queued", "processing", "completed", "failed", "skipped"] as const;
  if (typeof value === "string" && values.includes(value as typeof values[number])) return value as typeof values[number];
  throw new AppError({ code: "VALIDATION_ERROR", message: "status is invalid.", requestId });
}
