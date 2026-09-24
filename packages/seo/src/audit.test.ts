import { describe, expect, it } from "vitest";
import { auditEntity } from "./audit";
import { buildAnswerRepresentation } from "./answer";
import { buildEntityPageModel } from "./entity-page";
import { generateMetadata } from "./metadata";
import { generateStructuredData } from "./structured-data";
import { evaluateSeoPolicy } from "./policy";
import type { SeoEntity } from "./types";

const baseEntity: SeoEntity = {
  id: "product-1",
  type: "Product",
  sourceModule: "catalog",
  sourceVersion: "1",
  publicationState: "published",
  visibility: "public",
  preferredName: "Phoenix Chair",
  summary: "A factual product summary with useful canonical context.",
  description: "A factual product description with enough detail for a public entity page.",
  locale: "en-US",
  country: "US",
  geoScope: "country",
  serviceArea: ["US"],
  canonicalId: "product-1",
  price: 199,
  currency: "USD",
  availability: "in_stock",
  brandName: "Phoenix",
  categoryName: "Furniture",
  updatedAt: "2026-09-24T00:00:00Z",
};

function surface(entity: SeoEntity = baseEntity) {
  const canonicalUrl = "https://qooqnos.com/en-US/product/" + entity.preferredName.toLowerCase().replaceAll(" ", "-") + "-" + entity.id;
  const policy = evaluateSeoPolicy(entity, canonicalUrl, "2026-09-24T12:00:00Z");
  const metadata = generateMetadata({ entity, canonicalBaseUrl: "https://qooqnos.com" }, canonicalUrl, policy);
  const answer = buildAnswerRepresentation(entity, [], "2026-09-24T12:00:00Z", canonicalUrl);
  const breadcrumbs = [
    { name: "Phoenix", url: "https://qooqnos.com/" },
    { name: "Products", url: "https://qooqnos.com/discover?type=product" },
    { name: entity.preferredName, url: canonicalUrl },
  ];
  const structuredData = generateStructuredData(entity, { canonicalUrl, breadcrumbs });
  const page = buildEntityPageModel(entity, metadata, answer, [], "https://qooqnos.com");
  return { canonicalUrl, policy, metadata, answer, structuredData, page };
}

describe("SEO audit quality gate", () => {
  it("passes a coherent public Product projection with only advisory gaps", () => {
    const s = surface();
    const audit = auditEntity(baseEntity, s.canonicalUrl, "index", "2026-09-24T12:00:00Z", {
      metadata: s.metadata,
      structuredData: s.structuredData,
      answer: s.answer,
      page: s.page,
      policy: s.policy,
      now: "2026-09-24T12:00:00Z",
    });
    expect(audit.status).not.toBe("blocked");
    expect(audit.overallScore).toBeGreaterThanOrEqual(80);
    expect(audit.scores.metadataQuality).toBe(100);
    expect(audit.scores.structuredDataQuality).toBe(100);
  });

  it("blocks publication when metadata canonical diverges", () => {
    const s = surface();
    const audit = auditEntity(baseEntity, s.canonicalUrl, "index", "2026-09-24T12:00:00Z", {
      ...s,
      metadata: { ...s.metadata, canonicalUrl: "https://qooqnos.com/wrong" },
      now: "2026-09-24T12:00:00Z",
    });
    expect(audit.status).toBe("blocked");
    expect(audit.blockingIssueCodes).toContain("METADATA_CANONICAL_MISMATCH");
  });

  it("blocks non-public entities marked indexable", () => {
    const entity = { ...baseEntity, visibility: "private" as const };
    const audit = auditEntity(entity, "https://qooqnos.com/private", "index", "2026-09-24T12:00:00Z");
    expect(audit.status).toBe("blocked");
    expect(audit.blockingIssueCodes).toContain("INDEXABILITY_VISIBILITY_CONFLICT");
  });

  it("catches malformed structured data and Answer provenance", () => {
    const s = surface();
    const answer = { ...s.answer, citationReady: true, canonicalUrl: "not-a-url" };
    const audit = auditEntity(baseEntity, s.canonicalUrl, "index", "2026-09-24T12:00:00Z", {
      ...s,
      structuredData: { ...s.structuredData, url: "not-a-url" },
      answer,
      now: "2026-09-24T12:00:00Z",
    });
    expect(audit.status).toBe("blocked");
    expect(audit.blockingIssueCodes).toEqual(expect.arrayContaining([
      "STRUCTURED_DATA_INVALID_URL",
      "STRUCTURED_DATA_CANONICAL_MISMATCH",
      "ANSWER_INVALID_FACT_PROVENANCE",
    ]));
  });

  it("blocks stale public sources before indexing", () => {
    const s = surface({ ...baseEntity, updatedAt: "2026-08-01T00:00:00Z" });
    const audit = auditEntity(
      { ...baseEntity, updatedAt: "2026-08-01T00:00:00Z" },
      s.canonicalUrl,
      "index",
      "2026-09-24T12:00:00Z",
      { ...s, now: "2026-09-24T12:00:00Z" },
    );
    expect(audit.status).toBe("blocked");
    expect(audit.blockingIssueCodes).toContain("STALE_ENTITY_SOURCE");
  });
});
