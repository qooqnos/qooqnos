import { describe, expect, it, vi } from "vitest";
import { DataForSeoGoogleCompetitiveProvider } from "./competitive-provider";

describe("competitive SERP provider", () => {
  it("extracts organic ranks and AI reference URLs from an advanced SERP response", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(
      JSON.stringify({
        status_code: 20000,
        tasks: [{
          status_code: 20000,
          status_message: "Ok.",
          result: [{
            keyword: "best phoenix studio",
            datetime: "2026-09-25 03:17:00 +00:00",
            check_url: "https://www.google.com/search?q=best+phoenix+studio",
            location_code: 1025287,
            language_code: "en",
            items: [
              {
                type: "organic",
                rank_group: 1,
                rank_absolute: 1,
                domain: "qooqnos.com",
                url: "https://qooqnos.com/en-US/business/phoenix-studio",
                title: "Phoenix Studio",
                description: "Phoenix description",
              },
              {
                type: "organic",
                rank_group: 2,
                rank_absolute: 2,
                domain: "competitor.com",
                url: "https://competitor.com/studio",
                title: "Competitor Studio",
                description: "Competitor description",
              },
              {
                type: "ai_overview",
                items: [{
                  type: "ai_overview_reference",
                  references: [{
                    type: "ai_overview_reference",
                    domain: "competitor.com",
                    url: "https://competitor.com/studio",
                    title: "Competitor Studio",
                  }],
                }],
              },
            ],
          }],
        }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const provider = new DataForSeoGoogleCompetitiveProvider({ login: "login", password: "password" });
    const result = await provider.observe({
      queryText: "best phoenix studio",
      locale: "en-US",
      locationCode: 1025287,
      languageCode: "en",
      depth: 20,
    });
    expect(result.results.some((item) => item.domain === "competitor.com" && item.rankAbsolute === 2)).toBe(true);
    expect(result.aiCitations.some((item) => item.url === "https://competitor.com/studio")).toBe(true);
    fetcher.mockRestore();
  });
});
