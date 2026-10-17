import { describe, expect, it } from "vitest";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { ApiRouter } from "./router";
import { hasValidWebpRiffHeader, registerMediaRoutes } from "./media-routes";
import type { ApiEnv } from "./env";

const mediaRow = {
  assetId: "asset-photo-1",
  storageKey: "tenant-1/workspace-1/offering/offering-1/card.webp",
  mimeType: "image/webp",
  byteSize: 23,
  width: 800,
  height: 1000,
  purpose: "primary",
  position: 0,
};

function buildRouter(options: { exposeMedia?: boolean } = {}) {
  const statements: string[] = [];
  const objectBytes = new TextEncoder().encode("safe-image-variant");
  const statement = (query: string): D1PreparedStatementLike => {
    let values: unknown[] = [];
    return {
      bind(...args: unknown[]) { values = args; return this; },
      async first<T>() {
        if (!options.exposeMedia) return null as T | null;
        if (query.includes("FROM offerings o") && query.includes("AND a.id = ?") && values[1] === mediaRow.assetId) {
          return mediaRow as T;
        }
        return null as T | null;
      },
      async all<T>() {
        if (options.exposeMedia && query.includes("FROM offerings o")) return { results: [mediaRow as T] };
        return { results: [] as T[] };
      },
      async run() { return { success: true }; },
    };
  };
  const raw: D1DatabaseLike = {
    prepare(query: string) { statements.push(query); return statement(query); },
    async batch() { return []; },
  };
  const database = new D1Database(raw);
  const bucket = {
    async get(key: string) {
      if (key !== mediaRow.storageKey) return null;
      return {
        body: new ReadableStream<Uint8Array>({
          start(controller) { controller.enqueue(objectBytes); controller.close(); },
        }),
      };
    },
  };
  const env = { MEDIA_BUCKET: bucket } as unknown as ApiEnv;
  const router = new ApiRouter({ database });
  registerMediaRoutes(router, database, env, undefined);
  return { router, statements, objectBytes };
}

describe("public published-offering media routes", () => {
  it("returns only a public content path for an eligible processed image", async () => {
    const { router, statements } = buildRouter({ exposeMedia: true });
    const response = await router.handle(new Request("https://example.test/api/v1/public/offerings/offering-1/media"));
    expect(response.status).toBe(200);
    const body = await response.json() as { data: Array<Record<string, unknown>> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      assetId: "asset-photo-1", purpose: "primary", mimeType: "image/webp", width: 800, height: 1000,
      src: "/api/v1/public/offerings/offering-1/media/asset-photo-1/content",
    });
    expect(body.data[0]).not.toHaveProperty("storageKey");
    expect(statements[0]).toContain("o.publication_status = 'published'");
    expect(statements[0]).toContain("b.publication_status = 'published'");
    expect(statements[0]).toContain("a.status = 'ready'");
    expect(statements[0]).toContain("v.status = 'ready'");
    expect(statements[0]).toContain("v.variant_key IN ('detail', 'card', 'thumbnail')");
  });

  it("streams the processed image with safe public cache headers", async () => {
    const { router } = buildRouter({ exposeMedia: true });
    const response = await router.handle(new Request("https://example.test/api/v1/public/offerings/offering-1/media/asset-photo-1/content"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Cache-Control")).toContain("public");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    await expect(response.text()).resolves.toBe("safe-image-variant");
  });

  it("does not reveal media when the published-offer relationship does not match", async () => {
    const { router, statements } = buildRouter();
    const response = await router.handle(new Request("https://example.test/api/v1/public/offerings/offering-1/media/asset-private/content"));
    expect(response.status).toBe(404);
    expect(statements[0]).toContain("o.status = 'active'");
    expect(statements[0]).toContain("b.status = 'active'");
  });
});

describe("prepared WebP image validation", () => {
  function webpHeader(totalSize: number): Uint8Array {
    const header = new Uint8Array(12);
    header.set([0x52, 0x49, 0x46, 0x46], 0);
    const riffSize = totalSize - 8;
    header[4] = riffSize & 0xff;
    header[5] = (riffSize >>> 8) & 0xff;
    header[6] = (riffSize >>> 16) & 0xff;
    header[7] = (riffSize >>> 24) & 0xff;
    header.set([0x57, 0x45, 0x42, 0x50], 8);
    return header;
  }

  it("accepts a WebP RIFF header whose declared size matches the uploaded file", () => {
    expect(hasValidWebpRiffHeader(webpHeader(120), 120)).toBe(true);
  });

  it("rejects spoofed MIME content and mismatched RIFF lengths", () => {
    const html = new Uint8Array(12);
    html.set(new TextEncoder().encode("<html>nope"));
    expect(hasValidWebpRiffHeader(html, 120)).toBe(false);
    expect(hasValidWebpRiffHeader(webpHeader(120), 119)).toBe(false);
    expect(hasValidWebpRiffHeader(new Uint8Array(6), 6)).toBe(false);
  });
});
