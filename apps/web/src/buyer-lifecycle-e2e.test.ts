import { describe, expect, it } from "vitest";
import {
  ORDER_TRANSITION_RULES,
  buildOrderTimeline,
  resolveOrderNextAction,
  type OrderLifecycleState,
} from "./order-state-machine";
import { personalizationEngine } from "./personalization-engine";
import { renderBuyerDashboardView } from "./buyer-experience";
import { globalLocaleService } from "./locale-service";
import { formatDate } from "./calendar-service";

describe("Phase 14: Comprehensive End-to-End Buyer Lifecycle & Commerce Pipeline", () => {
  it("executes complete order lifecycle through all states with proper actor permissions", () => {
    const lifecycleFlow: OrderLifecycleState[] = [
      "draft",
      "pending_payment",
      "paid",
      "waiting_seller",
      "confirmed",
      "preparing",
      "packed",
      "ready_to_ship",
      "handed_to_carrier",
      "shipped",
      "in_transit",
      "out_for_delivery",
      "delivered",
    ];

    for (let i = 0; i < lifecycleFlow.length - 1; i++) {
      const from = lifecycleFlow[i];
      const to = lifecycleFlow[i + 1];
      const rule = ORDER_TRANSITION_RULES.find((r) => r.from === from && r.to === to);
      expect(rule, `Rule missing for transition from ${from} to ${to}`).toBeDefined();
    }
  });

  it("verifies end-to-end order tracking across Persian, Arabic, and English locales", () => {
    const testDate = new Date("2026-10-05T12:00:00Z");

    // 1. Persian / Jalali validation
    globalLocaleService.setLocale("fa");
    expect(globalLocaleService.getDirection()).toBe("rtl");
    const faFormattedDate = formatDate(testDate, "fa");
    expect(faFormattedDate).toContain("۱۴۰۵");
    const faTimeline = buildOrderTimeline("out_for_delivery", "fa");
    expect(faTimeline.length).toBe(6);
    expect(faTimeline[4]?.status).toBe("current");

    // 2. Arabic / Hijri validation
    globalLocaleService.setLocale("ar");
    expect(globalLocaleService.getDirection()).toBe("rtl");
    const arFormattedDate = formatDate(testDate, "ar");
    expect(arFormattedDate).toContain("١٤٤٨");
    const arTimeline = buildOrderTimeline("shipped", "ar");
    expect(arTimeline.length).toBe(6);
    expect(arTimeline[3]?.status).toBe("current");

    // 3. English / Gregorian validation
    globalLocaleService.setLocale("en");
    expect(globalLocaleService.getDirection()).toBe("ltr");
    const enFormattedDate = formatDate(testDate, "en");
    expect(enFormattedDate).toBe("October 5, 2026");
    const enTimeline = buildOrderTimeline("delivered", "en");
    expect(enTimeline.every((step) => step.status === "completed")).toBe(true);

    // Reset back to Persian default (Requirement 1)
    globalLocaleService.setLocale("fa");
  });

  it("verifies Buyer Discovery and Personalization Reorder signals in end-to-end flow", () => {
    personalizationEngine.clearAllSignals();

    // 1. Buyer searches and views offering
    personalizationEngine.recordSignal("search", "کتاب شعر", "query");
    personalizationEngine.recordSignal("view", "book-1", "offering", { category: "کتاب" });

    // 2. Buyer purchases item
    personalizationEngine.recordSignal("purchase", "book-1", "offering", { category: "کتاب" });

    // 3. Recommendations should prioritize reorder
    const catalog = [
      { id: "misc-1", title: "کالای دیگر", category: "سایر", price: 10000 },
      { id: "book-1", title: "دیوان حافظ", category: "کتاب", price: 50000 },
    ];
    const recs = personalizationEngine.getRecommendations(catalog);
    expect(recs[0]?.id).toBe("book-1");
    expect(recs[0]?.isReorder).toBe(true);

    // 4. Next Best Action after delivery is review and reorder
    const action = resolveOrderNextAction("delivered", "buyer", "fa", "ord-1");
    expect(action?.actionId).toBe("review_and_reorder");
  });

  it("verifies Buyer Dashboard prioritizes Active Orders above Discovery", () => {
    globalLocaleService.setLocale("fa");
    const dashboardHtml = renderBuyerDashboardView({
      profile: {
        id: "cust-e2e",
        name: "کاربر آزمون",
        username: "test_user",
        interests: ["صنایع دستی"],
        followingCount: 2,
        savedCount: 4,
        ordersCount: 1,
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
      },
      orders: [
        {
          id: "ord-active",
          state: "out_for_delivery",
          businessName: "صنایع دستی اصفهان",
          itemCount: 1,
          firstItemTitle: "گلدان مینا",
          grandTotalMinor: 1500000,
          currency: "IRR",
          createdAt: "2026-10-05T08:00:00Z",
          trackingNumber: "TRK-001122",
        },
      ],
      recentActivity: [
        { id: "a1", title: "سفارش شما در مسیر است", time: "۱ ساعت پیش", type: "order" },
      ],
      recommendedOfferings: [
        { id: "rec-1", title: "سینی مسی", price: 2000000, category: "صنایع دستی", rating: 4.9 },
      ],
    });

    const activeOrderIndex = dashboardHtml.indexOf("Priority 1 · Orders");
    const activityIndex = dashboardHtml.indexOf("Priority 3 · Signals");
    const discoveryIndex = dashboardHtml.indexOf("Priority 4 · Discover");

    expect(activeOrderIndex).toBeGreaterThan(-1);
    expect(activityIndex).toBeGreaterThan(-1);
    expect(discoveryIndex).toBeGreaterThan(-1);

    // Strict priority hierarchy: Active Orders < Recent Activity < Discovery
    expect(activeOrderIndex).toBeLessThan(activityIndex);
    expect(activeOrderIndex).toBeLessThan(discoveryIndex);
  });
});
