import { describe, expect, it } from "vitest";
import { composeExportDocument } from "./export-document";

const request = {
  metadata: {
    documentType: "report",
    title: "Quarterly report",
    generatedAt: "2026-09-24T12:00:00.000Z",
    sourceCapability: "CAP.REPORT.READ@1",
    resourceScope: "report:r1",
    organizationId: "org_1",
    workspaceId: "ws_1",
    actorId: "user_1",
  },
  locale: "en-US",
  timezone: "UTC",
  calendar: "gregorian" as const,
  template: { id: "report.default", version: 1 },
};

describe("composeExportDocument", () => {
  it("creates a scoped immutable snapshot with provenance and integrity evidence", async () => {
    const document = await composeExportDocument(request, {
      async query(input) {
        expect(input).toEqual({ capability: "CAP.REPORT.READ@1", resourceScope: "report:r1" });
        return [{ title: "Summary", blocks: ["Revenue"], tables: [{ columns: ["value"], rows: [["100"]] }] }];
      },
    });

    expect(document.metadata.organizationId).toBe("org_1");
    expect(document.sections[0]?.tables[0]?.rows[0]?.[0]).toBe("100");
    expect(document.provenance.templateVersion).toBe("1");
    expect(document.integrity.snapshotHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails closed without tenant scope", async () => {
    await expect(composeExportDocument({
      ...request,
      metadata: { ...request.metadata, workspaceId: "" },
    }, { async query() { return []; } })).rejects.toThrow("tenant scope");
  });
});
