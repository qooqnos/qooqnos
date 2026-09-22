import type { EntityId, RequestContext } from "@qooqnos/core";
import type { BillingAIEntitlementService } from "@qooqnos/billing";
import { AiRuntimeRepository } from "./runtime-repository";

export interface AiRuntimeServiceOptions {
  readonly repository: AiRuntimeRepository;
  readonly entitlement: BillingAIEntitlementService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export interface StartAiOperationInput {
  readonly operationTypeId: EntityId;
  readonly operationType: string;
  readonly operationVersion: number;
  readonly requestId: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly businessId?: EntityId;
  readonly inputReference?: string;
  readonly inputHash?: string;
  readonly promptReference?: string;
  readonly schemaReference?: string;
  readonly policyReference?: string;
  readonly modelSelectionReference?: string;
}

export class AiRuntimeService {
  constructor(private readonly options: AiRuntimeServiceOptions) {}

  async startOperation(
    context: RequestContext,
    input: StartAiOperationInput,
  ) {
    const operation = await this.options.repository.createOperation(context, {
      id: this.options.id(),
      operationTypeId: input.operationTypeId,
      operationType: input.operationType,
      operationVersion: input.operationVersion,
      requestId: input.requestId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      inputReference: input.inputReference,
      inputHash: input.inputHash,
      promptReference: input.promptReference,
      schemaReference: input.schemaReference,
      policyReference: input.policyReference,
      modelSelectionReference: input.modelSelectionReference,
      now: this.options.now(),
    });

    if (input.businessId) {
      const entitlement = await this.options.entitlement.evaluate({
        context,
        operationId: operation.id,
        operationType: input.operationType,
        operationVersion: input.operationVersion,
        businessId: input.businessId,
        idempotencyKey: input.idempotencyKey,
      });

      if (!entitlement.allowed) {
        return {
          operation: await this.options.repository.setOperationStatus(
            context,
            operation.id,
            "blocked",
            this.options.now(),
          ),
          entitlement,
        };
      }

      await this.options.repository.setOperationStatus(
        context,
        operation.id,
        "entitlement_checked",
        this.options.now(),
      );
    }

    const started = await this.options.repository.setOperationStatus(
      context,
      operation.id,
      "started",
      this.options.now(),
    );

    return {
      operation: started,
      entitlement: null,
    };
  }

  async recordProviderAttempt(
    context: RequestContext,
    input: {
      readonly operationId: EntityId;
      readonly attemptNumber: number;
      readonly providerId: EntityId;
      readonly modelId?: EntityId;
      readonly status: string;
      readonly providerRequestId?: string;
      readonly requestReference?: string;
      readonly responseReference?: string;
      readonly startedAt: string;
      readonly completedAt?: string;
      readonly latencyMs?: number;
      readonly inputUnits?: number;
      readonly outputUnits?: number;
    },
  ) {
    return this.options.repository.recordProviderAttempt(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async recordResult(
    context: RequestContext,
    input: {
      readonly operationId: EntityId;
      readonly status: "succeeded" | "partially_succeeded" | "failed" | "blocked" | "abstained";
      readonly validatedOutputReference?: string;
      readonly schemaVersionReference?: string;
      readonly providerId?: EntityId;
      readonly modelId?: EntityId;
      readonly safetyOutcome?: string;
      readonly provenance?: readonly string[];
      readonly warnings?: readonly string[];
      readonly abstention?: Readonly<Record<string, unknown>>;
      readonly attemptSummary?: Readonly<Record<string, unknown>>;
      readonly errorClassification?: string;
      readonly usage?: {
        readonly attemptId?: EntityId;
        readonly operationType: string;
        readonly operationVersion: number;
        readonly meterUnit: string;
        readonly quantity: number;
        readonly providerId?: EntityId;
        readonly modelId?: EntityId;
        readonly entitlementDecisionReference?: string;
        readonly billingUsageReference?: string;
        readonly idempotencyKey: string;
      };
    },
  ): Promise<void> {
    await this.options.repository.recordResult(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });

    if (input.usage) {
      await this.options.repository.recordUsage(context, {
        id: this.options.id(),
        operationId: input.operationId,
        attemptId: input.usage.attemptId,
        operationType: input.usage.operationType,
        operationVersion: input.usage.operationVersion,
        meterUnit: input.usage.meterUnit,
        quantity: input.usage.quantity,
        providerId: input.usage.providerId,
        modelId: input.usage.modelId,
        entitlementDecisionReference: input.usage.entitlementDecisionReference,
        billingUsageReference: input.usage.billingUsageReference,
        idempotencyKey: input.usage.idempotencyKey,
        now: this.options.now(),
      });
    }
  }
}
