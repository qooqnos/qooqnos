import { describe, expect, it } from "vitest";
import { planSeoInvalidation } from "./invalidation";
import { loadCanonicalEntityGraph } from "./canonical";

describe("SEO canonical ingestion and invalidation", () => {
  it("loads only entities owned by the declared source module", async () => {
    const source = {
      moduleId: "business",
      contractVersion: "1",
      async getEntity(entityId: string, locale: string) {
        if (entityId !== "b1" || locale !== "en-US") return null;
        return {
          id: "b1",
          type: "Business" as const,
          sourceModule: "business",
          sourceVersion: "1",
          publicationState: "published" as const,
          visibility: "public" as const,
          preferredName: "Business",
          summary: "Factual",
          locale,
          updatedAt: "2026-09-24T00:00:00Z",
        };
      },
      async listRelatedEntities() { return []; },
    };
    const loaded = await loadCanonicalEntityGraph({ source, entityIds: ["b1", "b1"], locale: "en-US" });
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.entity.id).toBe("b1");
  });

  it("invalidates the changed entity and dependent representations deterministically", () => {
    const targets = planSeoInvalidation(
      {
        eventId: "evt-1",
        entityId: "service-1",
        entityType: "Service",
        sourceModule: "catalog",
        sourceVersion: "2",
        reason: "entity-updated",
        occurredAt: "2026-09-24T00:00:00Z",
      },
      [
        { representationEntityId: "business-1", dependencyEntityId: "service-1" },
        { representationEntityId: "category-1", dependencyEntityId: "service-1" },
      ],
    );
    expect(targets.map((target) => target.entityId)).toEqual(["business-1", "category-1", "service-1"]);
  });
});
