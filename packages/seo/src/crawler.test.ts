import { describe, expect, it } from 'vitest';
import { crawlProductionSeoPage } from './crawler';
const expected = {
  canonicalUrl: 'https://qooqnos.com/en-US/business/phoenix-studio-biz-1',
  metadata: { title: 'Phoenix Studio | Phoenix', description: 'A factual business summary.', robots: 'index,follow' } as any,
  structuredData: { '@context': 'https://schema.org', '@type': 'LocalBusiness' } as any,
  answer: { citationReady: true } as any,
  page: { breadcrumbs: [{ name: 'Phoenix', url: '/' }, { name: 'Businesses', url: '/discover' }] } as any,
  entity: { id: 'biz-1' } as any,
};
function okHtml(): string { return '<!doctype html><html><head><title>Phoenix Studio | Phoenix</title><meta name="description" content="A factual business summary."><meta name="robots" content="index,follow"><link rel="canonical" href="https://qooqnos.com/en-US/business/phoenix-studio-biz-1"><script type="application/ld+json">{"@type":"LocalBusiness"}</script></head><body><main data-seo-hydrated="true"><h1>Phoenix Studio</h1><section class="seo-answer-block">Verified facts</section><script id="phoenix-seo-data" type="application/json">{}</script><nav class="seo-breadcrumbs"></nav></main></body></html>'; }
describe('production SEO crawler', () => {
  it('accepts a canonical SSR response', async () => {
    const result = await crawlProductionSeoPage(expected, async () => new Response(okHtml(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'index,follow' } }));
    expect(result.errors).toHaveLength(0); expect(result.renderMode).toBe('ssr'); expect(result.jsonLdCount).toBe(1);
  });
  it('detects canonical and rendering drift', async () => {
    const result = await crawlProductionSeoPage(expected, async () => new Response('<html><head><title>Wrong</title><link rel="canonical" href="https://qooqnos.com/wrong"></head><body><h1>One</h1><h1>Two</h1></body></html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    expect(result.errors).toEqual(expect.arrayContaining(['Rendered canonical link does not match the persisted canonical URL.', 'Rendered title differs from persisted SEO metadata.', 'Rendered document does not contain JSON-LD structured data.']));
    expect(result.h1Count).toBe(2);
  });
});

