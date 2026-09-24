import type { AnswerFact, AnswerGeography, AnswerRepresentation, SeoEntity } from "./types";

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function validTimestamp(value: string | undefined): boolean {
  return Boolean(value) && Number.isFinite(Date.parse(value!));
}

function validHttpUrl(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function uniqueFacts(facts: readonly AnswerFact[]): AnswerFact[] {
  const seen = new Set<string>();
  const result: AnswerFact[] = [];
  for (const fact of facts) {
    const text = clean(fact.fact);
    const source = clean(fact.sourceEntityId);
    if (!text || !source) continue;
    const key = `${source}|${text.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      fact: text,
      sourceEntityId: source,
      ...(validTimestamp(fact.verifiedAt) ? { verifiedAt: fact.verifiedAt } : {}),
      ...(validTimestamp(fact.validUntil) ? { validUntil: fact.validUntil } : {}),
      ...(validHttpUrl(fact.provenanceUrl) ? { provenanceUrl: fact.provenanceUrl } : {}),
      ...(clean(fact.sourceType) ? { sourceType: clean(fact.sourceType) } : {}),
    });
  }
  return result;
}

function buildGeography(entity: SeoEntity): AnswerGeography | undefined {
  if (!entity.geoScope) return undefined;
  const serviceAreaIds = [...new Set((entity.serviceArea ?? []).map(clean).filter(Boolean))].sort();
  const locationId = clean(entity.locationId);
  const country = clean(entity.country);
  if (!locationId && !serviceAreaIds.length && !country) return undefined;
  return {
    scope: entity.geoScope,
    ...(clean(entity.country) ? { country: clean(entity.country) } : {}),
    ...(locationId ? { locationId } : {}),
    serviceAreaIds,
    remoteAvailable: entity.geoScope === "service-area" && serviceAreaIds.length > 0 && !locationId,
  };
}

function languageOf(locale: string): string { return locale.toLowerCase().split("-")[0] || "en"; }

function questionFor(entity: SeoEntity): string {
  const name = clean(entity.preferredName);
  const language = languageOf(entity.locale);
  const templates: Record<string, string> = {
    en: `What is ${name}?`,
    fa: `${name} چیست؟`,
    ar: `ما هو ${name}؟`,
    az: `${name} nədir?`,
    tr: `${name} nedir?`,
    ru: `Что такое ${name}?`,
    de: `Was ist ${name}?`,
    fr: `Qu'est-ce que ${name} ?`,
    es: `¿Qué es ${name}?`,
  };
  return (templates[language] ?? templates.en).trim();
}

function answerText(entity: SeoEntity): string {
  const name = clean(entity.preferredName);
  const summary = clean(entity.summary) || clean(entity.description);
  if (!name && !summary) return "";
  return [name, summary].filter(Boolean).join(": ");
}

function freshnessAt(entity: SeoEntity, facts: readonly AnswerFact[]): string {
  const verifiedAt = facts.map((fact) => fact.verifiedAt).filter((value): value is string => Boolean(value));
  const timestamps = [entity.updatedAt, ...verifiedAt]
    .filter(validTimestamp)
    .map((value) => Date.parse(value));
  if (!timestamps.length) return entity.updatedAt;
  return new Date(Math.min(...timestamps)).toISOString();
}

export function buildAnswerRepresentation(
  entity: SeoEntity,
  facts: readonly AnswerFact[],
  now: string,
  canonicalUrl?: string,
): AnswerRepresentation {
  const suppliedFacts = uniqueFacts(facts.filter((fact) => fact.sourceEntityId === entity.id));
  const canonicalSummary = clean(entity.summary) || clean(entity.description);
  const normalizedFacts = suppliedFacts.length
    ? suppliedFacts
    : canonicalSummary
      ? [{ fact: canonicalSummary, sourceEntityId: entity.id, verifiedAt: entity.updatedAt, sourceType: "canonical-entity", ...(validHttpUrl(canonicalUrl) ? { provenanceUrl: canonicalUrl } : {}) }]
      : [];
  const answer = answerText(entity);
  const restricted = entity.visibility !== "public" || entity.publicationState !== "published";
  const allFactsVerified = normalizedFacts.length > 0 && normalizedFacts.every((fact) => validTimestamp(fact.verifiedAt));
  const confidence: AnswerRepresentation["confidence"] =
    restricted ? "restricted" :
    allFactsVerified ? "verified" :
    normalizedFacts.length ? "sourced" :
    "pending-review";
  const geography = buildGeography(entity);
  const limitations: string[] = [];
  if (!normalizedFacts.length) limitations.push("No entity-attributable evidence facts were supplied.");
  if (normalizedFacts.some((fact) => !validTimestamp(fact.verifiedAt))) limitations.push("One or more evidence facts lack a valid verification timestamp.");
  if (restricted) limitations.push("Entity is not publicly published and must not be exposed as a public answer source.");
  if (geography && geography.scope === "service-area" && !geography.serviceAreaIds.length) limitations.push("Service-area scope is declared without explicit service-area references.");

  return {
    id: `answer:${entity.id}:${entity.locale}`,
    entityId: entity.id,
    locale: clean(entity.locale) || "en",
    question: questionFor(entity),
    answer,
    ...(validHttpUrl(canonicalUrl) ? { canonicalUrl } : {}),
    facts: normalizedFacts,
    freshnessAt: freshnessAt(entity, normalizedFacts),
    sourceUpdatedAt: entity.updatedAt,
    confidence,
    citationReady: validHttpUrl(canonicalUrl) && validTimestamp(now) && Boolean(answer) && confidence === "verified" && normalizedFacts.length > 0 && !limitations.includes("Entity is not publicly published and must not be exposed as a public answer source."),
    ...(geography ? { geography } : {}),
    limitations,
  };
}
