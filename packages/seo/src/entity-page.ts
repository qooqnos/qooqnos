import type { AnswerRepresentation, BreadcrumbItem, InternalLinkRecommendation, SeoEntity, SeoMetadata } from "./types";

export interface EntityPageAction {
  readonly kind: "primary" | "secondary";
  readonly label: string;
  readonly href: string;
  readonly reason: string;
}

export interface EntityPageModel {
  readonly canonicalUrl: string;
  readonly breadcrumbs: readonly BreadcrumbItem[];
  readonly actions: readonly EntityPageAction[];
  readonly relatedLinks: readonly InternalLinkRecommendation[];
  readonly sections: readonly {
    id: string;
    title: string;
    kind: "overview" | "facts" | "relationships" | "geography" | "commerce" | "action";
  }[];
}

export function buildBreadcrumbs(
  entity: SeoEntity,
  canonicalBaseUrl: string,
  canonicalUrl: string,
): readonly BreadcrumbItem[] {
  const base = canonicalBaseUrl.replace(/\/$/, "");
  const locale = encodeURIComponent(entity.locale);
  const type = entity.type.toLowerCase();
  const label = typeLabel(entity.type);

  return [
    { name: "Phoenix", url: base + "/" },
    { name: label, url: base + "/" + locale + "/" + type },
    { name: entity.preferredName, url: canonicalUrl },
  ];
}

export function buildEntityPageModel(
  entity: SeoEntity,
  metadata: SeoMetadata,
  answer: AnswerRepresentation,
  relatedLinks: readonly InternalLinkRecommendation[],
  canonicalBaseUrl: string,
): EntityPageModel {
  const actions: EntityPageAction[] = [
    {
      kind: "primary",
      label: "کشف مرتبط در ققنوس",
      href: "/discover?q=" + encodeURIComponent(entity.preferredName),
      reason: "continue-discovery",
    },
  ];

  if (entity.type === "Service" || entity.type === "Offer" || entity.type === "Business" || entity.type === "Branch") {
    actions.push({
      kind: "secondary",
      label: "شروع اقدام",
      href: "/booking?entity=" + encodeURIComponent(entity.id),
      reason: "action-surface",
    });
  }

  if (entity.type === "Product") {
    actions.push({
      kind: "secondary",
      label: "مشاهده برای خرید",
      href: "/checkout?product=" + encodeURIComponent(entity.id),
      reason: "commerce-surface",
    });
  }

  if (answer.citationReady) {
    actions.push({
      kind: "secondary",
      label: "منبع canonical",
      href: metadata.canonicalUrl,
      reason: "canonical-citation",
    });
  }

  const sections: EntityPageModel["sections"] = [
    { id: "overview", title: "Overview", kind: "overview" },
    { id: "facts", title: "Verified facts", kind: "facts" },
  ];

  if (relatedLinks.length) sections.push({ id: "relationships", title: "Related", kind: "relationships" });
  if (entity.geoScope || entity.country || entity.locationId || entity.serviceArea?.length) sections.push({ id: "geography", title: "Geographic scope", kind: "geography" });
  if (entity.price !== undefined || entity.currency || entity.priceRange || entity.availability) sections.push({ id: "commerce", title: "Commerce", kind: "commerce" });
  sections.push({ id: "action", title: "Next action", kind: "action" });

  return {
    canonicalUrl: metadata.canonicalUrl,
    breadcrumbs: buildBreadcrumbs(entity, canonicalBaseUrl, metadata.canonicalUrl),
    actions,
    relatedLinks,
    sections,
  };
}

function typeLabel(type: SeoEntity["type"]): string {
  const labels: Record<SeoEntity["type"], string> = {
    Organization: "Organizations",
    Business: "Businesses",
    Person: "People",
    Service: "Services",
    Product: "Products",
    Offer: "Offers",
    Location: "Locations",
    Branch: "Branches",
    Category: "Categories",
    Collection: "Collections",
    Review: "Reviews",
    FAQ: "FAQs",
    Article: "Articles",
    Event: "Events",
    Brand: "Brands",
    Credential: "Credentials",
  };
  return labels[type];
}
