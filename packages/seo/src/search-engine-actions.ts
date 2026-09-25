export type SearchEngineProvider = "google-search-console" | "bing-webmaster" | "yandex-webmaster";

export type SearchEngineActionAuditEvent = {
  readonly provider: SearchEngineProvider;
  readonly action: string;
  readonly target?: string;
  readonly attempt: number;
  readonly status: "success" | "retry" | "failure";
  readonly httpStatus?: number;
  readonly durationMs: number;
  readonly retryable?: boolean;
  readonly errorCode?: string;
};

export interface SearchEngineActionRuntimeOptions {
  readonly maxAttempts?: number;
  readonly timeoutMs?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly onAudit?: (event: SearchEngineActionAuditEvent) => void | Promise<void>;
}

export interface GoogleSearchConsoleActionsConfig {
  readonly siteUrl: string;
  readonly accessToken?: string;
  readonly serviceAccountEmail?: string;
  readonly serviceAccountPrivateKey?: string;
  readonly fetcher?: typeof fetch;
  readonly runtime?: SearchEngineActionRuntimeOptions;
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
  private cachedServiceToken: { readonly token: string; readonly expiresAtMs: number } | undefined;

  constructor(private readonly config: GoogleSearchConsoleActionsConfig) {}

  async submitSitemap(sitemapUrl: string): Promise<void> {
    const token = await this.accessToken();
    const site = encodeURIComponent(this.config.siteUrl);
    const feed = encodeURIComponent(sitemapUrl);
    const response = await requestWithRetry(
      this.config.fetcher ?? fetch,
      "google-search-console",
      "submit_sitemap",
      sitemapUrl,
      "https://www.googleapis.com/webmasters/v3/sites/" + site + "/sitemaps/" + feed,
      { method: "PUT", headers: { authorization: "Bearer " + token } },
      this.config.runtime,
    );
    if (!response.ok) throw new Error("Google Search Console sitemap submission returned HTTP " + response.status);
  }

  async inspectUrl(url: string, languageCode = "en-US"): Promise<GoogleUrlInspectionResult> {
    const token = await this.accessToken();
    const response = await requestWithRetry(
      this.config.fetcher ?? fetch,
      "google-search-console",
      "inspect_url",
      url,
      "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + token },
        body: JSON.stringify({ inspectionUrl: url, siteUrl: this.config.siteUrl, languageCode }),
      },
      this.config.runtime,
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

  private async accessToken(): Promise<string> {
    if (this.config.accessToken?.trim()) return this.config.accessToken.trim();
    if (!this.config.serviceAccountEmail?.trim() || !this.config.serviceAccountPrivateKey?.trim()) {
      throw new Error("Google Search Console action credentials are not configured.");
    }
    const nowMs = Date.now();
    if (this.cachedServiceToken && this.cachedServiceToken.expiresAtMs > nowMs + 60_000) {
      return this.cachedServiceToken.token;
    }
    const now = Math.floor(nowMs / 1000);
    const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
    const payload = base64UrlJson({
      iss: this.config.serviceAccountEmail,
      scope: "https://www.googleapis.com/auth/webmasters",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    });
    const signingInput = header + "." + payload;
    const key = await crypto.subtle.importKey(
      "pkcs8",
      pemToDer(this.config.serviceAccountPrivateKey),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
    const assertion = signingInput + "." + bytesToBase64Url(new Uint8Array(signature));
    const response = await requestWithRetry(
      this.config.fetcher ?? fetch,
      "google-search-console",
      "oauth_token",
      "https://oauth2.googleapis.com/token",
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }),
      },
      this.config.runtime,
    );
    if (!response.ok) throw new Error("Google OAuth token exchange returned HTTP " + response.status);
    const body = await response.json() as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new Error("Google OAuth token exchange returned no access token.");
    const ttlSeconds = Number.isFinite(body.expires_in) ? Math.max(60, Math.trunc(body.expires_in!)) : 3600;
    this.cachedServiceToken = { token: body.access_token, expiresAtMs: nowMs + ttlSeconds * 1000 };
    return body.access_token;
  }
}

export interface BingWebmasterActionsConfig {
  readonly siteUrl: string;
  readonly apiKey: string;
  readonly accessToken?: string;
  readonly fetcher?: typeof fetch;
  readonly runtime?: SearchEngineActionRuntimeOptions;
}

export class BingWebmasterActions {
  constructor(private readonly config: BingWebmasterActionsConfig) {}

  async submitUrl(url: string): Promise<void> {
    const params = new URLSearchParams();
    if (!this.config.accessToken?.trim() && this.config.apiKey.trim()) params.set("apikey", this.config.apiKey.trim());
    const response = await requestWithRetry(
      this.config.fetcher ?? fetch,
      "bing-webmaster",
      "submit_url",
      url,
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
      this.config.runtime,
    );
    if (!response.ok) throw new Error("Bing Webmaster URL submission returned HTTP " + response.status);
  }
}

