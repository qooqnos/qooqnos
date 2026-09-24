import { describe, expect, it } from "vitest";
import { evaluateSeoProductionReadiness } from "./seo-production-readiness";

describe("SEO production readiness provider matrix", () => {
  const base = { SEO_CANONICAL_BASE_URL: "https://qooqnos.com" } as any;
  it("accepts Search Console access-token activation", () => {
    const r = evaluateSeoProductionReadiness({ ...base, SEO_GSC_SITE_URL: "https://qooqnos.com/", SEO_GSC_ACCESS_TOKEN: "token" });
    expect(r.providers.searchConsole.ready).toBe(true);
    expect(r.providers.searchConsole.state).toBe("ready");
  });
  it("accepts service-account activation", () => {
    const r = evaluateSeoProductionReadiness({ ...base, SEO_GSC_SITE_URL: "https://qooqnos.com/", SEO_GSC_SERVICE_ACCOUNT_EMAIL: "seo@example.com", SEO_GSC_SERVICE_ACCOUNT_PRIVATE_KEY: "key" });
    expect(r.providers.searchConsole.ready).toBe(true);
  });
  it("requires the complete competitive-intelligence activation tuple", () => {
    const r = evaluateSeoProductionReadiness({ ...base, SEO_COMPETITIVE_LOGIN: "login", SEO_COMPETITIVE_PASSWORD: "password", SEO_COMPETITIVE_LOCATION_CODE: "2840" });
    expect(r.providers.competitiveIntelligence.ready).toBe(false);
    expect(r.state).toBe("partial");
  });
  it("accepts complete competitive-intelligence activation", () => {
    const r = evaluateSeoProductionReadiness({ ...base, SEO_COMPETITIVE_LOGIN: "login", SEO_COMPETITIVE_PASSWORD: "password", SEO_COMPETITIVE_LOCATION_CODE: "2840", SEO_COMPETITIVE_LANGUAGE_CODE: "en" });
    expect(r.providers.competitiveIntelligence.ready).toBe(true);
  });
});
