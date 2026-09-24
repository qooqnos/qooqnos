import type {
  AnswerFact,
  AnswerRepresentation,
  SeoEntity,
  SeoMetadata,
  SeoPolicy,
  StructuredData,
} from "./index";
import { auditEntity } from "./audit";
import { buildAnswerRepresentation } from "./answer";
import { buildGeoTruthSignal, type GeoTruthSignal } from "./geo";
import { type EntityGraph, graphVersionFingerprint } from "./entity-graph";
import { recommendInternalLinks, type InternalLinkRecommendation } from "./internal-links";
import { evaluateSeoPolicy } from "./policy";
import { canonicalEntityUrl } from "./url";
import { generateMetadata } from "./metadata";
import { generateStructuredData } from "./structured-data";

export interface SeoProjectionPlan {
  readonly entityId: string;
  readonly entityType: string;
  readonly sourceModule: string;
  readonly sourceVersion: string;
  readonly publicationState: string;
  readonly visibility: string;
  readonly locale: string;
  readonly canonicalUrl: string;
  readonly policy: SeoPolicy;
  readonly metadata: SeoMetadata;
  readonly structuredData: StructuredData;
  readonly answer: AnswerRepresentation;
  readonly internalLinks: readonly InternalLinkRecommendation[];
  readonly geoSignal: GeoTruthSignal | null;
  readonly audit: ReturnType<typeof auditEntity>;
  readonly dependencyFingerprint: string;
}

export interface SeoProjectionInput {
  readonly entity: SeoEntity;
  readonly canonicalBaseUrl: string;
  readonly facts?: readonly AnswerFact[];
  readonly graph?: EntityGraph;
  readonly now: string;
  readonly linkLimit?: number;
}

export function buildSeoProjectionPlan(input: SeoProjectionInput): SeoProjectionPlan {
  const canonicalUrl = canonicalEntityUrl(input.canonicalBaseUrl, input.entity);
  const policy = evaluateSeoPolicy(input.entity, canonicalUrl, input.now);
  const metadata = generateMetadata({ entity: input.entity, canonicalBaseUrl: input.canonicalBaseUrl }, canonicalUrl, policy);
  const structuredData = generateStructuredData(input.entity);
  const answer = buildAnswerRepresentation(input.entity, input.facts ?? [], input.now, canonicalUrl);
  const internalLinks = input.graph
    ? recommendInternalLinks(input.graph, input.entity.id, input.linkLimit)
    : [];
  const geoSignal = buildGeoTruthSignal(input.entity);
  const audit = auditEntity(input.entity, canonicalUrl, policy.indexability, input.now);
  const dependencyFingerprint = input.graph ? graphVersionFingerprint(input.graph) : "";

  return {
    entityId: input.entity.id,
    entityType: input.entity.type,
    sourceModule: input.entity.sourceModule,
    sourceVersion: input.entity.sourceVersion,
    publicationState: input.entity.publicationState,
    visibility: input.entity.visibility,
    locale: input.entity.locale,
    canonicalUrl,
    policy,
    metadata,
    structuredData,
    answer,
    internalLinks,
    geoSignal,
    audit,
    dependencyFingerprint,
  };
}
