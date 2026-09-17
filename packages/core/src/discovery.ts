import type { EntityId, Money, RequestContext } from "./index";

export type DiscoveryConstraintClass =
  | "hard-explicit"
  | "hard-policy"
  | "soft-explicit"
  | "soft-inferred"
  | "system-derived";

export interface DiscoveryPreference {
  readonly key: string;
  readonly value: string;
  readonly class: Extract<DiscoveryConstraintClass, "soft-explicit" | "soft-inferred">;
  readonly weight?: number;
}

export interface GeoConstraint {
  readonly latitude: number;
  readonly longitude: number;
  readonly radiusMeters?: number;
}

export interface MoneyRange {
  readonly min?: Money;
  readonly max?: Money;
}

export interface AvailabilityConstraint {
  readonly from?: string;
  readonly to?: string;
}

export interface DiscoveryFilters {
  readonly categoryIds?: readonly EntityId[];
  readonly businessIds?: readonly EntityId[];
  readonly resourceTypes?: readonly string[];
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
}

export interface DiscoveryPagination {
  readonly limit: number;
  readonly offset: number;
}

export interface DiscoveryRequest {
  readonly context: RequestContext;
  readonly tenantId: EntityId;
  readonly locale: string;
  readonly intent: string;
  readonly queryText?: string;
  readonly filters: DiscoveryFilters;
  readonly preferences: readonly DiscoveryPreference[];
  readonly location?: GeoConstraint;
  readonly budget?: MoneyRange;
  readonly availability?: AvailabilityConstraint;
  readonly pagination: DiscoveryPagination;
}

export interface EligibilityDecision {
  readonly eligible: boolean;
  readonly reasons: readonly string[];
  readonly policyVersion: string;
}

export interface DiscoveryCandidate<T = unknown> {
  readonly id: EntityId;
  readonly resourceType: string;
  readonly payload: T;
  readonly eligibility: EligibilityDecision;
  readonly signals: Readonly<Record<string, number>>;
}

export interface RankedCandidate<T = unknown> extends DiscoveryCandidate<T> {
  readonly score: number;
  readonly rank: number;
}

export interface DiscoveryResult<T = unknown> {
  readonly candidates: readonly RankedCandidate<T>[];
  readonly rankingVersion: string;
}

/** Stable deterministic ranking primitive. Eligibility is mandatory before scoring. */
export function rankEligibleCandidates<T>(
  candidates: readonly DiscoveryCandidate<T>[],
  rankingVersion = "deterministic-v1",
): DiscoveryResult<T> {
  const eligible = candidates.filter((candidate) => candidate.eligibility.eligible);
  const ranked = eligible
    .map((candidate) => ({ candidate, score: scoreSignals(candidate.signals) }))
    .sort((a, b) => b.score - a.score || String(a.candidate.id).localeCompare(String(b.candidate.id)))
    .map(({ candidate, score }, index) => ({ ...candidate, score, rank: index + 1 }));

  return { candidates: ranked, rankingVersion };
}

function scoreSignals(signals: Readonly<Record<string, number>>): number {
  return Object.values(signals).reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}
