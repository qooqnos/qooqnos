import type { D1Database } from "@qooqnos/database";
import type { AnswerRepresentation, SeoEntity, SeoMetadata, StructuredData } from "@qooqnos/seo";
import type { ApiEnv } from "./env";

export interface SeoAssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface SeoFrontendHydration {
  readonly metadata: SeoMetadata;
  readonly structuredData: StructuredData;
  readonly answer: AnswerRepresentation;
  readonly entity: Pick<SeoEntity,
    "id" | "type" | "preferredName" | "summary" | "description" | "locale" |
    "country" | "geoScope" | "locationId" | "serviceArea" | "imageUrl" | "updatedAt"
  >;
}

interface StoredRepresentation {
  readonly canonicalUrl: string;
  readonly indexability: string;
  readonly publicationState: string;
  readonly visibility: string;
  readonly representationJson: string;
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
       visibility, representation_json AS representationJson
     FROM seo_entity_representations
     WHERE canonical_url=? AND publication_state='published' AND visibility='public'
     ORDER BY generated_at DESC
     LIMIT 1`,
    canonicalUrl,
  );
  if (!row) return null;

  let parsed: {
    entity?: SeoEntity;
    metadata?: SeoMetadata;
    structuredData?: StructuredData;
    answer?: AnswerRepresentation;
  };
  try {
    parsed = JSON.parse(row.representationJson) as typeof parsed;
  } catch {
    return null;
  }

  if (!parsed.entity || !parsed.metadata || !parsed.structuredData || !parsed.answer) return null;
  if (parsed.metadata.canonicalUrl !== row.canonicalUrl) return null;

  const assetResponse = await getIndexDocument(request, env);
  if (!assetResponse) return null;

  const hydration: SeoFrontendHydration = {
    metadata: parsed.metadata,
    structuredData: parsed.structuredData,
    answer: parsed.answer,
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
      updatedAt: parsed.entity.updatedAt,
    },
  };

  const html = injectSeoRepresentation(await assetResponse.text(), hydration);
  const headers = new Headers(assetResponse.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "public, max-age=60, s-maxage=120, stale-while-revalidate=300");
  headers.set("vary", "Accept-Language");
  return new Response(html, { status: 200, headers });
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
  const bodyMarkup = renderAnswerMarkup(entity, answer);

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
  answer: AnswerRepresentation,
): string {
  const facts = answer.facts.map((fact) => `<li>${escapeHtml(fact.fact)}</li>`).join("");
  const geography = answer.geography
    ? [
        answer.geography.country ? `<span>${escapeHtml(answer.geography.country)}</span>` : "",
        answer.geography.locationId ? `<span>${escapeHtml(answer.geography.locationId)}</span>` : "",
        ...answer.geography.serviceAreaIds.map((value) => `<span>${escapeHtml(value)}</span>`),
      ].filter(Boolean).join("")
    : "";
  const summary = entity.summary ?? entity.description ?? answer.answer;

  return `
    <main id="main" class="page-content seo-public-page" data-seo-entity-id="${escapeAttribute(entity.id)}">
      <article class="seo-entity-document" dir="auto">
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
        <footer class="seo-public-footer">
          <a class="button button-primary" href="/discover">Discover in Phoenix →</a>
        </footer>
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
