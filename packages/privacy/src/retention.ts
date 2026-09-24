import type { EntityId } from "@qooqnos/core";

export interface PrivacyRetentionContext {
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly now: string;
  readonly correlationId: string;
}

export interface PrivacyRetentionProcessor {
  readonly id: string;
  readonly moduleId: string;
  process(input: PrivacyRetentionContext): Promise<{
    readonly processed: number;
    readonly resultReference?: string;
  }>;
}

export function createPrivacyRetentionProcessor(
  processor: PrivacyRetentionProcessor,
): PrivacyRetentionProcessor {
  if (!processor.id.trim()) throw new Error("Privacy retention processor id is required");
  if (!processor.moduleId.trim()) throw new Error("Privacy retention processor moduleId is required");
  return processor;
}
