import type { GeoScope, SeoEntity } from "./types";

export interface GeoTruthSignal {
  readonly entityId: string;
  readonly scope: GeoScope;
  readonly locationId: string | null;
  readonly serviceAreaIds: readonly string[];
  readonly remoteAvailable: boolean;
  readonly country: string | null;
  readonly sourceUpdatedAt: string;
}

export function buildGeoTruthSignal(entity: SeoEntity): GeoTruthSignal | null {
  const scope = entity.geoScope;
  const hasLocation = Boolean(entity.locationId?.trim());
  const serviceAreaIds = (entity.serviceArea ?? []).filter((id) => id.trim().length > 0);
  if (!scope) return null;
  const country = entity.country?.trim() || null;
  if (!hasLocation && serviceAreaIds.length === 0 && !country) return null;

  return {
    entityId: entity.id,
    scope,
    locationId: hasLocation ? entity.locationId! : null,
    serviceAreaIds: [...new Set(serviceAreaIds)].sort(),
    remoteAvailable: scope === "service-area" && serviceAreaIds.length > 0 && !hasLocation,
    country,
    sourceUpdatedAt: entity.updatedAt,
  };
}

export function geographicTruthKey(signal: GeoTruthSignal): string {
  return [
    signal.entityId,
    signal.scope,
    signal.locationId ?? "",
    signal.serviceAreaIds.join(","),
    signal.country ?? "",
    signal.remoteAvailable ? "remote" : "local",
  ].join("|");
}
