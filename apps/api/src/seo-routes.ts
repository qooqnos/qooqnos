import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";
import { buildRobotsTxt, buildSitemapXml } from "@qooqnos/seo";

export function registerSeoRoutes(router: ApiRouter, database: D1Database | undefined): void {
  router.register({
    method: "GET",
    path: "/sitemap.xml",
    module: "seo",
    operation: "sitemap.read",
    handler: async ({ context }) => {
      if (!database) return new Response("Database is not configured.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
      const rows = await database.all<{ canonicalUrl: string }>(
        `SELECT canonical_url AS canonicalUrl
         FROM seo_entity_representations
         WHERE organization_id=? AND workspace_id IS ? AND indexability='index' AND publication_state='published' AND visibility='public'
         ORDER BY canonical_url ASC`,
        context.tenantId, context.workspaceId ?? null,
      );
      const xml = buildSitemapXml(rows.map((row) => row.canonicalUrl));
      return new Response(xml, { status: 200, headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } });
    },
  });

  router.register({
    method: "GET",
    path: "/robots.txt",
    module: "seo",
    operation: "robots.read",
    handler: ({ context }) => {
      const origin = context.tenantId ? "https://qooqnos.com" : "https://qooqnos.com";
      return new Response(buildRobotsTxt(`${origin}/sitemap.xml`), { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/seo/health",
    module: "seo",
    operation: "health.read",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      const result = await database.first<{ pending: number; failed: number }>(
        `SELECT
           SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed
         FROM seo_publication_jobs WHERE organization_id=? AND workspace_id IS ?`,
        context.tenantId, context.workspaceId ?? null,
      );
      return json({ status: "ok", publication: { pending: result?.pending ?? 0, failed: result?.failed ?? 0 } }, 200, context.requestId);
    },
  });
}
