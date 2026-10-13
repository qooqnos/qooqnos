import {
  AutomatedSitemapGeneratorService,
  type SitemapGenerationOptions,
  type SitemapGenerationResult,
  type SitemapCrawlerDataSource,
} from "./automated-sitemap";
import type { D1Database } from "@qooqnos/database";

export interface ScheduledSitemapJobConfig {
  readonly sitemapService?: AutomatedSitemapGeneratorService | undefined;
  readonly dataSource?: SitemapCrawlerDataSource | D1Database | undefined;
  readonly options?: Partial<SitemapGenerationOptions> | undefined;
  /**
   * Interval in hours between scheduled runs. Defaults to 24 (24 hours).
   */
  readonly intervalHours?: number | undefined;
  readonly now?: (() => string) | undefined;
  /**
   * Optional webhook or search engine submission callback when sitemap finishes generating.
   */
  readonly onSitemapGenerated?: ((result: SitemapGenerationResult) => Promise<void> | void) | undefined;
}

export interface ScheduledSitemapExecutionResult {
  readonly triggered: boolean;
  readonly reason: "executed" | "skipped_not_due" | "error";
  readonly lastRunAt?: string | undefined;
  readonly nextRunAt: string;
  readonly result?: SitemapGenerationResult | undefined;
  readonly error?: string | undefined;
}

export const SITEMAP_SCHEDULE_INTERVAL_HOURS = 24;
export const SITEMAP_SCHEDULE_INTERVAL_MS = SITEMAP_SCHEDULE_INTERVAL_HOURS * 60 * 60 * 1000;

/**
 * Scheduled Sitemap Cron Job Task
 * Runs every 24 hours (86,400,000 ms) to re-crawl catalog and business entities,
 * regenerating updated sitemaps for search engine indexers.
 */
export class ScheduledSitemapCronJob {
  private readonly intervalMs: number;
  private readonly nowFn: () => string;
  private readonly service: AutomatedSitemapGeneratorService;
  private lastRunTimestampMs: number = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;

  constructor(private readonly config: ScheduledSitemapJobConfig = {}) {
    const hours = config.intervalHours ?? SITEMAP_SCHEDULE_INTERVAL_HOURS;
    this.intervalMs = hours * 60 * 60 * 1000;
    this.nowFn = config.now ?? (() => new Date().toISOString());

    if (config.sitemapService) {
      this.service = config.sitemapService;
    } else {
      this.service = new AutomatedSitemapGeneratorService(
        config.dataSource,
        config.options,
      );
    }
  }

  /**
   * Returns current schedule status and due dates
   */
  getStatus(): {
    readonly isScheduled: boolean;
    readonly lastRunAt: string | null;
    readonly nextRunAt: string;
    readonly intervalHours: number;
  } {
    const nextRunMs = this.lastRunTimestampMs > 0 ? this.lastRunTimestampMs + this.intervalMs : Date.parse(this.nowFn());
    return {
      isScheduled: this.timer !== null,
      lastRunAt: this.lastRunTimestampMs > 0 ? new Date(this.lastRunTimestampMs).toISOString() : null,
      nextRunAt: new Date(nextRunMs).toISOString(),
      intervalHours: this.intervalMs / (60 * 60 * 1000),
    };
  }

  /**
   * Executes the sitemap generation task. If force is false, checks if 24 hours have elapsed.
   */
  async execute(force = false): Promise<ScheduledSitemapExecutionResult> {
    const currentNowIso = this.nowFn();
    const currentNowMs = Date.parse(currentNowIso);

    if (!force && this.lastRunTimestampMs > 0 && currentNowMs - this.lastRunTimestampMs < this.intervalMs) {
      const nextRunAt = new Date(this.lastRunTimestampMs + this.intervalMs).toISOString();
      return {
        triggered: false,
        reason: "skipped_not_due",
        lastRunAt: new Date(this.lastRunTimestampMs).toISOString(),
        nextRunAt,
      };
    }

    try {
      this.isRunning = true;
      const result = await this.service.generateSitemap(this.config.options);
      this.lastRunTimestampMs = currentNowMs;

      if (this.config.onSitemapGenerated) {
        await this.config.onSitemapGenerated(result);
      }

      const nextRunAt = new Date(currentNowMs + this.intervalMs).toISOString();

      return {
        triggered: true,
        reason: "executed",
        lastRunAt: currentNowIso,
        nextRunAt,
        result,
      };
    } catch (err) {
      const nextRunAt = new Date(currentNowMs + this.intervalMs).toISOString();
      return {
        triggered: false,
        reason: "error",
        ...(this.lastRunTimestampMs > 0 ? { lastRunAt: new Date(this.lastRunTimestampMs).toISOString() } : {}),
        nextRunAt,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Starts the recurring timer (interval)
   */
  start(): void {
    if (this.timer) return;

    // Trigger immediate run on start if never run before
    if (this.lastRunTimestampMs === 0) {
      void this.execute(true);
    }

    this.timer = setInterval(() => {
      void this.execute(false);
    }, Math.min(this.intervalMs, 60 * 60 * 1000)); // Tick at least once an hour or at interval
  }

  /**
   * Stops the recurring timer
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
