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
const bookingAvailabilityRequests = [];
const mockSocialFollows = new Map();
const mockSocialEngagements = new Map();
const mockSocialComments = [];
const mockBusinessUpdates = [];
const notificationReadRequests = [];
const communicationSendRequests = [];
const communicationStartRequests = [];
const mediaAssetUploadRequests = [];
const offeringMediaLinkRequests = [];
const publicMediaBatchRequests = [];
const mockConversations = [{
  id: "conversation-e2e-1",
  organizationId: "tenant-1",
  workspaceId: "ws-1",
  customerId: "customer-e2e-1",
  status: "open",
  createdAt: "2026-10-16T10:00:00.000Z",
  updatedAt: "2026-10-16T10:05:00.000Z",
  lastMessagePreview: "دربارهٔ این کالا یک پرسش دارم.",
  lastMessageAt: "2026-10-16T10:05:00.000Z",
}];
const mockCommunicationMessages = [{
  id: "message-e2e-1",
  conversationId: "conversation-e2e-1",
  senderReference: "seller-user-1",
  content: "سلام، چطور می‌توانم راهنمایی‌ات کنم؟",
  classification: "buyer_seller",
  status: "created",
  createdAt: "2026-10-16T10:05:00.000Z",
  updatedAt: "2026-10-16T10:05:00.000Z",
}];
const mockNotifications = [
  { id: "notice-1", intent: "booking.confirmed", channel: "in_app", priority: "high", status: "delivered", createdAt: new Date().toISOString(), variables: {} },
];
let socialSequence = 0;
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
  if (path.startsWith("/api/v1/availability/schedules/") && path.endsWith("/slots")) {
    bookingAvailabilityRequests.push({ path, method: request.method(), url: request.url() });
  }
  const workspace = request.headers()["x-workspace-id"] ?? "ws-1";

  const payloads = {
    "/api/v1/session": { session: { authenticated: true, actorId: "user-1", tenantId: "tenant-1", workspaceId: workspace } },
    "/api/v1/context": { actorId: "user-1", tenantId: "tenant-1", workspaceId: workspace, authenticated: true, roles: ["admin"], permissions: ["context:read"] },
    "/api/v1/workspaces": { data: [
      { id: "ws-1", organizationId: "tenant-1", name: "Workspace اصلی", status: "active" },
      { id: "ws-2", organizationId: "tenant-1", name: "Workspace دوم", status: "active" },
    ], currentWorkspaceId: workspace },
    "/api/v1/commerce/orders": { data: [
      { id: "order-test-1", status: "shipped", currency: "IRR", grandTotalMinor: 750000, subtotalMinor: 750000, trackingNumber: "TRK-12345", createdAt: "2026-10-15T08:00:00.000Z", items: [{ id: "line-1", descriptionSnapshot: "میز چوبی دست‌ساز", quantity: 1, unitPriceMinorSnapshot: 750000 }] },
      { id: "order-test-2", status: "processing", currency: "IRR", grandTotalMinor: 350000, subtotalMinor: 350000, createdAt: "2026-10-14T08:00:00.000Z", items: [{ id: "line-2", descriptionSnapshot: "صندلی چوبی", quantity: 1, unitPriceMinorSnapshot: 350000 }] },
    ] },
    "/api/v1/availability/schedules": { data: [
      { id: "schedule-1", businessId: "biz-1", locationId: "location-1", resourceId: "resource-1", timezone: "Asia/Baku", status: "active" },
    ] },
    "/api/v1/availability/schedules/schedule-1/slots": { data: [
      { slotReference: "slot-reference-1", startsAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), endsAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), remainingCapacity: 1, available: true, status: "available" },
      { slotReference: "slot-reference-2", startsAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), endsAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), remainingCapacity: 0, available: false, status: "booked" },
    ] },
    "/api/v1/booking/holds": { data: { id: "hold-test-1", status: "active", expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), slotReference: "slot-reference-1" } },
    "/api/v1/notifications": { data: mockNotifications },
    "/api/v1/businesses/biz-1/management": { data: {
      business: { id: "biz-1", name: "store-test", displayName: "فروشگاه آزمایشی", businessType: "retail", primaryCategoryId: "retail", defaultLocale: "fa-IR", timezone: "Asia/Baku", defaultCurrency: "IRR", status: "active", publicationStatus: "unpublished" },
      locations: [], hours: [], contacts: [], socialLinks: []
    } },
    "/api/v1/catalog/businesses/biz-1/offers": { data: [
      { id: "offering-product-e2e", businessId: "biz-1", offeringType: "product", title: "کیف دست‌دوز", description: "کالای واقعی تست رابط", productId: "product-1", serviceId: null, status: "active", publicationStatus: "published", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: "offering-service-1", businessId: "biz-1", offeringType: "service", title: "مشاورهٔ تخصصی", description: "شرح خدمت ثبت‌شده", productId: null, serviceId: "service-1", status: "active", publicationStatus: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ] },
    "/api/v1/booking": { data: [
      { id: "booking-e2e-1", organizationId: "tenant-1", workspaceId: workspace, businessId: "biz-1", customerId: "customer-private-e2e", status: "confirmed", currency: "IRR", totalAmountMinor: 450000, appointmentStatus: "confirmed", startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), endsAt: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(), timezone: "Asia/Baku", locationId: null, resourceId: null, offeringId: "offering-service-1", offeringTitle: "مشاورهٔ تخصصی", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ] },
    "/api/v1/business-access": { status: "authorized", tenantId: "tenant-1", workspaceId: workspace },
    "/api/v1/ai/usage": { data: [{ operationId: "op-1", operationType: "seller.product.extract", meterUnit: "provider_units", quantity: 17, modelId: "test-model", billingUsageReference: "bill-1", createdAt: new Date().toISOString() }] },
    "/api/v1/audit": { data: [{ id: "audit-1", action: "business.updated", targetType: "business", targetId: "biz-1", outcome: "succeeded", createdAt: new Date().toISOString() }] },
    "/api/v1/discovery/search": { data: [
      { id: "result-1", sourceType: "business", sourceId: "biz-1", title: "موجودیت واقعی تست", description: "نتیجهٔ canonical برای تست UI", locality: "مرکز شهر", score: 88, rating: 4.8 },
      { id: "result-product-1", sourceType: "product", sourceId: "prod-1", title: "میز چوبی", description: "کالای تست برای مقایسه", price: 25000000, currency: "ریال", metadata: { offeringType: "product", businessId: "biz-1" } },
      { id: "result-product-2", sourceType: "product", sourceId: "prod-2", title: "صندلی چوبی", description: "کالای دوم برای مقایسه", price: 12000000, currency: "ریال", metadata: { offeringType: "product", businessId: "biz-1" } },
      { id: "result-product-user-1", sourceType: "product", sourceId: "prod-user-1", title: "ظرف سفالی دست‌ساز", description: "عرضهٔ فروشندهٔ مستقل برای آزمون دنبال‌کردن کاربر", price: 950000, currency: "ریال", metadata: { offeringType: "product", sellerUserId: "user-seller-2", sellerName: "هنرمند مستقل" } },
    ] },
    "/api/v1/discovery/following": { data: [
      { id: "followed-product", sourceType: "product", sourceId: "followed-product", title: "کالای فروشگاه دنبال‌شده", description: "کالای منتشرشده در فید دنبال‌شده‌ها", metadata: { offeringType: "product", businessId: "biz-1", businessName: "فروشگاه دنبال‌شده" } },
      { id: "followed-user-product", sourceType: "product", sourceId: "followed-user-product", title: "کالای فروشندهٔ مستقل دنبال‌شده", description: "کالای منتشرشده از سوی فروشندهٔ شخصی", metadata: { offeringType: "product", sellerUserId: "user-seller-2", sellerName: "هنرمند مستقل" } },
    ] },
    "/api/v1/social/state": { data: { follows: [], engagements: [] } },
    "/api/v1/social/activity": { data: [
      { id: "event-save-1", eventType: "social.save.created", payloadJson: JSON.stringify({ targetType: "product", targetId: "prod-1", targetTitle: "میز چوبی" }), occurredAt: new Date().toISOString() },
      { id: "event-follow-1", eventType: "social.follow.created", payloadJson: JSON.stringify({ targetType: "business", targetId: "biz-1", targetTitle: "فروشگاه ترنج" }), occurredAt: new Date().toISOString() },
    ] },
    "/api/v1/social/follows": { data: { id: "follow-1" } },
    "/api/v1/public/businesses/biz-1": { data: {
      profile: { id: "biz-1", name: "فروشگاه ترنج", displayName: "ترنج", status: "active", publicationStatus: "published", businessType: "retail", primaryCategoryId: "handmade", defaultLocale: "fa-IR", timezone: "Asia/Tehran", defaultCurrency: "IRR", updatedAt: new Date().toISOString() },
      contacts: [{ contactType: "phone", value: "02100000000", isPrimary: true }],
      locations: [{ name: "شعبه مرکزی", locationType: "store", timezone: "Asia/Tehran" }],
      reviews: [{ id: "review-1", customerId: "customer-1", ratingValue: 5, content: "تجربهٔ منتشرشدهٔ آزمایشی", publishedAt: new Date().toISOString(), createdAt: new Date().toISOString() }],
      offers: [
        { id: "offering-1", businessId: "biz-1", offeringType: "product", title: "کیف دست‌دوز", description: "نمونهٔ کالای منتشرشده", productId: "product-1", serviceId: null, priceAmountMinor: 1250000, currency: "IRR", pricingType: "fixed" },
        { id: "offering-service-1", businessId: "biz-1", offeringType: "service", title: "مشاورهٔ تخصصی", description: "جلسهٔ مشاورهٔ یک‌ساعته", productId: null, serviceId: "service-1", priceAmountMinor: 450000, currency: "IRR", pricingType: "fixed" },
      ]
    } },
    "/api/v1/ai/seller/product-creation-sessions": { session: { id: "seller-session-1" } },
    "/api/v1/ai/seller/product-creation-sessions/seller-session-1": { session: { id: "seller-session-1", currentDraftVersion: 1 }, draft: {} },
    "/api/v1/ai/seller/product-creation-sessions/seller-session-1/inputs": { accepted: true },
    "/api/v1/public/offerings/offering-1/media": { data: [
      { assetId: "asset-photo-1", purpose: "primary", position: 0, mimeType: "image/svg+xml", byteSize: 120, width: 800, height: 1000, src: "/api/v1/public/offerings/offering-1/media/asset-photo-1/content" }
    ] },
    "/api/v1/public/offerings/offering-1/variants": { data: [
      { id: "variant-red-s", attributes: [{ key: "color", label: "Color", value: "Red" }, { key: "size", label: "Size", value: "S" }] },
      { id: "variant-red-m", attributes: [{ key: "color", label: "Color", value: "Red" }, { key: "size", label: "Size", value: "M" }] },
      { id: "variant-blue-s", attributes: [{ key: "color", label: "Color", value: "Blue" }, { key: "size", label: "Size", value: "S" }] }
    ] },
    "/api/v1/catalog/offers": { data: { id: "offer-1", status: "active", publicationStatus: "unpublished" } },
    "/api/v1/catalog/offers/offer-1/publish": { data: { id: "offer-1", publicationStatus: "pending" } },
  };

  if (path === "/api/v1/social/state" && request.method() === "GET") {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {
        follows: [...mockSocialFollows.values()],
        engagements: [...mockSocialEngagements.values()],
      } }),
    });
    return;
  }
  if (path === "/api/v1/social/follows" && request.method() === "POST") {
    const body = request.postDataJSON();
    const key = String(body.targetType) + ":" + String(body.targetId);
    const follow = mockSocialFollows.get(key) ?? {
      id: "follow-" + (++socialSequence),
      targetType: body.targetType,
      targetId: body.targetId,
    };
    mockSocialFollows.set(key, follow);
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: follow }) });
    return;
  }
  if (path.startsWith("/api/v1/social/follows/") && request.method() === "DELETE") {
    const id = path.split("/").pop();
    for (const [key, follow] of mockSocialFollows.entries()) if (follow.id === id) mockSocialFollows.delete(key);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { id, removed: true } }) });
    return;
  }
  if ((path === "/api/v1/social/saves" || path === "/api/v1/social/likes") && request.method() === "POST") {
    const body = request.postDataJSON();
    const engagementType = path.endsWith("/likes") ? "like" : "save";
    const key = engagementType + ":" + String(body.targetType) + ":" + String(body.targetId);
    const engagement = mockSocialEngagements.get(key) ?? {
      id: engagementType + "-" + (++socialSequence),
      targetType: body.targetType,
      targetId: body.targetId,
      engagementType,
    };
    mockSocialEngagements.set(key, engagement);
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: engagement }) });
    return;
  }
  if ((path.startsWith("/api/v1/social/saves/") || path.startsWith("/api/v1/social/likes/")) && request.method() === "DELETE") {
    const id = path.split("/").pop();
    for (const [key, engagement] of mockSocialEngagements.entries()) if (engagement.id === id) mockSocialEngagements.delete(key);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { id, removed: true } }) });
    return;
  }
  if (path === "/api/v1/social/comments" && request.method() === "POST") {
    const body = request.postDataJSON();
    mockSocialComments.push(body);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: { id: "comment-" + (++socialSequence), ...body, moderationStatus: "pending" } }),
    });
    return;
  }

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
  if (path === "/api/v1/businesses/biz-1" && request.method() === "PATCH") {
    const update = request.postDataJSON();
    mockBusinessUpdates.push(update);
    const business = { ...payloads["/api/v1/businesses/biz-1/management"].data.business, ...update };
    payloads["/api/v1/businesses/biz-1/management"].data.business = business;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: business }) });
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

  if (path === "/api/v1/communications/conversations/from-business" && request.method() === "POST") {
    const body = request.postDataJSON();
    communicationStartRequests.push(body);
    let conversation = mockConversations.find((item) => item.id === "conversation-from-offer-e2e");
    if (!conversation) {
      conversation = {
        id: "conversation-from-offer-e2e",
        organizationId: "tenant-1",
        workspaceId: "seller-workspace-1",
        customerId: "customer-e2e-1",
        status: "open",
        createdAt: "2026-10-17T00:00:00.000Z",
        updatedAt: "2026-10-17T00:00:00.000Z",
        lastMessagePreview: null,
        lastMessageAt: null,
      };
      mockConversations.push(conversation);
    }
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: conversation }) });
    return;
  }
  if (path === "/api/v1/communications/conversations" && request.method() === "GET") {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: mockConversations }) });
    return;
  }
  if (path.startsWith("/api/v1/communications/conversations/") && path.endsWith("/messages") && request.method() === "GET") {
    const conversationId = path.split("/").at(-2);
    const messages = conversationId === "conversation-e2e-1" ? mockCommunicationMessages : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: messages }) });
    return;
  }
  if (path === "/api/v1/communications/messages" && request.method() === "POST") {
    const body = request.postDataJSON();
    communicationSendRequests.push(body);
    const message = {
      id: "message-e2e-" + (mockCommunicationMessages.length + 1),
      conversationId: body.conversationId,
      senderReference: "user-1",
      content: body.content,
      classification: body.classification,
      status: "created",
      createdAt: "2026-10-16T10:06:00.000Z",
      updatedAt: "2026-10-16T10:06:00.000Z",
    };
    mockCommunicationMessages.push(message);
    mockConversations[0].lastMessagePreview = String(body.content);
    mockConversations[0].lastMessageAt = message.createdAt;
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: message }) });
    return;
  }

  if (path.startsWith("/api/v1/notifications/") && path.endsWith("/read") && request.method() === "POST") {
    const id = path.split("/").at(-2);
    const notification = mockNotifications.find((item) => item.id === id);
    if (!notification) {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { message: "Notification not found." } }) });
      return;
    }
    notification.status = "read";
    notificationReadRequests.push({ id, method: request.method(), path });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: notification }) });
    return;
  }

  if (path === "/api/v1/notifications" && request.method() === "GET") {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: mockNotifications }) });
    return;
  }

  if (path === "/api/v1/media/assets" && request.method() === "POST") {
    mediaAssetUploadRequests.push(request.postData() ?? "");
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: { id: "asset-studio-e2e-1", status: "ready" } }),
    });
    return;
  }
  if (path === "/api/v1/catalog/offers/offer-1/media/asset-studio-e2e-1" && request.method() === "POST") {
    offeringMediaLinkRequests.push({ path, body: request.postData() ?? "" });
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: { id: "link-studio-e2e-1", offeringId: "offer-1", assetId: "asset-studio-e2e-1", purpose: "primary", position: 0 } }),
    });
    return;
  }
  if (path === "/api/v1/public/offerings/media-batch" && request.method() === "GET") {
    const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);
    publicMediaBatchRequests.push(ids);
    const mediaReferences = ids.filter((id) => ["prod-1", "product-1", "offering-1"].includes(id));
    const data = mediaReferences.length ? [{
      offeringId: "offering-1",
      productId: "product-1",
      serviceId: null,
      referenceIds: mediaReferences,
      assetId: "asset-photo-1",
      purpose: "primary",
      position: 0,
      mimeType: "image/svg+xml",
      byteSize: 120,
      width: 800,
      height: 1000,
      src: "/api/v1/public/offerings/offering-1/media/asset-photo-1/content",
    }] : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) });
    return;
  }
  if (path === "/api/v1/public/offerings/offering-1/media/asset-photo-1/content" && request.method() === "GET") {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#e9dfd2"/><circle cx="400" cy="380" r="150" fill="#b99b76"/><rect x="200" y="520" width="400" height="240" rx="40" fill="#735c49"/></svg>',
    });
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
  if (localStorage.getItem("qooqnos.locale") === null) {
    localStorage.setItem("qooqnos.locale", "fa");
  }
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

