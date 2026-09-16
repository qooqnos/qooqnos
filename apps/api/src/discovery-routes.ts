import { DiscoveryRepository, DiscoveryService } from "@qooqnos/discovery";
import { AppError, type RequestId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerDiscoveryRoutes(router: ApiRouter, database: D1Database | undefined): void {
  router.register({
    method: "GET",
    path: "/api/v1/discovery/search",
    module: "discovery",
    operation: "discovery.search",
    handler: async ({ context, request }) => {
      if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId: context.requestId });
      if (!context.tenantId || !context.workspaceId) {
        throw new AppError({ code: "VALIDATION_ERROR", message: "Discovery search requires tenant and workspace context.", requestId: context.requestId });
      }

      const url = new URL(request.url);
      const query = url.searchParams.get("q")?.trim() || undefined;
      const limit = parseInteger(url.searchParams.get("limit"), "limit", context.requestId);
      const offset = parseInteger(url.searchParams.get("offset"), "offset", context.requestId);
      const service = new DiscoveryService({ repository: new DiscoveryRepository(database) });
      const data = await service.search({ context, ...(query ? { query } : {}), ...(limit !== undefined ? { limit } : {}), ...(offset !== undefined ? { offset } : {}) });

      return json({ data, pagination: { limit: limit ?? 20, offset: offset ?? 0, count: data.length } }, 200, context.requestId);
    },
  });
}

function parseInteger(value: string | null, name: string, requestId: RequestId): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  if (!/^\d+$/.test(value.trim())) throw new AppError({ code: "VALIDATION_ERROR", message: `${name} must be a non-negative integer.`, requestId });
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new AppError({ code: "VALIDATION_ERROR", message: `${name} is out of range.`, requestId });
  return parsed;
}
