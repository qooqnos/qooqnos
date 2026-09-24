import type { StructuredData } from "./types";

export interface StructuredDataValidationIssue {
  readonly code: "MISSING_CONTEXT" | "MISSING_TYPE" | "INVALID_TYPE" | "INVALID_URL" | "EMPTY_PROPERTY";
  readonly severity: "error" | "warning";
  readonly path: string;
  readonly message: string;
}

export interface StructuredDataValidationResult {
  readonly valid: boolean;
  readonly issues: readonly StructuredDataValidationIssue[];
}

const APPROVED_TYPES = new Set([
  "Organization","LocalBusiness","Person","Service","Product","Offer","Place","Thing","EducationalOccupationalCredential","Event","Brand","Article","FAQPage","BreadcrumbList","Review","CollectionPage",
]);

export function validateStructuredData(value: StructuredData): StructuredDataValidationResult {
  const issues: StructuredDataValidationIssue[] = [];
  if (value["@context"] !== "https://schema.org") issues.push({ code: "MISSING_CONTEXT", severity: "error", path: "@context", message: "Structured data must use schema.org context." });
  if (typeof value["@type"] !== "string" || !value["@type"].trim()) issues.push({ code: "MISSING_TYPE", severity: "error", path: "@type", message: "Structured data must declare a type." });
  else if (!APPROVED_TYPES.has(value["@type"])) issues.push({ code: "INVALID_TYPE", severity: "warning", path: "@type", message: `Type '${value["@type"]}' requires explicit policy approval.` });
  walk(value, "$", issues);
  return { valid: issues.every((issue) => issue.severity !== "error"), issues };
}

function walk(value: unknown, path: string, issues: StructuredDataValidationIssue[]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, issues));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (child === "") issues.push({ code: "EMPTY_PROPERTY", severity: "warning", path: `${path}.${key}`, message: "Structured-data properties should not be empty." });
    if (key === "url" || key === "sameAs") {
      const values = Array.isArray(child) ? child : [child];
      for (const item of values) if (typeof item === "string") {
        try { new URL(item); } catch { issues.push({ code: "INVALID_URL", severity: "error", path: `${path}.${key}`, message: "URL value is invalid." }); }
      }
    }
    walk(child, `${path}.${key}`, issues);
  }
}
