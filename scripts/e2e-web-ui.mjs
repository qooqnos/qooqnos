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
const runtimeErrors = [];
const failedRequests = [];
const moduleResponses = [];
const discoveryRequests = [];
page.on("pageerror", (error) => runtimeErrors.push(String(error.stack || error)));
page.on("console", (message) => {
  if (message.type() === "error") {
    const location = message.location();
    runtimeErrors.push("console: " + message.text() + " @ " + (location.url || "") + ":" + location.lineNumber);
  }
});
page.on("request", (request) => {
  if (request.resourceType() === "script" || /\\.js(?:\\?|$)/.test(request.url())) {
    moduleResponses.push({ event: "request", url: request.url() });
  }
});
page.on("response", (response) => {
  if (response.request().resourceType() === "script" || /\\.js(?:\\?|$)/.test(response.url())) {
    moduleResponses.push({
      event: "response",
      url: response.url(),
      status: response.status(),
      contentType: response.headers()["content-type"] ?? "",
    });
  }
});
page.on("requestfailed", (request) => failedRequests.push({
  url: request.url(),
  error: request.failure()?.errorText ?? "request failed",
}));

await page.route("**/api/v1/**", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  if (path.startsWith("/api/v1/discovery/")) {
    discoveryRequests.push({ path, method: request.method(), url: request.url() });
  }
  const workspace = request.headers()["x-workspace-id"] ?? "ws-1";

  const payloads = {
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
    "/api/v1/discovery/search": { data: [
      { id: "result-1", sourceType: "business", sourceId: "biz-1", title: "موجودیت واقعی تست", description: "نتیجهٔ canonical برای تست UI", locality: "مرکز شهر", score: 88, rating: 4.8 },
      { id: "result-product-1", sourceType: "product", sourceId: "prod-1", title: "میز چوبی", description: "کالای تست برای مقایسه", price: 25000000, currency: "ریال", metadata: { offeringType: "product", businessId: "biz-1" } },
      { id: "result-product-2", sourceType: "product", sourceId: "prod-2", title: "صندلی چوبی", description: "کالای دوم برای مقایسه", price: 12000000, currency: "ریال", metadata: { offeringType: "product", businessId: "biz-1" } },
    ] },
    "/api/v1/discovery/following": { data: [
      { id: "followed-product", sourceType: "product", sourceId: "followed-product", title: "عرضهٔ کسب‌وکار دنبال‌شده", description: "عرضهٔ ثبت‌شده در فید دنبال‌شده‌ها", metadata: { offeringType: "product", businessId: "biz-1", businessName: "فروشگاه دنبال‌شده" } },
    ] },
    "/api/v1/social/state": { data: { follows: [], engagements: [] } },
    "/api/v1/social/follows": { data: { id: "follow-1" } },
    "/api/v1/public/businesses/biz-1": { data: {
      profile: { id: "biz-1", name: "فروشگاه ترنج", displayName: "ترنج", status: "active", publicationStatus: "published", businessType: "retail", primaryCategoryId: "handmade", defaultLocale: "fa-IR", timezone: "Asia/Tehran", defaultCurrency: "IRR", updatedAt: new Date().toISOString() },
      contacts: [{ contactType: "phone", value: "02100000000", isPrimary: true }],
      locations: [{ name: "شعبه مرکزی", locationType: "store", timezone: "Asia/Tehran" }],
      reviews: [{ id: "review-1", customerId: "customer-1", ratingValue: 5, content: "تجربهٔ منتشرشدهٔ آزمایشی", publishedAt: new Date().toISOString(), createdAt: new Date().toISOString() }],
      offers: [{ id: "offering-1", businessId: "biz-1", offeringType: "product", title: "کیف دست‌دوز", description: "نمونهٔ کالای منتشرشده", productId: "product-1", serviceId: null, priceAmountMinor: 1250000, currency: "IRR", pricingType: "fixed" }]
    } },
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
  if (path === "/api/v1/workspaces/" + workspace + "/members") {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [{ id: "member-1", userId: "user-1", status: "active" }] }) });
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
  localStorage.setItem("qooqnos.locale", "fa");
});

