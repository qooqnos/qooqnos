export interface GoogleSearchConsoleActionsConfig {
  readonly siteUrl: string;
  readonly accessToken?: string;
  readonly serviceAccountEmail?: string;
  readonly serviceAccountPrivateKey?: string;
  readonly fetcher?: typeof fetch;
}

export interface GoogleUrlInspectionResult {
  readonly inspectionUrl: string;
  readonly verdict?: string;
  readonly coverageState?: string;
  readonly indexingState?: string;
  readonly lastCrawlTime?: string;
  readonly pageFetchState?: string;
  readonly robotsTxtState?: string;
  readonly raw: unknown;
}

export class GoogleSearchConsoleActions {
  constructor(private readonly config: GoogleSearchConsoleActionsConfig) {}

  async submitSitemap(sitemapUrl: string): Promise<void> {
    const token = await googleActionAccessToken(this.config);
    const site = encodeURIComponent(this.config.siteUrl);
    const feed = encodeURIComponent(sitemapUrl);
    const response = await (this.config.fetcher ?? fetch)(
      "https://www.googleapis.com/webmasters/v3/sites/" + site + "/sitemaps/" + feed,
      { method: "PUT", headers: { authorization: "Bearer " + token } },
    );
    if (!response.ok) throw new Error("Google Search Console sitemap submission returned HTTP " + response.status);
  }

  async inspectUrl(url: string, languageCode = "en-US"): Promise<GoogleUrlInspectionResult> {
    const token = await googleActionAccessToken(this.config);
    const response = await (this.config.fetcher ?? fetch)(
      "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + token },
        body: JSON.stringify({ inspectionUrl: url, siteUrl: this.config.siteUrl, languageCode }),
      },
    );
    if (!response.ok) throw new Error("Google URL Inspection returned HTTP " + response.status);
    const raw = await response.json() as Record<string, unknown>;
    const result = (raw.inspectionResult ?? {}) as Record<string, unknown>;
    const indexStatus = (result.indexStatusResult ?? {}) as Record<string, unknown>;
    return {
      inspectionUrl: url,
      ...(typeof indexStatus.verdict === "string" ? { verdict: indexStatus.verdict } : {}),
      ...(typeof indexStatus.coverageState === "string" ? { coverageState: indexStatus.coverageState } : {}),
      ...(typeof indexStatus.indexingState === "string" ? { indexingState: indexStatus.indexingState } : {}),
      ...(typeof indexStatus.lastCrawlTime === "string" ? { lastCrawlTime: indexStatus.lastCrawlTime } : {}),
      ...(typeof indexStatus.pageFetchState === "string" ? { pageFetchState: indexStatus.pageFetchState } : {}),
      ...(typeof indexStatus.robotsTxtState === "string" ? { robotsTxtState: indexStatus.robotsTxtState } : {}),
      raw,
    };
  }
}

export interface BingWebmasterActionsConfig {
  readonly siteUrl: string;
  readonly apiKey: string;
  readonly accessToken?: string;
  readonly fetcher?: typeof fetch;
}

export class BingWebmasterActions {
  constructor(private readonly config: BingWebmasterActionsConfig) {}

  async submitUrl(url: string): Promise<void> {
    const params = new URLSearchParams();
    if (this.config.apiKey.trim()) params.set("apikey", this.config.apiKey.trim());
    const response = await (this.config.fetcher ?? fetch)(
      "https://www.bing.com/webmaster/api.svc/json/SubmitUrl" + (params.toString() ? "?" + params : ""),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(this.config.accessToken?.trim() ? { authorization: "Bearer " + this.config.accessToken.trim() } : {}),
        },
        body: JSON.stringify({ siteUrl: this.config.siteUrl, url }),
      },
    );
    if (!response.ok) throw new Error("Bing Webmaster URL submission returned HTTP " + response.status);
  }
}

export interface YandexWebmasterActionsConfig {
  readonly userId: string;
  readonly hostId: string;
  readonly oauthToken: string;
  readonly fetcher?: typeof fetch;
}

export interface YandexRecrawlResult {
  readonly taskId: string;
  readonly quotaRemainder?: number;
}

export class YandexWebmasterActions {
  constructor(private readonly config: YandexWebmasterActionsConfig) {}

  async requestRecrawl(url: string): Promise<YandexRecrawlResult> {
    const response = await (this.config.fetcher ?? fetch)(
      "https://api.webmaster.yandex.net/v4/user/" + encodeURIComponent(this.config.userId)
        + "/hosts/" + encodeURIComponent(this.config.hostId) + "/recrawl/queue",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: "OAuth " + this.config.oauthToken,
        },
        body: JSON.stringify({ url }),
      },
    );
    if (!response.ok) throw new Error("Yandex Webmaster recrawl request returned HTTP " + response.status);
    const body = await response.json() as { task_id?: string; quota_remainder?: number };
    if (!body.task_id) throw new Error("Yandex Webmaster recrawl response did not contain a task id.");
    return {
      taskId: body.task_id,
      ...(typeof body.quota_remainder === "number" ? { quotaRemainder: body.quota_remainder } : {}),
    };
  }

  async getIndexingHistory(dateFrom?: string, dateTo?: string): Promise<unknown> {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const suffix = params.toString() ? "?" + params : "";
    const response = await (this.config.fetcher ?? fetch)(
      "https://api.webmaster.yandex.net/v4/user/" + encodeURIComponent(this.config.userId)
        + "/hosts/" + encodeURIComponent(this.config.hostId) + "/indexing/history" + suffix,
      { headers: { accept: "application/json", authorization: "OAuth " + this.config.oauthToken } },
    );
    if (!response.ok) throw new Error("Yandex Webmaster indexing history returned HTTP " + response.status);
    return response.json();
  }
}

async function googleActionAccessToken(config: GoogleSearchConsoleActionsConfig): Promise<string> {
  if (config.accessToken?.trim()) return config.accessToken.trim();
  if (!config.serviceAccountEmail?.trim() || !config.serviceAccountPrivateKey?.trim()) {
    throw new Error("Google Search Console action credentials are not configured.");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlJson({
    iss: config.serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/webmasters",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });
  const signingInput = header + "." + payload;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(config.serviceAccountPrivateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const assertion = signingInput + "." + bytesToBase64Url(new Uint8Array(signature));
  const response = await (config.fetcher ?? fetch)(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    },
  );
  if (!response.ok) throw new Error("Google OAuth token exchange returned HTTP " + response.status);
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error("Google OAuth token exchange returned no access token.");
  return body.access_token;
}

function base64UrlJson(value: Record<string, unknown>): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function bytesToBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToDer(value: string): ArrayBuffer {
  const normalized = value.replace(/\\n/g, "\n");
  const base64 = normalized.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}
