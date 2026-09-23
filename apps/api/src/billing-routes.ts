import { BillingRepository, BillingService } from "@qooqnos/billing";
import type { AuthorizationRegistry } from "@qooqnos/runtime";
import { AppError, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerBillingRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  _authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "GET",
    path: "/api/v1/billing/plans",
    module: "billing",
    operation: "billing.plan.read",
    permission: "billing.plan.read",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      void request;
      const service = createService(database, context.requestId);
      const plans = await service.listPlans(context);
      return json({ data: plans }, 200, context.requestId);
    },
  });
}

function createService(
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
  requestId: EntityId,
): BillingService {
  if (!database) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Database is not configured.",
      requestId,
    });
  }
  if (!authorization) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Authorization registry is not configured.",
      requestId,
    });
  }
  return new BillingService({
    repository: new BillingRepository(database),
    id: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
  });
}
