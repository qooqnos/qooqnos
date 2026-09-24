import { TrustReviewRepository, TrustService } from "@qooqnos/trust";
import { AuthorizationRepository, VerificationRepository } from "@qooqnos/database";
import { createAuthorizationService, type AuthorizationRegistry } from "@qooqnos/runtime";
import { AppError, brandId, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerTrustRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "POST",
    path: "/api/v1/trust/verification-cases",
    module: "trust",
    operation: "trust.verification.manage",
    permission: "trust.verification.manage",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const record = await service.createVerificationCase(context, {
        ...(body.businessId !== undefined ? { businessId: requiredId(body.businessId, "businessId", context.requestId) } : {}),
        subjectType: requiredSubjectType(body.subjectType, context.requestId),
        subjectId: requiredId(body.subjectId, "subjectId", context.requestId),
        policyId: requiredString(body.policyId, "policyId", context.requestId),
        policyVersion: requiredString(body.policyVersion, "policyVersion", context.requestId),
        riskClass: requiredString(body.riskClass, "riskClass", context.requestId),
      });
      return json({ data: record }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/trust/verification-cases/:caseId/reviews",
    module: "trust",
    operation: "trust.verification.manage",
    permission: "trust.verification.manage",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const review = await service.assignVerificationReview(context, {
        caseId: brandId<"EntityId">(requiredParam(params.caseId, context.requestId)),
        reviewerId: requiredString(body.reviewerId, "reviewerId", context.requestId),
      });
      return json({ data: review }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/trust/verification-reviews/:reviewId/complete",
    module: "trust",
    operation: "trust.verification.review",
    permission: "trust.verification.review",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const review = await service.completeVerificationReview(
        context,
        brandId<"EntityId">(requiredParam(params.reviewId, context.requestId)),
        requiredString(body.outcome, "outcome", context.requestId),
        typeof body.escalationReason === "string" ? body.escalationReason : undefined,
      );
      return json({ data: review }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/trust/reviews",
    module: "trust",
    operation: "trust.review.create",
    permission: "trust.review.create",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const review = await service.createReview(context, {
        customerId: requiredId(body.customerId, "customerId", context.requestId),
        ratingValue: requiredRating(body.ratingValue, context.requestId),
        ...(body.content !== undefined ? { content: requiredString(body.content, "content", context.requestId) } : {}),
        ...(body.moderationState !== undefined ? { moderationState: requiredString(body.moderationState, "moderationState", context.requestId) } : {}),
        ...(body.businessId !== undefined ? { businessId: requiredId(body.businessId, "businessId", context.requestId) } : {}),
        ...(body.offeringId !== undefined ? { offeringId: requiredId(body.offeringId, "offeringId", context.requestId) } : {}),
        ...(body.productId !== undefined ? { productId: requiredId(body.productId, "productId", context.requestId) } : {}),
      });
      return json({ data: review }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/trust/reviews/:reviewId/report",
    module: "trust",
    operation: "trust.review.report",
    permission: "trust.review.report",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const report = await service.reportReview(context, {
        reviewId: brandId<"EntityId">(requiredParam(params.reviewId, context.requestId)),
        reporterReference: requiredString(body.reporterReference, "reporterReference", context.requestId),
        reasonCode: requiredString(body.reasonCode, "reasonCode", context.requestId),
        ...(body.details !== undefined ? { details: requiredString(body.details, "details", context.requestId) } : {}),
      });
      return json({ data: report }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/trust/reviews/:reviewId/response",
    module: "trust",
    operation: "trust.review.respond",
    permission: "trust.review.respond",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const response = await service.respondToReview(context, {
        reviewId: brandId<"EntityId">(requiredParam(params.reviewId, context.requestId)),
        businessId: requiredId(body.businessId, "businessId", context.requestId),
        actorReference: requiredString(body.actorReference, "actorReference", context.requestId),
        content: requiredString(body.content, "content", context.requestId),
        policyVersion: requiredString(body.policyVersion, "policyVersion", context.requestId),
      });
      return json({ data: response }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/trust/reviews/:reviewId/moderation-cases",
    module: "trust",
    operation: "trust.review.moderate",
    permission: "trust.review.moderate",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const moderationCase = await service.openModerationCase(context, {
        reviewId: brandId<"EntityId">(requiredParam(params.reviewId, context.requestId)),
        ...(body.reasonCode !== undefined ? { reasonCode: requiredString(body.reasonCode, "reasonCode", context.requestId) } : {}),
        policyVersion: requiredString(body.policyVersion, "policyVersion", context.requestId),
        ...(body.assignedTo !== undefined ? { assignedTo: requiredString(body.assignedTo, "assignedTo", context.requestId) } : {}),
      });
      return json({ data: moderationCase }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/trust/moderation-cases/:caseId/decisions",
    module: "trust",
    operation: "trust.review.moderate",
    permission: "trust.review.moderate",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const decisions = ["approve", "reject", "remove", "restrict", "restore"] as const;
      if (typeof body.decision !== "string" || !decisions.includes(body.decision as typeof decisions[number])) {
        throw new AppError({ code: "VALIDATION_ERROR", message: "decision is invalid.", requestId: context.requestId });
      }
      const review = await service.recordModerationDecision(context, {
        moderationCaseId: brandId<"EntityId">(requiredParam(params.caseId, context.requestId)),
        decision: body.decision as typeof decisions[number],
        actorReference: requiredString(body.actorReference, "actorReference", context.requestId),
        reasonCode: requiredString(body.reasonCode, "reasonCode", context.requestId),
        policyVersion: requiredString(body.policyVersion, "policyVersion", context.requestId),
      });
      return json({ data: review }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/trust/reviews/:reviewId/risk-signals",
    module: "trust",
    operation: "trust.review.moderate",
    permission: "trust.review.moderate",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      await service.recordRiskSignal(context, {
        reviewId: brandId<"EntityId">(requiredParam(params.reviewId, context.requestId)),
        signalType: requiredString(body.signalType, "signalType", context.requestId),
        ...(body.value !== undefined ? { value: body.value } : {}),
        ...(body.confidence !== undefined ? { confidence: requiredConfidence(body.confidence, context.requestId) } : {}),
        source: requiredString(body.source, "source", context.requestId),
        ...(body.modelVersion !== undefined ? { modelVersion: requiredString(body.modelVersion, "modelVersion", context.requestId) } : {}),
        ...(body.policyVersion !== undefined ? { policyVersion: requiredString(body.policyVersion, "policyVersion", context.requestId) } : {}),
      });
      return json({ data: { recorded: true } }, 201, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/trust/signals",
    module: "trust",
    operation: "trust.reputation.read",
    permission: "trust.reputation.read",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const url = new URL(request.url);
      const subjectType = url.searchParams.get("subjectType") ?? undefined;
      const subjectId = url.searchParams.get("subjectId");
      const status = url.searchParams.get("status");
      const limitValue = url.searchParams.get("limit");
      const allowedStatuses = ["active", "expired", "superseded", "dismissed"] as const;
      if (status && !allowedStatuses.includes(status as typeof allowedStatuses[number])) {
        throw new AppError({ code: "VALIDATION_ERROR", message: "status is invalid.", requestId: context.requestId });
      }
      const limit = limitValue === null ? undefined : Number(limitValue);
      if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1 || limit > 200)) {
        throw new AppError({ code: "VALIDATION_ERROR", message: "limit must be an integer between 1 and 200.", requestId: context.requestId });
      }
      const signals = await service.listTrustSignals(context, {
        ...(subjectType ? { subjectType } : {}),
        ...(subjectId ? { subjectId: brandId<"EntityId">(subjectId) } : {}),
        ...(status ? { status: status as typeof allowedStatuses[number] } : {}),
        ...(limit !== undefined ? { limit } : {}),
      });
      return json({ data: signals }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/trust/reputation/rebuild",
    module: "trust",
    operation: "trust.reputation.rebuild",
    permission: "trust.reputation.rebuild",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const targetType = requiredTargetType(body.targetType, context.requestId);
      const summary = await service.rebuildReputation(context, {
        targetType,
        targetId: requiredId(body.targetId, "targetId", context.requestId),
        policyVersion: requiredString(body.policyVersion, "policyVersion", context.requestId),
      });
      return json({ data: summary }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/trust/reviews/:reviewId/moderate",
    module: "trust",
    operation: "trust.review.moderate",
    permission: "trust.review.moderate",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const review = await service.moderateReview(
        context,
        brandId<"EntityId">(requiredParam(params.reviewId, context.requestId)),
        requiredString(body.moderationState, "moderationState", context.requestId),
      );
      return json({ data: review }, 200, context.requestId);
    },
  });
}

function createService(
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
  requestId: EntityId,
): TrustService {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  if (!authorization) throw new AppError({ code: "INTERNAL_ERROR", message: "Authorization registry is not configured.", requestId });
  return new TrustService({
    repository: new TrustReviewRepository(database),
    verification: new VerificationRepository(database),
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

function requiredRating(value: unknown, requestId: EntityId): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 5) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "ratingValue must be an integer between 1 and 5.", requestId });
  }
  return value as number;
}

function requiredSubjectType(
  value: unknown,
  requestId: EntityId,
): "business" | "user" | "professional_credential" | "location" | "ownership_claim" | "other" {
  const values = ["business", "user", "professional_credential", "location", "ownership_claim", "other"] as const;
  if (typeof value === "string" && values.includes(value as typeof values[number])) {
    return value as typeof values[number];
  }
  throw new AppError({ code: "VALIDATION_ERROR", message: "subjectType is invalid.", requestId });
}

function requiredConfidence(value: unknown, requestId: EntityId): number {
  if (typeof value !== "number" || value < 0 || value > 1 || !Number.isFinite(value)) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "confidence must be between 0 and 1.", requestId });
  }
  return value;
}

function requiredTargetType(value: unknown, requestId: EntityId): "business" | "offering" | "product" {
  if (value === "business" || value === "offering" || value === "product") return value;
  throw new AppError({ code: "VALIDATION_ERROR", message: "targetType is invalid.", requestId });
}
