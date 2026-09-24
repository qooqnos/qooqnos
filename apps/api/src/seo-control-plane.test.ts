import { describe, expect, it } from "vitest";
import { evaluateSeoProductionReadiness } from "./seo-production-readiness";

describe("SEO production readiness control plane", () => {
  it("requires HTTPS canonical origin", () => {
    const result = evaluateSeoProductionReadiness({ SEO_CANONICAL_BASE_URL: "http://example.com" });
    expect(result.state).toBe("invalid");
    expect(result.canonical.ready).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });
  it("does not treat unconfigured providers as zero visibility", () => {
    const result = evaluateSeoProductionReadiness({ SEO_CANONICAL_BASE_URL: "https://example.com" });
    expect(result.state).toBe("unconfigured");
    expect(result.providers.searchConsole.ready).toBe(false);
    expect(result.warnings).toEqual([]);
  });
  it("exposes partial provider activation without zero semantics", () => {
    const result = evaluateSeoProductionReadiness({ SEO_CANONICAL_BASE_URL: "https://example.com", SEO_GSC_SITE_URL: "sc-domain:example.com" });
    expect(result.state).toBe("partial");
    expect(result.providers.searchConsole.configured).toBe(true);
    expect(result.providers.searchConsole.ready).toBe(false);
    expect(result.warnings.some((warning) => warning.includes("zero visibility"))).toBe(true);
  });
});
