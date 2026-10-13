// ============================================================================
// PHOENIX PERSONALIZATION ENGINE & SIGNAL COLLECTOR (Phases 8, 9, 10, 11)
// Architecture: Data → Signals → Rules → Scoring → Recommendations → Privacy
// ============================================================================

export type SignalType =
  | "search"
  | "view"
  | "save"
  | "like"
  | "compare"
  | "follow"
  | "add_to_cart"
  | "purchase";

export interface BuyerSignal {
  readonly id: string;
  readonly type: SignalType;
  readonly targetId: string;
  readonly targetType: "offering" | "business" | "category" | "query";
  readonly category?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly timestamp: number;
}

export interface RecommendationItem {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly price: number;
  readonly businessName: string;
  readonly score: number;
  readonly reason: string;
  readonly isReorder?: boolean | undefined;
}

const STORAGE_KEYS = {
  signals: "phoenix-buyer-signals-v1",
  searchHistory: "phoenix-search-history-v1",
  privacySettings: "phoenix-privacy-settings-v1",
};

export interface BuyerPrivacySettings {
  personalizationEnabled: boolean;
  searchHistoryEnabled: boolean;
  activityTrackingEnabled: boolean;
}

const DEFAULT_PRIVACY: BuyerPrivacySettings = {
  personalizationEnabled: true,
  searchHistoryEnabled: true,
  activityTrackingEnabled: true,
};

class PersonalizationEngine {
  private signals: BuyerSignal[] = [];
  private searchHistory: string[] = [];
  private privacy: BuyerPrivacySettings = DEFAULT_PRIVACY;

  constructor() {
    this.loadState();
  }

  private loadState(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const storedPrivacy = localStorage.getItem(STORAGE_KEYS.privacySettings);
      if (storedPrivacy) this.privacy = { ...DEFAULT_PRIVACY, ...JSON.parse(storedPrivacy) };

      if (this.privacy.activityTrackingEnabled) {
        const storedSignals = localStorage.getItem(STORAGE_KEYS.signals);
        if (storedSignals) this.signals = JSON.parse(storedSignals);
      }

      if (this.privacy.searchHistoryEnabled) {
        const storedHistory = localStorage.getItem(STORAGE_KEYS.searchHistory);
        if (storedHistory) this.searchHistory = JSON.parse(storedHistory);
      }
    } catch {
      // Graceful fallback
    }
  }

  private saveState(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEYS.privacySettings, JSON.stringify(this.privacy));
      if (this.privacy.activityTrackingEnabled) {
        localStorage.setItem(STORAGE_KEYS.signals, JSON.stringify(this.signals.slice(-100)));
      } else {
        localStorage.removeItem(STORAGE_KEYS.signals);
      }
      if (this.privacy.searchHistoryEnabled) {
        localStorage.setItem(STORAGE_KEYS.searchHistory, JSON.stringify(this.searchHistory.slice(-20)));
      } else {
        localStorage.removeItem(STORAGE_KEYS.searchHistory);
      }
    } catch {
      // Storage unavailable
    }
  }

  // --------------------------------------------------------------------------
  // Phase 8: Signal Collection
  // --------------------------------------------------------------------------

  recordSignal(
    type: SignalType,
    targetId: string,
    targetType: "offering" | "business" | "category" | "query",
    options: { category?: string; metadata?: Record<string, unknown> } = {},
  ): void {
    if (!this.privacy.activityTrackingEnabled) return;

    if (type === "search" && this.privacy.searchHistoryEnabled && targetId.trim()) {
      const query = targetId.trim();
      this.searchHistory = [query, ...this.searchHistory.filter((q) => q !== query)].slice(0, 15);
    }

    const signal: BuyerSignal = {
      id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      targetId,
      targetType,
      category: options.category,
      metadata: options.metadata,
      timestamp: Date.now(),
    };

    this.signals.push(signal);
    if (this.signals.length > 200) this.signals = this.signals.slice(-200);
    this.saveState();
  }

  // --------------------------------------------------------------------------
  // Phase 9: Scoring & Rule-based Recommendations
  // --------------------------------------------------------------------------

  getAffinityScores(): Record<string, number> {
    if (!this.privacy.personalizationEnabled) return {};

    const scores: Record<string, number> = {};
    const weights: Record<SignalType, number> = {
      purchase: 10,
      add_to_cart: 7,
      save: 5,
      like: 4,
      compare: 4,
      follow: 6,
      view: 2,
      search: 3,
    };

    const now = Date.now();
    const halfLifeMs = 7 * 24 * 60 * 60 * 1000; // 7 days decay

    for (const signal of this.signals) {
      if (!signal.category) continue;
      const weight = weights[signal.type] ?? 1;
      const ageMs = Math.max(0, now - signal.timestamp);
      const decay = Math.pow(0.5, ageMs / halfLifeMs);
      scores[signal.category] = (scores[signal.category] ?? 0) + weight * decay;
    }

    return scores;
  }

  getRecommendations(
    catalogOfferings: readonly { id: string; title: string; category: string; price: number; businessName?: string }[],
    limit = 4,
  ): RecommendationItem[] {
    const affinity = this.getAffinityScores();

    const scored = catalogOfferings.map((item) => {
      const catAffinity = affinity[item.category];
      let score = catAffinity ?? 0;
      let reason = "پیشنهاد منتخب ققنوس";

      // Reorder signal boost
      const hasPurchased = this.signals.some((s) => s.type === "purchase" && s.targetId === item.id);
      if (hasPurchased) {
        score += 15;
        reason = "بر اساس خریدهای قبلی شما (خرید مجدد)";
      } else if (catAffinity !== undefined && catAffinity > 5) {
        reason = `بر اساس علاقه شما به دسته ${item.category}`;
      }

      return {
        id: item.id,
        title: item.title,
        category: item.category,
        price: item.price,
        businessName: item.businessName || "کسب‌وکار ققنوس",
        score,
        reason,
        isReorder: hasPurchased,
      };
    });

    // Sort by affinity score descending
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  // --------------------------------------------------------------------------
  // Phase 10: Continue Shopping & Next Best Action
  // --------------------------------------------------------------------------

  getRecentViews(limit = 4): string[] {
    return this.signals
      .filter((s) => s.type === "view" && s.targetType === "offering")
      .map((s) => s.targetId)
      .reverse()
      .filter((id, idx, arr) => arr.indexOf(id) === idx)
      .slice(0, limit);
  }

  getSearchHistory(): readonly string[] {
    return this.privacy.searchHistoryEnabled ? this.searchHistory : [];
  }

  // --------------------------------------------------------------------------
  // Phase 11: Privacy & User Controls
  // --------------------------------------------------------------------------

  getPrivacySettings(): BuyerPrivacySettings {
    return { ...this.privacy };
  }

  updatePrivacySettings(settings: Partial<BuyerPrivacySettings>): void {
    this.privacy = { ...this.privacy, ...settings };
    if (!this.privacy.personalizationEnabled) {
      // Clear algorithmic affinities
    }
    if (!this.privacy.searchHistoryEnabled) {
      this.searchHistory = [];
    }
    if (!this.privacy.activityTrackingEnabled) {
      this.signals = [];
    }
    this.saveState();
  }

  clearSearchHistory(): void {
    this.searchHistory = [];
    this.saveState();
  }

  clearAllSignals(): void {
    this.signals = [];
    this.searchHistory = [];
    this.saveState();
  }
}

export const personalizationEngine = new PersonalizationEngine();
