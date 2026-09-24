import type { SeoEntity, SeoEntityType } from "./types";

export type FreshnessVolatility = "low" | "medium" | "high" | "critical";

export interface FreshnessPolicy {
  readonly entityType: SeoEntityType;
  readonly volatility: FreshnessVolatility;
  readonly maxAgeSeconds: number;
  readonly regulatedVerificationRequired: boolean;
}

export interface FreshnessEvaluation {
  readonly stale: boolean;
  readonly ageSeconds: number;
  readonly policy: FreshnessPolicy;
  readonly reason: string;
}

const DEFAULT_POLICIES: Readonly<Record<SeoEntityType, FreshnessPolicy>> = {
  Organization: { entityType: "Organization", volatility: "medium", maxAgeSeconds: 30 * 86400, regulatedVerificationRequired: false },
  Business: { entityType: "Business", volatility: "high", maxAgeSeconds: 7 * 86400, regulatedVerificationRequired: false },
  Person: { entityType: "Person", volatility: "medium", maxAgeSeconds: 14 * 86400, regulatedVerificationRequired: false },
  Service: { entityType: "Service", volatility: "high", maxAgeSeconds: 7 * 86400, regulatedVerificationRequired: false },
  Product: { entityType: "Product", volatility: "high", maxAgeSeconds: 3 * 86400, regulatedVerificationRequired: false },
  Offer: { entityType: "Offer", volatility: "critical", maxAgeSeconds: 86400, regulatedVerificationRequired: false },
  Location: { entityType: "Location", volatility: "medium", maxAgeSeconds: 30 * 86400, regulatedVerificationRequired: false },
  Branch: { entityType: "Branch", volatility: "high", maxAgeSeconds: 3 * 86400, regulatedVerificationRequired: false },
  Category: { entityType: "Category", volatility: "low", maxAgeSeconds: 90 * 86400, regulatedVerificationRequired: false },
  Collection: { entityType: "Collection", volatility: "medium", maxAgeSeconds: 30 * 86400, regulatedVerificationRequired: false },
  Review: { entityType: "Review", volatility: "medium", maxAgeSeconds: 14 * 86400, regulatedVerificationRequired: false },
  FAQ: { entityType: "FAQ", volatility: "medium", maxAgeSeconds: 30 * 86400, regulatedVerificationRequired: false },
  Article: { entityType: "Article", volatility: "medium", maxAgeSeconds: 30 * 86400, regulatedVerificationRequired: false },
  Event: { entityType: "Event", volatility: "critical", maxAgeSeconds: 43200, regulatedVerificationRequired: false },
  Brand: { entityType: "Brand", volatility: "low", maxAgeSeconds: 90 * 86400, regulatedVerificationRequired: false },
  Credential: { entityType: "Credential", volatility: "critical", maxAgeSeconds: 86400, regulatedVerificationRequired: true },
};

export function freshnessPolicy(entityType: SeoEntityType): FreshnessPolicy {
  return DEFAULT_POLICIES[entityType];
}

export function evaluateFreshness(
  entity: SeoEntity,
  now: string,
  override?: Partial<FreshnessPolicy>,
): FreshnessEvaluation {
  const base = freshnessPolicy(entity.type);
  const policy = { ...base, ...override, entityType: entity.type };
  const nowMs = Date.parse(now);
  const updatedMs = Date.parse(entity.updatedAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(updatedMs)) {
    return { stale: true, ageSeconds: Number.POSITIVE_INFINITY, policy, reason: "Invalid timestamp prevents reliable freshness evaluation." };
  }
  const ageSeconds = Math.max(0, Math.floor((nowMs - updatedMs) / 1000));
  return {
    stale: ageSeconds > policy.maxAgeSeconds,
    ageSeconds,
    policy,
    reason: ageSeconds > policy.maxAgeSeconds ? "Entity exceeds its freshness policy." : "Entity is within its freshness policy.",
  };
}
