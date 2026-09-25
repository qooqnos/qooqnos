import type { SeoEntity, SeoProductVariantSeo } from "./types";

export type MerchantProductFeedItemSkipReason =
  | "missing-description"
  | "missing-image"
  | "missing-price"
  | "missing-currency"
  | "missing-availability"
  | "missing-condition";

export interface MerchantProductFeedItem {
  readonly id: string;
  readonly itemGroupId?: string;
  readonly title: string;
  readonly description: string;
  readonly link: string;
  readonly imageLink: string;
  readonly price: number;
  readonly currency: string;
  readonly availability: "in_stock" | "out_of_stock" | "preorder" | "backorder";
  readonly condition: "new" | "refurbished" | "used";
  readonly sku?: string;
}

export interface MerchantProductFeedProjection {
  readonly items: readonly MerchantProductFeedItem[];
  readonly skipped: readonly {
    readonly entityId: string;
    readonly reasons: readonly MerchantProductFeedItemSkipReason[];
  }[];
}

export interface MerchantProductFeedOptions {
  readonly canonicalBaseUrl: string;
  readonly canonicalUrlByEntityId?: Readonly<Record<string, string>>;
  readonly now?: string;
}

export function projectMerchantProductFeed(
  entities: readonly SeoEntity[],
  options: MerchantProductFeedOptions,
): MerchantProductFeedProjection {
  const items: MerchantProductFeedItem[] = [];
  const skipped: { entityId: string; reasons: MerchantProductFeedItemSkipReason[] }[] = [];

  for (const entity of entities) {
    if (entity.type !== "Product") continue;
    if (entity.publicationState !== "published" || entity.visibility !== "public") continue;

    const variants = (entity.productVariants ?? []).filter((variant) => Boolean(variant.id));
    const candidates = variants.length ? variants.map((variant) => ({ entity, variant })) : [{ entity, variant: undefined }];

    for (const candidate of candidates) {
      const item = toItem(candidate.entity, candidate.variant, options);
      if (item.item) {
        items.push(item.item);
        continue;
      }
      skipped.push({
        entityId: candidate.variant?.id ?? entity.id,
        reasons: item.reasons,
      });
    }
  }

  return { items, skipped };
}

export function buildMerchantProductFeedXml(items: readonly MerchantProductFeedItem[], canonicalBaseUrl = "https://qooqnos.com"): string {
  const body = items.map((item) => [
    "<item>",
    tag("g:id", item.id),
    tag("g:title", item.title),
    tag("g:description", item.description),
    tag("g:link", item.link),
    tag("g:image_link", item.imageLink),
    tag("g:availability", item.availability),
    tag("g:condition", item.condition),
    tag("g:price", formatPrice(item.price, item.currency)),
    ...(item.itemGroupId ? [tag("g:item_group_id", item.itemGroupId)] : []),
    "</item>",
  ].join("")).join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "<channel>",
    tag("title", "Phoenix Merchant Center Product Feed"),
    tag("link", canonicalBaseUrl.replace(/\/$/, "") + "/"),
    tag("description", "Canonical Phoenix marketplace product data."),
    body,
    "</channel></rss>",
  ].join("");
}

function toItem(
  entity: SeoEntity,
  variant: SeoProductVariantSeo | undefined,
  options: MerchantProductFeedOptions,
): { item?: MerchantProductFeedItem; reasons: MerchantProductFeedItemSkipReason[] } {
  const reasons: MerchantProductFeedItemSkipReason[] = [];
  const baseUrl = options.canonicalBaseUrl.replace(/\/$/, "");
  const link = validHttpUrl(variant?.url)
    ? variant!.url!
    : (validHttpUrl(options.canonicalUrlByEntityId?.[entity.id]) ? options.canonicalUrlByEntityId![entity.id] : baseUrl + entityUrl(entity));

  const description = clean(variant?.description) || clean(entity.description) || clean(entity.summary);
  if (!description) reasons.push("missing-description");

  const imageLink = validHttpUrl(variant?.imageUrl) ? variant!.imageUrl! : validHttpUrl(entity.imageUrl) ? entity.imageUrl! : "";
  if (!imageLink) reasons.push("missing-image");

  const price = variant?.price ?? entity.price;
  if (price === undefined || !Number.isFinite(price) || price < 0) reasons.push("missing-price");

  const currency = clean(variant?.currency) || clean(entity.currency);
  if (!currency) reasons.push("missing-currency");

  const availability = normalizeMerchantAvailability(variant?.availability ?? entity.availability);
  if (!availability) reasons.push("missing-availability");

  const condition = normalizeCondition(variant?.attributes?.condition);
  if (!condition) reasons.push("missing-condition");

  if (reasons.length) return { reasons };

  const variantSuffix = variant ? variantTitleSuffix(variant) : "";
  const title = truncate(
    clean(variant?.name) || [clean(entity.preferredName), variantSuffix].filter(Boolean).join(" - "),
    70,
  );

  return {
    reasons,
    item: {
      id: variant?.id ?? entity.id,
      ...(variant ? { itemGroupId: entity.productGroupId ?? entity.id } : {}),
      title,
      description: truncate(description, 5000),
      link,
      imageLink,
      price: price!,
      currency,
      availability: availability!,
      condition: condition!,
      ...(variant?.sku ? { sku: clean(variant.sku) } : {}),
    },
  };
}

function normalizeCondition(value: unknown): "new" | "refurbished" | "used" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "new") return "new";
  if (normalized === "refurbished" || normalized === "renewed") return "refurbished";
  if (normalized === "used" || normalized === "preowned") return "used";
  return undefined;
}

function normalizeMerchantAvailability(value: string | undefined): MerchantProductFeedItem["availability"] | undefined {
  const normalized = (value ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
  const map: Record<string, MerchantProductFeedItem["availability"]> = {
    instock: "in_stock",
    outofstock: "out_of_stock",
    preorder: "preorder",
    backorder: "backorder",
  };
  return map[normalized];
}

function variantTitleSuffix(variant: SeoProductVariantSeo): string {
  return Object.entries(variant.attributes ?? {})
    .filter(([key]) => key.trim().toLowerCase() !== "condition")
    .map(([key, value]) => [humanize(key), clean(value)].filter(Boolean).join(": "))
    .filter(Boolean)
    .sort()
    .join(", ");
}

function humanize(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
}

function entityUrl(entity: SeoEntity): string {
  const type = entity.type.toLowerCase();
  return "/" + encodeURIComponent(entity.locale) + "/" + type + "/" + encodeURIComponent(entity.id);
}

function formatPrice(value: number, currency: string): string {
  return Number(value).toFixed(2) + " " + currency.toUpperCase();
}

function tag(name: string, value: string): string {
  return "<" + name + ">" + escapeXml(value) + "</" + name + ">";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max).trimEnd() : value;
}

function validHttpUrl(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
