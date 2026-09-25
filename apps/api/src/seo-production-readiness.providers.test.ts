import type { ApiEnv } from "./env";
import { describe, expect, it } from "vitest";
import { evaluateSeoProductionReadiness } from "./seo-production-readiness";

const env = (values: Partial<ApiEnv>): ApiEnv => values as ApiEnv;

describe("SEO production readiness provider matrix", () => {
  const base = { SEO_CANONICAL_BASE_URL: "https://qooqnos.com" };
  it("accepts Search Console access-token activation", () => {
    const r = evaluateSeoProductionReadiness(env({ ...base, SEO_GSC_SITE_URL: "https://qooqnos.com/", SEO_GSC_ACCESS_TOKEN: "token" }));
    expect(r.providers.searchConsole.ready).toBe(true);
  });
  it("accepts service-account activation", () => {
    const r = evaluateSeoProductionReadiness(env({ ...base, SEO_GSC_SITE_URL: "https://qooqnos.com/", SEO_GSC_SERVICE_ACCOUNT_EMAIL: "seo@example.com", SEO_GSC_PRIVATE_KEY: "key" }));
    expect(r.providers.searchConsole.ready).toBe(true);
  });
  it("accepts Bing Webmaster API-key activation", () => {
    const r = evaluateSeoProductionReadiness(env({ ...base, SEO_BING_SITE_URL: "https://qooqnos.com/", SEO_BING_API_KEY: "key" }));
    expect(r.providers.bing.ready).toBe(true);
  });
  it("accepts Yandex Webmaster activation", () => {
    const r = evaluateSeoProductionReadiness(env({ ...base, SEO_YANDEX_USER_ID: "1", SEO_YANDEX_HOST_ID: "https:qooqnos.com:443", SEO_YANDEX_OAUTH_TOKEN: "token" }));
    expect(r.providers.yandex.ready).toBe(true);
  });
  it("accepts IndexNow activation", () => {
    const r = evaluateSeoProductionReadiness(env({ ...base, SEO_INDEXNOW_KEY: "0123456789abcdef" }));
    expect(r.providers.indexNow.ready).toBe(true);
  });
  it("accepts search intelligence through the shared DataForSEO credentials", () => {
    const r = evaluateSeoProductionReadiness(env({ ...base, SEO_SEARCH_INTELLIGENCE_LOGIN: "login", SEO_SEARCH_INTELLIGENCE_PASSWORD: "password" }));
    expect(r.providers.searchIntelligence.ready).toBe(true);
  });
  it("accepts Google Places activation", () => {
    const r = evaluateSeoProductionReadiness(env({ ...base, SEO_GOOGLE_PLACES_API_KEY: "key" }));
    expect(r.providers.googlePlaces.ready).toBe(true);
    expect(r.providers.googleRoutes.ready).toBe(true);
  });
  it("accepts YouTube activation", () => {
    const r = evaluateSeoProductionReadiness(env({ ...base, SEO_YOUTUBE_API_KEY: "key" }));
    expect(r.providers.youtube.ready).toBe(true);
  });
  it("requires the complete competitive-intelligence activation tuple", () => {
    const r = evaluateSeoProductionReadiness(env({ ...base, SEO_COMPETITIVE_LOGIN: "login", SEO_COMPETITIVE_PASSWORD: "password", SEO_COMPETITIVE_LOCATION_CODE: "2840" }));
    expect(r.providers.competitive.ready).toBe(false);
    expect(r.state).toBe("partial");
  });
  it("accepts complete competitive-intelligence activation", () => {
    const r = evaluateSeoProductionReadiness(env({ ...base, SEO_COMPETITIVE_LOGIN: "login", SEO_COMPETITIVE_PASSWORD: "password", SEO_COMPETITIVE_LOCATION_CODE: "2840", SEO_COMPETITIVE_LANGUAGE_CODE: "en" }));
    expect(r.providers.competitive.ready).toBe(true);
  });
});
