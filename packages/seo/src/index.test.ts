import { describe, expect, it } from "vitest";
import {
  auditEntity,
  buildAnswerRepresentation,
  buildEntityGraph,
  buildGeoTruthSignal,
  buildRobotsTxt,
  buildSitemapXml,
  canonicalEntityUrl,
  evaluateSeoPolicy,
  generateMetadata,
  generateStructuredData,
  recommendInternalLinks,
} from "./index";

const entity = {
  id: "biz-1",
  type: "Business" as const,
  sourceModule: "business",
  sourceVersion: "1",
  publicationState: "published" as const,
  visibility: "public" as const,
  preferredName: "Phoenix Studio",
  summary: "A factual business summary.",
  description: "A factual business description.",
  locale: "en-US",
  country: "US",
  geoScope: "city" as const,
  locationId: "loc-1",
  relatedEntityIds: ["service-1"],
  updatedAt: "2026-09-24T00:00:00Z",
};

describe("SEO/GEO core", () => {
  it("generates canonical policy and URL", () => {
    const url = canonicalEntityUrl("https://example.com", entity);
    expect(url).toContain("/en-US/business/");
    expect(evaluateSeoPolicy(entity, url).indexability).toBe("index");
  });

  it("generates metadata and structured data from canonical facts", () => {
    const url = canonicalEntityUrl("https://example.com", entity);
    expect(generateMetadata({ entity, canonicalBaseUrl: "https://example.com" }, url).canonicalUrl).toBe(url);
    expect(generateStructuredData(entity)["@type"]).toBe("Business");
  });

  it("builds attributable answer representations", () => {
    const answer = buildAnswerRepresentation(
      entity,
      [{ fact: "Open daily", sourceEntityId: "biz-1", verifiedAt: "2026-09-24T00:00:00Z" }],
      "2026-09-24T00:00:00Z",
    );
    expect(answer.confidence).toBe("verified");
    expect(answer.facts).toHaveLength(1);
  });

  it("emits deterministic crawl artifacts", () => {
    expect(buildSitemapXml(["https://example.com/a"])).toContain("<loc>https://example.com/a</loc>");
    expect(buildRobotsTxt("https://example.com/sitemap.xml")).toContain("Sitemap:");
  });

  it("audits missing semantic relationships", () => {
    const result = auditEntity(
      { ...entity, relatedEntityIds: [] },
      "https://example.com",
      "2026-09-24T00:00:00Z",
    );
    expect(result.issues.some((item) => item.code === "NO_RELATIONSHIPS")).toBe(true);
  });

  it("builds a truth-bound graph and deterministic internal links", () => {
    const graph = buildEntityGraph(
      [
        { entityId: "biz-1", entityType: "Business", sourceModule: "business", sourceVersion: "1", publicationState: "published", visibility: "public" },
        { entityId: "service-1", entityType: "Service", sourceModule: "catalog", sourceVersion: "1", publicationState: "published", visibility: "public" },
      ],
      [{ sourceEntityId: "biz-1", targetEntityId: "service-1", relation: "offers", provenance: "catalog", confidence: 0.94 }],
    );
    expect(graph.edges).toHaveLength(1);
    expect(recommendInternalLinks(graph, "biz-1")[0]?.targetEntityId).toBe("service-1");
  });

  it("keeps geographic truth explicit", () => {
    expect(buildGeoTruthSignal(entity)?.locationId).toBe("loc-1");
    expect(buildGeoTruthSignal({ ...entity, locationId: undefined, geoScope: "city" })).toBeNull();
  });
});
