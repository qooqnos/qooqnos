import type { SeoMeasurementQuery } from "./measurement";

export interface SeoVisibilityMeasurement {
  readonly metric: string;
  readonly numericValue?: number;
  readonly textValue?: string;
  readonly entityId?: string;
  readonly citationUrl?: string;
  readonly citationTitle?: string;
  readonly citationPosition?: number;
  readonly sourceType: "search-engine" | "ai-answer";
  readonly provenance: Record<string, unknown>;
}

export interface SeoMeasurementProvider {
  readonly id: string;
  readonly surface: "search-engine" | "ai-answer";
  observe(query: SeoMeasurementQuery): Promise<readonly SeoVisibilityMeasurement[]>;
}

export interface GoogleSearchConsoleConfig {
  readonly siteUrl: string;
  readonly accessToken?: string;
  readonly serviceAccountEmail?: string;
  readonly serviceAccountPrivateKey?: string;
  readonly lookbackDays?: number;
  readonly endLagDays?: number;
}

export class GoogleSearchConsoleProvider implements SeoMeasurementProvider {
  readonly id = "google-search-console";
  readonly surface = "search-engine" as const;

  constructor(private readonly config: GoogleSearchConsoleConfig) {}

  async observe(query: SeoMeasurementQuery): Promise<readonly SeoVisibilityMeasurement[]> {
    const end = utcDateOffset(-(this.config.endLagDays ?? 3));
    const start = utcDateOffset(-(this.config.lookbackDays ?? 7) - (this.config.endLagDays ?? 3));
    const filters: Record<string, string>[] = [
      { dimension: "query", operator: "equals", expression: query.queryText },
    ];
    if (query.canonicalUrl) filters.push({ dimension: "page", operator: "equals", expression: query.canonicalUrl });
    const accessToken = await googleAccessToken(this.config);
    const response = await fetch(
      "https://www.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(this.config.siteUrl) + "/searchAnalytics/query",
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + accessToken },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          dimensions: ["query", "page"],
          dimensionFilterGroups: [{ filters }],
          type: "web",
          dataState: "final",
          rowLimit: 25000,
        }),
      },
    );
    if (!response.ok) throw new Error("Google Search Console returned HTTP " + response.status);
    const payload = await response.json() as { rows?: readonly { keys?: readonly string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[] };
    const measurements: SeoVisibilityMeasurement[] = [];
    for (const row of payload.rows ?? []) {
      const page = row.keys?.[1] ?? undefined;
      const provenance = { provider: this.id, siteUrl: this.config.siteUrl, startDate: start, endDate: end, query: query.queryText, page: page ?? null, source: "Search Console Search Analytics" };
      if (row.impressions !== undefined) measurements.push({ metric: "search-impressions", numericValue: row.impressions, ...(query.entityId ? { entityId: query.entityId } : {}), sourceType: "search-engine", provenance });
      if (row.clicks !== undefined) measurements.push({ metric: "search-clicks", numericValue: row.clicks, ...(query.entityId ? { entityId: query.entityId } : {}), sourceType: "search-engine", provenance });
      if (row.ctr !== undefined) measurements.push({ metric: "search-ctr", numericValue: row.ctr, ...(query.entityId ? { entityId: query.entityId } : {}), sourceType: "search-engine", provenance });
      if (row.position !== undefined) measurements.push({ metric: "search-position", numericValue: row.position, ...(query.entityId ? { entityId: query.entityId } : {}), sourceType: "search-engine", provenance });
      if (page && measurements.length) {
        measurements.push({ metric: "search-page-observed", textValue: page, ...(query.entityId ? { entityId: query.entityId } : {}), sourceType: "search-engine", provenance });
      }
    }
    return measurements;
  }
}

export interface BingWebmasterConfig {
  readonly siteUrl: string;
  readonly apiKey: string;
}

