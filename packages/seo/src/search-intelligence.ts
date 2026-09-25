export type SearchIntelligenceVertical =
  | "google-organic"
  | "google-ai-mode"
  | "google-maps"
  | "google-local"
  | "google-news"
  | "google-images"
  | "google-jobs"
  | "google-autocomplete"
  | "google-shopping"
  | "google-dataset-search"
  | "bing-organic"
  | "bing-news"
  | "bing-images"
  | "bing-videos"
  | "yandex-organic"
  | "yahoo-organic"
  | "baidu-organic"
  | "naver-organic"
  | "seznam-organic"
  | "youtube-organic"
  | "amazon-products";

export interface DataForSeoSearchIntelligenceConfig {
  readonly login: string;
  readonly password: string;
  readonly endpoint?: string;
  readonly fetcher?: typeof fetch;
  readonly timeoutMs?: number;
}

export interface SearchIntelligenceQuery {
  readonly vertical: SearchIntelligenceVertical;
  readonly keyword: string;
  readonly locationCode?: number;
  readonly locationName?: string;
  readonly languageCode?: string;
  readonly languageName?: string;
  readonly device?: "desktop" | "mobile";
  readonly depth?: number;
  readonly targetDomains?: readonly string[];
  readonly extra?: Readonly<Record<string, unknown>>;
}

export interface SearchIntelligenceResponse {
  readonly vertical: SearchIntelligenceVertical;
  readonly keyword: string;
  readonly datetime?: string;
  readonly checkUrl?: string;
  readonly locationCode?: number;
  readonly languageCode?: string;
  readonly items: readonly Record<string, unknown>[];
  readonly raw: unknown;
  readonly provenance: Record<string, unknown>;
}

export interface SearchByImageRequest {
  readonly imageUrl: string;
  readonly locationCode?: number;
  readonly locationName?: string;
  readonly languageCode?: string;
  readonly languageName?: string;
}

export interface DataForSeoTrendsRequest {
  readonly keywords: readonly string[];
  readonly locationCode?: number;
  readonly locationName?: string;
  readonly type?: "web" | "news" | "shopping";
}

export interface DataForSeoBusinessInfoRequest {
  readonly keyword: string;
  readonly locationCode?: number;
  readonly locationName?: string;
  readonly languageCode?: string;
  readonly languageName?: string;
}

const VERTICAL_ENDPOINTS: Readonly<Record<SearchIntelligenceVertical, string>> = {
  "google-organic": "/v3/serp/google/organic/live/advanced",
  "google-ai-mode": "/v3/serp/google/ai_mode/live/advanced",
  "google-maps": "/v3/serp/google/maps/live/advanced",
  "google-local": "/v3/serp/google/local_finder/live/advanced",
  "google-news": "/v3/serp/google/news/live/advanced",
  "google-images": "/v3/serp/google/images/live/advanced",
  "google-jobs": "/v3/serp/google/jobs/live/advanced",
  "google-autocomplete": "/v3/serp/google/autocomplete/live/advanced",
  "google-shopping": "/v3/merchant/google/products/task_post",
  "google-dataset-search": "/v3/serp/google/dataset_search/live/advanced",
  "bing-organic": "/v3/serp/bing/organic/live/advanced",
  "bing-news": "/v3/serp/bing/news/live/advanced",
  "bing-images": "/v3/serp/bing/images/live/advanced",
  "bing-videos": "/v3/serp/bing/videos/live/advanced",
  "yandex-organic": "/v3/serp/yandex/organic/live/advanced",
  "yahoo-organic": "/v3/serp/yahoo/organic/live/advanced",
  "baidu-organic": "/v3/serp/baidu/organic/live/advanced",
  "naver-organic": "/v3/serp/naver/organic/live/advanced",
  "seznam-organic": "/v3/serp/seznam/organic/live/advanced",
  "youtube-organic": "/v3/serp/youtube/organic/live/advanced",
  "amazon-products": "/v3/merchant/amazon/products/live/advanced",
};

export class DataForSeoSearchIntelligenceClient {
  constructor(private readonly config: DataForSeoSearchIntelligenceConfig) {}

