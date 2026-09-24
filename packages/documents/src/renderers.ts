import type { ExportDocument } from "./export-document";

export type DocumentOutputFormat = "pdf" | "print";

export interface DocumentRenderProfile {
  readonly id: string;
  readonly version: number;
  readonly locale: string;
  readonly timezone: string;
  readonly format: DocumentOutputFormat;
  readonly options?: Readonly<Record<string, string | number | boolean>>;
}

export interface DocumentArtifact {
  readonly format: DocumentOutputFormat;
  readonly mediaType: string;
  readonly filename: string;
  readonly bytes: Uint8Array;
  readonly sourceSnapshotHash: string;
  readonly rendererId: string;
  readonly rendererVersion: number;
}

export interface DocumentRenderer {
  readonly rendererId: string;
  readonly version: number;
  readonly format: DocumentOutputFormat;
  render(document: ExportDocument, profile: DocumentRenderProfile): Promise<DocumentArtifact>;
}

export interface DocumentArtifactStore {
  put(input: {
    readonly organizationId: string;
    readonly workspaceId: string;
    readonly actorId: string;
    readonly artifact: DocumentArtifact;
    readonly idempotencyKey: string;
  }): Promise<{ readonly artifactReference: string }>;
}

export interface DocumentRendererRegistry {
  resolve(format: DocumentOutputFormat): DocumentRenderer | null;
}

export function createDocumentRendererRegistry(renderers: readonly DocumentRenderer[] = []): DocumentRendererRegistry {
  const registry = new Map<DocumentOutputFormat, DocumentRenderer>();
  for (const renderer of renderers) {
    if (!renderer.rendererId.trim()) throw new Error("Document rendererId is required");
    if (!Number.isInteger(renderer.version) || renderer.version < 1) throw new Error("Document renderer version is invalid");
    if (registry.has(renderer.format)) throw new Error("Document renderer already registered: " + renderer.format);
    registry.set(renderer.format, renderer);
  }
  return { resolve: (format) => registry.get(format) ?? null };
}

export async function renderDocument(document: ExportDocument, profile: DocumentRenderProfile, registry: DocumentRendererRegistry): Promise<DocumentArtifact> {
  if (profile.version < 1) throw new Error("Document render profile version is invalid");
  if (!profile.locale.trim() || !profile.timezone.trim()) throw new Error("Document render profile locale/timezone is required");
  const renderer = registry.resolve(profile.format);
  if (!renderer) throw new Error("No renderer registered for requested document format");
  return renderer.render(document, profile);
}

export function createDefaultDocumentRendererRegistry(): DocumentRendererRegistry {
  return createDocumentRendererRegistry([createPdfDocumentRenderer(), createPrintDocumentRenderer()]);
}

export function createPdfDocumentRenderer(): DocumentRenderer {
  return {
    rendererId: "phoenix.pdf",
    version: 2,
    format: "pdf",
    async render(document, profile) {
      return {
        format: "pdf",
        mediaType: "application/pdf",
        filename: safeFilename(document.metadata.title) + ".pdf",
        bytes: createPdf(document, profile),
        sourceSnapshotHash: document.integrity.snapshotHash,
        rendererId: "phoenix.pdf",
        rendererVersion: 2,
      };
    },
  };
}

export function createPrintDocumentRenderer(): DocumentRenderer {
  return {
    rendererId: "phoenix.print",
    version: 1,
    format: "print",
    async render(document) {
      return {
        format: "print",
        mediaType: "text/html; charset=utf-8",
        filename: safeFilename(document.metadata.title) + ".html",
        bytes: new TextEncoder().encode(createPrintHtml(document)),
        sourceSnapshotHash: document.integrity.snapshotHash,
        rendererId: "phoenix.print",
        rendererVersion: 1,
      };
    },
  };
}

