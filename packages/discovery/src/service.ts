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

  async getProjection(context: RequestContext, id: EntityId): Promise<SearchDocumentRecord | null> {
    return this.options.repository.get(context, id);
  }

  search(input: SearchDocumentsInput): Promise<SearchDocumentRecord[]> {
    return this.options.repository.search(input);
  }
}
