import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.UI_TEST_PORT ?? "4173");
const baseURL = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["scripts/serve-web-ui.mjs"], {
  stdio: ["ignore", "pipe", "inherit"],
  env: { ...process.env, UI_TEST_PORT: String(port) },
});

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("UI test server did not start")), 10000);
  server.stdout.on("data", (chunk) => {
    if (String(chunk).includes("listening on")) {
      clearTimeout(timer);
      resolve();
    }
  });
  server.on("error", reject);
});

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.route("**/api/v1/**", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  const workspace = request.headers()["x-workspace-id"] ?? "ws-1";

  const payloads: Record<string, unknown> = {
    "/api/v1/session": { session: { authenticated: true, actorId: "user-1", tenantId: "tenant-1", workspaceId: workspace } },
    "/api/v1/context": { actorId: "user-1", tenantId: "tenant-1", workspaceId: workspace, authenticated: true, roles: ["admin"], permissions: ["context:read"] },
    "/api/v1/workspaces": { data: [
      { id: "ws-1", organizationId: "tenant-1", name: "Workspace اصلی", status: "active" },
      { id: "ws-2", organizationId: "tenant-1", name: "Workspace دوم", status: "active" },
    ], currentWorkspaceId: workspace },
    "/api/v1/notifications": { data: [
      { id: "notice-1", intent: "booking.confirmed", channel: "in_app", priority: "high", status: "delivered", createdAt: new Date().toISOString(), variables: { title: "رزرو شما تأیید شد" } },
    ] },
    "/api/v1/business-access": { status: "authorized", tenantId: "tenant-1", workspaceId: workspace },
    "/api/v1/ai/usage": { data: [{ operationId: "op-1", operationType: "seller.product.extract", meterUnit: "provider_units", quantity: 17, modelId: "test-model", billingUsageReference: "bill-1", createdAt: new Date().toISOString() }] },
    "/api/v1/audit": { data: [{ id: "audit-1", action: "business.updated", targetType: "business", targetId: "biz-1", outcome: "succeeded", createdAt: new Date().toISOString() }] },
    "/api/v1/workspaces/" + workspace + "/members": { data: [{ id: "member-1", userId: "user-1", status: "active" }] },
    "/api/v1/discovery/search": { data: [{ id: "result-1", sourceType: "business", sourceId: "biz-1", title: "موجودیت واقعی تست", description: "نتیجهٔ canonical برای تست UI", locality: "مرکز شهر", score: 88, rating: 4.8 }] },
    "/api/v1/ai/seller/product-creation-sessions": { session: { id: "seller-session-1" } },
    "/api/v1/ai/seller/product-creation-sessions/seller-session-1": { session: { id: "seller-session-1", currentDraftVersion: 1 }, draft: {} },
    "/api/v1/ai/seller/product-creation-sessions/seller-session-1/inputs": { accepted: true },
    "/api/v1/catalog/offers": { data: { id: "offer-1", status: "active", publicationStatus: "unpublished" } },
    "/api/v1/catalog/offers/offer-1/publish": { data: { id: "offer-1", publicationStatus: "pending" } },
  };

  if (path.endsWith("/run") && path.includes("/api/v1/ai/seller/product-creation-sessions/")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { status: "succeeded", retryable: false, usage: { inputTokens: 10, outputTokens: 7, providerUnits: 17 }, output: { product: { name: "محصول تست", description: "پیش‌نویس تست", category: "product" } } } }),
    });
    return;
  }
  if (path.endsWith("/inputs")) {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ accepted: true }) });
    return;
  }
  if (path.endsWith("/review")) {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reviewed: true }) });
    return;
  }
  if (path.endsWith("/confirm")) {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ confirmed: true, catalogSaved: true, catalogProductId: "product-1", version: 1 }) });
    return;
  }
  if (path === "/api/v1/catalog/offers" && request.method() === "POST") {
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(payloads[path]) });
    return;
  }
  if (path === "/api/v1/catalog/offers/offer-1/publish" && request.method() === "POST") {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payloads[path]) });
    return;
  }
  if (path === "/api/v1/discovery/search") {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payloads["/api/v1/discovery/search"]) });
    return;
  }

  if (path === "/api/v1/workspaces/" + workspace + "/members") {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payloads["/api/v1/workspaces/" + workspace + "/members"]) });
    return;
  }

  if (payloads[path] !== undefined) {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payloads[path]) });
    return;
  }

  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) });
});

await page.addInitScript(() => {
  sessionStorage.setItem("phoenix-access-token", "ui-test-token");
  localStorage.setItem("phoenix-workspace-id", "ws-1");
});

const shellStartedAt = Date.now();
await page.goto(baseURL + "/");
await page.waitForSelector(".app-shell");
const shellMs = Date.now() - shellStartedAt;
assert.ok(shellMs < 1500, `Phoenix shell render budget exceeded: ${shellMs}ms`);
assert.equal(await page.locator(".brand-copy strong").innerText(), "ققنوس");

const initialTheme = await page.locator("html").getAttribute("data-theme");
await page.locator("[data-theme-toggle]").click();
assert.notEqual(await page.locator("html").getAttribute("data-theme"), initialTheme);

await page.locator("[data-focus-search]").click();
await page.locator(".command-modal").waitFor();
assert.ok(await page.locator(".command-result").count() > 0);

await page.goto(baseURL + "/discover");
await page.locator("#discover-query").fill("یک کسب‌وکار نزدیک برای رزرو");
await page.locator("[data-run-discovery]").click();
await page.getByText("موجودیت واقعی تست").waitFor();
await page.locator("[data-discovery-index='0']").click();
await page.locator("[data-toggle-shortlist]").click();
await page.locator("[data-close-discovery]").first().click();
assert.equal(await page.locator("#shortlist-count").innerText(), "1");

await page.goto(baseURL + "/");
await page.locator("[data-workspace-toggle]").first().click();
await page.getByText("Workspace دوم").waitFor();
await page.locator("[data-select-workspace='ws-2']").click();
await page.waitForTimeout(100);
assert.equal(await page.evaluate(() => localStorage.getItem("phoenix-workspace-id")), "ws-2");

await page.locator("[data-notification-toggle]").click();
await page.getByText("booking.confirmed").waitFor();
await page.locator("[data-mark-notification-read='notice-1']").click();

await page.goto(baseURL + "/admin");
await page.getByText("business.updated").waitFor();
await page.getByText("seller.product.extract").waitFor();

await page.goto(baseURL + "/design-system");
await page.getByText("Primitiveهای مشترک").waitFor();
await page.locator(".ds-table").waitFor();

await page.goto(baseURL + "/product-studio");
await page.locator("#studio-business").fill("biz-1");
await page.locator("#studio-workspace").fill("ws-2");
await page.locator("#studio-text").fill("محصول تست برای E2E");
await page.locator("[data-generate-draft]").click();
await page.getByText("محصول تست").waitFor();
await page.locator("[data-confirm-seller-draft]").click();
await page.getByText("محصول Catalog ساخته شد").waitFor();
await page.getByText("ساخت Listing").waitFor();
await page.locator("[data-create-seller-offer]").click();
await page.getByText("Listing ساخته شد").waitFor();
await page.locator("[data-publish-seller-offer]").click();
await page.getByText("درخواست انتشار ثبت شد").waitFor();

await browser.close();
server.kill("SIGTERM");
process.stdout.write("Phoenix UI E2E smoke passed; shell budget " + shellMs + "ms.\n");
