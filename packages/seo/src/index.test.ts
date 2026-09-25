import { describe, expect, it } from "vitest";
import {
  auditEntity,
  buildAnswerRepresentation,
  buildEntityGraph,
  buildGeoTruthSignal,
  buildRobotsTxt,
  buildSearchQuery,
  buildSitemapXml,
  buildSitemapIndexXml,
  SITEMAP_URL_LIMIT,
  notifyIndexNow,
  canonicalEntityUrl,
  evaluateAgenticReadiness,
  evaluateFreshness,
  evaluateQueryCoverage,
  evaluateSeoPolicy,
  generateMetadata,
  generateStructuredData,
  validateStructuredData,
  validateAnswerRepresentation,
  buildEntityPageModel,
  recommendInternalLinks,
  compareEntityRepresentations,
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
  priceRange: "$",
  telephone: "+12025550123",
  address: { addressLocality: "New York", addressCountry: "US" },
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
    const metadata = generateMetadata({ entity, canonicalBaseUrl: "https://example.com" }, url);
    expect(metadata.canonicalUrl).toBe(url);
    expect(metadata.robots).toBe("index,follow");
    expect(metadata.openGraph.url).toBe(url);
    expect(metadata.twitter.card).toBe("summary_large_image");
    expect(metadata.title).toBe("Phoenix Studio | Phoenix");
    expect(metadata.description.length).toBeLessThanOrEqual(160);
    expect(metadata.language).toBe("en");
    expect(metadata.locale).toBe("en-US");
    expect(metadata.alternates.some((item) => item.hreflang === "en-US")).toBe(true);
    expect(metadata.alternates.some((item) => item.hreflang === "x-default")).toBe(true);
    expect(metadata.openGraph.type).toBe("website");
    expect(metadata.openGraph.image).toContain("og/default.png");
    const structured = generateStructuredData({
      ...entity,
      canonicalId: "https://example.com/entities/biz-1",
      alternateNames: ["Phoenix Studio", "Phoenix"],
      sameAs: ["https://example.com/about", "not-a-url"],
      serviceArea: ["Baku", "Azerbaijan"],
      type: "Business",
    }, { canonicalUrl: url, breadcrumbs: [{ name: "Phoenix", url: "https://example.com/" }, { name: "Businesses", url: "/discover?type=business" }, { name: "Phoenix Studio", url } ] });
    expect(structured["@type"]).toBe("LocalBusiness");
    expect(structured.url).toBe(url);
    expect(structured.telephone).toBe("+12025550123");
    expect(structured.priceRange).toBe("$");
    const geoHoursStructured = generateStructuredData({
      ...entity,
      geoPoint: { latitude: 40.7128, longitude: -74.006 },
      openingHours: [{ dayOfWeek: ["https://schema.org/Monday", "https://schema.org/Tuesday"], opens: "09:00", closes: "18:00" }],
    }, { canonicalUrl: url });
    expect(geoHoursStructured.geo).toEqual({ "@type": "GeoCoordinates", latitude: 40.7128, longitude: -74.006 });
    expect(geoHoursStructured.openingHoursSpecification).toHaveLength(1);
    const locationStructured = generateStructuredData({
      ...entity,
      type: "Location",
      preferredName: "Phoenix Studio Downtown",
      geoPoint: { latitude: 40.7128, longitude: -74.006 },
      openingHours: [{ dayOfWeek: ["https://schema.org/Monday"], opens: "09:00", closes: "18:00" }],
    }, { canonicalUrl: url + "/location" });
    expect(locationStructured["@type"]).toBe("Place");
    expect(locationStructured.geo).toEqual({ "@type": "GeoCoordinates", latitude: 40.7128, longitude: -74.006 });
    expect(locationStructured.openingHoursSpecification).toHaveLength(1);
    expect(validateStructuredData(locationStructured).valid).toBe(true);
    expect(((structured.mainEntityOfPage as Record<string, unknown>).breadcrumb as Record<string, unknown>)["@type"]).toBe("BreadcrumbList");
    expect(structured["@id"]).toBe("https://example.com/entities/biz-1");
    expect(structured.sameAs).toEqual(["https://example.com/about"]);
    expect(Array.isArray(structured.areaServed)).toBe(true);
    expect(validateStructuredData(structured).valid).toBe(true);
  });

  it("builds specialized Product schema and a public Entity Page model", () => {
    const product = {
      ...entity,
      type: "Product" as const,
      preferredName: "Phoenix Chair",
      description: "A factual product description.",
      brandName: "Phoenix",
      categoryName: "Furniture",
      price: 199,
      currency: "USD",
      availability: "in_stock",
    };
    const url = canonicalEntityUrl("https://example.com", product);
    const metadata = generateMetadata({ entity: product, canonicalBaseUrl: "https://example.com" }, url);
    const structured = generateStructuredData(product, {
      canonicalUrl: url,
      breadcrumbs: [
        { name: "Phoenix", url: "https://example.com/" },
        { name: "Products", url: "/discover?type=product" },
        { name: "Phoenix Chair", url },
      ],
    });
    expect(structured["@type"]).toBe("Product");
    const variantStructured = generateStructuredData({
      ...product,
      productGroupId: "PG-001",
      variantDimensions: ["https://schema.org/color", "https://schema.org/size"],
      productVariants: [
        { id: "v-red-m", sku: "RED-M", name: "Phoenix Chair Red M", url: url + "?variant=red-m", price: 209, currency: "USD", availability: "in_stock", attributes: { color: "red", size: "M" } },
      ],
      shippingDetails: { country: "US", shippingRate: 10, currency: "USD", handlingTimeMinDays: 1, handlingTimeMaxDays: 3 },
      returnPolicy: { applicableCountry: "US", returnWindowDays: 30, returnFees: "FreeReturn", returnMethod: "ReturnByMail" },
    }, { canonicalUrl: url });
    expect(variantStructured["@type"]).toBe("ProductGroup");
    expect(variantStructured.productGroupID).toBe("PG-001");
    expect(variantStructured.variesBy).toEqual(["https://schema.org/color", "https://schema.org/size"]);
    expect(variantStructured.hasVariant).toHaveLength(1);
    expect((variantStructured.offers as Record<string, unknown>).shippingDetails).toBeDefined();
    expect((variantStructured.offers as Record<string, unknown>).hasMerchantReturnPolicy).toBeDefined();
    expect(validateStructuredData(variantStructured).valid).toBe(true);
    expect(structured.brand).toEqual({ "@type": "Brand", name: "Phoenix" });
    expect(structured.offers).toMatchObject({ "@type": "Offer", price: 199, priceCurrency: "USD", availability: "https://schema.org/InStock" });
    const page = buildEntityPageModel(
      product,
      metadata,
      buildAnswerRepresentation(product, [], "2026-09-24T00:00:00Z", url),
      [],
      "https://example.com",
    );
    expect(page.breadcrumbs).toHaveLength(3);
    expect(page.actions.some((action) => action.href.includes("/discover?q="))).toBe(true);
    expect(page.sections.some((section) => section.kind === "commerce")).toBe(true);
  });

  it("builds citation-ready, attributable answer representations", () => {
    const answer = buildAnswerRepresentation(
      entity,
      [{ fact: "Open daily", sourceEntityId: "biz-1", verifiedAt: "2026-09-24T00:00:00Z", sourceType: "business-record" }],
      "2026-09-24T00:00:00Z",
      "https://example.com/en-US/business/biz-1",
    );
    expect(answer.entityId).toBe("biz-1");
    expect(answer.locale).toBe("en-US");
    expect(answer.canonicalUrl).toBe("https://example.com/en-US/business/biz-1");
    expect(answer.confidence).toBe("verified");
    expect(answer.citationReady).toBe(true);
    expect(answer.facts).toHaveLength(1);
    expect(answer.facts[0]?.sourceType).toBe("business-record");
    expect(answer.geography?.locationId).toBe("loc-1");
    expect(answer.geography?.scope).toBe("city");
    expect(validateAnswerRepresentation(answer, entity, "2026-09-24T12:00:00Z").citationReady).toBe(true);
  });

  it("derives first-party evidence without inventing external facts", () => {
    const answer = buildAnswerRepresentation(entity, [], "2026-09-24T12:00:00Z", "https://example.com/en-US/business/biz-1");
    expect(answer.confidence).toBe("verified");
    expect(answer.citationReady).toBe(true);
    expect(answer.facts[0]?.sourceType).toBe("canonical-entity");
    expect(answer.facts[0]?.fact).toBe(entity.summary);
  });

  it("rejects stale answer evidence", () => {
    const answer = buildAnswerRepresentation(
      entity,
      [{ fact: "Open daily", sourceEntityId: "biz-1", verifiedAt: "2026-09-24T00:00:00Z", validUntil: "2026-09-24T01:00:00Z" }],
      "2026-09-25T00:00:00Z",
      "https://example.com/en-US/business/biz-1",
    );
    const validation = validateAnswerRepresentation(answer, entity, "2026-09-25T00:00:00Z");
    expect(validation.citationReady).toBe(false);
    expect(validation.issues.some((issue) => issue.code === "STALE_SOURCE")).toBe(true);
  });

  it("localizes answer questions from the canonical locale", () => {
    const answer = buildAnswerRepresentation(
      { ...entity, locale: "fa-IR", preferredName: "ققنوس" },
      [],
      "2026-09-24T00:00:00Z",
      "https://example.com/fa-IR/business/biz-1",
    );
    expect(answer.question).toBe("ققنوس چیست؟");
  });

  it("emits deterministic crawl artifacts", () => {
    const sitemap = buildSitemapXml([
      "https://example.com/b",
      "https://example.com/a",
      "https://example.com/a",
      "not-a-url",
    ]);
    expect(sitemap.indexOf("https://example.com/a")).toBeLessThan(sitemap.indexOf("https://example.com/b"));
    expect(sitemap.match(/<url>/g)).toHaveLength(2);
    const robots = buildRobotsTxt("https://example.com/sitemap.xml", undefined, {
      oaiSearchBot: true,
      gptBot: false,
      googleExtended: true,
      claudeBot: true,
      perplexityBot: true,
    });
    expect(robots).toContain("User-agent: OAI-SearchBot");
    expect(robots).toContain("User-agent: GPTBot");
    expect(robots).toContain("Disallow: /");
    expect(robots).toContain("User-agent: Google-Extended");
    expect(buildRobotsTxt("https://example.com/sitemap.xml")).toContain("Disallow: /api/");
    expect(SITEMAP_URL_LIMIT).toBe(50000);
    expect(buildSitemapIndexXml(["https://example.com/sitemap-2.xml", "https://example.com/sitemap-1.xml", "https://example.com/sitemap-1.xml"])).toContain("<sitemapindex");
  });

  it("notifies IndexNow with validated canonical URLs and preserves same-host scope", async () => {
    const requests: Request[] = [];
    const fetcher = async (input: string | URL, init?: RequestInit) => {
      requests.push(new Request(input, init));
      return new Response(null, { status: 200 });
    };
    const result = await notifyIndexNow(
      [
        "https://example.com/b#fragment",
        "https://example.com/a",
        "https://other.example/a",
        "not-a-url",
      ],
      { key: "secret", fetcher, batchLimit: 1 },
    );
    expect(result.submitted).toBe(2);
    expect(result.skipped).toBe(2);
    expect(requests).toHaveLength(2);
    const firstRequest = requests[0];
    expect(firstRequest).toBeDefined();
    const body = await firstRequest!.clone().json() as { host: string; key: string; urlList: string[] };
    expect(body.host).toBe("example.com");
    expect(body.key).toBe("secret");
    expect(body.urlList).toHaveLength(1);
  });

  it("audits crawl/indexability consistency and canonical identity", () => {
    const draftEntity = { ...entity, publicationState: "draft" as const };
    delete (draftEntity as { canonicalId?: string }).canonicalId;
    const result = auditEntity(
      draftEntity,
      "",
      "index",
      "2026-09-24T00:00:00Z",
    );
    expect(result.issues.some((item) => item.code === "INDEXABILITY_PUBLICATION_CONFLICT")).toBe(true);
    expect(result.issues.some((item) => item.code === "MISSING_CANONICAL_ID")).toBe(true);
    expect(result.status).toBe("blocked");
    expect(result.overallScore).toBeLessThan(100);
    expect(result.issues.some((item) => item.code === "MISSING_CANONICAL_URL")).toBe(false);
  });

  it("audits missing semantic relationships", () => {
    const result = auditEntity(
      { ...entity, relatedEntityIds: [] },
      "https://example.com",
      "index",
      "2026-09-24T00:00:00Z",
    );
    expect(result.issues.some((item) => item.code === "NO_RELATIONSHIPS")).toBe(true);
  });

  it("builds a truth-bound graph and deterministic internal links", () => {
    const graph = buildEntityGraph(
      [
        { entityId: "biz-1", entityType: "Business", sourceModule: "business", sourceVersion: "1", publicationState: "published", visibility: "public", preferredName: "Phoenix Studio", canonicalUrl: "https://example.com/en-US/business/phoenix-studio-biz-1" },
        { entityId: "service-1", entityType: "Service", sourceModule: "catalog", sourceVersion: "1", publicationState: "published", visibility: "public", preferredName: "Creative Service", canonicalUrl: "https://example.com/en-US/service/creative-service-service-1" },
      ],
      [{ sourceEntityId: "biz-1", targetEntityId: "service-1", relation: "offers", provenance: "catalog", confidence: 0.94 }],
    );
    expect(graph.edges).toHaveLength(1);
    expect(recommendInternalLinks(graph, "biz-1")[0]?.targetEntityId).toBe("service-1");
    expect(recommendInternalLinks(graph, "biz-1")[0]?.targetUrl).toContain("/service/creative-service-service-1");
    expect(recommendInternalLinks(graph, "service-1")[0]?.targetEntityId).toBe("biz-1");
    expect(recommendInternalLinks(graph, "service-1")[0]?.relation).toBe("relatedTo");
  });

  it("keeps geographic truth explicit", () => {
    expect(buildGeoTruthSignal(entity)?.locationId).toBe("loc-1");
    const withoutLocation = { ...entity };
    delete (withoutLocation as { locationId?: string }).locationId;
    expect(buildGeoTruthSignal({ ...withoutLocation, geoScope: "city" })).toBeNull();
    expect(buildGeoTruthSignal({ ...withoutLocation, geoScope: "country", country: "AZ" })?.country).toBe("AZ");
  });

  it("models intent, coverage, and freshness without inventing facts", () => {
    const query = buildSearchQuery("Phoenix Studio near me", "en-US", "city");
    expect(query.intent).toBe("local");
    expect(evaluateQueryCoverage(query, [entity]).state).toBe("fully-covered");
    expect(evaluateFreshness(entity, "2026-09-24T12:00:00Z").stale).toBe(false);
    expect(evaluateSeoPolicy(entity, "https://example.com/en-US/business/biz-1", "2026-10-10T00:00:00Z").indexability).toBe("noindex");
  });

  it("detects consistency and agentic readiness gaps", () => {
    const report = compareEntityRepresentations(entity, [{ ...entity, id: "biz-1", locale: "fa-IR", locationId: "other-location" }]);
    expect(report.consistencyScore).toBeLessThan(100);
    expect(evaluateAgenticReadiness(entity, "2026-09-24T12:00:00Z").actionReady).toBe(true);
  });
});