// Asking about a product starts (or reuses) its canonical seller conversation.
await page.locator('[data-open-view="result-product-1"]').click();
await page.locator("[data-ask-seller-detail]").waitFor();
await page.locator("[data-ask-seller-detail]").click();
await page.waitForFunction(() => location.pathname === "/messages"
  && new URLSearchParams(location.search).get("conversation") === "conversation-from-offer-e2e");
await page.locator("#messages-compose").waitFor();
assert.equal(communicationStartRequests.length, 1);
assert.deepEqual(communicationStartRequests[0], { businessId: "biz-1" });
assert.equal(await page.locator("#messages-compose").count(), 1);
const sellerMessageText = await page.locator(".phoenix-reset-messages-page").innerText();
assert.ok(sellerMessageText.includes("میز چوبی"));
assert.ok(!sellerMessageText.includes("seller-workspace-1"));
assert.ok(!sellerMessageText.includes("customer-e2e-1"));

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
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='en']").click();
await page.waitForTimeout(50);
const compareEnglish = await page.locator(".phoenix-reset-compare-page").innerText();
assert.ok(compareEnglish.includes("Choose confidently with a clear comparison"));
assert.ok(compareEnglish.includes("Brand"));
assert.ok(compareEnglish.includes("Compare 2 products"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='ar']").click();
await page.waitForTimeout(50);
const compareArabic = await page.locator(".phoenix-reset-compare-page").innerText();
assert.ok(compareArabic.includes("اختر بثقة عبر مقارنة واضحة"));
assert.ok(compareArabic.includes("العلامة التجارية"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();
await page.waitForTimeout(50);
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
const publicSharePayload = await page.evaluate(() => {
  let payload = null;
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: async (value) => { payload = value; },
  });
  return {
    share: async () => {
      await navigator.share({ title: "ترنج", text: "کسب‌وکار را ببین", url: location.href });
    },
  };
});
await page.evaluate(() => {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: async (value) => {
      window.__phoenixSharePayload = value;
    },
  });
});
await page.locator("#public-business-share").click();
await page.waitForFunction(() => Boolean(window.__phoenixSharePayload));
const capturedShare = await page.evaluate(() => window.__phoenixSharePayload);
assert.equal(capturedShare.title, "ترنج");
assert.equal(capturedShare.url, await page.evaluate(() => window.location.href));
assert.ok(capturedShare.text);
assert.equal(await page.locator(".phoenix-social-tabs").count(), 1);
assert.equal(await page.locator(".phoenix-social-mobile-nav").count(), 1);
assert.equal(await page.locator("#public-business-page-name").innerText(), "ترنج");
assert.ok((await page.locator("#public-business-page-offers").innerText()).includes("کیف دست‌دوز"));
assert.equal(await page.locator("#public-business-page-offers a[href*='/checkout']").count(), 0);
assert.equal(await page.locator("#public-business-page-offers a[href*='/offerings/offering-1?business=biz-1']").count(), 1);
await page.locator("#public-business-page-offers .phoenix-public-offer-image").waitFor();
assert.ok((await page.locator("#public-business-page-offers .phoenix-public-offer-image").getAttribute("src") ?? "").endsWith("/media/asset-photo-1/content"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='en']").click();
await page.waitForTimeout(50);
const publicBusinessEnglish = await page.locator(".phoenix-public-business-page").innerText();
assert.ok(publicBusinessEnglish.includes("Seller on Phoenix"));
assert.ok(publicBusinessEnglish.includes("Published products and services"));
assert.ok(!publicBusinessEnglish.includes("fa-IR"));
assert.ok(!publicBusinessEnglish.includes("Asia/Tehran"));
assert.ok(!publicBusinessEnglish.includes("IRR"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='ar']").click();
await page.waitForTimeout(50);
const publicBusinessArabic = await page.locator(".phoenix-public-business-page").innerText();
assert.ok(publicBusinessArabic.includes("البائع على ققنوس"));
assert.ok(publicBusinessArabic.includes("المنتجات والخدمات المنشورة"));
assert.ok(!publicBusinessArabic.includes("fa-IR"));
assert.ok(!publicBusinessArabic.includes("Asia/Tehran"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();
await page.waitForTimeout(50);
await page.locator("#public-business-page-offers a[href*='/offerings/offering-1?business=biz-1']").click();
await page.locator(".phoenix-public-offering-page").waitFor();
assert.equal(await page.locator("#public-offer-title").innerText(), "کیف دست‌دوز");
assert.ok((await page.locator(".phoenix-public-offering-page").innerText()).includes("کیف دست‌دوز"));
assert.equal(await page.locator(".phoenix-public-offering-page a[href*='/checkout']").count(), 0);
const askSellerButton = page.locator("#public-offer-ask");
assert.equal(await askSellerButton.count(), 1);
await askSellerButton.click();
await page.waitForFunction(() => location.pathname === "/messages"
  && new URLSearchParams(location.search).get("conversation") === "conversation-from-offer-e2e");
await page.locator(".phoenix-reset-message-context").waitFor();
const askSellerTopic = new URL(page.url()).searchParams.get("topic");
assert.ok(askSellerTopic);
const contextualOfferText = await page.locator(".phoenix-reset-message-context").innerText();
assert.ok(contextualOfferText.includes("کیف دست‌دوز"));
assert.equal(await page.locator(".phoenix-reset-message-context-title").innerText(), "کیف دست‌دوز");
assert.equal(await page.locator(".phoenix-reset-message-context-id").textContent(), askSellerTopic);
assert.equal(await page.locator(".phoenix-reset-message-context-id").isVisible(), false);
assert.ok(contextualOfferText.includes("هیچ پیامی نمایش یا ارسال نمی‌شود"));
await page.goto(baseURL + "/businesses/biz-1");
await page.locator("#public-business-page-offers a[href*='/offerings/offering-1?business=biz-1']").waitFor();

await page.goto(baseURL + "/");
assert.ok(await page.locator("#discover-query").count() > 0);
await page.locator("#discover-query").fill("یک کسب‌وکار مناسب نزدیک من می‌خواهم");
await page.locator("[data-run-discovery]").click();
assert.equal(await page.locator("#discover-query").inputValue(), "یک کسب‌وکار مناسب نزدیک من می‌خواهم");
await page.getByRole("heading", { name: "موجودیت واقعی تست" }).waitFor();

const commentButton = page.locator(".phoenix-post-card [data-comment]").nth(1);
await commentButton.waitFor();
const commentBodyOverflow = await page.evaluate(() => document.body.style.overflow);
await commentButton.click();
await page.locator(".phoenix-social-comment-dialog").waitFor();
assert.equal(await page.locator(".phoenix-social-comment-dialog").getAttribute("role"), "dialog");
assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
await page.waitForFunction(() => document.querySelector("#phoenix-social-comment-body") === document.activeElement);
assert.equal(await page.locator("#phoenix-social-comment-body").evaluate((element) => element === document.activeElement), true);
await page.keyboard.press("Shift+Tab");
assert.equal(await page.locator(".phoenix-social-comment-close").evaluate((element) => element === document.activeElement), true);
await page.keyboard.press("Shift+Tab");
assert.equal(await page.locator("[data-submit-social-comment]").evaluate((element) => element === document.activeElement), true);
await page.keyboard.press("Tab");
assert.equal(await page.locator(".phoenix-social-comment-close").evaluate((element) => element === document.activeElement), true);
await page.locator("[data-submit-social-comment]").click();
assert.ok((await page.locator("#phoenix-social-comment-error").innerText()).includes("متن دیدگاه را بنویس"));
assert.equal(mockSocialComments.length, 0);
await page.locator("[data-cancel-social-comment]").last().click();
assert.equal(await page.locator(".phoenix-social-comment-dialog").count(), 0);
assert.equal(mockSocialComments.length, 0);
assert.equal(await page.evaluate(() => document.body.style.overflow), commentBodyOverflow);
await page.waitForFunction(() => document.activeElement?.matches(".phoenix-post-card [data-comment]") === true);

await page.locator(".phoenix-post-card [data-comment]").nth(1).click();
await page.locator(".phoenix-social-comment-dialog").waitFor();
await page.keyboard.press("Escape");
await page.locator(".phoenix-social-comment-dialog").waitFor({ state: "detached" });
assert.equal(await page.evaluate(() => document.body.style.overflow), commentBodyOverflow);
await page.waitForFunction(() => document.activeElement?.matches(".phoenix-post-card [data-comment]") === true);

await page.locator(".phoenix-post-card [data-comment]").nth(1).click();
await page.locator("#phoenix-social-comment-body").fill("توضیحات محصول روشن و کاربردی است.");
await page.locator("[data-submit-social-comment]").click();
await page.getByText("دیدگاه برای بررسی ثبت شد.").waitFor();
assert.equal(mockSocialComments.length, 1);
assert.equal(mockSocialComments[0].body, "توضیحات محصول روشن و کاربردی است.");
assert.equal(mockSocialComments[0].targetType, "product");

await page.evaluate(() => {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: async (payload) => { window.__phoenixSharedPayload = payload; },
  });
});
await page.locator(".phoenix-post-card [data-share]").nth(1).click();
const sharedPayload = await page.evaluate(() => window.__phoenixSharedPayload);
assert.equal(new URL(sharedPayload.url).pathname, "/discover");
assert.equal(new URL(sharedPayload.url).searchParams.get("q"), "میز چوبی");
assert.ok(!sharedPayload.url.includes("/checkout"));

await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='en']").click();
await page.waitForTimeout(50);
await page.locator(".phoenix-post-card [data-comment]").first().click();
assert.equal(await page.locator("#phoenix-social-comment-title").innerText(), "Write a comment");
assert.ok((await page.locator("#phoenix-social-comment-body").getAttribute("placeholder")).includes("What would you like others to know"));
await page.locator("[data-cancel-social-comment]").last().click();

await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='ar']").click();
await page.waitForTimeout(50);
await page.locator(".phoenix-post-card [data-comment]").first().click();
assert.equal(await page.locator("#phoenix-social-comment-title").innerText(), "اكتب تعليقًا");
await page.locator("[data-cancel-social-comment]").last().click();

