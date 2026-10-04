import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import crypto from "node:crypto";

const root = join(process.cwd(), "apps/web/public");
const port = 3000;
const host = "0.0.0.0";

if (!existsSync(join(root, "dist/main.js"))) {
  console.log("Compiling web frontend assets...");
  try {
    const { execSync } = await import("node:child_process");
    execSync("npm --workspace=@qooqnos/web run build", { stdio: "inherit" });
  } catch (err) {
    console.error("Failed to build frontend:", err);
  }
}

const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
  [".ico", "image/x-icon"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
]);

const sampleDiscoveryItems = [
  {
    id: "item-1",
    sourceType: "service",
    sourceId: "svc-1",
    title: "خدمات مشاوره تخصصی کسب‌وکار و رشد",
    name: "خدمات مشاوره تخصصی کسب‌وکار و رشد",
    description: "راهنمایی جامع برای بهینه‌سازی فرایندها، بازاریابی دیجیتال و رشد مقیاس‌پذیر در پلتفرم ققنوس.",
    city: "تهران",
    locality: "سعادت‌آباد",
    rating: 4.9,
    score: 96,
    price: 4500000,
    currency: "IRR",
    metadata: { businessId: "biz-1", offeringType: "service" },
  },
  {
    id: "item-2",
    sourceType: "product",
    sourceId: "prod-1",
    title: "بسته ابری هوش سازمانی ققنوس",
    name: "بسته ابری هوش سازمانی ققنوس",
    description: "مجموعه ابزارهای هوش مصنوعی جهت تحلیل داده‌ها، پیش‌بینی رفتار مشتریان و خودکارسازی سفارش‌ها.",
    city: "تهران",
    locality: "ونک",
    rating: 4.8,
    score: 92,
    price: 12000000,
    currency: "IRR",
    metadata: { businessId: "biz-2", offeringType: "product" },
  },
  {
    id: "item-3",
    sourceType: "business",
    sourceId: "biz-1",
    title: "مرکز خدمات فناوری و نوآوری ققنوس",
    name: "مرکز خدمات فناوری و نوآوری ققنوس",
    description: "ارائه‌دهنده راه‌حل‌های یکپارچه برای کسب‌وکارهای مدرن و استارتاپ‌ها با پشتیبانی ۲۴ ساعته.",
    city: "اصفهان",
    locality: "چهارباغ",
    rating: 5.0,
    score: 98,
    price: null,
    currency: "IRR",
    metadata: { businessId: "biz-1", offeringType: "business" },
  },
  {
    id: "item-4",
    sourceType: "service",
    sourceId: "svc-2",
    title: "طراحی و توسعه تجربه کاربری اختصاصی",
    name: "طراحی و توسعه تجربه کاربری اختصاصی",
    description: "طراحی رابط‌های کاربری چشم‌نواز، واکنش‌گرا و بهینه‌سازی‌شده برای نرخ تبدیل حداکثری.",
    city: "شیراز",
    locality: "ارم",
    rating: 4.7,
    score: 89,
    price: 7800000,
    currency: "IRR",
    metadata: { businessId: "biz-3", offeringType: "service" },
  },
];

