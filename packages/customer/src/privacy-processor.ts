import type { EntityId, RequestContext } from "@qooqnos/core";
import type {
  PrivacyProcessor,
  PrivacyRetentionProcessor,
  PrivacyProcessorRequest,
  PrivacyProcessorResult,
} from "@qooqnos/privacy";
import { CustomerRepository } from "@qooqnos/database";

export interface CustomerPrivacyProcessorOptions {
  readonly repository: CustomerRepository;
}

/**
 * Customer owns customer identity/profile data. Privacy owns request orchestration,
 * while this processor owns the Customer-domain export/anonymization semantics.
 *
 * Delete is intentionally an anonymization operation: financial, audit and CRM
 * timeline evidence may have independent retention obligations and are preserved.
 */
export function createCustomerPrivacyProcessors(
  options: CustomerPrivacyProcessorOptions,
): readonly PrivacyProcessor[] {
  return [
    createCustomerExportProcessor(options),
    createCustomerDeleteProcessor(options),
  ];
}

function createCustomerExportProcessor(options: CustomerPrivacyProcessorOptions): PrivacyProcessor {
  return {
    id: "customer.privacy.export",
    moduleId: "customer",
    requestTypes: ["access", "export"],
    subjectTypes: ["customer"],
    async process(input: PrivacyProcessorRequest): Promise<PrivacyProcessorResult> {
      const context = toRequestContext(input);
      const snapshot = await options.repository.privacyExport(context, input.request.subjectId);
      return {
        status: "completed",
        processorId: "customer.privacy.export",
        action: input.request.requestType,
        resultReference: "privacy-export:" + input.request.id,
        resourceReferences: [
          snapshot.customer.id,
          ...snapshot.preferences.map((item) => item.id),
          ...snapshot.addresses.map((item) => item.id),
        ],
      };
    },
  };
}

function createCustomerDeleteProcessor(options: CustomerPrivacyProcessorOptions): PrivacyProcessor {
  return {
    id: "customer.privacy.delete",
    moduleId: "customer",
    requestTypes: ["delete"],
    subjectTypes: ["customer"],
    async process(input: PrivacyProcessorRequest): Promise<PrivacyProcessorResult> {
      const context = toRequestContext(input);
      await options.repository.privacyAnonymize(context, input.request.subjectId, input.context.now);
      return {
        status: "completed",
        processorId: "customer.privacy.delete",
        action: "delete",
        resultReference: "privacy-delete:" + input.request.id,
        resourceReferences: [input.request.subjectId],
      };
    },
  };
}

function toRequestContext(input: PrivacyProcessorRequest): RequestContext {
  return {
    tenantId: input.context.organizationId,
    ...(input.context.workspaceId ? { workspaceId: input.context.workspaceId } : {}),
    ...(input.request.requestedBy ? { actorId: input.request.requestedBy as EntityId } : {}),
    requestId: input.context.requestId,
    correlationId: input.context.correlationId,
  };
}

export function createCustomerPrivacyRetentionProcessor(
  options: CustomerPrivacyProcessorOptions,
): PrivacyRetentionProcessor {
  return {
    id: "customer.privacy.retention",
    moduleId: "customer",
    async process(input) {
      const processed = await options.repository.privacyExpirePreferences(
        { tenantId: input.organizationId, ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}) } as RequestContext,
        input.now,
      );
      return {
        processed,
        resultReference: "privacy-retention:customer-preferences:" + input.now,
      };
    },
  };
}
