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

// ============================================================================
// Phoenix 3-Tier Account & Store Mock Data Stores
// ============================================================================
const accountStore = {
  id: "usr-me",
  mobile: "09123456789",
  displayName: "سارا احمدی",
  nationalCode: "0012345678",
  tier: "base",
  corporateVerificationStatus: "none",
  corporateProfile: null,
  addresses: [
    {
      id: "addr-1",
      title: "خانه",
      streetLine1: "تهران، سعادت‌آباد، خیابان سرو غربی، پلاک ۱۴، واحد ۳",
      postalCode: "1998877665",
      city: "تهران",
      province: "تهران",
      isDefault: true,
    },
    {
      id: "addr-2",
      title: "محل کار",
      streetLine1: "تهران، میدان ونک، خیابان ملاصدرا، برج فناوری ققنوس، طبقه ۵",
      postalCode: "1994433221",
      city: "تهران",
      province: "تهران",
      isDefault: false,
    },
  ],
  storeInfo: {
    name: "فروشگاه مرکزی ققنوس",
    description: "ارائه‌دهنده رسمی تجهیزات، خدمات و بسته‌های ابری هوش تجاری در پلتفرم ققنوس",
    address: "تهران، میدان ونک، برج فناوری ققنوس، واحد ۲۰۴",
    phone: "02188776655",
    sheba: "IR120000000000000000000001",
  },
  wishlist: ["prod-phys-1", "prod-digi-1"],
};

