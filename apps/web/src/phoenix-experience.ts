/**
 * Phoenix Unified UI Experience Framework
 * Implements the 3 Core User Journeys (Individual, Business, Consumer)
 * strictly aligned with the Phoenix Design Constitution & Reference Design.
 */

import { translateUiText, type SupportedLanguage, type Locale } from "./i18n-runtime.js";
import {
  accountTierService,
  validateNationalCode,
  BUYER_ROLE_LABELS_FA,
  type OfferingType,
  type StoreBuyerRole,
} from "./account-tier-service.js";

export type PhoenixPersona = "individual" | "business" | "consumer";

const PERSONA_STORAGE_KEY = "phoenix.active_persona";
const CART_STORAGE_KEY = "phoenix.cart_items";
const TEAM_STORAGE_KEY = "phoenix.team_members";
const ORG_STORAGE_KEY = "phoenix.org_profile";

const memoryStore = new Map<string, string>();

function getStorageItem(key: string): string | null {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStore.get(key) ?? null;
    }
  }
  return memoryStore.get(key) ?? null;
}

function setStorageItem(key: string, value: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
  memoryStore.set(key, value);
}

export function getActivePersona(): PhoenixPersona {
  const stored = getStorageItem(PERSONA_STORAGE_KEY);
  if (stored === "individual" || stored === "business" || stored === "consumer") {
    return stored;
  }
  return "individual";
}