const followsStore = new Map([
  ["business:biz-1", "follow-biz-1"],
]);
const engagementsStore = new Map([
  ["like:service:svc-1", "like-svc-1"],
]);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);
  const method = request.method ?? "GET";

  // CORS headers
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-request-id, x-correlation-id, x-workspace-id");

  if (method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  // Health checks
  if (pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ status: "ok", app: "qooqnos", version: "0.1.0" }));
    return;
  }

  if (pathname === "/ready") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ database: "ok", migrationRegistry: "ok" }));
    return;
  }

  // API endpoints
  if (pathname.startsWith("/api/v1/")) {
    const workspaceId = request.headers["x-workspace-id"] || "ws-phoenix-1";

    let bodyData = null;
    if (method === "POST" || method === "PATCH" || method === "PUT") {
      try {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const text = Buffer.concat(chunks).toString("utf-8");
        if (text) bodyData = JSON.parse(text);
      } catch {
        // invalid JSON
      }
    }

    if (pathname === "/api/v1/session") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        session: {
          authenticated: true,
          actorId: "usr-phoenix-default",
          tenantId: "tnt-phoenix-default",
          workspaceId,
          locale: "fa",
        },
      }));
      return;
    }

    if (pathname === "/api/v1/context") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        actorId: "usr-phoenix-default",
        tenantId: "tnt-phoenix-default",
        workspaceId,
        authenticated: true,
        roles: ["admin", "seller", "customer"],
        permissions: ["context:read", "business.profile.read", "business.profile.update", "booking.read", "booking.manage", "crm.read", "customer.read", "catalog.offer.create", "catalog.offer.publish", "catalog.offer.update", "analytics.read", "team.manage"],
      }));
      return;
    }

    if (pathname === "/api/v1/workspaces") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        data: [
          { id: "ws-phoenix-1", organizationId: "tnt-phoenix-default", name: "ققنوس - فضای کاری اصلی", status: "active" },
          { id: "ws-phoenix-2", organizationId: "tnt-phoenix-default", name: "ققنوس - شعبه فناوری", status: "active" },
        ],
        currentWorkspaceId: workspaceId,
      }));
      return;
    }

    if (pathname === `/api/v1/workspaces/${workspaceId}/members` || pathname.startsWith("/api/v1/workspaces/")) {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        data: [{ id: "mem-1", userId: "usr-phoenix-default", status: "active", role: "admin" }],
      }));
      return;
    }

    if (pathname === "/api/v1/notifications") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        data: [
          {
            id: "ntf-1",
            intent: "booking.confirmed",
            channel: "in_app",
            priority: "high",
            status: "delivered",
            createdAt: new Date().toISOString(),
            variables: { title: "به پلتفرم هوشمند ققنوس خوش آمدید" },
          },
        ],
      }));
      return;
    }

    if (pathname === "/api/v1/business-access") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        status: "authorized",
        tenantId: "tnt-phoenix-default",
        workspaceId,
      }));
      return;
    }

    if (pathname === "/api/v1/social/state") {
      const follows = [];
      for (const [key, id] of followsStore.entries()) {
        const [targetType, targetId] = key.split(":");
        follows.push({ id, targetType, targetId });
      }
      const engagements = [];
      for (const [key, id] of engagementsStore.entries()) {
        const [engagementType, targetType, targetId] = key.split(":");
        engagements.push({ id, targetType, targetId, engagementType });
      }
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: { follows, engagements } }));
      return;
    }

    if (pathname === "/api/v1/social/activity") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        data: [
          {
            id: "act-1",
            eventType: "social.like.created",
            targetType: "service",
            targetId: "svc-1",
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: "act-2",
            eventType: "social.follow.created",
            targetType: "business",
            targetId: "biz-1",
            createdAt: new Date(Date.now() - 7200000).toISOString(),
          },
        ],
      }));
      return;
    }

    if (pathname.startsWith("/api/v1/social/likes") || pathname.startsWith("/api/v1/social/saves")) {
      const isLike = pathname.startsWith("/api/v1/social/likes");
      const actionType = isLike ? "like" : "save";
      if (method === "POST") {
        const newId = crypto.randomUUID();
        if (bodyData?.targetType && bodyData?.targetId) {
          engagementsStore.set(`${actionType}:${bodyData.targetType}:${bodyData.targetId}`, newId);
        }
        response.writeHead(201, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ data: { id: newId } }));
        return;
      }
      if (method === "DELETE") {
        const idToDelete = pathname.split("/").pop();
        for (const [key, id] of engagementsStore.entries()) {
          if (id === idToDelete) engagementsStore.delete(key);
        }
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ data: { deleted: true } }));
        return;
      }
    }

    if (pathname.startsWith("/api/v1/social/follows")) {
      if (method === "POST") {
        const newId = crypto.randomUUID();
        if (bodyData?.targetId) {
          followsStore.set(`business:${bodyData.targetId}`, newId);
        }
        response.writeHead(201, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ data: { id: newId } }));
        return;
      }
      if (method === "DELETE") {
        const idToDelete = pathname.split("/").pop();
        for (const [key, id] of followsStore.entries()) {
          if (id === idToDelete) followsStore.delete(key);
        }
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ data: { deleted: true } }));
        return;
      }
    }

    if (pathname.startsWith("/api/v1/commerce/orders")) {
      const orderId = pathname.replace("/api/v1/commerce/orders", "").replace(/^\//, "");
      const sampleOrders = [
        {
          id: "PHX-ORD-9021",
          status: "processing",
          currency: "IRR",
          subtotalMinor: 4500000,
          grandTotalMinor: 4500000,
          trackingNumber: "TRK-98214432-IR",
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          estimatedDelivery: new Date(Date.now() + 172800000).toISOString(),
          customer: { name: "کاربر ققنوس", phone: "09120000000", address: "تهران، سعادت‌آباد، خیابان سرو غربی، پلاک ۱۴" },
          items: [
            { id: "item-1", descriptionSnapshot: "خدمات مشاوره تخصصی کسب‌وکار و رشد", quantity: 1, unitPriceMinorSnapshot: 4500000, resourceId: "svc-1" }
          ],
        },
        {
          id: "PHX-ORD-8840",
          status: "completed",
          currency: "IRR",
          subtotalMinor: 12000000,
          grandTotalMinor: 12000000,
          trackingNumber: "TRK-77192301-IR",
          createdAt: new Date(Date.now() - 345600000).toISOString(),
          estimatedDelivery: new Date(Date.now() - 86400000).toISOString(),
          customer: { name: "کاربر ققنوس", phone: "09120000000", address: "تهران، ونک، خیابان ملاصدرا" },
          items: [
            { id: "item-2", descriptionSnapshot: "بسته ابری هوش سازمانی ققنوس", quantity: 1, unitPriceMinorSnapshot: 12000000, resourceId: "prod-1" }
          ],
        },
        {
          id: "PHX-ORD-7612",
          status: "delivered",
          currency: "IRR",
          subtotalMinor: 7800000,
          grandTotalMinor: 7800000,
          trackingNumber: "TRK-55410982-IR",
          createdAt: new Date(Date.now() - 604800000).toISOString(),
          estimatedDelivery: new Date(Date.now() - 259200000).toISOString(),
          customer: { name: "کاربر ققنوس", phone: "09120000000", address: "شیراز، خیابان ارم" },
          items: [
            { id: "item-4", descriptionSnapshot: "طراحی و توسعه تجربه کاربری اختصاصی", quantity: 1, unitPriceMinorSnapshot: 7800000, resourceId: "svc-2" }
          ],
        },
      ];

      if (orderId) {
        const found = sampleOrders.find((o) => o.id === orderId) || {
          id: orderId,
          status: "completed",
          currency: "IRR",
          subtotalMinor: 5000000,
          grandTotalMinor: 5000000,
          createdAt: new Date().toISOString(),
          items: [{ id: "line-1", descriptionSnapshot: "محصول سفارشی ققنوس", quantity: 1, unitPriceMinorSnapshot: 5000000, resourceId: "res-1" }],
        };
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ data: { order: found, lines: found.items } }));
        return;
      }

      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: sampleOrders, pagination: { count: sampleOrders.length, limit: 20, offset: 0 } }));
      return;
    }

    if (pathname.startsWith("/api/v1/communications/conversations")) {
      const sampleThreads = [
        {
          id: "conv-1",
          peerName: "پشتیبانی هوشمند ققنوس",
          peerRole: "سیستم هوشمند",
          lastMessage: "سلام! چطور می‌توانم در انتخاب خدمات یا سفارش به شما کمک کنم؟",
          updatedAt: new Date(Date.now() - 1800000).toISOString(),
          unreadCount: 1,
          messages: [
            { id: "m-1", sender: "peer", text: "به پشتیبانی ققنوس خوش آمدید.", time: "۱۰:۳۰" },
            { id: "m-2", sender: "user", text: "سلام، درباره نحوه رزرو وقت مشاوره سؤال داشتم.", time: "۱۰:۳۲" },
            { id: "m-3", sender: "peer", text: "سلام! چطور می‌توانم در انتخاب خدمات یا سفارش به شما کمک کنم؟", time: "۱۰:۳۳" },
          ],
        },
        {
          id: "conv-2",
          peerName: "مرکز فناوری و نوآوری ققنوس",
          peerRole: "فروشنده تأییدشده",
          lastMessage: "زمان تحویل بسته ابری حداکثر ظرف ۲۴ ساعت فعال خواهد شد.",
          updatedAt: new Date(Date.now() - 7200000).toISOString(),
          unreadCount: 0,
          messages: [
            { id: "m-20", sender: "user", text: "سلام، لایسنس بسته ابری چه زمانی تحویل داده می‌شود؟", time: "دیروز" },
            { id: "m-21", sender: "peer", text: "زمان تحویل بسته ابری حداکثر ظرف ۲۴ ساعت فعال خواهد شد.", time: "دیروز" },
          ],
        },
      ];

      if (method === "POST") {
        response.writeHead(201, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ data: { id: "msg-" + Date.now(), status: "sent", createdAt: new Date().toISOString() } }));
        return;
      }

      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: sampleThreads }));
      return;
    }

    if (pathname === "/api/v1/discovery/search" || pathname === "/api/v1/discovery/following") {
      const q = url.searchParams.get("q")?.toLowerCase();
      let filtered = sampleDiscoveryItems;
      if (q) {
        filtered = sampleDiscoveryItems.filter((i) =>
          (i.title && i.title.toLowerCase().includes(q)) ||
          (i.description && i.description.toLowerCase().includes(q)) ||
          (i.city && i.city.toLowerCase().includes(q)) ||
          (i.locality && i.locality.toLowerCase().includes(q))
        );
      }
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        data: filtered,
        pagination: { count: filtered.length, limit: 20, offset: 0 },
      }));
      return;
    }

    if (pathname.startsWith("/api/v1/ai/seller/product-creation-sessions")) {
      const sessionId = "seller-session-1";
      if (pathname.endsWith("/run")) {
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({
          data: {
            status: "succeeded",
            retryable: false,
            usage: { inputTokens: 120, outputTokens: 80, providerUnits: 25 },
            output: {
              product: {
                name: "محصول هوشمند ققنوس",
                description: "پیش‌نویس مشخصات محصول تحلیل‌شده با موتور هوش مصنوعی ققنوس.",
                category: "فناوری و نرم‌افزار",
                price: 8500000,
              },
            },
          },
        }));
        return;
      }
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        session: { id: sessionId, currentDraftVersion: 1 },
        draft: { product: { name: { value: "پیش‌نویس محصول ققنوس" } } },
        accepted: true,
        reviewed: true,
        confirmed: true,
      }));
      return;
    }

    // Default fallback for any other API route
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ data: [], status: "ok" }));
    return;
  }

  // Static file serving from apps/web/public
  const requestedPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let safePath = normalize(join(root, requestedPath));

  if (!safePath.startsWith(root)) {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }

  if (!existsSync(safePath) || !statSync(safePath).isFile()) {
    if (requestedPath.includes(".")) {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }
    // SPA fallback
    safePath = join(root, "index.html");
  }

  const extension = safePath.slice(safePath.lastIndexOf("."));
  response.setHeader("content-type", mime.get(extension) ?? "application/octet-stream");
  createReadStream(safePath).pipe(response);
});

server.listen(port, host, () => {
  process.stdout.write(`Phoenix Intelligence server running on http://${host}:${port}\n`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