await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();
await page.waitForTimeout(50);

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
await page.goto(baseURL + "/booking?businessId=biz-1&offering=offering-service-1");
await page.locator(".phoenix-reset-booking-page").waitFor();
await page.locator(".phoenix-reset-booking-offer").waitFor();
await page.locator(".phoenix-reset-booking-slot button[data-book-slot]").first().waitFor();
assert.ok(bookingAvailabilityRequests.length > 0);
const bookingSlotUrl = new URL(bookingAvailabilityRequests[0].url);
const bookingFrom = new Date(bookingSlotUrl.searchParams.get("from") || "").getTime();
const bookingTo = new Date(bookingSlotUrl.searchParams.get("to") || "").getTime();
assert.ok(Number.isFinite(bookingFrom) && Number.isFinite(bookingTo));
assert.ok(bookingTo > bookingFrom);
assert.ok(bookingTo - bookingFrom > 47 * 60 * 60 * 1000, "The provider-local end date must be included in the availability range.");
const bookingFa = await page.locator(".phoenix-reset-booking-page").innerText();
assert.ok(bookingFa.includes("مشاورهٔ تخصصی"));
assert.ok(bookingFa.includes("زمان‌های آزاد"));
assert.ok(bookingFa.includes("زمان آزاد"));
assert.ok(!bookingFa.includes("biz-1"));
assert.ok(!bookingFa.includes("offering-service-1"));
assert.ok(!bookingFa.includes("schedule-1"));
assert.ok(!bookingFa.includes("Business ID"));
await page.locator(".phoenix-reset-booking-slot button[data-book-slot]").first().click();
await page.locator(".phoenix-reset-booking-hold-message.success").waitFor();
const bookingHoldFa = await page.locator(".phoenix-reset-booking-hold-message.success").innerText();
assert.ok(bookingHoldFa.includes("زمان به‌طور موقت نگه داشته شد"));
assert.ok(bookingHoldFa.includes("این هنوز رزرو قطعی نیست"));
assert.ok(!bookingHoldFa.includes("hold-test-1"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='en']").click();
await page.waitForTimeout(50);
const bookingEn = await page.locator(".phoenix-reset-booking-page").innerText();
assert.ok(bookingEn.includes("Choose a time that works for you"));
assert.ok(bookingEn.includes("Viewing this page alone does not confirm a reservation"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='ar']").click();
await page.waitForTimeout(50);
const bookingAr = await page.locator(".phoenix-reset-booking-page").innerText();
assert.ok(bookingAr.includes("اختر الوقت المناسب لك"));
assert.ok(bookingAr.includes("عرض هذه الصفحة وحده لا يؤكد الحجز"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();
await page.waitForTimeout(50);

await page.goto(baseURL + "/orders");
await page.locator(".phoenix-reset-orders-page").waitFor();
await page.locator(".phoenix-reset-order-card").first().waitFor();
const ordersFa = await page.locator(".phoenix-reset-orders-page").innerText();
assert.ok(ordersFa.includes("سفارش‌ها، از تأیید تا تحویل"));
assert.ok(ordersFa.includes("TRK-12345"));
assert.ok(ordersFa.includes("میز چوبی دست‌ساز"));
assert.equal(await page.locator(".phoenix-reset-order-card").count(), 2);
await page.locator("[data-orders-filter='shipped']").click();
assert.equal(await page.locator(".phoenix-reset-order-card").count(), 1);
const shippedOrderText = await page.locator(".phoenix-reset-order-card").first().innerText();
assert.ok(shippedOrderText.includes("TRK-12345"));
assert.ok(shippedOrderText.includes("میز چوبی دست‌ساز"));
await page.locator("[data-orders-filter='all']").click();
await page.locator("#orders-search-input").fill("صندلی چوبی");
assert.equal(await page.locator(".phoenix-reset-order-card").count(), 1);
assert.ok((await page.locator(".phoenix-reset-order-card").first().innerText()).includes("صندلی چوبی"));
await page.locator("#orders-search-input").fill("");
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='en']").click();
await page.waitForTimeout(50);
const ordersEn = await page.locator(".phoenix-reset-orders-page").innerText();
assert.ok(ordersEn.includes("From seller confirmation to delivery"));
assert.ok(ordersEn.includes("Awaiting / preparing") || ordersEn.includes("In transit"));
assert.ok(ordersEn.includes("Tracking code:"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='ar']").click();
await page.waitForTimeout(50);
const ordersAr = await page.locator(".phoenix-reset-orders-page").innerText();
assert.ok(ordersAr.includes("من تأكيد البائع حتى التسليم"));
assert.ok(ordersAr.includes("رمز التتبع:"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();
await page.waitForTimeout(50);

// The legacy customer transactions URL should lead to order tracking, not a deal-type dead end.
await page.evaluate(() => localStorage.setItem("phoenix.active_persona", "consumer"));
await page.goto(baseURL + "/transactions");
await page.locator(".phoenix-reset-orders-page").waitFor();
assert.equal(await page.locator(".social-shell .phoenix-social-header").count(), 1);
assert.ok((await page.locator(".phoenix-reset-orders-page").innerText()).includes("سفارش‌ها، از تأیید تا تحویل"));
assert.ok((await page.locator(".phoenix-reset-orders-page").innerText()).includes("TRK-12345"));

await page.goto(baseURL + "/messages");
await page.locator("[data-message-conversation]").first().waitFor();
assert.ok(await page.locator(".phoenix-reset-messages-workspace").count() === 1);
const messagesText = await page.locator(".phoenix-reset-messages-page").innerText();
assert.ok(messagesText.includes("پیام‌ها و گفت‌وگوها"));
assert.ok(messagesText.includes("دربارهٔ این کالا یک پرسش دارم."));
assert.ok(!messagesText.includes("conversation-e2e-1"));
await page.locator("[data-message-conversation]").first().click();
await page.locator(".phoenix-reset-message-bubble").first().waitFor();
assert.ok((await page.locator(".phoenix-reset-message-thread-card").innerText()).includes("سلام، چطور می‌توانم راهنمایی‌ات کنم؟"));
await page.locator("#messages-compose").fill("ممنون، لطفاً جزئیات بیشتری بفرستید.");
await page.locator("[data-message-send]").click();
try {
  await page.locator(".phoenix-reset-message-bubble").filter({ hasText: "ممنون، لطفاً جزئیات بیشتری بفرستید." }).waitFor({ timeout: 5000 });
} catch (error) {
  const diagnostics = {
    sentRequests: communicationSendRequests,
    messages: mockCommunicationMessages,
    threadText: await page.locator("#messages-thread").innerText().catch(() => ""),
    sendError: await page.locator("#messages-send-error").innerText().catch(() => ""),
    inboxStatus: await page.locator("#messages-inbox-status").innerText().catch(() => ""),
  };
  process.stderr.write("Communication message-send E2E diagnostics: " + JSON.stringify(diagnostics, null, 2) + "\\n");
  throw error;
}
assert.equal(communicationSendRequests.length, 1);
assert.equal(communicationSendRequests[0].conversationId, "conversation-e2e-1");
assert.ok(await page.locator(".phoenix-reset-messages-integrity-note").isVisible());
assert.ok(!messagesText.includes("پاسخ ساختگی"));
assert.ok(!messagesText.includes("در خدمت شما هستیم"));
assert.ok(!messagesText.includes("سفارش کالا رسید و تأیید شد"));
await page.goto(baseURL + "/messages?order=order-e2e-context");
const contextualMessages = await page.locator(".phoenix-reset-messages-page").innerText();
assert.equal(await page.locator(".phoenix-reset-message-context-id").textContent(), "order-e2e-context");
assert.equal(await page.locator(".phoenix-reset-message-context-id").getAttribute("translate"), "no");
assert.equal(await page.locator(".phoenix-reset-message-context-id").isVisible(), false);
assert.ok(contextualMessages.includes("سفارش انتخاب‌شده"));
assert.ok(contextualMessages.includes("هیچ پیامی نمایش یا ارسال نمی‌شود"));
await page.goto(baseURL + "/messages");
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='en']").click();
await page.waitForTimeout(100);
assert.ok((await page.locator(".phoenix-reset-messages-page").innerText()).includes("Messages and conversations"));
assert.ok((await page.locator(".phoenix-reset-messages-page").innerText()).includes("Loading conversations") === false);
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='ar']").click();
await page.waitForTimeout(100);
assert.ok((await page.locator(".phoenix-reset-messages-page").innerText()).includes("الرسائل والمحادثات"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();
await page.waitForTimeout(50);

// Start with an empty cart; the browser test adds a real-priced discovery result below.
await page.evaluate(() => {
  localStorage.setItem("phoenix.active_persona", "consumer");
  localStorage.removeItem("phoenix.cart_items");
});
await page.goto(baseURL + "/create");
assert.ok(await page.locator(".phoenix-reset-create-page").count() > 0);
const createFa = await page.locator(".phoenix-reset-create-page").innerText();
assert.ok(createFa.includes("عرضه‌ات را با توضیحی ساده شروع کن"));
assert.ok(createFa.includes("توضیحت را بنویس"));
assert.ok(createFa.includes("دنبال چیزی می‌گردی؟"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='en']").click();
await page.waitForTimeout(50);
const createEn = await page.locator(".phoenix-reset-create-page").innerText();
assert.ok(createEn.includes("Start your offer with a simple description"));
assert.ok(createEn.includes("Describe your offer"));
assert.ok(createEn.includes("Looking for something?"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='ar']").click();
await page.waitForTimeout(50);
const createAr = await page.locator(".phoenix-reset-create-page").innerText();
assert.ok(createAr.includes("ابدأ عرضك بوصف بسيط"));
assert.ok(createAr.includes("اكتب وصف العرض"));
assert.ok(createAr.includes("هل تبحث عن شيء محدد؟"));
await page.locator("[data-create-need]").click();
await page.waitForURL(/\/discover\?tab=explore&intent=need/);
await page.waitForFunction(() => document.activeElement?.id === "discover-query");
assert.ok(await page.locator("#discover-query").count() === 1);
await page.goto(baseURL + "/create");
await page.locator(".phoenix-reset-create-page").waitFor();
await page.goto(baseURL + "/create/deal-type");
const dealGuardArabic = await page.locator(".phoenix-reset-deal-guard").innerText();
assert.ok(dealGuardArabic.includes("أكمل العرض قبل بدء المعاملة"), "Arabic deal guard copy: " + dealGuardArabic);
assert.ok(dealGuardArabic.includes("لا يمكن إنشاء معاملة من نص أولي فقط."));
assert.equal(await page.locator("#confirm-deal-btn").count(), 0);
assert.equal(await page.locator(".phoenix-reset-deal-guard a[href='/product-studio']").count(), 1);
await page.goto(baseURL + "/create/details");
assert.equal(await page.locator("#content-desc-input").inputValue(), "");
assert.equal(await page.locator("#content-price-input").count(), 0);
const detailArabic = await page.locator(".phoenix-reset-create-detail-page").innerText();
assert.ok(detailArabic.includes("اكتب وصف العرض؛ سيُنظّم ققنوس التفاصيل."), "Arabic create-details copy: " + detailArabic);
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='en']").click();
await page.waitForTimeout(50);
const detailEnglish = await page.locator(".phoenix-reset-create-detail-page").innerText();
assert.ok(detailEnglish.includes("Describe your offer; Phoenix structures it."));
assert.ok(detailEnglish.includes("From raw description to publication"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();
await page.waitForTimeout(50);
assert.ok((await page.locator(".phoenix-reset-create-detail-page").innerText()).includes("توصیفت را بنویس؛ ققنوس ساختار می‌دهد"));
await page.locator("#content-desc-input").fill("چراغ رومیزی چوبی با نور گرم");
await page.locator("#content-details-form [type=submit]").click();
await page.waitForURL(/\/product-studio$/);
assert.equal(await page.locator("#studio-text").inputValue(), "چراغ رومیزی چوبی با نور گرم");
await page.goto(baseURL + "/create");
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();
await page.locator("[data-open-create-post]").first().click();
await page.locator("#social-post-text").fill("میز چوبی دست‌ساز برای اتاق کوچک");
await page.locator("[data-create-post-submit]").click();
await page.waitForURL(/\/product-studio$/);
assert.equal(await page.locator("#studio-text").inputValue(), "میز چوبی دست‌ساز برای اتاق کوچک");
await page.goto(baseURL + "/");
await page.locator("#phoenix-commerce-people-rail").waitFor();
assert.equal(await page.locator(".phoenix-social-mobile-nav").count(), 1, "Social shell should expose the shared mobile navigation");
await page.goto(baseURL + "/activity");
await page.locator(".phoenix-activity-row").first().waitFor();
const activityFa = await page.locator(".phoenix-reset-activity-page").innerText();
assert.ok(activityFa.includes("ردپای اجتماعی تو در ققنوس"));
assert.ok(activityFa.includes("یک مورد را ذخیره کردی"));
assert.ok(activityFa.includes("میز چوبی"));
assert.ok(!activityFa.includes("prod-1"));
assert.equal(await page.locator("a[href*='/checkout']").count(), 0);
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='en']").click();
await page.waitForTimeout(50);
const activityEn = await page.locator(".phoenix-reset-activity-page").innerText();
assert.ok(activityEn.includes("Your activity on Phoenix"));
assert.ok(activityEn.includes("You saved an item"));
assert.ok(activityEn.includes("Selected comparisons"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='ar']").click();
await page.waitForTimeout(50);
const activityAr = await page.locator(".phoenix-reset-activity-page").innerText();
assert.ok(activityAr.includes("نشاطك على ققنوس"));
assert.ok(activityAr.includes("حفظت عنصراً"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();

await page.goto(baseURL + "/notifications");
await page.locator(".phoenix-reset-notification-item").first().waitFor();
const notificationsFa = await page.locator(".phoenix-reset-notifications-page").innerText();
assert.ok(notificationsFa.includes("خبرهای مهم ققنوس"));
assert.ok(notificationsFa.includes("رزرو تأیید شد"));
assert.ok(notificationsFa.includes("خوانده‌نشده"));
assert.ok(!notificationsFa.includes("booking.confirmed"));
assert.ok(!notificationsFa.includes("رزرو شما تأیید شد"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='en']").click();
await page.locator(".phoenix-reset-notification-item strong").filter({ hasText: "Booking confirmed" }).waitFor();
const notificationsEn = await page.locator(".phoenix-reset-notifications-page").innerText();
assert.ok(notificationsEn.includes("Updates that matter"));
assert.ok(notificationsEn.includes("Booking confirmed"));
assert.ok(notificationsEn.includes("Mark as read"), "Initial notification should be unread before the user marks it read.");
assert.ok(notificationsEn.includes("Delivered"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='ar']").click();
await page.locator(".phoenix-reset-notification-item strong").filter({ hasText: "تم تأكيد الحجز" }).waitFor();
const notificationsAr = await page.locator(".phoenix-reset-notifications-page").innerText();
assert.ok(notificationsAr.includes("التحديثات المهمة"));
assert.ok(notificationsAr.includes("تم تأكيد الحجز"), "Arabic notification content did not match. Actual page text: " + notificationsAr);
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();

await page.goto(baseURL + "/");
await page.locator("#discover-query").fill("میز چوبی");
await page.locator("[data-run-discovery]").click();
await page.getByRole("heading", { name: "موجودیت واقعی تست" }).waitFor();
await page.locator(".phoenix-post-card [data-discovery-index='1'] img.phoenix-post-image").waitFor();
assert.ok(publicMediaBatchRequests.some((references) => references.includes("prod-1")), "feed should batch-load image media by the public product reference");
assert.ok((await page.locator(".phoenix-post-card [data-discovery-index='1'] img.phoenix-post-image").getAttribute("src") ?? "").includes("/api/v1/public/offerings/offering-1/media/asset-photo-1/content"));
await page.locator(".phoenix-post-card [data-discovery-index='1']").click();
await page.locator(".phoenix-detail-modal").waitFor();
assert.equal(await page.locator("[data-add-to-cart-detail]").count(), 1);
await page.locator("[data-add-to-cart-detail]").click();
await page.locator(".phoenix-screen-wrapper").waitFor();
const localCartAfterAdd = await page.locator(".phoenix-screen-wrapper").innerText();
assert.ok(localCartAfterAdd.includes("میز چوبی"));
assert.ok(localCartAfterAdd.includes("ریال"));
assert.ok(!localCartAfterAdd.includes("محصول نمایشی محلی"));
await page.goto(baseURL + "/cart");
const cartPreviewText = await page.locator(".phoenix-screen-wrapper").innerText();
assert.ok(cartPreviewText.includes("پیش‌نمایش سبد محلی"));
assert.ok(cartPreviewText.includes("مجموع تقریبی اقلام محلی"));
assert.ok(cartPreviewText.includes("هزینهٔ ارسال پس از بررسی سفارش مشخص می‌شود."));
assert.ok(!cartPreviewText.includes("رایگان"));
// Checkout must remain the honest review-only screen even when the account
// is currently using the seller workspace persona.
await page.evaluate(() => localStorage.setItem("phoenix.active_persona", "business"));
await page.goto(baseURL + "/checkout");
await page.locator(".phoenix-checkout-review").waitFor();
assert.equal(await page.locator(".phoenix-checkout-container").count(), 0);
assert.equal(await page.locator("[data-place-order]").count(), 0);
assert.equal(await page.locator("#consumer-payment-form").count(), 0);
assert.equal(await page.locator(".phoenix-checkout-review button[type='submit']").count(), 0);
const checkoutPreviewFa = await page.locator(".phoenix-checkout-review").innerText();
assert.ok(checkoutPreviewFa.includes("پرداخت امن هنوز متصل نشده است."));
assert.ok(checkoutPreviewFa.includes("مبلغی کسر نخواهد شد"));
assert.ok(checkoutPreviewFa.includes("میز چوبی"));
assert.ok(checkoutPreviewFa.includes("ریال"));
assert.ok(!checkoutPreviewFa.includes("محصول نمایشی محلی"));
assert.ok(!checkoutPreviewFa.includes("سفارش با موفقیت ثبت و پرداخت شد"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='en']").click();
await page.waitForTimeout(50);
const checkoutPreviewEn = await page.locator(".phoenix-checkout-review").innerText();
assert.ok(checkoutPreviewEn.includes("Secure checkout is not connected yet."));
assert.ok(checkoutPreviewEn.includes("no payment will be taken"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='ar']").click();
await page.waitForTimeout(50);
const checkoutPreviewAr = await page.locator(".phoenix-checkout-review").innerText();
assert.ok(checkoutPreviewAr.includes("لم يتم ربط الدفع الآمن بعد."));
assert.ok(checkoutPreviewAr.includes("لن يتم إنشاء طلب"));
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();
await page.waitForTimeout(50);
assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("phoenix.cart_items") || "[]").length), 1);

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
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(60);
assert.equal(await page.locator(".phoenix-seller-reset").isVisible(), true);
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  true,
  "the seller workspace must not overflow horizontally on mobile",
);
await page.setViewportSize({ width: 1440, height: 900 });
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

// Seller catalog, services, bookings and settings must use canonical APIs, not fixture arrays inside UI code.
await page.evaluate(() => {
  localStorage.setItem("phoenix-business-id", "biz-1");
  localStorage.setItem("phoenix.active_persona", "business");
});
await page.goto(baseURL + "/business/products");
await page.locator("#business-products-table .phoenix-business-data-table").waitFor();
const productCatalogText = await page.locator("#business-products-table").innerText();
assert.ok(productCatalogText.includes("کیف دست‌دوز"));
assert.ok(!productCatalogText.includes("prd-1"));
assert.ok(!productCatalogText.includes("۳ محصول فعال"));
await page.setViewportSize({ width: 390, height: 844 });
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "seller product catalog must fit mobile width");
await page.setViewportSize({ width: 1440, height: 900 });

await page.goto(baseURL + "/business/services");
await page.locator("#business-services-table .phoenix-business-data-table").waitFor();
const serviceCatalogText = await page.locator("#business-services-table").innerText();
assert.ok(serviceCatalogText.includes("مشاورهٔ تخصصی"));
assert.ok(!serviceCatalogText.includes("svc-1"));
assert.ok(!serviceCatalogText.includes("۲ خدمت فعال"));

await page.goto(baseURL + "/business/bookings");
await page.locator("#business-bookings-table .phoenix-business-data-table").waitFor();
const businessBookingsText = await page.locator("#business-bookings-table").innerText();
assert.ok(businessBookingsText.includes("مشاورهٔ تخصصی"));
assert.ok(businessBookingsText.includes("تأییدشده"));
assert.ok(!businessBookingsText.includes("customer-private-e2e"));
assert.ok(!businessBookingsText.includes("bkg-101"));
await page.setViewportSize({ width: 390, height: 844 });
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "seller booking list must fit mobile width");
await page.setViewportSize({ width: 1440, height: 900 });

await page.goto(baseURL + "/business/settings");
await page.locator("#business-settings-form:not([hidden])").waitFor();
assert.equal(await page.locator("#biz-set-name").inputValue(), "store-test");
assert.equal(await page.locator("#biz-set-display-name").inputValue(), "فروشگاه آزمایشی");
assert.ok(!(await page.locator("#business-settings-status").innerText()).includes("تأییدشده"));
await page.locator("#biz-set-display-name").fill("فروشگاه آزمایشی ویرایش‌شده");
await page.locator("[data-save-biz-settings]").click();
await page.locator("#business-settings-feedback").getByText("اطلاعات ذخیره شد.").waitFor();
assert.equal(mockBusinessUpdates.length, 1);
assert.equal(mockBusinessUpdates[0].displayName, "فروشگاه آزمایشی ویرایش‌شده");
await page.setViewportSize({ width: 390, height: 844 });
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "seller settings must fit mobile width");
await page.setViewportSize({ width: 1440, height: 900 });

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
await page.locator('[data-follow="result-product-user-1"]').click();
await page.locator('[data-follow="result-product-user-1"].selected').waitFor();
assert.ok(mockSocialFollows.has("user:user-seller-2"), "a person-owned offer must follow the seller user, not a fake business");
assert.ok(mockSocialFollows.has("business:biz-1"), "a business-owned offer must follow the business");

// Mobile regression: feed and offer detail stay within the viewport without horizontal scrolling.
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(60);
assert.equal(await page.locator(".phoenix-social-mobile-nav").isVisible(), true);
const feedOverflow = await page.evaluate(() => {
  const viewport = window.innerWidth;
  const offenders = Array.from(document.querySelectorAll("body *"))
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === "string" ? element.className : "",
        id: element.id,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        scrollWidth: element.scrollWidth,
      };
    })
    .filter((item) => item.width > 0 && (item.left < -1 || item.right > viewport + 1))
    .slice(0, 18);
  return { viewport, documentWidth: document.documentElement.scrollWidth, offenders };
});
assert.ok(
  feedOverflow.documentWidth <= feedOverflow.viewport,
  "the social feed must not overflow horizontally on mobile: " + JSON.stringify(feedOverflow),
);

// Saving a feed card must preserve the approved social-card renderer. It must not
// fall back to the retired generic Discovery result cards after social-state refresh.
await page.locator('.phoenix-post-card [data-save="result-product-1"]').click();
await page.locator('.phoenix-post-card [data-save="result-product-1"].selected').waitFor();
assert.ok(await page.locator(".phoenix-post-card .phoenix-post-media").count() >= 3);
assert.equal(await page.locator(".phoenix-reset-posts .result-card").count(), 0);
await page.locator('.phoenix-post-card [data-save="result-product-1"]').click();
await page.waitForFunction(() => {
  const button = document.querySelector('.phoenix-post-card [data-save="result-product-1"]');
  return Boolean(button && !button.classList.contains("selected"));
});
assert.equal(await page.locator("#shortlist-count").innerText(), "۰");
assert.ok(await page.locator(".phoenix-post-card").count() >= 3);

await page.locator("[data-discovery-index='0']").click();
const detailFollowButton = page.locator(".phoenix-detail-modal [data-follow-seller-detail]");
await detailFollowButton.waitFor();
assert.equal(await detailFollowButton.getAttribute("aria-pressed"), "true");
const detailBounds = await page.locator(".phoenix-detail-modal").boundingBox();
assert.ok(detailBounds, "the product detail modal should be visible on mobile");
assert.ok(detailBounds.width <= 390, "the product detail modal must fit the mobile viewport");
const detailColumns = await page.locator(".phoenix-detail-layout").evaluate((element) => getComputedStyle(element).gridTemplateColumns);
assert.equal(detailColumns.trim().split(/\s+/).length, 1, "offer details should stack to one column on mobile");
await detailFollowButton.click();
await page.waitForFunction(() => document.querySelector(".phoenix-detail-modal [data-follow-seller-detail]")?.getAttribute("aria-pressed") === "false");
await detailFollowButton.click();
await page.waitForFunction(() => document.querySelector(".phoenix-detail-modal [data-follow-seller-detail]")?.getAttribute("aria-pressed") === "true");
await page.locator(".connection-modal [data-save-detail]").click();
await page.waitForFunction(() => document.querySelector("#shortlist-count")?.textContent === "۱");
await page.keyboard.press("Escape");
await page.locator(".phoenix-detail-modal").waitFor({ state: "detached" });
assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-discovery-index")), "0");
assert.equal(await page.locator("#shortlist-count").innerText(), "۱");
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  true,
  "the open/closed detail flow must not introduce mobile page overflow",
);
await page.setViewportSize({ width: 1440, height: 900 });

await page.goto(baseURL + "/discover?tab=following");
try {
  await page.getByRole("heading", { name: "کالای فروشگاه دنبال‌شده" }).waitFor({ timeout: 7000 });
  await page.getByRole("heading", { name: "کالای فروشندهٔ مستقل دنبال‌شده" }).waitFor({ timeout: 7000 });
  assert.ok(await page.locator('[data-follow="followed-user-product"].selected').count() === 1);
} catch (error) {
  const visibleText = await page.locator(".phoenix-reset-page").innerText().catch(() => "");
  process.stderr.write("Phoenix following-feed diagnostics: " + JSON.stringify({ discoveryRequests, visibleText, runtimeErrors, failedRequests }, null, 2) + "\\n");
  throw error;
}

await page.goto(baseURL + "/saved");
await page.getByRole("heading", { name: "ذخیره‌شده‌های تو" }).waitFor();
await page.getByRole("heading", { name: "موجودیت واقعی تست" }).waitFor();
assert.ok(!(await page.locator("#saved-items-grid").innerText()).includes("خدمات مشاوره تخصصی کسب‌وکار و رشد"));
await page.locator('[data-saved-remove="result-1"]').click();
await page.getByRole("heading", { name: "هنوز چیزی ذخیره نکرده‌ای." }).waitFor();
assert.equal(await page.locator("#saved-items-count").innerText(), "۰");

await page.goto(baseURL + "/business");
await page.locator("[data-workspace-toggle]").first().click();
await page.getByText("Workspace دوم").waitFor();
await page.locator("[data-select-workspace='ws-2']").click();
await page.waitForTimeout(100);
assert.equal(await page.evaluate(() => localStorage.getItem("phoenix-workspace-id")), "ws-2");

await page.locator("[data-notification-toggle]").click();
await page.getByRole("heading", { name: "اعلان‌های شما" }).waitFor();
await page.getByText("رزرو تأیید شد").waitFor();
assert.ok(!(await page.locator(".notification-modal").innerText()).includes("booking.confirmed"));
await page.locator("[data-mark-notification-read='notice-1']").click();
if (!notificationReadRequests.length) {
  const notificationDiagnostics = {
    tokenPresent: await page.evaluate(() => Boolean(sessionStorage.getItem("phoenix-access-token"))),
    buttonDisabled: await page.locator("[data-mark-notification-read='notice-1']").isDisabled().catch(() => null),
    buttonParentClass: await page.locator("[data-mark-notification-read='notice-1']").evaluate((node) => node.parentElement?.className ?? ""),
    popoverCount: await page.locator(".notification-overlay .notification-modal").count(),
    mockStatus: mockNotifications[0]?.status,
    runtimeErrors,
    failedRequests,
  };
  process.stderr.write("Phoenix notification-read E2E diagnostics: " + JSON.stringify(notificationDiagnostics, null, 2) + "\n");
}
assert.deepEqual(notificationReadRequests, [{ id: "notice-1", method: "POST", path: "/api/v1/notifications/notice-1/read" }]);
assert.equal(mockNotifications[0].status, "read");

// Verify persisted state after the action, using a fresh inbox read.
await page.goto(baseURL + "/notifications");
await page.locator(".phoenix-reset-notification-item.read").first().waitFor();
const notificationsAfterRead = await page.locator(".phoenix-reset-notifications-page").innerText();
assert.ok(notificationsAfterRead.includes("خوانده شد"), "Notification read state did not survive a fresh inbox load: " + notificationsAfterRead);
assert.ok(notificationsAfterRead.includes("۰ خوانده‌نشده"), "Unread count did not refresh after marking read: " + notificationsAfterRead);

await page.goto(baseURL + "/admin");
await page.getByText("business.updated").waitFor();
await page.getByText("seller.product.extract").waitFor();

await page.goto(baseURL + "/account");
await page.locator(".phoenix-reset-account-page").waitFor();
await page.locator("[data-language-toggle]").click();
await page.locator("[data-language-option='fa']").click();
await page.waitForTimeout(100);
const accountText = await page.locator(".phoenix-reset-account-page").innerText();
assert.ok(accountText.includes("همه‌چیز حسابت، یک‌جا"));
assert.ok(!accountText.includes("Tenant"));
assert.ok(!accountText.includes("Workspace"));
assert.equal(await page.locator(".phoenix-reset-account-link[href='/orders']").count(), 1);

await page.goto(baseURL + "/settings");
await page.locator(".phoenix-reset-settings-page").waitFor();
await page.locator("#setting-notify-sms").check();
await page.locator("[data-save-all-settings]").click();
assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("phoenix-notification-preferences") || "{}")).sms, true);
await page.reload();
assert.equal(await page.locator("#setting-notify-sms").isChecked(), true);
assert.ok((await page.locator(".phoenix-reset-settings-page").innerText()).includes("اتصال ارسال پیامک هنوز فعال نیست"));

await page.goto(baseURL + "/welcome");
await page.locator(".phoenix-public-header").waitFor();
assert.equal(await page.locator(".phoenix-public-header [data-open-seller-register]").count(), 0);
assert.equal(await page.locator(".phoenix-public-header [data-open-register]").count(), 1);
assert.equal(await page.locator(".phoenix-public-header .phoenix-persona-quick-nav").count(), 0);
assert.equal(await page.locator(".phoenix-auth-one-account-view").count(), 0);
await page.locator(".phoenix-public-header [data-open-register]").click();
await page.locator(".phoenix-auth-one-account-view").waitFor();
assert.ok((await page.locator(".phoenix-auth-one-account-view").innerText()).includes("یک حساب برای همهٔ تجربه‌های ققنوس"));
assert.equal(await page.locator(".phoenix-auth-one-account-view [data-select-track]").count(), 2);
assert.equal(await page.locator(".phoenix-auth-one-account-view [data-select-track='seller']").count(), 0);
await page.locator(".phoenix-auth-one-account-view [data-select-track='buyer']").first().click();
await page.locator("#auth-mobile-form").waitFor();

await page.goto(baseURL + "/business/welcome");
await page.locator(".phoenix-reset-seller-start-page").waitFor();
const sellerStartText = await page.locator(".phoenix-reset-seller-start-page").innerText();
assert.ok(sellerStartText.includes("برای فروشندگی حساب جداگانه نمی‌خواهی."));
assert.ok(sellerStartText.includes("فروشندگی را از پروفایل فعال کن"));
assert.ok(!sellerStartText.includes("مناقصات"));
assert.equal(await page.locator(".phoenix-reset-seller-start-page [data-open-register]").count(), 1);

await page.goto(baseURL + "/consumer/welcome");
await page.locator(".phoenix-reset-start-page").waitFor();
const startPageText = await page.locator(".phoenix-reset-start-page").innerText();
assert.ok(startPageText.includes("فقط بگو چه می‌خواهی"));
assert.ok(startPageText.includes("با همان حساب"));
assert.ok(!startPageText.includes("خرید امن با درگاه"));
assert.ok(!startPageText.includes("امتیاز، رتبه و تخفیف‌های ویژه"));
assert.equal(await page.locator(".phoenix-reset-start-page [data-open-register]").count(), 2);


await page.goto(baseURL + "/offerings/offering-1?business=biz-1");
await page.locator(".phoenix-public-offering-page").waitFor();
assert.equal(await page.locator("#public-offer-title").innerText(), "کیف دست‌دوز");
assert.equal(await page.locator("#public-offer-seller-name").innerText(), "ترنج");
assert.ok((await page.locator("#public-offer-price").innerText()).length > 0);
assert.ok((await page.locator("#public-offer-description").innerText()).includes("نمونهٔ کالای منتشرشده"));
await page.locator(".phoenix-public-offering-gallery-image").waitFor();
await page.waitForFunction(() => {
  const image = document.querySelector(".phoenix-public-offering-gallery-image");
  return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
});
assert.ok((await page.locator(".phoenix-public-offering-gallery-image").getAttribute("src") || "").endsWith("/media/asset-photo-1/content"));
assert.ok(await page.locator(".phoenix-public-offering-gallery-image").isVisible());
assert.ok(await page.locator("#public-offer-primary-action").isVisible());
await page.evaluate(() => localStorage.setItem("qooqnos.locale", "en"));
await page.reload();
await page.locator(".phoenix-public-offering-page").waitFor();
await page.waitForFunction(() => document.querySelector("#public-offer-type")?.textContent === "Product");
assert.equal(await page.title(), "کیف دست‌دوز | Qooqnos");
assert.equal(await page.locator("#public-offer-price").evaluate((el) => el.parentElement?.querySelector("span")?.textContent), "Recorded price");
assert.equal(await page.locator('[data-public-offer-variant="color"]').count(), 1);
assert.equal(await page.locator('[data-public-offer-variant="size"]').count(), 1);
assert.equal(await page.locator("#public-offer-ask").innerText(), "Ask the seller");
await page.evaluate(() => localStorage.setItem("qooqnos.locale", "ar"));
await page.reload();
await page.locator(".phoenix-public-offering-page").waitFor();
await page.waitForFunction(() => document.querySelector("#public-offer-type")?.textContent === "منتج");
assert.equal(await page.title(), "کیف دست‌دوز | ققنوس");
assert.equal(await page.locator("#public-offer-price").evaluate((el) => el.parentElement?.querySelector("span")?.textContent), "السعر المسجّل");
await page.evaluate(() => localStorage.setItem("qooqnos.locale", "fa"));
await page.reload();
await page.locator(".phoenix-public-offering-page").waitFor();
await page.waitForFunction(() => document.querySelector("#public-offer-type")?.textContent === "کالا");
assert.equal(await page.title(), "کیف دست‌دوز | ققنوس");
await page.locator('[data-public-offer-variant="color"]').selectOption("Blue");
await page.locator('[data-public-offer-variant="size"]').selectOption("M");
await page.locator("#public-offer-primary-action").click();
assert.ok(page.url().includes("/offerings/offering-1"), "Unavailable variant combinations must not be added to the cart.");
assert.ok((await page.locator(".phoenix-public-offering-variant-status").innerText()).includes("موجود نیست"));
await page.locator('[data-public-offer-variant="size"]').selectOption("S");
await page.locator("#public-offer-primary-action").click();
await page.waitForURL("**/cart");
const selectedVariantCartPreviewText = await page.locator(".phoenix-screen-wrapper").innerText();
const persistedCartItems = await page.evaluate(() => JSON.parse(localStorage.getItem("phoenix.cart_items") || "[]"));
assert.ok(persistedCartItems.some((item) => item.variantId === "variant-blue-s"), "Variant ID missing from local cart: " + JSON.stringify(persistedCartItems));
assert.ok(persistedCartItems.some((item) => item.variantLabel === "Color: Blue · Size: S"), "Variant label missing from local cart: " + JSON.stringify(persistedCartItems));
assert.ok(persistedCartItems.some((item) => item.title === "کیف دست‌دوز · Color: Blue · Size: S"), "Variant title missing from local cart: " + JSON.stringify(persistedCartItems));
assert.ok(selectedVariantCartPreviewText.includes("رنگ: Blue"), "Cart preview omitted chosen color: " + selectedVariantCartPreviewText);
assert.ok(selectedVariantCartPreviewText.includes("اندازه: S"), "Cart preview omitted chosen size: " + selectedVariantCartPreviewText);
await page.goto(baseURL + "/offerings/offering-1?business=biz-1");
await page.locator(".phoenix-public-offering-page").waitFor();
await page.goto(baseURL + "/offerings/does-not-exist?business=biz-1");
await page.locator(".phoenix-public-offering-page").waitFor();
await page.locator("#public-offer-published[data-state='unavailable']").waitFor();
await page.goto(baseURL + "/product/demo");
await page.locator(".phoenix-reset-product-unavailable").waitFor();
const unavailableProductText = await page.locator(".phoenix-reset-product-unavailable").innerText();
assert.ok(unavailableProductText.includes("این نشانی به کالای واقعی وصل نیست"));
assert.ok(!unavailableProductText.includes("۱۵۰٬۰۰۰"));
assert.ok(await page.locator(".phoenix-reset-product-unavailable a[href='/discover?tab=explore']").count() === 1);

await page.goto(baseURL + "/cart");
assert.equal(await page.locator(".social-shell .phoenix-social-header").count(), 1);
assert.ok((await page.locator(".phoenix-screen-wrapper").innerText()).includes("این صفحه فقط پیش‌نمایش سبد محلی را نشان می‌دهد"));

await page.goto(baseURL + "/checkout");
assert.equal(await page.locator(".social-shell .phoenix-social-header").count(), 1);
await page.locator(".phoenix-checkout-review-hero").waitFor();
assert.ok((await page.locator(".phoenix-checkout-review-hero").innerText()).includes("پرداخت امن هنوز متصل نشده است."));
assert.equal(await page.locator("[data-submit-payment], [data-confirm-order]").count(), 0);

await page.goto(baseURL + "/design-system");
await page.getByText("Primitiveهای مشترک").waitFor();
await page.locator(".ds-table").waitFor();

await page.goto(baseURL + "/product-studio");
await page.locator(".phoenix-reset-studio-page").waitFor();
assert.equal(await page.locator(".phoenix-reset-studio-process .phoenix-reset-studio-step").count(), 5);
assert.equal(await page.locator(".phoenix-reset-studio-image-heading").count(), 1);
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
await page.locator("#studio-file").setInputFiles({
  name: "product-test.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAAMIM////ZwAAHu8E/KPItPcAAAAASUVORK5CYII=", "base64"),
});
await page.locator("[data-generate-draft]").click();
await page.getByText("محصول تست").waitFor();
await page.locator("[data-confirm-seller-draft]").click();
await page.getByText("محصول Catalog ساخته شد").waitFor();
await page.getByRole("button", { name: "تأیید و افزودن به ویترین" }).waitFor();
await page.locator("[data-create-seller-offer]").click();
await page.getByText("عرضه ساخته شد و تصویر به آن متصل شد").waitFor();
await page.locator("[data-publish-seller-offer]").click();
await page.getByText("درخواست انتشار ثبت شد").waitFor();
assert.equal(mediaAssetUploadRequests.length, 1, "Seller Studio should upload the prepared image once");
assert.ok(mediaAssetUploadRequests[0].includes("browser-webp-v1"), "Seller Studio should declare its browser-rasterized variant");
assert.ok(mediaAssetUploadRequests[0].includes("image/webp"), "Seller Studio should upload the metadata-free WebP result");
assert.ok(mediaAssetUploadRequests[0].includes("imageWidth"));
assert.equal(offeringMediaLinkRequests.length, 1, "Creating an offer should attach the uploaded image");
assert.equal(offeringMediaLinkRequests[0].path, "/api/v1/catalog/offers/offer-1/media/asset-studio-e2e-1");

await browser.close();
server.kill("SIGTERM");
process.stdout.write("Phoenix UI E2E smoke passed; shell budget " + shellMs + "ms.\n");
