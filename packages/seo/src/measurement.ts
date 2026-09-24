import type { SeoVisibilityMeasurement } from "./measurement-providers";

export interface SeoMeasurementQuery {
  readonly id?: string;
  readonly queryText: string;
  readonly locale: string;
  readonly locationId?: string;
  readonly entityId?: string;
  readonly entityType?: string;
  readonly canonicalUrl?: string;
}

export interface SeoMeasurementBatchResult {
  readonly providerId: string;
  readonly surface: "search-engine" | "ai-answer";
  readonly queryId?: string;
  readonly queryText: string;
  readonly locale: string;
  readonly entityId?: string;
  readonly entityType?: string;
  readonly observations: readonly SeoVisibilityMeasurement[];
  readonly observedAt: string;
}

export function measurementQuery(
  input: Record<string, unknown>,
): SeoMeasurementQuery | null {
  if (typeof input.queryText !== "string" || !input.queryText.trim()) return null;
  if (typeof input.locale !== "string" || !input.locale.trim()) return null;
  return {
    queryText: input.queryText.trim(),
    locale: input.locale.trim(),
    ...(typeof input.id === "string" ? { id: input.id } : {}),
    ...(typeof input.locationId === "string" ? { locationId: input.locationId } : {}),
    ...(typeof input.entityId === "string" ? { entityId: input.entityId } : {}),
    ...(typeof input.entityType === "string" ? { entityType: input.entityType } : {}),
    ...(typeof input.canonicalUrl === "string" ? { canonicalUrl: input.canonicalUrl } : {}),
  };
}
