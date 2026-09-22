import { MatchingRepository, MatchingService } from "@qooqnos/matching";
import { DiscoveryRepository } from "@qooqnos/discovery";
import { AppError, brandId, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import { createAuthorizationService, type AuthorizationRegistry } from "@qooqnos/runtime";
import { AuthorizationRepository } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerMatchingRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "POST",
    path: "/api/v1/demands",
    module: "matching",
    operation: "matching.demand.create",
    permission: "matching.demand.create",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      assertDependencies(database, authorization, context.requestId);
      const body = await parseBody(request, context.requestId);
      const sourceChannel = requiredString(body.sourceChannel, "sourceChannel", context.requestId);
      const customerId = optionalEntityId(body.customerId, "customerId", context.requestId);
      const service = createService(database, authorization);
      const record = await service.createDemand(context, {
        sourceChannel,
        ...(customerId ? { customerId } : {}),
        ...(typeof body.rawInputReference === "string" ? { rawInputReference: body.rawInputReference } : {}),
        ...(typeof body.locale === "string" ? { locale: body.locale } : {}),
      });
      return json({ data: record }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/match-requests",
    module: "matching",
    operation: "matching.request.create",
    permission: "matching.request.create",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      assertDependencies(database, authorization, context.requestId);
      const body = await parseBody(request, context.requestId);
      const demandRequestId = requiredEntityId(body.demandRequestId, "demandRequestId", context.requestId);
      const algorithmVersion = requiredString(body.algorithmVersion, "algorithmVersion", context.requestId);
      const policyVersion = requiredString(body.policyVersion, "policyVersion", context.requestId);
      const service = createService(database, authorization);
      const record = await service.createMatchRequest(context, {
        demandRequestId,
        algorithmVersion,
        policyVersion,
      });
      return json({ data: record }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/match-requests/:matchRequestId/retrieve",
    module: "matching",
    operation: "matching.request.execute",
    permission: "matching.request.execute",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      assertDependencies(database, authorization, context.requestId);
      const body = await parseBody(request, context.requestId);
      const query = requiredString(body.query, "query", context.requestId);
      const service = createService(database, authorization);
      const result = await service.retrieveAndRank(context, {
        matchRequestId: brandId<"EntityId">(requiredParam(params.matchRequestId, context.requestId)),
        query,
        ...(body.limit !== undefined ? { limit: requiredLimit(body.limit, context.requestId) } : {}),
      });
      return json({ data: result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/match-requests/:matchRequestId/decisions",
    module: "matching",
    operation: "matching.decision.manage",
    permission: "matching.decision.manage",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      assertDependencies(database, authorization, context.requestId);
      const body = await parseBody(request, context.requestId);
      const matchRequestId = brandId<"EntityId">(requiredParam(params.matchRequestId, context.requestId));
      const candidateId = requiredEntityId(body.candidateId, "candidateId", context.requestId);
      const decision = body.decision;
      if (decision !== "selected" && decision !== "rejected" && decision !== "deferred" && decision !== "excluded") {
        throw new AppError({ code: "VALIDATION_ERROR", message: "decision is invalid.", requestId: context.requestId });
      }
      const service = createService(database, authorization);
      await service.decide(context, {
        matchRequestId,
        candidateId,
        decision,
        ...(typeof body.reasonCode === "string" ? { reasonCode: body.reasonCode } : {}),
        decisionSource: typeof body.decisionSource === "string" ? body.decisionSource : "api",
        policyVersion: requiredString(body.policyVersion, "policyVersion", context.requestId),
      });
      return json({ data: { recorded: true } }, 201, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/match-requests/:matchRequestId/candidates",
    module: "matching",
    operation: "matching.candidate.read",
    permission: "matching.candidate.read",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, params }) => {
      assertDependencies(database, authorization, context.requestId);
      const matchRequestId = brandId<"EntityId">(requiredParam(params.matchRequestId, context.requestId));
      const rows = await new MatchingRepository(database).listCandidates(context, matchRequestId);
      return json({ data: rows }, 200, context.requestId);
    },
  });
}

function createService(database: D1Database, authorization: AuthorizationRegistry): MatchingService {
  return new MatchingService({
    repository: new MatchingRepository(database),
    discovery: new DiscoveryRepository(database),
    authorization: createAuthorizationService(new AuthorizationRepository(database), authorization),
    id: () => brandId<"EntityId">(crypto.randomUUID()),
    now: () => new Date().toISOString(),
  });
}

function assertDependencies(database: D1Database | undefined, authorization: AuthorizationRegistry | undefined, requestId: EntityId): asserts database is D1Database {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  if (!authorization) throw new AppError({ code: "INTERNAL_ERROR", message: "Authorization registry is not configured.", requestId });
}

async function parseBody(request: Request, requestId: EntityId): Promise<Record<string, unknown>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Request body must be valid JSON.", requestId });
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Request body must be an object.", requestId });
  }
  return raw as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, requestId: EntityId): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " is required.", requestId });
  }
  return value.trim();
}

function requiredEntityId(value: unknown, field: string, requestId: EntityId): EntityId {
  return brandId<"EntityId">(requiredString(value, field, requestId));
}

function optionalEntityId(value: unknown, field: string, requestId: EntityId): EntityId | undefined {
  return value === undefined ? undefined : requiredEntityId(value, field, requestId);
}

function requiredParam(value: string | undefined, requestId: EntityId): string {
  if (!value) throw new AppError({ code: "NOT_FOUND", message: "Route parameter is missing.", requestId });
  return value;
}

function requiredLimit(value: unknown, requestId: EntityId): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "limit must be a positive integer.", requestId });
  }
  return Math.min(value, 50);
}
