import { IntegrationRepository, IntegrationService } from "@qooqnos/integration";
import { AuthorizationRepository } from "@qooqnos/database";
import { createAuthorizationService, type AuthorizationRegistry } from "@qooqnos/runtime";
import { AppError, brandId, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerIntegrationRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "POST",
    path: "/api/v1/integrations/accounts",
    module: "integration",
    operation: "integration.account.manage",
    permission: "integration.account.manage",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const account = await service.connectAccount(context, {
        providerId: requiredId(body.providerId, "providerId", context.requestId),
        accountType: requiredString(body.accountType, "accountType", context.requestId),
        externalAccountReference: requiredString(body.externalAccountReference, "externalAccountReference", context.requestId),
        ...(body.credentialReference !== undefined
          ? { credentialReference: requiredString(body.credentialReference, "credentialReference", context.requestId) }
          : {}),
        ...(body.metadata !== undefined ? { metadata: requiredObject(body.metadata, "metadata", context.requestId) } : {}),
      });
      return json({ data: account }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/integrations/webhooks",
    module: "integration",
    operation: "integration.webhook.receive",
    permission: "integration.webhook.receive",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const webhook = await service.ingestWebhook(context, {
        integrationAccountId: requiredId(body.integrationAccountId, "integrationAccountId", context.requestId),
        externalEventId: requiredString(body.externalEventId, "externalEventId", context.requestId),
        eventType: requiredString(body.eventType, "eventType", context.requestId),
        signatureStatus: requiredSignatureStatus(body.signatureStatus, context.requestId),
        ...(body.payloadReference !== undefined
          ? { payloadReference: requiredString(body.payloadReference, "payloadReference", context.requestId) }
          : {}),
        correlationId: typeof body.correlationId === "string" && body.correlationId.trim()
          ? body.correlationId.trim()
          : context.correlationId,
      });
      return json({ data: webhook }, 201, context.requestId);
    },
  });
}

function createService(
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
  requestId: EntityId,
): IntegrationService {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  if (!authorization) throw new AppError({ code: "INTERNAL_ERROR", message: "Authorization registry is not configured.", requestId });
  return new IntegrationService({
    repository: new IntegrationRepository(database),
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

function requiredId(value: unknown, field: string, requestId: EntityId): EntityId {
  return brandId<"EntityId">(requiredString(value, field, requestId));
}

function requiredObject(value: unknown, field: string, requestId: EntityId): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be an object.", requestId });
  }
  return value as Readonly<Record<string, unknown>>;
}

function requiredSignatureStatus(value: unknown, requestId: EntityId): "verified" | "invalid" | "missing" | "not_required" {
  const values = ["verified", "invalid", "missing", "not_required"] as const;
  if (typeof value === "string" && values.includes(value as (typeof values)[number])) return value as (typeof values)[number];
  throw new AppError({ code: "VALIDATION_ERROR", message: "signatureStatus is invalid.", requestId });
}
