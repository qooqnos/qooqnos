import { AnalyticsRepository } from "@qooqnos/database";
import { createRequestContext } from "./context";
import { getDatabase } from "./database";
import type { ApiEnv } from "./env";

export async function processAnalyticsAggregates(env: ApiEnv, now: string): Promise<{ updated: number }> {
  const database = getDatabase(env);
  if (!database) return { updated: 0 };

  const repository = new AnalyticsRepository(database);
  const context = createRequestContext({
    module: "analytics",
    operation: "analytics.aggregate.rebuild",
    actorId: "system",
    authenticated: true,
    correlationId: "analytics:" + now,
    requestId: "analytics:" + now,
  });

  await repository.registerMetricDefinition(context, {
    id: "analytics:event-count:v1",
    metricKey: "event_count",
    version: 1,
    ownerModule: "analytics",
    formula: "COUNT(analytics_facts) grouped by UTC bucket and tenant/workspace scope",
    sourceEvents: ["*"],
    filters: null,
    timezonePolicy: "utc",
    attributionWindowSeconds: null,
    privacyClassification: "business",
    status: "active",
    now,
  });

  const current = new Date(now);
  const start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate()));
  const previous = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const next = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const previousResult = await repository.rebuildEventCountWindow({
    metricKey: "event_count",
    metricVersion: 1,
    bucketStart: previous.toISOString(),
    bucketEnd: start.toISOString(),
    bucketGranularity: "day",
    now,
  });
  const currentResult = await repository.rebuildEventCountWindow({
    metricKey: "event_count",
    metricVersion: 1,
    bucketStart: start.toISOString(),
    bucketEnd: next.toISOString(),
    bucketGranularity: "day",
    now,
  });

  return { updated: previousResult + currentResult };
}
