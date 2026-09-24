import type { SeoAudit, SeoEntity, SeoAuditIssue, Indexability } from "./types";

function issue(
  code: string,
  severity: SeoAuditIssue["severity"],
  evidence: string,
  owner: string,
  recommendation: string,
): SeoAuditIssue {
  return { code, severity, evidence, owner, recommendation };
}

export function auditEntity(
  e: SeoEntity,
  canonicalUrl: string,
  indexability: string = "index",
  now: string,
): SeoAudit {
  const issues: SeoAuditIssue[] = [];
  const owner = e.sourceModule;

  if (!e.preferredName.trim()) issues.push(issue("MISSING_ENTITY_NAME", "error", "Canonical entity has no preferred name", owner, "Provide the canonical entity name"));
  if (!e.description?.trim() && !e.summary?.trim()) issues.push(issue("MISSING_DESCRIPTION", "warning", "No factual summary or description", owner, "Provide canonical factual content"));
  if (!e.relatedEntityIds?.length) issues.push(issue("NO_RELATIONSHIPS", "warning", "No semantic relationships supplied", owner, "Expose relevant canonical relationships"));
  if (e.geoScope && !e.locationId && e.geoScope !== "service-area") issues.push(issue("GEO_SCOPE_WITHOUT_LOCATION", "error", "Geographic scope exists without canonical location reference", owner, "Bind geography to canonical location data"));
  if (e.geoScope === "service-area" && !e.serviceArea?.length) issues.push(issue("SERVICE_AREA_WITHOUT_EVIDENCE", "error", "Service-area scope has no canonical service-area identifiers", owner, "Provide authoritative service-area references"));
  if (e.visibility === "public" && e.publicationState !== "published") issues.push(issue("PUBLIC_UNPUBLISHED_ENTITY", "warning", "Public entity is not published", owner, "Publish the entity or make its visibility non-public"));
  if (e.publicationState === "published" && e.visibility === "public" && !canonicalUrl.trim()) issues.push(issue("MISSING_CANONICAL_URL", "error", "Published public entity has no canonical URL", owner, "Generate a canonical URL from canonical identity"));
  if (e.publicationState !== "published" && indexability === "index") issues.push(issue("INDEXABILITY_PUBLICATION_CONFLICT", "error", "A non-published entity is marked indexable", owner, "Set noindex/excluded until publication is authoritative"));
  if (e.visibility !== "public" && indexability === "index") issues.push(issue("INDEXABILITY_VISIBILITY_CONFLICT", "error", "A non-public entity is marked indexable", owner, "Exclude non-public representations from search indexing"));
  if (!["index", "noindex", "restricted", "excluded"].includes(indexability)) issues.push(issue("INVALID_INDEXABILITY", "error", `Unknown indexability policy: ${indexability}`, owner, "Use the canonical indexability policy"));
  if (!e.canonicalId?.trim()) issues.push(issue("MISSING_CANONICAL_ID", "warning", "Entity has no explicit canonical identity reference", owner, "Bind the representation to the canonical entity identity"));
  if (e.sameAs?.some((url) => !/^https?:\/\//i.test(url))) issues.push(issue("INVALID_SAME_AS_REFERENCE", "warning", "One or more sameAs references are not absolute HTTP(S) URLs", owner, "Use authoritative absolute references only"));

  const errors = issues.filter((item) => item.severity === "error").length;
  const warnings = issues.filter((item) => item.severity === "warning").length;
  const completeness = Math.max(0, 100 - errors * 25 - warnings * 10);
  const contentQuality = e.description?.trim() ? 100 : e.summary?.trim() ? 80 : 40;
  const localRelevance = e.locationId || e.serviceArea?.length ? 100 : 50;
  const geoAnswerability = e.summary?.trim() && (e.locationId || e.serviceArea?.length || !e.geoScope) ? 100 : 60;
  const trustProvenance = e.sourceModule && e.sourceVersion ? 100 : 0;

  return {
    entityId: e.id,
    scores: {
      entityCompleteness: completeness,
      contentQuality,
      localRelevance,
      geoAnswerability,
      trustProvenance,
      technicalIndexability: indexability === "index" ? 100 : indexability === "noindex" ? 70 : 40,
    },
    issues,
    generatedAt: now,
  };
}

export type { Indexability };
