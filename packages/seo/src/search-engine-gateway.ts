import {
  BingWebmasterActions,
  GoogleSearchConsoleActions,
  YandexWebmasterActions,
  type BingWebmasterActionsConfig,
  type GoogleSearchConsoleActionsConfig,
  type SearchEngineActionRuntimeOptions,
  type SearchEngineProvider,
  type YandexWebmasterActionsConfig,
  type YandexRecrawlResult,
  type GoogleUrlInspectionResult,
} from "./search-engine-actions";

export interface SearchEngineActionGatewayConfig {
  readonly google?: GoogleSearchConsoleActionsConfig;
  readonly bing?: BingWebmasterActionsConfig;
  readonly yandex?: YandexWebmasterActionsConfig;
}

export interface SearchEngineProviderStatus {
  readonly provider: SearchEngineProvider;
  readonly configured: boolean;
  readonly capabilities: readonly string[];
}

export class SearchEngineActionGateway {
  private readonly google?: GoogleSearchConsoleActions;
  private readonly bing?: BingWebmasterActions;
  private readonly yandex?: YandexWebmasterActions;

  constructor(config: SearchEngineActionGatewayConfig) {
    this.google = config.google ? new GoogleSearchConsoleActions(config.google) : undefined;
    this.bing = config.bing ? new BingWebmasterActions(config.bing) : undefined;
    this.yandex = config.yandex ? new YandexWebmasterActions(config.yandex) : undefined;
  }

  status(): readonly SearchEngineProviderStatus[] {
    return [
      {
        provider: "google-search-console",
        configured: Boolean(this.google),
        capabilities: ["inspect_url", "submit_sitemap"],
      },
      {
        provider: "bing-webmaster",
        configured: Boolean(this.bing),
        capabilities: ["submit_url"],
      },
      {
        provider: "yandex-webmaster",
        configured: Boolean(this.yandex),
        capabilities: ["request_recrawl", "indexing_history"],
      },
    ];
  }

  async inspectGoogleUrl(url: string, languageCode?: string): Promise<GoogleUrlInspectionResult> {
    if (!this.google) throw new Error("Google Search Console actions are not configured.");
    return this.google.inspectUrl(url, languageCode);
  }

  async submitGoogleSitemap(sitemapUrl: string): Promise<void> {
    if (!this.google) throw new Error("Google Search Console actions are not configured.");
    return this.google.submitSitemap(sitemapUrl);
  }

  async submitBingUrl(url: string): Promise<void> {
    if (!this.bing) throw new Error("Bing Webmaster actions are not configured.");
    return this.bing.submitUrl(url);
  }

  async recrawlYandexUrl(url: string): Promise<YandexRecrawlResult> {
    if (!this.yandex) throw new Error("Yandex Webmaster actions are not configured.");
    return this.yandex.requestRecrawl(url);
  }

  async yandexIndexingHistory(dateFrom?: string, dateTo?: string): Promise<unknown> {
    if (!this.yandex) throw new Error("Yandex Webmaster actions are not configured.");
    return this.yandex.getIndexingHistory(dateFrom, dateTo);
  }
}

export function buildSearchEngineActionRuntime(
  values: {
    readonly maxAttempts?: string;
    readonly timeoutMs?: string;
    readonly baseDelayMs?: string;
    readonly maxDelayMs?: string;
    readonly onAudit?: SearchEngineActionRuntimeOptions["onAudit"];
  },
): SearchEngineActionRuntimeOptions {
  const number = (value: string | undefined, fallback: number): number => {
    const parsed = value === undefined ? fallback : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  return {
    maxAttempts: number(values.maxAttempts, 3),
    timeoutMs: number(values.timeoutMs, 15000),
    baseDelayMs: number(values.baseDelayMs, 500),
    maxDelayMs: number(values.maxDelayMs, 10000),
    ...(values.onAudit ? { onAudit: values.onAudit } : {}),
  };
}
