import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import { AIMemoryRepository, type AIMemoryOwnerScope, type AIMemoryClassification } from "./memory-repository";

export interface AIMemoryServiceOptions {
  readonly repository: AIMemoryRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export class AIMemoryService {
  constructor(private readonly options: AIMemoryServiceOptions) {}

  async create(context: RequestContext, input: {
    readonly ownerScope: AIMemoryOwnerScope; readonly ownerReference: string; readonly memoryType: string;
    readonly contentReference: string; readonly provenance: readonly string[]; readonly consentReference?: string;
    readonly classification: AIMemoryClassification; readonly version?: number; readonly expiresAt?: string;
  }) {
    await this.options.authorization.assert({ context, permission: "ai.memory.manage", requireAuthentication: true, requireWorkspace: input.ownerScope === "workspace" });
    return this.options.repository.create(context, { ...input, id: this.options.id(), now: this.options.now() });
  }

  async list(context: RequestContext, ownerScope: AIMemoryOwnerScope, ownerReference: string, limit?: number) {
    await this.options.authorization.assert({ context, permission: "ai.memory.read", requireAuthentication: true, requireWorkspace: ownerScope === "workspace" });
    return this.options.repository.list(context, ownerScope, ownerReference, limit);
  }

  async delete(context: RequestContext, id: EntityId) {
    await this.options.authorization.assert({ context, permission: "ai.memory.manage", requireAuthentication: true, requireWorkspace: false });
    return this.options.repository.delete(context, id, this.options.now());
  }
}

export const AI_MEMORY_PERMISSIONS = ["ai.memory.read", "ai.memory.manage"] as const;
