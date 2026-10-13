import { describe, it, expect, vi } from "vitest";
import {
  ScheduledSitemapCronJob,
  SITEMAP_SCHEDULE_INTERVAL_HOURS,
  SITEMAP_SCHEDULE_INTERVAL_MS,
} from "./scheduled-sitemap";
import type { SitemapCrawlerDataSource } from "./automated-sitemap";

describe("ScheduledSitemapCronJob (SEO Package Scheduled Task)", () => {
  const baseUrl = "https://qooqnos.com";

  const mockDataSource: SitemapCrawlerDataSource = {
    async getCatalogProducts() {
      return [
        {
          id: "prod-watch-1",
          name: "ساعت هوشمند",
          status: "active",
          updatedAt: "2026-04-01T00:00:00Z",
        },
      ];
    },
    async getActiveBusinessProfiles() {
      return [
        {
          id: "biz-watch-store",
          name: "فروشگاه ساعت",
          status: "active",
          updatedAt: "2026-04-01T00:00:00Z",
        },
      ];
    },
  };

  it("has default 24 hour interval constant and status tracking", () => {
    expect(SITEMAP_SCHEDULE_INTERVAL_HOURS).toBe(24);
    expect(SITEMAP_SCHEDULE_INTERVAL_MS).toBe(24 * 60 * 60 * 1000);

    const job = new ScheduledSitemapCronJob({
      dataSource: mockDataSource,
      options: { baseUrl },
    });

    const status = job.getStatus();
    expect(status.intervalHours).toBe(24);
    expect(status.lastRunAt).toBeNull();
    expect(status.isScheduled).toBe(false);
  });

  it("executes sitemap generation and tracks lastRunAt and nextRunAt properly", async () => {
    let currentTime = "2026-06-01T00:00:00.000Z";
    const job = new ScheduledSitemapCronJob({
      dataSource: mockDataSource,
      options: { baseUrl },
      now: () => currentTime,
    });

    const firstRun = await job.execute();
    expect(firstRun.triggered).toBe(true);
    expect(firstRun.reason).toBe("executed");
    expect(firstRun.lastRunAt).toBe("2026-06-01T00:00:00.000Z");
    expect(firstRun.nextRunAt).toBe("2026-06-02T00:00:00.000Z"); // Exactly 24h later
    expect(firstRun.result?.totalUrls).toBe(2);

    // If called before 24 hours have elapsed (e.g. 5 hours later), should skip
    currentTime = "2026-06-01T05:00:00.000Z";
    const tooEarlyRun = await job.execute();
    expect(tooEarlyRun.triggered).toBe(false);
    expect(tooEarlyRun.reason).toBe("skipped_not_due");
    expect(tooEarlyRun.nextRunAt).toBe("2026-06-02T00:00:00.000Z");

    // After 24 hours have elapsed (e.g. 24h and 10min later), should execute again
    currentTime = "2026-06-02T00:10:00.000Z";
    const dueRun = await job.execute();
    expect(dueRun.triggered).toBe(true);
    expect(dueRun.reason).toBe("executed");
    expect(dueRun.lastRunAt).toBe("2026-06-02T00:10:00.000Z");
    expect(dueRun.nextRunAt).toBe("2026-06-03T00:10:00.000Z");
  });

  it("invokes search engine callback / webhook on completion when configured", async () => {
    const onGenerated = vi.fn();
    const job = new ScheduledSitemapCronJob({
      dataSource: mockDataSource,
      options: { baseUrl },
      onSitemapGenerated: onGenerated,
    });

    await job.execute(true);
    expect(onGenerated).toHaveBeenCalledTimes(1);
    expect(onGenerated).toHaveBeenCalledWith(
      expect.objectContaining({
        totalUrls: 2,
        isIndex: false,
      }),
    );
  });
});
