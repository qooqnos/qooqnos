import type { RequestContext } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";
import { buildRobotsTxt, buildSitemapIndexXml, buildSitemapXml, buildImageSitemapXml, buildMerchantProductFeedXml, projectMerchantProductFeed, SITEMAP_URL_LIMIT, type RobotsAiPolicy, SeoObservabilityRepository, parseGoogleSearchConsoleExport, parseBingAiPerformanceExport, DataForSeoSearchIntelligenceClient, GooglePlacesClient, GoogleRoutesClient, YouTubeSearchClient, searchIntelligenceVerticals, type SearchIntelligenceVertical } from "@qooqnos/seo";
import { crawlStoredSeoRepresentation } from "./seo-production-crawler";
import { evaluateSeoProductionReadiness } from "./seo-production-readiness";
import type { ApiEnv } from "./env";

export function registerSeoRoutes(router: ApiRouter, database: D1Database | undefined, canonicalBaseUrl = "https://qooqnos.com", environment?: ApiEnv): void {

  const buildSearchIntelligenceClient = (): DataForSeoSearchIntelligenceClient | undefined => {
    const login = environment?.SEO_SEARCH_INTELLIGENCE_LOGIN ?? environment?.SEO_COMPETITIVE_LOGIN;
    const password = environment?.SEO_SEARCH_INTELLIGENCE_PASSWORD ?? environment?.SEO_COMPETITIVE_PASSWORD;
    if (!login || !password) return undefined;
    return new DataForSeoSearchIntelligenceClient({
      login,
      password,
      ...(environment?.SEO_SEARCH_INTELLIGENCE_ENDPOINT ? { endpoint: environment.SEO_SEARCH_INTELLIGENCE_ENDPOINT } : {}),
    });
  };


  router.register({
    method: "GET",
    path: "/api/v1/seo/intelligence/providers",
    module: "seo",
    operation: "intelligence.providers",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: ({ context }) => json({
      dataForSeo: Boolean(buildSearchIntelligenceClient()),
      dataForSeoVerticals: searchIntelligenceVerticals(),
      googlePlaces: Boolean(environment?.SEO_GOOGLE_PLACES_API_KEY),
      googleRoutes: Boolean(environment?.SEO_GOOGLE_ROUTES_API_KEY ?? environment?.SEO_GOOGLE_PLACES_API_KEY),
      youtube: Boolean(environment?.SEO_YOUTUBE_API_KEY),
    }, 200, context.requestId),
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/intelligence/search",
    module: "seo",
    operation: "intelligence.search",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const client = buildSearchIntelligenceClient();
      if (!client) return json({ status: "unavailable", provider: "dataforseo" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const vertical = typeof body.vertical === "string" ? body.vertical : "";
      const allowed = new Set(searchIntelligenceVerticals());
      if (!allowed.has(vertical as SearchIntelligenceVertical)) return json({ error: { code: "VALIDATION_ERROR", message: "Unsupported search intelligence vertical." } }, 400, context.requestId);
      const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
      if (!keyword) return json({ error: { code: "VALIDATION_ERROR", message: "keyword is required." } }, 400, context.requestId);
      const result = await client.search({
        vertical: vertical as SearchIntelligenceVertical,
        keyword,
        ...(Number.isFinite(Number(body.locationCode)) ? { locationCode: Number(body.locationCode) } : {}),
        ...(typeof body.locationName === "string" ? { locationName: body.locationName } : {}),
        ...(typeof body.languageCode === "string" ? { languageCode: body.languageCode } : {}),
        ...(typeof body.languageName === "string" ? { languageName: body.languageName } : {}),
        ...(body.device === "desktop" || body.device === "mobile" ? { device: body.device } : {}),
        ...(Number.isFinite(Number(body.depth)) ? { depth: Number(body.depth) } : {}),
        ...(Array.isArray(body.targetDomains) ? { targetDomains: body.targetDomains.filter((value): value is string => typeof value === "string") } : {}),
        ...(body.extra && typeof body.extra === "object" && !Array.isArray(body.extra) ? { extra: body.extra as Record<string, unknown> } : {}),
      });
      return json({ provider: "dataforseo", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/intelligence/search-by-image",
    module: "seo",
    operation: "intelligence.search_by_image",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const client = buildSearchIntelligenceClient();
      if (!client) return json({ status: "unavailable", provider: "dataforseo" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
      if (!/^https?:\/\//i.test(imageUrl)) return json({ error: { code: "VALIDATION_ERROR", message: "imageUrl must be an HTTP(S) URL." } }, 400, context.requestId);
      const result = await client.searchByImage({
        imageUrl,
        ...(Number.isFinite(Number(body.locationCode)) ? { locationCode: Number(body.locationCode) } : {}),
        ...(typeof body.locationName === "string" ? { locationName: body.locationName } : {}),
        ...(typeof body.languageCode === "string" ? { languageCode: body.languageCode } : {}),
        ...(typeof body.languageName === "string" ? { languageName: body.languageName } : {}),
      });
      return json({ provider: "dataforseo", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/intelligence/trends",
    module: "seo",
    operation: "intelligence.trends",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const client = buildSearchIntelligenceClient();
      if (!client) return json({ status: "unavailable", provider: "dataforseo" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const keywords = Array.isArray(body.keywords) ? body.keywords.filter((value): value is string => typeof value === "string") : [];
      if (!keywords.length) return json({ error: { code: "VALIDATION_ERROR", message: "keywords is required." } }, 400, context.requestId);
      const result = await client.exploreTrends({
        keywords,
        ...(Number.isFinite(Number(body.locationCode)) ? { locationCode: Number(body.locationCode) } : {}),
        ...(typeof body.locationName === "string" ? { locationName: body.locationName } : {}),
        ...(body.type === "web" || body.type === "news" || body.type === "shopping" ? { type: body.type } : {}),
      });
      return json({ provider: "dataforseo", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/intelligence/reviews",
    module: "seo",
    operation: "intelligence.reviews",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const client = buildSearchIntelligenceClient();
      if (!client) return json({ status: "unavailable", provider: "dataforseo" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
      if (!keyword) return json({ error: { code: "VALIDATION_ERROR", message: "keyword is required." } }, 400, context.requestId);
      const result = await client.googleReviews({
        keyword,
        ...(Number.isFinite(Number(body.locationCode)) ? { locationCode: Number(body.locationCode) } : {}),
        ...(typeof body.locationName === "string" ? { locationName: body.locationName } : {}),
        ...(typeof body.languageCode === "string" ? { languageCode: body.languageCode } : {}),
        ...(typeof body.languageName === "string" ? { languageName: body.languageName } : {}),
        ...(Number.isFinite(Number(body.depth)) ? { depth: Number(body.depth) } : {}),
        ...(body.sortBy === "relevance" || body.sortBy === "highest_rating" || body.sortBy === "lowest_rating" || body.sortBy === "newest" ? { sortBy: body.sortBy } : {}),
      });
      return json({ provider: "dataforseo", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/intelligence/business-listings",
    module: "seo",
    operation: "intelligence.business_listings",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const client = buildSearchIntelligenceClient();
      if (!client) return json({ status: "unavailable", provider: "dataforseo" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const categories = Array.isArray(body.categories) ? body.categories.filter((value): value is string => typeof value === "string") : [];
      const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
      if (!keyword && !categories.length) return json({ error: { code: "VALIDATION_ERROR", message: "keyword or categories is required." } }, 400, context.requestId);
      const result = await client.businessListingsSearch({
        ...(keyword ? { keyword } : {}),
        ...(categories.length ? { categories } : {}),
        ...(Number.isFinite(Number(body.locationCode)) ? { locationCode: Number(body.locationCode) } : {}),
        ...(typeof body.locationName === "string" ? { locationName: body.locationName } : {}),
        ...(typeof body.languageCode === "string" ? { languageCode: body.languageCode } : {}),
        ...(typeof body.languageName === "string" ? { languageName: body.languageName } : {}),
        ...(Number.isFinite(Number(body.limit)) ? { limit: Number(body.limit) } : {}),
      });
      return json({ provider: "dataforseo", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/intelligence/business",
    module: "seo",
    operation: "intelligence.business",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const client = buildSearchIntelligenceClient();
      if (!client) return json({ status: "unavailable", provider: "dataforseo" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
      if (!keyword) return json({ error: { code: "VALIDATION_ERROR", message: "keyword is required." } }, 400, context.requestId);
      const result = await client.businessInfo({
        keyword,
        ...(Number.isFinite(Number(body.locationCode)) ? { locationCode: Number(body.locationCode) } : {}),
        ...(typeof body.locationName === "string" ? { locationName: body.locationName } : {}),
        ...(typeof body.languageCode === "string" ? { languageCode: body.languageCode } : {}),
        ...(typeof body.languageName === "string" ? { languageName: body.languageName } : {}),
      });
      return json({ provider: "dataforseo", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/intelligence/shopping",
    module: "seo",
    operation: "intelligence.shopping",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const client = buildSearchIntelligenceClient();
      if (!client) return json({ status: "unavailable", provider: "dataforseo" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
      if (!keyword) return json({ error: { code: "VALIDATION_ERROR", message: "keyword is required." } }, 400, context.requestId);
      const result = await client.googleShoppingProducts({
        keyword,
        ...(Number.isFinite(Number(body.locationCode)) ? { locationCode: Number(body.locationCode) } : {}),
        ...(typeof body.locationName === "string" ? { locationName: body.locationName } : {}),
        ...(typeof body.languageCode === "string" ? { languageCode: body.languageCode } : {}),
        ...(typeof body.languageName === "string" ? { languageName: body.languageName } : {}),
        ...(Number.isFinite(Number(body.depth)) ? { depth: Number(body.depth) } : {}),
        ...(typeof body.sortBy === "string" ? { sortBy: body.sortBy } : {}),
        ...(Number.isFinite(Number(body.priceMin)) ? { priceMin: Number(body.priceMin) } : {}),
        ...(Number.isFinite(Number(body.priceMax)) ? { priceMax: Number(body.priceMax) } : {}),
      });
      return json({ provider: "dataforseo", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/intelligence/places/search",
    module: "seo",
    operation: "intelligence.places.search",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const apiKey = environment?.SEO_GOOGLE_PLACES_API_KEY;
      if (!apiKey) return json({ status: "unavailable", provider: "google-places" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const textQuery = typeof body.textQuery === "string" ? body.textQuery.trim() : "";
      if (!textQuery) return json({ error: { code: "VALIDATION_ERROR", message: "textQuery is required." } }, 400, context.requestId);
      const result = await new GooglePlacesClient({ apiKey }).textSearch({
        textQuery,
        ...(typeof body.languageCode === "string" ? { languageCode: body.languageCode } : {}),
        ...(typeof body.regionCode === "string" ? { regionCode: body.regionCode } : {}),
        ...(Number.isFinite(Number(body.pageSize)) ? { pageSize: Number(body.pageSize) } : {}),
        ...(typeof body.includedType === "string" ? { includedType: body.includedType } : {}),
        ...(Number.isFinite(Number(body.latitude)) ? { latitude: Number(body.latitude) } : {}),
        ...(Number.isFinite(Number(body.longitude)) ? { longitude: Number(body.longitude) } : {}),
        ...(Number.isFinite(Number(body.radiusMeters)) ? { radiusMeters: Number(body.radiusMeters) } : {}),
      });
      return json({ provider: "google-places", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/intelligence/places/autocomplete",
    module: "seo",
    operation: "intelligence.places.autocomplete",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const apiKey = environment?.SEO_GOOGLE_PLACES_API_KEY;
      if (!apiKey) return json({ status: "unavailable", provider: "google-places" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const input = typeof body.input === "string" ? body.input.trim() : "";
      if (!input) return json({ error: { code: "VALIDATION_ERROR", message: "input is required." } }, 400, context.requestId);
      const result = await new GooglePlacesClient({ apiKey }).autocomplete({
        input,
        ...(typeof body.regionCode === "string" ? { regionCode: body.regionCode } : {}),
        ...(Array.isArray(body.includedPrimaryTypes) ? { includedPrimaryTypes: body.includedPrimaryTypes.filter((value): value is string => typeof value === "string") } : {}),
        ...(body.includeQueryPredictions === true ? { includeQueryPredictions: true } : {}),
        ...(typeof body.sessionToken === "string" ? { sessionToken: body.sessionToken } : {}),
        ...(Number.isFinite(Number(body.latitude)) ? { latitude: Number(body.latitude) } : {}),
        ...(Number.isFinite(Number(body.longitude)) ? { longitude: Number(body.longitude) } : {}),
        ...(Number.isFinite(Number(body.radiusMeters)) ? { radiusMeters: Number(body.radiusMeters) } : {}),
      });
      return json({ provider: "google-places", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/intelligence/places/nearby",
    module: "seo",
    operation: "intelligence.places.nearby",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const apiKey = environment?.SEO_GOOGLE_PLACES_API_KEY;
      if (!apiKey) return json({ status: "unavailable", provider: "google-places" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const includedTypes = Array.isArray(body.includedTypes) ? body.includedTypes.filter((value): value is string => typeof value === "string") : [];
      if (!Number.isFinite(Number(body.latitude)) || !Number.isFinite(Number(body.longitude)) || !Number.isFinite(Number(body.radiusMeters)) || !includedTypes.length) return json({ error: { code: "VALIDATION_ERROR", message: "latitude, longitude, radiusMeters and includedTypes are required." } }, 400, context.requestId);
      const result = await new GooglePlacesClient({ apiKey }).nearbySearch({
        latitude: Number(body.latitude),
        longitude: Number(body.longitude),
        radiusMeters: Number(body.radiusMeters),
        includedTypes,
        ...(Number.isFinite(Number(body.maxResultCount)) ? { maxResultCount: Number(body.maxResultCount) } : {}),
        ...(typeof body.languageCode === "string" ? { languageCode: body.languageCode } : {}),
        ...(typeof body.regionCode === "string" ? { regionCode: body.regionCode } : {}),
      });
      return json({ provider: "google-places", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/seo/intelligence/places/:placeId",
    module: "seo",
    operation: "intelligence.places.details",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params, request }) => {
      const apiKey = environment?.SEO_GOOGLE_PLACES_API_KEY;
      if (!apiKey) return json({ status: "unavailable", provider: "google-places" }, 503, context.requestId);
      const fields = new URL(request.url).searchParams.get("fields") ?? "id,displayName,formattedAddress,location,rating,userRatingCount,regularOpeningHours,websiteUri,reviews";
      const result = await new GooglePlacesClient({ apiKey }).placeDetails(params.placeId, fields);
      return json({ provider: "google-places", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/intelligence/routes",
    module: "seo",
    operation: "intelligence.routes.compute",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const apiKey = environment?.SEO_GOOGLE_ROUTES_API_KEY ?? environment?.SEO_GOOGLE_PLACES_API_KEY;
      if (!apiKey) return json({ status: "unavailable", provider: "google-routes" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const result = await new GoogleRoutesClient({ apiKey }).computeRoutes(body, typeof body.fieldMask === "string" ? body.fieldMask : undefined);
      return json({ provider: "google-routes", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/intelligence/youtube/search",
    module: "seo",
    operation: "intelligence.youtube.search",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const apiKey = environment?.SEO_YOUTUBE_API_KEY;
      if (!apiKey) return json({ status: "unavailable", provider: "youtube-data-api" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const query = typeof body.query === "string" ? body.query.trim() : "";
      if (!query) return json({ error: { code: "VALIDATION_ERROR", message: "query is required." } }, 400, context.requestId);
      const result = await new YouTubeSearchClient({ apiKey }).search(query, {
        ...(typeof body.regionCode === "string" ? { regionCode: body.regionCode } : {}),
        ...(typeof body.relevanceLanguage === "string" ? { relevanceLanguage: body.relevanceLanguage } : {}),
        ...(body.type === "video" || body.type === "channel" || body.type === "playlist" ? { type: body.type } : {}),
        ...(Number.isFinite(Number(body.maxResults)) ? { maxResults: Number(body.maxResults) } : {}),
      });
      return json({ provider: "youtube-data-api", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/seo/social/providers",
    module: "seo",
    operation: "social.providers",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: ({ context }) => json({
      facebook: Boolean(environment?.SEO_FACEBOOK_PAGE_ID && environment?.SEO_FACEBOOK_ACCESS_TOKEN),
      instagram: Boolean(environment?.SEO_INSTAGRAM_USER_ID && environment?.SEO_INSTAGRAM_ACCESS_TOKEN),
      x: Boolean(environment?.SEO_X_BEARER_TOKEN),
      pinterest: Boolean(environment?.SEO_PINTEREST_ACCESS_TOKEN),
      linkedin: Boolean(environment?.SEO_LINKEDIN_ACCESS_TOKEN),
      tiktok: Boolean(environment?.SEO_TIKTOK_ACCESS_TOKEN),
      reddit: Boolean(environment?.SEO_REDDIT_ACCESS_TOKEN),
    }, 200, context.requestId),
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/social/facebook/search",
    module: "seo",
    operation: "social.facebook.search",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!environment?.SEO_FACEBOOK_PAGE_ID || !environment.SEO_FACEBOOK_ACCESS_TOKEN) return json({ status: "unavailable", provider: "facebook" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const result = await new FacebookPageClient({ pageId: environment.SEO_FACEBOOK_PAGE_ID, accessToken: environment.SEO_FACEBOOK_ACCESS_TOKEN }).listFeed(Number(body.limit ?? 25));
      return json({ provider: "facebook", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/social/facebook/publish",
    module: "seo",
    operation: "social.facebook.publish",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!environment?.SEO_FACEBOOK_PAGE_ID || !environment.SEO_FACEBOOK_ACCESS_TOKEN) return json({ status: "unavailable", provider: "facebook" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const textValue = typeof body.text === "string" ? body.text.trim() : "";
      if (!textValue) return json({ error: { code: "VALIDATION_ERROR", message: "text is required." } }, 400, context.requestId);
      const result = await new FacebookPageClient({ pageId: environment.SEO_FACEBOOK_PAGE_ID, accessToken: environment.SEO_FACEBOOK_ACCESS_TOKEN }).publish(textValue, typeof body.link === "string" ? body.link : undefined);
      return json({ provider: "facebook", result }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/social/instagram/publish-image",
    module: "seo",
    operation: "social.instagram.publish_image",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!environment?.SEO_INSTAGRAM_USER_ID || !environment.SEO_INSTAGRAM_ACCESS_TOKEN) return json({ status: "unavailable", provider: "instagram" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
      if (!/^https?:\/\//i.test(imageUrl)) return json({ error: { code: "VALIDATION_ERROR", message: "imageUrl is required." } }, 400, context.requestId);
      const result = await new InstagramGraphClient({ igUserId: environment.SEO_INSTAGRAM_USER_ID, accessToken: environment.SEO_INSTAGRAM_ACCESS_TOKEN }).publishImage(imageUrl, typeof body.caption === "string" ? body.caption : "");
      return json({ provider: "instagram", result }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/social/x/search",
    module: "seo",
    operation: "social.x.search",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!environment?.SEO_X_BEARER_TOKEN) return json({ status: "unavailable", provider: "x" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const query = typeof body.query === "string" ? body.query.trim() : "";
      if (!query) return json({ error: { code: "VALIDATION_ERROR", message: "query is required." } }, 400, context.requestId);
      const result = await new XApiClient({ bearerToken: environment.SEO_X_BEARER_TOKEN, userAccessToken: environment.SEO_X_USER_ACCESS_TOKEN }).recentSearch(query, Number(body.maxResults ?? 25));
      return json({ provider: "x", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/social/x/publish",
    module: "seo",
    operation: "social.x.publish",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!environment?.SEO_X_BEARER_TOKEN || !environment.SEO_X_USER_ACCESS_TOKEN) return json({ status: "unavailable", provider: "x" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const textValue = typeof body.text === "string" ? body.text.trim() : "";
      if (!textValue) return json({ error: { code: "VALIDATION_ERROR", message: "text is required." } }, 400, context.requestId);
      const result = await new XApiClient({ bearerToken: environment.SEO_X_BEARER_TOKEN, userAccessToken: environment.SEO_X_USER_ACCESS_TOKEN }).createPost(textValue);
      return json({ provider: "x", result }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/social/pinterest/search",
    module: "seo",
    operation: "social.pinterest.search",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!environment?.SEO_PINTEREST_ACCESS_TOKEN) return json({ status: "unavailable", provider: "pinterest" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const query = typeof body.query === "string" ? body.query.trim() : "";
      if (!query) return json({ error: { code: "VALIDATION_ERROR", message: "query is required." } }, 400, context.requestId);
      const result = await new PinterestClient({ accessToken: environment.SEO_PINTEREST_ACCESS_TOKEN }).searchPins(query, Number(body.pageSize ?? 25));
      return json({ provider: "pinterest", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/social/pinterest/trends",
    module: "seo",
    operation: "social.pinterest.trends",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!environment?.SEO_PINTEREST_ACCESS_TOKEN) return json({ status: "unavailable", provider: "pinterest" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const regionCode = typeof body.regionCode === "string" ? body.regionCode.trim() : "";
      if (!regionCode) return json({ error: { code: "VALIDATION_ERROR", message: "regionCode is required." } }, 400, context.requestId);
      const result = await new PinterestClient({ accessToken: environment.SEO_PINTEREST_ACCESS_TOKEN }).trends(regionCode, typeof body.trendType === "string" ? body.trendType : "monthly");
      return json({ provider: "pinterest", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/social/pinterest/publish",
    module: "seo",
    operation: "social.pinterest.publish",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!environment?.SEO_PINTEREST_ACCESS_TOKEN) return json({ status: "unavailable", provider: "pinterest" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const boardId = typeof body.boardId === "string" ? body.boardId.trim() : "";
      const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
      if (!boardId || !/^https?:\/\//i.test(imageUrl)) return json({ error: { code: "VALIDATION_ERROR", message: "boardId and imageUrl are required." } }, 400, context.requestId);
      const result = await new PinterestClient({ accessToken: environment.SEO_PINTEREST_ACCESS_TOKEN }).createPin({ boardId, imageUrl, ...(typeof body.title === "string" ? { title: body.title } : {}), ...(typeof body.description === "string" ? { description: body.description } : {}), ...(typeof body.link === "string" ? { link: body.link } : {}) });
      return json({ provider: "pinterest", result }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/social/linkedin/publish",
    module: "seo",
    operation: "social.linkedin.publish",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!environment?.SEO_LINKEDIN_ACCESS_TOKEN || !environment.SEO_LINKEDIN_VERSION) return json({ status: "unavailable", provider: "linkedin" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const authorUrn = typeof body.authorUrn === "string" ? body.authorUrn.trim() : "";
      const commentary = typeof body.commentary === "string" ? body.commentary.trim() : "";
      if (!authorUrn || !commentary) return json({ error: { code: "VALIDATION_ERROR", message: "authorUrn and commentary are required." } }, 400, context.requestId);
      const result = await new LinkedInClient({ accessToken: environment.SEO_LINKEDIN_ACCESS_TOKEN, version: environment.SEO_LINKEDIN_VERSION }).createOrganizationPost({ authorUrn, commentary, ...(typeof body.articleUrl === "string" ? { articleUrl: body.articleUrl } : {}), ...(typeof body.imageUrn === "string" ? { imageUrn: body.imageUrn } : {}) });
      return json({ provider: "linkedin", result }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/social/linkedin/stats",
    module: "seo",
    operation: "social.linkedin.stats",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!environment?.SEO_LINKEDIN_ACCESS_TOKEN || !environment.SEO_LINKEDIN_VERSION) return json({ status: "unavailable", provider: "linkedin" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const organizationUrn = typeof body.organizationUrn === "string" ? body.organizationUrn.trim() : "";
      if (!organizationUrn) return json({ error: { code: "VALIDATION_ERROR", message: "organizationUrn is required." } }, 400, context.requestId);
      const result = await new LinkedInClient({ accessToken: environment.SEO_LINKEDIN_ACCESS_TOKEN, version: environment.SEO_LINKEDIN_VERSION }).organizationShareStatistics(organizationUrn);
      return json({ provider: "linkedin", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/social/tiktok/publish",
    module: "seo",
    operation: "social.tiktok.publish",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!environment?.SEO_TIKTOK_ACCESS_TOKEN) return json({ status: "unavailable", provider: "tiktok" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
      const privacyLevel = typeof body.privacyLevel === "string" ? body.privacyLevel : "SELF_ONLY";
      if (!/^https?:\/\//i.test(videoUrl)) return json({ error: { code: "VALIDATION_ERROR", message: "videoUrl is required." } }, 400, context.requestId);
      const result = await new TikTokClient({ accessToken: environment.SEO_TIKTOK_ACCESS_TOKEN }).initializeVideoPost({ videoUrl, privacyLevel, ...(typeof body.title === "string" ? { title: body.title } : {}) });
      return json({ provider: "tiktok", result }, 202, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/social/tiktok/creator",
    module: "seo",
    operation: "social.tiktok.creator",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context }) => {
      if (!environment?.SEO_TIKTOK_ACCESS_TOKEN) return json({ status: "unavailable", provider: "tiktok" }, 503, context.requestId);
      const result = await new TikTokClient({ accessToken: environment.SEO_TIKTOK_ACCESS_TOKEN }).creatorInfo();
      return json({ provider: "tiktok", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/social/reddit/search",
    module: "seo",
    operation: "social.reddit.search",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const body = await request.json() as Record<string, unknown>;
      const query = typeof body.query === "string" ? body.query.trim() : "";
      if (!query) return json({ error: { code: "VALIDATION_ERROR", message: "query is required." } }, 400, context.requestId);
      const result = await new RedditClient({ ...(environment?.SEO_REDDIT_ACCESS_TOKEN ? { accessToken: environment.SEO_REDDIT_ACCESS_TOKEN } : {}) }).searchPosts(query, typeof body.subreddit === "string" ? body.subreddit : undefined, Number(body.limit ?? 25));
      return json({ provider: "reddit", result }, 200, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/sitemap.xml",
    module: "seo",
    operation: "sitemap.read",
    handler: async () => {
      if (!database) return new Response("Database is not configured.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
      const canonicalPrefix = canonicalBaseUrl.replace(/\/$/, "") + "/";
      const countRow = await database.first<{ total: number }>(
        `SELECT COUNT(DISTINCT canonical_url) AS total
           FROM seo_entity_representations
          WHERE indexability='index' AND publication_state='published' AND visibility='public' AND canonical_url LIKE ?`,
        canonicalPrefix + "%",
      );
      const total = countRow?.total ?? 0;
      const shardCount = Math.max(1, Math.ceil(total / SITEMAP_URL_LIMIT));
      const xml = total > SITEMAP_URL_LIMIT
        ? buildSitemapIndexXml(Array.from({ length: shardCount }, (_, index) => canonicalBaseUrl.replace(/\/$/, "") + "/sitemap-" + (index + 1) + ".xml"))
        : buildSitemapXml(await readSitemapShardRows(database, canonicalPrefix, 0));
      return new Response(xml, { status: 200, headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=300" } });
    },
  });

  router.register({
    method: "GET",
    path: "/sitemap-:shard.xml",
    module: "seo",
    operation: "sitemap.shard.read",
    handler: async ({ params }) => {
      if (!database) return new Response("Database is not configured.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
      const shard = Number(params.shard);
      if (!Number.isSafeInteger(shard) || shard < 1) return new Response("Sitemap shard not found.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" } });
      const canonicalPrefix = canonicalBaseUrl.replace(/\/$/, "") + "/";
      const countRow = await database.first<{ total: number }>(
        `SELECT COUNT(DISTINCT canonical_url) AS total
           FROM seo_entity_representations
          WHERE indexability='index' AND publication_state='published' AND visibility='public' AND canonical_url LIKE ?`,
        canonicalPrefix + "%",
      );
      const total = countRow?.total ?? 0;
      const shardCount = Math.max(1, Math.ceil(total / SITEMAP_URL_LIMIT));
      if (shard > shardCount) return new Response("Sitemap shard not found.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" } });
      const xml = buildSitemapXml(await readSitemapShardRows(database, canonicalPrefix, (shard - 1) * SITEMAP_URL_LIMIT));
      return new Response(xml, { status: 200, headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=300" } });
    },
  });

  router.register({
    method: "GET",
    path: "/image-sitemap.xml",
    module: "seo",
    operation: "image-sitemap.read",
    handler: async () => {
      if (!database) return new Response("Database is not configured.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
      const canonicalPrefix = canonicalBaseUrl.replace(/\/$/, "") + "/";
      const rows = await database.all<{ canonicalUrl: string; representationJson: string; generatedAt: string }>(
        "SELECT canonical_url AS canonicalUrl, representation_json AS representationJson, generated_at AS generatedAt FROM seo_entity_representations WHERE indexability='index' AND publication_state='published' AND visibility='public' AND canonical_url LIKE ? ORDER BY canonical_url ASC LIMIT ?",
        canonicalPrefix + "%", SITEMAP_URL_LIMIT,
      );
      const entries: { url: string; images: string[]; lastmod: string }[] = [];
      for (const row of rows) {
        try {
          const parsed = JSON.parse(row.representationJson) as { entity?: { imageUrl?: string } };
          const image = parsed.entity?.imageUrl;
          if (typeof image === "string" && image.trim()) entries.push({ url: row.canonicalUrl, images: [image], lastmod: row.generatedAt });
        } catch {}
      }
      const xml = buildImageSitemapXml(entries);
      return new Response(xml, { status: 200, headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=300" } });
    },
  });
  router.register({
    method: "GET",
    path: "/merchant-center/products.xml",
    module: "seo",
    operation: "merchant-feed.read",
    handler: async () => {
      if (!database) return new Response("Database is not configured.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
      const canonicalPrefix = canonicalBaseUrl.replace(/\/$/, "") + "/";
      const limitValue = Number(environment?.SEO_MERCHANT_FEED_LIMIT ?? "50000");
      const limit = Number.isFinite(limitValue) ? Math.min(Math.max(Math.trunc(limitValue), 1), 50000) : 50000;
      const rows = await database.all<{ canonicalUrl: string; representationJson: string }>(
        `SELECT representation_json AS representationJson
           FROM seo_entity_representations
          WHERE entity_type='Product'
            AND indexability='index'
            AND publication_state='published'
            AND visibility='public'
            AND canonical_url LIKE ?
          ORDER BY canonical_url ASC
          LIMIT ?`,
        canonicalPrefix + "%", limit,
      );
      const entities: import("@qooqnos/seo").SeoEntity[] = [];
      const canonicalUrlByEntityId: Record<string, string> = {};
      for (const row of rows) {
        try {
          const parsed = JSON.parse(row.representationJson) as { entity?: import("@qooqnos/seo").SeoEntity };
          if (!parsed.entity) continue;
          entities.push(parsed.entity);
          canonicalUrlByEntityId[parsed.entity.id] = row.canonicalUrl;
        } catch {
          // Skip malformed historical projections; publication will repair them.
        }
      }
      const projection = projectMerchantProductFeed(entities, { canonicalBaseUrl, canonicalUrlByEntityId });
      const xml = buildMerchantProductFeedXml(projection.items, canonicalBaseUrl);
      return new Response(xml, {
        status: 200,
        headers: {
          "content-type": "application/xml; charset=utf-8",
          "cache-control": "public, max-age=900, s-maxage=900",
          "x-phoenix-merchant-feed-items": String(projection.items.length),
          "x-phoenix-merchant-feed-skipped": String(projection.skipped.length),
        },
      });
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/visibility/import/google-search-console",
    module: "seo",
    operation: "visibility.import.google_search_console",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const report = body.report === "generative-ai" ? "generative-ai" : body.report === "multimodal" ? "multimodal" : null;
      if (!report) return json({ error: { code: "VALIDATION_ERROR", message: "report must be multimodal or generative-ai." } }, 400, context.requestId);
      const locale = typeof body.locale === "string" && body.locale.trim() ? body.locale.trim() : "en-US";
      const source = typeof body.content === "string" ? body.content : Array.isArray(body.rows) ? body.rows.filter((row) => row && typeof row === "object" && !Array.isArray(row)) as Record<string, unknown>[] : null;
      if (!source) return json({ error: { code: "VALIDATION_ERROR", message: "Provide CSV/JSON content or rows." } }, 400, context.requestId);
      let observations;
      try {
        observations = parseGoogleSearchConsoleExport(source, {
          report, locale,
          ...(typeof body.entityId === "string" ? { entityId: body.entityId } : {}),
          ...(typeof body.entityType === "string" ? { entityType: body.entityType } : {}),
          ...(typeof body.canonicalUrl === "string" ? { canonicalUrl: body.canonicalUrl } : {}),
          ...(typeof body.exportReference === "string" ? { exportReference: body.exportReference } : {}),
        });
      } catch (error) {
        return json({ error: { code: "VALIDATION_ERROR", message: error instanceof Error ? error.message : "Google Search Console export is invalid." } }, 400, context.requestId);
      }
      if (!observations.length) return json({ error: { code: "VALIDATION_ERROR", message: "Google Search Console export contained no recognized metrics." } }, 400, context.requestId);
      return recordImportedVisibility(database, context, observations, "google-search-console-export", report, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/visibility/import/bing-ai-performance",
    module: "seo",
    operation: "visibility.import.bing_ai_performance",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      const body = await request.json() as Record<string, unknown>;
      const datasets = new Set(["pages", "grounding-queries", "timeseries"]);
      const dataset = typeof body.dataset === "string" && datasets.has(body.dataset) ? body.dataset as "pages" | "grounding-queries" | "timeseries" : null;
      if (!dataset) return json({ error: { code: "VALIDATION_ERROR", message: "dataset must be pages, grounding-queries, or timeseries." } }, 400, context.requestId);
      const locale = typeof body.locale === "string" && body.locale.trim() ? body.locale.trim() : "en-US";
      const source = typeof body.content === "string" ? body.content : Array.isArray(body.rows) ? body.rows.filter((row) => row && typeof row === "object" && !Array.isArray(row)) as Record<string, unknown>[] : null;
      if (!source) return json({ error: { code: "VALIDATION_ERROR", message: "Provide CSV/JSON content or rows." } }, 400, context.requestId);
      let observations;
      try {
        observations = parseBingAiPerformanceExport(source, {
          dataset, locale,
          ...(typeof body.entityId === "string" ? { entityId: body.entityId } : {}),
          ...(typeof body.entityType === "string" ? { entityType: body.entityType } : {}),
          ...(typeof body.exportReference === "string" ? { exportReference: body.exportReference } : {}),
        });
      } catch (error) {
        return json({ error: { code: "VALIDATION_ERROR", message: error instanceof Error ? error.message : "Bing AI Performance export is invalid." } }, 400, context.requestId);
      }
      if (!observations.length) return json({ error: { code: "VALIDATION_ERROR", message: "Bing AI Performance export contained no recognized metrics." } }, 400, context.requestId);
      return recordImportedVisibility(database, context, observations, "bing-ai-performance-export", dataset, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/robots.txt",
    module: "seo",
    operation: "robots.read",
    handler: () => {
      const origin = canonicalBaseUrl.replace(/\/$/, "");
      return new Response(buildRobotsTxt(`${origin}/sitemap.xml`, undefined, buildRobotsAiPolicy(environment)), { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/seo/audit/:entityId",
    module: "seo",
    operation: "audit.read",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      const audit = await new (await import("@qooqnos/seo")).SeoRepository(database).getLatestAudit(context, params.entityId);
      return audit ? json({ audit }, 200, context.requestId) : json({ error: { code: "NOT_FOUND", message: "SEO audit not found." } }, 404, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/seo/audit/:entityId",
    module: "seo",
    operation: "audit.run",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params, request }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      const repository = new (await import("@qooqnos/seo")).SeoRepository(database);
      const locale = new URL(request.url).searchParams.get("locale") ?? undefined;
      const representation = await repository.getRepresentation(context, params.entityId, locale);
      if (!representation) return json({ error: { code: "NOT_FOUND", message: "SEO representation not found." } }, 404, context.requestId);
      const now = new Date().toISOString();
      await repository.saveAudit(context, {
        id: `seo-audit:${params.entityId}:${crypto.randomUUID()}`,
        entity: representation.entity,
        canonicalUrl: representation.canonicalUrl,
        indexability: representation.indexability,
        now,
        surface: {
          ...(representation.metadata ? { metadata: representation.metadata } : {}),
          ...(representation.structuredData ? { structuredData: representation.structuredData } : {}),
          ...(representation.answer ? { answer: representation.answer } : {}),
          ...(representation.page ? { page: representation.page } : {}),
          ...(representation.policy ? { policy: representation.policy } : {}),
          now,
        },
      });
      return json({ audit: await repository.getLatestAudit(context, params.entityId) }, 200, context.requestId);
    },
  });


  router.register({
    method: "POST",
    path: "/api/v1/seo/crawl/:entityId",
    module: "seo",
    operation: "crawl.run",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params, request }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      const repository = new (await import("@qooqnos/seo")).SeoRepository(database);
      const locale = new URL(request.url).searchParams.get("locale") ?? undefined;
      const representation = await repository.getRepresentation(context, params.entityId, locale);
      if (!representation) return json({ error: { code: "NOT_FOUND", message: "SEO representation not found." } }, 404, context.requestId);
      const scope = context.tenantId;
      const workspaceId = context.workspaceId ?? null;
      const row = {
        organizationId: scope,
        workspaceId,
        entityId: params.entityId,
        canonicalUrl: representation.canonicalUrl,
        representationJson: JSON.stringify({
          entity: representation.entity,
          ...(representation.metadata ? { metadata: representation.metadata } : {}),
          ...(representation.structuredData ? { structuredData: representation.structuredData } : {}),
          ...(representation.answer ? { answer: representation.answer } : {}),
          ...(representation.page ? { page: representation.page } : {}),
        }),
      };
      const result = await crawlStoredSeoRepresentation(database, row, new Date().toISOString(), fetch, canonicalBaseUrl);
      return json({ crawl: result }, result.errors.length ? 502 : 200, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/seo/visibility/:entityId",
    module: "seo",
    operation: "visibility.read",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      if (!database) return json({ status: "unavailable" }, 503, context.requestId);
      const rows = await database.all(
        `SELECT id, observed_at AS observedAt, surface, metric, query_class AS queryClass,
                value_numeric AS valueNumeric, value_text AS valueText, provenance_json AS provenanceJson
           FROM seo_measurements
          WHERE organization_id=? AND workspace_id IS ? AND entity_id=?
          ORDER BY observed_at DESC
          LIMIT 200`,
        context.tenantId, context.workspaceId ?? null, params.entityId,
      );
      const citations = await database.all(
        `SELECT id, run_id AS runId, citation_url AS citationUrl, citation_title AS citationTitle,
                citation_position AS citationPosition, citation_count AS citationCount,
                source_type AS sourceType, observed_at AS observedAt, provenance_json AS provenanceJson
           FROM seo_measurement_citations
          WHERE organization_id=? AND workspace_id IS ? AND entity_id=?
          ORDER BY observed_at DESC
          LIMIT 100`,
        context.tenantId, context.workspaceId ?? null, params.entityId,
      );
      return json({
        visibility: {
          measurements: rows.map((row) => ({
            ...row,
            provenance: JSON.parse(String(row.provenanceJson)),
          })),
          citations: citations.map((row) => ({
            ...row,
            provenance: JSON.parse(String(row.provenanceJson)),
          })),
        },
      }, 200, context.requestId);
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
      const recentSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const crawl = await database.first<{ failures: number; lastObservedAt: string | null }>(
        `SELECT
           SUM(CASE WHEN metric='render-errors' AND value_numeric > 0 THEN 1 ELSE 0 END) AS failures,
           MAX(observed_at) AS lastObservedAt
         FROM seo_measurements
         WHERE organization_id=? AND workspace_id IS ? AND surface='production-crawler' AND observed_at>=?`,
        context.tenantId, context.workspaceId ?? null, recentSince,
      );
      const measurement = await database.first<{ failures: number; lastObservedAt: string | null; runs: number }>(
        `SELECT
           SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failures,
           MAX(completed_at) AS lastObservedAt,
           COUNT(*) AS runs
         FROM seo_measurement_runs
         WHERE organization_id=? AND workspace_id IS ? AND started_at>=?`,
        context.tenantId, context.workspaceId ?? null, recentSince,
      );
      const competitive = await database.first<{ failures: number; runs: number; lastObservedAt: string | null; competitors: number }>(
        `SELECT
           (SELECT SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END)
              FROM seo_competitive_runs
             WHERE organization_id=? AND workspace_id IS ? AND started_at>=?) AS failures,
           (SELECT COUNT(*)
              FROM seo_competitive_runs
             WHERE organization_id=? AND workspace_id IS ? AND started_at>=?) AS runs,
           (SELECT MAX(completed_at)
              FROM seo_competitive_runs
             WHERE organization_id=? AND workspace_id IS ?) AS lastObservedAt,
           (SELECT COUNT(*)
              FROM seo_competitors
             WHERE organization_id=? AND workspace_id IS ? AND lifecycle_state='active') AS competitors`,
        context.tenantId, context.workspaceId ?? null, recentSince,
        context.tenantId, context.workspaceId ?? null, recentSince,
        context.tenantId, context.workspaceId ?? null,
        context.tenantId, context.workspaceId ?? null,
      );
      const readiness = evaluateSeoProductionReadiness(environment ?? { SEO_CANONICAL_BASE_URL: canonicalBaseUrl });
      const degraded = (result?.failed ?? 0) > 0 || (crawl?.failures ?? 0) > 0 || (measurement?.failures ?? 0) > 0 || (competitive?.failures ?? 0) > 0;
      return json({
        status: degraded ? "degraded" : readiness.state,
        publication: { pending: result?.pending ?? 0, failed: result?.failed ?? 0 },
        productionCrawler: { recentFailures: crawl?.failures ?? 0, lastObservedAt: crawl?.lastObservedAt ?? null },
        visibilityMeasurement: { recentFailures: measurement?.failures ?? 0, runs: measurement?.runs ?? 0, lastObservedAt: measurement?.lastObservedAt ?? null },
        competitiveIntelligence: { recentFailures: competitive?.failures ?? 0, runs: competitive?.runs ?? 0, activeCompetitors: competitive?.competitors ?? 0, lastObservedAt: competitive?.lastObservedAt ?? null },
        productionReadiness: readiness,
      }, degraded || readiness.state === "invalid" ? 503 : 200, context.requestId);
    },
  });
}

async function readSitemapShardRows(database: D1Database, canonicalPrefix: string, offset: number): Promise<readonly { url: string; lastmod?: string }[]> {
  const rows = await database.all<{ canonicalUrl: string; lastmod: string | null }>(
    `SELECT canonical_url AS canonicalUrl, MAX(generated_at) AS lastmod
       FROM seo_entity_representations
      WHERE indexability='index' AND publication_state='published' AND visibility='public' AND canonical_url LIKE ?
      GROUP BY canonical_url
      ORDER BY canonical_url ASC
      LIMIT ? OFFSET ?`,
    canonicalPrefix + "%", SITEMAP_URL_LIMIT, offset,
  );
  return rows.map((row) => ({ url: row.canonicalUrl, ...(row.lastmod ? { lastmod: row.lastmod } : {}) }));
}


function buildRobotsAiPolicy(environment?: ApiEnv): RobotsAiPolicy {
  if (!environment) return {};
  const boolean = (value: string | undefined): boolean | undefined => {
    if (value === undefined) return undefined;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
    return undefined;
  };
  const delay = Number(environment.SEO_CRAWL_DELAY_SECONDS);
  return {
    ...(boolean(environment.SEO_ALLOW_OAI_SEARCHBOT) !== undefined ? { oaiSearchBot: boolean(environment.SEO_ALLOW_OAI_SEARCHBOT) } : {}),
    ...(boolean(environment.SEO_ALLOW_GPTBOT) !== undefined ? { gptBot: boolean(environment.SEO_ALLOW_GPTBOT) } : {}),
    ...(boolean(environment.SEO_ALLOW_GOOGLE_EXTENDED) !== undefined ? { googleExtended: boolean(environment.SEO_ALLOW_GOOGLE_EXTENDED) } : {}),
    ...(boolean(environment.SEO_ALLOW_CLAUDEBOT) !== undefined ? { claudeBot: boolean(environment.SEO_ALLOW_CLAUDEBOT) } : {}),
    ...(boolean(environment.SEO_ALLOW_PERPLEXITYBOT) !== undefined ? { perplexityBot: boolean(environment.SEO_ALLOW_PERPLEXITYBOT) } : {}),
    ...(Number.isFinite(delay) && delay >= 0 ? { crawlDelaySeconds: delay } : {}),
  };
}

async function recordImportedVisibility(database: D1Database, context: RequestContext, observations: readonly import("@qooqnos/seo").ExternalVisibilityObservation[], providerId: string, dataset: string, requestId: string): Promise<Response> {
  const repository = new SeoObservabilityRepository(database);
  const runId = "seo-import:" + providerId + ":" + crypto.randomUUID();
  const queryText = observations.find((item) => item.queryText)?.queryText ?? dataset;
  const locale = observations[0] ? String(observations[0].provenance.locale ?? "en-US") : "en-US";
  await repository.createMeasurementRun(context, {
    id: runId,
    providerId,
    surface: observations.some((item) => item.surface === "ai-answer") ? "ai-answer" : "search-engine",
    queryText,
    locale,
    ...(observations[0]?.entityId ? { entityId: observations[0].entityId } : {}),
    startedAt: new Date().toISOString(),
    provenance: { provider: providerId, dataset, imported: true },
  });
  const now = new Date().toISOString();
  let count = 0;
  const entityCache = new Map<string, string | undefined>();
  for (const item of observations) {
    const resolvedEntityId = item.entityId ?? (item.pageUrl ? await resolveSeoEntityId(database, context, item.pageUrl, entityCache) : undefined);
    await repository.record(context, {
      id: runId + ":" + crypto.randomUUID(),
      surface: item.surface,
      metric: item.metric,
      ...(resolvedEntityId ? { entityId: resolvedEntityId } : {}),
      queryClass: "external-export",
      ...(item.numericValue !== undefined ? { numericValue: item.numericValue } : {}),
      ...(item.textValue !== undefined ? { textValue: item.textValue } : {}),
      provenance: { ...item.provenance, importedAt: now },
      observedAt: item.observedAt,
    });
    if (item.citationUrl) {
      await repository.recordMeasurementCitation(context, {
        id: runId + ":citation:" + crypto.randomUUID(),
        runId,
        ...(resolvedEntityId ? { entityId: resolvedEntityId } : {}),
        citationUrl: item.citationUrl,
        ...(item.citationTitle ? { citationTitle: item.citationTitle } : {}),
        ...(item.citationPosition !== undefined ? { citationPosition: item.citationPosition } : {}),
        ...(item.citationCount !== undefined ? { citationCount: item.citationCount } : {}),
        sourceType: item.surface === "ai-answer" ? "ai-answer" : "search-engine",
        observedAt: item.observedAt,
        provenance: { ...item.provenance, importedAt: now },
      });
    }
    count += 1;
  }
  await repository.completeMeasurementRun(context, { id: runId, status: "succeeded", completedAt: now, observationCount: count });
  return json({ imported: count, runId, providerId, dataset }, 200, requestId);
}


async function resolveSeoEntityId(database: D1Database, context: RequestContext, pageUrl: string, cache: Map<string, string | undefined>): Promise<string | undefined> {
  if (cache.has(pageUrl)) return cache.get(pageUrl);
  const row = await database.first<{ entityId: string }>(
    `SELECT entity_id AS entityId
       FROM seo_entity_representations
      WHERE organization_id=? AND workspace_id IS ? AND canonical_url=?
      ORDER BY generated_at DESC
      LIMIT 1`,
    context.tenantId, context.workspaceId ?? null, pageUrl,
  );
  const entityId = row?.entityId;
  cache.set(pageUrl, entityId);
  return entityId;
}
