import type { EntityId, RequestContext } from "@qooqnos/core";
import { MediaRepository, type CreateMediaAssetInput, type MediaAssetRecord, type MediaAssetStatus } from "./repository";

export interface MediaServiceOptions {
  readonly repository: MediaRepository;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export interface RegisterMediaCommand {
  readonly ownerType: string;
  readonly ownerId: EntityId;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly checksum?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export class MediaService {
  constructor(private readonly options: MediaServiceOptions) {}

  register(context: RequestContext, command: RegisterMediaCommand): Promise<MediaAssetRecord> {
    const input: CreateMediaAssetInput = {
      context,
      id: this.options.id(),
      ownerType: command.ownerType,
      ownerId: command.ownerId,
      storageKey: command.storageKey,
      mimeType: command.mimeType,
      byteSize: command.byteSize,
      checksum: command.checksum,
      metadata: command.metadata,
      now: this.options.now(),
    };
    return this.options.repository.create(input);
  }

  setStatus(context: RequestContext, id: EntityId, status: MediaAssetStatus): Promise<MediaAssetRecord> {
    return this.options.repository.setStatus(context, id, status, this.options.now());
  }
}
