import { describe, expect, it } from "vitest";
import type { AnswerRepresentation, SeoEntity, SeoMetadata, StructuredData } from "@qooqnos/seo";
import { injectSeoRepresentation, type SeoFrontendHydration } from "./seo-frontend";

const entity: SeoEntity = {
  id: "biz-1",
  type: "Business",
  sourceModule: "business",
  sourceVersion: "1",
  publicationState: "published",
  visibility: "public",
  preferredName: "Phoenix Studio",
  summary: "A factual business summary.",
  locale: "en-US",
  country: "US",
  geoScope: "city",
  locationId: "loc-1",
  updatedAt: "2026-09-24T00:00:00Z",
};

const metadata: SeoMetadata = {
  title: "Phoenix Studio | Phoenix",
  description: "A factual business summary.",
  canonicalUrl: "https://qooqnos.com/en-US/business/phoenix-studio-biz-1",
  robots: "index,follow",
  headings: ["Phoenix Studio | Phoenix"],
  altTexts: [],
  openGraph: {
    title: "Phoenix Studio | Phoenix",
    description: "A factual business summary.",
    url: "https://qooqnos.com/en-US/business/phoenix-studio-biz-1",
    type: "website",
    locale: "en-US",
    siteName: "Phoenix",
    image: "https://qooqnos.com/og/default.png",
  },
  twitter: {
    card: "summary_large_image",
    title: "Phoenix Studio | Phoenix",
    description: "A factual business summary.",
    image: "https://qooqnos.com/og/default.png",
  },
  alternates: [
    { rel: "alternate", hreflang: "en-US", href: "https://qooqnos.com/en-US/business/phoenix-studio-biz-1" },
    { rel: "alternate", hreflang: "x-default", href: "https://qooqnos.com/en-US/business/phoenix-studio-biz-1" },
  ],
  language: "en",
  locale: "en-US",
};

const answer: AnswerRepresentation = {
  id: "answer:biz-1:en-US",
  entityId: "biz-1",
  locale: "en-US",
  question: "What is Phoenix Studio?",
  answer: "Phoenix Studio: A factual business summary.",
  canonicalUrl: metadata.canonicalUrl,
  facts: [
    {
      fact: "Open daily",
      sourceEntityId: "biz-1",
      verifiedAt: "2026-09-24T00:00:00Z",
    },
  ],
  freshnessAt: "2026-09-24T00:00:00Z",
  sourceUpdatedAt: "2026-09-24T00:00:00Z",
  confidence: "verified",
  citationReady: true,
  geography: {
    scope: "city",
    country: "US",
    locationId: "loc-1",
    serviceAreaIds: [],
    remoteAvailable: false,
  },
  limitations: [],
};

const structuredData: StructuredData = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Phoenix Studio",
};

const hydration: SeoFrontendHydration = {
  metadata,
  structuredData,
  answer,
  page: {
    canonicalUrl: metadata.canonicalUrl,
    breadcrumbs: [
      { name: "Phoenix", url: "https://qooqnos.com/" },
      { name: "Businesses", url: "https://qooqnos.com/discover?type=business" },
      { name: "Phoenix Studio", url: metadata.canonicalUrl },
    ],
    actions: [
      { kind: "primary", label: "Discover", href: "/discover?q=Phoenix%20Studio", reason: "continue-discovery" },
    ],
    relatedLinks: [
      { label: "Creative Service", url: "https://qooqnos.com/en-US/service/creative-service-service-1", relation: "offers", priority: 94 },
    ],
    sections: [
      { id: "overview", title: "Overview", kind: "overview" },
      { id: "facts", title: "Verified facts", kind: "facts" },
      { id: "relationships", title: "Related", kind: "relationships" },
      { id: "action", title: "Next action", kind: "action" },
    ],
  },
  entity: {
    id: entity.id,
    type: entity.type,
    preferredName: entity.preferredName,
    summary: entity.summary,
    locale: entity.locale,
    country: entity.country,
    geoScope: entity.geoScope,
    locationId: entity.locationId,
    updatedAt: entity.updatedAt,
  },
};

describe("SEO frontend surface", () => {
  it("injects canonical metadata, JSON-LD, answer content and hydration data into initial HTML", () => {
    const source = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta name="description" content="old">
  <meta name="robots" content="index,follow">
  <meta property="og:title" content="old">
  <link rel="canonical" href="https://qooqnos.com/">
  <title>ققنوس | Phoenix Intelligence</title>
</head>
<body><div id="app"></div></body>
</html>`;

    const html = injectSeoRepresentation(source, hydration);

    expect(html).toContain("<title>Phoenix Studio | Phoenix</title>");
    expect(html).toContain('name="description" content="A factual business summary."');
    expect(html).toContain('name="robots" content="index,follow"');
    expect(html).toContain('rel="canonical" href="https://qooqnos.com/en-US/business/phoenix-studio-biz-1"');
    expect(html).toContain('"@type":"LocalBusiness"');
    expect(html).toContain("What is Phoenix Studio?");
    expect(html).toContain("Open daily");
    expect(html).toContain("Creative Service");
    expect(html).toContain("Breadcrumb");
    expect(html).toContain("\"sourceEntityId\":\"biz-1\"");
    expect(html).toContain("\"sourceEntityId\":\"biz-1\"");
    expect(html).toContain('id="phoenix-seo-data"');
    expect(html.match(/name="description"/gi)?.length).toBe(1);
    expect(html.match(/rel="canonical"/gi)?.length).toBe(1);
  });
  it("renders a canonical Location page with GEO-aware structured data and graph links", () => {
    const locationHydration: SeoFrontendHydration = {
      ...hydration,
      metadata: { ...metadata, title: "Phoenix Downtown | Phoenix", canonicalUrl: "https://qooqnos.com/en-US/location/phoenix-downtown-location-1", openGraph: { ...metadata.openGraph, title: "Phoenix Downtown | Phoenix", url: "https://qooqnos.com/en-US/location/phoenix-downtown-location-1" }, twitter: { ...metadata.twitter, title: "Phoenix Downtown | Phoenix" } },
      structuredData: { "@context": "https://schema.org", "@type": "Place", name: "Phoenix Downtown", geo: { "@type": "GeoCoordinates", latitude: 40.4093, longitude: 49.8671 } },
      page: { ...hydration.page, canonicalUrl: "https://qooqnos.com/en-US/location/phoenix-downtown-location-1", breadcrumbs: [...hydration.page.breadcrumbs.slice(0, 2), { name: "Phoenix Downtown", url: "https://qooqnos.com/en-US/location/phoenix-downtown-location-1" }] },
      entity: { ...hydration.entity, id: "location-1", type: "Location", preferredName: "Phoenix Downtown", geoScope: "exact", locationId: "location-1", address: { addressLocality: "Baku", addressCountry: "AZ" }, updatedAt: "2026-09-25T08:00:00Z" },
    };
    const source = `<!doctype html><html><head><title>old</title></head><body><div id="app"></div></body></html>`;
    const html = injectSeoRepresentation(source, locationHydration);
    expect(html).toContain("<title>Phoenix Downtown | Phoenix</title>");
    expect(html).toContain('rel="canonical" href="https://qooqnos.com/en-US/location/phoenix-downtown-location-1"');
    expect(html).toContain('"@type":"Place"');
    expect(html).toContain('"latitude":40.4093');
    expect(html).toContain("Phoenix Downtown");
    expect(html).toContain("Breadcrumb");
    expect(html).toContain("40.4093");
    expect(html).toContain("49.8671");
    expect(html).toContain('data-seo-hydrated="true"');
  });

});
