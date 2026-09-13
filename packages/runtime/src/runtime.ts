import type { RequestContext } from "@phoenix/core";

export interface ModuleManifest {
  readonly id: string;
  readonly version: string;
  readonly dependencies: readonly string[];
  readonly permissions: readonly string[];
}

export interface RuntimeHealth {
  readonly status: "ok" | "degraded" | "failed";
  readonly database: "unknown" | "ok" | "failed";
  readonly modules: number;
}

export interface Runtime {
  readonly manifests: readonly ModuleManifest[];
  createContext(input: Omit<RequestContext, "requestId" | "correlationId"> & Partial<Pick<RequestContext, "requestId" | "correlationId">>): RequestContext;
  health(): RuntimeHealth;
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createRuntime(manifests: readonly ModuleManifest[] = []): Runtime {
  validateManifests(manifests);

  return {
    manifests,
    createContext(input) {
      return {
        ...input,
        requestId: input.requestId ?? (id("req") as RequestContext["requestId"]),
        correlationId: input.correlationId ?? (id("cor") as RequestContext["correlationId"]),
      };
    },
    health() {
      return { status: "ok", database: "unknown", modules: manifests.length };
    },
  };
}

export function validateManifests(manifests: readonly ModuleManifest[]): void {
  const ids = new Set<string>();
  for (const manifest of manifests) {
    if (!manifest.id || !manifest.version) throw new Error("Invalid module manifest");
    if (ids.has(manifest.id)) throw new Error(`Duplicate module manifest: ${manifest.id}`);
    ids.add(manifest.id);
  }

  for (const manifest of manifests) {
    for (const dependency of manifest.dependencies) {
      if (!ids.has(dependency)) throw new Error(`Missing module dependency: ${manifest.id} -> ${dependency}`);
    }
  }
}

/** Deterministic topological ordering; dependencies always boot before dependents. */
export function orderManifestsByDependencies<T extends ModuleManifest>(manifests: readonly T[]): T[] {
  validateManifests(manifests);
  const byId = new Map(manifests.map((manifest) => [manifest.id, manifest]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: T[] = [];

  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Cyclic module dependency: ${id}`);
    const manifest = byId.get(id);
    if (!manifest) throw new Error(`Missing module dependency: ${id}`);

    visiting.add(id);
    for (const dependency of [...manifest.dependencies].sort()) visit(dependency);
    visiting.delete(id);
    visited.add(id);
    ordered.push(manifest);
  };

  for (const manifest of [...manifests].sort((a, b) => a.id.localeCompare(b.id))) visit(manifest.id);
  return ordered;
}