  async search(query: SearchIntelligenceQuery): Promise<SearchIntelligenceResponse> {
    const keyword = query.keyword.trim();
    if (!keyword) throw new Error("Search intelligence keyword cannot be empty.");
    if (!this.config.login.trim() || !this.config.password.trim()) {
      throw new Error("DataForSEO credentials are not configured.");
    }

    if (query.vertical === "google-shopping") {
      const shopping = await this.googleShoppingProducts({
        keyword,
        ...(query.locationCode !== undefined ? { locationCode: query.locationCode } : {}),
        ...(query.locationName ? { locationName: query.locationName } : {}),
        ...(query.languageCode ? { languageCode: query.languageCode } : {}),
        ...(query.languageName ? { languageName: query.languageName } : {}),
        ...(query.depth !== undefined ? { depth: query.depth } : {}),
        ...(typeof query.extra?.sort_by === "string" ? { sortBy: query.extra.sort_by } : {}),
        ...(typeof query.extra?.price_min === "number" ? { priceMin: query.extra.price_min } : {}),
        ...(typeof query.extra?.price_max === "number" ? { priceMax: query.extra.price_max } : {}),
      });
      const task = (shopping as { tasks?: readonly { result?: readonly { keyword?: string; datetime?: string; check_url?: string; location_code?: number; language_code?: string; items?: readonly Record<string, unknown>[] }[] }[] }).tasks?.[0]?.result?.[0];
      return {
        vertical: query.vertical,
        keyword: task?.keyword ?? keyword,
        ...(task?.datetime ? { datetime: task.datetime } : {}),
        ...(task?.check_url ? { checkUrl: task.check_url } : {}),
        ...(task?.location_code !== undefined ? { locationCode: task.location_code } : {}),
        ...(task?.language_code ? { languageCode: task.language_code } : {}),
        items: task?.items ?? [],
        raw: shopping,
        provenance: {
          provider: "dataforseo",
          endpoint: (this.config.endpoint?.trim() || "https://api.dataforseo.com").replace(/\/$/, "") + "/v3/merchant/google/products/task_get/advanced",
          vertical: query.vertical,
          keyword,
          locationCode: task?.location_code ?? query.locationCode ?? null,
          locationName: query.locationName ?? null,
          languageCode: task?.language_code ?? query.languageCode ?? query.languageName ?? null,
          observedAt: new Date().toISOString(),
        },
      };
    }

    const endpoint = (this.config.endpoint?.trim() || "https://api.dataforseo.com").replace(/\/$/, "")
      + VERTICAL_ENDPOINTS[query.vertical];
    const payload: Record<string, unknown> = {
      keyword,
      ...(query.locationCode !== undefined ? { location_code: query.locationCode } : {}),
      ...(query.locationName ? { location_name: query.locationName } : {}),
      ...(query.languageCode ? { language_code: query.languageCode } : {}),
      ...(query.languageName ? { language_name: query.languageName } : {}),
      ...(query.device ? { device: query.device } : {}),
      ...(query.depth !== undefined ? { depth: Math.min(Math.max(Math.trunc(query.depth), 10), 100) } : {}),
      ...(query.targetDomains?.length ? { stop_crawl_on_match: query.targetDomains } : {}),
      ...(query.vertical === "google-organic" ? { load_async_ai_overview: true } : {}),
      ...(query.extra ?? {}),
    };

    const response = await fetchWithTimeout(
      this.config.fetcher ?? fetch,
      endpoint,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Basic " + bytesToBase64(new TextEncoder().encode(this.config.login + ":" + this.config.password)),
        },
        body: JSON.stringify([payload]),
      },
      Math.min(Math.max(Math.trunc(this.config.timeoutMs ?? 30000), 1000), 60000),
    );

    if (!response.ok) {
      throw new Error("DataForSEO search intelligence returned HTTP " + response.status);
    }

    const body = await response.json() as {
      tasks?: readonly {
        status_code?: number;
        status_message?: string;
        result?: readonly {
          keyword?: string;
          datetime?: string;
          check_url?: string;
          location_code?: number;
          language_code?: string;
          items?: readonly Record<string, unknown>[];
        }[];
      }[];
    };

    const task = body.tasks?.[0];
    if (!task || task.status_code !== 20000) {
      throw new Error("DataForSEO search intelligence failed: " + (task?.status_message || "unknown provider error"));
    }

    const result = task.result?.[0];
    if (!result) throw new Error("DataForSEO search intelligence returned no result.");

    return {
      vertical: query.vertical,
      keyword: result.keyword ?? keyword,
      ...(result.datetime ? { datetime: result.datetime } : {}),
      ...(result.check_url ? { checkUrl: result.check_url } : {}),
      ...(result.location_code !== undefined ? { locationCode: result.location_code } : {}),
      ...(result.language_code ? { languageCode: result.language_code } : {}),
      items: result.items ?? [],
      raw: body,
      provenance: {
        provider: "dataforseo",
        endpoint,
        vertical: query.vertical,
        keyword,
        locationCode: result.location_code ?? query.locationCode ?? null,
        locationName: query.locationName ?? null,
        languageCode: result.language_code ?? query.languageCode ?? query.languageName ?? null,
        observedAt: new Date().toISOString(),
      },
    };
  }

  async googleShoppingProducts(request: {
    readonly keyword: string;
    readonly locationCode?: number;
    readonly locationName?: string;
    readonly languageCode?: string;
    readonly languageName?: string;
    readonly depth?: number;
    readonly sortBy?: string;
    readonly priceMin?: number;
    readonly priceMax?: number;
  }): Promise<unknown> {
    const keyword = request.keyword.trim();
    if (!keyword) throw new Error("Google Shopping keyword cannot be empty.");
    const base = (this.config.endpoint?.trim() || "https://api.dataforseo.com").replace(/\/$/, "");
    const postUrl = base + "/v3/merchant/google/products/task_post";
    const payload = [{
      keyword,
      ...(request.locationCode !== undefined ? { location_code: request.locationCode } : {}),
      ...(request.locationName ? { location_name: request.locationName } : {}),
      ...(request.languageCode ? { language_code: request.languageCode } : {}),
      ...(request.languageName ? { language_name: request.languageName } : {}),
      ...(request.depth !== undefined ? { depth: Math.min(Math.max(Math.trunc(request.depth), 10), 200) } : {}),
      ...(request.sortBy ? { sort_by: request.sortBy } : {}),
      ...(request.priceMin !== undefined ? { price_min: request.priceMin } : {}),
      ...(request.priceMax !== undefined ? { price_max: request.priceMax } : {}),
    }];
    const posted = await this.rawRequest(postUrl, { method: "POST", body: JSON.stringify(payload) });
    const taskId = (((posted as { tasks?: readonly { id?: string }[] }).tasks ?? [])[0]?.id);
    if (!taskId) throw new Error("Google Shopping task did not return a task id.");
    const deadline = Date.now() + Math.min(Math.max(Math.trunc(this.config.timeoutMs ?? 30000), 5000), 60000);
    const getUrl = base + "/v3/merchant/google/products/task_get/advanced/" + encodeURIComponent(taskId);
    while (Date.now() < deadline) {
      const result = await this.rawRequest(getUrl, { method: "GET" });
      const task = ((result as { tasks?: readonly { status_code?: number; status_message?: string; result?: unknown[] }[] }).tasks ?? [])[0];
      if (task?.status_code === 20000 && task.result?.length) return result;
      if (task?.status_code && task.status_code >= 40000) {
        throw new Error("Google Shopping task failed: " + (task.status_message || "unknown provider error"));
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("Google Shopping task timed out before results were ready.");
  }

  async searchByImage(request: SearchByImageRequest): Promise<unknown> {
    if (!/^https?:\/\//i.test(request.imageUrl)) throw new Error("Search-by-image requires an HTTPS/HTTP image URL.");
    const endpoint = (this.config.endpoint?.trim() || "https://api.dataforseo.com").replace(/\/$/, "")
      + "/v3/serp/google/search_by_image/live/advanced";
    return this.requestSingle(endpoint, {
      image_url: request.imageUrl,
      ...(request.locationCode !== undefined ? { location_code: request.locationCode } : {}),
      ...(request.locationName ? { location_name: request.locationName } : {}),
      ...(request.languageCode ? { language_code: request.languageCode } : {}),
      ...(request.languageName ? { language_name: request.languageName } : {}),
    });
  }

  async exploreTrends(request: DataForSeoTrendsRequest): Promise<unknown> {
    const keywords = [...new Set(request.keywords.map((value) => value.trim()).filter(Boolean))].slice(0, 5);
    if (!keywords.length) throw new Error("At least one trend keyword is required.");
    const endpoint = (this.config.endpoint?.trim() || "https://api.dataforseo.com").replace(/\/$/, "")
      + "/v3/keywords_data/dataforseo_trends/explore/live";
    return this.requestSingle(endpoint, {
      keywords,
      ...(request.locationCode !== undefined ? { location_code: request.locationCode } : {}),
      ...(request.locationName ? { location_name: request.locationName } : {}),
      ...(request.type ? { type: request.type } : {}),
    });
  }

  async businessInfo(request: DataForSeoBusinessInfoRequest): Promise<unknown> {
    const keyword = request.keyword.trim();
    if (!keyword) throw new Error("Business information keyword cannot be empty.");
    const endpoint = (this.config.endpoint?.trim() || "https://api.dataforseo.com").replace(/\/$/, "")
      + "/v3/business_data/google/my_business_info/live";
    return this.requestSingle(endpoint, {
      keyword,
      ...(request.locationCode !== undefined ? { location_code: request.locationCode } : {}),
      ...(request.locationName ? { location_name: request.locationName } : {}),
      ...(request.languageCode ? { language_code: request.languageCode } : {}),
      ...(request.languageName ? { language_name: request.languageName } : {}),
    });
  }

  private async rawRequest(endpoint: string, init: { readonly method?: string; readonly body?: string }): Promise<unknown> {
    const response = await fetchWithTimeout(
      this.config.fetcher ?? fetch,
      endpoint,
      {
        method: init.method,
        headers: {
          "content-type": "application/json",
          authorization: "Basic " + bytesToBase64(new TextEncoder().encode(this.config.login + ":" + this.config.password)),
        },
        ...(init.body ? { body: init.body } : {}),
      },
      Math.min(Math.max(Math.trunc(this.config.timeoutMs ?? 30000), 1000), 60000),
    );
    if (!response.ok) throw new Error("DataForSEO search intelligence returned HTTP " + response.status);
    const body = await response.json();
    return body;
  }

  private async requestSingle(endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
    const response = await fetchWithTimeout(
      this.config.fetcher ?? fetch,
      endpoint,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Basic " + bytesToBase64(new TextEncoder().encode(this.config.login + ":" + this.config.password)),
        },
        body: JSON.stringify([payload]),
      },
      Math.min(Math.max(Math.trunc(this.config.timeoutMs ?? 30000), 1000), 60000),
    );
    if (!response.ok) throw new Error("DataForSEO search intelligence returned HTTP " + response.status);
    const body = await response.json();
    const task = (body as { tasks?: readonly { status_code?: number; status_message?: string }[] }).tasks?.[0];
    if (!task || task.status_code !== 20000) {
      throw new Error("DataForSEO search intelligence failed: " + (task?.status_message || "unknown provider error"));
    }
    return body;
  }
}

