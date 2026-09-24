import type { SeoEntityType } from "./types";

export interface EntityGraphNode {
  readonly entityId: string;
  readonly entityType: SeoEntityType;
  readonly sourceModule: string;
  readonly sourceVersion: string;
  readonly publicationState: string;
  readonly visibility: string;
  readonly locale?: string;
}

export interface EntityGraphEdge {
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly relation: string;
  readonly provenance: string;
  readonly confidence: number;
  readonly verifiedAt?: string;
}

export interface EntityGraph {
  readonly nodes: ReadonlyMap<string, EntityGraphNode>;
  readonly edges: readonly EntityGraphEdge[];
}

export function buildEntityGraph(
  nodes: readonly EntityGraphNode[],
  edges: readonly EntityGraphEdge[],
): EntityGraph {
  const nodeMap = new Map<string, EntityGraphNode>();
  for (const node of nodes) {
    if (!node.entityId.trim() || nodeMap.has(node.entityId)) continue;
    nodeMap.set(node.entityId, node);
  }

  const validEdges = edges
    .filter((edge) => edge.sourceEntityId !== edge.targetEntityId)
    .filter((edge) => nodeMap.has(edge.sourceEntityId) && nodeMap.has(edge.targetEntityId))
    .filter((edge) => Number.isFinite(edge.confidence) && edge.confidence >= 0 && edge.confidence <= 1)
    .map((edge) => ({
      ...edge,
      relation: edge.relation.trim(),
      provenance: edge.provenance.trim(),
      confidence: Math.round(edge.confidence * 1000) / 1000,
    }))
    .filter((edge) => edge.relation.length > 0 && edge.provenance.length > 0)
    .sort((left, right) =>
      left.sourceEntityId.localeCompare(right.sourceEntityId) ||
      left.targetEntityId.localeCompare(right.targetEntityId) ||
      left.relation.localeCompare(right.relation),
    );

  return { nodes: nodeMap, edges: validEdges };
}

export function relatedEntities(
  graph: EntityGraph,
  entityId: string,
): readonly EntityGraphEdge[] {
  return graph.edges.filter(
    (edge) => edge.sourceEntityId === entityId || edge.targetEntityId === entityId,
  );
}

export function graphVersionFingerprint(graph: EntityGraph): string {
  const parts = [...graph.nodes.values()]
    .map((node) => [
      node.entityId,
      node.entityType,
      node.sourceModule,
      node.sourceVersion,
      node.publicationState,
      node.visibility,
      node.locale ?? "",
    ].join("|"))
    .sort();
  const edges = graph.edges.map((edge) =>
    [
      edge.sourceEntityId,
      edge.targetEntityId,
      edge.relation,
      edge.provenance,
      edge.confidence,
      edge.verifiedAt ?? "",
    ].join("|"),
  );
  return [...parts, ...edges].join("\n");
}
