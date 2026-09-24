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
  it("parses provider-observed competitor-only keyword gaps", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(
      JSON.stringify({
        status_code: 20000,
        tasks: [{
          status_code: 20000,
          result: [{
            target1: "competitor.com",
            target2: "qooqnos.com",
            location_code: 1025287,
            language_code: "en",
            items: [{
              keyword_data: {
                keyword: "best phoenix studio",
                keyword_info: { search_volume: 900, cpc: 2.5 },
              },
              first_domain_serp_element: { type: "organic", rank_absolute: 3, url: "https://competitor.com/studio" },
            }],
          }],
        }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const provider = new DataForSeoGoogleCompetitiveProvider({ login: "login", password: "password" });
    const gaps = await provider.observeKeywordGaps("competitor.com", "qooqnos.com", {
      locationCode: 1025287,
      languageCode: "en",
      limit: 10,
    });
    expect(gaps[0]?.keyword).toBe("best phoenix studio");
    expect(gaps[0]?.searchVolume).toBe(900);
    expect(gaps[0]?.competitorRank).toBe(3);
    expect(gaps[0]?.gapType).toBe("competitor-only");
    fetcher.mockRestore();
  });

  it("parses provider-observed backlink gaps", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(
      JSON.stringify({
        status_code: 20000,
        tasks: [{
          status_code: 20000,
          result: [{
            items: [{
              domain_intersection: {
                "1": { target: "referrer.com", backlinks: 40, rank: 75 },
              },
              summary: { intersections_count: 1 },
            }],
          }],
        }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const provider = new DataForSeoGoogleCompetitiveProvider({ login: "login", password: "password" });
    const gaps = await provider.observeLinkGaps("competitor.com", "qooqnos.com", 10);
    expect(gaps[0]?.referringDomain).toBe("referrer.com");
    expect(gaps[0]?.competitorBacklinks).toBe(40);
    expect(gaps[0]?.competitorDomainRank).toBe(75);
    fetcher.mockRestore();
  });

  it("parses page-level competitor SEO evidence from Instant Pages", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(
      JSON.stringify({
        status_code: 20000,
        tasks: [{
          status_code: 20000,
          result: [{
            items: [{
              type: "html_page",
              status_code: 200,
              url: "https://competitor.com/studio",
              meta: {
                title: "Competitor Studio",
                description: "Competitor description",
                canonical: "https://competitor.com/studio",
                htags: { h1: ["Competitor Studio"] },
                internal_links_count: 18,
                external_links_count: 4,
                images_count: 12,
                title_length: 19,
                description_length: 23,
                content: { plain_text_word_count: 640 },
              },
              checks: {
                no_h1_tag: false,
                no_title: false,
                no_description: false,
                seo_friendly_url: true,
              },
            }],
          }],
        }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const provider = new DataForSeoGoogleCompetitiveProvider({ login: "login", password: "password" });
    const snapshots = await provider.observePages(["https://competitor.com/studio"], "en-US");
    expect(snapshots[0]?.h1Count).toBe(1);
    expect(snapshots[0]?.wordCount).toBe(640);
    expect(snapshots[0]?.internalLinksCount).toBe(18);
    fetcher.mockRestore();
  });
});