export function searchIntelligenceVerticals(): readonly SearchIntelligenceVertical[] {
  return Object.keys(VERTICAL_ENDPOINTS) as SearchIntelligenceVertical[];
}

async function fetchWithTimeout(
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function bytesToBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}


export interface GooglePlacesConfig {
  readonly apiKey: string;
  readonly endpoint?: string;
  readonly fetcher?: typeof fetch;
  readonly timeoutMs?: number;
}

export interface GooglePlacesSearchRequest {
  readonly textQuery: string;
  readonly languageCode?: string;
  readonly regionCode?: string;
  readonly pageSize?: number;
  readonly includedType?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly radiusMeters?: number;
}

export class GooglePlacesClient {
  constructor(private readonly config: GooglePlacesConfig) {}

  async textSearch(request: GooglePlacesSearchRequest): Promise<unknown> {
    const body: Record<string, unknown> = {
      textQuery: request.textQuery,
      ...(request.languageCode ? { languageCode: request.languageCode } : {}),
      ...(request.regionCode ? { regionCode: request.regionCode } : {}),
      ...(request.includedType ? { includedType: request.includedType } : {}),
      ...(request.pageSize !== undefined ? { pageSize: Math.min(Math.max(Math.trunc(request.pageSize), 1), 20) } : {}),
    };
    if (request.latitude !== undefined && request.longitude !== undefined && request.radiusMeters !== undefined) {
      body.locationBias = {
        circle: {
          center: { latitude: request.latitude, longitude: request.longitude },
          radius: Math.min(Math.max(request.radiusMeters, 1), 50000),
        },
      };
    }
    return this.post("https://places.googleapis.com/v1/places:searchText", body,
      "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.regularOpeningHours,places.websiteUri");
  }

