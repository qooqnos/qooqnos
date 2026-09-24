import type { SeoEntity, SeoPolicy } from "./types";
import { evaluateFreshness } from "./freshness";

export function evaluateSeoPolicy(entity: SeoEntity, canonicalUrl: string, now?: string): SeoPolicy {
  if (entity.visibility !== "public") {
    return { indexability: "noindex", reason: "entity-not-public", canonicalUrl, includeInSitemap: false };
  }
  if (entity.publicationState === "deleted" || entity.publicationState === "unpublished") {
    return { indexability: "excluded", reason: "entity-not-published", canonicalUrl, includeInSitemap: false };
  }
  if (entity.publicationState !== "published") {
    return { indexability: "noindex", reason: "publication-policy", canonicalUrl, includeInSitemap: false };
  }
  if (!entity.preferredName.trim() || (!entity.summary?.trim() && !entity.description?.trim())) {
    return { indexability: "noindex", reason: "insufficient-factual-content", canonicalUrl, includeInSitemap: false };
  }
  if (now) {
    const freshness = evaluateFreshness(entity, now);
    if (freshness.stale) {
      return { indexability: "noindex", reason: "stale-source-representation", canonicalUrl, includeInSitemap: false };
    }
  }
  return { indexability: "index", reason: "policy-eligible", canonicalUrl, includeInSitemap: true };
}
