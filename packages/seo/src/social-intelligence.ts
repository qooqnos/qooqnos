export type SocialPlatform = "facebook" | "instagram" | "x" | "pinterest" | "linkedin" | "tiktok" | "reddit";
export interface SocialRuntime { readonly fetcher?: typeof fetch; readonly timeoutMs?: number; readonly accessToken?: string; readonly bearerToken?: string; readonly userAccessToken?: string; readonly version?: string; readonly endpoint?: string; }

export class FacebookPageClient {
  constructor(private readonly config: SocialRuntime & { readonly pageId: string }) {}
  async listFeed(limit = 25): Promise<unknown> {
    const u = new URL("https://graph.facebook.com/v26.0/" + encodeURIComponent(this.config.pageId) + "/feed");
    u.searchParams.set("limit", String(Math.min(Math.max(Math.trunc(limit), 1), 100)));
    u.searchParams.set("fields", "id,message,created_time,permalink_url,from,attachments,comments.summary(true),reactions.summary(true),shares");
    return this.request(u, { headers: { accept: "application/json" } });
  }
  async publish(text: string, link?: string): Promise<unknown> {
    const u = new URL("https://graph.facebook.com/v26.0/" + encodeURIComponent(this.config.pageId) + "/feed");
    const body = new URLSearchParams({ message: text.trim() }); if (link?.trim()) body.set("link", link.trim());
    return this.request(u, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  }
  private async request(input: string | URL, init: RequestInit): Promise<unknown> {
    if (!this.config.accessToken?.trim()) throw new Error("Facebook Page access token is not configured.");
    const u = new URL(input); u.searchParams.set("access_token", this.config.accessToken.trim());
    const r = await requestWithTimeout(this.config.fetcher ?? fetch, u, init, this.config.timeoutMs ?? 15000);
    if (!r.ok) throw new Error("Facebook Graph API returned HTTP " + r.status); return r.json();
  }
}

export class InstagramGraphClient {
  constructor(private readonly config: SocialRuntime & { readonly igUserId: string }) {}
  async listMedia(limit = 25): Promise<unknown> {
    const u = new URL("https://graph.facebook.com/v26.0/" + encodeURIComponent(this.config.igUserId) + "/media");
    u.searchParams.set("limit", String(Math.min(Math.max(Math.trunc(limit), 1), 100)));
    u.searchParams.set("fields", "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count");
    return this.request(u, {});
  }
  async publishImage(imageUrl: string, caption = ""): Promise<unknown> {
    if (!/^https?:\\/\\//i.test(imageUrl)) throw new Error("Instagram publishing requires an HTTP(S) image URL.");
    const container = await this.request("https://graph.facebook.com/v26.0/" + encodeURIComponent(this.config.igUserId) + "/media", { method: "POST", params: { image_url: imageUrl, caption } }) as { id?: string };
    if (!container.id) throw new Error("Instagram media container creation returned no id.");
    return this.request("https://graph.facebook.com/v26.0/" + encodeURIComponent(this.config.igUserId) + "/media_publish", { method: "POST", params: { creation_id: container.id } });
  }
  private async request(input: string | URL, init: RequestInit & { readonly params?: Record<string, string> }): Promise<unknown> {
    if (!this.config.accessToken?.trim()) throw new Error("Instagram access token is not configured.");
    const u = new URL(input); u.searchParams.set("access_token", this.config.accessToken.trim()); for (const [k,v] of Object.entries(init.params ?? {})) u.searchParams.set(k,v);
    const r = await requestWithTimeout(this.config.fetcher ?? fetch, u, init, this.config.timeoutMs ?? 15000);
    if (!r.ok) throw new Error("Instagram Graph API returned HTTP " + r.status); return r.json();
  }
}

export class XApiClient {
  constructor(private readonly config: SocialRuntime & { readonly bearerToken: string }) {}
  async recentSearch(query: string, maxResults = 25): Promise<unknown> {
    const u = new URL("https://api.x.com/2/tweets/search/recent"); u.searchParams.set("query", query.trim());
    u.searchParams.set("max_results", String(Math.min(Math.max(Math.trunc(maxResults), 10), 100)));
    u.searchParams.set("tweet.fields", "created_at,author_id,public_metrics,lang,conversation_id"); u.searchParams.set("expansions", "author_id"); u.searchParams.set("user.fields", "name,username,public_metrics");
    return this.request(u, { headers: { authorization: "Bearer " + this.config.bearerToken } });
  }
  async createPost(text: string): Promise<unknown> {
    if (!this.config.userAccessToken?.trim()) throw new Error("X user access token is not configured.");
    return this.request("https://api.x.com/2/tweets", { method: "POST", headers: { authorization: "Bearer " + this.config.userAccessToken.trim(), "content-type": "application/json" }, body: JSON.stringify({ text: text.trim() }) });
  }
  private async request(input: string | URL, init: RequestInit): Promise<unknown> { const r = await requestWithTimeout(this.config.fetcher ?? fetch, input, init, this.config.timeoutMs ?? 15000); if (!r.ok) throw new Error("X API returned HTTP " + r.status); return r.json(); }
}

export class PinterestClient {
  constructor(private readonly config: SocialRuntime & { readonly accessToken: string }) {}
  async searchPins(query: string, pageSize = 25): Promise<unknown> {
    const u = new URL("https://api.pinterest.com/v5/search/pins"); u.searchParams.set("q", query.trim()); u.searchParams.set("page_size", String(Math.min(Math.max(Math.trunc(pageSize), 1), 250)));
    return this.request(u, {});
  }
  async trends(regionCode: string, trendType = "monthly"): Promise<unknown> { return this.request("https://api.pinterest.com/v5/trends/keywords/" + encodeURIComponent(regionCode) + "/top/" + encodeURIComponent(trendType), {}); }
  async createPin(input: { readonly boardId: string; readonly imageUrl: string; readonly title?: string; readonly description?: string; readonly link?: string }): Promise<unknown> {
    if (!/^https?:\\/\\//i.test(input.imageUrl)) throw new Error("Pinterest imageUrl must be HTTP(S).");
    return this.request("https://api.pinterest.com/v5/pins", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ board_id: input.boardId, title: input.title, description: input.description, link: input.link, media_source: { source_type: "image_url", url: input.imageUrl } }) });
  }
  private async request(input: string | URL, init: RequestInit): Promise<unknown> { const headers = new Headers(init.headers); headers.set("Authorization", "Bearer " + this.config.accessToken.trim()); headers.set("Accept", "application/json"); const r = await requestWithTimeout(this.config.fetcher ?? fetch, input, { ...init, headers }, this.config.timeoutMs ?? 15000); if (!r.ok) throw new Error("Pinterest API returned HTTP " + r.status); return r.json(); }
}