  async autocomplete(request: {
    readonly input: string;
    readonly regionCode?: string;
    readonly includedPrimaryTypes?: readonly string[];
    readonly includeQueryPredictions?: boolean;
    readonly sessionToken?: string;
    readonly latitude?: number;
    readonly longitude?: number;
    readonly radiusMeters?: number;
  }): Promise<unknown> {
    const input = request.input.trim();
    if (!input) throw new Error("Google Places autocomplete input is required.");
    const body: Record<string, unknown> = {
      input,
      ...(request.regionCode ? { regionCode: request.regionCode } : {}),
      ...(request.includedPrimaryTypes?.length ? { includedPrimaryTypes: request.includedPrimaryTypes.slice(0, 5) } : {}),
      ...(request.includeQueryPredictions ? { includeQueryPredictions: true } : {}),
      ...(request.sessionToken ? { sessionToken: request.sessionToken } : {}),
    };
    if (request.latitude !== undefined && request.longitude !== undefined && request.radiusMeters !== undefined) {
      body.locationBias = {
        circle: {
          center: { latitude: request.latitude, longitude: request.longitude },
          radius: Math.min(Math.max(request.radiusMeters, 1), 50000),
        },
      };
    }
    return this.post("https://places.googleapis.com/v1/places:autocomplete", body,
      "suggestions.placePrediction.text.text,suggestions.placePrediction.placeId,suggestions.queryPrediction.text.text");
  }

