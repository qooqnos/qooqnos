import type { AnswerRepresentation, EntityPageModel, SeoEntity, SeoMetadata, StructuredData } from './types';
export interface ProductionCrawlerFetch { (input: RequestInfo | URL, init?: RequestInit): Promise<Response>; }
export interface SeoCrawlerExpected { readonly canonicalUrl: string; readonly metadata: SeoMetadata; readonly structuredData: StructuredData; readonly answer: AnswerRepresentation; readonly page: EntityPageModel; readonly entity: SeoEntity; }
export interface SeoCrawlerResult { readonly url: string; readonly status: number; readonly finalUrl: string; readonly contentType: string; readonly indexable: boolean; readonly canonicalUrl?: string; readonly title?: string; readonly description?: string; readonly robots?: string; readonly h1Count: number; readonly jsonLdCount: number; readonly hasAnswer: boolean; readonly hasHydration: boolean; readonly renderMode: 'ssr' | 'unknown'; readonly errors: readonly string[]; readonly warnings: readonly string[]; }
const BOT_USER_AGENT = 'PhoenixSEOProductionCrawler/1.0 (+https://qooqnos.com/robots.txt)';
export async function crawlProductionSeoPage(expected: SeoCrawlerExpected, fetcher: ProductionCrawlerFetch = fetch): Promise<SeoCrawlerResult> {
  const errors: string[] = []; const warnings: string[] = []; let response: Response;
  try { response = await fetcher(expected.canonicalUrl, { method: 'GET', redirect: 'manual', headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': BOT_USER_AGENT, 'x-phoenix-seo-crawl': '1' } }); }
  catch (error) { return { url: expected.canonicalUrl, status: 0, finalUrl: expected.canonicalUrl, contentType: '', indexable: false, h1Count: 0, jsonLdCount: 0, hasAnswer: false, hasHydration: false, renderMode: 'unknown', errors: [error instanceof Error ? error.message : 'Production SEO crawl failed.'], warnings }; }
  const location = response.headers.get('location'); const finalUrl = location ? resolveUrl(expected.canonicalUrl, location) : response.url || expected.canonicalUrl;
  const contentType = response.headers.get('content-type') || '';
  if (response.status !== 200) errors.push('Expected 200 from canonical page; received HTTP ' + response.status + '.');
  if (!contentType.toLowerCase().includes('text/html')) errors.push('Expected text/html response; received ' + (contentType || 'missing') + '.');
  const html = await response.text();
  const title = matchOne(html, /<title[^>]*>([^<]*)<\/title>/i);
  const description = matchMetaDescription(html); const robots = matchMetaRobots(html); const canonicalUrl = matchCanonical(html);
  const h1Count = count(html, /<h1(?:\s|>)/gi); const jsonLdCount = count(html, /<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi);
  const hasHydration = html.includes('id="phoenix-seo-data"'); const hasAnswer = html.includes('seo-answer-block') && hasHydration; const renderMode = html.includes('data-seo-hydrated="true"') ? 'ssr' : 'unknown';
  if (finalUrl !== expected.canonicalUrl) errors.push('Canonical request redirected to ' + finalUrl + '.');
  if (canonicalUrl !== expected.canonicalUrl) errors.push('Rendered canonical link does not match the persisted canonical URL.');
  if (title !== expected.metadata.title) errors.push('Rendered title differs from persisted SEO metadata.');
  if (description !== expected.metadata.description) errors.push('Rendered meta description differs from persisted SEO metadata.');
  if (robots !== expected.metadata.robots) errors.push('Rendered robots directive differs from persisted SEO metadata.');
  if (h1Count !== 1) warnings.push('Expected exactly one h1; found ' + h1Count + '.');
  if (jsonLdCount < 1) errors.push('Rendered document does not contain JSON-LD structured data.');
  if (!hasAnswer) errors.push('Rendered document does not expose the persisted answer representation.');
  if (!hasHydration) errors.push('Rendered document does not expose the sanitized SEO hydration payload.');
  if (renderMode !== 'ssr') errors.push('Rendered document does not carry the production SEO hydration marker.');
  if (expected.metadata.robots.startsWith('index') && response.headers.get('x-robots-tag') !== expected.metadata.robots) warnings.push('X-Robots-Tag does not exactly mirror the page robots directive.');
  if (expected.answer.citationReady && !html.includes('Verified facts')) warnings.push('Citation-ready answer has no visible verified-facts section.');
  if (expected.page.breadcrumbs.length >= 2 && !html.includes('seo-breadcrumbs')) errors.push('Persisted breadcrumb model is missing from the rendered document.');
  return { url: expected.canonicalUrl, status: response.status, finalUrl, contentType, indexable: expected.metadata.robots.startsWith('index'), ...(canonicalUrl ? { canonicalUrl } : {}), ...(title ? { title } : {}), ...(description ? { description } : {}), ...(robots ? { robots } : {}), h1Count, jsonLdCount, hasAnswer, hasHydration, renderMode, errors, warnings };
}
function resolveUrl(base: string, value: string): string { try { return new URL(value, base).toString().replace(/\/$/, ''); } catch { return value; } }
function matchOne(value: string, pattern: RegExp): string | undefined { const match = pattern.exec(value); return match && match[1] ? match[1].trim() : undefined; }
function matchMetaDescription(html: string): string | undefined { const a = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i; const b = /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i; return matchOne(html, a) || matchOne(html, b); }
function matchMetaRobots(html: string): string | undefined { const a = /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["'][^>]*>/i; const b = /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']robots["'][^>]*>/i; return matchOne(html, a) || matchOne(html, b); }
function matchCanonical(html: string): string | undefined { const a = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i; const b = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i; return matchOne(html, a) || matchOne(html, b); }
function count(value: string, pattern: RegExp): number { return value.match(pattern)?.length || 0; }