// Bing JSON/HTTP endpoint. Do not migrate this to the retired SOAP/POX protocol.
export class BingWebmasterProvider implements SeoMeasurementProvider {
  readonly id = "bing-webmaster";
  readonly surface = "search-engine" as const;

  constructor(private readonly config: BingWebmasterConfig) {}

  async observe(query: SeoMeasurementQuery): Promise<readonly SeoVisibilityMeasurement[]> {
    const hasPageTarget = Boolean(query.canonicalUrl);
    const method = hasPageTarget ? "GetQueryPageDetailStats" : "GetQueryTrafficStats";
    const params = new URLSearchParams({ siteUrl: this.config.siteUrl, query: query.queryText, apikey: this.config.apiKey });
    if (query.canonicalUrl) params.set("page", query.canonicalUrl);
    const response = await fetch("https://ssl.bing.com/webmaster/api.svc/json/" + method + "?" + params.toString(), {
      method: "GET",
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error("Bing Webmaster returned HTTP " + response.status);
    const payload = await response.json() as { d?: readonly Record<string, unknown>[] };
    const rows = payload.d ?? [];
    const provenanceBase = { provider: this.id, siteUrl: this.config.siteUrl, query: query.queryText, source: "Bing Webmaster API", endpoint: method };
    let clicks = 0;
    let impressions = 0;
    let weightedPosition = 0;
    for (const row of rows) {
      const rowClicks = finiteNumber(row.Clicks);
      const rowImpressions = finiteNumber(row.Impressions);
      const rowPosition = finiteNumber(row.Position);
      clicks += rowClicks ?? 0;
      impressions += rowImpressions ?? 0;
      if (rowPosition !== undefined && rowImpressions !== undefined && rowImpressions > 0) weightedPosition += rowPosition * rowImpressions;
    }
    const measurements: SeoVisibilityMeasurement[] = [];
    const entity = query.entityId ? { entityId: query.entityId } : {};
    if (rows.length) {
      measurements.push({ metric: "search-impressions", numericValue: impressions, ...entity, sourceType: "search-engine", provenance: provenanceBase });
      measurements.push({ metric: "search-clicks", numericValue: clicks, ...entity, sourceType: "search-engine", provenance: provenanceBase });
      measurements.push({ metric: "search-ctr", numericValue: impressions > 0 ? clicks / impressions : 0, ...entity, sourceType: "search-engine", provenance: provenanceBase });
      if (weightedPosition > 0 && impressions > 0) measurements.push({ metric: "search-position", numericValue: weightedPosition / impressions, ...entity, sourceType: "search-engine", provenance: provenanceBase });
    }
    return measurements;
  }
}

export interface ResponsesWebSearchConfig {
  readonly endpoint: string;
  readonly apiKey: string;
  readonly model: string;
  readonly authMode?: "bearer" | "api-key";
}

export class ResponsesWebSearchCitationProvider implements SeoMeasurementProvider {
  readonly id = "responses-web-search";
  readonly surface = "ai-answer" as const;

  constructor(private readonly config: ResponsesWebSearchConfig) {}

  async observe(query: SeoMeasurementQuery): Promise<readonly SeoVisibilityMeasurement[]> {
    const endpoint = normalizeResponsesEndpoint(this.config.endpoint);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if ((this.config.authMode ?? "bearer") === "api-key") headers["api-key"] = this.config.apiKey;
    else headers.authorization = "Bearer " + this.config.apiKey;
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.config.model,
        tools: [{ type: "web_search" }],
        input: "Answer this search query normally and use web sources with citations. Query: " + query.queryText,
      }),
    });
    if (!response.ok) throw new Error("Responses web-search provider returned HTTP " + response.status);
    const payload = await response.json() as { output?: readonly Record<string, unknown>[]; model?: string };
    const citations: { url: string; title?: string; position: number }[] = [];
    for (const item of payload.output ?? []) {
      if (item.type !== "message") continue;
      const content = Array.isArray(item.content) ? item.content : [];
      for (const part of content) {
        if (typeof part !== "object" || !part) continue;
        const annotations = (part as Record<string, unknown>).annotations;
        if (!Array.isArray(annotations)) continue;
        for (const annotation of annotations) {
          if (!annotation || typeof annotation !== "object") continue;
          const value = annotation as Record<string, unknown>;
          if (value.type === "url_citation" && typeof value.url === "string") {
            citations.push({ url: value.url, ...(typeof value.title === "string" ? { title: value.title } : {}), position: citations.length + 1 });
          }
        }
      }
    }
    const measurements: SeoVisibilityMeasurement[] = [
      { metric: "ai-source-count", numericValue: citations.length, ...(query.entityId ? { entityId: query.entityId } : {}), sourceType: "ai-answer", provenance: { provider: this.id, model: payload.model ?? this.config.model, query: query.queryText } },
      { metric: "ai-citation-present", numericValue: query.canonicalUrl && citations.some((item) => sameCanonicalUrl(item.url, query.canonicalUrl!)) ? 1 : 0, ...(query.entityId ? { entityId: query.entityId } : {}), sourceType: "ai-answer", provenance: { provider: this.id, model: payload.model ?? this.config.model, query: query.queryText } },
    ];
    for (const citation of citations) {
      const matchesTarget = Boolean(query.entityId && sameCanonicalUrl(citation.url, query.canonicalUrl ?? ""));
      measurements.push({
        metric: "ai-citation-observed",
        numericValue: 1,
        ...(matchesTarget && query.entityId ? { entityId: query.entityId } : {}),
        citationUrl: citation.url,
        ...(citation.title ? { citationTitle: citation.title } : {}),
        citationPosition: citation.position,
        sourceType: "ai-answer",
        provenance: { provider: this.id, model: payload.model ?? this.config.model, query: query.queryText },
      });
      if (matchesTarget && query.entityId) {
        measurements.push({
          metric: "ai-citation-position",
          numericValue: citation.position,
          entityId: query.entityId,
          citationUrl: citation.url,
          ...(citation.title ? { citationTitle: citation.title } : {}),
          citationPosition: citation.position,
          sourceType: "ai-answer",
          provenance: { provider: this.id, model: payload.model ?? this.config.model, query: query.queryText },
        });
      }
    }
    return measurements;
  }
}

