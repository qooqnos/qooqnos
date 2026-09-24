import type { EntityGraph, EntityGraphEdge } from "./entity-graph";

export interface InternalLinkRecommendation {
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly targetType?: string;
  readonly targetLabel?: string;
  readonly targetUrl?: string;
  readonly relation: string;
  readonly priority: number;
  readonly reason: string;
}

export function recommendInternalLinks(
  graph: EntityGraph,
  sourceEntityId: string,
  limit = 8,
): readonly InternalLinkRecommendation[] {
  if (!Number.isInteger(limit) || limit <= 0) return [];

  return graph.edges
    .filter((edge) => edge.sourceEntityId === sourceEntityId || edge.targetEntityId === sourceEntityId)
    .map((edge) => ({
      edge,
      targetEntityId: edge.sourceEntityId === sourceEntityId ? edge.targetEntityId : edge.sourceEntityId,
    }))
    .filter(({ targetEntityId }) => {
      const target = graph.nodes.get(targetEntityId);
      return target?.publicationState === "published" && target.visibility === "public";
    })
    .sort((left, right) => right.edge.confidence - left.edge.confidence || left.targetEntityId.localeCompare(right.targetEntityId))
    .slice(0, limit)
    .map(({ edge, targetEntityId }) => {
      const target = graph.nodes.get(targetEntityId);
      return {
        sourceEntityId,
        targetEntityId,
        ...(target?.entityType ? { targetType: target.entityType } : {}),
        ...(target?.preferredName ? { targetLabel: target.preferredName } : {}),
        ...(target?.canonicalUrl ? { targetUrl: target.canonicalUrl } : {}),
        relation: edge.sourceEntityId === sourceEntityId ? edge.relation : "relatedTo",
        priority: Math.round(edge.confidence * 100),
        reason: "canonical-semantic-relationship",
      };
    });
}
