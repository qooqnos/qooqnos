import type { D1Database } from "@qooqnos/database";
import type { AnswerRepresentation, EntityPageModel, SeoEntity, SeoMetadata, StructuredData } from "@qooqnos/seo";
import type { ApiEnv } from "./env";

export interface SeoAssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface PublicAnswerRepresentation {
  readonly id: string;
  readonly entityId: string;
  readonly locale: string;
  readonly question: string;
  readonly answer: string;
  readonly canonicalUrl?: string;
  readonly facts: readonly {
    fact: string;
    verifiedAt?: string;
    provenanceUrl?: string;
    validUntil?: string;
  }[];
  readonly freshnessAt: string;
  readonly sourceUpdatedAt: string;
  readonly confidence: AnswerRepresentation["confidence"];
  readonly citationReady: boolean;
  readonly geography?: AnswerRepresentation["geography"];
  readonly limitations: readonly string[];
}

export interface SeoFrontendHydration {
  readonly metadata: SeoMetadata;
  readonly structuredData: StructuredData;
  readonly answer: PublicAnswerRepresentation;
  readonly page: EntityPageModel;
  readonly entity: Pick<SeoEntity,
    "id" | "type" | "preferredName" | "summary" | "description" | "locale" |
    "country" | "geoScope" | "locationId" | "serviceArea" | "imageUrl" | "telephone" | "email" | "priceRange" | "price" | "currency" | "availability" | "brandName" | "categoryName" | "startDate" | "endDate" | "address" | "updatedAt"
  >;
}

interface StoredRepresentation {
  readonly canonicalUrl: string;
  readonly indexability: string;
  readonly publicationState: string;
  readonly visibility: string;
  readonly representationJson: string;
  readonly contentHash: string;
}

