import type { EntityId } from "@qooqnos/core";
import type { PrivacyRequestRecord, PrivacyRequestType, PrivacySubjectType } from "./repository";

export interface PrivacyProcessorContext {
  readonly requestId: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly now: string;
  readonly correlationId: string;
}

export interface PrivacyProcessorRequest {
  readonly request: PrivacyRequestRecord;
  readonly context: PrivacyProcessorContext;
}

export type PrivacyProcessorAction = "access" | "export" | "delete" | "restrict" | "correct" | "retention";

export interface PrivacyProcessorResult {
  readonly status: "completed" | "skipped";
  readonly processorId: string;
  readonly action: PrivacyProcessorAction;
  readonly resourceReferences?: readonly string[];
  readonly resultReference?: string;
}

export interface PrivacyProcessor {
  readonly id: string;
  readonly moduleId: string;
  readonly requestTypes: readonly PrivacyRequestType[];
  readonly subjectTypes: readonly PrivacySubjectType[];
  process(input: PrivacyProcessorRequest): Promise<PrivacyProcessorResult>;
}


export interface PrivacyProcessorHandler {
  readonly id: string;
  readonly moduleId: string;
  readonly requestTypes: readonly PrivacyRequestType[];
  readonly subjectTypes: readonly PrivacySubjectType[];
  execute(input: PrivacyProcessorRequest): Promise<PrivacyProcessorResult>;
}

/**
 * Creates a processor whose domain-owned handler performs the actual export/delete
 * operation. Privacy owns orchestration; the domain owns its data mutation/read model.
 */
export function createPrivacyProcessor(handler: PrivacyProcessorHandler): PrivacyProcessor {
  if (!handler.id.trim()) throw new Error("Privacy processor id is required");
  if (!handler.moduleId.trim()) throw new Error("Privacy processor moduleId is required");
  if (handler.requestTypes.length === 0) throw new Error("Privacy processor must declare request types");
  if (handler.subjectTypes.length === 0) throw new Error("Privacy processor must declare subject types");

  return {
    id: handler.id,
    moduleId: handler.moduleId,
    requestTypes: handler.requestTypes,
    subjectTypes: handler.subjectTypes,
    process: handler.execute,
  };
}

export interface PrivacyProcessorRegistry {
  resolve(
    requestType: PrivacyRequestType,
    subjectType: PrivacySubjectType,
  ): readonly PrivacyProcessor[];
}

export function createPrivacyProcessorRegistry(
  processors: readonly PrivacyProcessor[] = [],
): PrivacyProcessorRegistry {
  const seen = new Set<string>();

  for (const processor of processors) {
    if (!processor.id.trim()) throw new Error("Privacy processor id is required");
    if (!processor.moduleId.trim()) throw new Error("Privacy processor moduleId is required");
    if (seen.has(processor.id)) {
      throw new Error("Privacy processor already registered: " + processor.id);
    }
    seen.add(processor.id);
  }

  return {
    resolve(requestType, subjectType) {
      return processors.filter((processor) =>
        processor.requestTypes.includes(requestType) &&
        processor.subjectTypes.includes(subjectType)
      );
    },
  };
}
