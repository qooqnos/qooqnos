import { describe, expect, it } from "vitest";
import { evaluateSeoProductionReadiness } from "./seo-production-readiness";

describe("SEO production readiness", () => {
  it("rejects a missing or non-HTTPS canonical origin", () => {
    expect(evaluateSeoProductionReadiness({} as any).state).toBe("invalid");
    expect(evaluateSeoProductionReadiness({ SEO_CANONICAL_BASE_URL: "http://qooqnos.com" } as any).state).toBe("invalid");
  });
  it("distinguishes intentionally unconfigured production", () => {
    const result = evaluateSeoProductionReadiness({ SEO_CANONICAL_BASE_URL: "https://qooqnos.com" } as any);
    expect(result.state).toBe("unconfigured");
    expect(result.blockers).toHaveLength(0);
  });
  it("flags partial provider configuration without producing zero visibility", () => {
    const result = evaluateSeoProductionReadiness({ SEO_CANONICAL_BASE_URL: "https://qooqnos.com", SEO_GSC_SITE_URL: "https://qooqnos.com/" } as any);
    expect(result.state).toBe("partial");
    expect(result.providers.searchConsole.ready).toBe(false);
    expect(result.warnings[0]).toContain("must not be interpreted as zero visibility");
  });
});
