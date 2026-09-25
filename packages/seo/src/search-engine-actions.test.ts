import { describe, expect, it } from "vitest";
import { BingWebmasterActions, GoogleSearchConsoleActions, YandexWebmasterActions } from "./search-engine-actions";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("search engine API actions", () => {
  it("submits a sitemap to Google Search Console", async () => {
    const calls: Request[] = [];
    const api = new GoogleSearchConsoleActions({
      siteUrl: "https://example.com/",
      accessToken: "token",
      fetcher: async (input, init) => {
        calls.push(new Request(input, init));
        return response({});
      },
    });
    await api.submitSitemap("https://example.com/sitemap.xml");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("PUT");
    expect(calls[0]!.url).toContain("/webmasters/v3/sites/");
    expect(calls[0]!.url).toContain("sitemaps/");
    expect(calls[0]!.headers.get("authorization")).toBe("Bearer token");
  });

  it("normalizes Google URL Inspection responses", async () => {
    const api = new GoogleSearchConsoleActions({
      siteUrl: "https://example.com/",
      accessToken: "token",
      fetcher: async () => response({
        inspectionResult: {
          indexStatusResult: {
            verdict: "PASS",
            coverageState: "Submitted and indexed",
            indexingState: "INDEXING_ALLOWED",
            lastCrawlTime: "2026-09-25T00:00:00Z",
            pageFetchState: "SUCCESSFUL",
            robotsTxtState: "ALLOWED",
          },
        },
      }),
    });
    const result = await api.inspectUrl("https://example.com/p/1");
    expect(result.verdict).toBe("PASS");
    expect(result.coverageState).toBe("Submitted and indexed");
    expect(result.indexingState).toBe("INDEXING_ALLOWED");
    expect(result.pageFetchState).toBe("SUCCESSFUL");
  });

  it("submits a URL to Bing Webmaster with API-key authentication", async () => {
    let request: Request | undefined;
    const api = new BingWebmasterActions({
      siteUrl: "https://example.com/",
      apiKey: "bing-key",
      fetcher: async (input, init) => {
        request = new Request(input, init);
        return response({ d: null });
      },
    });
    await api.submitUrl("https://example.com/p/1");
    expect(request?.method).toBe("POST");
    expect(request?.url).toContain("SubmitUrl?apikey=bing-key");
    expect(request?.headers.get("content-type")).toBe("application/json");
    expect(await request?.json()).toEqual({ siteUrl: "https://example.com/", url: "https://example.com/p/1" });
  });

  it("requests Yandex recrawl and returns the task", async () => {
    let request: Request | undefined;
    const api = new YandexWebmasterActions({
      userId: "123",
      hostId: "https:example.com:443",
      oauthToken: "ya-token",
      fetcher: async (input, init) => {
        request = new Request(input, init);
        return response({ task_id: "task-1", quota_remainder: 9 });
      },
    });
    const result = await api.requestRecrawl("https://example.com/p/1");
    expect(result).toEqual({ taskId: "task-1", quotaRemainder: 9 });
    expect(request?.url).toContain("/v4/user/123/hosts/https%3Aexample.com%3A443/recrawl/queue");
    expect(request?.headers.get("authorization")).toBe("OAuth ya-token");
  });

  it("retries transient provider failures and records an audit trail", async () => {
    const calls: Request[] = [];
    const audits: Array<{ status: string; attempt: number; httpStatus?: number }> = [];
    const delays: number[] = [];
    let count = 0;
    const api = new BingWebmasterActions({
      siteUrl: "https://example.com/",
      apiKey: "bing-key",
      runtime: {
        maxAttempts: 3,
        baseDelayMs: 25,
        maxDelayMs: 100,
        sleep: async (milliseconds) => { delays.push(milliseconds); },
        onAudit: (event) => { audits.push({ status: event.status, attempt: event.attempt, ...(event.httpStatus ? { httpStatus: event.httpStatus } : {}) }); },
      },
      fetcher: async (input, init) => {
        calls.push(new Request(input, init));
        count += 1;
        return count === 1
          ? response({ message: "busy" }, 429)
          : response({ d: null });
      },
    });

    await api.submitUrl("https://example.com/p/1");

    expect(calls).toHaveLength(2);
    expect(delays).toEqual([25]);
    expect(audits).toEqual([
      { status: "retry", attempt: 1, httpStatus: 429 },
      { status: "success", attempt: 2, httpStatus: 200 },
    ]);
  });

  it("honors Retry-After on transient responses without retrying permanent 4xx errors", async () => {
    const delays: number[] = [];
    let count = 0;
    const api = new BingWebmasterActions({
      siteUrl: "https://example.com/",
      apiKey: "bing-key",
      runtime: {
        maxAttempts: 3,
        baseDelayMs: 1,
        maxDelayMs: 5000,
        sleep: async (milliseconds) => { delays.push(milliseconds); },
      },
      fetcher: async () => {
        count += 1;
        return count === 1
          ? new Response(JSON.stringify({ error: "busy" }), { status: 429, headers: { "retry-after": "7" } })
          : response({}, 400);
      },
    });

    await expect(api.submitUrl("https://example.com/p/2")).rejects.toThrow("Bing Webmaster URL submission returned HTTP 400");
    expect(count).toBe(2);
    expect(delays).toEqual([5000]);
  });

});
