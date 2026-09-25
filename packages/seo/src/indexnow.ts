export interface SeoIndexNowConfig {
  readonly key: string;
  readonly endpoint?: string;
  readonly keyLocation?: string;
  readonly host?: string;
  readonly batchLimit?: number;
  readonly fetcher?: typeof fetch;
}

export interface SeoIndexNowResult {
  readonly submitted: number;
  readonly skipped: number;
  readonly endpoint: string;
  readonly host: string | null;
}

const DEFAULT_ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_BATCH_SIZE = 10_000;

export function normalizeIndexNowUrls(urls: readonly string[], expectedHost?: string): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    if (expectedHost && url.host !== expectedHost) continue;
    url.hash = "";
    const value = url.toString();
    if (seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  return normalized.sort();
}

export async function notifyIndexNow(
  urls: readonly string[],
  config: SeoIndexNowConfig,
): Promise<SeoIndexNowResult> {
  const fetcher = config.fetcher ?? fetch;
  if (!config.key.trim()) {
    return { submitted: 0, skipped: urls.length, endpoint: config.endpoint ?? DEFAULT_ENDPOINT, host: config.host ?? null };
  }

  const first = urls.find((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  });
  const firstUrl = first ? new URL(first) : null;
  const host = config.host?.trim() || firstUrl?.host || null;
  if (!host) {
    return { submitted: 0, skipped: urls.length, endpoint: config.endpoint ?? DEFAULT_ENDPOINT, host: null };
  }

  const normalized = normalizeIndexNowUrls(urls, host);
  if (!normalized.length) {
    return { submitted: 0, skipped: urls.length, endpoint: config.endpoint ?? DEFAULT_ENDPOINT, host };
  }

  const batchLimit = Math.min(
    MAX_BATCH_SIZE,
    Math.max(1, Math.trunc(config.batchLimit ?? MAX_BATCH_SIZE)),
  );
  const endpoint = config.endpoint?.trim() || DEFAULT_ENDPOINT;

  let submitted = 0;
  for (let offset = 0; offset < normalized.length; offset += batchLimit) {
    const urlList = normalized.slice(offset, offset + batchLimit);
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: config.key.trim(),
        ...(config.keyLocation?.trim() ? { keyLocation: config.keyLocation.trim() } : {}),
        urlList,
      }),
    });
    if (!response.ok) {
      throw new Error(`IndexNow notification failed with HTTP ${response.status}.`);
    }
    submitted += urlList.length;
  }

  return {
    submitted,
    skipped: Math.max(0, urls.length - submitted),
    endpoint,
    host,
  };
}
