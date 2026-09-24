export interface CompetitiveQuery {
  readonly queryText: string;
  readonly locale: string;
  readonly locationName?: string;
  readonly locationCode?: number;
  readonly languageCode?: string;
  readonly device?: "desktop" | "mobile";
  readonly depth?: number;
  readonly targetDomains?: readonly string[];
  readonly pageSampleLimit?: number;
}

export interface CompetitiveResult {
  readonly queryText: string;
  readonly datetime?: string;
  readonly checkUrl?: string;
  readonly locationCode?: number;
  readonly languageCode?: string;
  readonly results: readonly CompetitiveResultItem[];
  readonly aiCitations: readonly CompetitiveCitation[];
  readonly provenance: Record<string, unknown>;
}

export interface CompetitiveResultItem {
  readonly type: string;
  readonly domain?: string;
  readonly url?: string;
  readonly title?: string;
  readonly snippet?: string;
  readonly rankGroup?: number;
  readonly rankAbsolute?: number;
  readonly aiCitation?: boolean;
}

export interface CompetitiveCitation {
  readonly url: string;
  readonly domain?: string;
  readonly title?: string;
  readonly position: number;
}



export interface CompetitiveKeywordGap {
  readonly keyword: string;
  readonly searchVolume?: number;
  readonly cpc?: number;
  readonly competitorRank?: number;
  readonly phoenixRank?: number;
  readonly gapType: "competitor-only" | "shared";
  readonly provenance: Record<string, unknown>;
}

export interface CompetitivePageSnapshot {
  readonly url: string;
  readonly statusCode?: number;
  readonly title?: string;
  readonly description?: string;
  readonly canonicalUrl?: string;
  readonly h1Count?: number;
  readonly wordCount?: number;
  readonly internalLinksCount?: number;
  readonly externalLinksCount?: number;
  readonly imagesCount?: number;
  readonly titleLength?: number;
  readonly descriptionLength?: number;
  readonly noH1Tag?: boolean;
  readonly noTitle?: boolean;
  readonly noDescription?: boolean;
  readonly seoFriendlyUrl?: boolean;
  readonly structuredDataErrors?: number;
  readonly provenance: Record<string, unknown>;
}

export interface DataForSeoCompetitiveConfig {
  readonly login: string;
  readonly password: string;
  readonly endpoint?: string;
}

export class DataForSeoGoogleCompetitiveProvider {
  readonly id = "dataforseo-google-organic";
  constructor(private readonly config: DataForSeoCompetitiveConfig) {}

