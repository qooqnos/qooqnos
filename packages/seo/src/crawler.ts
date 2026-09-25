import type { AnswerRepresentation, SeoEntity, SeoMetadata, StructuredData } from "./types";
import type { EntityPageModel } from "./entity-page";
export interface ProductionCrawlerFetch { (input: string | Request | URL, init?: RequestInit): Promise<Response>; }
export interface SeoCrawlerExpected { readonly canonicalUrl: string; readonly metadata: SeoMetadata; readonly structuredData: StructuredData; readonly answer: AnswerRepresentation; readonly page: EntityPageModel; readonly entity: SeoEntity; }
export interface SeoCrawlerResult { readonly url: string; readonly status: number; readonly finalUrl: string; readonly contentType: string; readonly indexable: boolean; readonly htmlBytes: number; readonly canonicalLinkCount: number; readonly invalidJsonLdCount: number; readonly canonicalUrl?: string; readonly title?: string; readonly description?: string; readonly robots?: string; readonly h1Count: number; readonly jsonLdCount: number; readonly hasAnswer: boolean; readonly hasHydration: boolean; readonly renderMode: 'ssr' | 'unknown'; readonly errors: readonly string[]; readonly warnings: readonly string[]; }
const BOT_USER_AGENT = 'PhoenixSEOProductionCrawler/1.0 (+https://qooqnos.com/robots.txt)';
const MAX_HTML_BYTES = 4 * 1024 * 1024;

