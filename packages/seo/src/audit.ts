import type { AnswerRepresentation, SeoAudit, SeoAuditIssue, SeoEntity, SeoMetadata, SeoPolicy, StructuredData } from "./types";
import type { EntityPageModel } from "./entity-page";
import { validateAnswerRepresentation } from "./answer-validation";
import { validateStructuredData } from "./structured-validation";
import { evaluateFreshness } from "./freshness";

export interface SeoAuditSurface {
  readonly metadata?: SeoMetadata;
  readonly structuredData?: StructuredData;
  readonly answer?: AnswerRepresentation;
  readonly page?: EntityPageModel;
  readonly policy?: SeoPolicy;
  readonly now?: string;
}

function issue(code: string, severity: SeoAuditIssue["severity"], evidence: string, owner: string, recommendation: string): SeoAuditIssue {
  return { code, severity, evidence, owner, recommendation };
}
function httpUrl(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  try { const u = new URL(value); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
}
function score(errors: number, warnings: number): number {
  return Math.max(0, 100 - errors * 30 - warnings * 8);
}
function bucketIssues(issues: readonly SeoAuditIssue[], codes: readonly string[]): { errors: number; warnings: number } {
  const selected = issues.filter((item) => codes.includes(item.code));
  return {
    errors: selected.filter((item) => item.severity === "error").length,
    warnings: selected.filter((item) => item.severity === "warning").length,
  };
}

export function auditEntity(
  e: SeoEntity,
  canonicalUrl: string,
  indexability: string = "index",
  now: string,
  surface?: SeoAuditSurface,
): SeoAudit {
  const issues: SeoAuditIssue[] = [];
  const owner = e.sourceModule;

  if (!e.preferredName.trim()) issues.push(issue("MISSING_ENTITY_NAME", "error", "Canonical entity has no preferred name", owner, "Provide the canonical entity name"));
  if (!e.description?.trim() && !e.summary?.trim()) issues.push(issue("MISSING_DESCRIPTION", "warning", "No factual summary or description", owner, "Provide canonical factual content"));
  if (e.description?.trim() && e.description.trim().length < 40 && !e.summary?.trim()) issues.push(issue("THIN_ENTITY_DESCRIPTION", "warning", "Description is unusually short", owner, "Provide enough factual detail to explain the entity"));
  if (!e.relatedEntityIds?.length) issues.push(issue("NO_RELATIONSHIPS", "warning", "No semantic relationships supplied", owner, "Expose relevant canonical relationships"));
  if (e.geoScope && !e.locationId && !e.country?.trim() && e.geoScope !== "service-area") issues.push(issue("GEO_SCOPE_WITHOUT_LOCATION", "error", "Geographic scope exists without canonical location reference", owner, "Bind geography to canonical location data"));
  if (e.geoScope === "service-area" && !e.serviceArea?.length) issues.push(issue("SERVICE_AREA_WITHOUT_EVIDENCE", "error", "Service-area scope has no canonical service-area identifiers", owner, "Provide authoritative service-area references"));
  if (e.visibility === "public" && e.publicationState !== "published") issues.push(issue("PUBLIC_UNPUBLISHED_ENTITY", "warning", "Public entity is not published", owner, "Publish the entity or make its visibility non-public"));
  if (e.publicationState === "published" && e.visibility === "public" && !httpUrl(canonicalUrl)) issues.push(issue("MISSING_CANONICAL_URL", "error", "Published public entity has no valid HTTP(S) canonical URL", owner, "Generate a valid canonical URL from canonical identity"));
  if (e.publicationState !== "published" && indexability === "index") issues.push(issue("INDEXABILITY_PUBLICATION_CONFLICT", "error", "A non-published entity is marked indexable", owner, "Set noindex/excluded until publication is authoritative"));
  if (e.visibility !== "public" && indexability === "index") issues.push(issue("INDEXABILITY_VISIBILITY_CONFLICT", "error", "A non-public entity is marked indexable", owner, "Exclude non-public representations from search indexing"));
  if (!["index", "noindex", "restricted", "excluded"].includes(indexability)) issues.push(issue("INVALID_INDEXABILITY", "error", `Unknown indexability policy: ${indexability}`, owner, "Use the canonical indexability policy"));
  if (!e.canonicalId?.trim()) issues.push(issue("MISSING_CANONICAL_ID", "warning", "Entity has no explicit canonical identity reference", owner, "Bind the representation to the canonical entity identity"));
  if (e.sameAs?.some((url) => !httpUrl(url))) issues.push(issue("INVALID_SAME_AS_REFERENCE", "warning", "One or more sameAs references are not absolute HTTP(S) URLs", owner, "Use authoritative absolute references only"));
  if (e.imageUrl && !httpUrl(e.imageUrl)) issues.push(issue("INVALID_IMAGE_URL", "warning", "Entity image URL is not HTTP(S)", owner, "Use an absolute public media URL"));
  if (!Number.isFinite(Date.parse(e.updatedAt))) issues.push(issue("INVALID_ENTITY_TIMESTAMP", "error", "Entity updatedAt is not a valid timestamp", owner, "Persist a valid ISO timestamp"));

  if (surface?.now) {
    const freshness = evaluateFreshness(e, surface.now);
    if (freshness.stale && e.publicationState === "published" && e.visibility === "public") {
      issues.push(issue(
        "STALE_ENTITY_SOURCE",
        surface?.policy?.indexability === "index" ? "error" : "warning",
        freshness.reason,
        owner,
        "Refresh canonical entity data before allowing public indexing",
      ));
    }
  }

  const metadata = surface?.metadata;
  if (metadata) {
    if (!metadata.title.trim()) issues.push(issue("MISSING_METADATA_TITLE", "error", "Published page has no title", owner, "Generate a deterministic page title"));
    if (metadata.title.length > 60) issues.push(issue("METADATA_TITLE_TOO_LONG", "warning", `Title length is ${metadata.title.length}`, owner, "Keep title within the configured SEO title budget"));
    if (!metadata.description.trim()) issues.push(issue("MISSING_METADATA_DESCRIPTION", "error", "Published page has no meta description", owner, "Generate a factual description"));
    if (metadata.description.length > 160) issues.push(issue("METADATA_DESCRIPTION_TOO_LONG", "warning", `Description length is ${metadata.description.length}`, owner, "Keep description within the configured SEO description budget"));
    if (metadata.canonicalUrl !== canonicalUrl) issues.push(issue("METADATA_CANONICAL_MISMATCH", "error", "Metadata canonical URL differs from projection canonical URL", owner, "Use one canonical URL source"));
    if (!httpUrl(metadata.canonicalUrl)) issues.push(issue("INVALID_METADATA_CANONICAL", "error", "Metadata canonical is not HTTP(S)", owner, "Use an absolute HTTP(S) canonical URL"));
    if (!metadata.language.trim() || !metadata.locale.trim()) issues.push(issue("MISSING_LOCALE_METADATA", "warning", "Language/locale metadata is incomplete", owner, "Provide canonical language and locale"));
    if (!metadata.robots.trim()) issues.push(issue("MISSING_ROBOTS_METADATA", "error", "Robots metadata is missing", owner, "Emit the canonical indexability directive"));
    if (!metadata.headings.length) issues.push(issue("MISSING_PAGE_HEADING", "warning", "Page metadata exposes no heading inventory", owner, "Keep the visible heading hierarchy represented in the SEO projection"));
    if (e.imageUrl && !metadata.altTexts.some((value) => value.trim())) issues.push(issue("MISSING_IMAGE_ALT_TEXT", "warning", "Entity has an image but no alt text contract", owner, "Provide descriptive canonical alt text for public entity imagery"));
    const selfAlternate = metadata.alternates.find((item) => item.hreflang.toLowerCase() === metadata.locale.toLowerCase() && item.href === canonicalUrl);
    const defaultAlternate = metadata.alternates.find((item) => item.hreflang === "x-default");
    if (!selfAlternate) issues.push(issue("MISSING_SELF_HREFLANG", "warning", "Current locale has no self-referencing hreflang", owner, "Emit a self-referencing locale alternate"));
    if (!defaultAlternate) issues.push(issue("MISSING_X_DEFAULT", "warning", "No x-default hreflang is published", owner, "Emit an x-default fallback locale"));
    const hreflangs = new Set<string>();
    for (const alternate of metadata.alternates) {
      if (!httpUrl(alternate.href)) issues.push(issue("INVALID_HREFLANG_URL", "error", `Invalid hreflang URL: ${alternate.href}`, owner, "Use absolute HTTP(S) alternate URLs"));
      if (hreflangs.has(alternate.hreflang)) issues.push(issue("DUPLICATE_HREFLANG", "warning", `Duplicate hreflang: ${alternate.hreflang}`, owner, "Publish each hreflang value once"));
      hreflangs.add(alternate.hreflang);
    }
    if (metadata.openGraph.url !== canonicalUrl) issues.push(issue("OPEN_GRAPH_CANONICAL_MISMATCH", "warning", "OpenGraph URL differs from canonical URL", owner, "Align OpenGraph URL with canonical URL"));
    if (metadata.twitter.title.trim() === "") issues.push(issue("MISSING_TWITTER_TITLE", "warning", "Twitter title is empty", owner, "Emit the same factual title used by the page"));
  }

  const structured = surface?.structuredData;
  if (structured) {
    const validation = validateStructuredData(structured);
    for (const item of validation.issues) {
      issues.push(issue(`STRUCTURED_DATA_${item.code}`, item.severity, item.message, owner, "Fix structured data before publication"));
    }
    if (structured.url && structured.url !== canonicalUrl) issues.push(issue("STRUCTURED_DATA_CANONICAL_MISMATCH", "error", "Structured-data URL differs from canonical URL", owner, "Bind structured data to the canonical page URL"));
    const webPage = structured.mainEntityOfPage as Record<string, unknown> | undefined;
    const breadcrumb = webPage?.breadcrumb as Record<string, unknown> | undefined;
    if (e.visibility === "public" && e.publicationState === "published" && (!breadcrumb || breadcrumb["@type"] !== "BreadcrumbList")) {
      issues.push(issue("MISSING_BREADCRUMB_STRUCTURED_DATA", "warning", "Public entity page has no BreadcrumbList structured data", owner, "Add BreadcrumbList markup matching visible breadcrumbs"));
    }
    if (e.type === "Product" && (e.price !== undefined || e.currency || e.availability) && !structured.offers) {
      issues.push(issue("MISSING_PRODUCT_OFFER_SCHEMA", "warning", "Product has commerce facts but no Offer structured data", owner, "Expose canonical Product Offer fields"));
    }
    if (e.type === "Event" && e.startDate && !structured.startDate) issues.push(issue("MISSING_EVENT_START_SCHEMA", "warning", "Event has a start date but schema does not expose it", owner, "Expose Event startDate in structured data"));
  }

  const answer = surface?.answer;
  if (answer) {
    const validation = validateAnswerRepresentation(answer, e, surface.now ?? now);
    for (const item of validation.issues) {
      issues.push(issue(`ANSWER_${item.code}`, item.severity, item.message, owner, "Fix Answer Representation provenance/freshness before publication"));
    }
    if (e.visibility === "public" && e.publicationState === "published" && indexability === "index" && !validation.citationReady) {
      issues.push(issue("ANSWER_NOT_CITATION_READY", "warning", "Indexable public page is not citation-ready", owner, "Publish verified facts and valid provenance"));
    }
  }

  const page = surface?.page;
  if (page) {
    if (page.canonicalUrl !== canonicalUrl) issues.push(issue("PAGE_CANONICAL_MISMATCH", "error", "Entity Page model canonical URL differs from projection", owner, "Bind page model to the canonical URL"));
    if (page.breadcrumbs.length < 2 || page.breadcrumbs[page.breadcrumbs.length - 1]?.url !== canonicalUrl) issues.push(issue("INVALID_BREADCRUMB_TRAIL", "error", "Breadcrumb trail does not terminate at the canonical entity URL", owner, "Generate breadcrumbs from canonical URL and IA"));
    if (page.actions.length === 0) issues.push(issue("MISSING_ENTITY_ACTION", "warning", "Public entity page has no contextual action", owner, "Expose a safe next action such as Discovery, Booking or Commerce"));
    const linkUrls = new Set<string>();
    for (const link of page.relatedLinks) {
      if (!httpUrl(link.url)) issues.push(issue("INVALID_INTERNAL_LINK", "error", `Related link is not absolute HTTP(S): ${link.url}`, owner, "Use canonical target URLs only"));
      if (link.url === canonicalUrl) issues.push(issue("SELF_INTERNAL_LINK", "warning", "Related-link set contains the current canonical URL", owner, "Remove self-links from related navigation"));
      if (linkUrls.has(link.url)) issues.push(issue("DUPLICATE_INTERNAL_LINK", "warning", `Duplicate related link: ${link.url}`, owner, "Deduplicate semantic navigation"));
      linkUrls.add(link.url);
    }
    const requiredSections = ["overview", "facts", "action"];
    for (const section of requiredSections) if (!page.sections.some((candidate) => candidate.id === section)) {
      issues.push(issue("MISSING_PAGE_SECTION", "warning", `Missing canonical Entity Page section: ${section}`, owner, "Ensure the public template exposes its core information architecture"));
    }
  }

  if (surface?.policy) {
    if (surface.policy.indexability === "index" && !surface.policy.includeInSitemap) issues.push(issue("INDEXABLE_NOT_IN_SITEMAP", "warning", "Indexable representation is excluded from sitemap", owner, "Include indexable canonical pages in sitemap generation"));
    if (surface.policy.indexability !== "index" && surface.policy.includeInSitemap) issues.push(issue("NONINDEXABLE_IN_SITEMAP", "error", "Non-indexable representation is included in sitemap", owner, "Exclude noindex/excluded pages from sitemap"));
    if (metadata && surface.policy.indexability === "index" && !/^index,follow(?:,|$)/i.test(metadata.robots)) {
      issues.push(issue("ROBOTS_INDEXABILITY_MISMATCH", "error", "Indexable policy does not match robots metadata", owner, "Emit index,follow for indexable pages"));
    }
    if (metadata && surface.policy.indexability !== "index" && !/^noindex(?:,|$)/i.test(metadata.robots)) {
      issues.push(issue("ROBOTS_NONINDEXABILITY_MISMATCH", "error", "Non-indexable policy does not match robots metadata", owner, "Emit noindex for non-indexable pages"));
    }
  }

  const warnings = issues.filter((item) => item.severity === "warning").length;
  const metadataStats = bucketIssues(issues, ["MISSING_METADATA_TITLE","MISSING_METADATA_DESCRIPTION","METADATA_CANONICAL_MISMATCH","INVALID_METADATA_CANONICAL","MISSING_LOCALE_METADATA","MISSING_ROBOTS_METADATA","MISSING_SELF_HREFLANG","MISSING_X_DEFAULT","INVALID_HREFLANG_URL","DUPLICATE_HREFLANG","OPEN_GRAPH_CANONICAL_MISMATCH","MISSING_TWITTER_TITLE"]);
  const structuredStats = bucketIssues(issues, ["STRUCTURED_DATA_MISSING_CONTEXT","STRUCTURED_DATA_MISSING_TYPE","STRUCTURED_DATA_INVALID_URL","STRUCTURED_DATA_CANONICAL_MISMATCH","MISSING_BREADCRUMB_STRUCTURED_DATA","MISSING_PRODUCT_OFFER_SCHEMA","MISSING_EVENT_START_SCHEMA"]);
  const answerStats = bucketIssues(issues.filter((item) => item.code.startsWith("ANSWER_")), ["ANSWER_MISSING_ANSWER","ANSWER_MISSING_QUESTION","ANSWER_ENTITY_MISMATCH","ANSWER_INVALID_REPRESENTATION_TIMESTAMP","ANSWER_INVALID_FACT_TIMESTAMP","ANSWER_INVALID_FACT_PROVENANCE","ANSWER_RESTRICTED_SOURCE","ANSWER_STALE_SOURCE","ANSWER_CITATION_NOT_READY","ANSWER_NOT_CITATION_READY"]);
  const pageStats = bucketIssues(issues, ["PAGE_CANONICAL_MISMATCH","INVALID_BREADCRUMB_TRAIL","MISSING_ENTITY_ACTION","INVALID_INTERNAL_LINK","SELF_INTERNAL_LINK","DUPLICATE_INTERNAL_LINK","MISSING_PAGE_SECTION"]);
  const technicalStats = bucketIssues(issues, ["INDEXABILITY_PUBLICATION_CONFLICT","INDEXABILITY_VISIBILITY_CONFLICT","INVALID_INDEXABILITY","MISSING_CANONICAL_URL","ROBOTS_INDEXABILITY_MISMATCH","ROBOTS_NONINDEXABILITY_MISMATCH","INDEXABLE_NOT_IN_SITEMAP","NONINDEXABLE_IN_SITEMAP","INVALID_ENTITY_TIMESTAMP","STALE_ENTITY_SOURCE"]);
  const contentStats = bucketIssues(issues, ["MISSING_ENTITY_NAME","MISSING_DESCRIPTION","THIN_ENTITY_DESCRIPTION","MISSING_CANONICAL_ID","NO_RELATIONSHIPS"]);
  const geoStats = bucketIssues(issues, ["GEO_SCOPE_WITHOUT_LOCATION","SERVICE_AREA_WITHOUT_EVIDENCE"]);
  const scores = {
    entityCompleteness: score(contentStats.errors, contentStats.warnings),
    contentQuality: score(contentStats.errors, contentStats.warnings),
    metadataQuality: score(metadataStats.errors, metadataStats.warnings),
    structuredDataQuality: score(structuredStats.errors, structuredStats.warnings),
    answerReadiness: score(answerStats.errors, answerStats.warnings),
    internalLinking: score(pageStats.errors, pageStats.warnings),
    localRelevance: e.locationId || e.serviceArea?.length ? score(geoStats.errors, geoStats.warnings) : 50,
    geoAnswerability: e.summary?.trim() && (e.locationId || e.serviceArea?.length || !e.geoScope) ? score(geoStats.errors, geoStats.warnings) : 60,
    trustProvenance: e.sourceModule && e.sourceVersion && !issues.some((item) => item.code === "INVALID_SAME_AS_REFERENCE") ? 100 : 70,
    technicalIndexability: score(technicalStats.errors, technicalStats.warnings),
    freshness: surface?.now ? score(issues.filter((item) => item.code === "STALE_ENTITY_SOURCE").length, 0) : 100,
  };
  const weights: Record<string, number> = {
    entityCompleteness: 0.12,
    contentQuality: 0.12,
    metadataQuality: 0.12,
    structuredDataQuality: 0.12,
    answerReadiness: 0.12,
    internalLinking: 0.08,
    localRelevance: 0.07,
    geoAnswerability: 0.07,
    trustProvenance: 0.06,
    technicalIndexability: 0.09,
    freshness: 0.03,
  };
  const overallScore = Math.round(Object.entries(scores).reduce((sum, [key, value]) => sum + value * (weights[key] ?? 0), 0));
  const blockingIssueCodes = issues.filter((item) => item.severity === "error").map((item) => item.code);
  const status: SeoAudit["status"] = blockingIssueCodes.length ? "blocked" : warnings ? "warning" : "pass";

  return {
    entityId: e.id,
    scores,
    overallScore,
    status,
    blockingIssueCodes,
    issues,
    generatedAt: now,
  };
}