export function setActivePersona(persona: PhoenixPersona): void {
  setStorageItem(PERSONA_STORAGE_KEY, persona);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ui(text: string): string {
  if (typeof window === "undefined") return text;
  const lang = (localStorage.getItem("qooqnos.locale") as SupportedLanguage) || "fa";
  return translateUiText(text, lang as Locale);
}

// -----------------------------------------------------------------------------
// Cart Data Model & Operations
// -----------------------------------------------------------------------------

export interface PhoenixCartItem {
  id: string;
  title: string;
  category: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

const DEFAULT_CART_ITEMS: PhoenixCartItem[] = [
  {
    id: "item-1",
    title: "بسته هوشمند سازمانی ققنوس",
    category: "محصول دیجیتال",
    price: 120000,
    quantity: 1,
  },
  {
    id: "item-2",
    title: "صنایع دستی و هنر خاتم‌کاری",
    category: "محصول فیزیکی",
    price: 30000,
    quantity: 1,
  },
];

export function getCartItems(): PhoenixCartItem[] {
  try {
    const raw = getStorageItem(CART_STORAGE_KEY);
    if (!raw) {
      setStorageItem(CART_STORAGE_KEY, JSON.stringify(DEFAULT_CART_ITEMS));
      return DEFAULT_CART_ITEMS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_CART_ITEMS;
  }
}

export function saveCartItems(items: PhoenixCartItem[]): void {
  setStorageItem(CART_STORAGE_KEY, JSON.stringify(items));
}

export function updateCartQuantity(id: string, delta: number): PhoenixCartItem[] {
  const items = getCartItems();
  const next = items
    .map((item) => {
      if (item.id === id) {
        const qty = item.quantity + delta;
        return qty > 0 ? { ...item, quantity: qty } : null;
      }
      return item;
    })
    .filter(Boolean) as PhoenixCartItem[];
  saveCartItems(next);
  return next;
}

export function removeCartItem(id: string): PhoenixCartItem[] {
  const next = getCartItems().filter((item) => item.id !== id);
  saveCartItems(next);
  return next;
}

// -----------------------------------------------------------------------------
// Team Members Model & Operations (Business Persona)
// -----------------------------------------------------------------------------

export interface PhoenixTeamMember {
  id: string;
  name: string;
  role: string;
  status: string;
  avatarChar: string;
}

const DEFAULT_TEAM_MEMBERS: PhoenixTeamMember[] = [
  { id: "tm-1", name: "مدیر عامل", role: "ثبت‌نام تکمیل شده", status: "فعال", avatarChar: "ع" },
  { id: "tm-2", name: "مدیر فروش", role: "دسترسی کامل فروش و سفارش‌ها", status: "فعال", avatarChar: "ف" },
  { id: "tm-3", name: "کارشناس بازاریابی", role: "مدیریت محتوا و کمپین‌ها", status: "فعال", avatarChar: "ب" },
  { id: "tm-4", name: "کارشناس مالی", role: "مدیریت فاکتور و تسویه‌ها", status: "فعال", avatarChar: "م" },
];

export function getTeamMembers(): PhoenixTeamMember[] {
  try {
    const raw = getStorageItem(TEAM_STORAGE_KEY);
    if (!raw) {
      setStorageItem(TEAM_STORAGE_KEY, JSON.stringify(DEFAULT_TEAM_MEMBERS));
      return DEFAULT_TEAM_MEMBERS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_TEAM_MEMBERS;
  }
}

export function addTeamMember(member: Omit<PhoenixTeamMember, "id">): PhoenixTeamMember[] {
  const list = getTeamMembers();
  const next = [...list, { ...member, id: "tm-" + Date.now() }];
  setStorageItem(TEAM_STORAGE_KEY, JSON.stringify(next));
  return next;
}

// -----------------------------------------------------------------------------
// Organization Profile Model & Operations (Business Persona)
// -----------------------------------------------------------------------------

export interface PhoenixOrgProfile {
  entityType?: ("natural" | "legal") | undefined;
  managerName?: string | undefined;
  companyName: string;
  regNumber: string;
  nationalCode?: string | undefined;
  economicCode?: string | undefined;
  industry: string;
  address: string;
  phone: string;
}

const DEFAULT_ORG_PROFILE: PhoenixOrgProfile = {
  entityType: "legal",
  managerName: "سارا حسینی",
  companyName: "شرکت پارس تجارت هوشمند",
  regNumber: "۱۰۸۶۱۹۸۲۳۴۵",
  nationalCode: "۰۰۱۲۳۴۵۶۷۸",
  economicCode: "۴۱۱۸۹۲۳۴۵۱",
  industry: "بازرگانی، توزیع و تجارت الکترونیک",
  address: "تهران، خیابان ولیعصر، برج تجارت، طبقه ۸",
  phone: "۰۲۱-۸۸۹۹۰۰۱۱",
};

export function getOrgProfile(): PhoenixOrgProfile {
  try {
    const raw = getStorageItem(ORG_STORAGE_KEY);
    if (!raw) return DEFAULT_ORG_PROFILE;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_ORG_PROFILE;
  }
}

export function saveOrgProfile(profile: PhoenixOrgProfile): void {
  setStorageItem(ORG_STORAGE_KEY, JSON.stringify(profile));
}

// -----------------------------------------------------------------------------
// Shared UI Components (Persona Switcher, AI Smart Card, Unified Bottom Nav)
// -----------------------------------------------------------------------------

export function renderPersonaSwitcher(active = getActivePersona()): string {
  return `
    <nav class="phoenix-persona-switcher" aria-label="${ui("انتخاب تجربه کاربری ققنوس")}">
      <button type="button" class="phoenix-persona-btn ${active === "individual" ? "active" : ""}" data-switch-persona="individual" aria-pressed="${active === "individual"}">
        <span aria-hidden="true">👤</span>
        <span>${ui("حساب من")}</span>
      </button>
      <button type="button" class="phoenix-persona-btn ${active === "business" ? "active" : ""}" data-switch-persona="business" aria-pressed="${active === "business"}">
        <span aria-hidden="true">🏢</span>
        <span>${ui("فروشگاه من")}</span>
      </button>
      <button type="button" class="phoenix-persona-btn ${active === "consumer" ? "active" : ""}" data-switch-persona="consumer" aria-pressed="${active === "consumer"}">
        <span aria-hidden="true">🛍️</span>
        <span>${ui("بازارگاه و خرید")}</span>
      </button>
    </nav>
  `;
}

export function renderSmartAiCard(title: string, promptText: string): string {
  return `
    <div class="phoenix-ai-suggestion-box">
      <div class="phoenix-ai-icon" aria-hidden="true">✦</div>
      <div class="phoenix-ai-text">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(promptText)}</span>
      </div>
    </div>
  `;
}

export function renderUnifiedBottomNav(persona: PhoenixPersona, activeTab = "home"): string {
  if (persona === "individual") {
    const tabs = [
      { id: "home", label: "خانه", icon: "⌂", href: "/" },
      { id: "create", label: "محتوا", icon: "＋", href: "/create" },
      { id: "deals", label: "معاملات", icon: "↔", href: "/transactions" },
      { id: "loyalty", label: "امتیاز", icon: "★", href: "/loyalty" },
      { id: "profile", label: "پروفایل", icon: "◉", href: "/profile" },
    ];
    return `
      <nav class="phoenix-unified-bottom-nav" aria-label="${ui("ناوبری حساب من")}">
        ${tabs.map((t) => `
          <a href="${t.href}" data-nav class="phoenix-nav-tab ${activeTab === t.id ? "active" : ""}">
            <span class="phoenix-nav-tab-icon" aria-hidden="true">${t.icon}</span>
            <span>${ui(t.label)}</span>
          </a>
        `).join("")}
      </nav>
    `;
  }

  if (persona === "business") {
    const tabs = [
      { id: "home", label: "خانه", icon: "⌂", href: "/business" },
      { id: "create", label: "محتوا", icon: "＋", href: "/business/create" },
      { id: "deals", label: "معاملات", icon: "↔", href: "/business/deals" },
      { id: "team", label: "تیم", icon: "👥", href: "/business/team" },
      { id: "profile", label: "پروفایل", icon: "◉", href: "/business/organization" },
    ];
    return `
      <nav class="phoenix-unified-bottom-nav" aria-label="${ui("ناوبری فروشگاه من")}">
        ${tabs.map((t) => `
          <a href="${t.href}" data-nav class="phoenix-nav-tab ${activeTab === t.id ? "active" : ""}">
            <span class="phoenix-nav-tab-icon" aria-hidden="true">${t.icon}</span>
            <span>${ui(t.label)}</span>
          </a>
        `).join("")}
      </nav>
    `;
  }

  // Consumer
  const tabs = [
    { id: "home", label: "خانه", icon: "⌂", href: "/discover" },
    { id: "cats", label: "دسته‌ها", icon: "▦", href: "/discover?tab=categories" },
    { id: "cart", label: "سبد خرید", icon: "🛒", href: "/cart" },
    { id: "search", label: "پیام‌ها", icon: "✉", href: "/messages" },
    { id: "profile", label: "پروفایل", icon: "◉", href: "/loyalty" },
  ];
  return `
    <nav class="phoenix-unified-bottom-nav" aria-label="${ui("ناوبری بازارگاه و خرید")}">
      ${tabs.map((t) => `
        <a href="${t.href}" data-nav class="phoenix-nav-tab ${activeTab === t.id ? "active" : ""}">
          <span class="phoenix-nav-tab-icon" aria-hidden="true">${t.icon}</span>
          <span>${ui(t.label)}</span>
        </a>
      `).join("")}
    </nav>
  `;
}

// -----------------------------------------------------------------------------
// ROW 1: کاربر حقیقی (فرد عادی) - Screens 1.1 to 1.7
// -----------------------------------------------------------------------------

/**
 * Screen 1.1: خوشامدگویی کاربر حقیقی
 */
export function renderIndividualWelcome(): string {
  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-welcome-container">
        <img class="phoenix-welcome-logo" src="/phoenix-mark.svg?v=2" alt="ققنوس" />
        <h1 class="phoenix-welcome-greeting">
          ${ui("سلام!")}
          <span>${ui("من ققنوس هستم دستیار هوشمندت")}</span>
        </h1>
        <p class="phoenix-welcome-desc">
          ${ui("بگو چی می‌خوای؟ محصولت رو بفروشی؟ خرید کنی؟ یا فقط مشورت؟")}
        </p>
        <ul class="phoenix-welcome-bullets">
          <li>${ui("ورود و ثبت‌نام سریع")}</li>
          <li>${ui("پروفایل و رتبه کاربری")}</li>
          <li>${ui("ایجاد محتوا و آگهی")}</li>
          <li>${ui("معاملات مستقیم و امن")}</li>
          <li>${ui("کسب درآمد و امتیاز ققنوس")}</li>
        </ul>
        <a href="/" data-nav class="phoenix-primary-cta">
          <span>${ui("شروع کنیم")}</span>
          <span aria-hidden="true">←</span>
        </a>
      </div>
    </div>
  `;
}

/**
 * Screen 1.2: خانه کاربر حقیقی (داشبورد)
 */
export function renderIndividualDashboard(): string {
  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-dashboard-hero">
        <div class="phoenix-user-greet-card" style="width: 100%;">
          <div class="phoenix-greet-info">
            <div class="phoenix-user-avatar">
              <span>س</span>
              <span class="phoenix-online-dot"></span>
            </div>
            <div class="phoenix-greet-texts">
              <strong>${ui("سلام سارا")}</strong>
              <small>${ui("خوش اومدی به ققنوس")}</small>
            </div>
          </div>
          <a href="/notifications" data-nav class="phoenix-bell-btn" aria-label="${ui("اعلان‌ها")}">
            <span aria-hidden="true">🔔</span>
            <span class="phoenix-bell-badge"></span>
          </a>
        </div>
      </div>

      <div class="phoenix-screen-content">
        <!-- Prominent Platform Pathways: Users & Sellers -->
        <div class="phoenix-pathways-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:14px; margin-bottom:8px;">
          <div class="phoenix-pathway-card" style="background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
            <div style="display:flex; align-items:flex-start; gap:10px;">
              <span style="font-size:26px; line-height:1;">🛍️</span>
              <div>
                <strong style="font-size:14px; display:block; color:var(--text);">${ui("کشف، خرید و استفاده از خدمات")}</strong>
                <span style="font-size:12px; color:var(--muted); line-height:1.5;">${ui("دسترسی آزاد و محترمانه به خدمات، محصولات و محتوا برای همه اعضا")}</span>
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <a href="/discover" data-nav class="button button-outline button-sm" style="font-size:12px; padding:5px 12px;">${ui("مرور بازارگاه")}</a>
              <button type="button" class="button button-ghost button-sm" data-open-register style="font-size:12px; padding:5px 10px;">✦ ${ui("ثبت‌نام در پلتفرم")}</button>
            </div>
          </div>

          <div class="phoenix-pathway-card" style="background:linear-gradient(135deg, rgba(255,106,0,0.06), var(--surface)); border:1.5px solid var(--line); border-radius:18px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
            <div style="display:flex; align-items:flex-start; gap:10px;">
              <span style="font-size:26px; line-height:1;">🏪</span>
              <div>
                <strong style="font-size:14px; display:block; color:var(--primary);">${ui("مسیر فروشندگان و ارائه‌دهندگان")}</strong>
                <span style="font-size:12px; color:var(--muted); line-height:1.5;">${ui("فروش کالا یا ارائه خدمت؛ شروع سریع و مدیریت آسان فروش")}</span>
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <button type="button" class="button button-primary button-sm" data-open-seller-register style="font-size:12px; padding:5px 14px;">🏪 ${ui("ثبت‌نام فروشنده")}</button>
              <button type="button" class="button button-outline button-sm" data-activate-seller style="font-size:12px; padding:5px 12px;">${ui("فعال‌سازی فروشندگی")}</button>
            </div>
          </div>
        </div>

        <!-- Search bar with real interaction -->
        <form class="phoenix-search-bar" id="individual-search-form">
          <span style="color: var(--primary); font-size: 16px;" aria-hidden="true">⌕</span>
          <input type="text" id="individual-search-input" placeholder="${ui("بگو چی می‌خوای انجام بدی؟")}" />
          <button type="submit" class="button button-primary button-sm" style="padding: 4px 10px; font-size: 11px;">${ui("جستجو")}</button>
        </form>

        <!-- 6 Action Cards -->
        <div class="phoenix-action-grid">
          <a href="/create" data-nav class="phoenix-action-card">
            <div class="phoenix-action-icon" aria-hidden="true">📤</div>
            <span class="phoenix-action-label">${ui("آپلود محتوا")}</span>
          </a>
          <a href="/discover?intent=buy" data-nav class="phoenix-action-card">
            <div class="phoenix-action-icon" aria-hidden="true">🛒</div>
            <span class="phoenix-action-label">${ui("خرید")}</span>
          </a>
          <a href="/create" data-nav class="phoenix-action-card">
            <div class="phoenix-action-icon" aria-hidden="true">🏷️</div>
            <span class="phoenix-action-label">${ui("فروش")}</span>
          </a>
          <a href="/transactions" data-nav class="phoenix-action-card">
            <div class="phoenix-action-icon" aria-hidden="true">↔️</div>
            <span class="phoenix-action-label">${ui("معاملات")}</span>
          </a>
          <a href="/discover?category=education" data-nav class="phoenix-action-card">
            <div class="phoenix-action-icon" aria-hidden="true">🎓</div>
            <span class="phoenix-action-label">${ui("آموزش")}</span>
          </a>
          <a href="/discover?category=consultation" data-nav class="phoenix-action-card">
            <div class="phoenix-action-icon" aria-hidden="true">💬</div>
            <span class="phoenix-action-label">${ui("مشاوره")}</span>
          </a>
        </div>

        <!-- Today's Suggestions -->
        <a href="/create" data-nav class="phoenix-suggestion-banner">
          <div class="phoenix-suggestion-copy">
            <strong>${ui("پیشنهادهای امروز")}</strong>
            <small>${ui("محصولت رو حرفه‌ای کن با چند کلیک ساده")}</small>
          </div>
          <div class="phoenix-suggestion-arrow" aria-hidden="true">←</div>
        </a>

        <!-- Recent Interactive Mini Feed -->
        <div style="background: var(--surface-2); border-radius: 18px; padding: 14px 16px; border: 1px solid var(--line); margin-bottom: 20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
            <strong style="font-size: 13px;">${ui("آخرین فعالیت‌های شما")}</strong>
            <small style="color: var(--primary); font-size: 11px;">${ui("به‌روز")}</small>
          </div>
          <p style="font-size: 12px; color: var(--muted); margin: 0;">
            ${ui("یک آگهی جدید ایجاد شد و در صف تطبیق هوشمند ققنوس قرار گرفت.")}
          </p>
        </div>

        <!-- LEVEL 1 (حساب من): Comprehensive Account Dashboard Sections -->
        ${(() => {
          const profile = accountTierService.getProfileData();
          const addresses = accountTierService.getAddresses();
          const orders = accountTierService.getBuyerOrders();
          const wishlist = accountTierService.getWishlist();
          const tier = accountTierService.getAccountTier();

          return `
            <div class="phoenix-account-sections" style="background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 22px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
                <div>
                  <h2 style="font-size: 16px; font-weight: 800; margin: 0 0 4px; color: var(--text);">${ui("مدیریت حساب من")}</h2>
                  <span style="font-size: 12px; color: var(--muted);">${ui("مشخصات فردی، چند آدرس، سوابق سفارش‌ها، فاکتورها و ارتقای سطح")}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="phoenix-tier-badge badge-info">✓ ${tier === "base" ? ui("حساب پایه") : tier === "seller" ? ui("فروشگاه فعال") : ui("فروشگاه شرکتی")}</span>
                  ${tier === "base" ? `<button type="button" class="button button-outline button-sm" data-activate-seller style="font-size:11.5px; padding:4px 10px;">🏪 ${ui("ارتقا به فروشندگی")}</button>` : ""}
                </div>
              </div>

              <!-- Sub-navigation Tabs -->
              <div class="phoenix-tier-nav" role="tablist">
                <button type="button" class="phoenix-tier-tab-btn active" data-tab-target="pane-acc-profile">
                  <span>👤</span> ${ui("پروفایل و کد ملی")}
                </button>
                <button type="button" class="phoenix-tier-tab-btn" data-tab-target="pane-acc-addresses">
                  <span>📍</span> ${ui("آدرس‌های تحویل")} (${addresses.length})
                </button>
                <button type="button" class="phoenix-tier-tab-btn" data-tab-target="pane-acc-orders">
                  <span>📦</span> ${ui("سفارش‌ها و فاکتورها")} (${orders.length})
                </button>
                <button type="button" class="phoenix-tier-tab-btn" data-tab-target="pane-acc-wishlist">
                  <span>❤️</span> ${ui("علاقه‌مندی‌ها")} (${wishlist.length})
                </button>
                <button type="button" class="phoenix-tier-tab-btn" data-tab-target="pane-acc-upgrade">
                  <span>🏪</span> ${ui("فعال‌سازی فروشندگی")}
                </button>
              </div>

              <!-- Tab 1: Profile & National Code Form -->
              <div class="phoenix-tier-pane active" id="pane-acc-profile">
                <form id="level1-profile-form" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; max-width: 680px;">
                  <div>
                    <label class="field-label" style="display:block; font-size:12px; font-weight:700; margin-bottom:6px;">${ui("نام و نام خانوادگی")}</label>
                    <input type="text" id="acc-profile-name" class="studio-input-line" style="width:100%; border-radius:12px; padding:10px;" value="${escapeHtml(profile.displayName)}" required />
                  </div>
                  <div>
                    <label class="field-label" style="display:block; font-size:12px; font-weight:700; margin-bottom:6px;">${ui("شماره موبایل")}</label>
                    <input type="tel" id="acc-profile-mobile" class="studio-input-line" style="width:100%; border-radius:12px; padding:10px; direction:ltr; text-align:right;" value="${escapeHtml(profile.mobile)}" required />
                  </div>
                  <div>
                    <label class="field-label" style="display:block; font-size:12px; font-weight:700; margin-bottom:6px;">${ui("کد ملی (۱۰ رقم)")}</label>
                    <input type="text" id="acc-profile-national-code" class="studio-input-line" style="width:100%; border-radius:12px; padding:10px; direction:ltr; text-align:right;" maxlength="10" value="${escapeHtml(profile.nationalCode || "")}" placeholder="مثال: 0012345678" />
                  </div>
                  <div>
                    <label class="field-label" style="display:block; font-size:12px; font-weight:700; margin-bottom:6px;">${ui("ایمیل (روش تأیید امن)")}</label>
                    <input type="email" id="acc-profile-email" class="studio-input-line" style="width:100%; border-radius:12px; padding:10px; direction:ltr; text-align:right;" value="${escapeHtml(profile.email || "")}" placeholder="sara@example.com" />
                  </div>
                  <div style="grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; margin-top: 6px; flex-wrap: wrap; gap: 8px;">
                    <span id="acc-profile-feedback" style="font-size: 12px; color: var(--muted);"></span>
                    <button type="submit" class="button button-primary button-sm" style="padding: 8px 18px;">
                      ✓ ${ui("ذخیره تغییرات حساب")}
                    </button>
                  </div>
                </form>
              </div>

              <!-- Tab 2: Multiple Addresses -->
              <div class="phoenix-tier-pane" id="pane-acc-addresses">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                  <span style="font-size: 12.5px; color: var(--muted);">${ui("ثبت چند آدرس با عنوان دلخواه (مانند خانه و محل کار)")}</span>
                  <button type="button" class="button button-outline button-sm" id="btn-toggle-new-addr" style="font-size: 12px;">
                    ＋ ${ui("افزودن آدرس جدید")}
                  </button>
                </div>

                <!-- Add New Address Form (hidden toggle) -->
                <form id="level1-add-address-form" style="display: none; background: var(--surface-2); border: 1px solid var(--line); border-radius: 14px; padding: 16px; margin-bottom: 16px;">
                  <h4 style="font-size: 13px; font-weight: 700; margin: 0 0 10px;">${ui("مشخصات آدرس جدید")}</h4>
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 10px;">
                    <div>
                      <label style="display:block; font-size:11px; margin-bottom:4px;">${ui("عنوان آدرس (مانند خانه، محل کار، انبار)")}</label>
                      <input type="text" id="new-addr-title" class="studio-input-line" placeholder="مثال: خانه" required style="width:100%; padding:8px; border-radius:8px;" />
                    </div>
                    <div>
                      <label style="display:block; font-size:11px; margin-bottom:4px;">${ui("کد پستی (۱۰ رقم)")}</label>
                      <input type="text" id="new-addr-postal" class="studio-input-line" placeholder="مثال: 1998877665" maxlength="10" required style="width:100%; padding:8px; border-radius:8px; direction:ltr; text-align:right;" />
                    </div>
                    <div>
                      <label style="display:block; font-size:11px; margin-bottom:4px;">${ui("شهر")}</label>
                      <input type="text" id="new-addr-city" class="studio-input-line" value="تهران" required style="width:100%; padding:8px; border-radius:8px;" />
                    </div>
                  </div>
                  <div style="margin-bottom: 10px;">
                    <label style="display:block; font-size:11px; margin-bottom:4px;">${ui("نشانی کامل")}</label>
                    <input type="text" id="new-addr-street" class="studio-input-line" placeholder="خیابان، پلاک، واحد…" required style="width:100%; padding:8px; border-radius:8px;" />
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <button type="submit" class="button button-primary button-sm">${ui("ثبت آدرس")}</button>
                    <button type="button" class="button button-ghost button-sm" id="btn-cancel-new-addr">${ui("انصراف")}</button>
                  </div>
                </form>

                <!-- Addresses Cards Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
                  ${addresses.map((a) => `
                    <div style="background: var(--surface-2); border: 1px solid var(--line); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;">
                      <div>
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                          <strong style="font-size: 13.5px;">📍 ${escapeHtml(a.title)}</strong>
                          ${a.isDefault ? `<span class="phoenix-tier-badge badge-success">${ui("پیش‌فرض")}</span>` : ""}
                        </div>
                        <p style="font-size: 12px; color: var(--text); line-height: 1.6; margin: 0 0 6px;">${escapeHtml(a.streetLine1)}</p>
                        <small style="color: var(--muted); font-size: 11px;">${ui("کد پستی:")} <code>${escapeHtml(a.postalCode || "—")}</code></small>
                      </div>
                      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
                        <button type="button" class="button button-ghost button-sm" data-delete-addr="${a.id}" style="color: var(--danger); font-size: 11px; padding: 2px 8px;">
                          🗑️ ${ui("حذف")}
                        </button>
                      </div>
                    </div>
                  `).join("")}
                </div>
              </div>

              <!-- Tab 3: Orders & Invoices -->
              <div class="phoenix-tier-pane" id="pane-acc-orders">
                <div style="margin-bottom: 12px;">
                  <span style="font-size: 12.5px; color: var(--muted);">${ui("مشاهده سفارش‌ها، وضعیت، رهگیری ارسال و دریافت PDF فاکتورها")}</span>
                </div>
                ${orders.length === 0 ? `
                  <div style="text-align: center; padding: 28px; color: var(--muted);">
                    <p>${ui("هنوز سفارشی ثبت نشده است.")}</p>
                    <a href="/discover" data-nav class="button button-primary button-sm">${ui("شروع خرید در بازارگاه")}</a>
                  </div>
                ` : `
                  <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${orders.map((o) => {
                      const statusBadge = o.status === "delivered" ? "badge-success" : o.status === "shipped" ? "badge-info" : o.status === "processing" ? "badge-warning" : "badge-danger";
                      const statusText = o.status === "delivered" ? ui("تحویل‌شده") : o.status === "shipped" ? ui("ارسال‌شده") : o.status === "processing" ? ui("در حال آماده‌سازی") : ui("لغوشده");
                      return `
                        <div style="background: var(--surface-2); border: 1px solid var(--line); border-radius: 14px; padding: 14px;">
                          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid var(--line); padding-bottom: 10px; margin-bottom: 10px;">
                            <div>
                              <strong style="font-size: 13.5px;">${ui("سفارش")} ${escapeHtml(o.id)}</strong>
                              <small style="color: var(--muted); margin-inline-start: 8px;">${escapeHtml(o.sellerName)} · ${new Date(o.createdAt).toLocaleDateString("fa-IR")}</small>
                            </div>
                            <span class="phoenix-tier-badge ${statusBadge}">${statusText}</span>
                          </div>
                          <div style="font-size: 12px; margin-bottom: 8px;">
                            ${o.items.map((it) => `
                              <div style="display:flex; justify-content:space-between; padding: 3px 0;">
                                <span>✦ ${escapeHtml(it.productTitle)} (${it.quantity} عدد)</span>
                                <strong>${it.lineTotalMinor.toLocaleString("fa-IR")} ${o.currency}</strong>
                              </div>
                            `).join("")}
                          </div>
                          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; padding-top: 8px; border-top: 1px solid var(--line);">
                            <small style="color: var(--muted);">
                              ${o.trackingNumber ? `کد رهگیری: <code>${escapeHtml(o.trackingNumber)}</code>` : ""}
                            </small>
                            <div style="display: flex; gap: 8px; align-items: center;">
                              <strong style="font-size: 13px; color: var(--primary);">${ui("مجموع:")} ${o.grandTotalMinor.toLocaleString("fa-IR")} ${o.currency}</strong>
                              <button type="button" class="button button-outline button-sm" data-view-invoice="${o.id}" style="font-size: 11px; padding: 4px 10px;">
                                📄 ${ui("مشاهده و دریافت فاکتور")}
                              </button>
                            </div>
                          </div>
                        </div>
                      `;
                    }).join("")}
                  </div>
                `}
              </div>

              <!-- Tab 4: Wishlist & Activity History -->
              <div class="phoenix-tier-pane" id="pane-acc-wishlist">
                <h4 style="font-size: 13px; font-weight: 700; margin: 0 0 10px;">${ui("کالاهای نشان‌شده در فهرست علائق")}</h4>
                ${wishlist.length === 0 ? `
                  <p style="font-size: 12px; color: var(--muted);">${ui("فهرست علائق شما خالی است.")}</p>
                ` : `
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin-bottom: 16px;">
                    ${wishlist.map((id) => {
                      const prod = accountTierService.getStoreProducts().find((p) => p.id === id);
                      return `
                        <div style="background: var(--surface-2); border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
                          <div>
                            <strong style="font-size: 12.5px; display: block;">${prod ? escapeHtml(prod.title) : escapeHtml(id)}</strong>
                            <small style="color: var(--primary); font-weight: 700;">${prod ? prod.basePriceMinor.toLocaleString("fa-IR") + " تومان" : ""}</small>
                          </div>
                          <button type="button" class="button button-ghost button-sm" data-toggle-wishlist="${id}" style="color: var(--danger); font-size: 11px;">
                            ❤️ ${ui("حذف")}
                          </button>
                        </div>
                      `;
                    }).join("")}
                  </div>
                `}
                <h4 style="font-size: 13px; font-weight: 700; margin: 16px 0 8px;">${ui("سوابق فعالیت")}</h4>
                <div style="font-size: 12px; color: var(--muted); line-height: 1.8;">
                  <div>• ${ui("ورود امن به سامانه با شماره موبایل و کد یکبارمصرف")} (امروز)</div>
                  <div>• ${ui("استعلام قیمت و مشاهده پیش‌فاکتور پایانه فروشگاهی")} (دیروز)</div>
                  <div>• ${ui("ثبت آدرس محل کار و تکمیل نشانی")} (هفته گذشته)</div>
                </div>
              </div>

              <!-- Tab 5: Upgrade to Seller Flow -->
              <div class="phoenix-tier-pane" id="pane-acc-upgrade">
                <div style="background: linear-gradient(135deg, rgba(255,106,0,0.06), var(--surface-2)); border: 1.5px solid var(--line); border-radius: 16px; padding: 18px;">
                  <div style="display: flex; align-items: flex-start; gap: 12px;">
                    <span style="font-size: 32px;">🏪</span>
                    <div>
                      <strong style="font-size: 15px; color: var(--primary); display: block; margin-bottom: 6px;">${ui("ثبت‌نام و فعال‌سازی فروشندگی (سطح ۲)")}</strong>
                      <p style="font-size: 12.5px; color: var(--text); line-height: 1.7; margin: 0 0 10px;">
                        ${ui("با فعال‌سازی فروشندگی، امکانات کامل مدیریت فروشگاه، عرضه ۴ نوع محصول (فیزیکی، دانلودی، خدمت و متغیر)، تخفیف‌های زمان‌دار و ارتباط با خریداران به همین حساب اضافه می‌شود.")}
                      </p>
                      <ul style="font-size: 12px; color: var(--muted); line-height: 1.8; padding-inline-start: 18px; margin: 0 0 14px;">
                        <li><strong>${ui("یک هویت واحد:")}</strong> ${ui("حساب جدیدی ساخته نمی‌شود و اطلاعات قبلی شما کاملاً حفظ می‌گردد.")}</li>
                        <li>${ui("آدرس‌ها، سفارش‌های خرید و علاقه‌مندی‌های شما محفوظ می‌مانند.")}</li>
                        <li>${ui("امکان ارتقای بعدی به فروشگاه شرکتی (سطح ۳) برای قیمت‌گذاری پیشرفته و نمایندگی‌ها.")}</li>
                      </ul>
                      ${tier === "base" ? `
                        <button type="button" class="button button-primary button-sm" data-activate-seller style="padding: 8px 18px; font-size: 12.5px;">
                          ✦ ${ui("فعال‌سازی فوری فروشندگی (حفظ کامل اطلاعات)")}
                        </button>
                      ` : `
                        <span class="phoenix-tier-badge badge-success">✓ ${ui("فروشندگی در این حساب فعال است")}</span>
                        <a href="/business" data-nav class="button button-outline button-sm" style="margin-inline-start: 8px; font-size: 12px;">
                          ${ui("ورود به پنل فروشگاه من")} →
                        </a>
                      `}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
        })()}
      </div>
    </div>

    <!-- Reusable Invoice Modal Host -->
    <div id="phoenix-invoice-modal-host"></div>
  `;
}

/**
 * Screen 1.3: آپلود محتوا (انتخاب نوع محتوا)
 */
export function renderCreateContentHub(): string {
  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-screen-top">
        <a href="/" data-nav class="phoenix-screen-back-btn" aria-label="${ui("بازگشت")}">→</a>
        <div class="phoenix-screen-title-wrap">
          <h1 class="phoenix-screen-title">${ui("آپلود محتوا")}</h1>
          <div class="phoenix-screen-subtitle">${ui("چه محتوایی می‌خوای اضافه کنی؟")}</div>
        </div>
        <div style="width: 38px;"></div>
      </div>

      <div class="phoenix-screen-content">
        <div class="phoenix-action-grid" style="grid-template-columns: repeat(2, 1fr);">
          <a href="/create/details?type=image" data-nav class="phoenix-action-card" style="padding: 22px 14px;">
            <div class="phoenix-action-icon" aria-hidden="true">🖼️</div>
            <span class="phoenix-action-label">${ui("تصویر")}</span>
          </a>
          <a href="/create/details?type=video" data-nav class="phoenix-action-card" style="padding: 22px 14px;">
            <div class="phoenix-action-icon" aria-hidden="true">🎥</div>
            <span class="phoenix-action-label">${ui("ویدیو")}</span>
          </a>
          <a href="/create/details?type=audio" data-nav class="phoenix-action-card" style="padding: 22px 14px;">
            <div class="phoenix-action-icon" aria-hidden="true">🎙️</div>
            <span class="phoenix-action-label">${ui("صوت")}</span>
          </a>
          <a href="/create/details?type=idea" data-nav class="phoenix-action-card" style="padding: 22px 14px;">
            <div class="phoenix-action-icon" aria-hidden="true">💡</div>
            <span class="phoenix-action-label">${ui("ایده / نظر")}</span>
          </a>
          <a href="/create/details?type=service" data-nav class="phoenix-action-card" style="padding: 22px 14px;">
            <div class="phoenix-action-icon" aria-hidden="true">💼</div>
            <span class="phoenix-action-label">${ui("خدمت")}</span>
          </a>
          <a href="/create/details?type=product" data-nav class="phoenix-action-card" style="padding: 22px 14px;">
            <div class="phoenix-action-icon" aria-hidden="true">📦</div>
            <span class="phoenix-action-label">${ui("محصول")}</span>
          </a>
        </div>

        ${renderSmartAiCard(
          ui("ققنوس پیشنهاد می‌دهد:"),
          ui("برای جذب مشتری، ۳ عکس با کیفیت بالا و نور مناسب بارگذاری کن.")
        )}
      </div>
    </div>
  `;
}

/**
 * Screen 1.4: جزئیات محتوا (فرم ثبت و قیمت)
 */
export function renderContentDetailsForm(): string {
  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-screen-top">
        <a href="/create" data-nav class="phoenix-screen-back-btn" aria-label="${ui("بازگشت")}">→</a>
        <div class="phoenix-screen-title-wrap">
          <h1 class="phoenix-screen-title">${ui("جزئیات محتوا")}</h1>
        </div>
        <div style="width: 38px;"></div>
      </div>

      <form class="phoenix-screen-content" id="content-details-form">
        <!-- Media container with preview -->
        <label for="content-media-upload" class="phoenix-upload-box" id="upload-preview-box">
          <input type="file" id="content-media-upload" accept="image/*,video/*" style="display:none;" />
          <div class="phoenix-upload-box-icon" aria-hidden="true">📷</div>
          <strong style="font-size: 14px;">${ui("عکس آپلود شده توسط کاربر")}</strong>
          <small style="color: var(--muted);">${ui("برای تغییر تصویر کلیک کنید")}</small>
        </label>

        <!-- Description Field -->
        <div>
          <label for="content-desc-input" class="field-label" style="font-size: 13px; font-weight: 700; margin-bottom: 6px; display: block;">
            ${ui("توضیحات")}
          </label>
          <textarea id="content-desc-input" rows="4" class="studio-input-line" style="width:100%; border-radius:14px; padding:12px; font-family:inherit;" placeholder="${ui("توضیحات را اینجا بنویسید…")}">محصول تمیز و آماده استفاده، دارای تضمین کیفیت و مهلت تست.</textarea>
        </div>

        <!-- Suggested Price Field -->
        <div>
          <label for="content-price-input" class="field-label" style="font-size: 13px; font-weight: 700; margin-bottom: 6px; display: block;">
            ${ui("قیمت پیشنهادی (تومان)")}
          </label>
          <input type="text" id="content-price-input" class="studio-input-line" style="width:100%; border-radius:14px; padding:12px;" value="150,000" placeholder="${ui("قیمت را وارد کنید…")}" />
        </div>

        <button type="submit" class="phoenix-primary-cta" style="margin-top: 10px;">
          <span>${ui("ثبت و ادامه")}</span>
          <span aria-hidden="true">←</span>
        </button>
      </form>
    </div>
  `;
}

/**
 * Screen 1.5: انتخاب نوع معامله
 */
export function renderDealTypeSelection(): string {
  const deals = [
    { id: "sell", label: "بفروشم", desc: "پیشنهاد به خریداران مرتبط", icon: "🏷️" },
    { id: "buy", label: "بخرم", desc: "جستجوی آگهی‌های مشابه", icon: "🛒" },
    { id: "rent", label: "اجاره بدم", desc: "مدیریت قرارداد و پرداخت", icon: "🔑" },
    { id: "trade", label: "معاوضه کنم", desc: "پیشنهاد برای معاوضه", icon: "🔄" },
    { id: "auction", label: "مزایده بذارم", desc: "شروع مزایده و جذب پیشنهاد", icon: "⚡" },
    { id: "tender", label: "مناقصه انجام بدم", desc: "برای پروژه‌های بزرگ", icon: "📋" },
  ];

  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-screen-top">
        <a href="/create/details" data-nav class="phoenix-screen-back-btn" aria-label="${ui("بازگشت")}">→</a>
        <div class="phoenix-screen-title-wrap">
          <h1 class="phoenix-screen-title">${ui("انتخاب معامله")}</h1>
          <div class="phoenix-screen-subtitle">${ui("الان می‌خوای با این محتوا چیکار کنی؟")}</div>
        </div>
        <div style="width: 38px;"></div>
      </div>

      <div class="phoenix-screen-content">
        <div class="phoenix-deal-list" id="deal-options-list">
          ${deals.map((d, index) => `
            <button type="button" class="phoenix-deal-card ${index === 0 ? "selected" : ""}" data-deal-type="${d.id}">
              <div class="phoenix-deal-card-icon" aria-hidden="true">${d.icon}</div>
              <div class="phoenix-deal-card-copy">
                <strong>${ui(d.label)}</strong>
                <small>${ui(d.desc)}</small>
              </div>
            </button>
          `).join("")}
        </div>

        <button type="button" class="phoenix-primary-cta" id="confirm-deal-btn" style="margin-top: 8px;">
          <span>${ui("تأیید و انتشار معامله")}</span>
          <span aria-hidden="true">✓</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Screen 1.6: پروفایل کاربر حقیقی
 */
export function renderIndividualProfile(): string {
  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-screen-top">
        <a href="/" data-nav class="phoenix-screen-back-btn" aria-label="${ui("بازگشت")}">→</a>
        <div class="phoenix-screen-title-wrap">
          <h1 class="phoenix-screen-title">${ui("پروفایل کاربری")}</h1>
        </div>
        <div style="width: 38px;"></div>
      </div>

      <div class="phoenix-screen-content">
        <!-- Profile Hero -->
        <div class="phoenix-profile-hero">
          <div class="phoenix-profile-avatar-big">👤</div>
          <strong style="font-size: 17px; margin-top: 4px;">${ui("حساب من · اطلاعات فردی و دسترسی‌ها")}</strong>
          <span class="phoenix-profile-badge">● ${ui("عضو معتبر پلتفرم")}</span>
        </div>

        <!-- Score & Progress -->
        <div class="phoenix-profile-progress-box">
          <div class="phoenix-progress-header">
            <span>${ui("امتیاز: ۲۸۰")}</span>
            <span style="color: var(--muted); font-size: 11px;">${ui("اعتبار عضویت در پلتفرم")}</span>
          </div>
          <div class="phoenix-progress-bar">
            <div class="phoenix-progress-fill" style="width: 70%;"></div>
          </div>
        </div>

        <!-- Stats Counters -->
        <div class="phoenix-stats-row">
          <div class="phoenix-stat-card">
            <span class="phoenix-stat-num">۵</span>
            <span class="phoenix-stat-label">${ui("خدمت")}</span>
          </div>
          <div class="phoenix-stat-card">
            <span class="phoenix-stat-num">۳</span>
            <span class="phoenix-stat-label">${ui("معامله")}</span>
          </div>
          <div class="phoenix-stat-card">
            <span class="phoenix-stat-num">۵</span>
            <span class="phoenix-stat-label">${ui("محتوا")}</span>
          </div>
        </div>

        <!-- Seller Activation Banner: Seamless seller activation without data loss -->
        <div class="phoenix-suggestion-banner" style="margin-top:14px; background:linear-gradient(135deg, rgba(255,107,0,0.08), var(--surface)); border:1.5px solid var(--line);">
          <div class="phoenix-suggestion-copy">
            <strong style="color:var(--primary); font-size:14px;">🏪 ${ui("قصـد فروش کالا یا ارائـه خدمت دارید؟")}</strong>
            <small style="font-size:12px; color:var(--muted);">${ui("حساب کاربری خود را بدون نیاز به ساخت حساب مجدد به پنل فروشندگی ارتقا دهید.")}</small>
          </div>
          <button type="button" class="button button-primary button-sm" data-activate-seller style="font-size:12px; padding:6px 14px; margin-top:8px;">
            ✦ ${ui("فعال‌سازی فروشندگی")}
          </button>
        </div>

        <!-- Menu Navigation List -->
        <div class="phoenix-menu-list">
          <button type="button" class="phoenix-menu-item" data-toast="${ui("اطلاعات حساب شما با موفقیت فراخوانی شد.")}">
            <span>👤 ${ui("اطلاعات کاربری")}</span>
            <span aria-hidden="true" style="color: var(--faint);">←</span>
          </button>
          <a href="/settings" data-nav class="phoenix-menu-item">
            <span>⚙️ ${ui("تنظیمات")}</span>
            <span aria-hidden="true" style="color: var(--faint);">←</span>
          </a>
          <button type="button" class="phoenix-menu-item" data-toast="${ui("پشتیبانی ۲۴ ساعته ققنوس آماده پاسخگویی است.")}">
            <span>🎧 ${ui("پشتیبانی")}</span>
            <span aria-hidden="true" style="color: var(--faint);">←</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Screen 1.7: اعلان‌ها
 */
export function renderIndividualNotifications(): string {
  const notifs = [
    { title: "یک نفر به محتوای شما علاقمند شد", time: "۲ دقیقه پیش", icon: "❤️", cat: "all" },
    { title: "پیام جدید: کاربر سلام قیمت رو می‌فرمایید؟", time: "۵ دقیقه پیش", icon: "💬", cat: "messages" },
    { title: "معامله موفق: خرید شما با موفقیت انجام شد", time: "۱ ساعت پیش", icon: "✅", cat: "deals" },
    { title: "پیشنهاد ویژه: برای شما تخفیف اختصاصی فعال شد", time: "۲ ساعت پیش", icon: "⭐", cat: "all" },
    { title: "یادآوری: مهلت پرداخت سفارش نزدیک است", time: "۲ ساعت پیش", icon: "🔔", cat: "deals" },
  ];

  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-screen-top">
        <a href="/" data-nav class="phoenix-screen-back-btn" aria-label="${ui("بازگشت")}">→</a>
        <div class="phoenix-screen-title-wrap">
          <h1 class="phoenix-screen-title">${ui("اعلان‌ها")}</h1>
        </div>
        <div style="width: 38px;"></div>
      </div>

      <div class="phoenix-screen-content">
        <!-- Tabs -->
        <div class="phoenix-segmented-tabs" id="notif-tabs">
          <button type="button" class="phoenix-tab-btn active" data-notif-filter="all">${ui("همه")}</button>
          <button type="button" class="phoenix-tab-btn" data-notif-filter="messages">${ui("پیام‌ها")}</button>
          <button type="button" class="phoenix-tab-btn" data-notif-filter="deals">${ui("معاملات")}</button>
        </div>

        <!-- List -->
        <div class="phoenix-deal-list" id="notif-items-list">
          ${notifs.map((n) => `
            <div class="phoenix-notification-item" data-category="${n.cat}">
              <div class="phoenix-notif-icon" aria-hidden="true">${n.icon}</div>
              <div class="phoenix-notif-body">
                <strong>${ui(n.title)}</strong>
                <small>${ui(n.time)}</small>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// ROW 2: کاربر حقوقی (شرکت / کسب‌وکار) - Screens 2.1 to 2.7
// -----------------------------------------------------------------------------

/**
 * Screen 2.1: خوشامدگویی کاربر حقوقی
 */
export function renderBusinessWelcome(): string {
  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-welcome-container">
        <img class="phoenix-welcome-logo" src="/phoenix-mark.svg?v=2" alt="ققنوس" />
        <h1 class="phoenix-welcome-greeting">
          ${ui("سلام!")}
          <span>${ui("من ققنوس هستم دستیار کسب‌وکار شما")}</span>
        </h1>
        <p class="phoenix-welcome-desc">
          ${ui("کسب‌وکارت رو هوشمندانه گسترش بده و به بازارگاه و تقاضای سراسری متصل شو.")}
        </p>
        <ul class="phoenix-welcome-bullets">
          <li>${ui("ارتقا به فروشگاه شرکتی و احراز هویت")}</li>
          <li>${ui("پروفایل سازمانی و کاتالوگ محصولات")}</li>
          <li>${ui("ایجاد محتوای تجاری و تبلیغاتی")}</li>
          <li>${ui("مدیریت اعضای تیم و دسترسی‌ها")}</li>
          <li>${ui("معاملات عمده، قراردادها و مناقصات")}</li>
        </ul>
        <a href="/business" data-nav class="phoenix-primary-cta">
          <span>${ui("شروع کنیم")}</span>
          <span aria-hidden="true">←</span>
        </a>
      </div>
    </div>
  `;
}

/**
 * Screen 2.2: پنل سازمانی (داشبورد کسب‌وکار)
 */
export function renderBusinessPanel(): string {
  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-dashboard-hero">
        <div class="phoenix-org-header-box" style="width: 100%; display:flex; align-items:center; justify-content:space-between;">
          <div class="phoenix-org-selector">
            <span>🏢</span>
            <span>شرکت پارس تجارت</span>
            <span style="font-size: 12px; color: var(--faint);">⌄</span>
          </div>
          <a href="/business/team" data-nav class="phoenix-add-btn">
            <span>＋</span>
            <span>${ui("افزودن عضو")}</span>
          </a>
        </div>
      </div>

      <div class="phoenix-screen-content">
        <!-- Business Counters -->
        <div class="phoenix-stats-row">
          <div class="phoenix-stat-card">
            <span class="phoenix-stat-num">۴</span>
            <span class="phoenix-stat-label">${ui("تیم")}</span>
          </div>
          <div class="phoenix-stat-card">
            <span class="phoenix-stat-num">۸</span>
            <span class="phoenix-stat-label">${ui("معامله")}</span>
          </div>
          <div class="phoenix-stat-card">
            <span class="phoenix-stat-num">۱۲</span>
            <span class="phoenix-stat-label">${ui("محتوا")}</span>
          </div>
        </div>

        <!-- Recent Activities Feed -->
        <div style="background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 18px; margin-bottom: 16px;">
          <h2 style="font-size: 14px; font-weight: 800; margin: 0 0 12px;">${ui("آخرین فعالیت‌ها")}</h2>
          <div class="phoenix-deal-list">
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom: 1px solid var(--line);">
              <span style="font-size: 13px;">${ui("مذاکره با مشتری جدید")}</span>
              <small style="color: var(--faint); font-size: 11px;">${ui("۲ ساعت پیش")}</small>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom: 1px solid var(--line);">
              <span style="font-size: 13px;">${ui("پیشنهاد صادرات محصول")}</span>
              <small style="color: var(--faint); font-size: 11px;">${ui("۵ ساعت پیش")}</small>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0;">
              <span style="font-size: 13px;">${ui("قرارداد امضا شد")}</span>
              <small style="color: var(--faint); font-size: 11px;">${ui("۱ روز پیش")}</small>
            </div>
          </div>
        </div>

        <!-- Quick Access to Business Features -->
        <div class="phoenix-action-grid" style="grid-template-columns: repeat(2, 1fr); margin-bottom: 20px;">
          <a href="/business/create" data-nav class="phoenix-action-card">
            <div class="phoenix-action-icon" aria-hidden="true">📤</div>
            <span class="phoenix-action-label">${ui("ایجاد محتوای تجاری")}</span>
          </a>
          <a href="/business/deals" data-nav class="phoenix-action-card">
            <div class="phoenix-action-icon" aria-hidden="true">🤝</div>
            <span class="phoenix-action-label">${ui("درخواست همکاری / معامله")}</span>
          </a>
        </div>

        <!-- LEVEL 2 & LEVEL 3 STORE DASHBOARD SECTIONS -->
        ${(() => {
          const tier = accountTierService.getAccountTier();
          const corpStatus = accountTierService.getCorporateVerificationStatus();
          const corpProfile = accountTierService.getCorporateProfile();
          const storeInfo = accountTierService.getStoreInfo();
          const products = accountTierService.getStoreProducts();
          const customers = accountTierService.getStoreCustomers();
          const discounts = accountTierService.getStoreDiscounts();

          if (tier === "base") {
            return `
              <div style="background: linear-gradient(135deg, rgba(255,106,0,0.08), var(--surface)); border: 1.5px solid var(--line); border-radius: 20px; padding: 24px; text-align: center;">
                <span style="font-size: 40px; display: block; margin-bottom: 8px;">🏪</span>
                <h3 style="font-size: 16px; font-weight: 800; color: var(--primary); margin: 0 0 8px;">${ui("فعال‌سازی فروشندگی در حساب شما")}</h3>
                <p style="font-size: 13px; color: var(--text); max-width: 540px; margin: 0 auto 16px; line-height: 1.7;">
                  ${ui("حساب کاربری شما در سطح پایه قرار دارد. با انتخاب دکمه زیر، بدون نیاز به ثبت‌نام مجدد یا ایجاد حساب جدید، کلیه قابلیت‌های فروشگاه، ثبت محصولات (۴ نوع عرضه)، تخفیف‌های زمان‌دار و مدیریت مشتریان به همین حساب اضافه می‌شود.")}
                </p>
                <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
                  <button type="button" class="button button-primary" data-activate-seller style="padding: 10px 24px; font-size: 13px;">
                    ✦ ${ui("فعال‌سازی فوری فروشندگی (فروشگاه من)")}
                  </button>
                  <a href="/" data-nav class="button button-outline" style="padding: 10px 20px; font-size: 13px;">
                    ${ui("بازگشت به حساب من")}
                  </a>
                </div>
              </div>
            `;
          }

          const isCorporate = tier === "corporate_seller";
          const isCorpApproved = isCorporate && corpStatus === "approved";

          return `
            <div class="phoenix-store-management-box" style="background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 22px;">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid var(--line); padding-bottom: 14px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <h2 style="font-size: 16px; font-weight: 800; margin: 0; color: var(--text);">${escapeHtml(storeInfo.name)}</h2>
                    <span class="phoenix-tier-badge ${isCorpApproved ? "badge-success" : isCorporate && corpStatus === "pending_review" ? "badge-warning" : isCorporate && corpStatus === "rejected" ? "badge-danger" : "badge-info"}">
                      ${!isCorporate ? "سطح ۲: فروشگاه فعال" : corpStatus === "approved" ? "سطح ۳: فروشگاه شرکتی (تأییدشده)" : corpStatus === "pending_review" ? "سطح ۳: در انتظار بررسی مدارک" : "سطح ۳: رد مدارک"}
                    </span>
                  </div>
                  <small style="color: var(--muted); font-size: 12px; display: block; margin-top: 4px;">${escapeHtml(storeInfo.description)}</small>
                </div>
                <div>
                  ${!isCorporate ? `
                    <button type="button" class="button button-primary button-sm" id="btn-show-corp-upgrade-form" style="font-size: 12px;">
                      🏢 ${ui("درخواست ارتقا به فروشگاه شرکتی")}
                    </button>
                  ` : ""}
                </div>
              </div>

              <!-- Rejection or Pending Notice for Corporate Status -->
              ${isCorporate && corpStatus === "pending_review" ? `
                <div style="background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.25); border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; font-size: 12.5px; color: var(--text);">
                  ⏳ <strong>${ui("وضعیت درخواست شرکتی: در انتظار بررسی کارشناسان ققنوس.")}</strong>
                  <p style="margin: 4px 0 0; color: var(--muted); font-size: 12px;">${ui("منوهای مربوط به امکانات پیشرفته نمایش داده می‌شوند؛ اما انتشار قیمت‌های ویژه نمایندگان و امکانات سازمانی تا زمان تأیید نهایی مجاز نخواهد بود.")}</p>
                </div>
              ` : ""}

              ${isCorporate && corpStatus === "rejected" ? `
                <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; font-size: 12.5px; color: var(--text);">
                  ❌ <strong>${ui("درخواست ارتقای شرکتی رد شده است.")}</strong>
                  <p style="margin: 4px 0 0; color: var(--danger); font-size: 12px;">${ui("دلیل رد درخواست:")} ${escapeHtml(corpProfile?.rejectionReason || "مدارک ثبت شرکت یا شناسه اقتصادی نامعتبر است.")}</p>
                </div>
              ` : ""}

              <!-- Store Navigation Tabs -->
              <div class="phoenix-tier-nav" role="tablist">
                <button type="button" class="phoenix-tier-tab-btn active" data-tab-target="pane-biz-info">
                  <span>🏪</span> ${ui("اطلاعات فروشگاه")}
                </button>
                <button type="button" class="phoenix-tier-tab-btn" data-tab-target="pane-biz-products">
                  <span>📦</span> ${ui("محصولات و ۴ نوع عرضه")} (${products.length})
                </button>
                <button type="button" class="phoenix-tier-tab-btn" data-tab-target="pane-biz-customers">
                  <span>👥</span> ${ui("مدیریت خریداران (CRM)")} (${customers.length})
                </button>
                <button type="button" class="phoenix-tier-tab-btn" data-tab-target="pane-biz-discounts">
                  <span>٪</span> ${ui("تخفیف‌های زمان‌دار")} (${discounts.length})
                </button>
                <button type="button" class="phoenix-tier-tab-btn" data-tab-target="pane-biz-corp">
                  <span>🏢</span> ${ui("مدیریت سازمانی و مدارک")}
                </button>
              </div>

              <!-- Tab 1: Store Info & Financials -->
              <div class="phoenix-tier-pane active" id="pane-biz-info">
                <form id="level2-store-info-form" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; max-width: 680px; margin-bottom: 20px;">
                  <div>
                    <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">${ui("نام فروشگاه")}</label>
                    <input type="text" id="store-info-name" class="studio-input-line" style="width:100%; border-radius:10px; padding:8px;" value="${escapeHtml(storeInfo.name)}" required />
                  </div>
                  <div>
                    <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">${ui("شماره تماس پشتیبانی فروشگاه")}</label>
                    <input type="tel" id="store-info-phone" class="studio-input-line" style="width:100%; border-radius:10px; padding:8px; direction:ltr; text-align:right;" value="${escapeHtml(storeInfo.phone)}" required />
                  </div>
                  <div style="grid-column: 1 / -1;">
                    <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">${ui("توضیحات معرفی فروشگاه")}</label>
                    <input type="text" id="store-info-desc" class="studio-input-line" style="width:100%; border-radius:10px; padding:8px;" value="${escapeHtml(storeInfo.description)}" required />
                  </div>
                  <div style="grid-column: 1 / -1;">
                    <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">${ui("نشانی فیزیکی فروشگاه")}</label>
                    <input type="text" id="store-info-address" class="studio-input-line" style="width:100%; border-radius:10px; padding:8px;" value="${escapeHtml(storeInfo.address)}" required />
                  </div>
                  <div style="grid-column: 1 / -1;">
                    <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">${ui("شماره شبا جهت تسویه بانکی")}</label>
                    <input type="text" id="store-info-sheba" class="studio-input-line" style="width:100%; border-radius:10px; padding:8px; direction:ltr; text-align:right;" value="${escapeHtml(storeInfo.sheba)}" required />
                  </div>
                  <div style="grid-column: 1 / -1; display:flex; justify-content:flex-end;">
                    <button type="submit" class="button button-primary button-sm">${ui("ذخیره مشخصات فروشگاه")}</button>
                  </div>
                </form>

                <h4 style="font-size: 13px; font-weight: 700; margin: 16px 0 8px;">${ui("گزارش فروش و سوابق تراکنش‌ها")}</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
                  <div style="background: var(--surface-2); border: 1px solid var(--line); border-radius: 12px; padding: 12px;">
                    <small style="color:var(--muted);">${ui("کل فروش ماه جاری")}</small>
                    <strong style="display:block; font-size:16px; color:var(--primary); margin-top:4px;">۶۴,۸۰۰,۰۰۰ تومان</strong>
                  </div>
                  <div style="background: var(--surface-2); border: 1px solid var(--line); border-radius: 12px; padding: 12px;">
                    <small style="color:var(--muted);">${ui("سفارش‌های تسویه‌شده")}</small>
                    <strong style="display:block; font-size:16px; margin-top:4px;">۱۸ سفارش</strong>
                  </div>
                  <div style="background: var(--surface-2); border: 1px solid var(--line); border-radius: 12px; padding: 12px;">
                    <small style="color:var(--muted);">${ui("سفارش‌های مرجوعی / لغوشده")}</small>
                    <strong style="display:block; font-size:16px; color:var(--muted); margin-top:4px;">۰ مورد</strong>
                  </div>
                </div>
              </div>

              <!-- Tab 2: Products & 4 Offering Types -->
              <div class="phoenix-tier-pane" id="pane-biz-products">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
                  <div>
                    <h4 style="font-size: 13.5px; font-weight: 700; margin: 0 0 2px;">${ui("محصولات و عرضه فروشگاه")}</h4>
                    <span style="font-size: 12px; color: var(--muted);">${ui("پشتیبانی کامل از ۴ نوع: محصول فیزیکی، دیجیتال/دانلودی، خدمت و محصول متغیر")}</span>
                  </div>
                  <button type="button" class="button button-outline button-sm" id="btn-toggle-new-product">
                    ＋ ${ui("افزودن محصول جدید")}
                  </button>
                </div>

                <!-- Add Product Form (Supporting 4 Offering Types) -->
                <form id="level2-add-product-form" style="display: none; background: var(--surface-2); border: 1px solid var(--line); border-radius: 16px; padding: 18px; margin-bottom: 16px;">
                  <h4 style="font-size: 13px; font-weight: 700; margin: 0 0 12px;">${ui("مشخصات عرضه جدید")}</h4>
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 12px;">
                    <div>
                      <label style="display:block; font-size:11px; margin-bottom:4px;">${ui("عنوان کالا یا خدمت")}</label>
                      <input type="text" id="new-prod-title" class="studio-input-line" required placeholder="مثال: پایانه پرداخت بی‌سیم" style="width:100%; padding:8px; border-radius:8px;" />
                    </div>
                    <div>
                      <label style="display:block; font-size:11px; margin-bottom:4px;">${ui("نوع عرضه")}</label>
                      <select id="new-prod-type" class="studio-input-line" style="width:100%; padding:8px; border-radius:8px;">
                        <option value="physical">کالای فیزیکی</option>
                        <option value="digital">محصول دیجیتال / دانلودی</option>
                        <option value="service">خدمت / مشاوره</option>
                        <option value="variable">محصول متغیر (رنگ/سایز/مدل)</option>
                      </select>
                    </div>
                    <div>
                      <label style="display:block; font-size:11px; margin-bottom:4px;">${ui("قیمت پایه (تومان)")}</label>
                      <input type="number" id="new-prod-price" class="studio-input-line" required placeholder="مثال: 1200000" style="width:100%; padding:8px; border-radius:8px;" />
                    </div>
                    <div>
                      <label style="display:block; font-size:11px; margin-bottom:4px;">${ui("موجودی انبار")}</label>
                      <input type="number" id="new-prod-inventory" class="studio-input-line" value="25" style="width:100%; padding:8px; border-radius:8px;" />
                    </div>
                  </div>

                  <!-- Type-specific field hints -->
                  <div id="new-prod-extra-fields" style="background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px; margin-bottom: 12px; font-size: 12px;">
                    <span id="new-prod-type-hint" style="color: var(--muted);">${ui("کالای فیزیکی: موجودی، کنترل انبار و وزن کالا لحاظ می‌شود.")}</span>
                  </div>

                  <!-- Advanced Tier 3 Pricing Fields (Corporate approved) -->
                  ${isCorporate ? `
                    <div style="background: ${isCorpApproved ? "rgba(34,197,94,0.06)" : "rgba(234,179,8,0.06)"}; border: 1px solid var(--line); border-radius: 12px; padding: 12px; margin-bottom: 12px;">
                      <strong style="display:block; font-size:12px; margin-bottom:6px; color: ${isCorpApproved ? "var(--success)" : "var(--warning)"};">
                        ✦ ${ui("قیمت‌گذاری پیشرفته شرکتی (نقش‌ها و پلکانی تعدادی)")} ${!isCorpApproved ? "(تا تأیید مدارک غیرفعال است)" : ""}
                      </strong>
                      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px;">
                        <div>
                          <label style="display:block; font-size:11px; margin-bottom:2px;">${ui("قیمت مشتری ویژه (تومان)")}</label>
                          <input type="number" id="new-prod-role-vip" class="studio-input-line" ${!isCorpApproved ? "disabled" : ""} placeholder="اختیاری" style="width:100%; padding:6px; border-radius:6px;" />
                        </div>
                        <div>
                          <label style="display:block; font-size:11px; margin-bottom:2px;">${ui("قیمت نماینده سطح ۱ (تومان)")}</label>
                          <input type="number" id="new-prod-role-agent1" class="studio-input-line" ${!isCorpApproved ? "disabled" : ""} placeholder="اختیاری" style="width:100%; padding:6px; border-radius:6px;" />
                        </div>
                        <div>
                          <label style="display:block; font-size:11px; margin-bottom:2px;">${ui("قیمت پلکانی (۱۰ عدد به بالا)")}</label>
                          <input type="number" id="new-prod-tier-qty10" class="studio-input-line" ${!isCorpApproved ? "disabled" : ""} placeholder="اختیاری" style="width:100%; padding:6px; border-radius:6px;" />
                        </div>
                      </div>
                    </div>
                  ` : ""}

                  <div style="display: flex; gap: 8px;">
                    <button type="submit" class="button button-primary button-sm">${ui("ثبت و انتشار محصول")}</button>
                    <button type="button" class="button button-ghost button-sm" id="btn-cancel-new-prod">${ui("انصراف")}</button>
                  </div>
                </form>

                <!-- Products Table -->
                <div style="overflow-x: auto;">
                  <table class="phoenix-data-table">
                    <thead>
                      <tr>
                        <th>${ui("عنوان و نوع")}</th>
                        <th>${ui("نوع عرضه")}</th>
                        <th>${ui("قیمت پایه")}</th>
                        <th>${ui("موجودی")}</th>
                        <th>${ui("وضعیت")}</th>
                        <th>${ui("عملیات")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${products.map((p) => {
                        const typeFa = p.type === "physical" ? "فیزیکی" : p.type === "digital" ? "دیجیتال/دانلود" : p.type === "service" ? "خدمت/مشاوره" : "محصول متغیر";
                        const statusBadge = p.status === "published" ? "badge-success" : p.status === "draft" ? "badge-warning" : "badge-danger";
                        const statusFa = p.status === "published" ? "منتشرشده" : p.status === "draft" ? "پیش‌نویس" : "غیرفعال";
                        return `
                          <tr>
                            <td><strong>${escapeHtml(p.title)}</strong></td>
                            <td><span class="phoenix-tier-badge badge-info">${typeFa}</span></td>
                            <td>${p.basePriceMinor.toLocaleString("fa-IR")} تومان</td>
                            <td>${p.inventory}</td>
                            <td><span class="phoenix-tier-badge ${statusBadge}">${statusFa}</span></td>
                            <td>
                              <div style="display:flex; gap:4px;">
                                ${p.status !== "published" ? `
                                  <button type="button" class="button button-ghost button-sm" data-prod-status="${p.id}" data-status="published" style="font-size:10.5px; padding:2px 6px;">
                                    انتشار
                                  </button>
                                ` : `
                                  <button type="button" class="button button-ghost button-sm" data-prod-status="${p.id}" data-status="disabled" style="font-size:10.5px; padding:2px 6px; color:var(--muted);">
                                    غیرفعال
                                  </button>
                                `}
                              </div>
                            </td>
                          </tr>
                        `;
                      }).join("")}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Tab 3: Store Customer CRM (Store Scoped) -->
              <div class="phoenix-tier-pane" id="pane-biz-customers">
                <div style="margin-bottom: 14px;">
                  <h4 style="font-size: 13.5px; font-weight: 700; margin: 0 0 2px;">${ui("مدیریت خریداران و گروه‌بندی مشتریان")}</h4>
                  <small style="color: var(--muted); font-size: 12px; display: block;">
                    ${ui("این دسته‌بندی و نقش‌ها صرفاً در رابطه خریدار با همین فروشگاه معتبر است و فروشگاه‌های دیگر دسته‌بندی مستقل خود را دارند.")}
                  </small>
                </div>

                <div style="overflow-x: auto;">
                  <table class="phoenix-data-table">
                    <thead>
                      <tr>
                        <th>${ui("نام خریدار")}</th>
                        <th>${ui("شماره موبایل")}</th>
                        <th>${ui("نقش / گروه در این فروشگاه")}</th>
                        <th>${ui("تعداد خرید")}</th>
                        <th>${ui("یادداشت فروشگاه")}</th>
                        <th>${ui("تغییر نقش")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${customers.map((c) => {
                        const roleLabel = BUYER_ROLE_LABELS_FA[c.role] || c.role;
                        return `
                          <tr>
                            <td><strong>${escapeHtml(c.buyerName)}</strong></td>
                            <td style="direction:ltr; text-align:right;">${escapeHtml(c.buyerMobile)}</td>
                            <td><span class="phoenix-tier-badge badge-info">${roleLabel}</span></td>
                            <td>${c.ordersCount} سفارش</td>
                            <td><small style="color:var(--muted);">${escapeHtml(c.notes || "—")}</small></td>
                            <td>
                              <select class="studio-input-line" data-change-customer-role="${c.buyerId}" style="padding:4px 8px; font-size:11px; border-radius:6px;">
                                <option value="regular" ${c.role === "regular" ? "selected" : ""}>مشتری عادی</option>
                                <option value="vip" ${c.role === "vip" ? "selected" : ""}>مشتری ویژه</option>
                                ${isCorporate ? `
                                  <option value="consumer" ${c.role === "consumer" ? "selected" : ""}>مصرف‌کننده</option>
                                  <option value="tier_1_agent" ${c.role === "tier_1_agent" ? "selected" : ""}>نماینده سطح ۱</option>
                                  <option value="tier_2_agent" ${c.role === "tier_2_agent" ? "selected" : ""}>نماینده سطح ۲</option>
                                  <option value="tier_3_agent" ${c.role === "tier_3_agent" ? "selected" : ""}>نماینده سطح ۳</option>
                                ` : ""}
                              </select>
                            </td>
                          </tr>
                        `;
                      }).join("")}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Tab 4: Timed Discounts -->
              <div class="phoenix-tier-pane" id="pane-biz-discounts">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                  <div>
                    <h4 style="font-size: 13.5px; font-weight: 700; margin: 0 0 2px;">${ui("تخفیف‌های زمان‌دار فروشگاه")}</h4>
                    <span style="font-size: 12px; color: var(--muted);">${ui("تعریف تخفیف درصدی یا ثابت با تاریخ شروع، انقضا و سقف استفاده")}</span>
                  </div>
                  <button type="button" class="button button-outline button-sm" id="btn-toggle-new-discount">
                    ＋ ${ui("تعریف تخفیف جدید")}
                  </button>
                </div>

                <!-- Add Discount Form -->
                <form id="level2-add-discount-form" style="display: none; background: var(--surface-2); border: 1px solid var(--line); border-radius: 14px; padding: 16px; margin-bottom: 14px;">
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 10px;">
                    <div>
                      <label style="display:block; font-size:11px; margin-bottom:2px;">${ui("نوع تخفیف")}</label>
                      <select id="new-disc-type" class="studio-input-line" style="width:100%; padding:8px; border-radius:8px;">
                        <option value="percentage">درصدی (٪)</option>
                        <option value="fixed">مبلغ ثابت (تومان)</option>
                      </select>
                    </div>
                    <div>
                      <label style="display:block; font-size:11px; margin-bottom:2px;">${ui("مقدار تخفیف")}</label>
                      <input type="number" id="new-disc-val" class="studio-input-line" required placeholder="مثال: 15" style="width:100%; padding:8px; border-radius:8px;" />
                    </div>
                    <div>
                      <label style="display:block; font-size:11px; margin-bottom:2px;">${ui("سقف تعداد استفاده")}</label>
                      <input type="number" id="new-disc-max" class="studio-input-line" value="100" style="width:100%; padding:8px; border-radius:8px;" />
                    </div>
                    <div>
                      <label style="display:block; font-size:11px; margin-bottom:2px;">${ui("حداقل مبلغ سفارش (تومان)")}</label>
                      <input type="number" id="new-disc-min-order" class="studio-input-line" value="500000" style="width:100%; padding:8px; border-radius:8px;" />
                    </div>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <button type="submit" class="button button-primary button-sm">${ui("ثبت تخفیف")}</button>
                    <button type="button" class="button button-ghost button-sm" id="btn-cancel-new-discount">${ui("انصراف")}</button>
                  </div>
                </form>

                <div style="display: flex; flex-direction: column; gap: 8px;">
                  ${discounts.map((d) => `
                    <div style="background: var(--surface-2); border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                      <div>
                        <strong>${d.discountType === "percentage" ? `${d.value}٪ تخفیف درصدی` : `${d.value.toLocaleString("fa-IR")} تومان تخفیف ثابت`}</strong>
                        <small style="color: var(--muted); display: block; margin-top: 2px;">
                          استفاده شده: ${d.usedCount} از ${d.maxUses || "نامحدود"} · حداقل مبلغ: ${(d.minOrderAmount || 0).toLocaleString("fa-IR")} تومان
                        </small>
                      </div>
                      <span class="phoenix-tier-badge badge-success">فعال</span>
                    </div>
                  `).join("")}
                </div>
              </div>

              <!-- Tab 5: Corporate Upgrade & Verification (Level 3) -->
              <div class="phoenix-tier-pane" id="pane-biz-corp">
                <div style="background: var(--surface-2); border: 1px solid var(--line); border-radius: 16px; padding: 18px; max-width: 680px;">
                  <h4 style="font-size: 14px; font-weight: 700; margin: 0 0 8px;">🏢 ${ui("ارتقا به سطح ۳: فروشگاه شرکتی و سازمانی")}</h4>
                  <p style="font-size: 12.5px; color: var(--muted); line-height: 1.6; margin: 0 0 14px;">
                    ${ui("با فعال‌سازی فروشندگی شرکتی، امکانات پیشرفته قیمت‌گذاری اختصاصی برای ۵ نقش خریداران و قیمت‌های پلکانی حجمی فعال خواهد شد. اطلاعات ثبتی شرکت خود را جهت احراز هویت وارد فرمایید.")}
                  </p>

                  <form id="level3-corp-upgrade-form" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 16px;">
                    <div>
                      <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">${ui("نام ثبتی شرکت")}</label>
                      <input type="text" id="corp-company-name" class="studio-input-line" required placeholder="مثال: شرکت پیشگامان ققنوس" value="${escapeHtml(corpProfile?.companyName || "")}" style="width:100%; padding:8px; border-radius:8px;" />
                    </div>
                    <div>
                      <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">${ui("شماره ثبت")}</label>
                      <input type="text" id="corp-reg-number" class="studio-input-line" required placeholder="مثال: 543210" value="${escapeHtml(corpProfile?.registrationNumber || "")}" style="width:100%; padding:8px; border-radius:8px; direction:ltr; text-align:right;" />
                    </div>
                    <div>
                      <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">${ui("شناسه ملی (۱۱ رقم)")}</label>
                      <input type="text" id="corp-national-id" class="studio-input-line" placeholder="مثال: 10103984215" value="${escapeHtml(corpProfile?.nationalId || "")}" style="width:100%; padding:8px; border-radius:8px; direction:ltr; text-align:right;" />
                    </div>
                    <div>
                      <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">${ui("کد اقتصادی")}</label>
                      <input type="text" id="corp-economic-code" class="studio-input-line" placeholder="مثال: 411394857321" value="${escapeHtml(corpProfile?.economicCode || "")}" style="width:100%; padding:8px; border-radius:8px; direction:ltr; text-align:right;" />
                    </div>
                    <div style="grid-column: 1 / -1; display:flex; justify-content:space-between; align-items:center;">
                      <span id="corp-upgrade-feedback" style="font-size:12px; color:var(--muted);"></span>
                      <button type="submit" class="button button-primary button-sm">
                        ${ui("ارسال مدارک و درخواست احراز شرکتی")}
                      </button>
                    </div>
                  </form>

                  <!-- Developer / Testing Simulation Control -->
                  <div style="background: var(--surface); border: 1px dashed var(--line); border-radius: 12px; padding: 12px; font-size: 11.5px;">
                    <strong style="display:block; margin-bottom:4px; color:var(--faint);">🛠️ ابزار تست شبیه‌سازی وضعیت بررسی مدارک (توسعه و سناریوها):</strong>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                      <button type="button" class="button button-ghost button-sm" data-sim-corp-status="approved" style="font-size:11px; padding:2px 8px; color:var(--success);">
                        ✓ شبیه‌سازی تأیید مدارک (Approved)
                      </button>
                      <button type="button" class="button button-ghost button-sm" data-sim-corp-status="rejected" style="font-size:11px; padding:2px 8px; color:var(--danger);">
                        ✕ شبیه‌سازی رد مدارک با دلیل (Rejected)
                      </button>
                      <button type="button" class="button button-ghost button-sm" data-sim-corp-status="pending_review" style="font-size:11px; padding:2px 8px; color:var(--warning);">
                        ⏳ بازگشت به در انتظار بررسی
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
        })()}
      </div>
    </div>
  `;
}

/**
 * Screen 2.3: ایجاد محتوای تجاری
 */
export function renderBusinessCreateContent(): string {
  const options = [
    { label: "تصویر", icon: "🖼️" },
    { label: "ویدیو", icon: "🎥" },
    { label: "صوت", icon: "🎙️" },
    { label: "مقاله / وبلاگ", icon: "✍️" },
    { label: "پیشنهاد ویژه", icon: "⭐" },
    { label: "کاتالوگ", icon: "📑" },
  ];

  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-screen-top">
        <a href="/business" data-nav class="phoenix-screen-back-btn" aria-label="${ui("بازگشت")}">→</a>
        <div class="phoenix-screen-title-wrap">
          <h1 class="phoenix-screen-title">${ui("ایجاد محتوا")}</h1>
          <div class="phoenix-screen-subtitle">${ui("چه نوع محتوایی می‌خوای بسازی؟")}</div>
        </div>
        <div style="width: 38px;"></div>
      </div>

      <div class="phoenix-screen-content">
        <div class="phoenix-action-grid" style="grid-template-columns: repeat(2, 1fr);">
          ${options.map((o) => `
            <a href="/business/create/details" data-nav class="phoenix-action-card" style="padding: 20px 12px;">
              <div class="phoenix-action-icon" aria-hidden="true">${o.icon}</div>
              <span class="phoenix-action-label">${ui(o.label)}</span>
            </a>
          `).join("")}
        </div>

        ${renderSmartAiCard(
          ui("ققنوس پیشنهاد می‌دهد:"),
          ui("برای معرفی بهتر برند، یک ویدیوی کوتاه ۶۰ ثانیه‌ای از معرفی محصولات خود بسازید.")
        )}
      </div>
    </div>
  `;
}

/**
 * Screen 2.4: جزئیات محتوای تجاری
 */
export function renderBusinessContentDetails(): string {
  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-screen-top">
        <a href="/business/create" data-nav class="phoenix-screen-back-btn" aria-label="${ui("بازگشت")}">→</a>
        <div class="phoenix-screen-title-wrap">
          <h1 class="phoenix-screen-title">${ui("جزئیات محتوای تجاری")}</h1>
        </div>
        <div style="width: 38px;"></div>
      </div>

      <form class="phoenix-screen-content" id="business-content-form">
        <label for="biz-media-upload" class="phoenix-upload-box">
          <input type="file" id="biz-media-upload" style="display:none;" />
          <div class="phoenix-upload-box-icon" aria-hidden="true">🏢</div>
          <strong style="font-size: 14px;">${ui("عکس یا فایل کاتالوگ محصول")}</strong>
          <small style="color: var(--muted);">${ui("برای بارگذاری کلیک کنید")}</small>
        </label>

        <div>
          <label for="biz-desc-input" class="field-label" style="font-size: 13px; font-weight: 700; margin-bottom: 6px; display: block;">
            ${ui("توضیحات")}
          </label>
          <textarea id="biz-desc-input" rows="4" class="studio-input-line" style="width:100%; border-radius:14px; padding:12px; font-family:inherit;" placeholder="${ui("توضیحات و شرایط عرضه را اینجا بنویسید…")}">تأمین عمده و مستقیم محصولات با گارانتی رسمی شرکتی و ارائه فاکتور رسمی.</textarea>
        </div>

        <div>
          <label for="biz-price-input" class="field-label" style="font-size: 13px; font-weight: 700; margin-bottom: 6px; display: block;">
            ${ui("قیمت یا شرایط همکاری")}
          </label>
          <input type="text" id="biz-price-input" class="studio-input-line" style="width:100%; border-radius:14px; padding:12px;" value="قیمت بر اساس تیراژ سفارش" placeholder="${ui("قیمت یا شرایط را وارد کنید…")}" />
        </div>

        <button type="submit" class="phoenix-primary-cta" style="margin-top: 10px;">
          <span>${ui("ثبت و ادامه")}</span>
          <span aria-hidden="true">←</span>
        </button>
      </form>
    </div>
  `;
}

/**
 * Screen 2.5: درخواست همکاری و معامله
 */
export function renderBusinessDeals(): string {
  const deals = [
    { id: "bulk_buy", label: "خرید عمده", icon: "📦" },
    { id: "bulk_sell", label: "فروش عمده", icon: "🏷️" },
    { id: "tender", label: "مناقصه", icon: "📑" },
    { id: "partner", label: "همکاری تجاری", icon: "🤝" },
    { id: "consult", label: "مشاوره تخصصی", icon: "💡" },
  ];

  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-screen-top">
        <a href="/business" data-nav class="phoenix-screen-back-btn" aria-label="${ui("بازگشت")}">→</a>
        <div class="phoenix-screen-title-wrap">
          <h1 class="phoenix-screen-title">${ui("درخواست همکاری / معامله")}</h1>
          <div class="phoenix-screen-subtitle">${ui("نوع همکاری را انتخاب کنید")}</div>
        </div>
        <div style="width: 38px;"></div>
      </div>

      <div class="phoenix-screen-content">
        <div class="phoenix-deal-list" id="business-deals-list">
          ${deals.map((d, idx) => `
            <button type="button" class="phoenix-deal-card ${idx === 0 ? "selected" : ""}" data-biz-deal="${d.id}">
              <div class="phoenix-deal-card-icon" aria-hidden="true">${d.icon}</div>
              <div class="phoenix-deal-card-copy">
                <strong>${ui(d.label)}</strong>
                <small>${ui("ثبت فرآیند رسمی و بررسی پیشنهادات شرکای تجاری")}</small>
              </div>
            </button>
          `).join("")}
        </div>

        <button type="button" class="phoenix-primary-cta" id="confirm-biz-deal-btn" style="margin-top: 10px;">
          <span>${ui("ادامه فرآیند معامله")}</span>
          <span aria-hidden="true">←</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Screen 2.6: تیم و مدیریت تیم
 */
export function renderBusinessTeam(): string {
  const members = getTeamMembers();

  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-screen-top">
        <a href="/business" data-nav class="phoenix-screen-back-btn" aria-label="${ui("بازگشت")}">→</a>
        <div class="phoenix-screen-title-wrap">
          <h1 class="phoenix-screen-title">${ui("تیم و مدیریت تیم")}</h1>
          <div class="phoenix-screen-subtitle">${ui("تیم شما")}</div>
        </div>
        <button type="button" class="phoenix-add-btn" id="open-add-member-dialog">
          <span>＋</span>
          <span>${ui("افزودن عضو")}</span>
        </button>
      </div>

      <div class="phoenix-screen-content">
        <!-- Interactive Add Member Form (Hidden or Revealed) -->
        <div id="add-member-form-container" style="display:none; background:var(--surface-2); border:1px solid var(--line); border-radius:18px; padding:16px;">
          <h3 style="font-size:14px; margin:0 0 10px;">${ui("افزودن عضو جدید به تیم")}</h3>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <input type="text" id="new-member-name" class="studio-input-line" placeholder="${ui("نام و نام خانوادگی")}" />
            <input type="text" id="new-member-role" class="studio-input-line" placeholder="${ui("عنوان شغلی (مثلاً مدیر فنی)")}" />
            <div style="display:flex; gap:8px;">
              <button type="button" class="button button-primary" id="save-new-member-btn">${ui("ثبت عضو")}</button>
              <button type="button" class="button button-ghost" id="cancel-new-member-btn">${ui("انصراف")}</button>
            </div>
          </div>
        </div>

        <div class="phoenix-deal-list" id="team-members-list">
          ${members.map((m) => `
            <div class="phoenix-team-card">
              <div class="phoenix-team-member-info">
                <div class="phoenix-team-avatar">${m.avatarChar}</div>
                <div>
                  <strong>${escapeHtml(m.name)}</strong>
                  <small>${escapeHtml(m.role)}</small>
                </div>
              </div>
              <button type="button" class="phoenix-team-action-btn" data-toast="${ui("ویرایش دسترسی‌ها فعال شد.")}">
                ✏️ ${ui("ویرایش")}
              </button>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

/**
 * Screen 2.7: اطلاعات سازمانی
 */
export function renderBusinessOrgProfile(): string {
  const org = getOrgProfile();
  const isLegal = org.entityType !== "natural";

  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-screen-top">
        <a href="/business" data-nav class="phoenix-screen-back-btn" aria-label="${ui("بازگشت")}">→</a>
        <div class="phoenix-screen-title-wrap">
          <h1 class="phoenix-screen-title">${ui("اطلاعات سازمانی و هویت فروشندگی")}</h1>
          <div class="phoenix-screen-subtitle">${ui("مشخصات و تنظیمات سازمانی فروشگاه")}</div>
        </div>
        <div style="width: 38px;"></div>
      </div>

      <form class="phoenix-screen-content" id="org-profile-form">
        <!-- Entity Type Switcher -->
        <div class="seller-entity-type-box" style="margin-bottom: 16px;">
          <label class="field-label" style="display:block; font-size:13px; font-weight:700; margin-bottom:8px;">${ui("نوع فعالیت فروشنده:")}</label>
          <div class="seller-entity-toggle-pills">
            <button type="button" class="seller-entity-pill ${!isLegal ? "active" : ""}" data-org-entity-type="natural" aria-pressed="${!isLegal}">
              <span class="pill-icon" aria-hidden="true">👤</span>
              <div class="pill-text">
                <strong>${ui("فروشگاه مستقل")}</strong>
                <small>${ui("فعالیت انفرادی یا فروشگاه شخصی")}</small>
              </div>
            </button>
            <button type="button" class="seller-entity-pill ${isLegal ? "active" : ""}" data-org-entity-type="legal" aria-pressed="${isLegal}">
              <span class="pill-icon" aria-hidden="true">🏢</span>
              <div class="pill-text">
                <strong>${ui("شرکت و فروشگاه سازمانی")}</strong>
                <small>${ui("شرکت، برند ثبتی یا مؤسسه")}</small>
              </div>
            </button>
          </div>
          <small style="display:block; margin-top:6px; color:var(--muted); font-size:11px;">
            ${ui("نکته: تغییر نوع فروشنده اطلاعات قانونی یا شخصی ثبت‌شده قبلی شما را حذف نمی‌کند.")}
          </small>
        </div>

        <div>
          <label for="org-name" id="org-name-label" class="field-label" style="font-size: 13px; font-weight: 700; margin-bottom: 6px; display: block;">
            ${isLegal ? ui("نام رسمی شرکت / برند ثبتی") : ui("نام فروشگاه / نشان کاری")}
          </label>
          <input type="text" id="org-name" class="studio-input-line" style="width:100%; border-radius:14px; padding:12px;" value="${escapeHtml(org.companyName)}" required />
        </div>

        <div>
          <label for="org-manager" id="org-manager-label" class="field-label" style="font-size: 13px; font-weight: 700; margin-bottom: 6px; display: block;">
            ${isLegal ? ui("نام و نام خانوادگی نماینده قانونی / مدیرعامل") : ui("نام و نام خانوادگی صاحب کسب‌وکار")}
          </label>
          <input type="text" id="org-manager" class="studio-input-line" style="width:100%; border-radius:14px; padding:12px;" value="${escapeHtml(org.managerName || "")}" placeholder="${isLegal ? "مثال: سارا حسینی" : "مثال: علی محمدی"}" />
        </div>

        <!-- Dynamic Legal Entity Fields -->
        <div id="org-legal-fields" style="${isLegal ? "display:block;" : "display:none;"}">
          <div style="margin-bottom: 12px;">
            <label for="org-reg" class="field-label" style="font-size: 13px; font-weight: 700; margin-bottom: 6px; display: block;">${ui("شناسه ملی / شماره ثبت شرکت")}</label>
            <input type="text" id="org-reg" class="studio-input-line" style="width:100%; border-radius:14px; padding:12px;" value="${escapeHtml(org.regNumber)}" placeholder="۱۰۱۰۳۹۸۴۲۱۵" />
          </div>
          <div>
            <label for="org-economic" class="field-label" style="font-size: 13px; font-weight: 700; margin-bottom: 6px; display: block;">${ui("کد اقتصادی (اختیاری)")}</label>
            <input type="text" id="org-economic" class="studio-input-line" style="width:100%; border-radius:14px; padding:12px;" value="${escapeHtml(org.economicCode || "")}" placeholder="۴۱۱۳۹۴۸۵۷۳۲۱" />
          </div>
        </div>

        <!-- Dynamic Natural Person Fields -->
        <div id="org-natural-fields" style="${!isLegal ? "display:block;" : "display:none;"}">
          <div>
            <label for="org-national" class="field-label" style="font-size: 13px; font-weight: 700; margin-bottom: 6px; display: block;">${ui("کد ملی (جهت اعتبارسنجی بانکی و تسویه)")}</label>
            <input type="text" id="org-national" class="studio-input-line" style="width:100%; border-radius:14px; padding:12px;" value="${escapeHtml(org.nationalCode || "")}" maxlength="10" placeholder="۰۰۱۲۳۴۵۶۷۸" />
          </div>
        </div>

        <div>
          <label for="org-industry" class="field-label" style="font-size: 13px; font-weight: 700; margin-bottom: 6px; display: block;">${ui("صنعت و رسته فعالیت")}</label>
          <input type="text" id="org-industry" class="studio-input-line" style="width:100%; border-radius:14px; padding:12px;" value="${escapeHtml(org.industry)}" />
        </div>

        <div>
          <label for="org-address" class="field-label" style="font-size: 13px; font-weight: 700; margin-bottom: 6px; display: block;">${ui("آدرس و نشانی")}</label>
          <input type="text" id="org-address" class="studio-input-line" style="width:100%; border-radius:14px; padding:12px;" value="${escapeHtml(org.address)}" />
        </div>

        <div>
          <label for="org-phone" class="field-label" style="font-size: 13px; font-weight: 700; margin-bottom: 6px; display: block;">${ui("تلفن تماس کسب‌وکار")}</label>
          <input type="text" id="org-phone" class="studio-input-line" style="width:100%; border-radius:14px; padding:12px;" value="${escapeHtml(org.phone)}" />
        </div>

        <button type="submit" class="phoenix-primary-cta" style="margin-top: 14px;">
          <span>${ui("ذخیره تغییرات مشخصات")}</span>
          <span aria-hidden="true">✓</span>
        </button>
      </form>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// ROW 3: کاربر نهایی (مصرف‌کننده) - Screens 3.1 to 3.7
// -----------------------------------------------------------------------------

/**
 * Screen 3.1: خوشامدگویی مصرف‌کننده
 */
export function renderConsumerWelcome(): string {
  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-welcome-container">
        <img class="phoenix-welcome-logo" src="/phoenix-mark.svg?v=2" alt="ققنوس" />
        <h1 class="phoenix-welcome-greeting">
          ${ui("سلام!")}
          <span>${ui("به دنیای خرید و فروش خوش اومدی")}</span>
        </h1>
        <p class="phoenix-welcome-desc">
          ${ui("همه‌چیز برای زندگی راحت‌تر و تصمیم‌گیری هوشمندانه در دستان شماست.")}
        </p>
        <ul class="phoenix-welcome-bullets">
          <li>${ui("جستجو و مشاهده هزاران کالا و خدمت")}</li>
          <li>${ui("خرید امن با درگاه و پرداخت در محل")}</li>
          <li>${ui("امتیاز، رتبه و تخفیف‌های ویژه")}</li>
          <li>${ui("ثبت تجربه و نظرات معتبر")}</li>
          <li>${ui("پشتیبانی مستقیم و سریع")}</li>
        </ul>
        <button type="button" class="phoenix-primary-cta" data-open-register>
          <span>${ui("ورود / ثبت‌نام")}</span>
          <span aria-hidden="true">←</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Screen 3.2: خانه و کشف کالا و خدمات
 */
export function renderConsumerHome(): string {
  const cats = [
    { label: "محصولات", icon: "📦" },
    { label: "خدمات", icon: "💼" },
    { label: "آموزش", icon: "🎓" },
    { label: "اجاره", icon: "🔑" },
    { label: "خرید و فروش", icon: "🏷️" },
    { label: "بیشتر", icon: "✦" },
  ];

  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-screen-content">
        <!-- Big Consumer Search -->
        <form class="phoenix-search-bar" id="consumer-search-form">
          <span style="color: var(--primary); font-size: 16px;" aria-hidden="true">⌕</span>
          <input type="text" id="consumer-search-input" placeholder="${ui("هر چی می‌خوای بگو تا ققنوس برات پیداش کنه")}" />
          <button type="submit" class="button button-primary button-sm" style="padding: 4px 10px; font-size: 11px;">${ui("پیدا کن")}</button>
        </form>

        <!-- Category Grid -->
        <div class="phoenix-consumer-cats">
          ${cats.map((c) => `
            <a href="/discover?cat=${encodeURIComponent(c.label)}" data-nav class="phoenix-consumer-cat-card">
              <span class="phoenix-consumer-cat-icon" aria-hidden="true">${c.icon}</span>
              <span>${ui(c.label)}</span>
            </a>
          `).join("")}
        </div>

        <!-- Special Offers Banner -->
        <div class="phoenix-suggestion-banner" style="background: linear-gradient(135deg, #fff2e6, var(--surface));">
          <div class="phoenix-suggestion-copy">
            <strong style="color: var(--primary-strong);">${ui("پیشنهادهای ویژه")}</strong>
            <small>${ui("محصولات منتخب امروز با تخفیف ویژه")}</small>
          </div>
          <a href="/product/demo" data-nav class="button button-primary button-sm" style="font-size: 11px;">${ui("مشاهده")}</a>
        </div>

        <!-- Sample Featured Product Card -->
        <div class="phoenix-product-card-view">
          <div class="phoenix-product-img">🎁</div>
          <div class="phoenix-product-body">
            <strong style="font-size: 15px;">${ui("بسته هوشمند سازمانی ققنوس")}</strong>
            <p style="font-size: 12px; color: var(--muted); margin: 0;">${ui("مجموعه ابزارهای هوش مصنوعی و خودکارسازی سفارشات.")}</p>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 4px;">
              <span class="phoenix-product-price">120,000 ${ui("تومان")}</span>
              <a href="/product/demo" data-nav class="button button-primary button-sm">${ui("جزئیات محصول")}</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Screen 3.3: جزئیات محصول
 */
export function renderConsumerProductDetails(): string {
  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-screen-top">
        <a href="/discover" data-nav class="phoenix-screen-back-btn" aria-label="${ui("بازگشت")}">→</a>
        <div class="phoenix-screen-title-wrap">
          <h1 class="phoenix-screen-title">${ui("جزئیات محصول")}</h1>
        </div>
        <button type="button" class="phoenix-screen-back-btn" id="fav-toggle-btn" aria-label="${ui("نشان کردن")}">❤️</button>
      </div>

      <div class="phoenix-screen-content">
        <!-- Product Photo Gallery -->
        <div style="background:var(--surface-2); border-radius:20px; height:220px; display:grid; place-items:center; font-size:64px; border:1px solid var(--line);">
          📦
        </div>

        <div>
          <h2 style="font-size: 18px; font-weight: 800; margin: 0 0 6px;">${ui("بسته هوشمند سازمانی ققنوس")}</h2>
          <p style="font-size: 13px; color: var(--muted); line-height: 1.7; margin: 0;">
            ${ui("این بسته شامل لایه‌های تصمیم‌گیری، تحلیل هوشمند بازار و تطبیق خودکار با مشتریان است. همراه با پشتیبانی یک‌ساله و دسترسی به تمام ابزارهای ققنوس.")}
          </p>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 16px; background:var(--surface-2); border-radius:16px;">
          <span style="font-size: 13px; font-weight: 700;">${ui("قیمت نهایی:")}</span>
          <span class="phoenix-product-price">150,000 ${ui("تومان")}</span>
        </div>

        <button type="button" class="phoenix-primary-cta" id="add-to-cart-direct-btn">
          <span>🛒</span>
          <span>${ui("افزودن به سبد خرید")}</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Screen 3.4: سبد خرید
 */
export function renderConsumerCart(): string {
  const items = getCartItems();
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = items.length > 0 ? 0 : 0;
  const total = subtotal + shipping;

  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-screen-top">
        <a href="/discover" data-nav class="phoenix-screen-back-btn" aria-label="${ui("بازگشت")}">→</a>
        <div class="phoenix-screen-title-wrap">
          <h1 class="phoenix-screen-title">${ui("سبد خرید")}</h1>
        </div>
        <div style="width: 38px;"></div>
      </div>

      <div class="phoenix-screen-content">
        ${items.length === 0 ? `
          <div style="text-align:center; padding: 48px 20px; color: var(--muted);">
            <div style="font-size: 48px; margin-bottom: 12px;">🛒</div>
            <strong>${ui("سبد خرید شما خالی است")}</strong>
            <p style="font-size: 13px; margin-top: 6px;">${ui("محصولات مورد علاقه خود را انتخاب کنید.")}</p>
            <a href="/discover" data-nav class="button button-primary" style="margin-top: 16px;">${ui("کشف محصولات")}</a>
          </div>
        ` : `
          <!-- Cart Items List -->
          <div class="phoenix-deal-list" id="cart-items-list">
            ${items.map((item) => `
              <div class="phoenix-cart-item" data-item-id="${item.id}">
                <div>
                  <strong style="display:block; font-size:14px;">${escapeHtml(item.title)}</strong>
                  <small style="color: var(--muted);">${escapeHtml(item.category)} · ${item.price.toLocaleString("fa-IR")} تومان</small>
                </div>
                <div class="phoenix-cart-qty-ctrl">
                  <button type="button" class="phoenix-cart-qty-btn" data-cart-minus="${item.id}">−</button>
                  <span style="font-size: 13px; font-weight:700;">${item.quantity}</span>
                  <button type="button" class="phoenix-cart-qty-btn" data-cart-plus="${item.id}">＋</button>
                </div>
              </div>
            `).join("")}
          </div>

          <!-- Financial Calculation Summary -->
          <div class="phoenix-cart-summary">
            <div class="phoenix-cart-row">
              <span>${ui("جمع کل")}</span>
              <span>${subtotal.toLocaleString("fa-IR")} ${ui("تومان")}</span>
            </div>
            <div class="phoenix-cart-row">
              <span>${ui("هزینه ارسال")}</span>
              <span>${ui("هزینهٔ ارسال پس از بررسی سفارش مشخص می‌شود.")}</span>
            </div>
            <div class="phoenix-cart-row phoenix-cart-total">
              <span>${ui("مجموع تقریبی اقلام محلی")}</span>
              <span style="color: var(--primary);">${total.toLocaleString("fa-IR")} ${ui("تومان")}</span>
            </div>
          </div>

          <a href="/checkout" data-nav class="phoenix-primary-cta" style="margin-top: 8px;">
            <span>${ui("ادامه به بررسی پرداخت")}</span>
            <span aria-hidden="true">←</span>
          </a>
        `}
      </div>
    </div>
  `;
}

/**
 * Screen 3.5: تسویه‌حساب و پرداخت
 */
export function renderConsumerPayment(): string {
  const items = getCartItems();
  const estimatedSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return `
    <div class="phoenix-screen-wrapper phoenix-checkout-review">
      <div class="phoenix-screen-top">
        <a href="/cart" data-nav class="phoenix-screen-back-btn" aria-label="${ui("بازگشت")}">→</a>
        <div class="phoenix-screen-title-wrap">
          <h1 class="phoenix-screen-title">${ui("بررسی پرداخت")}</h1>
        </div>
        <div style="width: 38px;"></div>
      </div>

      <div class="phoenix-screen-content">
        <section class="phoenix-checkout-review-hero" role="status" aria-live="polite">
          <span class="phoenix-checkout-review-icon" aria-hidden="true">⏸</span>
          <span class="phoenix-reset-section-kicker">${ui("مرحلهٔ نهایی خرید")}</span>
          <h2>${ui("پرداخت امن هنوز متصل نشده است.")}</h2>
          <p>${ui("تا زمان اتصال درگاه معتبر و تأیید سرویس پرداخت، سفارشی ثبت نمی‌شود و مبلغی کسر نخواهد شد.")}</p>
        </section>

        <section class="phoenix-checkout-local-preview">
          <div class="phoenix-checkout-local-preview-head">
            <div>
              <span class="phoenix-reset-section-kicker">${ui("پیش‌نمایش سبد محلی")}</span>
              <h2>${ui("اقلام انتخاب‌شده")}</h2>
            </div>
            <a href="/cart" data-nav class="phoenix-checkout-edit-link">${ui("ویرایش سبد")}</a>
          </div>
          <p class="phoenix-checkout-preview-note">${ui("این صفحه فقط پیش‌نمایش سبد محلی را نشان می‌دهد؛ این اقلام هنوز به سفارش ثبت‌شده متصل نیستند.")}</p>
          ${items.length ? `
            <div class="phoenix-checkout-review-items">
              ${items.map((item) => `
                <article class="phoenix-checkout-review-item">
                  <span class="phoenix-checkout-review-item-icon" aria-hidden="true">▦</span>
                  <div class="phoenix-checkout-review-item-copy">
                    <strong>${escapeHtml(item.title)}</strong>
                    <small>${escapeHtml(item.category)} · ${ui("تعداد")} ${formatNumber(item.quantity)}</small>
                  </div>
                  <span class="phoenix-checkout-review-item-total">${formatNumber(item.price * item.quantity)} ${ui("تومان")}</span>
                </article>
              `).join("")}
            </div>
            <div class="phoenix-checkout-review-total">
              <span>${ui("مجموع تقریبی اقلام محلی")}</span>
              <strong>${formatNumber(estimatedSubtotal)} ${ui("تومان")}</strong>
            </div>
          ` : `
            <div class="phoenix-checkout-review-empty">
              <span aria-hidden="true">🛒</span>
              <p>${ui("سبد محلی خالی است.")}</p>
              <a class="button button-ghost" href="/discover?tab=explore" data-nav>${ui("کشف کالاها و خدمات")}</a>
            </div>
          `}
        </section>

        <div class="phoenix-checkout-review-actions">
          <a href="/cart" data-nav class="button button-ghost">${ui("بازگشت به سبد خرید")}</a>
          <a href="/discover?tab=explore" data-nav class="button button-primary">${ui("ادامهٔ کشف کالاها و خدمات")} <span aria-hidden="true">←</span></a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Screen 3.6: صندوق پیام‌ها
 */
export function renderConsumerMessages(): string {
  const messages = [
    { name: "پشتیبانی ققنوس", text: "در خدمت شما هستیم", time: "۲ ساعت پیش", icon: "🎧" },
    { name: "خریدار", text: "سفارش کالا رسید و تأیید شد", time: "۵ ساعت پیش", icon: "👤" },
    { name: "فروشنده", text: "محتوا و سفارش را آماده کرد", time: "۱ روز پیش", icon: "📦" },
  ];

  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-screen-top">
        <a href="/" data-nav class="phoenix-screen-back-btn" aria-label="${ui("بازگشت")}">→</a>
        <div class="phoenix-screen-title-wrap">
          <h1 class="phoenix-screen-title">${ui("پیام‌ها")}</h1>
        </div>
        <div style="width: 38px;"></div>
      </div>

      <div class="phoenix-screen-content">
        <div class="phoenix-segmented-tabs">
          <button type="button" class="phoenix-tab-btn active">${ui("پشتیبانی")}</button>
          <button type="button" class="phoenix-tab-btn">${ui("معاملات")}</button>
        </div>

        <div class="phoenix-deal-list" id="consumer-chat-threads">
          ${messages.map((m) => `
            <button type="button" class="phoenix-notification-item" style="cursor: pointer; width: 100%; text-align: start;" data-toast="${ui("گفتگو با " + m.name + " باز شد.")}">
              <div class="phoenix-notif-icon" aria-hidden="true">${m.icon}</div>
              <div class="phoenix-notif-body">
                <strong>${ui(m.name)}</strong>
                <small>${ui(m.text)} · ${ui(m.time)}</small>
              </div>
            </button>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

/**
 * Screen 3.7: امتیاز و رتبه
 */
export function renderConsumerLoyalty(): string {
  return `
    <div class="phoenix-screen-wrapper">
      <div class="phoenix-screen-top">
        <a href="/" data-nav class="phoenix-screen-back-btn" aria-label="${ui("بازگشت")}">→</a>
        <div class="phoenix-screen-title-wrap">
          <h1 class="phoenix-screen-title">${ui("امتیاز و رتبه")}</h1>
        </div>
        <div style="width: 38px;"></div>
      </div>

      <div class="phoenix-screen-content">
        <div class="phoenix-profile-hero">
          <div class="phoenix-circle-progress">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" stroke="var(--surface-3)" stroke-width="8" fill="none" />
              <circle cx="50" cy="50" r="42" stroke="var(--primary)" stroke-width="8" fill="none" stroke-dasharray="264" stroke-dashoffset="158" stroke-linecap="round" />
            </svg>
            <div class="phoenix-circle-label">۴۰٪</div>
          </div>
          <strong style="font-size: 17px; margin-top: 4px;">${ui("رتبه شما: کاربر فعال")}</strong>
        </div>

        <!-- Benefits List -->
        <div style="background:var(--surface); border:1px solid var(--line); border-radius:20px; padding:18px;">
          <h2 style="font-size:14px; font-weight:800; margin:0 0 12px; color:var(--text);">${ui("مزایا:")}</h2>
          <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px; font-size:13px; color:var(--muted);">
            <li style="display:flex; align-items:center; gap:8px;">
              <span style="color:var(--primary);" aria-hidden="true">✦</span>
              <span>${ui("تخفیف خرید اختصاصی در تمام دسته‌ها")}</span>
            </li>
            <li style="display:flex; align-items:center; gap:8px;">
              <span style="color:var(--primary);" aria-hidden="true">✦</span>
              <span>${ui("اعتبار خرید داخلی و بازگشت نقدی (Cashback)")}</span>
            </li>
            <li style="display:flex; align-items:center; gap:8px;">
              <span style="color:var(--primary);" aria-hidden="true">✦</span>
              <span>${ui("دسترسی اولویت‌دار به خدمات ویژه و مشاورین")}</span>
            </li>
          </ul>
        </div>

        <p style="text-align:center; font-size:12px; color:var(--faint); margin:0;">
          ${ui("با فعالیت بیشتر، امتیاز و رتبه‌ات رو افزایش بده")}
        </p>
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// Interactive Events Binder for Phoenix Framework
// -----------------------------------------------------------------------------

export function bindPhoenixExperienceEvents(container: HTMLElement, onNavigate: (path: string) => void): void {
  // Persona switcher clicks
  container.querySelectorAll<HTMLButtonElement>("[data-switch-persona]").forEach((btn) => {
    btn.onclick = () => {
      const persona = btn.getAttribute("data-switch-persona") as PhoenixPersona;
      if (persona) {
        setActivePersona(persona);
        onNavigate("/");
      }
    };
  });

  // Deal card selections
  container.querySelectorAll<HTMLButtonElement>("[data-deal-type]").forEach((card) => {
    card.onclick = () => {
      container.querySelectorAll("[data-deal-type]").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
    };
  });

  // Confirm deal button
  const confirmDealBtn = container.querySelector<HTMLButtonElement>("#confirm-deal-btn");
  if (confirmDealBtn) {
    confirmDealBtn.onclick = () => {
      showToast(ui("معامله با موفقیت ثبت شد و در سیستم قرار گرفت."));
      onNavigate("/transactions");
    };
  }

  // Content details form submit
  const contentForm = container.querySelector<HTMLFormElement>("#content-details-form");
  if (contentForm) {
    contentForm.onsubmit = (e) => {
      e.preventDefault();
      onNavigate("/create/deal-type");
    };
  }

  // Business content form submit
  const bizForm = container.querySelector<HTMLFormElement>("#business-content-form");
  if (bizForm) {
    bizForm.onsubmit = (e) => {
      e.preventDefault();
      onNavigate("/business/deals");
    };
  }

  // Business deal cards
  container.querySelectorAll<HTMLButtonElement>("[data-biz-deal]").forEach((card) => {
    card.onclick = () => {
      container.querySelectorAll("[data-biz-deal]").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
    };
  });

  const confirmBizDeal = container.querySelector<HTMLButtonElement>("#confirm-biz-deal-btn");
  if (confirmBizDeal) {
    confirmBizDeal.onclick = () => {
      showToast(ui("درخواست همکاری تجاری ثبت شد."));
      onNavigate("/business");
    };
  }

  // Team management add member toggle
  const openAddMember = container.querySelector<HTMLButtonElement>("#open-add-member-dialog");
  const addMemberForm = container.querySelector<HTMLElement>("#add-member-form-container");
  const cancelMember = container.querySelector<HTMLButtonElement>("#cancel-new-member-btn");
  const saveMember = container.querySelector<HTMLButtonElement>("#save-new-member-btn");

  if (openAddMember && addMemberForm) {
    openAddMember.onclick = () => {
      addMemberForm.style.display = "block";
    };
  }
  if (cancelMember && addMemberForm) {
    cancelMember.onclick = () => {
      addMemberForm.style.display = "none";
    };
  }
  if (saveMember && addMemberForm) {
    saveMember.onclick = () => {
      const nameInput = container.querySelector<HTMLInputElement>("#new-member-name");
      const roleInput = container.querySelector<HTMLInputElement>("#new-member-role");
      const name = nameInput?.value.trim();
      const role = roleInput?.value.trim();
      if (name && role) {
        addTeamMember({
          name,
          role,
          status: "فعال",
          avatarChar: name[0] || "ع",
        });
        showToast(ui("عضو جدید به تیم اضافه شد."));
        onNavigate("/business/team");
      }
    };
  }

  // Organization profile form save & dynamic entityType switcher
  const orgEntityTypePills = container.querySelectorAll<HTMLButtonElement>("[data-org-entity-type]");
  const orgLegalGroup = container.querySelector<HTMLElement>("#org-legal-fields");
  const orgNaturalGroup = container.querySelector<HTMLElement>("#org-natural-fields");
  const orgNameLabel = container.querySelector<HTMLElement>("#org-name-label");
  const orgManagerLabel = container.querySelector<HTMLElement>("#org-manager-label");
  let currentOrgEntityType: "natural" | "legal" = getOrgProfile().entityType === "natural" ? "natural" : "legal";

  orgEntityTypePills.forEach((pill) => {
    pill.onclick = () => {
      const type = pill.getAttribute("data-org-entity-type") === "natural" ? "natural" : "legal";
      currentOrgEntityType = type;
      orgEntityTypePills.forEach((p) => {
        const matches = p.getAttribute("data-org-entity-type") === type;
        p.classList.toggle("active", matches);
        p.setAttribute("aria-pressed", String(matches));
      });
      if (type === "legal") {
        if (orgLegalGroup) orgLegalGroup.style.display = "block";
        if (orgNaturalGroup) orgNaturalGroup.style.display = "none";
        if (orgNameLabel) orgNameLabel.textContent = ui("نام رسمی شرکت / برند ثبتی");
        if (orgManagerLabel) orgManagerLabel.textContent = ui("نام و نام خانوادگی نماینده قانونی / مدیرعامل");
      } else {
        if (orgLegalGroup) orgLegalGroup.style.display = "none";
        if (orgNaturalGroup) orgNaturalGroup.style.display = "block";
        if (orgNameLabel) orgNameLabel.textContent = ui("نام فروشگاه / نشان کاری");
        if (orgManagerLabel) orgManagerLabel.textContent = ui("نام و نام خانوادگی صاحب کسب‌وکار");
      }
    };
  });

  const orgForm = container.querySelector<HTMLFormElement>("#org-profile-form");
  if (orgForm) {
    orgForm.onsubmit = async (e) => {
      e.preventDefault();
      const companyName = (container.querySelector<HTMLInputElement>("#org-name")?.value || "").trim();
      const managerName = (container.querySelector<HTMLInputElement>("#org-manager")?.value || "").trim();
      const regNumber = (container.querySelector<HTMLInputElement>("#org-reg")?.value || "").trim();
      const economicCode = (container.querySelector<HTMLInputElement>("#org-economic")?.value || "").trim();
      const nationalCode = (container.querySelector<HTMLInputElement>("#org-national")?.value || "").trim();
      const industry = (container.querySelector<HTMLInputElement>("#org-industry")?.value || "").trim();
      const address = (container.querySelector<HTMLInputElement>("#org-address")?.value || "").trim();
      const phone = (container.querySelector<HTMLInputElement>("#org-phone")?.value || "").trim();

      const existingOrg = getOrgProfile();
      const updatedOrg: PhoenixOrgProfile = {
        ...existingOrg,
        entityType: currentOrgEntityType,
        companyName: companyName || existingOrg.companyName,
        managerName: managerName || existingOrg.managerName,
        regNumber: regNumber || existingOrg.regNumber,
        economicCode: economicCode || existingOrg.economicCode,
        nationalCode: nationalCode || existingOrg.nationalCode,
        industry: industry || existingOrg.industry,
        address: address || existingOrg.address,
        phone: phone || existingOrg.phone,
      };

      saveOrgProfile(updatedOrg);

      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("phoenix-access-token") : null;
      if (token) {
        try {
          await fetch("/api/v1/auth/seller/profile", {
            method: "PUT",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              entityType: currentOrgEntityType,
              businessName: companyName,
              managerName,
              companyName: currentOrgEntityType === "legal" ? companyName : undefined,
              registrationNumber: regNumber,
              economicCode,
              nationalCode,
              industry,
            }),
          });
        } catch {
          // graceful offline fallback
        }
      }

      showToast(ui("اطلاعات پروفایل فروشنده با موفقیت ذخیره شد."));
    };
  }

  // Cart quantity controls
  container.querySelectorAll<HTMLButtonElement>("[data-cart-plus]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-cart-plus");
      if (id) {
        updateCartQuantity(id, 1);
        onNavigate("/cart");
      }
    };
  });
  container.querySelectorAll<HTMLButtonElement>("[data-cart-minus]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-cart-minus");
      if (id) {
        updateCartQuantity(id, -1);
        onNavigate("/cart");
      }
    };
  });

  // Direct add to cart
  const directAddBtn = container.querySelector<HTMLButtonElement>("#add-to-cart-direct-btn");
  if (directAddBtn) {
    directAddBtn.onclick = () => {
      const items = getCartItems();
      const exists = items.find((i) => i.id === "item-main");
      if (exists) {
        exists.quantity += 1;
        saveCartItems(items);
      } else {
        items.push({
          id: "item-main",
          title: "بسته هوشمند سازمانی ققنوس",
          category: "محصول دیجیتال",
          price: 150000,
          quantity: 1,
        });
        saveCartItems(items);
      }
      showToast(ui("محصول به سبد خرید اضافه شد."));
      onNavigate("/cart");
    };
  }

  // Consumer checkout is intentionally review-only until canonical payment confirmation is wired.
  // Never clear the local cart or announce an order/payment success from the legacy demo flow.

  // Seller activation button from individual profile
  const activateSellerBtns = container.querySelectorAll<HTMLButtonElement>("[data-activate-seller]");
  activateSellerBtns.forEach((btn) => {
    btn.onclick = () => {
      accountTierService.upgradeToSeller();
      setActivePersona("business");
      showToast(ui("فروشندگی با موفقیت فعال شد! تمام سوابق و اطلاعات شما حفظ گردید."));
      onNavigate("/business");
    };
  });

  // Tab switching for Account Tiers (both Level 1 and Level 2/3)
  container.querySelectorAll<HTMLButtonElement>(".phoenix-tier-tab-btn[data-tab-target]").forEach((tabBtn) => {
    tabBtn.onclick = () => {
      const targetId = tabBtn.getAttribute("data-tab-target");
      if (!targetId) return;

      const parentSection = tabBtn.closest(".phoenix-account-sections, .phoenix-store-management-box");
      if (!parentSection) return;

      parentSection.querySelectorAll(".phoenix-tier-tab-btn").forEach((b) => b.classList.remove("active"));
      tabBtn.classList.add("active");

      parentSection.querySelectorAll(".phoenix-tier-pane").forEach((pane) => {
        pane.classList.toggle("active", pane.id === targetId);
      });
    };
  });

  // Level 1: Profile Form Submit & National Code Validation
  const l1ProfileForm = container.querySelector<HTMLFormElement>("#level1-profile-form");
  if (l1ProfileForm) {
    l1ProfileForm.onsubmit = (e) => {
      e.preventDefault();
      const name = (container.querySelector<HTMLInputElement>("#acc-profile-name")?.value || "").trim();
      const mobile = (container.querySelector<HTMLInputElement>("#acc-profile-mobile")?.value || "").trim();
      const nationalCode = (container.querySelector<HTMLInputElement>("#acc-profile-national-code")?.value || "").trim();
      const email = (container.querySelector<HTMLInputElement>("#acc-profile-email")?.value || "").trim();
      const feedback = container.querySelector<HTMLElement>("#acc-profile-feedback");

      if (nationalCode && !validateNationalCode(nationalCode)) {
        if (feedback) {
          feedback.textContent = ui("کد ملی وارد شده ۱۰ رقمی و معتبر نیست.");
          feedback.style.color = "var(--danger)";
        }
        showToast(ui("کد ملی نامعتبر است."));
        return;
      }

      accountTierService.updateProfileData({ displayName: name, mobile, nationalCode, email });
      if (feedback) {
        feedback.textContent = ui("اطلاعات پروفایل با موفقیت ثبت شد.");
        feedback.style.color = "var(--success)";
      }
      showToast(ui("اطلاعات حساب من به‌روزرسانی شد."));
    };
  }

  // Level 1: Addresses Add Form Toggle & Submit
  const btnToggleAddr = container.querySelector<HTMLButtonElement>("#btn-toggle-new-addr");
  const formAddAddr = container.querySelector<HTMLFormElement>("#level1-add-address-form");
  const btnCancelAddr = container.querySelector<HTMLButtonElement>("#btn-cancel-new-addr");

  if (btnToggleAddr && formAddAddr) {
    btnToggleAddr.onclick = () => {
      formAddAddr.style.display = formAddAddr.style.display === "none" ? "block" : "none";
    };
  }
  if (btnCancelAddr && formAddAddr) {
    btnCancelAddr.onclick = () => {
      formAddAddr.style.display = "none";
    };
  }
  if (formAddAddr) {
    formAddAddr.onsubmit = (e) => {
      e.preventDefault();
      const title = (container.querySelector<HTMLInputElement>("#new-addr-title")?.value || "").trim();
      const postalCode = (container.querySelector<HTMLInputElement>("#new-addr-postal")?.value || "").trim();
      const city = (container.querySelector<HTMLInputElement>("#new-addr-city")?.value || "").trim();
      const streetLine1 = (container.querySelector<HTMLInputElement>("#new-addr-street")?.value || "").trim();

      if (title && streetLine1) {
        accountTierService.addAddress({
          title,
          streetLine1,
          postalCode,
          city,
          province: "تهران",
        });
        showToast(ui("آدرس جدید اضافه شد."));
        onNavigate("/");
      }
    };
  }

  // Level 1: Delete Address
  container.querySelectorAll<HTMLButtonElement>("[data-delete-addr]").forEach((delBtn) => {
    delBtn.onclick = () => {
      const addrId = delBtn.getAttribute("data-delete-addr");
      if (addrId) {
        accountTierService.deleteAddress(addrId);
        showToast(ui("آدرس حذف شد."));
        onNavigate("/");
      }
    };
  });

  // Level 1: Toggle Wishlist
  container.querySelectorAll<HTMLButtonElement>("[data-toggle-wishlist]").forEach((wishBtn) => {
    wishBtn.onclick = () => {
      const prodId = wishBtn.getAttribute("data-toggle-wishlist");
      if (prodId) {
        const added = accountTierService.toggleWishlist(prodId);
        showToast(added ? ui("به علاقه‌مندی‌ها اضافه شد.") : ui("از علاقه‌مندی‌ها حذف شد."));
        onNavigate("/");
      }
    };
  });

  // Level 1: View & Print Invoice Modal
  container.querySelectorAll<HTMLButtonElement>("[data-view-invoice]").forEach((invBtn) => {
    invBtn.onclick = () => {
      const ordId = invBtn.getAttribute("data-view-invoice");
      const order = accountTierService.getBuyerOrders().find((o) => o.id === ordId);
      if (!order) return;

      const modalHost = container.querySelector<HTMLElement>("#phoenix-invoice-modal-host") || document.body;
      const modal = document.createElement("div");
      modal.className = "phoenix-invoice-modal-backdrop";
      modal.innerHTML = `
        <div class="phoenix-invoice-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--line); padding-bottom: 14px; margin-bottom: 16px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <img src="/phoenix-mark.svg" alt="" style="width: 28px; height: 28px;" />
                <h3 style="margin: 0; font-size: 18px;">فاکتور رسمی سامانه ققنوس</h3>
              </div>
              <small style="color: var(--muted); display: block; margin-top: 4px;">شماره فاکتور: <strong>${escapeHtml(order.invoiceNumber)}</strong> · تاریخ: ${new Date(order.createdAt).toLocaleDateString("fa-IR")}</small>
            </div>
            <button type="button" class="button button-ghost button-sm no-print" id="btn-close-invoice" style="font-size: 18px; padding: 4px 10px;">✕</button>
          </div>

          <!-- Parties Info -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; font-size: 12.5px;">
            <div style="background: var(--surface-2); padding: 12px; border-radius: 10px;">
              <strong>فروشنده:</strong>
              <div>${escapeHtml(order.sellerName)}</div>
              <small style="color: var(--muted);">شناسه فروشگاه: ${escapeHtml(order.sellerId)}</small>
            </div>
            <div style="background: var(--surface-2); padding: 12px; border-radius: 10px;">
              <strong>خریدار:</strong>
              <div>${escapeHtml(order.buyerName)} (${escapeHtml(order.buyerMobile)})</div>
              <small style="color: var(--muted);">کد ملی: ${escapeHtml(order.buyerNationalCode || "ثبت‌شده")}</small>
              <div style="margin-top: 2px;">نشانی تحویل: ${escapeHtml(order.shippingAddress.streetLine1)}</div>
            </div>
          </div>

          <!-- Items Table -->
          <table class="phoenix-data-table" style="margin-bottom: 16px;">
            <thead>
              <tr>
                <th>شرح کالا / خدمت</th>
                <th>تعداد</th>
                <th>قیمت واحد</th>
                <th>قاعده قیمت‌گذاری</th>
                <th>مبلغ کل</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map((it) => `
                <tr>
                  <td>${escapeHtml(it.productTitle)}</td>
                  <td>${it.quantity}</td>
                  <td>${it.unitPriceMinor.toLocaleString("fa-IR")} ${order.currency}</td>
                  <td><span class="phoenix-tier-badge badge-info">${escapeHtml(it.appliedRule)}</span></td>
                  <td><strong>${it.lineTotalMinor.toLocaleString("fa-IR")} ${order.currency}</strong></td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <!-- Totals -->
          <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
            <div style="width: 240px; font-size: 13px;">
              <div style="display: flex; justify-content: space-between; padding: 4px 0;">
                <span>جمع اقلام:</span>
                <span>${order.subtotalMinor.toLocaleString("fa-IR")} ${order.currency}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 4px 0; color: var(--success);">
                <span>تخفیف:</span>
                <span>${order.discountMinor.toLocaleString("fa-IR")} ${order.currency}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 6px 0; border-top: 1px solid var(--line); font-weight: 800; font-size: 14px; color: var(--primary);">
                <span>مبلغ نهایی پرداخت‌شده:</span>
                <span>${order.grandTotalMinor.toLocaleString("fa-IR")} ${order.currency}</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; justify-content: space-between; align-items: center;" class="no-print">
            <span style="font-size: 11px; color: var(--muted);">کد رهگیری ارسال: <code>${escapeHtml(order.trackingNumber || "—")}</code></span>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="button button-primary button-sm" id="btn-print-invoice">
                🖨️ چاپ و دریافت PDF فاکتور
              </button>
              <button type="button" class="button button-outline button-sm" id="btn-dismiss-invoice">بستن</button>
            </div>
          </div>
        </div>
      `;
      modalHost.appendChild(modal);

      const closeModal = () => modal.remove();
      modal.querySelector("#btn-close-invoice")?.addEventListener("click", closeModal);
      modal.querySelector("#btn-dismiss-invoice")?.addEventListener("click", closeModal);
      modal.querySelector("#btn-print-invoice")?.addEventListener("click", () => {
        window.print();
      });
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
      });
    };
  });

  // Level 2: Store Info Form
  const l2StoreForm = container.querySelector<HTMLFormElement>("#level2-store-info-form");
  if (l2StoreForm) {
    l2StoreForm.onsubmit = (e) => {
      e.preventDefault();
      const name = (container.querySelector<HTMLInputElement>("#store-info-name")?.value || "").trim();
      const phone = (container.querySelector<HTMLInputElement>("#store-info-phone")?.value || "").trim();
      const description = (container.querySelector<HTMLInputElement>("#store-info-desc")?.value || "").trim();
      const address = (container.querySelector<HTMLInputElement>("#store-info-address")?.value || "").trim();
      const sheba = (container.querySelector<HTMLInputElement>("#store-info-sheba")?.value || "").trim();

      accountTierService.updateStoreInfo({ name, phone, description, address, sheba });
      showToast(ui("اطلاعات فروشگاه با موفقیت به‌روزرسانی شد."));
    };
  }

  // Level 2: Product Creation Form Toggle & Offering Type Helper
  const btnToggleProd = container.querySelector<HTMLButtonElement>("#btn-toggle-new-product");
  const formAddProd = container.querySelector<HTMLFormElement>("#level2-add-product-form");
  const btnCancelProd = container.querySelector<HTMLButtonElement>("#btn-cancel-new-prod");
  const selProdType = container.querySelector<HTMLSelectElement>("#new-prod-type");
  const hintProdType = container.querySelector<HTMLElement>("#new-prod-type-hint");

  if (btnToggleProd && formAddProd) {
    btnToggleProd.onclick = () => {
      formAddProd.style.display = formAddProd.style.display === "none" ? "block" : "none";
    };
  }
  if (btnCancelProd && formAddProd) {
    btnCancelProd.onclick = () => {
      formAddProd.style.display = "none";
    };
  }
  if (selProdType && hintProdType) {
    selProdType.onchange = () => {
      const val = selProdType.value;
      if (val === "physical") hintProdType.textContent = ui("کالای فیزیکی: موجودی، کنترل انبار و وزن کالا لحاظ می‌شود.");
      else if (val === "digital") hintProdType.textContent = ui("محصول دیجیتال / دانلودی: تحویل آنی فایل زیپ یا کلید لایسنس نرم‌افزار پس از پرداخت.");
      else if (val === "service") hintProdType.textContent = ui("خدمت / مشاوره: جلسه آنلاین یا خدمات حضوری با زمان‌بندی و رزرو.");
      else if (val === "variable") hintProdType.textContent = ui("محصول متغیر: تنوع ویژگی‌ها مانند رنگ‌بندی و اندازه‌ها.");
    };
  }
  if (formAddProd) {
    formAddProd.onsubmit = (e) => {
      e.preventDefault();
      const title = (container.querySelector<HTMLInputElement>("#new-prod-title")?.value || "").trim();
      const type = (container.querySelector<HTMLSelectElement>("#new-prod-type")?.value || "physical") as OfferingType;
      const basePriceMinor = Number(container.querySelector<HTMLInputElement>("#new-prod-price")?.value || 0);
      const inventory = Number(container.querySelector<HTMLInputElement>("#new-prod-inventory")?.value || 1);

      // Advanced prices if present
      const roleVip = Number(container.querySelector<HTMLInputElement>("#new-prod-role-vip")?.value || 0);
      const roleAgent1 = Number(container.querySelector<HTMLInputElement>("#new-prod-role-agent1")?.value || 0);
      const tierQty10 = Number(container.querySelector<HTMLInputElement>("#new-prod-tier-qty10")?.value || 0);

      const rolePrices: Record<string, number> = {};
      if (roleVip > 0) rolePrices.vip = roleVip;
      if (roleAgent1 > 0) rolePrices.tier_1_agent = roleAgent1;

      const tieredPrices = [];
      if (tierQty10 > 0) {
        tieredPrices.push({ minQty: 10, maxQty: null, priceAmountMinor: tierQty10 });
      }

      const productPayload: Parameters<typeof accountTierService.saveProduct>[0] = {
        sellerId: "seller-me",
        title,
        description: "عرضه ثبت‌شده در سامانه فروشگاه",
        type,
        basePriceMinor,
        inventory,
        images: ["/phoenix-mark.svg"],
        status: "published",
      };
      if (Object.keys(rolePrices).length > 0) {
        productPayload.rolePrices = rolePrices;
      }
      if (tieredPrices.length > 0) {
        productPayload.tieredPrices = tieredPrices;
      }

      accountTierService.saveProduct(productPayload);

      showToast(ui("محصول با موفقیت در کاتالوگ فروشگاه ثبت شد."));
      onNavigate("/business");
    };
  }

  // Level 2: Product Status Toggle (publish / disable)
  container.querySelectorAll<HTMLButtonElement>("[data-prod-status]").forEach((stBtn) => {
    stBtn.onclick = () => {
      const id = stBtn.getAttribute("data-prod-status");
      const status = stBtn.getAttribute("data-status") as "published" | "disabled";
      if (id && status) {
        accountTierService.updateProductStatus(id, status);
        showToast(ui("وضعیت محصول به‌روزرسانی شد."));
        onNavigate("/business");
      }
    };
  });

  // Level 2 & 3: Customer Role Selection (Store-scoped CRM)
  container.querySelectorAll<HTMLSelectElement>("[data-change-customer-role]").forEach((roleSel) => {
    roleSel.onchange = () => {
      const buyerId = roleSel.getAttribute("data-change-customer-role");
      const role = roleSel.value as StoreBuyerRole;
      if (buyerId && role) {
        accountTierService.updateStoreCustomerRole(buyerId, role);
        showToast(ui("نقش خریدار در این فروشگاه به‌روزرسانی شد."));
      }
    };
  });

  // Level 2: Timed Discount Toggle & Submit
  const btnToggleDisc = container.querySelector<HTMLButtonElement>("#btn-toggle-new-discount");
  const formAddDisc = container.querySelector<HTMLFormElement>("#level2-add-discount-form");
  const btnCancelDisc = container.querySelector<HTMLButtonElement>("#btn-cancel-new-discount");

  if (btnToggleDisc && formAddDisc) {
    btnToggleDisc.onclick = () => {
      formAddDisc.style.display = formAddDisc.style.display === "none" ? "block" : "none";
    };
  }
  if (btnCancelDisc && formAddDisc) {
    btnCancelDisc.onclick = () => {
      formAddDisc.style.display = "none";
    };
  }
  if (formAddDisc) {
    formAddDisc.onsubmit = (e) => {
      e.preventDefault();
      const discountType = (container.querySelector<HTMLSelectElement>("#new-disc-type")?.value || "percentage") as "percentage" | "fixed";
      const value = Number(container.querySelector<HTMLInputElement>("#new-disc-val")?.value || 0);
      const maxUses = Number(container.querySelector<HTMLInputElement>("#new-disc-max")?.value || 100);
      const minOrderAmount = Number(container.querySelector<HTMLInputElement>("#new-disc-min-order")?.value || 0);

      accountTierService.saveDiscount({
        sellerId: "seller-me",
        productIds: [],
        discountType,
        value,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000 * 30).toISOString(),
        maxUses,
        minOrderAmount,
      });

      showToast(ui("تخفیف زمان‌دار با موفقیت تعریف شد."));
      onNavigate("/business");
    };
  }

  // Level 3: Corporate Upgrade Form Submit
  const corpUpgradeForm = container.querySelector<HTMLFormElement>("#level3-corp-upgrade-form");
  const btnShowCorpUpgrade = container.querySelector<HTMLButtonElement>("#btn-show-corp-upgrade-form");

  if (btnShowCorpUpgrade) {
    btnShowCorpUpgrade.onclick = () => {
      const corpTab = container.querySelector<HTMLButtonElement>('.phoenix-tier-tab-btn[data-tab-target="pane-biz-corp"]');
      if (corpTab) corpTab.click();
    };
  }

  if (corpUpgradeForm) {
    corpUpgradeForm.onsubmit = (e) => {
      e.preventDefault();
      const companyName = (container.querySelector<HTMLInputElement>("#corp-company-name")?.value || "").trim();
      const registrationNumber = (container.querySelector<HTMLInputElement>("#corp-reg-number")?.value || "").trim();
      const nationalId = (container.querySelector<HTMLInputElement>("#corp-national-id")?.value || "").trim();
      const economicCode = (container.querySelector<HTMLInputElement>("#corp-economic-code")?.value || "").trim();
      const feedback = container.querySelector<HTMLElement>("#corp-upgrade-feedback");

      const res = accountTierService.upgradeToCorporate({
        companyName,
        registrationNumber,
        nationalId,
        economicCode,
      });

      if (!res.success) {
        if (feedback) {
          feedback.textContent = res.errors.join(" ");
          feedback.style.color = "var(--danger)";
        }
        showToast(ui("اطلاعات شرکتی ناقص است."));
        return;
      }

      showToast(ui("درخواست ارتقا به فروشگاه شرکتی ثبت شد و در انتظار بررسی قرار گرفت."));
      onNavigate("/business");
    };
  }

  // Developer Simulation Controls (Approved / Rejected)
  container.querySelectorAll<HTMLButtonElement>("[data-sim-corp-status]").forEach((simBtn) => {
    simBtn.onclick = () => {
      const st = simBtn.getAttribute("data-sim-corp-status") as "approved" | "rejected" | "pending_review";
      if (st) {
        accountTierService.adminSimulateVerification(
          st as "approved" | "rejected",
          st === "rejected" ? "مدارک ثبت شرکت ناخوانا است و نیاز به ارسال مجدد دارد." : undefined
        );
        showToast(ui(`وضعیت شرکتی به ${st} تغییر یافت.`));
        onNavigate("/business");
      }
    };
  });

  // Favorite toggle
  const favBtn = container.querySelector<HTMLButtonElement>("#fav-toggle-btn");
  if (favBtn) {
    favBtn.onclick = () => {
      const active = favBtn.style.color === "red";
      favBtn.style.color = active ? "" : "red";
      showToast(active ? ui("از علاقه‌مندی‌ها حذف شد") : ui("به علاقه‌مندی‌ها اضافه شد"));
    };
  }

  // Generic data-toast elements
  container.querySelectorAll<HTMLElement>("[data-toast]").forEach((el) => {
    el.onclick = () => {
      const msg = el.getAttribute("data-toast");
      if (msg) showToast(msg);
    };
  });

  // Search forms
  const indivSearch = container.querySelector<HTMLFormElement>("#individual-search-form");
  if (indivSearch) {
    indivSearch.onsubmit = (e) => {
      e.preventDefault();
      const q = container.querySelector<HTMLInputElement>("#individual-search-input")?.value || "";
      onNavigate("/discover?q=" + encodeURIComponent(q));
    };
  }
  const consSearch = container.querySelector<HTMLFormElement>("#consumer-search-form");
  if (consSearch) {
    consSearch.onsubmit = (e) => {
      e.preventDefault();
      const q = container.querySelector<HTMLInputElement>("#consumer-search-input")?.value || "";
      onNavigate("/discover?q=" + encodeURIComponent(q));
    };
  }

  // Notifications tabs filter
  container.querySelectorAll<HTMLButtonElement>("[data-notif-filter]").forEach((btn) => {
    btn.onclick = () => {
      container.querySelectorAll("[data-notif-filter]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const cat = btn.getAttribute("data-notif-filter");
      container.querySelectorAll<HTMLElement>(".phoenix-notification-item").forEach((item) => {
        const itemCat = item.getAttribute("data-category");
        if (cat === "all" || itemCat === cat) {
          item.style.display = "flex";
        } else {
          item.style.display = "none";
        }
      });
    };
  });
}

function showToast(msg: string): void {
  const host = document.querySelector<HTMLElement>("#toast-host") || document.body;
  const toast = document.createElement("div");
  toast.className = "phoenix-floating-toast";
  toast.style.cssText = "position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:#241c17; color:#fff; padding:10px 18px; border-radius:999px; font-size:13px; z-index:9999; box-shadow:0 8px 24px rgba(0,0,0,0.2); animation:fadeIn 0.2s ease;";
  toast.textContent = msg;
  host.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

/**
 * Responsive Master Layout wrapper for Phoenix Portal experience.
 */
export function renderPhoenixMasterLayout(_persona: PhoenixPersona, innerScreenHtml: string): string {
  return `
    <div class="phoenix-portal-layout container-wide">
      ${innerScreenHtml}
    </div>
  `;
}

