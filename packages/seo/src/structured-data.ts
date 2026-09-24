import type { BreadcrumbItem, SeoEntity, StructuredData } from "./types";

const TYPE_MAP: Readonly<Record<SeoEntity["type"], string>> = {
  Organization: "Organization",
  Business: "LocalBusiness",
  Person: "Person",
  Service: "Service",
  Product: "Product",
  Offer: "Offer",
  Location: "Place",
  Branch: "LocalBusiness",
  Category: "Thing",
  Collection: "CollectionPage",
  Review: "Review",
  FAQ: "FAQPage",
  Article: "Article",
  Event: "Event",
  Brand: "Brand",
  Credential: "EducationalOccupationalCredential",
};

function clean(value: string | undefined): string { return (value ?? "").replace(/\s+/g, " ").trim(); }
function validHttpUrl(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  try { const u = new URL(value); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; }
}
function validDate(value: string | undefined): boolean { return Boolean(value) && Number.isFinite(Date.parse(value!)); }
function unique(values: readonly string[]): string[] { return [...new Set(values.map(clean).filter(Boolean))]; }

export interface StructuredDataOptions {
  readonly canonicalUrl?: string;
  readonly breadcrumbs?: readonly BreadcrumbItem[];
}

export function generateStructuredData(entity: SeoEntity, options: StructuredDataOptions = {}): StructuredData {
  const type = TYPE_MAP[entity.type];
  const name = clean(entity.preferredName);
  const description = clean(entity.description) || clean(entity.summary);
  const alternateNames = unique(entity.alternateNames ?? []);
  const sameAs = unique(entity.sameAs ?? []).filter(validHttpUrl);
  const canonicalUrl = validHttpUrl(options.canonicalUrl) ? options.canonicalUrl : undefined;

  const x: StructuredData = {
    "@context": "https://schema.org",
    "@type": type,
    name,
    inLanguage: clean(entity.locale) || "en",
  };

  if (canonicalUrl) {
    x["@id"] = canonicalUrl + "#entity";
    x.url = canonicalUrl;
  }
  if (description) x.description = description;
  if (alternateNames.length) x.alternateName = alternateNames;
  if (sameAs.length) x.sameAs = sameAs;
  if (entity.canonicalId) {
    if (validHttpUrl(entity.canonicalId)) x["@id"] = entity.canonicalId;
    else x.identifier = entity.canonicalId;
  }
  if (entity.imageUrl && validHttpUrl(entity.imageUrl)) x.image = entity.imageUrl;
  if (entity.country) x.areaServed = { "@type": "Country", name: clean(entity.country) };
  const areas = unique(entity.serviceArea ?? []);
  if (areas.length) x.areaServed = areas.map((area) => ({ "@type": "Place", name: area }));
  if (entity.geoScope) {
    x.additionalType = "https://schema.org/" + (
      entity.geoScope === "exact" ? "Place" :
      entity.geoScope === "city" ? "City" :
      entity.geoScope === "region" ? "AdministrativeArea" :
      entity.geoScope === "country" ? "Country" :
      "Place"
    );
  }

  if (entity.address) {
    const address = Object.fromEntries(
      Object.entries({
        "@type": "PostalAddress",
        streetAddress: clean(entity.address.streetAddress),
        addressLocality: clean(entity.address.addressLocality),
        addressRegion: clean(entity.address.addressRegion),
        postalCode: clean(entity.address.postalCode),
        addressCountry: clean(entity.address.addressCountry),
      }).filter(([, value]) => value),
    );
    if (Object.keys(address).length > 1) x.address = address;
  }

  if (entity.geoPoint && Number.isFinite(entity.geoPoint.latitude) && Number.isFinite(entity.geoPoint.longitude) &&
      entity.geoPoint.latitude >= -90 && entity.geoPoint.latitude <= 90 &&
      entity.geoPoint.longitude >= -180 && entity.geoPoint.longitude <= 180) {
    x.geo = { "@type": "GeoCoordinates", latitude: entity.geoPoint.latitude, longitude: entity.geoPoint.longitude };
  }
  if ((entity.type === "Business" || entity.type === "Branch") && entity.openingHours?.length) {
    x.openingHoursSpecification = entity.openingHours
      .filter((hours) => hours.dayOfWeek.length > 0 && hours.opens && hours.closes)
      .map((hours) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: hours.dayOfWeek,
        opens: hours.opens,
        closes: hours.closes,
      }));
  }

  if (entity.type === "Business" || entity.type === "Branch" || entity.type === "Organization") {
    if (entity.telephone) x.telephone = clean(entity.telephone);
    if (entity.email) x.email = clean(entity.email);
    if (entity.priceRange) x.priceRange = limit(entity.priceRange, 100);
  }

  if (entity.type === "Product") {
    const variants = entity.productVariants ?? [];
    if (variants.length) {
      x["@type"] = "ProductGroup";
      if (entity.productGroupId) x.productGroupID = clean(entity.productGroupId);
      const dimensions = unique(entity.variantDimensions ?? []);
      if (dimensions.length) x.variesBy = dimensions;
      x.hasVariant = variants.map((variant) => {
        const item: Record<string, unknown> = { "@type": "Product" };
        if (variant.name) item.name = clean(variant.name);
        if (variant.sku) item.sku = clean(variant.sku);
        if (variant.url && validHttpUrl(variant.url)) item.url = variant.url;
        if (variant.imageUrl && validHttpUrl(variant.imageUrl)) item.image = variant.imageUrl;
        if (variant.price !== undefined && Number.isFinite(variant.price)) {
          item.offers = { "@type": "Offer", price: variant.price, ...(variant.currency ? { priceCurrency: clean(variant.currency) } : {}), ...(normalizeAvailability(variant.availability) ? { availability: normalizeAvailability(variant.availability) } : {}) };
        }
        const attrs = variant.attributes ?? {};
        for (const [key, value] of Object.entries(attrs)) if (clean(value)) item[key] = clean(value);
        return item;
      });
    }
    if (entity.brandName) x.brand = { "@type": "Brand", name: clean(entity.brandName) };
    if (entity.categoryName) x.category = clean(entity.categoryName);
    if (entity.price !== undefined || entity.currency || entity.availability || entity.shippingDetails || entity.returnPolicy) {
      const offer: Record<string, unknown> = { "@type": "Offer" };
      if (canonicalUrl) offer.url = canonicalUrl;
      if (entity.price !== undefined && Number.isFinite(entity.price)) offer.price = entity.price;
      if (entity.currency) offer.priceCurrency = clean(entity.currency);
      const availability = normalizeAvailability(entity.availability);
      if (availability) offer.availability = availability;
      x.offers = offer;
    }
  }

  if (entity.type === "Offer") {
    if (entity.price !== undefined && Number.isFinite(entity.price)) x.price = entity.price;
    if (entity.currency) x.priceCurrency = clean(entity.currency);
    const availability = normalizeAvailability(entity.availability);
    if (availability) x.availability = availability;
    if (canonicalUrl) x.url = canonicalUrl;
  }

  if (entity.type === "Service") {
    x.serviceType = clean(entity.categoryName) || name;
    if (entity.brandName) x.provider = { "@type": "Organization", name: clean(entity.brandName) };
    if (canonicalUrl) x.url = canonicalUrl;
  }

  if (entity.type === "Location") x.geo = entity.locationId ? { "@type": "Place", identifier: entity.locationId } : undefined;
  if (entity.type === "Person" && entity.email) x.email = clean(entity.email);

  if (entity.type === "Article") {
    x.dateModified = entity.updatedAt;
    x.headline = name;
  }

  if (entity.type === "Event") {
    if (validDate(entity.startDate)) x.startDate = entity.startDate;
    if (validDate(entity.endDate)) x.endDate = entity.endDate;
    x.eventStatus = "https://schema.org/EventScheduled";
    if (canonicalUrl) x.url = canonicalUrl;
  }

  if (entity.type === "Review") {
    if (entity.updatedAt) x.dateModified = entity.updatedAt;
  }

  if (options.breadcrumbs?.length && canonicalUrl) {
    x.mainEntityOfPage = {
      "@type": "WebPage",
      "@id": canonicalUrl,
      url: canonicalUrl,
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: options.breadcrumbs.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      },
    };
  }

  return x;
}

function limit(value: string, max: number): string {
  return value.length > max ? value.slice(0, max).trimEnd() : value;
}

function normalizeAvailability(value: string | undefined): string | undefined {
  const normalized = clean(value);
  if (!normalized) return undefined;
  if (/^https?:\/\//.test(normalized)) return normalized;
  const slug = normalized.toLowerCase().replace(/[^a-z]/g, "");
  const map: Record<string, string> = {
    instock: "https://schema.org/InStock",
    outofstock: "https://schema.org/OutOfStock",
    preorder: "https://schema.org/PreOrder",
    discontinued: "https://schema.org/Discontinued",
    onlineonly: "https://schema.org/OnlineOnly",
    limitedavailability: "https://schema.org/LimitedAvailability",
  };
  return map[slug];
}
