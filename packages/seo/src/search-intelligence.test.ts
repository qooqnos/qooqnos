import { describe, expect, it } from "vitest";
import {
  DataForSeoSearchIntelligenceClient,
  GooglePlacesClient,
  YouTubeSearchClient,
  searchIntelligenceVerticals,
} from "./search-intelligence";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("search intelligence", () => {
  it("exposes the core non-SerpApi search verticals", () => {
    expect(searchIntelligenceVerticals()).toEqual(expect.arrayContaining([
      "google-organic",
      "google-ai-mode",
      "google-maps",
      "google-local",
      "google-news",
      "google-images",
      "google-jobs",
      "google-autocomplete",
      "google-shopping",
      "google-ads-search",
      "google-ads-advertisers",
      "bing-organic",
      "bing-images",
      "bing-videos",
      "yandex-organic",
      "youtube-organic",
      "amazon-products",
    ]));
  });

  it("queries DataForSEO Google AI Mode through the provider boundary", async () => {
    let request: Request | undefined;
    const client = new DataForSeoSearchIntelligenceClient({
      login: "login",
      password: "password",
      fetcher: async (input, init) => {
        request = new Request(input, init);
        return jsonResponse({
          tasks: [{
            status_code: 20000,
            result: [{
              keyword: "best cafe",
              datetime: "2026-09-25 00:00:00 +00:00",
              location_code: 2840,
              language_code: "en",
              items: [{ type: "ai_mode", title: "Answer", url: "https://example.com" }],
            }],
          }],
        });
      },
    });

    const result = await client.search({
      vertical: "google-ai-mode",
      keyword: "best cafe",
      locationCode: 2840,
      languageCode: "en",
    });

    expect(request?.url).toContain("/v3/serp/google/ai_mode/live/advanced");
    expect(await request?.json()).toEqual([{
      keyword: "best cafe",
      location_code: 2840,
      language_code: "en",
    }]);
    expect(result.items[0]?.type).toBe("ai_mode");
  });

  it("uses the official Google Places autocomplete contract", async () => {
    let request: Request | undefined;
    const client = new GooglePlacesClient({
      apiKey: "places-key",
      fetcher: async (input, init) => {
        request = new Request(input, init);
        return jsonResponse({ suggestions: [] });
      },
    });
    await client.autocomplete({
      input: "cafe",
      regionCode: "US",
      includeQueryPredictions: true,
      sessionToken: "session-1",
    });
    expect(request?.url).toContain("/v1/places:autocomplete");
    expect(request?.headers.get("x-goog-api-key")).toBe("places-key");
    expect(request?.headers.get("x-goog-fieldmask")).toContain("suggestions.placePrediction.placeId");
    expect(await request?.json()).toMatchObject({
      input: "cafe",
      regionCode: "US",
      includeQueryPredictions: true,
      sessionToken: "session-1",
    });
  });

  it("uses the official YouTube search endpoint", async () => {
    let request: Request | undefined;
    const client = new YouTubeSearchClient({
      apiKey: "yt-key",
      fetcher: async (input, init) => {
        request = new Request(input, init);
        return jsonResponse({ items: [] });
      },
    });
    await client.search("phoenix marketplace", { type: "video", regionCode: "US" });
    expect(request?.url).toContain("https://www.googleapis.com/youtube/v3/search?");
    expect(request?.url).toContain("q=phoenix+marketplace");
    expect(request?.url).toContain("type=video");
    expect(request?.url).toContain("regionCode=US");
  });
});
