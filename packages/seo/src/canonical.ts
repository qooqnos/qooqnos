import type { SeoEntity } from "./types";

export interface CanonicalEntitySource {
  readonly moduleId: string;
  readonly contractVersion: string;
  getEntity(entityId: string, locale: string): Promise<SeoEntity | null>;
  listRelatedEntities(entity: SeoEntity): Promise<readonly SeoEntity[]>;
}

export interface CanonicalEntityBatch {
  readonly source: CanonicalEntitySource;
  readonly entityIds: readonly string[];
  readonly locale: string;
}

export async function loadCanonicalEntityGraph(
  batch: CanonicalEntityBatch,
): Promise<{ readonly entity: SeoEntity; readonly related: readonly SeoEntity[] }[]> {
  const result: { entity: SeoEntity; related: readonly SeoEntity[] }[] = [];
  const ids = [...new Set(batch.entityIds.map((id) => id.trim()).filter(Boolean))].sort();
  for (const entityId of ids) {
    const entity = await batch.source.getEntity(entityId, batch.locale);
    if (!entity) continue;
    if (entity.sourceModule !== batch.source.moduleId) continue;
    result.push({ entity, related: await batch.source.listRelatedEntities(entity) });
  }
  return result;
}
