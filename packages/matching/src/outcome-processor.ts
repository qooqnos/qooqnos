import type { EntityId, RequestContext } from "@qooqnos/core";
import { MatchingLearningRepository, type MatchLearningSignalType } from "./learning-repository";

export interface MatchingOutcomeOutboxEvent {
  readonly id: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly aggregateType: string;
  readonly aggregateId: EntityId;
  readonly organizationId: EntityId | null;
  readonly workspaceId: EntityId | null;
  readonly payloadJson: string;
  readonly occurredAt: string;
}

export interface MatchingOutcomeProcessorOptions {
  readonly learning: MatchingLearningRepository;
  readonly database: {
    first<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  };
}

export type MatchingOutcomeResult =
  | { readonly status: "recorded"; readonly eventId: string; readonly signalId: EntityId; readonly signalType: MatchLearningSignalType }
  | { readonly status: "ignored"; readonly eventId: string; readonly reason: "unsupported_event" | "missing_match_reference" | "ambiguous_match_candidate" };

const EVENT_SIGNAL: Readonly<Record<string, MatchLearningSignalType>> = {
  "booking.completed": "booked",
  "booking.no_show": "cancelled",
  "booking.cancelled": "cancelled",
  "commerce.order.completed": "purchased",
  "commerce.payment.completed": "accepted",
  "payment.captured": "accepted",
  "fulfillment.completed": "accepted",
};

export class MatchingOutcomeProcessor {
  constructor(private readonly options: MatchingOutcomeProcessorOptions) {}

  async process(context: RequestContext, event: MatchingOutcomeOutboxEvent): Promise<MatchingOutcomeResult> {
    const signalType = EVENT_SIGNAL[event.eventType];
    if (!signalType || event.eventVersion !== 1) {
      return { status: "ignored", eventId: event.id, reason: "unsupported_event" };
    }

    if (!event.organizationId) {
      return { status: "ignored", eventId: event.id, reason: "missing_match_reference" };
    }

    const payload = parsePayload(event.payloadJson);
    const source = await this.resolveSource(event, payload, context);
    if (!source.matchRequestId) {
      return { status: "ignored", eventId: event.id, reason: "missing_match_reference" };
    }

    const candidateId = await this.resolveCandidate(
      context,
      source.matchRequestId,
      source.matchCandidateId,
      source.businessId,
    );
    if (candidateId === "ambiguous") {
      return { status: "ignored", eventId: event.id, reason: "ambiguous_match_candidate" };
    }

    const recorded = await this.options.learning.record(context, {
      id: event.id as EntityId,
      matchRequestId: source.matchRequestId,
      ...(candidateId ? { candidateId } : {}),
      signalType,
      source: event.eventType,
      actorReference: typeof payload.actorReference === "string" ? payload.actorReference : undefined,
      metadata: {
        eventId: event.id,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventVersion: event.eventVersion,
        sourceReference: source.sourceReference,
      },
      occurredAt: event.occurredAt,
      now: event.occurredAt,
    });

    return { status: "recorded", eventId: event.id, signalId: recorded.id, signalType };
  }

