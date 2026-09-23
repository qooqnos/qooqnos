import type { EntityId, RequestContext } from "@qooqnos/core";
import { DiscoveryRepository, type SearchDocumentRecord, type SearchDocumentsInput, type UpsertSearchDocumentInput } from "./repository";

export interface DiscoveryServiceOptions {
  readonly repository: DiscoveryRepository;
}

export class DiscoveryService {
  constructor(private readonly options: DiscoveryServiceOptions) {}

  upsertProjection(input: UpsertSearchDocumentInput): Promise<SearchDocumentRecord> {
    return this.options.repository.upsert(input);
  }

  createIndexVersion(context: RequestContext, input: {
    readonly id: EntityId;
    readonly generation: number;
    readonly indexSchemaVersion: string;
    readonly embeddingModelVersion?: string;
    readonly status?: "draft" | "building" | "validating" | "active" | "retired" | "failed";
    readonly sourceCheckpointReference?: string;
    readonly createdBy: string;
    readonly now: string;
  }) {
    return this.options.repository.createIndexVersion(context, input);
  }

  getActiveIndexVersion(context: RequestContext) {
    return this.options.repository.getActiveIndexVersion(context);
  }

  activateIndexVersion(context: RequestContext, id: EntityId, now: string) {
    return this.options.repository.activateIndexVersion(context, id, now);
  }

  recordQueryTrace(context: RequestContext, input: Parameters<DiscoveryRepository["recordQueryTrace"]>[1]) {
    return this.options.repository.recordQueryTrace(context, input);
  }

  recordEvaluation(context: RequestContext, input: Parameters<DiscoveryRepository["recordEvaluation"]>[1]) {
    return this.options.repository.recordEvaluation(context, input);
  }

  async getProjection(context: RequestContext, id: EntityId): Promise<SearchDocumentRecord | null> {
    return this.options.repository.get(context, id);
  }

  search(input: SearchDocumentsInput): Promise<SearchDocumentRecord[]> {
    return this.options.repository.search(input);
  }
}
