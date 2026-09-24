import { describe, expect, it, vi } from "vitest";
import {
  BingWebmasterProvider,
  GoogleSearchConsoleProvider,
  ResponsesWebSearchCitationProvider,
} from "./measurement-providers";

const query = {
  id: "q-1",
  queryText: "best phoenix studio",
  locale: "en-US",
  entityId: "biz-1",
  entityType: "Business",
  canonicalUrl: "https://qooqnos.com/en-US/business/phoenix-studio-biz-1",
};

describe("real SEO visibility providers", () => {
  it("parses Google Search Console query/page analytics", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(
      JSON.stringify({
        rows: [{
          keys: [query.queryText, query.canonicalUrl],
          clicks: 12,
          impressions: 120,
          ctr: 0.1,
          position: 4.5,
        }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const provider = new GoogleSearchConsoleProvider({ siteUrl: "https://qooqnos.com/", accessToken: "token", lookbackDays: 7, endLagDays: 3 });
    const observations = await provider.observe(query);
    expect(observations.find((item) => item.metric === "search-impressions")?.numericValue).toBe(120);
    expect(observations.find((item) => item.metric === "search-position")?.numericValue).toBe(4.5);
    fetcher.mockRestore();
  });

  it("parses Bing query+page traffic detail", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(
      JSON.stringify({ d: [{ Clicks: 5, Impressions: 50, Position: 6 }, { Clicks: 3, Impressions: 30, Position: 10 }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const provider = new BingWebmasterProvider({ siteUrl: "https://qooqnos.com/", apiKey: "key" });
    const observations = await provider.observe(query);
    expect(observations.find((item) => item.metric === "search-clicks")?.numericValue).toBe(8);
    expect(observations.find((item) => item.metric === "search-position")?.numericValue).toBe(7.5);
    fetcher.mockRestore();
  });

  it("extracts real AI URL citations and matches the canonical entity", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(
      JSON.stringify({
        model: "gpt-5.5",
        output: [{
          type: "message",
          content: [{
            type: "output_text",
            text: "Phoenix Studio is a business.",
            annotations: [
              { type: "url_citation", url: "https://qooqnos.com/en-US/business/phoenix-studio-biz-1", title: "Phoenix Studio" },
              { type: "url_citation", url: "https://example.com/other", title: "Other source" },
            ],
          }],
        }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const provider = new ResponsesWebSearchCitationProvider({
      endpoint: "https://example.openai.azure.com/openai/v1/",
      apiKey: "key",
      model: "gpt-5.5",
      authMode: "api-key",
    });
    const observations = await provider.observe(query);
    expect(observations.find((item) => item.metric === "ai-source-count")?.numericValue).toBe(2);
    expect(observations.find((item) => item.metric === "ai-citation-present")?.numericValue).toBe(1);
    expect(observations.filter((item) => item.metric === "ai-citation-observed")).toHaveLength(2);
    fetcher.mockRestore();
  });
});
