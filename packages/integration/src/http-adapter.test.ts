/* @ts-nocheck */
import { describe, expect, it } from "vitest";
import { credentialEnvironmentKey, createEnvironmentCredentialResolver } from "./credential";
import { createHttpIntegrationProviderAdapter, verifyHttpIntegrationWebhook } from "./http-adapter";

describe("Integration credentials", () => {
  it("resolves credentials from an external runtime reference without persisting the secret", async () => {
    const key = credentialEnvironmentKey("main", "calendar.test");
    const resolver = createEnvironmentCredentialResolver({ [key]: "secret" });
    await expect(resolver.resolve("main", "calendar.test")).resolves.toMatchObject({
      reference: "main",
      providerId: "calendar.test",
      secret: "secret",
    });
  });
});

describe("HTTP integration adapter", () => {
  it("injects runtime credentials and normalizes sync results", async () => {
    const requests: Request[] = [];
    const adapter = createHttpIntegrationProviderAdapter({
      providerId: "calendar.test",
      baseUrl: "https://provider.test/",
      syncPath: "/sync",
      credentialReference: "main",
      credentialResolver: {
        resolve: async (_reference, _providerId) => ({
          reference: "main",
          providerId: "calendar.test",
          kind: "bearer_token",
          secret: "secret",
        }),
      },
      fetchImpl: async (input, init) => {
        requests.push(new Request(input, init));
        return new Response(JSON.stringify({
          status: "processed",
          cursorReference: "cursor-2",
          checkpointReference: "checkpoint-2",
          itemCount: 3,
          externalReferences: [{
            resourceType: "appointment",
            resourceId: "resource-1",
            externalType: "calendar.event",
            externalReference: "event-1",
          }],
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    });

    const result = await adapter.processSync({
      account: {
        id: "account-1" as never,
        organizationId: "org-1" as never,
        workspaceId: null,
        providerId: "calendar.test" as never,
        accountType: "calendar",
        externalAccountReference: "external-1",
        status: "connected",
        credentialReference: "main",
        metadata: null,
        connectedAt: null,
        disconnectedAt: null,
        createdAt: "",
        updatedAt: "",
      },
      syncType: "events",
      direction: "inbound",
      cursorReference: "cursor-1",
      checkpointReference: "checkpoint-1",
      correlationId: "corr-1",
      now: new Date().toISOString(),
      context: {} as never,
    });

    expect(result.status).toBe("processed");
    expect(result.itemCount).toBe(3);
    expect(result.externalReferences?.[0].externalReference).toBe("event-1");
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer secret");
  });

  it("verifies signed webhook payloads and rejects stale timestamps", async () => {
    const payload = JSON.stringify({ id: "evt-1", type: "event.created" });
    const secret = "secret";
    const timestamp = "1000";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(timestamp + "." + payload),
    );
    const hex = Array.from(new Uint8Array(signature), (value) => value.toString(16).padStart(2, "0")).join("");

    await expect(
      verifyHttpIntegrationWebhook(payload, hex, timestamp, secret, 1001, 300),
    ).resolves.toMatchObject({ verified: true, eventId: "evt-1", eventType: "event.created" });

    await expect(
      verifyHttpIntegrationWebhook(payload, hex, timestamp, secret, 2000, 300),
    ).resolves.toMatchObject({ verified: false });
  });
});
