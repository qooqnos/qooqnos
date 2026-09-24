import type { SeoEntity } from "./types";

export function slugify(value: string): string {
  return value.normalize("NFKC").toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "entity";
}

export function canonicalEntityUrl(baseUrl: string, entity: SeoEntity): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return base + "/" + encodeURIComponent(entity.locale) + "/" + entity.type.toLowerCase() + "/" + slugify(entity.preferredName) + "-" + encodeURIComponent(entity.id);
}
