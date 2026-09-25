export type GoogleSearchConsoleReport = "multimodal" | "generative-ai";
export type BingAiPerformanceDataset = "pages" | "grounding-queries" | "timeseries";

export interface ExternalVisibilityObservation {
  readonly surface: "search-engine" | "ai-answer";
  readonly metric: string;
  readonly numericValue?: number;
  readonly textValue?: string;
  readonly entityId?: string;
  readonly queryText?: string;
  readonly pageUrl?: string;
  readonly citationUrl?: string;
  readonly citationTitle?: string;
  readonly citationPosition?: number;
  readonly citationCount?: number;
  readonly observedAt: string;
  readonly provenance: Record<string, unknown>;
}

export interface GoogleSearchConsoleExportOptions {
  readonly report: GoogleSearchConsoleReport;
  readonly locale: string;
  readonly observedAt?: string;
  readonly entityId?: string;
  readonly entityType?: string;
  readonly canonicalUrl?: string;
  readonly exportReference?: string;
}

export interface BingAiPerformanceExportOptions {
  readonly dataset: BingAiPerformanceDataset;
  readonly locale: string;
  readonly observedAt?: string;
  readonly entityId?: string;
  readonly entityType?: string;
  readonly exportReference?: string;
}

export function parseGoogleSearchConsoleExport(
  input: string | readonly Record<string, unknown>[],
  options: GoogleSearchConsoleExportOptions,
): readonly ExternalVisibilityObservation[] {
  const rows = parseRows(input);
  const prefix = options.report === "multimodal" ? "search-multimodal" : "search-generative-ai";
  return rows.flatMap((row) => {
    const observedAt = dateValue(row, ["date", "Date"]) ?? options.observedAt ?? new Date().toISOString();
    const pageUrl = stringValue(row, ["page", "Page", "url", "URL"]) ?? options.canonicalUrl;
    const queryText = stringValue(row, ["query", "Query", "queries", "Queries"]);
    const baseProvenance = { provider: "google-search-console-export", report: options.report, source: "Google Search Console exported Performance report", exportReference: options.exportReference ?? null, locale: options.locale, page: pageUrl ?? null, query: queryText ?? null, entityType: options.entityType ?? null };
    const entity = options.entityId ? { entityId: options.entityId } : {};
    const output: ExternalVisibilityObservation[] = [];
    const clicks = numberValue(row, ["clicks", "Clicks"]);
    const impressions = numberValue(row, ["impressions", "Impressions"]);
    const ctr = numberValue(row, ["ctr", "CTR"], true);
    const position = numberValue(row, ["position", "Position"]);
    if (clicks !== undefined) output.push({ surface: "search-engine", metric: prefix + "-clicks", numericValue: clicks, ...entity, queryText, pageUrl, observedAt, provenance: baseProvenance });
    if (impressions !== undefined) output.push({ surface: "search-engine", metric: prefix + "-impressions", numericValue: impressions, ...entity, queryText, pageUrl, observedAt, provenance: baseProvenance });
    if (ctr !== undefined) output.push({ surface: "search-engine", metric: prefix + "-ctr", numericValue: ctr, ...entity, queryText, pageUrl, observedAt, provenance: baseProvenance });
    if (position !== undefined) output.push({ surface: "search-engine", metric: prefix + "-position", numericValue: position, ...entity, queryText, pageUrl, observedAt, provenance: baseProvenance });
    if (pageUrl) output.push({ surface: "search-engine", metric: prefix + "-page-observed", textValue: pageUrl, ...entity, queryText, pageUrl, observedAt, provenance: baseProvenance });
    return output;
  });
}

