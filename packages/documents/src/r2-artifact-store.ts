import type { DocumentArtifactStore } from "./renderers";

export interface DocumentR2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array> | string,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> },
  ): Promise<unknown>;
}

export function createR2DocumentArtifactStore(bucket: DocumentR2Bucket): DocumentArtifactStore {
  return {
    async put({ organizationId, workspaceId, actorId, artifact, idempotencyKey }) {
      if (!organizationId.trim() || !workspaceId.trim() || !actorId.trim()) throw new Error("Document artifact tenant/actor scope is required");
      if (!idempotencyKey.trim()) throw new Error("Document artifact idempotency key is required");
      const key = "documents/" + organizationId + "/" + workspaceId + "/" + await sha256(idempotencyKey) + "/" + artifact.rendererId + "-v" + artifact.rendererVersion + "." + artifact.format;
      await bucket.put(key, artifact.bytes, {
        httpMetadata: { contentType: artifact.mediaType },
        customMetadata: {
          organizationId,
          workspaceId,
          actorId,
          sourceSnapshotHash: artifact.sourceSnapshotHash,
          rendererId: artifact.rendererId,
          rendererVersion: String(artifact.rendererVersion),
          format: artifact.format,
        },
      });
      return { artifactReference: key };
    },
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
