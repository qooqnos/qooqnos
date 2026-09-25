import { describe, expect, it } from "vitest";
import { SearchEngineActionGateway } from "./search-engine-gateway";

describe("search engine action gateway", () => {
  it("reports provider capabilities without exposing credentials", () => {
    const gateway = new SearchEngineActionGateway({
      google: { siteUrl: "https://example.com/", accessToken: "secret" },
      bing: { siteUrl: "https://example.com/", apiKey: "secret" },
    });
    expect(gateway.status()).toEqual([
      { provider: "google-search-console", configured: true, capabilities: ["inspect_url", "submit_sitemap"] },
      { provider: "bing-webmaster", configured: true, capabilities: ["submit_url"] },
      { provider: "yandex-webmaster", configured: false, capabilities: ["request_recrawl", "indexing_history"] },
    ]);
  });
});
