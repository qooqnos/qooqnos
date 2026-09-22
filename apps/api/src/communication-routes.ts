import { CommunicationRepository, CommunicationService, type CommunicationChannel, type CommunicationMessageStatus } from "@qooqnos/communication";
import { AuthorizationRepository } from "@qooqnos/database";
import { createAuthorizationService, type AuthorizationRegistry } from "@qooqnos/runtime";
import { AppError, brandId, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerCommunicationRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "POST",
    path: "/api/v1/communications/conversations",
    module: "communication",
    operation: "communication.conversation.manage",
    permission: "communication.conversation.manage",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const conversation = await service.createConversation(context, {
        ...(body.customerId !== undefined ? { customerId: requiredId(body.customerId, "customerId", context.requestId) } : {}),
      });
      return json({ data: conversation }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/communications/messages",
    module: "communication",
    operation: "communication.message.send",
    permission: "communication.message.send",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const message = await service.sendMessage(context, {
        conversationId: requiredId(body.conversationId, "conversationId", context.requestId),
        content: requiredString(body.content, "content", context.requestId),
        classification: requiredString(body.classification, "classification", context.requestId),
      });
      return json({ data: message }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/communications/notifications",
    module: "communication",
    operation: "communication.notification.send",
    permission: "communication.notification.send",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const idempotencyKey = requiredIdempotencyKey(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const notification = await service.sendNotification(context, {
        recipientReference: requiredString(body.recipientReference, "recipientReference", context.requestId),
        intent: requiredString(body.intent, "intent", context.requestId),
        channel: requiredChannel(body.channel, context.requestId),
        ...(body.templateReference !== undefined ? { templateReference: requiredString(body.templateReference, "templateReference", context.requestId) } : {}),
        ...(body.templateVersion !== undefined ? { templateVersion: requiredString(body.templateVersion, "templateVersion", context.requestId) } : {}),
        ...(body.locale !== undefined ? { locale: requiredString(body.locale, "locale", context.requestId) } : {}),
        ...(body.variables !== undefined ? { variables: requiredObject(body.variables, "variables", context.requestId) } : {}),
        ...(body.priority !== undefined ? { priority: requiredPriority(body.priority, context.requestId) } : {}),
        idempotencyKey,
        ...(body.scheduledAt !== undefined ? { scheduledAt: requiredString(body.scheduledAt, "scheduledAt", context.requestId) } : {}),
        ...(body.expiresAt !== undefined ? { expiresAt: requiredString(body.expiresAt, "expiresAt", context.requestId) } : {}),
      });
      return json({ data: notification }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/communications/notifications/:notificationId/status",
    module: "communication",
    operation: "communication.delivery.manage",
    permission: "communication.delivery.manage",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const status = requiredMessageStatus(body.status, context.requestId);
      const notification = await service.updateDeliveryStatus(
        context,
        brandId<"EntityId">(requiredParam(params.notificationId, context.requestId)),
        status,
      );
      return json({ data: notification }, 200, context.requestId);
    },
  });
}

function createService(
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
  requestId: EntityId,
): CommunicationService {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  if (!authorization) throw new AppError({ code: "INTERNAL_ERROR", message: "Authorization registry is not configured.", requestId });
  return new CommunicationService({
    repository: new CommunicationRepository(database),
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
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " is required.", requestId });
  }
  return value.trim();
}

function requiredId(value: unknown, field: string, requestId: EntityId): EntityId {
  return brandId<"EntityId">(requiredString(value, field, requestId));
}

function requiredParam(value: string | undefined, requestId: EntityId): string {
  if (!value) throw new AppError({ code: "NOT_FOUND", message: "Route parameter is missing.", requestId });
  return value;
}

function requiredObject(value: unknown, field: string, requestId: EntityId): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be an object.", requestId });
  }
  return value as Readonly<Record<string, unknown>>;
}

function requiredChannel(value: unknown, requestId: EntityId): CommunicationChannel {
  if (value === "in_app" || value === "whatsapp" || value === "sms" || value === "email") return value;
  throw new AppError({ code: "VALIDATION_ERROR", message: "channel is invalid.", requestId });
}

function requiredPriority(value: unknown, requestId: EntityId): "low" | "normal" | "high" | "urgent" {
  if (value === "low" || value === "normal" || value === "high" || value === "urgent") return value;
  throw new AppError({ code: "VALIDATION_ERROR", message: "priority is invalid.", requestId });
}

function requiredMessageStatus(value: unknown, requestId: EntityId): CommunicationMessageStatus {
  const statuses: readonly CommunicationMessageStatus[] = [
    "created","policy_checked","queued","provider_accepted","sent","delivered","read",
    "failed","rejected","expired","cancelled","suppressed",
  ];
  if (typeof value === "string" && statuses.includes(value as CommunicationMessageStatus)) return value as CommunicationMessageStatus;
  throw new AppError({ code: "VALIDATION_ERROR", message: "status is invalid.", requestId });
}

function requiredIdempotencyKey(request: Request, requestId: EntityId): string {
  const value = request.headers.get("idempotency-key")?.trim();
  if (!value) throw new AppError({ code: "VALIDATION_ERROR", message: "Idempotency-Key header is required.", requestId });
  if (value.length > 200) throw new AppError({ code: "VALIDATION_ERROR", message: "Idempotency-Key header is too long.", requestId });
  return value;
}
