import type { RequestContext } from "@qooqnos/core";

export type AIOperationLifecycleStatus =
  | "created"
  | "entitlement_checked"
  | "routing_selected"
  | "running"
  | "succeeded"
  | "failed"
  | "blocked_by_entitlement"
  | "blocked_by_authorization"
  | "blocked_by_safety"
  | "abstained";

export type AIUsageEventStatus = "measured" | "failed" | "reversed";

export interface AIOperationIdentity {
  readonly operationId: string;
  readonly operationType: string;
  readonly operationVersion: number;
  readonly sessionId?: string | undefined;
  readonly tenantId?: RequestContext["tenantId"];
  readonly workspaceId?: RequestContext["workspaceId"];
  readonly actorId?: RequestContext["actorId"];
  readonly requestId: RequestContext["requestId"];
  readonly correlationId: RequestContext["correlationId"];
  readonly idempotencyKey: string;
  readonly inputReference?: string | undefined;
  readonly inputHash?: string | undefined;
  readonly attemptNumber: number;
}

export interface AIEntitlementDecision {
  readonly allowed: boolean;
  readonly decision?:
    | "included"
    | "quota_consumed"
    | "credit_consumed"
    | "chargeable"
    | "hybrid"
    | "denied"
    | "temporary_unavailable";
  readonly entitlementDecisionId?: string | undefined;
  readonly entitlementKey?: string | undefined;
  readonly policyVersion?: string | undefined;
  readonly meterKey?: string | undefined;
  readonly reservedQuantity?: number | undefined;
  readonly pricingReference?: string | undefined;
  readonly reason?: string | undefined;
}

export interface AIRoutingDecisionTelemetry {
  readonly routingDecisionId: string;
  readonly operationId: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly providerVersion: string;
  readonly modelVersion: string;
  readonly fallbackGroup?: string | undefined;
  readonly occurredAt: string;
}

export interface AIUsageMeasurement {
  readonly usageEventId: string;
  readonly operationId: string;
  readonly operationType: string;
  readonly meterKey: string;
  readonly quantity: number;
  readonly unit: string;
  readonly status: AIUsageEventStatus;
  readonly idempotencyKey: string;
  readonly entitlementDecisionId?: string | undefined;
  readonly occurredAt: string;
}

export interface AIProviderCostTelemetry {
  readonly operationId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly inputUnits?: number | undefined;
  readonly outputUnits?: number | undefined;
  readonly estimatedProviderCost?: number | undefined;
  readonly costCurrency?: string | undefined;
  readonly costEstimationVersion?: string | undefined;
  readonly latencyMs?: number | undefined;
  readonly occurredAt: string;
}

/**
 * Runtime-owned economic telemetry boundary.
 * Billing remains authoritative for entitlements, quota, pricing, charges and credits.
 */
export interface AIEconomicsSink {
  operationCreated(identity: AIOperationIdentity): Promise<void> | void;
  operationStatusChanged(operationId: string, status: AIOperationLifecycleStatus): Promise<void> | void;
  entitlementDecisionRecorded(
    operationId: string,
    decision: AIEntitlementDecision,
  ): Promise<void> | void;
  routingDecisionRecorded?(decision: AIRoutingDecisionTelemetry): Promise<void> | void;
  usageMeasured(measurement: AIUsageMeasurement): Promise<void> | void;
  providerCostRecorded(telemetry: AIProviderCostTelemetry): Promise<void> | void;
}

export const AI_ECONOMIC_METER_KEYS = {
  inputTokens: "ai.input_tokens",
  outputTokens: "ai.output_tokens",
  imageUnits: "ai.image_units",
  audioSeconds: "ai.audio_seconds",
  embeddingUnits: "ai.embedding_units",
  providerUnits: "ai.provider_units",
} as const;

export function createOperationIdentity(request: {
  readonly operationId: string;
  readonly operationType: string;
  readonly operationVersion: number;
  readonly context: RequestContext;
  readonly idempotencyKey: string;
  readonly sessionId?: string | undefined;
  readonly inputReference?: string | undefined;
  readonly inputHash?: string | undefined;
  readonly attemptNumber?: number | undefined;
}): AIOperationIdentity {
  return {
    operationId: request.operationId,
    operationType: request.operationType,
    operationVersion: request.operationVersion,
    ...(request.sessionId !== undefined ? { sessionId: request.sessionId } : {}),
    ...(request.context.tenantId !== undefined ? { tenantId: request.context.tenantId } : {}),
    ...(request.context.workspaceId !== undefined ? { workspaceId: request.context.workspaceId } : {}),
    ...(request.context.actorId !== undefined ? { actorId: request.context.actorId } : {}),
    requestId: request.context.requestId,
    correlationId: request.context.correlationId,
    idempotencyKey: request.idempotencyKey,
    ...(request.inputReference !== undefined ? { inputReference: request.inputReference } : {}),
    ...(request.inputHash !== undefined ? { inputHash: request.inputHash } : {}),
    attemptNumber: request.attemptNumber ?? 1,
  };
}

export function usageMeasurements(
  operationId: string,
  operationType: string,
  idempotencyKey: string,
  usage: {
    readonly inputTokens?: number | undefined;
    readonly outputTokens?: number | undefined;
    readonly imageUnits?: number | undefined;
    readonly audioSeconds?: number | undefined;
    readonly embeddingUnits?: number | undefined;
    readonly providerUnits?: number | undefined;
  },
  entitlementDecisionId?: string | undefined,
  occurredAt = new Date().toISOString(),
): AIUsageMeasurement[] {
  const entries: Array<[keyof typeof AI_ECONOMIC_METER_KEYS, number | undefined, string]> = [
    ["inputTokens", usage.inputTokens, "tokens"],
    ["outputTokens", usage.outputTokens, "tokens"],
    ["imageUnits", usage.imageUnits, "units"],
    ["audioSeconds", usage.audioSeconds, "seconds"],
    ["embeddingUnits", usage.embeddingUnits, "units"],
    ["providerUnits", usage.providerUnits, "units"],
  ];

  return entries
    .filter(([, quantity]) => quantity !== undefined && quantity > 0)
    .map(([field, quantity, unit]) => ({
      usageEventId: `${operationId}:${field}`,
      operationId,
      operationType,
      meterKey: AI_ECONOMIC_METER_KEYS[field],
      quantity: quantity as number,
      unit,
      status: "measured" as const,
      idempotencyKey: `${idempotencyKey}:${field}`,
      ...(entitlementDecisionId !== undefined ? { entitlementDecisionId } : {}),
      occurredAt,
    }));
}