  private async resolveSource(
    event: MatchingOutcomeOutboxEvent,
    payload: Record<string, unknown>,
    context: RequestContext,
  ): Promise<{
    matchRequestId: EntityId | null;
    matchCandidateId: EntityId | null;
    businessId: EntityId | null;
    sourceReference: string;
  }> {
    const directMatchRequestId = asEntityId(payload.matchRequestId);
    const directMatchCandidateId = asEntityId(payload.matchCandidateId);
    if (directMatchRequestId) {
      return {
        matchRequestId: directMatchRequestId,
        matchCandidateId: directMatchCandidateId,
        businessId: asEntityId(payload.businessId),
        sourceReference: event.aggregateId,
      };
    }

    if (event.eventType.startsWith("booking.")) {
      const row = await this.options.database.first<{
        matchRequestId: EntityId | null;
        matchCandidateId: EntityId | null;
        businessId: EntityId;
      }>(
        "SELECT match_request_id AS matchRequestId, match_candidate_id AS matchCandidateId, business_id AS businessId FROM bookings WHERE id = ? AND organization_id = ? AND workspace_id = ? LIMIT 1",
        event.aggregateId,
        event.organizationId,
        context.workspaceId ?? event.workspaceId,
      );
      return {
        matchRequestId: row?.matchRequestId ?? null,
        matchCandidateId: row?.matchCandidateId ?? null,
        businessId: row?.businessId ?? null,
        sourceReference: event.aggregateId,
      };
    }

    if (event.eventType === "commerce.order.completed") {
      const row = await this.options.database.first<{
        matchRequestId: EntityId | null;
        matchCandidateId: EntityId | null;
        businessId: EntityId;
      }>(
        "SELECT match_request_id AS matchRequestId, match_candidate_id AS matchCandidateId, business_id AS businessId FROM commerce_orders WHERE id = ? AND organization_id = ? AND workspace_id = ? LIMIT 1",
        event.aggregateId,
        event.organizationId,
        context.workspaceId ?? event.workspaceId,
      );
      return {
        matchRequestId: row?.matchRequestId ?? null,
        matchCandidateId: row?.matchCandidateId ?? null,
        businessId: row?.businessId ?? null,
        sourceReference: event.aggregateId,
      };
    }

    if (event.eventType === "fulfillment.completed") {
      const row = await this.options.database.first<{
        sourceType: "commerce_order" | "booking";
        sourceId: EntityId;
      }>(
        "SELECT source_type AS sourceType, source_id AS sourceId FROM fulfillment_orders WHERE id = ? AND organization_id = ? AND workspace_id = ? LIMIT 1",
        event.aggregateId,
        event.organizationId,
        context.workspaceId ?? event.workspaceId,
      );
      if (!row) return { matchRequestId: null, matchCandidateId: null, businessId: null, sourceReference: event.aggregateId };
      return this.resolveSourceReference(row.sourceType, row.sourceId, event, context);
    }

    if (event.eventType === "commerce.payment.completed" || event.eventType === "payment.captured") {
      const orderId = asEntityId(payload.orderId);
      if (!orderId) return { matchRequestId: null, matchCandidateId: null, businessId: null, sourceReference: event.aggregateId };
      return this.resolveSourceReference("commerce_order", orderId, event, context);
    }

    return { matchRequestId: null, matchCandidateId: null, businessId: null, sourceReference: event.aggregateId };
  }

  private async resolveSourceReference(
    sourceType: "commerce_order" | "booking",
    sourceId: EntityId,
    event: MatchingOutcomeOutboxEvent,
    context: RequestContext,
  ) {
    if (sourceType === "booking") {
      const row = await this.options.database.first<{ matchRequestId: EntityId | null; matchCandidateId: EntityId | null; businessId: EntityId }>(
        "SELECT match_request_id AS matchRequestId, match_candidate_id AS matchCandidateId, business_id AS businessId FROM bookings WHERE id = ? AND organization_id = ? AND workspace_id = ? LIMIT 1",
        sourceId, event.organizationId, context.workspaceId ?? event.workspaceId,
      );
      return {
        matchRequestId: row?.matchRequestId ?? null,
        matchCandidateId: row?.matchCandidateId ?? null,
        businessId: row?.businessId ?? null,
        sourceReference: sourceId,
      };
    }
    const row = await this.options.database.first<{ matchRequestId: EntityId | null; matchCandidateId: EntityId | null; businessId: EntityId }>(
      "SELECT match_request_id AS matchRequestId, match_candidate_id AS matchCandidateId, business_id AS businessId FROM commerce_orders WHERE id = ? AND organization_id = ? AND workspace_id = ? LIMIT 1",
      sourceId, event.organizationId, context.workspaceId ?? event.workspaceId,
    );
    return {
      matchRequestId: row?.matchRequestId ?? null,
      matchCandidateId: row?.matchCandidateId ?? null,
      businessId: row?.businessId ?? null,
      sourceReference: sourceId,
    };
  }

  private async resolveCandidate(
    context: RequestContext,
    matchRequestId: EntityId,
    explicitCandidateId: EntityId | null,
    businessId: EntityId | null,
  ): Promise<EntityId | null | "ambiguous"> {
    if (explicitCandidateId) return explicitCandidateId;
    if (!businessId) return null;
    const rows = await this.options.database.all<{ id: EntityId }>(
      "SELECT id FROM match_candidates WHERE match_request_id = ? AND business_id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) ORDER BY rank_position ASC, created_at ASC, id ASC LIMIT 2",
      matchRequestId,
      businessId,
      context.tenantId,
      context.workspaceId ?? null,
    );
    if (rows.length > 1) return "ambiguous";
    return rows[0]?.id ?? null;
  }
}

function parsePayload(payloadJson: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(payloadJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("Invalid matching outcome outbox payload JSON");
  }
}

function asEntityId(value: unknown): EntityId | null {
  return typeof value === "string" && value.trim() ? value as EntityId : null;
}