export async function renderSeoAwareDocument(
  request: Request,
  env: ApiEnv & { readonly ASSETS?: SeoAssetsBinding },
  database: D1Database | undefined,
): Promise<Response | null> {
  if (request.method !== "GET" || !database) return null;

  const url = new URL(request.url);
  if (!isDocumentPath(url.pathname)) return null;

  const canonicalBaseUrl = (env.SEO_CANONICAL_BASE_URL ?? url.origin).replace(/\/$/, "");
  const canonicalUrl = canonicalBaseUrl + normalizePath(url.pathname);

  const row = await database.first<StoredRepresentation>(
    `SELECT canonical_url AS canonicalUrl, indexability, publication_state AS publicationState,
       visibility, representation_json AS representationJson, content_hash AS contentHash
     FROM seo_entity_representations
     WHERE canonical_url=? AND publication_state='published' AND visibility='public'
     ORDER BY generated_at DESC
     LIMIT 1`,
    canonicalUrl,
  );
  if (!row) {
    return new Response("SEO entity page not found.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=30" },
    });
  }

  let parsed: {
    entity?: SeoEntity;
    metadata?: SeoMetadata;
    structuredData?: StructuredData;
    answer?: AnswerRepresentation;
    page?: EntityPageModel;
  };
  try {
    parsed = JSON.parse(row.representationJson) as typeof parsed;
  } catch {
    return productionRenderFailure(env, "SEO representation JSON is invalid.");
  }

  if (!parsed.entity || !parsed.metadata || !parsed.structuredData || !parsed.answer || !parsed.page) return productionRenderFailure(env, "SEO representation is incomplete for SSR.");
  if (parsed.metadata.canonicalUrl !== row.canonicalUrl) return productionRenderFailure(env, "SEO metadata canonical does not match the persisted representation URL.");

  const assetResponse = await getIndexDocument(request, env);
  if (!assetResponse) return productionRenderFailure(env, "SEO renderer assets are unavailable.");
  if (!assetResponse.ok) return productionRenderFailure(env, `SEO renderer asset response was HTTP ${assetResponse.status}.`);

  const hydration: SeoFrontendHydration = {
    metadata: parsed.metadata,
    structuredData: parsed.structuredData,
    answer: {
      id: parsed.answer.id,
      entityId: parsed.answer.entityId,
      locale: parsed.answer.locale,
      question: parsed.answer.question,
      answer: parsed.answer.answer,
      ...(parsed.answer.canonicalUrl ? { canonicalUrl: parsed.answer.canonicalUrl } : {}),
      facts: parsed.answer.facts.map((fact) => ({
        fact: fact.fact,
        ...(fact.verifiedAt ? { verifiedAt: fact.verifiedAt } : {}),
        ...(fact.provenanceUrl ? { provenanceUrl: fact.provenanceUrl } : {}),
        ...(fact.validUntil ? { validUntil: fact.validUntil } : {}),
      })),
      freshnessAt: parsed.answer.freshnessAt,
      sourceUpdatedAt: parsed.answer.sourceUpdatedAt,
      confidence: parsed.answer.confidence,
      citationReady: parsed.answer.citationReady,
      ...(parsed.answer.geography ? { geography: parsed.answer.geography } : {}),
      limitations: parsed.answer.limitations,
    },
    page: parsed.page,
    entity: {
      id: parsed.entity.id,
      type: parsed.entity.type,
      preferredName: parsed.entity.preferredName,
      ...(parsed.entity.summary ? { summary: parsed.entity.summary } : {}),
      ...(parsed.entity.description ? { description: parsed.entity.description } : {}),
      locale: parsed.entity.locale,
      ...(parsed.entity.country ? { country: parsed.entity.country } : {}),
      ...(parsed.entity.geoScope ? { geoScope: parsed.entity.geoScope } : {}),
      ...(parsed.entity.locationId ? { locationId: parsed.entity.locationId } : {}),
      ...(parsed.entity.serviceArea ? { serviceArea: parsed.entity.serviceArea } : {}),
      ...(parsed.entity.imageUrl ? { imageUrl: parsed.entity.imageUrl } : {}),
      ...(parsed.entity.telephone ? { telephone: parsed.entity.telephone } : {}),
      ...(parsed.entity.email ? { email: parsed.entity.email } : {}),
      ...(parsed.entity.priceRange ? { priceRange: parsed.entity.priceRange } : {}),
      ...(parsed.entity.price !== undefined ? { price: parsed.entity.price } : {}),
      ...(parsed.entity.currency ? { currency: parsed.entity.currency } : {}),
      ...(parsed.entity.availability ? { availability: parsed.entity.availability } : {}),
      ...(parsed.entity.aggregateRating ? { aggregateRating: parsed.entity.aggregateRating } : {}),
      ...(parsed.entity.brandName ? { brandName: parsed.entity.brandName } : {}),
      ...(parsed.entity.categoryName ? { categoryName: parsed.entity.categoryName } : {}),
      ...(parsed.entity.startDate ? { startDate: parsed.entity.startDate } : {}),
      ...(parsed.entity.endDate ? { endDate: parsed.entity.endDate } : {}),
      ...(parsed.entity.address ? { address: parsed.entity.address } : {}),
      updatedAt: parsed.entity.updatedAt,
    },
  };

  const etag = `"${row.contentHash}"`;
  const requestEtag = request.headers.get("if-none-match");
  const baseHeaders = new Headers(assetResponse.headers);
  baseHeaders.set("content-type", "text/html; charset=utf-8");
  baseHeaders.set("cache-control", "public, max-age=60, s-maxage=120, stale-while-revalidate=300");
  baseHeaders.set("etag", etag);
  baseHeaders.set("x-robots-tag", hydration.metadata.robots);
  baseHeaders.set("x-phoenix-render-mode", "ssr");
  baseHeaders.set("x-phoenix-seo", "1");
  baseHeaders.set("content-language", hydration.metadata.language || hydration.metadata.locale);
  baseHeaders.set("vary", "Accept-Encoding");
  baseHeaders.set("x-content-type-options", "nosniff");
  if (parsed.entity.updatedAt) { const updated = new Date(parsed.entity.updatedAt); if (Number.isFinite(updated.getTime())) baseHeaders.set("last-modified", updated.toUTCString()); }

  if (requestEtag === etag) return new Response(null, { status: 304, headers: baseHeaders });

  const html = injectSeoRepresentation(await assetResponse.text(), hydration);
  return new Response(html, { status: 200, headers: baseHeaders });
}


function productionRenderFailure(env: ApiEnv, message: string): Response | null {
  if (env.ENVIRONMENT !== "production") return null;
  return new Response(message, {
    status: 503,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
      "x-phoenix-render-mode": "error",
      "x-phoenix-seo": "1",
    },
  });
}

