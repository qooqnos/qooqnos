import { describe, expect, it, vi } from "vitest";
import type { AnswerRepresentation, EntityPageModel, SeoEntity, SeoMetadata, StructuredData } from "./types";
import { crawlProductionSeoPage } from "./crawler";

const canonicalUrl = "https://qooqnos.com/en-US/business/phoenix-studio-biz-1";
const metadata: SeoMetadata = {
  title: "Phoenix Studio | Phoenix",
  description: "A factual business summary.",
  canonicalUrl,
  robots: "index,follow",
  headings: ["Phoenix Studio"],
  altTexts: [],
  openGraph: { title: "Phoenix Studio | Phoenix", description: "A factual business summary.", url: canonicalUrl, type: "website", locale: "en-US" },
  twitter: { card: "summary", title: "Phoenix Studio | Phoenix", description: "A factual business summary." },
  alternates: [{ rel: "alternate", hreflang: "en-US", href: canonicalUrl }],
  language: "en",
  locale: "en-US",
};
const structuredData: StructuredData = { "@context": "https://schema.org", "@type": "LocalBusiness" };
const answer: AnswerRepresentation = {
  id: "answer-1",
  entityId: "biz-1",
  locale: "en-US",
  question: "What is Phoenix Studio?",
  answer: "Phoenix Studio is a business.",
  facts: [],
  freshnessAt: "2026-09-25T00:00:00Z",
  sourceUpdatedAt: "2026-09-25T00:00:00Z",
  confidence: "verified",
  citationReady: true,
  limitations: [],
};
const page: EntityPageModel = {
  canonicalUrl,
  breadcrumbs: [{ name: "Phoenix", url: "/" }, { name: "Businesses", url: "/discover" }],
  actions: [],
  relatedLinks: [],
  sections: [
    { id: "overview", title: "Overview", kind: "overview" },
    { id: "facts", title: "Facts", kind: "facts" },
    { id: "action", title: "Action", kind: "action" },
  ],
};
const entity: SeoEntity = {
  id: "biz-1",
  type: "Business",
  sourceModule: "business",
  sourceVersion: "1",
  publicationState: "published",
  visibility: "public",
  preferredName: "Phoenix Studio",
  locale: "en-US",
  updatedAt: "2026-09-25T00:00:00Z",
};
const expected = { canonicalUrl, metadata, structuredData, answer, page, entity };

function okHtml(): string {
  return '<!doctype html><html><head><title>Phoenix Studio | Phoenix</title><meta name="description" content="A factual business summary."><meta name="robots" content="index,follow"><link rel="canonical" href="https://qooqnos.com/en-US/business/phoenix-studio-biz-1"><script type="application/ld+json">{"@type":"LocalBusiness"}</script></head><body><main data-seo-hydrated="true"><h1>Phoenix Studio</h1><section class="seo-answer-block">Verified facts</section><script id="phoenix-seo-data" type="application/json">{}</script><nav class="seo-breadcrumbs"></nav></main></body></html>';
}

describe("production SEO crawler", () => {
  it("accepts a canonical SSR response", async () => {
    const result = await crawlProductionSeoPage(expected, async () => new Response(okHtml(), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "index,follow" },
    }));
    expect(result.errors).toHaveLength(0);
    expect(result.renderMode).toBe("ssr");
    expect(result.jsonLdCount).toBe(1);
  });

  it("detects canonical and rendering drift", async () => {
    const result = await crawlProductionSeoPage(expected, async () => new Response(
      '<html><head><title>Wrong</title><link rel="canonical" href="https://qooqnos.com/wrong"></head><body><h1>One</h1><h1>Two</h1></body></html>',
      { status: 200, headers: { "content-type": "text/html" } },
    ));
    expect(result.errors).toEqual(expect.arrayContaining([
      "Rendered canonical link does not match the persisted canonical URL.",
      "Rendered title differs from persisted SEO metadata.",
      "Rendered document does not contain JSON-LD structured data.",
    ]));
    expect(result.h1Count).toBe(2);
  });
});
