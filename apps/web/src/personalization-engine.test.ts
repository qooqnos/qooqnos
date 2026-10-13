import { beforeEach, describe, expect, it } from "vitest";
import { personalizationEngine } from "./personalization-engine";

describe("Phases 8, 9, 10, 11: Personalization & Signal Engine", () => {
  beforeEach(() => {
    personalizationEngine.clearAllSignals();
    personalizationEngine.updatePrivacySettings({
      personalizationEnabled: true,
      searchHistoryEnabled: true,
      activityTrackingEnabled: true,
    });
  });

  it("records buyer activity signals (search, view, cart, purchase)", () => {
    personalizationEngine.recordSignal("search", "فرش دستباف", "query");
    personalizationEngine.recordSignal("view", "offering-1", "offering", { category: "صنایع دستی" });
    personalizationEngine.recordSignal("add_to_cart", "offering-1", "offering", { category: "صنایع دستی" });

    const history = personalizationEngine.getSearchHistory();
    expect(history).toContain("فرش دستباف");

    const recentViews = personalizationEngine.getRecentViews();
    expect(recentViews).toContain("offering-1");
  });

  it("calculates category affinity scores based on signal weights", () => {
    personalizationEngine.recordSignal("view", "it-1", "offering", { category: "کتاب" });
    personalizationEngine.recordSignal("purchase", "it-2", "offering", { category: "صنایع دستی" });

    const affinity = personalizationEngine.getAffinityScores();
    const handcraftScore = affinity["صنایع دستی"] ?? 0;
    const bookScore = affinity["کتاب"] ?? 0;
    expect(handcraftScore).toBeGreaterThan(bookScore);
  });

  it("recommends offerings based on affinity and purchase reorders", () => {
    personalizationEngine.recordSignal("purchase", "item-reorder", "offering", { category: "سلامت" });

    const catalog = [
      { id: "item-gen", title: "کالای متفرقه", category: "سایر", price: 100000 },
      { id: "item-reorder", title: "دمنوش گیاهی", category: "سلامت", price: 150000 },
    ];

    const recs = personalizationEngine.getRecommendations(catalog);
    expect(recs[0]?.id).toBe("item-reorder");
    expect(recs[0]?.isReorder).toBe(true);
  });

  it("respects privacy controls and purges signals when disabled", () => {
    personalizationEngine.recordSignal("search", "عبارت خصوصی", "query");
    expect(personalizationEngine.getSearchHistory()).toContain("عبارت خصوصی");

    personalizationEngine.updatePrivacySettings({ searchHistoryEnabled: false });
    expect(personalizationEngine.getSearchHistory().length).toBe(0);

    personalizationEngine.updatePrivacySettings({ activityTrackingEnabled: false });
    personalizationEngine.recordSignal("view", "item-secret", "offering", { category: "کتاب" });
    expect(personalizationEngine.getRecentViews()).not.toContain("item-secret");
  });
});
