import type { MerchantProductFeedItem } from "./merchant-feed";

export interface GoogleMerchantCenterConfig {
  readonly accountId: string;
  readonly dataSource: string;
  readonly feedLabel: string;
  readonly contentLanguage: string;
  readonly accessToken?: string;
  readonly serviceAccountEmail?: string;
  readonly serviceAccountPrivateKey?: string;
  readonly endpoint?: string;
}

export interface GoogleMerchantCenterSyncResult {
  readonly offerId: string;
  readonly resourceName?: string;
}

export class GoogleMerchantCenterClient {
  constructor(private readonly config: GoogleMerchantCenterConfig) {}

  async upsert(item: MerchantProductFeedItem): Promise<GoogleMerchantCenterSyncResult> {
    const token = await googleAccessToken(this.config);
    const endpoint = (this.config.endpoint ?? "https://merchantapi.googleapis.com").replace(/\/$/, "");
    const url = endpoint
      + "/products/v1/accounts/" + encodeURIComponent(this.config.accountId)
      + "/productInputs:insert?dataSource=" + encodeURIComponent(this.config.dataSource);
    const body = {
      offerId: item.id,
      contentLanguage: this.config.contentLanguage,
      feedLabel: this.config.feedLabel,
      productAttributes: {
        title: item.title,
        description: item.description,
        link: item.link,
        imageLink: item.imageLink,
        availability: item.availability.toUpperCase(),
        price: {
          amountMicros: String(Math.round(item.price * 1_000_000)),
          currencyCode: item.currency.toUpperCase(),
        },
        condition: item.condition.toUpperCase(),
        ...(item.itemGroupId ? { itemGroupId: item.itemGroupId } : {}),
        ...(item.sku ? { mpn: item.sku } : {}),
      },
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("Google Merchant API insert returned HTTP " + response.status);
    const payload = await response.json() as { name?: string };
    return { offerId: item.id, ...(payload.name ? { resourceName: payload.name } : {}) };
  }

  async delete(offerId: string): Promise<void> {
    const token = await googleAccessToken(this.config);
    const endpoint = (this.config.endpoint ?? "https://merchantapi.googleapis.com").replace(/\/$/, "");
    const productInputName = "accounts/" + this.config.accountId + "/productInputs/"
      + this.config.contentLanguage + "~" + this.config.feedLabel + "~" + offerId;
    const resourcePath = productInputName.split("/").map((segment) => encodeURIComponent(segment)).join("/");
    const url = endpoint + "/products/v1/" + resourcePath
      + "?dataSource=" + encodeURIComponent(this.config.dataSource);
    const response = await fetch(url, {
      method: "DELETE",
      headers: { authorization: "Bearer " + token },
    });
    if (!response.ok && response.status !== 404) throw new Error("Google Merchant API delete returned HTTP " + response.status);
  }
}

let accessTokenCache: { key: string; token: string; expiresAt: number } | null = null;

async function googleAccessToken(config: GoogleMerchantCenterConfig): Promise<string> {
  if (config.accessToken?.trim()) return config.accessToken.trim();
  if (!config.serviceAccountEmail?.trim() || !config.serviceAccountPrivateKey?.trim()) {
    throw new Error("Google Merchant API credentials are not configured.");
  }
  const cacheKey = config.serviceAccountEmail.trim();
  const now = Math.floor(Date.now() / 1000);
  if (accessTokenCache?.key === cacheKey && accessTokenCache.expiresAt - 60 > now) return accessTokenCache.token;
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlJson({
    iss: config.serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/content",
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
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error("Google Merchant API OAuth token exchange returned HTTP " + response.status);
  const body = await response.json() as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Google Merchant API OAuth token exchange returned no access token.");
  accessTokenCache = { key: cacheKey, token: body.access_token, expiresAt: now + Math.max(300, body.expires_in ?? 3600) };
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
