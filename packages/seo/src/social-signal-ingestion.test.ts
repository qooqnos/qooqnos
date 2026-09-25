import { describe, expect, it } from "vitest";
import { ingestSocialSignals } from "./social-signal-ingestion";

describe("social signal ingestion", () => {
  it("normalizes X engagement signals into SEO measurements", async () => {
    const statements: Array<{ sql: string; bindings: unknown[] }> = [];
    const database = {
      run: async (sql: string, ...bindings: unknown[]) => {
        statements.push({ sql, bindings });
        return {};
      },
    } as unknown as D1Database;

    const context = {
      tenantId: "org-1",
      workspaceId: "workspace-1",
      authenticated: true,
      actorId: "test",
      module: "seo",
      operation: "test",
      requestId: "request-1",
      correlationId: "request-1",
    } as never;

    const result = await ingestSocialSignals(database, context, {
      platform: "x",
      queryText: "coffee",
      locale: "en-US",
      entityId: "entity-1",
      observedAt: "2026-09-25T00:00:00.000Z",
      raw: {
        data: [{
          id: "tweet-1",
          text: "coffee",
          public_metrics: {
            like_count: 12,
            reply_count: 3,
            retweet_count: 4,
            quote_count: 2,
            bookmark_count: 5,
            impression_count: 1000,
          },
        }],
      },
    });

    expect(result.observations).toBeGreaterThanOrEqual(7);
    expect(statements.some((item) => item.sql.includes("INSERT INTO seo_measurement_runs"))).toBe(true);
    expect(statements.some((item) => item.sql.includes("INSERT INTO seo_measurements"))).toBe(true);
    expect(statements.some((item) => item.sql.includes("UPDATE seo_measurement_runs"))).toBe(true);
    const measurementInsert = statements.find((item) => item.sql.includes("INSERT INTO seo_measurements"));
    expect(measurementInsert?.bindings[1]).toBe("org-1");
    expect(measurementInsert?.bindings[2]).toBe("workspace-1");
    expect(result.measurements.some((item) => item.metric === "impressions" && item.numericValue === 1000)).toBe(true);
  });
});