export function parseBingAiPerformanceExport(
  input: string | readonly Record<string, unknown>[],
  options: BingAiPerformanceExportOptions,
): readonly ExternalVisibilityObservation[] {
  const rows = parseRows(input);
  return rows.flatMap((row) => {
    const observedAt = dateValue(row, ["date", "Date", "day", "Day"]) ?? options.observedAt ?? new Date().toISOString();
    const pageUrl = stringValue(row, ["page", "Page", "url", "URL", "page_url", "Page URL"]);
    const groundingQuery = stringValue(row, ["grounding query", "Grounding Query", "query", "Query", "grounding_query"]);
    const title = stringValue(row, ["title", "Title", "page title", "Page Title"]);
    const citations = numberValue(row, ["citations", "Citations", "citation count", "Citation Count", "citation_count"]);
    const citationShare = numberValue(row, ["citation share", "Citation Share", "citation_share"], true);
    const intent = stringValue(row, ["intent", "Intent"]);
    const topic = stringValue(row, ["topic", "Topic"]);
    const entity = options.entityId ? { entityId: options.entityId } : {};
    const baseProvenance = { provider: "bing-ai-performance-export", dataset: options.dataset, source: "Bing Webmaster Tools AI Performance export", exportReference: options.exportReference ?? null, locale: options.locale, page: pageUrl ?? null, groundingQuery: groundingQuery ?? null, entityType: options.entityType ?? null };
    const output: ExternalVisibilityObservation[] = [];
    if (citations !== undefined) {
      const metric = options.dataset === "pages" ? "bing-ai-page-citations" : options.dataset === "grounding-queries" ? "bing-ai-grounding-query-citations" : "bing-ai-citations";
      output.push({ surface: "ai-answer", metric, numericValue: citations, ...entity, queryText: groundingQuery, pageUrl, observedAt, provenance: baseProvenance });
      if (pageUrl) output.push({ surface: "ai-answer", metric: "bing-ai-citation-observed", numericValue: 1, ...entity, queryText: groundingQuery, pageUrl, citationUrl: pageUrl, ...(title ? { citationTitle: title } : {}), citationCount: citations, observedAt, provenance: baseProvenance });
    }
    if (citationShare !== undefined) output.push({ surface: "ai-answer", metric: "bing-ai-citation-share", numericValue: citationShare, ...entity, queryText: groundingQuery, pageUrl, observedAt, provenance: baseProvenance });
    if (intent) output.push({ surface: "ai-answer", metric: "bing-ai-intent", textValue: intent, ...entity, queryText: groundingQuery, pageUrl, observedAt, provenance: baseProvenance });
    if (topic) output.push({ surface: "ai-answer", metric: "bing-ai-topic", textValue: topic, ...entity, queryText: groundingQuery, pageUrl, observedAt, provenance: baseProvenance });
    if (pageUrl && options.dataset === "pages") output.push({ surface: "ai-answer", metric: "bing-ai-page-observed", textValue: pageUrl, ...entity, queryText: groundingQuery, pageUrl, observedAt, provenance: baseProvenance });
    return output;
  });
}

function parseRows(input: string | readonly Record<string, unknown>[]): readonly Record<string, unknown>[] {
  if (typeof input !== "string") return input;
  const trimmed = input.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error("JSON export must contain an array of rows.");
    return parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  }
  return parseCsv(trimmed);
}

function parseCsv(input: string): readonly Record<string, unknown>[] {
  const delimiter: "," | "\t" = detectDelimiter(input);
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"') {
      if (quoted && next === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim())) records.push(row);
      row = [];
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) records.push(row);
  const headers = (records.shift() ?? []).map(normalizeHeader);
  return records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])));
}

function detectDelimiter(input: string): "," | "\t" {
  const firstLine = input.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
}

function normalizeHeader(value: string): string {
  return value.replace(/\ufeff/g, "").trim();
}

function stringValue(row: Record<string, unknown>, aliases: readonly string[]): string | undefined {
  for (const key of aliases) {
    const found = Object.entries(row).find(([name]) => name.trim().toLowerCase() === key.trim().toLowerCase())?.[1];
    if (typeof found === "string" && found.trim()) return found.trim();
    if (typeof found === "number" && Number.isFinite(found)) return String(found);
  }
  return undefined;
}

function numberValue(row: Record<string, unknown>, aliases: readonly string[]): number | undefined {
  const raw = stringValue(row, aliases);
  if (!raw) return undefined;
  const normalized = raw.replace(/%/g, "").replace(/\s/g, "");
  const value = Number(normalized.replace(",", "."));
  return Number.isFinite(value) ? value : undefined;
}

function dateValue(row: Record<string, unknown>, aliases: readonly string[]): string | undefined {
  const raw = stringValue(row, aliases);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
}