export interface YandexWebmasterActionsConfig {
  readonly userId: string;
  readonly hostId: string;
  readonly oauthToken: string;
  readonly fetcher?: typeof fetch;
  readonly runtime?: SearchEngineActionRuntimeOptions;
}

export interface YandexRecrawlResult {
  readonly taskId: string;
  readonly quotaRemainder?: number;
}

export class YandexWebmasterActions {
  constructor(private readonly config: YandexWebmasterActionsConfig) {}

  async requestRecrawl(url: string): Promise<YandexRecrawlResult> {
    const response = await requestWithRetry(
      this.config.fetcher ?? fetch,
      "yandex-webmaster",
      "request_recrawl",
      url,
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
      this.config.runtime,
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
    const response = await requestWithRetry(
      this.config.fetcher ?? fetch,
      "yandex-webmaster",
      "get_indexing_history",
      undefined,
      "https://api.webmaster.yandex.net/v4/user/" + encodeURIComponent(this.config.userId)
        + "/hosts/" + encodeURIComponent(this.config.hostId) + "/indexing/history" + suffix,
      { headers: { accept: "application/json", authorization: "OAuth " + this.config.oauthToken } },
      this.config.runtime,
    );
    if (!response.ok) throw new Error("Yandex Webmaster indexing history returned HTTP " + response.status);
    return response.json();
  }
}

async function requestWithRetry(
  fetcher: typeof fetch,
  provider: SearchEngineProvider,
  action: string,
  target: string | undefined,
  input: RequestInfo | URL,
  init: RequestInit,
  runtime: SearchEngineActionRuntimeOptions | undefined,
): Promise<Response> {
  const maxAttempts = Math.min(Math.max(Math.trunc(runtime?.maxAttempts ?? 3), 1), 5);
  const timeoutMs = Math.min(Math.max(Math.trunc(runtime?.timeoutMs ?? 15000), 1000), 60000);
  const baseDelayMs = Math.min(Math.max(Math.trunc(runtime?.baseDelayMs ?? 500), 0), 10000);
  const maxDelayMs = Math.min(Math.max(Math.trunc(runtime?.maxDelayMs ?? 10000), baseDelayMs), 60000);
  const sleep = runtime?.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const started = Date.now();
    try {
      const response = await fetchWithTimeout(fetcher, input, init, timeoutMs);
      const durationMs = Date.now() - started;
      if (response.ok) {
        await emitAudit(runtime, {
          provider, action, ...(target ? { target } : {}), attempt, status: "success", httpStatus: response.status, durationMs,
        });
        return response;
      }

      const retryable = isRetryableHttpStatus(response.status);
      if (!retryable || attempt >= maxAttempts) {
        await emitAudit(runtime, {
          provider, action, ...(target ? { target } : {}), attempt, status: "failure", httpStatus: response.status,
          durationMs, retryable, errorCode: httpErrorCode(response.status),
        });
        return response;
      }

      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"), Date.now());
      const delayMs = retryAfterMs === undefined
        ? Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1))
        : Math.min(maxDelayMs, retryAfterMs);
      await emitAudit(runtime, {
        provider, action, ...(target ? { target } : {}), attempt, status: "retry", httpStatus: response.status,
        durationMs, retryable: true, errorCode: httpErrorCode(response.status),
      });
      await sleep(delayMs);
    } catch (error) {
      lastError = error;
      const durationMs = Date.now() - started;
      const retryable = attempt < maxAttempts;
      if (!retryable) {
        await emitAudit(runtime, {
          provider, action, ...(target ? { target } : {}), attempt, status: "failure", durationMs,
          retryable: false, errorCode: error instanceof DOMException && error.name === "AbortError" ? "timeout" : "network_error",
        });
        throw error;
      }
      await emitAudit(runtime, {
        provider, action, ...(target ? { target } : {}), attempt, status: "retry", durationMs,
        retryable: true, errorCode: error instanceof DOMException && error.name === "AbortError" ? "timeout" : "network_error",
      });
      const delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await sleep(delayMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Search engine request failed.");
}

async function fetchWithTimeout(fetcher: typeof fetch, input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function httpErrorCode(status: number): string {
  return status === 429 ? "rate_limited" : status >= 500 ? "server_error" : "request_failed";
}

function parseRetryAfterMs(value: string | null, nowMs: number): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.ceil(seconds * 1000), 60000);
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.min(Math.max(date - nowMs, 0), 60000);
}

async function emitAudit(runtime: SearchEngineActionRuntimeOptions | undefined, event: SearchEngineActionAuditEvent): Promise<void> {
  await runtime?.onAudit?.(event);
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
