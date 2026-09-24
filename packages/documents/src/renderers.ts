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
    version: 1,
    format: "pdf",
    async render(document) {
      return {
        format: "pdf",
        mediaType: "application/pdf",
        filename: safeFilename(document.metadata.title) + ".pdf",
        bytes: createMinimalPdf(document),
        sourceSnapshotHash: document.integrity.snapshotHash,
        rendererId: "phoenix.pdf",
        rendererVersion: 1,
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
      const html = createPrintHtml(document);
      return {
        format: "print",
        mediaType: "text/html; charset=utf-8",
        filename: safeFilename(document.metadata.title) + ".html",
        bytes: new TextEncoder().encode(html),
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
  const lines: string[] = [
    document.metadata.title,
    "Type: " + document.metadata.documentType,
    "Generated: " + document.metadata.generatedAt,
    "Locale: " + document.locale,
    ...document.header,
  ];
  for (const section of document.sections) {
    lines.push("", section.title, ...section.blocks);
    for (const table of section.tables) {
      lines.push(table.columns.join(" | "));
      for (const row of table.rows) lines.push(row.join(" | "));
    }
  }
  lines.push("", ...document.footer);
  return lines.filter((line) => line.length > 0);
}

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createMinimalPdf(document: ExportDocument): Uint8Array {
  const lines = documentLines(document).map((line) => line.replace(/[^\x20-\x7E]/g, "?")).slice(0, 48);
  const content = [
    "BT",
    "/F1 11 Tf",
    "50 760 Td",
    ...lines.map((line, index) => (index === 0 ? "" : "0 -15 Td ") + "(" + pdfEscape(line.slice(0, 120)) + ") Tj"),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    "<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += (i + 1) + " 0 obj\n" + objects[i] + "\nendobj\n";
  }
  const xref = pdf.length;
  pdf += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  pdf += "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
  return new TextEncoder().encode(pdf);
}

function createPrintHtml(document: ExportDocument): string {
  const esc = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const sections = document.sections.map((section) => "<section><h2>" + esc(section.title) + "</h2>" + section.blocks.map((b) => "<p>" + esc(b) + "</p>").join("") + section.tables.map((t) => "<table><thead><tr>" + t.columns.map((c) => "<th>" + esc(c) + "</th>").join("") + "</tr></thead><tbody>" + t.rows.map((r) => "<tr>" + r.map((c) => "<td>" + esc(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table>").join("") + "</section>").join("");
  return "<!doctype html><html lang=\"" + esc(document.locale) + "\"><head><meta charset=\"utf-8\"><title>" + esc(document.metadata.title) + "</title><style>@page{size:A4;margin:18mm}body{font-family:system-ui,sans-serif;line-height:1.5}table{width:100%;border-collapse:collapse;margin:1rem 0}th,td{border:1px solid #999;padding:.4rem;text-align:start}section{break-inside:avoid}</style></head><body><header>" + document.header.map(esc).map((x) => "<p>" + x + "</p>").join("") + "</header><h1>" + esc(document.metadata.title) + "</h1>" + sections + "<footer>" + document.footer.map(esc).map((x) => "<p>" + x + "</p>").join("") + "</footer></body></html>";
}