  async observe(query: CompetitiveQuery): Promise<CompetitiveResult> {
    if (!query.queryText.trim()) throw new Error("Competitive query cannot be empty.");
    if (!query.locationCode && !query.locationName) throw new Error("Competitive query requires a location.");
    if (!query.languageCode) throw new Error("Competitive query requires a language.");
    const endpoint = this.config.endpoint?.trim() || "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Basic " + bytesToBase64(new TextEncoder().encode(this.config.login + ":" + this.config.password)),
      },
      body: JSON.stringify([{
        keyword: query.queryText,
        ...(query.locationCode ? { location_code: query.locationCode } : { location_name: query.locationName }),
        language_code: query.languageCode,
        device: query.device ?? "desktop",
        depth: Math.min(Math.max(Math.trunc(query.depth ?? 20), 10), 100),
        load_async_ai_overview: true,
        ...(query.targetDomains?.length ? { stop_crawl_on_match: query.targetDomains } : {}),
      }]),
    });
    if (!response.ok) throw new Error("DataForSEO competitive provider returned HTTP " + response.status);
    const payload = await response.json() as {
      status_code?: number;
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
    const task = payload.tasks?.[0];
    if (!task || task.status_code !== 20000) {
      throw new Error("DataForSEO competitive provider failed: " + (task?.status_message || "unknown provider error"));
    }
    const result = task.result?.[0];
    if (!result) throw new Error("DataForSEO competitive provider returned no SERP result.");
    const items: CompetitiveResultItem[] = [];
    const citations: CompetitiveCitation[] = [];
    const walk = (nodes: readonly Record<string, unknown>[]): void => {
      for (const raw of nodes) {
        const type = typeof raw.type === "string" ? raw.type : "unknown";
        const url = firstUrl(raw.url, raw.link);
        const domain = typeof raw.domain === "string" ? normalizeDomain(raw.domain) : url ? normalizeDomain(new URL(url).hostname) : undefined;
        const title = typeof raw.title === "string" ? raw.title : undefined;
        const snippet = typeof raw.description === "string" ? raw.description : typeof raw.snippet === "string" ? raw.snippet : undefined;
        const rankGroup = finiteInteger(raw.rank_group);
        const rankAbsolute = finiteInteger(raw.rank_absolute);
        const itemIsCitation = type.includes("reference") || type.includes("citation");
        if (url || title) {
          items.push({
            type,
            ...(domain ? { domain } : {}),
            ...(url ? { url } : {}),
            ...(title ? { title } : {}),
            ...(snippet ? { snippet } : {}),
            ...(rankGroup !== undefined ? { rankGroup } : {}),
            ...(rankAbsolute !== undefined ? { rankAbsolute } : {}),
            ...(itemIsCitation ? { aiCitation: true } : {}),
          });
        }
        if (itemIsCitation && url) citations.push({ url, ...(domain ? { domain } : {}), ...(title ? { title } : {}), position: citations.length + 1 });
        const nested = Array.isArray(raw.items) ? raw.items.filter(isRecord) : [];
        if (nested.length) walk(nested);
        const refs = Array.isArray(raw.references) ? raw.references.filter(isRecord) : [];
        for (const ref of refs) {
          const refUrl = firstUrl(ref.url, ref.link);
          if (refUrl) citations.push({
            url: refUrl,
            ...(typeof ref.domain === "string" ? { domain: normalizeDomain(ref.domain) } : {}),
            ...(typeof ref.title === "string" ? { title: ref.title } : {}),
            position: citations.length + 1,
          });
        }
      }
    };
    walk((result.items ?? []).filter(isRecord));
    const dedupedCitations = dedupeCitations(citations);
    return {
      queryText: result.keyword ?? query.queryText,
      ...(result.datetime ? { datetime: result.datetime } : {}),
      ...(result.check_url ? { checkUrl: result.check_url } : {}),
      ...(result.location_code !== undefined ? { locationCode: result.location_code } : {}),
      ...(result.language_code ? { languageCode: result.language_code } : {}),
      results: dedupeResults(items),
      aiCitations: dedupedCitations,
      provenance: {
        provider: this.id,
        endpoint,
        query: query.queryText,
        locationCode: result.location_code ?? query.locationCode ?? null,
        locationName: query.locationName ?? null,
        languageCode: result.language_code ?? query.languageCode,
        device: query.device ?? "desktop",
        depth: query.depth ?? 20,
        observedAt: new Date().toISOString(),
      },
    };
  }


  async observeKeywordGaps(
    competitorDomain: string,
    phoenixDomain: string,
    options: {
      readonly locationName?: string;
      readonly locationCode?: number;
      readonly languageCode: string;
      readonly limit?: number;
    },
  ): Promise<readonly CompetitiveKeywordGap[]> {
    const endpoint = "https://api.dataforseo.com/v3/dataforseo_labs/google/domain_intersection/live";
    const payload = [{
      target1: normalizeDomain(competitorDomain),
      target2: normalizeDomain(phoenixDomain),
      ...(options.locationCode !== undefined ? { location_code: options.locationCode } : {}),
      ...(options.locationName ? { location_name: options.locationName } : {}),
      language_code: options.languageCode,
      intersections: false,
      include_serp_info: true,
      item_types: ["organic"],
      order_by: ["keyword_data.keyword_info.search_volume,desc"],
      limit: Math.min(Math.max(Math.trunc(options.limit ?? 25), 1), 100),
    }];
    if (options.locationCode === undefined && !options.locationName) {
      throw new Error("Competitive keyword-gap measurement requires a location.");
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Basic " + bytesToBase64(new TextEncoder().encode(this.config.login + ":" + this.config.password)),
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("DataForSEO Labs Domain Intersection returned HTTP " + response.status);
    const payloadJson = await response.json() as {
      tasks?: readonly {
        status_code?: number;
        status_message?: string;
        result?: readonly {
          target1?: string;
          target2?: string;
          location_code?: number;
          language_code?: string;
          items?: readonly Record<string, unknown>[];
        }[];
      }[];
    };
    const task = payloadJson.tasks?.[0];
    if (!task || task.status_code !== 20000) {
      throw new Error("DataForSEO Labs Domain Intersection failed: " + (task?.status_message || "unknown provider error"));
    }
    const result = task.result?.[0];
    const output: CompetitiveKeywordGap[] = [];
    for (const item of result?.items ?? []) {
      const keywordData = isRecord(item.keyword_data) ? item.keyword_data : {};
      const keyword = typeof keywordData.keyword === "string" ? keywordData.keyword : undefined;
      const info = isRecord(keywordData.keyword_info) ? keywordData.keyword_info : {};
      if (!keyword) continue;
      const first = isRecord(item.first_domain_serp_element) ? item.first_domain_serp_element : {};
      const second = isRecord(item.second_domain_serp_element) ? item.second_domain_serp_element : {};
      output.push({
        keyword,
        ...(finiteInteger(info.search_volume) !== undefined ? { searchVolume: finiteInteger(info.search_volume) } : {}),
        ...(finiteNumber(info.cpc) !== undefined ? { cpc: finiteNumber(info.cpc) } : {}),
        ...(finiteInteger(first.rank_absolute) !== undefined ? { competitorRank: finiteInteger(first.rank_absolute) } : {}),
        ...(finiteInteger(second.rank_absolute) !== undefined ? { phoenixRank: finiteInteger(second.rank_absolute) } : {}),
        gapType: isRecord(item.second_domain_serp_element) ? "shared" : "competitor-only",
        provenance: {
          provider: this.id,
          endpoint,
          competitorDomain: normalizeDomain(competitorDomain),
          phoenixDomain: normalizeDomain(phoenixDomain),
          locationCode: result?.location_code ?? options.locationCode ?? null,
          locationName: options.locationName ?? null,
          languageCode: result?.language_code ?? options.languageCode,
          observedAt: new Date().toISOString(),
        },
      });
    }
    return output;
  }

  async observePages(urls: readonly string[], acceptLanguage = "en"): Promise<readonly CompetitivePageSnapshot[]> {
    const unique = [...new Set(urls.filter((url) => /^https?:\\/\\//i.test(url)))].slice(0, 20);
    if (!unique.length) return [];
    const endpoint = "https://api.dataforseo.com/v3/on_page/instant_pages";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Basic " + bytesToBase64(new TextEncoder().encode(this.config.login + ":" + this.config.password)),
      },
      body: JSON.stringify(unique.map((url) => ({
        url,
        accept_language: acceptLanguage,
        browser_preset: "desktop",
        enable_browser_rendering: false,
        check_spell: false,
        validate_micromarkup: true,
      }))),
    });
    if (!response.ok) throw new Error("DataForSEO OnPage provider returned HTTP " + response.status);
    const payload = await response.json() as {
      tasks?: readonly {
        status_code?: number;
        status_message?: string;
        result?: readonly {
          items?: readonly Record<string, unknown>[];
        }[];
      }[];
    };
    const output: CompetitivePageSnapshot[] = [];
    for (const task of payload.tasks ?? []) {
      if (task.status_code !== 20000 || !task.result?.[0]) continue;
      for (const item of task.result[0].items ?? []) {
        if (item.type && item.type !== "html_page") continue;
        const url = typeof item.url === "string" ? item.url : undefined;
        if (!url) continue;
        const meta = isRecord(item.meta) ? item.meta : {};
        const checks = isRecord(item.checks) ? item.checks : {};
        const contentInfo = isRecord(meta.content) ? meta.content : {};
        output.push({
          url,
          ...(finiteInteger(item.status_code) !== undefined ? { statusCode: finiteInteger(item.status_code) } : {}),
          ...(typeof meta.title === "string" ? { title: meta.title } : {}),
          ...(typeof meta.description === "string" ? { description: meta.description } : {}),
          ...(typeof meta.canonical === "string" ? { canonicalUrl: meta.canonical } : {}),
          ...(isRecord(meta.htags) && Array.isArray(meta.htags.h1) ? { h1Count: meta.htags.h1.length } : {}),
          ...(finiteNumber(contentInfo.plain_text_word_count) !== undefined ? { wordCount: finiteNumber(contentInfo.plain_text_word_count) } : {}),
          ...(finiteInteger(meta.internal_links_count) !== undefined ? { internalLinksCount: finiteInteger(meta.internal_links_count) } : {}),
          ...(finiteInteger(meta.external_links_count) !== undefined ? { externalLinksCount: finiteInteger(meta.external_links_count) } : {}),
          ...(finiteInteger(meta.images_count) !== undefined ? { imagesCount: finiteInteger(meta.images_count) } : {}),
          ...(finiteInteger(meta.title_length) !== undefined ? { titleLength: finiteInteger(meta.title_length) } : {}),
          ...(finiteInteger(meta.description_length) !== undefined ? { descriptionLength: finiteInteger(meta.description_length) } : {}),
          ...(typeof checks.no_h1_tag === "boolean" ? { noH1Tag: checks.no_h1_tag } : {}),
          ...(typeof checks.no_title === "boolean" ? { noTitle: checks.no_title } : {}),
          ...(typeof checks.no_description === "boolean" ? { noDescription: checks.no_description } : {}),
          ...(typeof checks.seo_friendly_url === "boolean" ? { seoFriendlyUrl: checks.seo_friendly_url } : {}),
          ...(Array.isArray(item.microdata) ? { structuredDataErrors: item.microdata.filter(isRecord).filter((value) => value.errors).length } : {}),
          provenance: { provider: this.id, endpoint, observedAt: new Date().toISOString(), acceptanceLanguage: acceptLanguage },
        });
      }
    }
    return output;
  }
}

function firstUrl(...values: unknown[]): string | undefined {
  for (const value of values) if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  return undefined;
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^www\./, "").replace(/\/$/, "");
}

function finiteInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function dedupeResults(values: readonly CompetitiveResultItem[]): readonly CompetitiveResultItem[] {
  const seen = new Set<string>();
  const output: CompetitiveResultItem[] = [];
  for (const value of values) {
    const key = [value.type, value.url ?? "", value.rankAbsolute ?? ""].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

function dedupeCitations(values: readonly CompetitiveCitation[]): readonly CompetitiveCitation[] {
  const seen = new Set<string>();
  const output: CompetitiveCitation[] = [];
  for (const value of values) {
    const key = value.url.replace(/#.*$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({ ...value, position: output.length + 1 });
  }
  return output;
}

function bytesToBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}