function safeFilename(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

function documentLines(document: ExportDocument): string[] {
  const lines = [document.metadata.title, "Type: " + document.metadata.documentType, "Generated: " + document.metadata.generatedAt, "Locale: " + document.locale, ...document.header];
  for (const section of document.sections) {
    lines.push("", section.title, ...section.blocks);
    for (const table of section.tables) {
      lines.push(table.columns.join(" | "));
      for (const row of table.rows) lines.push(row.join(" | "));
    }
  }
  lines.push("", ...document.footer);
  return lines.filter(Boolean);
}

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createPdf(document: ExportDocument, profile: DocumentRenderProfile): Uint8Array {
  void profile;
  const lines = documentLines(document).flatMap((line) => wrapLine(line, 92));
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += 46) pages.push(lines.slice(i, i + 46));
  if (!pages.length) pages.push([""]);

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageObjectNumbers: number[] = [];
  const contentObjectNumbers: number[] = [];
  const fontObjectNumber = 3 + pages.length * 2;
  for (let i = 0; i < pages.length; i++) {
    pageObjectNumbers.push(3 + i * 2);
    contentObjectNumbers.push(4 + i * 2);
  }
  objects.push("<< /Type /Pages /Kids [" + pageObjectNumbers.map((n) => n + " 0 R").join(" ") + "] /Count " + pages.length + " >>");

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i] ?? [];
    const content = page.map((line, index) => (index === 0 ? "50 760 Td " : "0 -15 Td ") + "(" + pdfEscape(line.slice(0, 120)) + ") Tj").join("\n");
    objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 " + fontObjectNumber + " 0 R >> >> /Contents " + contentObjectNumbers[i] + " 0 R >>");
    objects.push("<< /Length " + content.length + " >>\nstream\nBT\n/F1 10 Tf\n" + content + "\nET\nendstream");
  }

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Name /F1 >>");

  return serializePdf(objects);
}

function wrapLine(value: string, width: number): string[] {
  if (value.length <= width) return [value];
  const result: string[] = [];
  for (let i = 0; i < value.length; i += width) result.push(value.slice(i, i + width));
  return result;
}

function serializePdf(objects: string[]): Uint8Array {
  // PDF xref entries are byte offsets, not JavaScript UTF-16 string lengths.
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [encoder.encode("%PDF-1.4\\n%\\xE2\\xE3\\xCF\\xD3\\n")];
  const offsets = [0];
  let byteLength = chunks[0]?.byteLength ?? 0;

  for (let i = 0; i < objects.length; i++) {
    offsets.push(byteLength);
    const chunk = encoder.encode((i + 1) + " 0 obj\\n" + objects[i] + "\\nendobj\\n");
    chunks.push(chunk);
    byteLength += chunk.byteLength;
  }

  const xrefOffset = byteLength;
  let trailer = "xref\\n0 " + (objects.length + 1) + "\\n0000000000 65535 f \\n";
  for (let i = 1; i <= objects.length; i++) {
    trailer += String(offsets[i]).padStart(10, "0") + " 00000 n \\n";
  }
  trailer += "trailer\\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\\nstartxref\\n" + xrefOffset + "\\n%%EOF\\n";
  chunks.push(encoder.encode(trailer));

  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let cursor = 0;
  for (const chunk of chunks) {
    result.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  return result;
}

function createPrintHtml(document: ExportDocument): string {
  const esc = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const direction = /^fa|^ar|^he/i.test(document.locale) ? "rtl" : "ltr";
  const sections = document.sections.map((section) => "<section><h2>" + esc(section.title) + "</h2>" + section.blocks.map((b) => "<p>" + esc(b) + "</p>").join("") + section.tables.map((t) => "<table><thead><tr>" + t.columns.map((c) => "<th>" + esc(c) + "</th>").join("") + "</tr></thead><tbody>" + t.rows.map((r) => "<tr>" + r.map((c) => "<td>" + esc(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table>").join("") + "</section>").join("");
  return "<!doctype html><html lang=\"" + esc(document.locale) + "\" dir=\"" + direction + "\"><head><meta charset=\"utf-8\"><title>" + esc(document.metadata.title) + "</title><style>@page{size:A4;margin:18mm}body{font-family:system-ui,sans-serif;line-height:1.5;direction:" + direction + "}table{width:100%;border-collapse:collapse;margin:1rem 0}th,td{border:1px solid #999;padding:.4rem;text-align:start}section{break-inside:avoid}footer{margin-top:2rem}</style></head><body><header>" + document.header.map(esc).map((x) => "<p>" + x + "</p>").join("") + "</header><h1>" + esc(document.metadata.title) + "</h1>" + sections + "<footer>" + document.footer.map(esc).map((x) => "<p>" + x + "</p>").join("") + "</footer></body></html>";
}