  async nearbySearch(request: {
    readonly latitude: number;
    readonly longitude: number;
    readonly radiusMeters: number;
    readonly includedTypes: readonly string[];
    readonly maxResultCount?: number;
    readonly languageCode?: string;
    readonly regionCode?: string;
  }): Promise<unknown> {
    const body: Record<string, unknown> = {
      maxResultCount: Math.min(Math.max(Math.trunc(request.maxResultCount ?? 20), 1), 20),
      includedTypes: request.includedTypes.slice(0, 50),
      locationRestriction: {
        circle: {
          center: { latitude: request.latitude, longitude: request.longitude },
          radius: Math.min(Math.max(request.radiusMeters, 1), 50000),
        },
      },
      ...(request.languageCode ? { languageCode: request.languageCode } : {}),
      ...(request.regionCode ? { regionCode: request.regionCode } : {}),
    };
    return this.post("https://places.googleapis.com/v1/places:searchNearby", body,
      "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.regularOpeningHours,places.websiteUri");
  }

  async placeDetails(placeId: string, fieldMask = "id,displayName,formattedAddress,location,rating,userRatingCount,regularOpeningHours,websiteUri,reviews"): Promise<unknown> {
    const normalized = placeId.trim().replace(/^places\//, "");
    if (!normalized) throw new Error("Google Place ID is required.");
    return this.get("https://places.googleapis.com/v1/places/" + encodeURIComponent(normalized), fieldMask);
  }

  async placePhoto(photoName: string, maxWidthPx = 800, maxHeightPx = 800): Promise<Response> {
    const normalized = photoName.trim().replace(/^\/+/, "");
    if (!normalized.startsWith("places/")) throw new Error("Google Place photo resource name is required.");
    const url = "https://places.googleapis.com/v1/" + normalized + "/media"
      + "?maxWidthPx=" + encodeURIComponent(String(Math.min(Math.max(Math.trunc(maxWidthPx), 1), 4800)))
      + "&maxHeightPx=" + encodeURIComponent(String(Math.min(Math.max(Math.trunc(maxHeightPx), 1), 4800)));
    return this.execute(url, { headers: { accept: "image/*" } });
  }

  private async post(url: string, body: Record<string, unknown>, fieldMask: string): Promise<unknown> {
    return this.request(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": this.config.apiKey,
        "x-goog-fieldmask": fieldMask,
      },
      body: JSON.stringify(body),
    });
  }

  private async get(url: string, fieldMask: string): Promise<unknown> {
    return this.request(url, {
      headers: { "x-goog-api-key": this.config.apiKey, "x-goog-fieldmask": fieldMask },
    });
  }

  private async request(url: string, init: RequestInit): Promise<unknown> {
    const response = await this.execute(url, init);
    if (!response.ok) throw new Error("Google Places API returned HTTP " + response.status);
    return response.json();
  }

  private async execute(url: string, init: RequestInit): Promise<Response> {
    if (!this.config.apiKey.trim()) throw new Error("Google Places API key is not configured.");
    return fetchWithTimeout(this.config.fetcher ?? fetch, url, init, Math.min(Math.max(Math.trunc(this.config.timeoutMs ?? 15000), 1000), 60000));
  }
}

