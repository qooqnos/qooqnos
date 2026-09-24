import type { SeoEntity } from "./types";
import { evaluateFreshness } from "./freshness";
import { buildGeoTruthSignal } from "./geo";

export interface AgenticReadiness {
  readonly entityId: string;
  readonly discoverable: boolean;
  readonly qualificationReady: boolean;
  readonly comparisonReady: boolean;
  readonly actionReady: boolean;
  readonly reasons: readonly string[];
}

export function evaluateAgenticReadiness(entity: SeoEntity, now: string): AgenticReadiness {
  const reasons: string[] = [];
  const fresh = evaluateFreshness(entity, now);
  const geo = buildGeoTruthSignal(entity);

  if (entity.visibility !== "public" || entity.publicationState !== "published") reasons.push("entity-is-not-publicly-published");
  if (!entity.preferredName.trim() || !(entity.summary?.trim() || entity.description?.trim())) reasons.push("insufficient-canonical-description");
  if (fresh.stale) reasons.push("source-is-stale");
  if (entity.type === "Business" || entity.type === "Service" || entity.type === "Product") {
    if (!geo) reasons.push("geographic-truth-is-missing");
  }

  const discoverable = reasons.length === 0;
  const qualificationReady = discoverable && Boolean(entity.relatedEntityIds?.length);
  const comparisonReady = qualificationReady && Boolean(entity.alternateNames?.length || entity.description?.trim());
  const actionReady = comparisonReady && (
    entity.type === "Business" ||
    entity.type === "Service" ||
    entity.type === "Product" ||
    entity.type === "Offer"
  );

  return { entityId: entity.id, discoverable, qualificationReady, comparisonReady, actionReady, reasons };
}