const shellStartedAt = Date.now();
await page.goto(baseURL + "/");
try {
  await page.waitForSelector(".app-shell", { timeout: 10000 });
} catch (error) {
  process.stderr.write("Phoenix UI bootstrap diagnostics: " + JSON.stringify({ runtimeErrors, failedRequests, moduleResponses }, null, 2) + "\n");
  throw error;
}
const shellMs = Date.now() - shellStartedAt;
assert.ok(shellMs < 1500, `Phoenix shell render budget exceeded: ${shellMs}ms`);
assert.equal(await page.locator(".phoenix-public-brand strong").first().innerText(), "ققنوس");
assert.ok(await page.locator(".phoenix-reset-page").count() > 0);
assert.equal(await page.locator("[data-language-toggle]").count(), 1);
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='en']").click();
await page.waitForTimeout(50);
assert.equal(await page.locator("[data-language-current]").innerText(), "EN");
assert.ok((await page.locator(".phoenix-reset-hero h1").innerText()).includes("Better finds. Stronger relationships."));
assert.ok((await page.locator(".phoenix-social-tabs").innerText()).includes("Explore"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='ar']").click();
await page.waitForTimeout(50);
assert.equal(await page.locator("[data-language-current]").innerText(), "عربي");
assert.ok((await page.locator(".phoenix-reset-hero h1").innerText()).includes("خيارات أفضل وعلاقات أكثر ثقة"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();
await page.waitForTimeout(50);
assert.equal(await page.locator("[data-language-current]").innerText(), "فا");

// Comparison is data-led, responsive, and must not expose arbitrary internal metadata.
await page.evaluate(() => localStorage.setItem("phoenix-compare-items", JSON.stringify([
  { id: "compare-one", sourceId: "compare-one", title: "محصول مقایسه یک", sourceType: "product", price: 125, currency: "ریال", description: "توضیح اول", metadata: { brand: "برند نمونه", privateToken: "internal-secret" } },
  { id: "compare-two", sourceId: "compare-two", title: "محصول مقایسه دو", sourceType: "product", price: 180, currency: "ریال", description: "توضیح دوم", metadata: { color: "آبی", businessId: "internal-business" } }
])));
await page.goto(baseURL + "/compare");
const compareText = await page.locator(".phoenix-reset-compare-page").innerText();
assert.ok(compareText.includes("محصول مقایسه یک"));
assert.ok(compareText.includes("محصول مقایسه دو"));
assert.ok(compareText.includes("برند نمونه"));
assert.ok(!compareText.includes("internal-secret"));
assert.ok(!compareText.includes("internal-business"));
assert.equal(await page.locator(".phoenix-reset-compare-row-head strong").count(), 2);
assert.equal(await page.locator("a[href*='/checkout']").count(), 0);
await page.locator("[data-clear-compare]").click();
assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("phoenix-compare-items") || "[]").length), 0);

