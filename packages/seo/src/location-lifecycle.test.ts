import { describe, expect, it } from "vitest";
import { buildEntityGraph, buildSeoProjectionPlan, seoEntityFromEvent } from "@qooqnos/seo";

describe("Business Location SEO lifecycle", () => {
  const event = {
    id: "location-event-1",
    eventType: "business.location.changed.v1",
    eventVersion: 1,
    organizationId: "org-1",
    workspaceId: "ws-1",
    aggregateId: "location-1",
    occurredAt: "2026-09-25T08:00:00.000Z",
    payloadJson: JSON.stringify({
      locationId: "location-1",
      businessId: "business-1",
      changeType: "entity-published",
      status: "active",
      name: "Phoenix Downtown",
      locationType: "physical",
      timezone: "Asia/Baku",
      address: { addressLocality: "Baku", addressCountry: "AZ" },
      geoPoint: { latitude: 40.4093, longitude: 49.8671 },
      businessPublicationStatus: "published",
      updatedAt: "2026-09-25T08:00:00.000Z",
    }),
  };

  it("projects a canonical public Location page with GEO and graph-ready ownership", () => {
    const entity = seoEntityFromEvent(event);
    expect(entity?.type).toBe("Location");
    expect(entity?.publicationState).toBe("published");
    expect(entity?.relatedEntityIds).toEqual(["business-1"]);
    expect(entity?.geoPoint).toEqual({ latitude: 40.4093, longitude: 49.8671 });

    const graph = buildEntityGraph([
      { entityId: "location-1", entityType: "Location", sourceModule: "business", sourceVersion: "1", publicationState: "published", visibility: "public", locale: "en", preferredName: "Phoenix Downtown", canonicalUrl: "https://qooqnos.com/en/location/phoenix-downtown-location-1" },
      { entityId: "business-1", entityType: "Business", sourceModule: "business", sourceVersion: "1", publicationState: "published", visibility: "public", locale: "en", preferredName: "Phoenix Studio", canonicalUrl: "https://qooqnos.com/en/business/phoenix-studio-business-1" },
    ], [{ sourceEntityId: "business-1", targetEntityId: "location-1", relation: "hasLocation", provenance: "business-canonical", confidence: 1, verifiedAt: "2026-09-25T08:00:00.000Z" }]);
    const plan = buildSeoProjectionPlan({
      entity: entity!,
      graph,
      canonicalBaseUrl: "https://qooqnos.com",
      now: "2026-09-25T08:00:00.000Z",
    });

    expect(plan.canonicalUrl).toContain("/en/location/phoenix-downtown-location-1");
    expect(plan.audit.status).not.toBe("blocked");
    expect(plan.page.breadcrumbs.at(-1)?.url).toBe(plan.canonicalUrl);
    expect(plan.internalLinks.some((link) => link.targetEntityId === "business-1")).toBe(true);
    expect(plan.structuredData["@type"]).toBe("Place");
    expect(plan.structuredData.geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: 40.4093,
      longitude: 49.8671,
    });
  });

  it("keeps inactive locations non-public", () => {
    const inactive = seoEntityFromEvent({
      ...event,
      payloadJson: event.payloadJson.replace('"status":"active"', '"status":"inactive"').replace('"changeType":"entity-published"', '"changeType":"entity-unpublished"'),
    });
    expect(inactive?.publicationState).toBe("unpublished");
    expect(inactive?.visibility).toBe("private");
  });
});