function normalizeResponsesEndpoint(value: string): string {
  const url = new URL(value);
  const path = url.pathname.replace(/\/+$/, "");
  if (path.endsWith("/responses")) return url.toString();
  url.pathname = path + (path.endsWith("/v1") ? "/responses" : "/v1/responses");
  return url.toString();
}

function sameCanonicalUrl(left: string, right: string): boolean {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return a.origin === b.origin && a.pathname.replace(/\/+$/, "") === b.pathname.replace(/\/+$/, "");
  } catch { return left === right; }
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function utcDateOffset(days: number): string {
  const date = new Date(Date.now() + days * 86400000);
  return date.toISOString().slice(0, 10);
}

let googleTokenCache: { token: string; expiresAt: number } | null = null;

async function googleAccessToken(config: GoogleSearchConsoleConfig): Promise<string> {
  if (config.accessToken?.trim()) return config.accessToken.trim();
  if (!config.serviceAccountEmail?.trim() || !config.serviceAccountPrivateKey?.trim()) {
    throw new Error("Google Search Console credentials are not configured.");
  }
  const now = Math.floor(Date.now() / 1000);
  if (googleTokenCache && googleTokenCache.expiresAt - 60 > now) return googleTokenCache.token;
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlJson({
    iss: config.serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
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
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw new Error("Google OAuth token exchange returned HTTP " + response.status);
  const body = await response.json() as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Google OAuth token exchange returned no access token.");
  googleTokenCache = { token: body.access_token, expiresAt: now + Math.max(300, body.expires_in ?? 3600) };
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
