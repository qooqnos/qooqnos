import { BusinessService, BusinessRepository } from "@qooqnos/business";
import { CatalogService, CatalogRepository } from "@qooqnos/catalog";
import { SellerProductSessionService, createSellerProductSessionRepository } from "@qooqnos/ai";
import { AppError, brandId, type RequestId } from "@qooqnos/core";
import { AuthorizationRepository, CatalogCommandRepository, SessionRepository, sha256Hex } from "@qooqnos/database";
import type { D1Database } from "@qooqnos/database";
import { createAuthorizationService } from "@qooqnos/runtime";
import { createSellerProductService, processSellerProductAIRuntimeWork } from "./ai-composition";
import { validateSellerProductOutput, validateSellerProductSafety } from "./ai-validation";
import { BillingRepository, BillingService } from "@qooqnos/billing";
import { ApiRouter } from "./router";
import { createRequestContext } from "./context";
import { html, json } from "./http";
import type { ApiEnv } from "./env";
import { consumeOutbox, publishPendingOutbox, type QueueBatchLike, type ScheduledControllerLike } from "./outbox-worker";
import type { OutboxEventRecord } from "@qooqnos/database";
import { getDatabase } from "./database";
import { checkDatabase } from "./readiness";
import { processPendingTrustExpiries, processTrustAntiAbuseSignals } from "./trust-worker";
import { processCommunicationDispatch } from "./communication-worker";
import { processAutomationSchedules } from "./automation-worker";
import { processAutomationExecutions } from "./automation-execution-worker";
import { processCaseSla } from "./case-sla-worker";
import { processCaseActions } from "./case-action-worker";
import { processCaseDispatch } from "./case-dispatch-worker";
import { processPrivacyConsentExpiry, processApprovedPrivacyRequests, processPrivacyRetention } from "./privacy-worker";
import { processIntegration } from "./integration-worker";
import { processAnalyticsAggregates } from "./analytics-worker";
import { createApiAuthorizationRegistry, ensureRuntimeBoot } from "./runtime";
import { assertProductionInfrastructure, checkRuntimeInfrastructure } from "./infrastructure";
import {
  BingWebmasterActions,
  GoogleSearchConsoleActions,
  YandexWebmasterActions,
  processSeoPublicationJobs,
} from "@qooqnos/seo";
import { registerMediaRoutes } from "./media-routes";
import { registerPromotionRoutes } from "./promotion-routes";
import { registerLoyaltyRoutes } from "./loyalty-routes";
import { registerAdvertisingRoutes } from "./advertising-routes";
import { registerAuthorizationGovernanceRoutes } from "./authorization-governance-routes";
import { renderSeoAwareDocument } from "./seo-frontend";
import { runProductionSeoCrawler } from "./seo-production-crawler";
import { runSeoVisibilityMeasurements } from "./seo-visibility-worker";
import { runSeoCompetitiveIntelligence } from "./seo-competitive-worker";
import { registerSeoCompetitiveRoutes } from "./seo-competitive-routes";

