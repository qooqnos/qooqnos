import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "./client";
import { sha256Hex } from "./hash";

export interface AnalyticsEventRecord {
  readonly id: string;
  readonly eventName: string;
  readonly eventVersion: number;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly organizationId: string | null;
  readonly workspaceId: string | null;
  readonly actorReference: string | null;
  readonly requestId: string | null;
  readonly sourceModule: string;
  readonly resourceType: string | null;
  readonly resourceId: string | null;
  readonly locale: string | null;
  readonly countryContext: string | null;
  readonly privacyClassification: string;
  readonly payloadHash: string;
  readonly ingestionStatus: "accepted" | "quarantined";
}

export interface AnalyticsMetricDefinition {
  readonly id: EntityId;
  readonly metricKey: string;
  readonly version: number;
  readonly ownerModule: string;
  readonly formula: string;
  readonly sourceEvents: readonly string[];
  readonly filters: unknown;
  readonly timezonePolicy: string;
  readonly attributionWindowSeconds: number | null;
  readonly privacyClassification: string;
  readonly status: "draft" | "active" | "retired";
}

export interface AnalyticsMetricAggregate {
  readonly id: EntityId;
  readonly organizationId: string | null;
  readonly workspaceId: string | null;
  readonly metricKey: string;
  readonly metricVersion: number;
  readonly bucketStart: string;
  readonly bucketGranularity: "hour" | "day";
  readonly value: number;
  readonly sourceCursor: string | null;
  readonly calculatedAt: string;
  readonly projectionVersion: number;
}

export interface AnalyticsOutboxEventInput {
  readonly id: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly aggregateType: string | null;
  readonly aggregateId: string | null;
  readonly organizationId: string | null;
  readonly workspaceId: string | null;
  readonly payloadJson: string;
  readonly occurredAt: string;
}

