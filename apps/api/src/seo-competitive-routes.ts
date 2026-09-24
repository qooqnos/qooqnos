import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import type { ApiEnv } from "./env";
import { json } from "./http";
import { runSeoCompetitiveIntelligence } from "./seo-competitive-worker";

export function registerSeoCompetitiveRoutes(router: ApiRouter, database: D1Database | undefined, env: ApiEnv): void {
  router.register({
    method: "POST",
    path: "/api/v1/seo/competitive/measure/:entityId",
    module: "seo",
    operation: "competitive.measure",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params, request }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      if (!env.SEO_COMPETITIVE_LOGIN || !env.SEO_COMPETITIVE_PASSWORD) {
        return json({ error: { code: "PROVIDER_UNCONFIGURED", message: "Competitive intelligence provider is not configured." } }, 503, context.requestId);
      }
      const search = new URL(request.url).searchParams;
      const limitValue = Number(search.get("limit") ?? "5");
      const depthValue = Number(search.get("depth") ?? env.SEO_COMPETITIVE_DEPTH ?? "20");
      const locationCodeValue = Number(env.SEO_COMPETITIVE_LOCATION_CODE ?? "");
      const result = await runSeoCompetitiveIntelligence(
        database,
        {
          login: env.SEO_COMPETITIVE_LOGIN,
          password: env.SEO_COMPETITIVE_PASSWORD,
          ...(env.SEO_COMPETITIVE_ENDPOINT ? { endpoint: env.SEO_COMPETITIVE_ENDPOINT } : {}),
          ...(Number.isFinite(locationCodeValue) ? { locationCode: locationCodeValue } : {}),
          ...(env.SEO_COMPETITIVE_LOCATION_NAME ? { locationName: env.SEO_COMPETITIVE_LOCATION_NAME } : {}),
          languageCode: search.get("language") || env.SEO_COMPETITIVE_LANGUAGE_CODE || "en",
          device: env.SEO_COMPETITIVE_DEVICE || "desktop",
          depth: Number.isFinite(depthValue) ? depthValue : 20,
          limit: Number.isFinite(limitValue) ? Math.min(Math.max(Math.trunc(limitValue), 1), 10) : 5,
          organizationId: context.tenantId,
          workspaceId: context.workspaceId ?? null,
          entityId: params.entityId,
          ...(search.get("query")?.trim() ? { queryText: search.get("query")!.trim() } : {}),
        },
        env.SEO_CANONICAL_BASE_URL ?? "https://qooqnos.com",
        new Date().toISOString(),
      );
      return json({ competitive: result }, result.failures ? 207 : 200, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/seo/competitive/:entityId",
    module: "seo",
    operation: "competitive.read",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      const { SeoCompetitiveRepository } = await import("@qooqnos/seo");
      const summary = await new SeoCompetitiveRepository(database).latestSummary(context, params.entityId);
      return json({ competitive: summary }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/competitive/competitors",
    module: "seo",
    operation: "competitive.competitor.register",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const domain = typeof body.domain === "string" ? body.domain.trim().toLowerCase().replace(/^www\./, "") : "";
      if (!domain || !/^[a-z0-9.-]+$/.test(domain) || domain.includes("..")) {
        return json({ error: { code: "INVALID_DOMAIN", message: "A valid competitor domain is required." } }, 400, context.requestId);
      }
      const competitorType = body.competitorType === "direct" || body.competitorType === "alternative" || body.competitorType === "publisher" || body.competitorType === "directory" ? body.competitorType : "direct";
      const { SeoCompetitiveRepository } = await import("@qooqnos/seo");
      const id = await new SeoCompetitiveRepository(database).upsertCompetitor(context, {
        domain,
        ...(typeof body.displayName === "string" && body.displayName.trim() ? { displayName: body.displayName.trim() } : {}),
        competitorType,
        now: new Date().toISOString(),
        provenance: { source: "control-plane-manual-registration" },
      });
      return json({ competitor: { id, domain, competitorType } }, 200, context.requestId);
    },
  });
}