export async function crawlProductionSeoPage(expected: SeoCrawlerExpected, fetcher: ProductionCrawlerFetch = fetch): Promise<SeoCrawlerResult> {
  const errors: string[] = []; const warnings: string[] = []; let response: Response;
  try {
    const expectedUrl = new URL(expected.canonicalUrl);
    if (expectedUrl.protocol !== 'https:' || expectedUrl.username || expectedUrl.password) throw new Error('SEO crawler canonical URL must be a public HTTPS URL.');
    response = await fetcher(expected.canonicalUrl, { method: 'GET', redirect: 'manual', headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': BOT_USER_AGENT, 'x-phoenix-seo-crawl': '1' } });
  }
  catch (error) { return { url: expected.canonicalUrl, status: 0, finalUrl: expected.canonicalUrl, contentType: '', indexable: false, htmlBytes: 0, canonicalLinkCount: 0, invalidJsonLdCount: 0, h1Count: 0, jsonLdCount: 0, hasAnswer: false, hasHydration: false, renderMode: 'unknown', errors: [error instanceof Error ? error.message : 'Production SEO crawl failed.'], warnings }; }
  const location = response.headers.get('location'); const finalUrl = location ? resolveUrl(expected.canonicalUrl, location) : response.url || expected.canonicalUrl;
  const contentType = response.headers.get('content-type') || '';
  if (response.status !== 200) errors.push('Expected 200 from canonical page; received HTTP ' + response.status + '.');
  const normalizedContentType = contentType.toLowerCase();
  if (!normalizedContentType.includes('text/html') && !normalizedContentType.includes('application/xhtml+xml')) errors.push('Expected an HTML response; received ' + (contentType || 'missing') + '.');
  const declaredLength = Number(response.headers.get('content-length') ?? '');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_HTML_BYTES) errors.push('Rendered HTML exceeds the production crawler safety limit of 4 MiB.');
  const html = await response.text();
  const htmlBytes = new TextEncoder().encode(html).byteLength;
  if (htmlBytes > MAX_HTML_BYTES) errors.push('Rendered HTML exceeds the production crawler safety limit of 4 MiB.');
  const title = matchOne(html, /<title[^>]*>([^<]*)<\/title>/i);
  const description = matchMetaDescription(html); const robots = matchMetaRobots(html); const canonicalUrl = matchCanonical(html);
  const canonicalLinkCount = count(html, /<link[^>]+rel=["'][^"']*\bcanonical\b[^"']*["'][^>]*>/gi);
  const jsonLdBlocks = matchJsonLdBlocks(html);
  const jsonLdCount = jsonLdBlocks.length;
  const invalidJsonLdCount = jsonLdBlocks.filter((block) => !parseJson(block)).length;
  const h1Count = count(html, /<h1(?:\s|>)/gi);
  const hasHydration = html.includes('id="phoenix-seo-data"'); const hasAnswer = html.includes('seo-answer-block') && hasHydration; const renderMode = html.includes('data-seo-hydrated="true"') ? 'ssr' : 'unknown';
  if (finalUrl !== expected.canonicalUrl) errors.push('Canonical request redirected to ' + finalUrl + '.');
  if (canonicalLinkCount !== 1) errors.push('Rendered document must contain exactly one canonical link; found ' + canonicalLinkCount + '.');
  if (!canonicalUrl) errors.push('Rendered document does not contain a canonical link.');
  else if (canonicalUrl !== expected.canonicalUrl) errors.push('Rendered canonical link does not match the persisted canonical URL.');
  if (!title) errors.push('Rendered document does not contain a title element.');
  else if (title !== expected.metadata.title) errors.push('Rendered title differs from persisted SEO metadata.');
  if (!description) errors.push('Rendered document does not contain a meta description.');
  else if (description !== expected.metadata.description) errors.push('Rendered meta description differs from persisted SEO metadata.');
  if (!robots) errors.push('Rendered document does not contain a robots meta directive.');
  else if (robots !== expected.metadata.robots) errors.push('Rendered robots directive differs from persisted SEO metadata.');
  if (h1Count !== 1) warnings.push('Expected exactly one h1; found ' + h1Count + '.');
  if (jsonLdCount < 1) errors.push('Rendered document does not contain JSON-LD structured data.');
  if (invalidJsonLdCount > 0) errors.push('Rendered document contains ' + invalidJsonLdCount + ' invalid JSON-LD block(s).');
  if (!hasAnswer) errors.push('Rendered document does not expose the persisted answer representation.');
  if (!hasHydration) errors.push('Rendered document does not expose the sanitized SEO hydration payload.');
  if (renderMode !== 'ssr') errors.push('Rendered document does not carry the production SEO hydration marker.');
  const xRobots = response.headers.get('x-robots-tag');
  if (xRobots !== expected.metadata.robots) errors.push('X-Robots-Tag does not exactly mirror the persisted page robots directive.');

  if (expected.answer.citationReady && !html.includes('Verified facts')) warnings.push('Citation-ready answer has no visible verified-facts section.');
  if (expected.page.breadcrumbs.length >= 2 && !html.includes('seo-breadcrumbs')) errors.push('Persisted breadcrumb model is missing from the rendered document.');
  return { url: expected.canonicalUrl, status: response.status, finalUrl, contentType, indexable: expected.metadata.robots.startsWith('index'), htmlBytes, canonicalLinkCount, invalidJsonLdCount, ...(canonicalUrl ? { canonicalUrl } : {}), ...(title ? { title } : {}), ...(description ? { description } : {}), ...(robots ? { robots } : {}), h1Count, jsonLdCount, hasAnswer, hasHydration, renderMode, errors, warnings };
}
function matchJsonLdBlocks(html: string): string[] {
  const values: string[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\\s\\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) if (match[1]) values.push(match[1].trim());
  return values;
}

function parseJson(value: string): unknown {
  try { return JSON.parse(value); } catch { return undefined; }
}

function resolveUrl(base: string, value: string): string { try { return new URL(value, base).toString().replace(/\/$/, ''); } catch { return value; } }
function matchOne(value: string, pattern: RegExp): string | undefined { const match = pattern.exec(value); return match && match[1] ? match[1].trim() : undefined; }
function matchMetaDescription(html: string): string | undefined { const a = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i; const b = /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i; return matchOne(html, a) || matchOne(html, b); }
function matchMetaRobots(html: string): string | undefined { const a = /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["'][^>]*>/i; const b = /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']robots["'][^>]*>/i; return matchOne(html, a) || matchOne(html, b); }
function matchCanonical(html: string): string | undefined { const a = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i; const b = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i; return matchOne(html, a) || matchOne(html, b); }
function count(value: string, pattern: RegExp): number { return value.match(pattern)?.length || 0; }
