import { describe, expect, it } from "vitest";
import {
  renderBuyerDashboardView,
  renderBuyerProfileView,
  renderOrderTrackingCard,
  renderOrderTrackingTimelineView,
  type BuyerOrderSummary,
  type BuyerProfileData,
} from "./buyer-experience";
import { globalLocaleService } from "./locale-service";

describe("Phases 5, 6, 7: Buyer Profile, Dashboard & Order Tracking", () => {
  const sampleProfile: BuyerProfileData = {
    id: "cust-1",
    name: "سارا رضایی",
    username: "sara_r",
    bio: "علاقه‌مند به صنایع دستی و کتاب",
    interests: ["صنایع دستی", "کتاب و نشر", "سلامت"],
    followingCount: 4,
    savedCount: 12,
    ordersCount: 3,
    privacy: {
      profileVisibility: "public",
      activityTracking: true,
      personalizationEnabled: true,
      searchHistoryEnabled: true,
      marketingConsent: false,
    },
    preferences: {
      currency: "IRR",
      preferredCategories: ["صنایع دستی"],
    },
  };

  const sampleOrders: BuyerOrderSummary[] = [
    {
      id: "ord-101",
      state: "out_for_delivery",
      businessName: "فروشگاه ترنج",
      itemCount: 2,
      firstItemTitle: "گلدان میناکاری دست‌ساز",
      grandTotalMinor: 2500000,
      currency: "IRR",
      createdAt: "2026-10-05T10:00:00Z",
      trackingNumber: "TRK-987654321",
      carrierName: "پست پیشتاز",
      etaDate: "2026-10-06T15:00:00Z",
      latestUpdate: "بسته در دست مأمور توزیع است",
    },
    {
      id: "ord-102",
      state: "delivered",
      businessName: "کتابفروشی حکمت",
      itemCount: 1,
      firstItemTitle: "دیوان حافظ نفیس",
      grandTotalMinor: 850000,
      currency: "IRR",
      createdAt: "2026-10-01T12:00:00Z",
      trackingNumber: "TRK-11223344",
      carrierName: "پست ویژه",
      latestUpdate: "تحویل به خریدار شد",
    },
  ];

  it("enforces strict Buyer Dashboard hierarchy: Active Orders before Discovery", () => {
    globalLocaleService.setLocale("fa");
    const html = renderBuyerDashboardView({
      profile: sampleProfile,
      orders: sampleOrders,
      recentActivity: [
        { id: "act-1", title: "ورود به حساب کاربری", time: "۱۰ دقیقه پیش", type: "auth" },
      ],
      recommendedOfferings: [
        { id: "rec-1", title: "بشقاب میناکاری اصفهان", price: 1200000, category: "صنایع دستی", rating: 4.8 },
      ],
    });

    // Verify Active Orders appears before Discovery in the generated HTML
    const activeOrderPos = html.indexOf("سفارش‌های فعال شما");
    const discoveryPos = html.indexOf("پیشنهادهای کشف و خرید مجدد");
    expect(activeOrderPos).toBeGreaterThan(-1);
    expect(discoveryPos).toBeGreaterThan(-1);
    expect(activeOrderPos).toBeLessThan(discoveryPos);

    // Verify active order details are rendered
    expect(html).toContain("ord-101");
    expect(html).toContain("فروشگاه ترنج");
    expect(html).toContain("TRK-987654321");
  });

  it("renders Buyer Profile with preferences, stats, and privacy controls", () => {
    const profileHtml = renderBuyerProfileView({
      profile: sampleProfile,
      orders: sampleOrders,
      savedCount: 12,
    });

    expect(profileHtml).toContain("سارا رضایی");
    expect(profileHtml).toContain("@sara_r");
    expect(profileHtml).toContain("صنایع دستی");
    expect(profileHtml).toContain("کنترل‌های حریم خصوصی خریدار");
    expect(profileHtml).toContain("شخصی‌سازی هوشمند پیشنهادها");
  });

  it("renders order tracking card and interactive timeline drawer", () => {
    const targetOrder = sampleOrders[0];
    if (!targetOrder) throw new Error("Missing sample order");
    const cardHtml = renderOrderTrackingCard(targetOrder, "fa");
    expect(cardHtml).toContain("TRK-987654321");
    expect(cardHtml).toContain("رهگیری گام‌به‌گام");

    const timelineHtml = renderOrderTrackingTimelineView({
      orderId: "ord-101",
      businessName: "فروشگاه ترنج",
      state: "out_for_delivery",
      trackingNumber: "TRK-987654321",
      carrierName: "پست پیشتاز",
      eta: "2026-10-06T15:00:00Z",
      grandTotal: 2500000,
      currency: "IRR",
      items: [{ title: "گلدان میناکاری دست‌ساز", quantity: 2, unitPrice: 1250000 }],
      timelineSteps: [
        { id: "s1", label: "ثبت سفارش", status: "completed" },
        { id: "s2", label: "تأیید فروشنده", status: "completed" },
        { id: "s3", label: "آماده‌سازی", status: "completed" },
        { id: "s4", label: "تحویل به حامل", status: "completed" },
        { id: "s5", label: "در مسیر تحویل", status: "current" },
        { id: "s6", label: "تحویل به خریدار", status: "upcoming" },
      ],
    });

    expect(timelineHtml).toContain("رهگیری سفارش");
    expect(timelineHtml).toContain("TRK-987654321");
    expect(timelineHtml).toContain("پست پیشتاز");
    expect(timelineHtml).toContain("ds-timeline-current");
  });
});
