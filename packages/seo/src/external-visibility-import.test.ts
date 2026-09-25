import { describe, expect, it } from "vitest";
import { parseBingAiPerformanceExport, parseGoogleSearchConsoleExport } from "./external-visibility-import";

describe("external visibility export imports", () => {
  it("ingests Google's multimodal Search Console export metrics", () => {
    const rows = parseGoogleSearchConsoleExport(
      "Date,Page,Clicks,Impressions,CTR,Position\n2026-09-24,https://qooqnos.com/en-US/product/p1,12,1000,1.2%,4.5",
      { report: "multimodal", locale: "en-US" },
    );
    expect(rows.find((item) => item.metric === "search-multimodal-clicks")?.numericValue).toBe(12);
    expect(rows.find((item) => item.metric === "search-multimodal-impressions")?.numericValue).toBe(1000);
    expect(rows.find((item) => item.metric === "search-multimodal-ctr")?.numericValue).toBeCloseTo(0.012);
    expect(rows.find((item) => item.metric === "search-multimodal-position")?.numericValue).toBe(4.5);
  });

  it("ingests Bing AI Performance page exports and citation counts", () => {
    const rows = parseBingAiPerformanceExport(
      "Date,Page,Title,Citations,Citation Share\n2026-09-24,https://qooqnos.com/en-US/product/p1,Product One,7,12%",
      { dataset: "pages", locale: "en-US" },
    );
    expect(rows.find((item) => item.metric === "bing-ai-page-citations")?.numericValue).toBe(7);
    expect(rows.find((item) => item.metric === "bing-ai-citation-share")?.numericValue).toBeCloseTo(0.12);
    expect(rows.find((item) => item.metric === "bing-ai-citation-observed")?.citationUrl).toBe("https://qooqnos.com/en-US/product/p1");
  });
});
