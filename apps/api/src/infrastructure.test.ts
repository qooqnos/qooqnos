import { describe, expect, it } from "vitest";
import { assertProductionInfrastructure, checkRuntimeInfrastructure } from "./infrastructure";

describe("runtime infrastructure gates", () => {
  it("requires D1 only outside production", () => {
    const result = checkRuntimeInfrastructure({
      ENVIRONMENT: "development",
      DB: {},
    });
    expect(result.ready).toBe(true);
  });

  it("requires D1 R2 Queue Workers AI and model in production", () => {
    const result = checkRuntimeInfrastructure({
      ENVIRONMENT: "production",
      DB: {},
      MEDIA_BUCKET: {},
      OUTBOX_QUEUE: { send: async () => undefined },
      AI: { run: async () => ({}) },
      AI_SELLER_EXTRACT_MODEL_ID: "@cf/test/model",
    });
    expect(result.ready).toBe(true);
  });

  it("accepts Arvan AIaaS instead of Workers AI in production", () => {
    const result = checkRuntimeInfrastructure({
      ENVIRONMENT: "production",
      DB: {},
      MEDIA_BUCKET: {},
      OUTBOX_QUEUE: { send: async () => undefined },
      AI_PROVIDER_ID: "arvan-aiaas",
      ARVAN_AI_ENDPOINT: "https://example.arvan.test/endpoint",
      ARVAN_AI_API_KEY: "secret",
      AI_SELLER_EXTRACT_MODEL_ID: "DeepSeek-R1-qwen-7b-awq",
    });
    expect(result.ready).toBe(true);
    expect(result.aiProvider).toBe("arvan-aiaas");
  });

  it("fails closed when a mandatory production provider binding is absent", () => {
    expect(() =>
      assertProductionInfrastructure({
        ENVIRONMENT: "production",
        DB: {},
        MEDIA_BUCKET: {},
        OUTBOX_QUEUE: { send: async () => undefined },
        AI: { run: async () => ({}) },
      }),
    ).toThrow("AI seller-extraction model");
  });
});