await page.goto(baseURL + "/business");
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='en']").click();
await page.waitForTimeout(100);
assert.equal(await page.locator("[data-language-current]").innerText(), "EN");
assert.equal(await page.locator("#business-vertical-title").innerText(), "General business");
assert.equal(await page.locator("#business-vertical-subtitle").innerText(), "A Workspace composed from enabled capabilities.");
assert.equal(await page.locator("#business-next-action").innerText(), "Choose the most important thing to do today.");
assert.equal(await page.locator("#business-next-detail").innerText(), "Workspace modules are composed from the business type; permissions remain determined by the backend.");
assert.equal(await page.locator("#sidebar-workspace-status").getAttribute("data-workspace-status"), "active");
assert.ok((await page.locator("#sidebar-workspace-status").innerText()).includes("Workspace"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();
await page.waitForTimeout(100);
assert.equal(await page.locator("[data-language-current]").innerText(), "فا");

await page.goto(baseURL + "/businesses/biz-1");
await page.locator(".social-shell").waitFor();
assert.equal(await page.locator(".phoenix-social-tabs").count(), 1);
assert.equal(await page.locator(".phoenix-social-mobile-nav").count(), 1);
assert.equal(await page.locator("#public-business-page-name").innerText(), "ترنج");
assert.ok((await page.locator("#public-business-page-offers").innerText()).includes("کیف دست‌دوز"));
assert.equal(await page.locator("#public-business-page-offers a[href*='/checkout']").count(), 0);
await page.locator("[data-public-offer-detail='0']").click();
await page.locator(".phoenix-detail-modal").waitFor();
assert.ok((await page.locator(".phoenix-detail-modal").innerText()).includes("کیف دست‌دوز"));
assert.equal(await page.locator(".phoenix-detail-modal a[href*='/checkout']").count(), 0);
await page.locator(".phoenix-detail-modal [data-close-discovery]").first().click();

await page.goto(baseURL + "/");
assert.ok(await page.locator("#discover-query").count() > 0);
await page.locator("#discover-query").fill("یک کسب‌وکار مناسب نزدیک من می‌خواهم");
await page.locator("[data-run-discovery]").click();
assert.equal(await page.locator("#discover-query").inputValue(), "یک کسب‌وکار مناسب نزدیک من می‌خواهم");
await page.getByRole("heading", { name: "موجودیت واقعی تست" }).waitFor();

const initialTheme = await page.locator("html").getAttribute("data-theme");
await page.locator("[data-theme-toggle]").click();
assert.notEqual(await page.locator("html").getAttribute("data-theme"), initialTheme);

await page.goto(baseURL + "/profile");
const personalProfileText = await page.locator(".phoenix-reset-profile-page").innerText();
assert.ok(personalProfileText.includes("دسترسی‌های روزمره"));
assert.ok(personalProfileText.includes("سفارش‌ها و پیگیری"));
assert.ok(!personalProfileText.includes("۲۸۰"));
assert.ok(!personalProfileText.includes("۵ خدمت"));
assert.ok(!personalProfileText.includes("معامله"));
await page.goto(baseURL + "/messages");
const messagesText = await page.locator(".phoenix-reset-messages-page").innerText();
assert.ok(messagesText.includes("پیام‌ها و گفت‌وگوها"));
assert.ok(messagesText.includes("پاسخ ساختگی"));
assert.ok(!messagesText.includes("در خدمت شما هستیم"));
assert.ok(!messagesText.includes("سفارش کالا رسید و تأیید شد"));

await page.goto(baseURL + "/business");
assert.equal(await page.locator("[data-language-toggle]").count(), 1);
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='en']").click();
await page.waitForTimeout(100);
const businessEnglishText = await page.locator(".phoenix-business-page").innerText();
assert.ok(businessEnglishText.includes("General business"));
assert.ok(businessEnglishText.includes("Add a product or service"));
assert.ok(businessEnglishText.includes("Quick actions"));
assert.ok(businessEnglishText.includes("Business name"));
assert.ok(businessEnglishText.includes("Locations"));
assert.ok(businessEnglishText.includes("How does a user see this business?"));
assert.ok(!businessEnglishText.includes("نام کسب‌وکار"));
assert.ok(!businessEnglishText.includes("اقدام‌های سریع"));
assert.ok(!businessEnglishText.includes("مکان‌ها"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();
await page.waitForTimeout(50);
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='en']").click();
await page.waitForTimeout(50);
assert.equal(await page.locator("[data-language-current]").innerText(), "EN");
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();
await page.waitForTimeout(50);
assert.equal(await page.locator("[data-language-current]").innerText(), "فا");

await page.goto(baseURL + "/discover?tab=explore");
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='en']").click();
await page.waitForTimeout(100);
const discoveryEnglishText = await page.locator(".phoenix-reset-page").innerText();
assert.equal(await page.locator("#results-title").innerText(), "Explore");
assert.ok(discoveryEnglishText.includes("Better finds. Stronger relationships."));
assert.ok(discoveryEnglishText.includes("Browse real, discoverable offerings across Phoenix."));
assert.ok(discoveryEnglishText.includes("Add a product or service"));
assert.ok(discoveryEnglishText.includes("Discover"));
assert.ok(!discoveryEnglishText.includes("چیزهایی که در اکسپلور تازه‌اند."));
assert.ok(!discoveryEnglishText.includes("مرور عرضه‌های واقعی و قابل کشف در شبکه ققنوس."));
assert.ok(!discoveryEnglishText.includes("ایجاد عرضه"));
assert.ok(!discoveryEnglishText.includes("کشف کن"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();
await page.waitForTimeout(50);
assert.equal(await page.locator("[data-language-current]").innerText(), "فا");

await page.goto(baseURL + "/business");
assert.equal(await page.locator("[data-language-toggle]").count(), 1);

await page.goto(baseURL + "/admin");
assert.equal(await page.locator("[data-language-toggle]").count(), 1);

await page.goto(baseURL + "/discover");
assert.equal(await page.locator("[data-language-toggle]").count(), 1);

await page.goto(baseURL + "/business");
await page.locator("[data-focus-search]").click();
await page.locator(".command-modal").waitFor();
assert.ok(await page.locator(".command-result").count() > 0);

await page.goto(baseURL + "/discover");
assert.equal(await page.locator("[data-language-toggle]").count(), 1);
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='en']").click();
await page.waitForTimeout(50);
assert.equal(await page.locator("[data-language-current]").innerText(), "EN");
assert.ok((await page.locator(".phoenix-social-tabs").innerText()).includes("For you"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();
await page.waitForTimeout(50);
assert.equal(await page.locator("[data-language-current]").innerText(), "فا");
await page.locator("#discover-query").fill("یک کسب‌وکار نزدیک برای رزرو");
await page.locator("[data-run-discovery]").click();
await page.getByRole("heading", { name: "موجودیت واقعی تست" }).waitFor();
assert.equal(await page.locator(".phoenix-reset-compare-link").isVisible(), false);
await page.locator('[data-compare="result-product-1"]').click();
assert.equal(await page.locator(".phoenix-reset-compare-link").isVisible(), false);
await page.locator('[data-compare="result-product-2"]').click();
assert.equal(await page.locator(".phoenix-reset-compare-link").isVisible(), true);
assert.equal(await page.locator("#compare-count").innerText(), "۲");
await page.locator('[data-follow="result-product-1"]').click();
await page.locator('[data-follow="result-product-1"].selected').waitFor();
await page.locator("[data-discovery-index='0']").click();
await page.locator(".connection-modal [data-save-detail]").click();
await page.locator(".connection-modal [data-close-discovery]").first().click();
assert.equal(await page.locator("#shortlist-count").innerText(), "1");

await page.goto(baseURL + "/discover?tab=following");
try {
  await page.getByRole("heading", { name: "عرضهٔ کسب‌وکار دنبال‌شده" }).waitFor({ timeout: 7000 });
} catch (error) {
  const visibleText = await page.locator(".phoenix-reset-page").innerText().catch(() => "");
  process.stderr.write("Phoenix following-feed diagnostics: " + JSON.stringify({ discoveryRequests, visibleText, runtimeErrors, failedRequests }, null, 2) + "\\n");
  throw error;
}

await page.goto(baseURL + "/business");
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
// Seed internal workspace context as test data without exposing IDs in the end-user form.
await page.locator("#studio-business").evaluate((element) => {
  element.value = "biz-1";
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.locator("#studio-workspace").evaluate((element) => {
  element.value = "ws-2";
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.locator("#studio-text").fill("محصول تست برای E2E");
await page.locator("[data-generate-draft]").click();
await page.getByText("محصول تست").waitFor();
await page.locator("[data-confirm-seller-draft]").click();
await page.getByText("محصول Catalog ساخته شد").waitFor();
await page.getByRole("button", { name: "تأیید و افزودن به ویترین" }).waitFor();
await page.locator("[data-create-seller-offer]").click();
await page.getByText("Listing ساخته شد").waitFor();
await page.locator("[data-publish-seller-offer]").click();
await page.getByText("درخواست انتشار ثبت شد").waitFor();

await browser.close();
server.kill("SIGTERM");
process.stdout.write("Phoenix UI E2E smoke passed; shell budget " + shellMs + "ms.\n");