export class AnalyticsRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async ingestOutboxEvent(
    context: RequestContext,
    event: AnalyticsOutboxEventInput,
    receivedAt: string,
  ): Promise<AnalyticsEventRecord> {
    if (context.tenantId && event.organizationId !== context.tenantId) {
      throw new DatabaseError("Analytics event tenant scope does not match context");
    }
    if (context.workspaceId && event.workspaceId !== context.workspaceId) {
      throw new DatabaseError("Analytics event workspace scope does not match context");
    }
    if (!event.eventType.trim()) throw new DatabaseError("Analytics event type is required");
    if (!Number.isInteger(event.eventVersion) || event.eventVersion < 1) {
      throw new DatabaseError("Analytics event version must be a positive integer");
    }

    const payloadHash = await sha256Hex(event.payloadJson);
    const existing = await this.database.first<AnalyticsEventRecord>(
      "SELECT id, event_name AS eventName, event_version AS eventVersion, occurred_at AS occurredAt, received_at AS receivedAt, organization_id AS organizationId, workspace_id AS workspaceId, actor_reference AS actorReference, request_id AS requestId, source_module AS sourceModule, resource_type AS resourceType, resource_id AS resourceId, locale, country_context AS countryContext, privacy_classification AS privacyClassification, payload_hash AS payloadHash, ingestion_status AS ingestionStatus FROM analytics_events WHERE id = ? LIMIT 1",
      event.id,
    );
    if (existing) {
      if (existing.payloadHash !== payloadHash || existing.eventName !== event.eventType) {
        throw new DatabaseError("Analytics event id conflicts with an existing event identity");
      }
      return existing;
    }

    const sourceModule = event.eventType.split(".")[0]?.trim() || "platform";
    const privacyClassification = classifyEvent(event.eventType);
    const now = receivedAt;
    const resourceId = event.aggregateId?.trim() || null;

    await this.database.run(
      "INSERT INTO analytics_events (id,event_name,event_version,occurred_at,received_at,organization_id,workspace_id,actor_reference,request_id,source_module,resource_type,resource_id,locale,country_context,privacy_classification,payload_hash,ingestion_status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      event.id, event.eventType.trim(), event.eventVersion, event.occurredAt, receivedAt,
      event.organizationId, event.workspaceId, null, null, sourceModule, event.aggregateType, resourceId,
      null, null, privacyClassification, payloadHash, "accepted", now,
    );

    const factId = event.id + ":event";
    await this.database.run(
      "INSERT OR IGNORE INTO analytics_facts (id,event_id,organization_id,workspace_id,fact_name,numeric_value,dimensions_json,occurred_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      factId, event.id, event.organizationId, event.workspaceId,
      "event." + event.eventType.trim(), 1, null, event.occurredAt, now,
    );

    return this.getEvent(context, event.id);
  }

  async getEvent(context: RequestContext, id: string): Promise<AnalyticsEventRecord> {
    const row = await this.database.first<AnalyticsEventRecord>(
      "SELECT id, event_name AS eventName, event_version AS eventVersion, occurred_at AS occurredAt, received_at AS receivedAt, organization_id AS organizationId, workspace_id AS workspaceId, actor_reference AS actorReference, request_id AS requestId, source_module AS sourceModule, resource_type AS resourceType, resource_id AS resourceId, locale, country_context AS countryContext, privacy_classification AS privacyClassification, payload_hash AS payloadHash, ingestion_status AS ingestionStatus FROM analytics_events WHERE id = ? AND (organization_id IS NULL OR organization_id = ?) AND (workspace_id IS NULL OR workspace_id = ?) LIMIT 1",
      id, context.tenantId ?? null, context.workspaceId ?? null,
    );
    if (!row) throw new DatabaseError("Analytics event not found");
    return row;
  }

  async registerMetricDefinition(
    context: RequestContext,
    input: Omit<AnalyticsMetricDefinition, "organizationId" | "workspaceId"> & { readonly now: string },
  ): Promise<AnalyticsMetricDefinition> {
    if (!input.metricKey.trim()) throw new DatabaseError("Analytics metric key is required");
    if (!Number.isInteger(input.version) || input.version < 1) throw new DatabaseError("Analytics metric version must be positive");
    await this.database.run(
      "INSERT INTO analytics_metric_definitions (id,metric_key,version,owner_module,formula,source_events_json,filters_json,timezone_policy,attribution_window_seconds,privacy_classification,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(metric_key,version) DO UPDATE SET formula=excluded.formula, source_events_json=excluded.source_events_json, filters_json=excluded.filters_json, timezone_policy=excluded.timezone_policy, attribution_window_seconds=excluded.attribution_window_seconds, privacy_classification=excluded.privacy_classification, status=excluded.status, updated_at=excluded.updated_at",
      input.id, input.metricKey.trim(), input.version, input.ownerModule.trim(), input.formula.trim(),
      JSON.stringify(input.sourceEvents), input.filters === null ? null : JSON.stringify(input.filters),
      input.timezonePolicy.trim(), input.attributionWindowSeconds, input.privacyClassification,
      input.status, input.now, input.now,
    );
    const row = await this.database.first<AnalyticsMetricDefinition>(
      "SELECT id,metric_key AS metricKey,version,owner_module AS ownerModule,formula,source_events_json AS sourceEventsJson,filters_json AS filtersJson,timezone_policy AS timezonePolicy,attribution_window_seconds AS attributionWindowSeconds,privacy_classification AS privacyClassification,status FROM analytics_metric_definitions WHERE metric_key=? AND version=? LIMIT 1",
      input.metricKey.trim(), input.version,
    );
    if (!row) throw new DatabaseError("Analytics metric definition not found after registration");
    return {
      ...row,
      sourceEvents: JSON.parse((row as unknown as { sourceEventsJson: string }).sourceEventsJson) as string[],
      filters: parseJson((row as unknown as { filtersJson: string | null }).filtersJson),
    } as AnalyticsMetricDefinition;
  }

  async rebuildEventCountAggregate(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly metricKey: string;
      readonly metricVersion: number;
      readonly bucketStart: string;
      readonly bucketEnd: string;
      readonly bucketGranularity: "hour" | "day";
      readonly now: string;
    },
  ): Promise<AnalyticsMetricAggregate> {
    if (input.bucketEnd <= input.bucketStart) throw new DatabaseError("Analytics aggregate bucket range is invalid");
    const organizationId = context.tenantId ?? null;
    const workspaceId = context.workspaceId ?? null;
    const row = await this.database.first<{ value: number }>(
      `SELECT COUNT(*) AS value
       FROM analytics_facts
       WHERE organization_id IS ? AND workspace_id IS ?
         AND occurred_at >= ? AND occurred_at < ?`,
      organizationId, workspaceId, input.bucketStart, input.bucketEnd,
    );
    const value = Number(row?.value ?? 0);
    await this.database.run(
      "INSERT INTO analytics_metric_aggregates (id,organization_id,workspace_id,metric_key,metric_version,bucket_start,bucket_granularity,value,source_cursor,calculated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,workspace_id,metric_key,metric_version,bucket_start,bucket_granularity) DO UPDATE SET value=excluded.value, calculated_at=excluded.calculated_at, projection_version=analytics_metric_aggregates.projection_version+1",
      input.id, organizationId, workspaceId, input.metricKey, input.metricVersion, input.bucketStart,
      input.bucketGranularity, value, null, input.now,
    );
    const aggregate = await this.database.first<AnalyticsMetricAggregate>(
      "SELECT id,organization_id AS organizationId,workspace_id AS workspaceId,metric_key AS metricKey,metric_version AS metricVersion,bucket_start AS bucketStart,bucket_granularity AS bucketGranularity,value,source_cursor AS sourceCursor,calculated_at AS calculatedAt,projection_version AS projectionVersion FROM analytics_metric_aggregates WHERE organization_id IS ? AND workspace_id IS ? AND metric_key=? AND metric_version=? AND bucket_start=? AND bucket_granularity=? LIMIT 1",
      organizationId, workspaceId, input.metricKey, input.metricVersion, input.bucketStart, input.bucketGranularity,
    );
    if (!aggregate) throw new DatabaseError("Analytics aggregate not found after rebuild");
    return aggregate;
  }