const storeProductsStore = [
  {
    id: "prod-phys-1",
    sellerId: "seller-me",
    title: "دستگاه هوشمند پوز ققنوس (پایانه فروشگاهی)",
    description: "پایانه فروشگاهی با قابلیت اتصال بی‌سیم به حساب بانکی، پردازش تراکنش و صدور فاکتور رسمی.",
    type: "physical",
    basePriceMinor: 4800000,
    inventory: 35,
    images: ["/phoenix-mark.svg"],
    status: "published",
    rolePrices: { vip: 4300000, tier_1_agent: 3900000, tier_2_agent: 3600000, tier_3_agent: 3300000 },
    tieredPrices: [
      { minQty: 1, maxQty: 4, priceAmountMinor: 4800000 },
      { minQty: 5, maxQty: 19, priceAmountMinor: 4200000 },
      { minQty: 20, maxQty: null, priceAmountMinor: 3800000 },
      { minQty: 10, maxQty: 50, priceAmountMinor: 3200000, buyerRole: "tier_1_agent" },
    ],
    createdAt: new Date(Date.now() - 604800000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "prod-digi-1",
    sellerId: "seller-me",
    title: "بسته داده و لایسنس نرم‌افزار هوش تجاری ققنوس",
    description: "فایل دیجیتال نصبی و کلید فعال‌سازی سالانه با تحویل آنی پس از پرداخت.",
    type: "digital",
    basePriceMinor: 2500000,
    inventory: 999,
    downloadUrl: "https://qooqnos.com/downloads/phoenix-bi-suite.zip",
    images: ["/phoenix-mark.svg"],
    status: "published",
    rolePrices: { vip: 2200000, tier_1_agent: 1800000 },
    createdAt: new Date(Date.now() - 504800000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "prod-svc-1",
    sellerId: "seller-me",
    title: "مشاوره تخصصی بازاریابی و بهینه‌سازی فروشگاه",
    description: "جلسه اختصاصی آنلاین ۹۰ دقیقه‌ای با کارشناس رشد پلتفرم ققنوس.",
    type: "service",
    basePriceMinor: 1500000,
    inventory: 12,
    serviceDurationMinutes: 90,
    images: ["/phoenix-mark.svg"],
    status: "published",
    rolePrices: { vip: 1200000 },
    createdAt: new Date(Date.now() - 404800000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "prod-var-1",
    sellerId: "seller-me",
    title: "پک تجهیزات برندینگ سازمانی ققنوس (متغیر)",
    description: "محصول متغیر شامل پیراهن، ماگ و استند با تنوع سایز و رنگ‌بندی سازمانی.",
    type: "variable",
    basePriceMinor: 890000,
    inventory: 80,
    variableAttributes: [
      { name: "رنگ", options: ["مشکی سازمانی", "نارنجی ققنوس", "سفید"] },
      { name: "سایز", options: ["متوسط (M)", "بزرگ (L)", "خیلی بزرگ (XL)"] },
    ],
    images: ["/phoenix-mark.svg"],
    status: "published",
    rolePrices: { vip: 790000, tier_1_agent: 690000 },
    tieredPrices: [{ minQty: 10, maxQty: null, priceAmountMinor: 650000 }],
    createdAt: new Date(Date.now() - 304800000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const storeCustomersStore = new Map([
  ["buyer-101", { buyerId: "buyer-101", buyerName: "محمدرضا کاظمی", buyerMobile: "09121112233", role: "vip", notes: "مشتری منظم، پرداخت‌ها سر وقت انجام می‌شود.", ordersCount: 4, totalSpentMinor: 14500000, lastOrderDate: "۱۴۰۳/۰۷/۱۰" }],
  ["buyer-102", { buyerId: "buyer-102", buyerName: "فروشگاه عصر ارتباط", buyerMobile: "09359876543", role: "tier_1_agent", notes: "نماینده انحصاری توزیع پایانه‌های فروشگاهی در منطقه شرق.", ordersCount: 12, totalSpentMinor: 48000000, lastOrderDate: "۱۴۰۳/۰۷/۱۵" }],
  ["buyer-103", { buyerId: "buyer-103", buyerName: "مهرداد صادقی", buyerMobile: "09195556677", role: "regular", notes: "ثبت سفارش اول با تخفیف خوش‌آمدگویی.", ordersCount: 1, totalSpentMinor: 2500000, lastOrderDate: "۱۴۰۳/۰۷/۱۸" }],
]);

const storeDiscountsStore = [
  {
    id: "disc-fall-20",
    sellerId: "seller-me",
    productIds: ["prod-phys-1", "prod-digi-1"],
    discountType: "percentage",
    value: 15,
    startDate: new Date(Date.now() - 86400000 * 5).toISOString(),
    endDate: new Date(Date.now() + 86400000 * 15).toISOString(),
    maxUses: 200,
    usedCount: 28,
    minOrderAmount: 2000000,
  },
];

const accountOrdersStore = [
  {
    id: "PHX-ORD-9421",
    buyerId: "usr-me",
    buyerName: "سارا احمدی",
    buyerMobile: "09123456789",
    buyerNationalCode: "0012345678",
    sellerId: "seller-me",
    sellerName: "فروشگاه مرکزی ققنوس",
    status: "processing",
    trackingNumber: "TRK-98214432-IR",
    currency: "تومان",
    subtotalMinor: 4800000,
    discountMinor: 0,
    grandTotalMinor: 4800000,
    shippingAddress: {
      id: "addr-1",
      title: "خانه",
      streetLine1: "تهران، سعادت‌آباد، خیابان سرو غربی، پلاک ۱۴، واحد ۳",
      postalCode: "1998877665",
      city: "تهران",
      province: "تهران",
      isDefault: true,
    },
    items: [
      {
        productId: "prod-phys-1",
        productTitle: "دستگاه هوشمند پوز ققنوس (پایانه فروشگاهی)",
        productType: "physical",
        quantity: 1,
        unitPriceMinor: 4800000,
        originalUnitPriceMinor: 4800000,
        appliedRule: "قیمت پایه",
        lineTotalMinor: 4800000,
      },
    ],
    invoiceNumber: "INV-1403-9421",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    estimatedDelivery: new Date(Date.now() + 172800000).toISOString(),
  },
  {
    id: "PHX-ORD-8812",
    buyerId: "usr-me",
    buyerName: "سارا احمدی",
    buyerMobile: "09123456789",
    buyerNationalCode: "0012345678",
    sellerId: "seller-me",
    sellerName: "فروشگاه مرکزی ققنوس",
    status: "delivered",
    trackingNumber: "TRK-77192301-IR",
    currency: "تومان",
    subtotalMinor: 2500000,
    discountMinor: 250000,
    grandTotalMinor: 2250000,
    shippingAddress: {
      id: "addr-1",
      title: "خانه",
      streetLine1: "تهران، سعادت‌آباد، خیابان سرو غربی، پلاک ۱۴، واحد ۳",
      postalCode: "1998877665",
      city: "تهران",
      province: "تهران",
      isDefault: true,
    },
    items: [
      {
        productId: "prod-digi-1",
        productTitle: "بسته داده و لایسنس نرم‌افزار هوش تجاری ققنوس",
        productType: "digital",
        quantity: 1,
        unitPriceMinor: 2250000,
        originalUnitPriceMinor: 2500000,
        appliedRule: "تخفیف زمان‌دار ۱۰٪",
        lineTotalMinor: 2250000,
      },
    ],
    invoiceNumber: "INV-1403-8812",
    createdAt: new Date(Date.now() - 345600000).toISOString(),
    estimatedDelivery: new Date(Date.now() - 86400000).toISOString(),
  },
];

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

    // ------------------------------------------------------------------------
    // Account Endpoints (Level 1, 2, 3)
    // ------------------------------------------------------------------------
    if (pathname === "/api/v1/account" && method === "GET") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: accountStore }));
      return;
    }

    if (pathname === "/api/v1/account" && method === "PATCH") {
      if (bodyData?.displayName) accountStore.displayName = String(bodyData.displayName).trim();
      if (bodyData?.nationalCode) accountStore.nationalCode = String(bodyData.nationalCode).trim();
      if (bodyData?.mobile) accountStore.mobile = String(bodyData.mobile).trim();
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: accountStore }));
      return;
    }

    if (pathname === "/api/v1/account/addresses" && method === "GET") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: accountStore.addresses }));
      return;
    }

    if (pathname === "/api/v1/account/addresses" && method === "POST") {
      const newAddr = {
        id: "addr-" + Date.now(),
        title: bodyData?.title || "نشانی جدید",
        streetLine1: bodyData?.streetLine1 || "",
        postalCode: bodyData?.postalCode || "",
        city: bodyData?.city || "تهران",
        province: bodyData?.province || "تهران",
        isDefault: Boolean(bodyData?.isDefault),
      };
      if (newAddr.isDefault) {
        accountStore.addresses.forEach((a) => (a.isDefault = false));
      }
      accountStore.addresses.unshift(newAddr);
      response.writeHead(201, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: newAddr }));
      return;
    }

    if (pathname.startsWith("/api/v1/account/addresses/") && method === "DELETE") {
      const addrId = pathname.split("/").pop();
      accountStore.addresses = accountStore.addresses.filter((a) => a.id !== addrId);
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: { deleted: true } }));
      return;
    }

    // Tier Upgrade: Level 2 (Seller)
    if (pathname === "/api/v1/account/upgrade-seller" && method === "POST") {
      accountStore.tier = "seller";
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: { success: true, tier: "seller", message: "فروشندگی با موفقیت به حساب شما اضافه شد." } }));
      return;
    }

    // Tier Upgrade: Level 3 (Corporate Seller)
    if (pathname === "/api/v1/account/upgrade-corporate" && method === "POST") {
      const companyName = String(bodyData?.companyName || "").trim();
      const registrationNumber = String(bodyData?.registrationNumber || "").trim();
      if (!companyName || !registrationNumber) {
        response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: { code: "VALIDATION_ERROR", message: "نام شرکت و شماره ثبت الزامی است." } }));
        return;
      }
      accountStore.tier = "corporate_seller";
      accountStore.corporateVerificationStatus = "pending_review";
      accountStore.corporateProfile = {
        companyName,
        registrationNumber,
        economicCode: bodyData?.economicCode || null,
        nationalId: bodyData?.nationalId || null,
        documents: bodyData?.documents || [],
        rejectionReason: null,
      };
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: { success: true, tier: "corporate_seller", status: "pending_review" } }));
      return;
    }

    // Admin Verification Review (Level 3)
    if (pathname === "/api/v1/account/admin-verify-corporate" && method === "POST") {
      const status = bodyData?.status === "approved" ? "approved" : "rejected";
      const reason = bodyData?.reason || null;
      accountStore.corporateVerificationStatus = status;
      if (accountStore.corporateProfile) {
        accountStore.corporateProfile.rejectionReason = reason;
      }
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: { status, reason } }));
      return;
    }

    // ------------------------------------------------------------------------
    // Store Endpoints (Level 2 & Level 3)
    // ------------------------------------------------------------------------
    if (pathname === "/api/v1/store/info" && method === "GET") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: accountStore.storeInfo }));
      return;
    }

    if (pathname === "/api/v1/store/info" && method === "PATCH") {
      if (bodyData) Object.assign(accountStore.storeInfo, bodyData);
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: accountStore.storeInfo }));
      return;
    }

    if (pathname === "/api/v1/store/products" && method === "GET") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: storeProductsStore }));
      return;
    }

    if (pathname === "/api/v1/store/products" && method === "POST") {
      const newProduct = {
        id: "prod-" + Date.now(),
        sellerId: "seller-me",
        title: bodyData?.title || "محصول جدید",
        description: bodyData?.description || "",
        type: bodyData?.type || "physical",
        basePriceMinor: Number(bodyData?.basePriceMinor || 0),
        inventory: Number(bodyData?.inventory || 0),
        images: bodyData?.images || ["/phoenix-mark.svg"],
        status: bodyData?.status || "published",
        downloadUrl: bodyData?.downloadUrl || undefined,
        serviceDurationMinutes: bodyData?.serviceDurationMinutes || undefined,
        variableAttributes: bodyData?.variableAttributes || undefined,
        rolePrices: bodyData?.rolePrices || undefined,
        tieredPrices: bodyData?.tieredPrices || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      storeProductsStore.unshift(newProduct);
      response.writeHead(201, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: newProduct }));
      return;
    }

    if (pathname.startsWith("/api/v1/store/products/") && method === "PATCH") {
      const prodId = pathname.split("/").pop();
      const p = storeProductsStore.find((item) => item.id === prodId);
      if (!p) {
        response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "محصول یافت نشد." } }));
        return;
      }
      if (bodyData) {
        Object.assign(p, bodyData, { updatedAt: new Date().toISOString() });
      }
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: p }));
      return;
    }

    if (pathname === "/api/v1/store/customers" && method === "GET") {
      const list = Array.from(storeCustomersStore.values());
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: list }));
      return;
    }

    if (pathname.startsWith("/api/v1/store/customers/") && pathname.endsWith("/role") && method === "PATCH") {
      const buyerId = pathname.replace("/api/v1/store/customers/", "").replace("/role", "");
      const role = bodyData?.role || "regular";
      const notes = bodyData?.notes;
      const current = storeCustomersStore.get(buyerId) || {
        buyerId,
        buyerName: "خریدار",
        buyerMobile: "09120000000",
        ordersCount: 1,
        totalSpentMinor: 0,
      };
      current.role = role;
      if (notes !== undefined) current.notes = notes;
      storeCustomersStore.set(buyerId, current);
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: current }));
      return;
    }

    if (pathname === "/api/v1/store/discounts" && method === "GET") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: storeDiscountsStore }));
      return;
    }

    if (pathname === "/api/v1/store/discounts" && method === "POST") {
      const newDisc = {
        id: "disc-" + Date.now(),
        sellerId: "seller-me",
        productIds: bodyData?.productIds || [],
        discountType: bodyData?.discountType || "percentage",
        value: Number(bodyData?.value || 0),
        startDate: bodyData?.startDate || new Date().toISOString(),
        endDate: bodyData?.endDate || new Date(Date.now() + 86400000 * 30).toISOString(),
        maxUses: bodyData?.maxUses ? Number(bodyData.maxUses) : null,
        usedCount: 0,
        minOrderAmount: bodyData?.minOrderAmount ? Number(bodyData.minOrderAmount) : null,
      };
      storeDiscountsStore.unshift(newDisc);
      response.writeHead(201, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ data: newDisc }));
      return;
    }

    // Pricing Engine Calculate API
    if (pathname === "/api/v1/commerce/calculate-price" && method === "POST") {
      const { productId, quantity = 1, buyerRole = null } = bodyData || {};
      const prod = storeProductsStore.find((p) => p.id === productId);
      if (!prod) {
        response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "محصول یافت نشد." } }));
        return;
      }

      let effectivePrice = prod.basePriceMinor;
      let appliedRule = "base";

      // 1. Role tier
      if (buyerRole && prod.tieredPrices) {
        const match = prod.tieredPrices.find((t) => t.buyerRole === buyerRole && quantity >= t.minQty && quantity <= (t.maxQty ?? Infinity));
        if (match) {
          effectivePrice = match.priceAmountMinor;
          appliedRule = "role_tier";
        }
      }

      // 2. Role base
      if (appliedRule === "base" && buyerRole && prod.rolePrices && prod.rolePrices[buyerRole]) {
        effectivePrice = prod.rolePrices[buyerRole];
        appliedRule = "role_base";
      }

      // 3. General quantity tier
      if (appliedRule === "base" && prod.tieredPrices) {
        const match = prod.tieredPrices.find((t) => !t.buyerRole && quantity >= t.minQty && quantity <= (t.maxQty ?? Infinity));
        if (match) {
          effectivePrice = match.priceAmountMinor;
          appliedRule = "quantity_tier";
        }
      }

      // 4. Timed discounts
      const nowIso = new Date().toISOString();
      let discountAmount = 0;
      let appliedDiscountId = null;
      for (const d of storeDiscountsStore) {
        if (d.productIds.length > 0 && !d.productIds.includes(productId)) continue;
        if (d.startDate && nowIso < d.startDate) continue;
        if (d.endDate && nowIso > d.endDate) continue;
        if (d.maxUses && d.usedCount >= d.maxUses) continue;
        const candidateDisc = d.discountType === "percentage" ? Math.round((effectivePrice * d.value) / 100) : Math.min(effectivePrice, d.value);
        if (candidateDisc > discountAmount) {
          discountAmount = candidateDisc;
          appliedDiscountId = d.id;
        }
      }

      const finalPrice = Math.max(0, effectivePrice - discountAmount);
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        data: {
          productId,
          quantity,
          buyerRole,
          originalUnitPriceMinor: effectivePrice,
          unitPriceMinor: finalPrice,
          discountMinorPerUnit: discountAmount,
          appliedDiscountId,
          pricingRuleApplied: appliedRule,
          lineTotalMinor: finalPrice * quantity,
        },
      }));
      return;
    }

    if (pathname === "/api/v1/auth/otp/request" && method === "POST") {
      const mobile = String(bodyData?.mobile || "");
      const cleanMobile = mobile.replace(/\D/g, "");
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        data: {
          success: true,
          mobile: cleanMobile,
          devCode: "123456",
          expiresInSeconds: 120,
        },
      }));
      return;
    }

    if (pathname === "/api/v1/auth/otp/verify" && method === "POST") {
      const rawCode = String(bodyData?.code ?? "").trim();
      const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
      const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
      let cleanCode = rawCode;
      for (let i = 0; i < 10; i++) {
        cleanCode = cleanCode.replaceAll(persianDigits[i], String(i)).replaceAll(arabicDigits[i], String(i));
      }

      if (!/^\d+$/.test(cleanCode)) {
        response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "کد تأیید باید فقط شامل اعداد باشد.",
            details: { field: "code", reason: "numeric_only" },
          },
        }));
        return;
      }

      if (cleanCode.length !== 6) {
        response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "کد تأیید باید دقیقاً ۶ رقم باشد.",
            details: { field: "code", reason: "exact_length_6", currentLength: cleanCode.length },
          },
        }));
        return;
      }

      const mobile = String(bodyData?.mobile || "09120000000");
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        data: {
          authenticated: true,
          accessToken: "tok-phx-" + Date.now(),
          isNewUser: false,
          user: {
            id: "usr-" + mobile.slice(-4),
            mobile,
            displayName: "کاربر ققنوس",
            role: "buyer",
          },
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
  response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  if (requestedPath === "sw.js") {
    response.setHeader("Service-Worker-Allowed", "/");
  }
  createReadStream(safePath).pipe(response);
});

server.listen(port, host, () => {
  process.stdout.write(`Phoenix Intelligence server running on http://${host}:${port}\n`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
