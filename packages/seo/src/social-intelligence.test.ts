import { describe, expect, it } from "vitest";
import { FacebookPageClient, InstagramGraphClient, XApiClient, PinterestClient, LinkedInClient, TikTokClient, RedditClient } from "./social-intelligence";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("social intelligence providers", () => {
  it("reads and publishes Facebook Page feed", async () => {
    const calls: Request[] = [];
    const client = new FacebookPageClient({ pageId: "123", accessToken: "token", fetcher: async (input, init) => { calls.push(new Request(input, init)); return response({ data: [] }); } });
    await client.listFeed();
    await client.publish("hello", "https://qooqnos.com");
    expect(calls[0]?.url).toContain("/v26.0/123/feed");
    expect(calls[1]?.url).toContain("access_token=token");
  });

  it("publishes an Instagram image through the container flow", async () => {
    let step = 0;
    const client = new InstagramGraphClient({ igUserId: "ig-1", accessToken: "token", fetcher: async () => { step += 1; return step === 1 ? response({ id: "container-1" }) : response({ id: "media-1" }); } });
    const result = await client.publishImage("https://qooqnos.com/image.jpg", "caption");
    expect(result).toEqual({ id: "media-1" });
  });

  it("uses X recent-search and post endpoints", async () => {
    const urls: string[] = [];
    const client = new XApiClient({ bearerToken: "bearer", userAccessToken: "user", fetcher: async (input, init) => { urls.push(new Request(input, init).url); return response({ data: [] }); } });
    await client.recentSearch("phoenix");
    await client.createPost("hello");
    expect(urls[0]).toContain("/2/tweets/search/recent");
    expect(urls[1]).toContain("/2/tweets");
  });

  it("uses Pinterest search, trends and create-pin endpoints", async () => {
    const urls: string[] = [];
    const client = new PinterestClient({ accessToken: "token", fetcher: async (input, init) => { urls.push(new Request(input, init).url); return response({}); } });
    await client.searchPins("coffee");
    await client.trends("US");
    await client.createPin({ boardId: "b1", imageUrl: "https://qooqnos.com/p.jpg" });
    expect(urls.some((url) => url.includes("/v5/search/pins"))).toBe(true);
    expect(urls.some((url) => url.includes("/v5/trends/keywords/US/top/monthly"))).toBe(true);
    expect(urls.some((url) => url.includes("/v5/pins"))).toBe(true);
  });

  it("uses LinkedIn Posts and organization statistics", async () => {
    const urls: string[] = [];
    const client = new LinkedInClient({ accessToken: "token", version: "202608", fetcher: async (input, init) => { urls.push(new Request(input, init).url); return response({}); } });
    await client.createOrganizationPost({ authorUrn: "urn:li:organization:1", commentary: "hello" });
    await client.organizationShareStatistics("urn:li:organization:1");
    expect(urls[0]).toContain("/rest/posts");
    expect(urls[1]).toContain("/rest/organizationalEntityShareStatistics");
  });

  it("uses TikTok creator and publish APIs", async () => {
    const urls: string[] = [];
    const client = new TikTokClient({ accessToken: "token", fetcher: async (input, init) => { urls.push(new Request(input, init).url); return response({ data: {} }); } });
    await client.creatorInfo();
    await client.initializeVideoPost({ videoUrl: "https://qooqnos.com/video.mp4", privacyLevel: "SELF_ONLY" });
    await client.initializePhotoPost({ imageUrls: ["https://qooqnos.com/image.jpg"], privacyLevel: "SELF_ONLY" });
    await client.getPostStatus("publish-1");
    expect(urls[0]).toContain("/v2/post/publish/creator_info/query/");
    expect(urls[1]).toContain("/v2/post/publish/video/init/");
    expect(urls[2]).toContain("/v2/post/publish/content/init/");
    expect(urls[3]).toContain("/v2/post/publish/status/fetch/");
  });

  it("uses Reddit search with bounded limits", async () => {
    let url = "";
    const client = new RedditClient({ fetcher: async (input, init) => { url = new Request(input, init).url; return response({ data: { children: [] } }); } });
    await client.searchPosts("phoenix", "technology", 25);
    expect(url).toContain("/r/technology/search.json");
    expect(url).toContain("limit=25");
  });
});
