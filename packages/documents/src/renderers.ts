import type { ExportDocument } from "./export-document";

export type DocumentOutputFormat = "pdf" | "print";

export interface DocumentRenderProfile {
  readonly id: string;
  readonly version: number;
  readonly locale: string;
  readonly timezone: string;
  readonly format: DocumentOutputFormat;
  readonly options?: Readonly<Record<string, string | number | boolean>>;
}

export interface DocumentArtifact {
  readonly format: DocumentOutputFormat;
  readonly mediaType: string;
  readonly filename: string;
  readonly bytes: Uint8Array;
  readonly sourceSnapshotHash: string;
  readonly rendererId: string;
  readonly rendererVersion: number;
}

export interface DocumentRenderer {
  readonly rendererId: string;
  readonly version: number;
  readonly format: DocumentOutputFormat;
  render(document: ExportDocument, profile: DocumentRenderProfile): Promise<DocumentArtifact>;
}

export interface DocumentArtifactStore {
  put(input: {
    readonly organizationId: string;
    readonly workspaceId: string;
    readonly actorId: string;
    readonly artifact: DocumentArtifact;
    readonly idempotencyKey: string;
  }): Promise<{ readonly artifactReference: string }>;
}

export interface DocumentRendererRegistry {
  resolve(format: DocumentOutputFormat): DocumentRenderer | null;
}

export function createDocumentRendererRegistry(renderers: readonly DocumentRenderer[] = []): DocumentRendererRegistry {
  const registry = new Map<DocumentOutputFormat, DocumentRenderer>();
  for (const renderer of renderers) {
    if (!renderer.rendererId.trim()) throw new Error("Document rendererId is required");
    if (!Number.isInteger(renderer.version) || renderer.version < 1) throw new Error("Document renderer version is invalid");
    if (registry.has(renderer.format)) throw new Error("Document renderer already registered: " + renderer.format);
    registry.set(renderer.format, renderer);
  }
  return { resolve: (format) => registry.get(format) ?? null };
}

export async function renderDocument(document: ExportDocument, profile: DocumentRenderProfile, registry: DocumentRendererRegistry): Promise<DocumentArtifact> {
  if (profile.version < 1) throw new Error("Document render profile version is invalid");
  if (!profile.locale.trim() || !profile.timezone.trim()) throw new Error("Document render profile locale/timezone is required");
  const renderer = registry.resolve(profile.format);
  if (!renderer) throw new Error("No renderer registered for requested document format");
  return renderer.render(document, profile);
}