export interface GoogleRoutesConfig {
  readonly apiKey: string;
  readonly fetcher?: typeof fetch;
  readonly timeoutMs?: number;
}

export class GoogleRoutesClient {
  constructor(private readonly config: GoogleRoutesConfig) {}

  async computeRoutes(body: Record<string, unknown>, fieldMask = "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"): Promise<unknown> {
    if (!body.origin || !body.destination) throw new Error("Google Routes requires origin and destination.");
    const { fieldMask: ignoredFieldMask, ...routeBody } = body;
    void ignoredFieldMask;
    const response = await fetchWithTimeout(
      this.config.fetcher ?? fetch,
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": this.config.apiKey,
          "x-goog-fieldmask": fieldMask,
        },
        body: JSON.stringify(routeBody),
      },
      Math.min(Math.max(Math.trunc(this.config.timeoutMs ?? 15000), 1000), 60000),
    );
    if (!response.ok) throw new Error("Google Routes API returned HTTP " + response.status);
    return response.json();
  }
}

export interface YouTubeSearchConfig {
  readonly apiKey: string;
  readonly fetcher?: typeof fetch;
  readonly timeoutMs?: number;
}

export class YouTubeSearchClient {
  constructor(private readonly config: YouTubeSearchConfig) {}

  async search(query: string, options: { readonly regionCode?: string; readonly relevanceLanguage?: string; readonly type?: "video" | "channel" | "playlist"; readonly maxResults?: number } = {}): Promise<unknown> {
    const trimmed = query.trim();
    if (!trimmed) throw new Error("YouTube search query cannot be empty.");
    const params = new URLSearchParams({
      part: "snippet",
      q: trimmed,
      key: this.config.apiKey,
      maxResults: String(Math.min(Math.max(Math.trunc(options.maxResults ?? 10), 1), 50)),
    });
    if (options.regionCode) params.set("regionCode", options.regionCode);
    if (options.relevanceLanguage) params.set("relevanceLanguage", options.relevanceLanguage);
    if (options.type) params.set("type", options.type);
    const response = await fetchWithTimeout(
      this.config.fetcher ?? fetch,
      "https://www.googleapis.com/youtube/v3/search?" + params.toString(),
      { headers: { accept: "application/json" } },
      Math.min(Math.max(Math.trunc(this.config.timeoutMs ?? 15000), 1000), 60000),
    );
    if (!response.ok) throw new Error("YouTube Data API returned HTTP " + response.status);
    return response.json();
  }
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
