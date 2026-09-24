import type { AnswerRepresentation, SeoEntity } from "./types";

export type AnswerValidationCode =
  | "MISSING_ANSWER"
  | "MISSING_QUESTION"
  | "ENTITY_MISMATCH"
  | "INVALID_REPRESENTATION_TIMESTAMP"
  | "INVALID_FACT_TIMESTAMP"
  | "INVALID_FACT_PROVENANCE"
  | "CITATION_NOT_READY"
  | "RESTRICTED_SOURCE"
  | "STALE_SOURCE";

export interface AnswerValidationIssue {
  readonly code: AnswerValidationCode;
  readonly severity: "error" | "warning";
  readonly path: string;
  readonly message: string;
}

export interface AnswerValidationResult {
  readonly valid: boolean;
  readonly citationReady: boolean;
  readonly issues: readonly AnswerValidationIssue[];
}

function timestamp(value: string): number {
  return Date.parse(value);
}

export function validateAnswerRepresentation(
  answer: AnswerRepresentation,
  entity: SeoEntity,
  now: string,
): AnswerValidationResult {
  const issues: AnswerValidationIssue[] = [];
  if (answer.entityId !== entity.id) {
    issues.push({ code: "ENTITY_MISMATCH", severity: "error", path: "entityId", message: "Answer must be bound to the canonical entity." });
  }
  if (!answer.question.trim()) {
    issues.push({ code: "MISSING_QUESTION", severity: "error", path: "question", message: "Answer representation requires a non-empty question." });
  }
  if (!answer.answer.trim()) {
    issues.push({ code: "MISSING_ANSWER", severity: "error", path: "answer", message: "Answer representation requires a non-empty answer." });
  }
  if (!Number.isFinite(timestamp(answer.freshnessAt)) || !Number.isFinite(timestamp(answer.sourceUpdatedAt)) || !Number.isFinite(timestamp(now))) {
    issues.push({ code: "INVALID_REPRESENTATION_TIMESTAMP", severity: "error", path: "freshnessAt", message: "Answer timestamps must be valid ISO timestamps." });
  }

  const nowMs = timestamp(now);
  for (let index = 0; index < answer.facts.length; index += 1) {
    const fact = answer.facts[index];
    if (fact.sourceEntityId !== entity.id) {
      issues.push({ code: "ENTITY_MISMATCH", severity: "error", path: `facts[${index}].sourceEntityId`, message: "Answer facts must cite the canonical entity." });
    }
    if (fact.verifiedAt && !Number.isFinite(timestamp(fact.verifiedAt))) {
      issues.push({ code: "INVALID_FACT_TIMESTAMP", severity: "error", path: `facts[${index}].verifiedAt`, message: "Fact verification timestamp is invalid." });
    }
    if (fact.validUntil && !Number.isFinite(timestamp(fact.validUntil))) {
      issues.push({ code: "INVALID_FACT_TIMESTAMP", severity: "error", path: `facts[${index}].validUntil`, message: "Fact validity timestamp is invalid." });
    }
    if (fact.provenanceUrl) {
      try {
        const url = new URL(fact.provenanceUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("invalid protocol");
      } catch {
        issues.push({ code: "INVALID_FACT_PROVENANCE", severity: "error", path: `facts[${index}].provenanceUrl`, message: "Fact provenance URL must be HTTP(S)." });
      }
    }
    if (fact.verifiedAt && Number.isFinite(nowMs) && timestamp(fact.verifiedAt) > nowMs) {
      issues.push({ code: "INVALID_FACT_TIMESTAMP", severity: "warning", path: `facts[${index}].verifiedAt`, message: "Fact verification timestamp is in the future." });
    }
    if (fact.validUntil && Number.isFinite(nowMs) && timestamp(fact.validUntil) < nowMs) {
      issues.push({ code: "STALE_SOURCE", severity: "warning", path: `facts[${index}].validUntil`, message: "Fact is past its declared validity window." });
    }
  }

  if (entity.visibility !== "public" || entity.publicationState !== "published") {
    issues.push({ code: "RESTRICTED_SOURCE", severity: "error", path: "entity", message: "Non-public or unpublished entities cannot be citation-ready public answer sources." });
  }
  if (answer.citationReady && (answer.confidence !== "verified" || answer.facts.length === 0)) {
    issues.push({ code: "CITATION_NOT_READY", severity: "error", path: "citationReady", message: "Citation readiness requires verified evidence facts." });
  }

  const valid = issues.every((issue) => issue.severity !== "error");
  const citationReady = valid && answer.citationReady && answer.confidence === "verified" && answer.facts.length > 0;
  return { valid, citationReady, issues };
}