const homePage = (version: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Qooqnos — Phoenix AI Marketplace" />
    <title>Qooqnos — Phoenix AI Marketplace</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: #080b12; color: #f5f7fb; }
      main { width: min(960px, calc(100% - 40px)); margin: 0 auto; padding: 96px 0; }
      .badge { display: inline-block; padding: 7px 12px; border: 1px solid #293246; border-radius: 999px; color: #aeb9ce; font-size: 13px; }
      h1 { max-width: 760px; margin: 24px 0 16px; font-size: clamp(44px, 8vw, 76px); line-height: .98; letter-spacing: -.04em; }
      p { max-width: 680px; color: #aeb9ce; font-size: 18px; line-height: 1.7; }
      .actions { display: flex; gap: 12px; margin-top: 32px; flex-wrap: wrap; }
      a { display: inline-block; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 650; }
      .primary { background: #f5f7fb; color: #080b12; }
      .secondary { border: 1px solid #293246; color: #f5f7fb; }
      footer { margin-top: 80px; color: #66738b; font-size: 13px; }
    </style>
  </head>
  <body>
    <main>
      <span class="badge">Phoenix AI Marketplace</span>
      <h1>Qooqnos is coming to life.</h1>
      <p>
        The Phoenix platform foundation is online. This deployment currently exposes
        the API boundary and its health/readiness services while the marketplace
        experience is being built.
      </p>
      <div class="actions">
        <a class="primary" href="/health">System health</a>
        <a class="secondary" href="/ready">Readiness</a>
      </div>
      <footer>Qooqnos · Phoenix · v${version}</footer>
    </main>
  </body>
</html>`;

function isApiFirstPublicPath(pathname: string): boolean {
  return pathname === "/health"
    || pathname === "/ready"
    || pathname === "/robots.txt"
    || pathname === "/sitemap.xml"
    || pathname === "/image-sitemap.xml"
    || /^\/sitemap-\d+\.xml$/.test(pathname)
    || pathname.startsWith("/api/");
}

function buildSeoVisibilityWorkerConfig(env: ApiEnv, limit: number) {
  return {
    limit,
    ...(env.SEO_GSC_SITE_URL && (env.SEO_GSC_ACCESS_TOKEN || (env.SEO_GSC_SERVICE_ACCOUNT_EMAIL && env.SEO_GSC_PRIVATE_KEY)) ? {
      google: {
        siteUrl: env.SEO_GSC_SITE_URL,
        ...(env.SEO_GSC_ACCESS_TOKEN ? { accessToken: env.SEO_GSC_ACCESS_TOKEN } : {}),
        ...(env.SEO_GSC_SERVICE_ACCOUNT_EMAIL ? { serviceAccountEmail: env.SEO_GSC_SERVICE_ACCOUNT_EMAIL } : {}),
        ...(env.SEO_GSC_PRIVATE_KEY ? { serviceAccountPrivateKey: env.SEO_GSC_PRIVATE_KEY } : {}),
        ...(env.SEO_GSC_LOOKBACK_DAYS ? { lookbackDays: Number(env.SEO_GSC_LOOKBACK_DAYS) } : {}),
        ...(env.SEO_GSC_END_LAG_DAYS ? { endLagDays: Number(env.SEO_GSC_END_LAG_DAYS) } : {}),
      },
    } : {}),
    ...(env.SEO_BING_SITE_URL && env.SEO_BING_API_KEY ? { bing: { siteUrl: env.SEO_BING_SITE_URL, apiKey: env.SEO_BING_API_KEY } } : {}),
    ...(env.SEO_AI_CITATION_ENDPOINT && env.SEO_AI_CITATION_API_KEY && env.SEO_AI_CITATION_MODEL
      ? { ai: { endpoint: env.SEO_AI_CITATION_ENDPOINT, apiKey: env.SEO_AI_CITATION_API_KEY, model: env.SEO_AI_CITATION_MODEL, ...(env.SEO_AI_CITATION_AUTH_MODE ? { authMode: env.SEO_AI_CITATION_AUTH_MODE } : {}) } }
      : {}),
  };
}

function buildGoogleSearchEngineActionsConfig(env: ApiEnv) {
  if (!env.SEO_GSC_SITE_URL || (!env.SEO_GSC_ACCESS_TOKEN && !(env.SEO_GSC_SERVICE_ACCOUNT_EMAIL && env.SEO_GSC_PRIVATE_KEY))) return undefined;
  return {
    siteUrl: env.SEO_GSC_SITE_URL,
    ...(env.SEO_GSC_ACCESS_TOKEN ? { accessToken: env.SEO_GSC_ACCESS_TOKEN } : {}),
    ...(env.SEO_GSC_SERVICE_ACCOUNT_EMAIL ? { serviceAccountEmail: env.SEO_GSC_SERVICE_ACCOUNT_EMAIL } : {}),
    ...(env.SEO_GSC_PRIVATE_KEY ? { serviceAccountPrivateKey: env.SEO_GSC_PRIVATE_KEY } : {}),
  };
}

function buildBingSearchEngineActionsConfig(env: ApiEnv) {
  if (!env.SEO_BING_SITE_URL || (!env.SEO_BING_API_KEY && !env.SEO_BING_ACCESS_TOKEN)) return undefined;
  return {
    siteUrl: env.SEO_BING_SITE_URL,
    apiKey: env.SEO_BING_API_KEY ?? "",
    ...(env.SEO_BING_ACCESS_TOKEN ? { accessToken: env.SEO_BING_ACCESS_TOKEN } : {}),
  };
}

function buildYandexSearchEngineActionsConfig(env: ApiEnv) {
  if (!env.SEO_YANDEX_USER_ID || !env.SEO_YANDEX_HOST_ID || !env.SEO_YANDEX_OAUTH_TOKEN) return undefined;
  return {
    userId: env.SEO_YANDEX_USER_ID,
    hostId: env.SEO_YANDEX_HOST_ID,
    oauthToken: env.SEO_YANDEX_OAUTH_TOKEN,
  };
}

function buildSeoIndexNowConfig(env: ApiEnv) {
  if (!env.SEO_INDEXNOW_KEY?.trim()) return undefined;
  const batchLimit = env.SEO_INDEXNOW_BATCH_LIMIT ? Number(env.SEO_INDEXNOW_BATCH_LIMIT) : undefined;
  return {
    key: env.SEO_INDEXNOW_KEY.trim(),
    ...(env.SEO_INDEXNOW_KEY_LOCATION ? { keyLocation: env.SEO_INDEXNOW_KEY_LOCATION.trim() } : {}),
    ...(env.SEO_INDEXNOW_ENDPOINT ? { endpoint: env.SEO_INDEXNOW_ENDPOINT.trim() } : {}),
    ...(batchLimit !== undefined && Number.isFinite(batchLimit) ? { batchLimit } : {}),
  };
}

function buildSeoCompetitiveWorkerConfig(env: ApiEnv, limit: number) {
  const locationCode = env.SEO_COMPETITIVE_LOCATION_CODE ? Number(env.SEO_COMPETITIVE_LOCATION_CODE) : undefined;
  const depth = env.SEO_COMPETITIVE_DEPTH ? Number(env.SEO_COMPETITIVE_DEPTH) : undefined;
  const pageSampleLimit = env.SEO_COMPETITIVE_PAGE_SAMPLE_LIMIT ? Number(env.SEO_COMPETITIVE_PAGE_SAMPLE_LIMIT) : undefined;
  const keywordGapCompetitorLimit = env.SEO_COMPETITIVE_KEYWORD_GAP_COMPETITOR_LIMIT ? Number(env.SEO_COMPETITIVE_KEYWORD_GAP_COMPETITOR_LIMIT) : undefined;
  const keywordGapLimit = env.SEO_COMPETITIVE_KEYWORD_GAP_LIMIT ? Number(env.SEO_COMPETITIVE_KEYWORD_GAP_LIMIT) : undefined;
  const linkGapCompetitorLimit = env.SEO_COMPETITIVE_LINK_GAP_COMPETITOR_LIMIT ? Number(env.SEO_COMPETITIVE_LINK_GAP_COMPETITOR_LIMIT) : undefined;
  const linkGapLimit = env.SEO_COMPETITIVE_LINK_GAP_LIMIT ? Number(env.SEO_COMPETITIVE_LINK_GAP_LIMIT) : undefined;
  return {
    login: env.SEO_COMPETITIVE_LOGIN ?? "",
    password: env.SEO_COMPETITIVE_PASSWORD ?? "",
    ...(env.SEO_COMPETITIVE_ENDPOINT ? { endpoint: env.SEO_COMPETITIVE_ENDPOINT } : {}),
    ...(locationCode !== undefined && Number.isFinite(locationCode) ? { locationCode } : {}),
    ...(env.SEO_COMPETITIVE_LOCATION_NAME ? { locationName: env.SEO_COMPETITIVE_LOCATION_NAME } : {}),
    languageCode: env.SEO_COMPETITIVE_LANGUAGE_CODE ?? "",
    device: env.SEO_COMPETITIVE_DEVICE ?? "desktop",
    ...(depth !== undefined && Number.isFinite(depth) ? { depth } : {}),
    ...(pageSampleLimit !== undefined && Number.isFinite(pageSampleLimit) ? { pageSampleLimit } : {}),
    ...(keywordGapCompetitorLimit !== undefined && Number.isFinite(keywordGapCompetitorLimit) ? { keywordGapCompetitorLimit } : {}),
    ...(keywordGapLimit !== undefined && Number.isFinite(keywordGapLimit) ? { keywordGapLimit } : {}),
    ...(linkGapCompetitorLimit !== undefined && Number.isFinite(linkGapCompetitorLimit) ? { linkGapCompetitorLimit } : {}),
    ...(linkGapLimit !== undefined && Number.isFinite(linkGapLimit) ? { linkGapLimit } : {}),
    limit,
  };
}

function createRouter(version: string, database: D1Database | undefined, env: ApiEnv): ApiRouter {
  const authorization = createApiAuthorizationRegistry();
  const router = new ApiRouter({ authorization, ...(database ? { database } : {}), seoCanonicalBaseUrl: env.SEO_CANONICAL_BASE_URL ?? "https://qooqnos.com", seoEnvironment: env });
  registerMediaRoutes(router, database, env, authorization);
  registerPromotionRoutes(router, database, authorization);
  registerLoyaltyRoutes(router, database, authorization);
  registerAdvertisingRoutes(router, database, authorization);
  registerSeoCompetitiveRoutes(router, database, env);
  registerAuthorizationGovernanceRoutes(router, database, authorization);

  router.register({
    method: "POST",
    path: "/api/v1/seo/visibility/measure/:entityId",
    module: "seo",
    operation: "visibility.measure",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params, request }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      const search = new URL(request.url).searchParams;
      const configuredLimit = Number(search.get("limit") ?? "10");
      const queryText = search.get("query")?.trim() || undefined;
      const locale = search.get("locale")?.trim() || undefined;
      const result = await runSeoVisibilityMeasurements(database, {
        ...buildSeoVisibilityWorkerConfig(env, Number.isFinite(configuredLimit) ? Math.min(Math.max(Math.trunc(configuredLimit), 1), 25) : 10),
        organizationId: context.tenantId,
        workspaceId: context.workspaceId ?? null,
        entityId: params.entityId,
        ...(queryText ? { queryText } : {}),
        ...(locale ? { locale } : {}),
      }, new Date().toISOString());
      const status = result.providerRuns === 0 ? 503 : result.failures > 0 ? 207 : 200;
      return json({ measurement: result }, status, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/seo/search-engines/google/inspect",
    module: "seo",
    operation: "search_engine.google.inspect",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const config = buildGoogleSearchEngineActionsConfig(env);
      if (!config) return json({ status: "unavailable", provider: "google-search-console" }, 503, context.requestId);
      const search = new URL(request.url).searchParams;
      const inspectionUrl = search.get("url")?.trim();
      if (!inspectionUrl) return json({ error: "url query parameter is required." }, 400, context.requestId);
      const result = await new GoogleSearchConsoleActions(config).inspectUrl(
        inspectionUrl,
        env.SEO_GSC_INSPECTION_LANGUAGE ?? "en-US",
      );
      return json({ provider: "google-search-console", inspection: result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/search-engines/google/sitemap",
    module: "seo",
    operation: "search_engine.google.submit_sitemap",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context }) => {
      const config = buildGoogleSearchEngineActionsConfig(env);
      const sitemapUrl = env.SEO_GSC_SITEMAP_URL?.trim();
      if (!config || !sitemapUrl) return json({ status: "unavailable", provider: "google-search-console" }, 503, context.requestId);
      await new GoogleSearchConsoleActions(config).submitSitemap(sitemapUrl);
      return json({ submitted: true, provider: "google-search-console", sitemapUrl }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/search-engines/bing/submit",
    module: "seo",
    operation: "search_engine.bing.submit_url",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const config = buildBingSearchEngineActionsConfig(env);
      if (!config) return json({ status: "unavailable", provider: "bing-webmaster" }, 503, context.requestId);
      const search = new URL(request.url).searchParams;
      const url = search.get("url")?.trim();
      if (!url) return json({ error: "url query parameter is required." }, 400, context.requestId);
      await new BingWebmasterActions(config).submitUrl(url);
      return json({ submitted: true, provider: "bing-webmaster", url }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/search-engines/yandex/recrawl",
    module: "seo",
    operation: "search_engine.yandex.recrawl",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const config = buildYandexSearchEngineActionsConfig(env);
      if (!config) return json({ status: "unavailable", provider: "yandex-webmaster" }, 503, context.requestId);
      const search = new URL(request.url).searchParams;
      const url = search.get("url")?.trim();
      if (!url) return json({ error: "url query parameter is required." }, 400, context.requestId);
      const result = await new YandexWebmasterActions(config).requestRecrawl(url);
      return json({ submitted: true, provider: "yandex-webmaster", url, ...result }, 202, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/health",
    module: "platform",
    operation: "health.read",
    handler: ({ context }) =>
      json({ status: "healthy", timestamp: new Date().toISOString(), version }, 200, context.requestId),
  });

  router.register({
    method: "GET",
    path: "/ready",
    module: "platform",
    operation: "readiness.read",
    handler: async ({ context }) => {
      try {
        await ensureRuntimeBoot(env);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Runtime boot failed.";
        return json({ status: "not_ready", checks: { runtime: "unavailable", reason: message }, timestamp: new Date().toISOString() }, 503, context.requestId);
      }
      const infrastructure = checkRuntimeInfrastructure(env);
      const result = await checkDatabase(database?.raw());
      const ready = infrastructure.ready && result.database === "ok" && result.migrationRegistry === "ok";
      return json({ status: ready ? "ready" : "not_ready", checks: { runtime: "ok", infrastructure, ...result }, timestamp: new Date().toISOString() }, ready ? 200 : 503, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/context",
    module: "platform",
    operation: "context.read",
    permission: "context:read",
    requireAuthentication: true,
    handler: ({ context, subject }) =>
      json({
        requestId: context.requestId,
        correlationId: context.correlationId,
        actorId: context.actorId,
        tenantId: context.tenantId,
        workspaceId: context.workspaceId,
        module: context.module,
        operation: context.operation,
        authenticated: context.authenticated,
        roles: subject.roles,
        permissions: subject.permissions,
      }, 200, context.requestId),
  });

  router.register({
    method: "GET",
    path: "/api/v1/session",
    module: "identity",
    operation: "session.read",
    requireAuthentication: true,
    handler: ({ context, authenticatedSessionId }) =>
      json({ session: { id: authenticatedSessionId, actorId: context.actorId, tenantId: context.tenantId, workspaceId: context.workspaceId, authenticated: context.authenticated } }, 200, context.requestId),
  });

  router.register({
    method: "POST",
    path: "/api/v1/session/revoke",
    module: "identity",
    operation: "session.revoke",
    requireAuthentication: true,
    handler: async ({ context, authenticatedSessionId }) => {
      if (!database || !authenticatedSessionId) return json({ revoked: false }, 400, context.requestId);
      const revoked = await new SessionRepository(database).revoke(authenticatedSessionId);
      return json({ revoked }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/businesses",
    module: "business",
    operation: "business.create",
    permission: "business.create",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId: context.requestId });
      const idempotencyKey = requiredIdempotencyKey(request, context.requestId);
      const command = await parseJsonCommand(request, isCreateBusinessCommand, "Business create payload is invalid.", context.requestId);
      const fingerprint = await sha256Hex(stableStringify(command));
      const now = new Date().toISOString();
      const service = new BusinessService({
        repository: new BusinessRepository(database),
        authorization: createAuthorizationService(new AuthorizationRepository(database), authorization),
        id: () => brandId<"EntityId">(crypto.randomUUID()),
        now: () => now,
      });
      const result = await service.createAtomic(context, command, {
        idempotencyKey,
        requestFingerprint: fingerprint,
        idempotencyExpiresAt: expiresAt(now),
        auditId: crypto.randomUUID(),
      });
      return json({ data: result.result, replayed: result.kind === "replayed" }, result.kind === "replayed" ? 200 : 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/catalog/products",
    module: "catalog",
    operation: "catalog.product.create",
    permission: "catalog.product.create",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId: context.requestId });
      const idempotencyKey = requiredIdempotencyKey(request, context.requestId);
      const command = await parseJsonCommand(request, isCreateProductCommand, "Product create payload is invalid.", context.requestId);
      const service = getCatalogService(database, authorization);
      const result = await service.createProduct(context, {
        businessId: brandId<"EntityId">(command.businessId),
        name: command.name,
        ...(command.description !== undefined ? { description: command.description } : {}),
        idempotencyKey,
        requestFingerprint: await sha256Hex(stableStringify(command)),
      });
      return json({ data: result }, 201, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/business-access",
    module: "business",
    operation: "business.access",
    permission: "business.create",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: ({ context }) =>
      json({ status: "authorized", tenantId: context.tenantId, workspaceId: context.workspaceId }, 200, context.requestId),
  });

  router.register({
    method: "POST",
    path: "/api/v1/ai/seller/product-creation-sessions",
    module: "ai",
    operation: "seller.product.create_session",
    permission: "ai.seller_product.create_session",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const businessCommand = await parseJsonCommand(request, isSellerProductSessionCommand, "Seller product creation session payload is invalid.", context.requestId);
      const idempotencyKey = requiredIdempotencyKey(request, context.requestId);
      const now = new Date().toISOString();
      const service = getSellerProductSessionService(database, context.requestId);
      const session = await service.createSession(context, {
        businessId: brandId<"EntityId">(businessCommand.businessId),
        idempotencyKey,
        expiresAt: expiresAt(now),
      });
      return json({ session }, session.idempotencyKey === idempotencyKey && session.createdAt === session.updatedAt ? 201 : 200, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/ai/seller/product-creation-sessions/:sessionId",
    module: "ai",
    operation: "seller.product.read_session",
    permission: "ai.seller_product.read_draft",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      const service = getSellerProductSessionService(database, context.requestId);
      const sessionId = brandId<"EntityId">(requiredRouteParam(params, "sessionId", context.requestId));
      const session = await service.getSession(context, sessionId);
      if (!session) throw new AppError({ code: "NOT_FOUND", message: "Seller product creation session not found.", requestId: context.requestId });
      const draft = await service.getDraft(context, sessionId);
      return json({ session, draft }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/ai/seller/product-creation-sessions/:sessionId/inputs",
    module: "ai",
    operation: "seller.product.add_input",
    permission: "ai.seller_product.add_input",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const command = await parseJsonCommand(request, isSellerProductInputCommand, "Seller product input payload is invalid.", context.requestId);
      const service = getSellerProductSessionService(database, context.requestId);
      await service.addInput(context, brandId<"EntityId">(requiredRouteParam(params, "sessionId", context.requestId)), {
        ...(command.mediaAssetId !== undefined ? { mediaAssetId: brandId<"EntityId">(command.mediaAssetId) } : {}),
        ...(command.rawText !== undefined ? { rawText: command.rawText } : {}),
      });
      return json({ accepted: true }, 202, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/ai/seller/product-creation-sessions/:sessionId/run",
    module: "ai",
    operation: "seller.product.run",
    permission: "ai.seller_product.generate_draft",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId: context.requestId });
      const sessionId = brandId<"EntityId">(requiredRouteParam(params, "sessionId", context.requestId));
      const sessionService = getSellerProductSessionService(database, context.requestId);
      const session = await sessionService.getSession(context, sessionId);
      if (!session) throw new AppError({ code: "NOT_FOUND", message: "Seller product creation session not found.", requestId: context.requestId });
      if (session.status === "cancelled" || session.catalogProductId) throw new AppError({ code: "CONFLICT", message: "Seller product creation session is no longer runnable.", requestId: context.requestId });

      const idempotencyKey = requiredIdempotencyKey(request, context.requestId);
      const command = await parseJsonCommand(request, isSellerProductRunCommand, "Seller product run payload is invalid.", context.requestId);
      const service = createSellerProductServiceForRequest(database, env, authorization, context.requestId);
      const operationId = `seller.product.extract:${sessionId}:${idempotencyKey}`;
      const result = await service.generateDraft(context, sessionId, {
        operationId,
        idempotencyKey,
        input: command.input,
        dataClassification: command.dataClassification ?? "internal",
        promptVersion: command.promptVersion ?? "seller-product-v1",
        outputSchemaVersion: command.outputSchemaVersion ?? "seller-product-draft-v1",
        policyVersion: command.policyVersion ?? "seller-product-policy-v1",
        ...(command.inputReference !== undefined ? { inputReference: command.inputReference } : {}),
        ...(command.inputHash !== undefined ? { inputHash: command.inputHash } : {}),
        ...(command.budgetUnits !== undefined ? { budgetUnits: command.budgetUnits } : {}),
      });
      const status = result.status === "succeeded" ? 200 : result.retryable ? 503 : 422;
      return json({ data: result }, status, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/ai/seller/product-creation-sessions/:sessionId/review",
    module: "ai",
    operation: "seller.product.review_draft",
    permission: "ai.seller_product.read_draft",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const command = await parseJsonCommand(request, isSellerProductVersionCommand, "Seller product review payload is invalid.", context.requestId);
      const service = getSellerProductSessionService(database, context.requestId);
      await service.reviewDraft(context, brandId<"EntityId">(requiredRouteParam(params, "sessionId", context.requestId)), command.version);
      return json({ reviewed: true, version: command.version }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/ai/seller/product-creation-sessions/:sessionId/confirm",
    module: "ai",
    operation: "seller.product.confirm_draft",
    permission: "ai.seller_product.confirm_draft",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params, request }) => {
      const command = await parseJsonCommand(request, isSellerProductVersionCommand, "Seller product confirmation payload is invalid.", context.requestId);
      const sessionId = brandId<"EntityId">(requiredRouteParam(params, "sessionId", context.requestId));
      const sessionService = getSellerProductSessionService(database, context.requestId);
      const session = await sessionService.getSession(context, sessionId);
      if (!session) throw new AppError({ code: "NOT_FOUND", message: "Seller product creation session not found.", requestId: context.requestId });
      if (session.currentDraftVersion !== command.version) throw new AppError({ code: "CONFLICT", message: "Seller product draft version is stale.", requestId: context.requestId });
      if (!session.businessId) throw new AppError({ code: "UNPROCESSABLE", message: "Seller product session has no owning business.", requestId: context.requestId });
      if (session.catalogProductId) {
        return json({ confirmed: true, catalogSaved: true, catalogProductId: session.catalogProductId, version: command.version }, 200, context.requestId);
      }

      if (session.status !== "confirmed") await sessionService.confirmDraft(context, sessionId, command.version);
      const draft = await sessionService.getDraft(context, sessionId);
      const name = sellerProductTextField(draft, "name");
      if (!name) throw new AppError({ code: "UNPROCESSABLE", message: "Confirmed seller product draft is missing a product name.", requestId: context.requestId });
      const description = sellerProductTextField(draft, "description");
      const catalogService = getCatalogService(database, authorization);
      const product = await catalogService.createProduct(context, {
        businessId: session.businessId,
        name,
        ...(description ? { description } : {}),
        idempotencyKey: `seller-ai:${session.id}:${command.version}`,
        requestFingerprint: await sha256Hex(stableStringify({ sessionId: session.id, version: command.version, businessId: session.businessId, name, description })),
      });
      const catalogSaved = await sessionService.markCatalogSaved(context, sessionId, command.version, product.id);
      if (!catalogSaved) throw new AppError({ code: "CONFLICT", message: "Seller product catalog linkage could not be committed.", requestId: context.requestId });
      return json({ confirmed: true, catalogSaved: true, catalogProductId: product.id, version: command.version }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/ai/seller/product-creation-sessions/:sessionId/cancel",
    module: "ai",
    operation: "seller.product.cancel_session",
    permission: "ai.seller_product.cancel_session",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      const service = getSellerProductSessionService(database, context.requestId);
      const cancelled = await service.cancelSession(context, brandId<"EntityId">(requiredRouteParam(params, "sessionId", context.requestId)));
      return json({ cancelled }, 200, context.requestId);
    },
  });

  return router;
}

function getSellerProductSessionService(database: D1Database | undefined, requestId: RequestId): SellerProductSessionService {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  return new SellerProductSessionService({
    repository: createSellerProductSessionRepository(database),
    id: () => brandId<"EntityId">(crypto.randomUUID()),
    now: () => new Date().toISOString(),
  });
}

function getCatalogService(database: D1Database | undefined, authorization: ReturnType<typeof createApiAuthorizationRegistry>): CatalogService {
  if (!database) throw new Error("Database is not configured.");
  return new CatalogService({
    repository: new CatalogRepository(database),
    commands: new CatalogCommandRepository(database),
    authorization: createAuthorizationService(new AuthorizationRepository(database), authorization),
    id: () => brandId<"EntityId">(crypto.randomUUID()),
    now: () => new Date().toISOString(),
  });
}

function requiredRouteParam(params: Readonly<Record<string, string>>, name: string, requestId: RequestId): string {
  const value = params[name];
  if (!value) throw new AppError({ code: "NOT_FOUND", message: `Route parameter '${name}' is missing.`, requestId });
  return value;
}

function requiredIdempotencyKey(request: Request, requestId: RequestId): string {
  const value = request.headers.get("idempotency-key")?.trim();
  if (!value) throw new AppError({ code: "VALIDATION_ERROR", message: "Idempotency-Key header is required.", requestId });
  if (value.length > 200) throw new AppError({ code: "VALIDATION_ERROR", message: "Idempotency-Key header is too long.", requestId });
  return value;
}

async function parseJsonCommand<T>(request: Request, guard: (value: unknown) => value is T, message: string, requestId: RequestId): Promise<T> {
  let command: unknown;
  try {
    command = await request.json();
  } catch {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Request body must be valid JSON.", requestId });
  }
  if (!guard(command)) throw new AppError({ code: "VALIDATION_ERROR", message, requestId });
  return command;
}

function expiresAt(now: string): string {
  return new Date(Date.parse(now) + 24 * 60 * 60 * 1000).toISOString();
}

function isCreateBusinessCommand(value: unknown): value is {
  name: string;
  displayName: string;
  businessType?: string;
  primaryCategoryId?: string;
  defaultLocale?: string;
  timezone?: string;
  defaultCurrency?: string;
} {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.name === "string" && typeof body.displayName === "string" && optionalStrings(body, ["businessType", "primaryCategoryId", "defaultLocale", "timezone", "defaultCurrency"]);
}

function isCreateProductCommand(value: unknown): value is {
  businessId: string;
  name: string;
  description?: string;
} {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.businessId === "string" && typeof body.name === "string" && optionalStrings(body, ["description"]);
}

function isSellerProductSessionCommand(value: unknown): value is { businessId: string } {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.businessId === "string" && body.businessId.trim().length > 0;
}

function isSellerProductInputCommand(value: unknown): value is {
  mediaAssetId?: string;
  rawText?: string;
} {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  const hasMedia = typeof body.mediaAssetId === "string";
  const hasText = typeof body.rawText === "string";
  return (hasMedia || hasText) && optionalStrings(body, ["mediaAssetId", "rawText"]);
}

function isSellerProductRunCommand(value: unknown): value is {
  input: Readonly<Record<string, unknown>>;
  dataClassification?: "public" | "internal";
  promptVersion?: string;
  outputSchemaVersion?: string;
  policyVersion?: string;
  inputReference?: string;
  inputHash?: string;
  budgetUnits?: number;
} {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  if (!body.input || typeof body.input !== "object" || Array.isArray(body.input)) return false;
  if (body.budgetUnits !== undefined && (typeof body.budgetUnits !== "number" || !Number.isFinite(body.budgetUnits) || body.budgetUnits <= 0)) return false;
  if (body.dataClassification !== undefined && body.dataClassification !== "public" && body.dataClassification !== "internal") return false;
  return optionalStrings(body, ["promptVersion", "outputSchemaVersion", "policyVersion", "inputReference", "inputHash"]);
}

function isSellerProductVersionCommand(value: unknown): value is { version: number } {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.version === "number" && Number.isInteger(body.version) && body.version > 0;
}

function sellerProductTextField(draft: Awaited<ReturnType<SellerProductSessionService["getDraft"]>>, fieldName: string): string | undefined {
  const field = draft?.product[fieldName];
  if (!field || typeof field.value !== "string") return undefined;
  const value = field.value.trim();
  return value || undefined;
}

function optionalStrings(body: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => body[key] === undefined || typeof body[key] === "string");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}


function createSellerProductServiceForRequest(database: D1Database | undefined, env: ApiEnv, authorization: ReturnType<typeof createApiAuthorizationRegistry>, requestId: RequestId) {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  return createSellerProductService({
    env,
    database,
    authorization: createAuthorizationService(new AuthorizationRepository(database), authorization),
    billing: new BillingService({
      repository: new BillingRepository(database),
      id: () => crypto.randomUUID(),
      now: () => new Date().toISOString(),
    }),
    validateOutput: validateSellerProductOutput,
    validateSafety: validateSellerProductSafety,
  });
}

export default {
  async fetch(request: Request, env: ApiEnv): Promise<Response> {
    const url = new URL(request.url);
    const version = env.APP_VERSION ?? "development";
    const database = getDatabase(env);

    if (request.method === "GET") {
      const seoDocument = await renderSeoAwareDocument(request, env, database ?? undefined);
      if (seoDocument) return seoDocument;

      if (isApiFirstPublicPath(url.pathname)) {
        return createRouter(version, database ?? undefined, env).handle(request);
      }

      if (env.ASSETS) {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status !== 404) return assetResponse;
      }

      if (url.pathname === "/") return html(homePage(version));
      return createRouter(version, database ?? undefined, env).handle(request);
    }

    return createRouter(version, database ?? undefined, env).handle(request);
  },

  async scheduled(controller: ScheduledControllerLike, env: ApiEnv): Promise<void> {
    assertProductionInfrastructure(env);
    const now = new Date(controller.scheduledTime).toISOString();
    const database = getDatabase(env);
    await publishPendingOutbox(env, now);
    await processCommunicationDispatch(env, now);
    await processPendingTrustExpiries(env, now);
    await processTrustAntiAbuseSignals(env, now);
    await processAutomationSchedules(env, now);
    await processAutomationExecutions(env, now);
    await processCaseSla(env, now);
    await processCaseActions(env, now);
    await processCaseDispatch(env, now);
    await processPrivacyConsentExpiry(env, now);
    await processApprovedPrivacyRequests(env, now);
    await processPrivacyRetention(env, now);
    await processIntegration(env, now);
    await processAnalyticsAggregates(env, now);
    if (database) {
      const indexNow = buildSeoIndexNowConfig(env);
      const bingActions = buildBingSearchEngineActionsConfig(env);
      const yandexActions = buildYandexSearchEngineActionsConfig(env);
      await processSeoPublicationJobs(
        database,
        now,
        25,
        env.SEO_CANONICAL_BASE_URL ?? "https://qooqnos.com",
        {
          ...(indexNow ? { indexNow } : {}),
          ...(bingActions ? { bing: bingActions } : {}),
          ...(yandexActions && env.SEO_YANDEX_ENABLE_RECRAWL === "true" ? { yandex: yandexActions, yandexRecrawl: true } : {}),
        },
      );
      if (env.ENVIRONMENT === "production") {
        const crawlerLimit = Number(env.SEO_CRAWLER_SAMPLE_LIMIT ?? "25");
        await runProductionSeoCrawler(database, env.SEO_CANONICAL_BASE_URL ?? "https://qooqnos.com", Number.isFinite(crawlerLimit) ? crawlerLimit : 25, now);
        const measurementAt = new Date(now);
        if (measurementAt.getUTCHours() === 2 && measurementAt.getUTCMinutes() === 41) {
          const measurementLimit = Number(env.SEO_MEASUREMENT_SAMPLE_LIMIT ?? "25");
          await runSeoVisibilityMeasurements(database, buildSeoVisibilityWorkerConfig(env, Number.isFinite(measurementLimit) ? measurementLimit : 25), now);
        }
        if (measurementAt.getUTCHours() === 3 && measurementAt.getUTCMinutes() === 17 && env.SEO_COMPETITIVE_LOGIN && env.SEO_COMPETITIVE_PASSWORD && (env.SEO_COMPETITIVE_LOCATION_CODE || env.SEO_COMPETITIVE_LOCATION_NAME) && env.SEO_COMPETITIVE_LANGUAGE_CODE) {
          const competitiveLimit = Number(env.SEO_COMPETITIVE_SAMPLE_LIMIT ?? "10");
          await runSeoCompetitiveIntelligence(
            database,
            buildSeoCompetitiveWorkerConfig(env, Number.isFinite(competitiveLimit) ? competitiveLimit : 10),
            env.SEO_CANONICAL_BASE_URL ?? "https://qooqnos.com",
            now,
          );
        }
      }
    }

    if (database && env.AI && env.AI_SELLER_EXTRACT_MODEL_ID) {
      const authorizationRegistry = createApiAuthorizationRegistry();
      const authorization = createAuthorizationService(
        new AuthorizationRepository(database),
        authorizationRegistry,
      );
      await processSellerProductAIRuntimeWork({
        env,
        database,
        authorization,
        billing: new BillingService({
          repository: new BillingRepository(database),
          id: () => crypto.randomUUID(),
          now: () => now,
        }),
        validateOutput: validateSellerProductOutput,
        validateSafety: validateSellerProductSafety,
        workerId: env.AI_WORKER_ID ?? "phoenix-ai-scheduled",
        now: () => now,
      });
    }
  },

  async queue(
    batch: QueueBatchLike<OutboxEventRecord>,
    env: ApiEnv,
  ): Promise<void> {
    await consumeOutbox(env, batch);
  },
};

export { createRequestContext };