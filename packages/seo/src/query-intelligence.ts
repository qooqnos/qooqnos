import type { GeoScope, SeoEntity } from "./types";

export type SearchIntent =
  | "informational"
  | "navigational"
  | "local"
  | "transactional"
  | "commercial"
  | "comparison"
  | "recommendation"
  | "appointment"
  | "product-discovery"
  | "problem-to-provider"
  | "mixed";

export type QueryCoverageState =
  | "fully-covered"
  | "partially-covered"
  | "weakly-covered"
  | "contradicted"
  | "unsupported"
  | "intentionally-unavailable";

export interface SearchQuery {
  readonly normalizedQuery: string;
  readonly intent: SearchIntent;
  readonly locale: string;
  readonly geoScope?: GeoScope;
  readonly commercialIntent: number;
  readonly journeyStage: "learn" | "discover" | "compare" | "decide" | "act";
}

export interface QueryCoverage {
  readonly query: SearchQuery;
  readonly state: QueryCoverageState;
  readonly supportingEntityIds: readonly string[];
  readonly reason: string;
}

export function normalizeSearchQuery(query: string): string {
  return query.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function inferSearchIntent(query: string): SearchIntent {
  const value = normalizeSearchQuery(query);
  if (!value) return "mixed";
  if (/(book|appointment|reserve|schedule|رزرو|نوبت)/u.test(value)) return "appointment";
  if (/(buy|purchase|price|cost|shop|خرید|قیمت)/u.test(value)) return "transactional";
  if (/(compare|vs\.?|versus|مقایسه)/u.test(value)) return "comparison";
  if (/(best|recommend|recommended|بهترین|پیشنهاد)/u.test(value)) return "recommendation";
  if (/(near me|nearby|local|نزدیک|اطراف)/u.test(value)) return "local";
  if (/(how|what|why|guide|چگونه|چیست|راهنما)/u.test(value)) return "informational";
  return "mixed";
}

export function buildSearchQuery(
  query: string,
  locale: string,
  geoScope?: GeoScope,
): SearchQuery {
  const normalizedQuery = normalizeSearchQuery(query);
  const intent = inferSearchIntent(normalizedQuery);
  const commercialIntent =
    intent === "transactional" || intent === "appointment" || intent === "product-discovery"
      ? 1
      : intent === "commercial" || intent === "comparison" || intent === "recommendation"
        ? 0.7
        : 0.2;
  const journeyStage =
    intent === "informational"
      ? "learn"
      : intent === "comparison" || intent === "recommendation"
        ? "compare"
        : intent === "transactional" || intent === "appointment" || intent === "product-discovery"
          ? "act"
          : intent === "local"
            ? "discover"
            : "discover";
  return { normalizedQuery, intent, locale, geoScope, commercialIntent, journeyStage };
}

export function evaluateQueryCoverage(
  query: SearchQuery,
  entities: readonly SeoEntity[],
): QueryCoverage {
  const candidates = entities.filter((entity) => entity.locale === query.locale && entity.visibility === "public");
  const q = query.normalizedQuery;
  const matches = candidates.filter((entity) => {
    const haystack = [
      entity.preferredName,
      entity.summary ?? "",
      entity.description ?? "",
      ...(entity.alternateNames ?? []),
    ].join(" ").toLowerCase();
    return q.length > 0 && haystack.includes(q);
  });

  if (matches.length === 0) {
    return {
      query,
      state: "unsupported",
      supportingEntityIds: [],
      reason: "No public canonical entity representation directly supports the normalized query.",
    };
  }

  const geoMatched = query.geoScope
    ? matches.filter((entity) => entity.geoScope === query.geoScope)
    : matches;

  if (query.geoScope && geoMatched.length === 0) {
    return {
      query,
      state: "partially-covered",
      supportingEntityIds: matches.map((entity) => entity.id),
      reason: "Canonical entities support the query, but no entity matches the requested geographic scope.",
    };
  }

  const unique = [...new Set(geoMatched.map((entity) => entity.id))];
  return {
    query,
    state: unique.length > 1 ? "fully-covered" : "partially-covered",
    supportingEntityIds: unique,
    reason: unique.length > 1
      ? "Multiple canonical public entities provide direct coverage."
      : "A canonical public entity provides direct coverage.",
  };
}