export function injectSeoRepresentation(html: string, hydration: SeoFrontendHydration): string {
  const { metadata, structuredData, answer, entity } = hydration;
  const language = metadata.language || entity.locale.split("-")[0] || "en";
  const direction = ["ar", "fa", "he", "ur"].includes(language) ? "rtl" : "ltr";
  const headMarkup = [
    `<meta name="description" content="${escapeAttribute(metadata.description)}">`,
    `<meta name="robots" content="${escapeAttribute(metadata.robots)}">`,
    `<link rel="canonical" href="${escapeAttribute(metadata.canonicalUrl)}">`,
    `<meta property="og:title" content="${escapeAttribute(metadata.openGraph.title)}">`,
    `<meta property="og:description" content="${escapeAttribute(metadata.openGraph.description)}">`,
    `<meta property="og:type" content="${escapeAttribute(metadata.openGraph.type)}">`,
    `<meta property="og:locale" content="${escapeAttribute(metadata.openGraph.locale)}">`,
    `<meta property="og:url" content="${escapeAttribute(metadata.openGraph.url)}">`,
    ...(metadata.openGraph.siteName ? [`<meta property="og:site_name" content="${escapeAttribute(metadata.openGraph.siteName)}">`] : []),
    ...(metadata.openGraph.image ? [`<meta property="og:image" content="${escapeAttribute(metadata.openGraph.image)}">`] : []),
    `<meta name="twitter:card" content="${escapeAttribute(metadata.twitter.card)}">`,
    `<meta name="twitter:title" content="${escapeAttribute(metadata.twitter.title)}">`,
    `<meta name="twitter:description" content="${escapeAttribute(metadata.twitter.description)}">`,
    ...(metadata.twitter.image ? [`<meta name="twitter:image" content="${escapeAttribute(metadata.twitter.image)}">`] : []),
    ...metadata.alternates.map((item) => `<link rel="alternate" hreflang="${escapeAttribute(item.hreflang)}" href="${escapeAttribute(item.href)}">`),
    `<script id="phoenix-seo-jsonld" type="application/ld+json">${safeJson(structuredData)}</script>`,
    `<script id="phoenix-seo-data" type="application/json">${safeJson(hydration)}</script>`,
  ].join("");
  const bodyMarkup = renderAnswerMarkup(entity, answer, hydration.page);

  const cleanedHtml = html
    .replace(/<meta[^>]+name=["']description["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']robots["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']twitter:[^"']+["'][^>]*>/gi, "")
    .replace(/<meta[^>]+property=["']og:[^"']+["'][^>]*>/gi, "")
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, "")
    .replace(/<link[^>]+rel=["']alternate["'][^>]*>/gi, "");

  return cleanedHtml
    .replace(/<html[^>]*>/i, `<html lang="${escapeAttribute(metadata.locale)}" dir="${direction}">`)
    .replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(metadata.title)}</title>`)
    .replace("</head>", `${headMarkup}</head>`)
    .replace(
      '<div id="app"></div>',
      `<div id="app" data-seo-hydrated="true">${bodyMarkup}</div>`,
    );
}

function renderAnswerMarkup(
  entity: SeoFrontendHydration["entity"],
  answer: PublicAnswerRepresentation,
  page: EntityPageModel,
): string {
  const facts = answer.facts.map((fact) => `<li>${escapeHtml(fact.fact)}</li>`).join("");
  const rating = entity.aggregateRating && entity.aggregateRating.reviewCount > 0 && Number.isFinite(entity.aggregateRating.ratingValue)
    ? `<div class="seo-rating" aria-label="Average rating ${escapeHtml(String(entity.aggregateRating.ratingValue))} out of 5 from ${escapeHtml(String(entity.aggregateRating.reviewCount))} reviews"><strong>${escapeHtml(entity.aggregateRating.ratingValue.toFixed(1))}/5</strong><span>${escapeHtml(String(entity.aggregateRating.reviewCount))} reviews</span></div>`
    : "";
  const commerce = [
    entity.price !== undefined ? `<span>قیمت: ${escapeHtml(String(entity.price))}</span>` : "",
    entity.currency ? `<span>ارز: ${escapeHtml(entity.currency)}</span>` : "",
    entity.priceRange ? `<span>بازه قیمت: ${escapeHtml(entity.priceRange)}</span>` : "",
    entity.availability ? `<span>دسترسی: ${escapeHtml(entity.availability)}</span>` : "",
    entity.brandName ? `<span>برند: ${escapeHtml(entity.brandName)}</span>` : "",
  ].filter(Boolean).join("");
  const geography = answer.geography
    ? [
        answer.geography.country ? `<span>${escapeHtml(answer.geography.country)}</span>` : "",
        answer.geography.locationId ? `<span>${escapeHtml(answer.geography.locationId)}</span>` : "",
        ...answer.geography.serviceAreaIds.map((value) => `<span>${escapeHtml(value)}</span>`),
      ].filter(Boolean).join("")
    : "";
  const summary = entity.summary ?? entity.description ?? answer.answer;
  const breadcrumbs = page.breadcrumbs.map((item) => `<a href="${escapeAttribute(item.url)}">${escapeHtml(item.name)}</a>`).join(`<span aria-hidden="true">/</span>`);
  const actions = page.actions.map((action) => `<a class="button ${action.kind === "primary" ? "button-primary" : "button-ghost"}" href="${escapeAttribute(action.href)}">${escapeHtml(action.label)} →</a>`).join("");
  const related = page.relatedLinks.map((link) => `<a class="seo-related-link" href="${escapeAttribute(link.url)}" data-seo-related><span>${escapeHtml(link.label)}</span><small>${escapeHtml(link.relation)}</small></a>`).join("");

  return `
    <main id="main" class="page-content seo-public-page" data-seo-entity-id="${escapeAttribute(entity.id)}">
      <article class="seo-entity-document" dir="auto">
        <nav class="seo-breadcrumbs" aria-label="Breadcrumb">${breadcrumbs}</nav>
        <header class="seo-entity-header">
          <span class="eyebrow"><i></i> Phoenix Entity</span>
          <h1>${escapeHtml(entity.preferredName)}</h1>
          <p>${escapeHtml(summary)}</p>
        </header>
        <section class="seo-answer-block" aria-labelledby="seo-answer-title">
          <span class="section-kicker">Answer</span>
          <h2 id="seo-answer-title">${escapeHtml(answer.question)}</h2>
          <p>${escapeHtml(answer.answer)}</p>
          <div class="seo-answer-meta">
            <span>Confidence: ${escapeHtml(answer.confidence)}</span>
            <span>Freshness: ${escapeHtml(answer.freshnessAt)}</span>
          </div>
        </section>
        ${facts ? `<section class="seo-facts"><h2>Verified facts</h2><ul>${facts}</ul></section>` : ""}
        ${geography ? `<section class="seo-geo"><h2>Geographic scope</h2><div class="metadata-cloud">${geography}</div></section>` : ""}
        ${rating ? `<section class="seo-reviews" aria-label="Customer reviews"><h2>Customer reviews</h2>${rating}</section>` : ""}
        ${commerce ? `<section class="seo-commerce"><h2>Commerce</h2><div class="metadata-cloud">${commerce}</div></section>` : ""}
        ${related ? `<section class="seo-related"><h2>Related entities</h2><div class="seo-related-list">${related}</div></section>` : ""}
        <footer class="seo-public-footer"><div class="seo-action-row">${actions}</div></footer>
      </article>
    </main>`;
}

async function getIndexDocument(
  request: Request,
  env: ApiEnv & { readonly ASSETS?: SeoAssetsBinding },
): Promise<Response | null> {
  if (!env.ASSETS) return null;
  const indexUrl = new URL(request.url);
  indexUrl.pathname = "/index.html";
  indexUrl.search = "";
  indexUrl.hash = "";
  return env.ASSETS.fetch(new Request(indexUrl.toString(), { method: "GET", headers: request.headers }));
}

function isDocumentPath(pathname: string): boolean {
  if (pathname === "/" || pathname.startsWith("/api/") || pathname === "/robots.txt" || pathname === "/sitemap.xml") return false;
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  return Boolean(last) && !last.includes(".") && pathname.split("/").filter(Boolean).length >= 3;
}

function normalizePath(pathname: string): string {
  const value = pathname.replace(/\/+$/, "");
  return value || "/";
}

function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