export class LinkedInClient {
  constructor(private readonly config: SocialRuntime & { readonly accessToken: string; readonly version: string }) {}
  async getPost(postId: string): Promise<unknown> { return this.request("https://api.linkedin.com/rest/posts/" + encodeURIComponent(postId), {}); }
  async createOrganizationPost(input: { readonly authorUrn: string; readonly commentary: string; readonly articleUrl?: string; readonly imageUrn?: string }): Promise<unknown> {
    const content = input.articleUrl ? { article: { source: input.articleUrl } } : input.imageUrn ? { media: { id: input.imageUrn } } : undefined;
    const body: Record<string, unknown> = { author: input.authorUrn, commentary: input.commentary, visibility: "PUBLIC", distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false }; if (content) body.content = content;
    return this.request("https://api.linkedin.com/rest/posts", { method: "POST", body: JSON.stringify(body) });
  }
  async organizationShareStatistics(organizationUrn: string): Promise<unknown> { const u = new URL("https://api.linkedin.com/rest/organizationalEntityShareStatistics"); u.searchParams.set("q", "organizationalEntity"); u.searchParams.set("organizationalEntity", organizationUrn); return this.request(u, {}); }
  private async request(input: string | URL, init: RequestInit): Promise<unknown> { const headers = new Headers(init.headers); headers.set("Authorization", "Bearer " + this.config.accessToken.trim()); headers.set("Linkedin-Version", this.config.version); headers.set("X-Restli-Protocol-Version", "2.0.0"); headers.set("Content-Type", headers.get("Content-Type") ?? "application/json"); const r = await requestWithTimeout(this.config.fetcher ?? fetch, input, { ...init, headers }, this.config.timeoutMs ?? 15000); if (!r.ok) throw new Error("LinkedIn API returned HTTP " + r.status); return r.status === 204 ? null : r.json(); }
}

export class TikTokClient {
  constructor(private readonly config: SocialRuntime & { readonly accessToken: string }) {}
  async creatorInfo(): Promise<unknown> { return this.post("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {}); }
  async initializeVideoPost(input: { readonly title?: string; readonly privacyLevel: string; readonly videoUrl: string }): Promise<unknown> {
    if (!/^https?:\\/\\//i.test(input.videoUrl)) throw new Error("TikTok videoUrl must be HTTP(S).");
    return this.post("https://open.tiktokapis.com/v2/post/publish/video/init/", { post_info: { title: input.title ?? "", privacy_level: input.privacyLevel, disable_duet: false, disable_comment: false, disable_stitch: false }, source_info: { source: "PULL_FROM_URL", video_url: input.videoUrl } });
  }
  private async post(url: string, body: unknown): Promise<unknown> { const r = await requestWithTimeout(this.config.fetcher ?? fetch, url, { method: "POST", headers: { Authorization: "Bearer " + this.config.accessToken, "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify(body) }, this.config.timeoutMs ?? 20000); if (!r.ok) throw new Error("TikTok API returned HTTP " + r.status); return r.json(); }
}

export class RedditClient {
  constructor(private readonly config: SocialRuntime) {}
  async searchPosts(query: string, subreddit?: string, limit = 25): Promise<unknown> {
    const base = (this.config.endpoint?.trim() || "https://www.reddit.com").replace(/\/$/, "");
    const path = subreddit ? "/r/" + encodeURIComponent(subreddit) + "/search.json" : "/search.json"; const u = new URL(base + path);
    u.searchParams.set("q", query.trim()); u.searchParams.set("limit", String(Math.min(Math.max(Math.trunc(limit), 1), 100))); u.searchParams.set("sort", "relevance"); u.searchParams.set("restrict_sr", subreddit ? "on" : "off");
    const headers: Record<string,string> = { accept: "application/json", "user-agent": "Phoenix/1.0 Social Intelligence" }; if (this.config.accessToken) headers.authorization = "Bearer " + this.config.accessToken;
    const r = await requestWithTimeout(this.config.fetcher ?? fetch, u, { headers }, this.config.timeoutMs ?? 15000); if (!r.ok) throw new Error("Reddit API returned HTTP " + r.status); return r.json();
  }
}

async function requestWithTimeout(fetcher: typeof fetch, input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), Math.min(Math.max(Math.trunc(timeoutMs), 1000), 60000)); try { return await fetcher(input, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); } }
