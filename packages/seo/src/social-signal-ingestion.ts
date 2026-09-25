import type { RequestContext } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import { SeoObservabilityRepository, type SeoProviderObservation } from "./observability";
import type { SocialPlatform } from "./social-intelligence";

export interface SocialSignalIngestionInput {
  readonly platform: SocialPlatform;
  readonly queryText: string;
  readonly locale: string;
  readonly entityId?: string;
  readonly raw: unknown;
  readonly observedAt: string;
}

export interface SocialSignalIngestionResult {
  readonly providerId: string;
  readonly observations: number;
  readonly measurements: readonly SeoProviderObservation[];
}

export async function ingestSocialSignals(
  database: D1Database,
  context: RequestContext,
  input: SocialSignalIngestionInput,
): Promise<SocialSignalIngestionResult> {
  const repository = new SeoObservabilityRepository(database);
  const runId = "seo-social:" + crypto.randomUUID();
  const providerId = "social:" + input.platform;
  const surface = "social:" + input.platform;
  const measurements = normalizeSocialObservations(input);
  await repository.createMeasurementRun(context, {
    id: runId,
    providerId,
    surface,
    queryText: input.queryText,
    locale: input.locale,
    ...(input.entityId ? { entityId: input.entityId, entityType: "social-linked-entity" } : {}),
    startedAt: input.observedAt,
    provenance: { providerId, platform: input.platform, source: "social-intelligence", observedAt: input.observedAt },
  });
  for (const [index, observation] of measurements.entries()) {
    await repository.record(context, {
      id: runId + ":" + index,
      ...observation,
      ...(input.entityId && !observation.entityId ? { entityId: input.entityId } : {}),
      observedAt: input.observedAt,
    });
  }
  await repository.completeMeasurementRun(context, {
    id: runId,
    status: measurements.length ? "succeeded" : "partial",
    completedAt: input.observedAt,
    observationCount: measurements.length,
  });
  return { providerId, observations: measurements.length, measurements };
}

function normalizeSocialObservations(input: SocialSignalIngestionInput): readonly SeoProviderObservation[] {
  const raw = input.raw;
  const observations: SeoProviderObservation[] = [];
  const pushNumeric = (metric: string, value: unknown, provenance: Record<string, unknown>): void => {
    if (typeof value === "number" && Number.isFinite(value)) {
      observations.push({ surface: "social:" + input.platform, metric, numericValue: value, provenance });
    }
  };
  const pushText = (metric: string, value: unknown, provenance: Record<string, unknown>): void => {
    if (typeof value === "string" && value.trim()) {
      observations.push({ surface: "social:" + input.platform, metric, textValue: value.trim(), provenance });
    }
  };
  const provenance = { platform: input.platform, query: input.queryText, locale: input.locale, source: "provider-observed" };

  if (isRecord(raw) && Array.isArray(raw.data)) {
    for (const item of raw.data.filter(isRecord).slice(0, 100)) {
      const itemId = typeof item.id === "string" ? item.id : undefined;
      const itemProv = { ...provenance, ...(itemId ? { externalId: itemId } : {}) };
      pushNumeric("content-count", 1, itemProv);
      pushNumeric("likes", numberAt(item, "like_count"), itemProv);
      pushNumeric("comments", numberAt(item, "comments_count"), itemProv);
      pushNumeric("shares", numberAt(item, "shares_count"), itemProv);
      if (isRecord(item.public_metrics)) {
        pushNumeric("likes", numberAt(item.public_metrics, "like_count"), itemProv);
        pushNumeric("comments", numberAt(item.public_metrics, "reply_count"), itemProv);
        pushNumeric("shares", numberAt(item.public_metrics, "retweet_count"), itemProv);
        pushNumeric("quotes", numberAt(item.public_metrics, "quote_count"), itemProv);
        pushNumeric("bookmarks", numberAt(item.public_metrics, "bookmark_count"), itemProv);
        pushNumeric("impressions", numberAt(item.public_metrics, "impression_count"), itemProv);
      }
      if (typeof item.message === "string") pushText("content-text", item.message, itemProv);
      if (typeof item.caption === "string") pushText("content-text", item.caption, itemProv);
      if (typeof item.text === "string") pushText("content-text", item.text, itemProv);
    }
  }

  if (isRecord(raw) && isRecord(raw.data) && Array.isArray(raw.data.children)) {
    for (const child of raw.data.children.filter(isRecord).slice(0, 100)) {
      const data = isRecord(child.data) ? child.data : child;
      const itemProv = { ...provenance, ...(typeof data.id === "string" ? { externalId: data.id } : {}) };
      pushNumeric("content-count", 1, itemProv);
      pushNumeric("score", numberAt(data, "score"), itemProv);
      pushNumeric("comments", numberAt(data, "num_comments"), itemProv);
      pushNumeric("upvote-ratio", numberAt(data, "upvote_ratio"), itemProv);
    }
  }

  if (isRecord(raw) && Array.isArray(raw.items)) {
    for (const item of raw.items.filter(isRecord).slice(0, 100)) {
      const itemProv = { ...provenance, ...(typeof item.id === "string" ? { externalId: item.id } : {}) };
      pushNumeric("content-count", 1, itemProv);
      pushNumeric("likes", numberAt(item, "like_count"), itemProv);
      pushNumeric("comments", numberAt(item, "comment_count"), itemProv);
      pushNumeric("shares", numberAt(item, "share_count"), itemProv);
      pushNumeric("impressions", numberAt(item, "impression_count"), itemProv);
      pushNumeric("saves", numberAt(item, "save_count"), itemProv);
    }
  }

  if (isRecord(raw) && isRecord(raw.data) && Array.isArray(raw.data.trends)) {
    for (const trend of raw.data.trends.filter(isRecord).slice(0, 100)) {
      const itemProv = { ...provenance, ...(typeof trend.name === "string" ? { trend: trend.name } : {}) };
      pushNumeric("trend-growth-wow", numberAt(trend, "pct_growth_wow"), itemProv);
      pushNumeric("trend-growth-mom", numberAt(trend, "pct_growth_mom"), itemProv);
      pushNumeric("trend-growth-yoy", numberAt(trend, "pct_growth_yoy"), itemProv);
      pushText("trend-keyword", trend.name, itemProv);
    }
  }

  if (isRecord(raw) && Array.isArray(raw.elements)) {
    for (const element of raw.elements.filter(isRecord).slice(0, 100)) {
      const stats = isRecord(element.totalShareStatistics) ? element.totalShareStatistics : element;
      const itemProv = { ...provenance, ...(typeof element.share === "string" ? { externalId: element.share } : {}) };
      pushNumeric("impressions", numberAt(stats, "impressionCount"), itemProv);
      pushNumeric("clicks", numberAt(stats, "clickCount"), itemProv);
      pushNumeric("likes", numberAt(stats, "likeCount"), itemProv);
      pushNumeric("comments", numberAt(stats, "commentCount"), itemProv);
      pushNumeric("shares", numberAt(stats, "shareCount"), itemProv);
      pushNumeric("engagement", numberAt(stats, "engagement"), itemProv);
    }
  }

  return observations;
}

function numberAt(value: Record<string, unknown>, key: string): number | undefined {
  return typeof value[key] === "number" && Number.isFinite(value[key]) ? value[key] as number : undefined;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
