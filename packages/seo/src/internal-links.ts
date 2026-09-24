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
    .filter((edge) => edge.sourceEntityId === sourceEntityId)
    .filter((edge) => {
      const target = graph.nodes.get(edge.targetEntityId);
      return target?.publicationState === "published" && target.visibility === "public";
    })
    .sort((left, right) => {
      const score = (edge: EntityGraphEdge) => edge.confidence;
      return score(right) - score(left) || left.targetEntityId.localeCompare(right.targetEntityId);
    })
    .slice(0, limit)
    .map((edge) => ({
      sourceEntityId: edge.sourceEntityId,
      targetEntityId: edge.targetEntityId,
      ...(target?.entityType ? { targetType: target.entityType } : {}),
      ...(target?.preferredName ? { targetLabel: target.preferredName } : {}),
      ...(target?.canonicalUrl ? { targetUrl: target.canonicalUrl } : {}),
      relation: edge.relation,
      priority: Math.round(edge.confidence * 100),
      reason: "canonical-semantic-relationship",
    }));
}
