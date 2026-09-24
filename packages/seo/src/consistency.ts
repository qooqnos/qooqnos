import type { SeoEntity } from "./types";

export interface ConsistencyIssue {
  readonly field: "name" | "description" | "location" | "locale" | "publication";
  readonly severity: "warning" | "error";
  readonly evidence: readonly string[];
  readonly recommendation: string;
}

export interface ConsistencyReport {
  readonly entityId: string;
  readonly consistent: boolean;
  readonly consistencyScore: number;
  readonly issues: readonly ConsistencyIssue[];
}

export function compareEntityRepresentations(
  entity: SeoEntity,
  peers: readonly SeoEntity[],
): ConsistencyReport {
  const comparable = peers.filter((peer) => peer.id === entity.id && peer.locale !== entity.locale);
  const issues: ConsistencyIssue[] = [];

  const names = [entity.preferredName, ...comparable.map((peer) => peer.preferredName)].map((value) => value.trim()).filter(Boolean);
  if (new Set(names.map((value) => value.toLowerCase())).size > 1) {
    issues.push({
      field: "name",
      severity: "warning",
      evidence: names,
      recommendation: "Verify localized identity naming against the canonical entity.",
    });
  }

  const locations = [entity.locationId ?? "", ...comparable.map((peer) => peer.locationId ?? "")];
  if (new Set(locations.filter(Boolean)).size > 1) {
    issues.push({
      field: "location",
      severity: "error",
      evidence: locations.filter(Boolean),
      recommendation: "Resolve conflicting canonical location references before publication.",
    });
  }

  const states = [entity.publicationState, ...comparable.map((peer) => peer.publicationState)];
  if (states.some((state) => state !== "published")) {
    issues.push({
      field: "publication",
      severity: "warning",
      evidence: states,
      recommendation: "Ensure localized representations follow the source publication lifecycle.",
    });
  }

  return {
    entityId: entity.id,
    consistent: issues.every((issue) => issue.severity !== "error"),
    consistencyScore: Math.max(0, 100 - issues.reduce((sum, issue) => sum + (issue.severity === "error" ? 30 : 10), 0)),
    issues,
  };
}
