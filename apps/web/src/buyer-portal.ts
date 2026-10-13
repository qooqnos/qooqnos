// ============================================================================
// PHOENIX BUYER EXPERIENCE (Phases 5, 6, 7, 8, 9, 10, 11)
// Architecture Hierarchy: Active Orders → Required Action → Recent Activity → Discovery
// ============================================================================

import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
} from "./calendar-service.js";
import { globalLocaleService } from "./locale-service.js";
import { translateUiText } from "./i18n-runtime.js";

function escapeUi(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);
}

export interface UiTimelineStep {
  readonly id: string;
  readonly label: string;
  readonly description?: string | undefined;
  readonly icon?: string | undefined;
  readonly status: "completed" | "current" | "upcoming" | "exception";
  readonly timestamp?: string | undefined;
}

export function uiBadge(label: string, tone: "neutral" | "info" | "warning" | "success" | "danger" = "neutral", icon = ""): string {
  const iconPart = icon ? `<span class="ds-badge-icon">${escapeUi(icon)}</span> ` : "";
  return `<span class="ds-badge ds-badge-${tone}">${iconPart}${escapeUi(label)}</span>`;
}

export function uiTimeline(steps: readonly UiTimelineStep[]): string {
  return `
    <div class="ds-timeline-container" role="list">
      ${steps.map((step, idx) => {
        const stepNum = idx + 1;
        const icon = step.status === "completed" ? "✓" : step.status === "exception" ? "✕" : (step.icon || String(stepNum));
        return `
          <div class="ds-timeline-node ds-timeline-${step.status}" role="listitem">
            <div class="ds-timeline-marker">
              <span class="ds-timeline-icon">${escapeUi(icon)}</span>
              ${idx < steps.length - 1 ? '<div class="ds-timeline-connector"></div>' : ""}
            </div>
            <div class="ds-timeline-content">
              <div class="ds-timeline-header">
                <strong class="ds-timeline-title">${escapeUi(step.label)}</strong>
                ${step.timestamp ? `<time class="ds-timeline-time">${escapeUi(step.timestamp)}</time>` : ""}
              </div>
              ${step.description ? `<p class="ds-timeline-desc">${escapeUi(step.description)}</p>` : ""}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

export function uiKpiCard(options: {
  title: string;
  value: string;
  subtitle?: string | undefined;
  icon?: string | undefined;
  trend?: { direction: "up" | "down" | "neutral"; label: string } | undefined;
}): string {
  const iconHtml = options.icon ? `<span class="ds-kpi-icon">${escapeUi(options.icon)}</span>` : "";
  const trendHtml = options.trend ? `<span class="ds-kpi-trend ds-kpi-trend-${options.trend.direction}">${escapeUi(options.trend.label)}</span>` : "";
  return `
    <article class="glass-card ds-kpi-card">
      <div class="ds-kpi-header">
        <span class="ds-kpi-title">${escapeUi(options.title)}</span>
        ${iconHtml}
      </div>
      <div class="ds-kpi-value">${escapeUi(options.value)}</div>
      ${options.subtitle || options.trend ? `
        <div class="ds-kpi-footer">
          ${trendHtml}
          ${options.subtitle ? `<span class="ds-kpi-subtitle">${escapeUi(options.subtitle)}</span>` : ""}
        </div>
      ` : ""}
    </article>
  `;
}

export interface BuyerProfileData {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  interests: string[];
  locale?: string;
  timezone?: string;
  followingCount: number;
  savedCount: number;
  ordersCount: number;
  privacy: {
    profileVisibility: "public" | "contacts" | "private";
    activityTracking: boolean;
    personalizationEnabled: boolean;
    searchHistoryEnabled: boolean;
    marketingConsent: boolean;
  };
  preferences: {
    currency: string;
    preferredCategories: string[];
    deliveryInstruction?: string;
  };
}

export interface BuyerOrderSummary {
  id: string;
  state: string; // OrderLifecycleState
  businessName: string;
  businessId?: string;
  itemCount: number;
  firstItemTitle: string;
  firstItemImage?: string;
  grandTotalMinor: number;
  currency: string;
  createdAt: string;
  trackingNumber?: string;
  carrierName?: string;
  etaDate?: string;
  latestUpdate?: string;
  hasIssue?: boolean;
}

// ----------------------------------------------------------------------------
// Phase 6: Buyer Dashboard Core (Strict Priority Hierarchy)
// 1. Active Order
// 2. Required Action
// 3. Recent Activity
// 4. Discovery
// ----------------------------------------------------------------------------

export function renderBuyerDashboardView(options: {
  profile: BuyerProfileData;
  orders: BuyerOrderSummary[];
  recentActivity: { id: string; title: string; time: string; type: string }[];
  recommendedOfferings: { id: string; title: string; price: number; category: string; rating: number }[];
}): string {
  const locale = globalLocaleService.getLocale();
  const activeOrders = options.orders.filter(
    (o) => !["delivered", "cancelled", "refunded"].includes(o.state),
  );
  const completedOrders = options.orders.filter((o) => o.state === "delivered");
  const issueOrders = options.orders.filter(
    (o) => ["order_issue", "payment_failed", "delivery_failed", "delayed", "return_requested"].includes(o.state),
  );

  const t = (persianText: string) => translateUiText(persianText, locale);

  // 1. TOP SECTION: Mandatory Active Orders & Action Required Banner
  let priorityAlertHtml = "";
  if (issueOrders.length > 0 && issueOrders[0]) {
    const issueOrder = issueOrders[0];
    priorityAlertHtml = `
      <section class="buyer-priority-alert" role="alert" aria-live="assertive">
        <div class="glass-card buyer-alert-card buyer-alert-danger">
          <div class="buyer-alert-content">
            <span class="buyer-alert-icon">⚠</span>
            <div>
              <strong>${t("سفارش نیازمند توجه شماست")}</strong>
              <p>${t("سفارش")} #${issueOrder.id} (${issueOrder.businessName}): ${issueOrder.latestUpdate || t("لطفاً وضعیت پرداخت یا آدرس را بررسی کنید.")}</p>
            </div>
          </div>
          <div class="buyer-alert-actions">
            <button class="button button-primary" type="button" data-track-order="${issueOrder.id}">${t("رسیدگی فوری")}</button>
          </div>
        </div>
      </section>
    `;
  }

  // 2. ACTIVE ORDERS HIGHLIGHT (Hierarchy Position 1)
  let activeOrdersHtml = "";
  if (activeOrders.length > 0) {
    activeOrdersHtml = `
      <section class="buyer-section buyer-active-orders-section" aria-labelledby="active-orders-title">
        <div class="section-header">
          <div>
            <span class="section-kicker">Priority 1 · Orders</span>
            <h2 id="active-orders-title">${t("سفارش‌های فعال شما")}</h2>
          </div>
          <span class="ds-badge ds-badge-info">${activeOrders.length} ${t("در جریان")}</span>
        </div>

        <div class="buyer-orders-grid">
          ${activeOrders.map((ord) => renderOrderTrackingCard(ord, locale)).join("")}
        </div>
      </section>
    `;
  }

  // 3. KPI SUMMARY (Orders, Activity, Saved)
  const kpiRowHtml = `
    <section class="buyer-kpis-grid" aria-label="${t("آمار کلی حساب")}">
      ${uiKpiCard({
        title: t("سفارش‌های فعال"),
        value: formatNumber(activeOrders.length, locale),
        subtitle: issueOrders.length > 0 ? `${issueOrders.length} ${t("نیازمند اقدام")}` : t("طبق برنامه"),
        icon: "📦",
        trend: activeOrders.length > 0 ? { direction: "up", label: t("زنده") } : undefined,
      })}
      ${uiKpiCard({
        title: t("خریدهای تحویل‌شده"),
        value: formatNumber(completedOrders.length, locale),
        subtitle: t("مجموع کل"),
        icon: "✓",
        trend: { direction: "neutral", label: t("آرشیو") },
      })}
      ${uiKpiCard({
        title: t("نشان‌شده‌ها"),
        value: formatNumber(options.profile.savedCount, locale),
        subtitle: t("لیست علاقه‌مندی"),
        icon: "★",
      })}
      ${uiKpiCard({
        title: t("فروشندگان دنبال‌شده"),
        value: formatNumber(options.profile.followingCount, locale),
        subtitle: t("شبکه مورد اعتماد"),
        icon: "👥",
      })}
    </section>
  `;

  // 4. RECENT ACTIVITY (Hierarchy Position 3)
  const activityListHtml = options.recentActivity.length > 0
    ? `
      <div class="buyer-activity-list">
        ${options.recentActivity.map((act) => `
          <div class="buyer-activity-row">
            <span class="buyer-activity-dot">✦</span>
            <div class="buyer-activity-meta">
              <strong>${act.title}</strong>
              <small class="ds-caption">${act.time}</small>
            </div>
          </div>
        `).join("")}
      </div>
    `
    : `<div class="slot-empty"><p>${t("هنوز فعالیتی ثبت نشده است.")}</p></div>`;

  const recentActivitySection = `
    <section class="buyer-section buyer-activity-section" aria-labelledby="activity-title">
      <div class="section-header">
        <div>
          <span class="section-kicker">Priority 3 · Signals</span>
          <h2 id="activity-title">${t("فعالیت‌های اخیر و اعلان‌ها")}</h2>
        </div>
        <a class="text-link" href="/activity" data-nav>${t("مشاهده همه ←")}</a>
      </div>
      <div class="glass-card buyer-activity-card">
        ${activityListHtml}
      </div>
    </section>
  `;

  // 5. DISCOVERY & RECOMMENDATIONS (Hierarchy Position 4 - Placed strictly AFTER orders and activity)
  const discoveryCardsHtml = options.recommendedOfferings.map((offering) => `
    <article class="glass-card buyer-discovery-card">
      <div class="buyer-disc-media">✦</div>
      <div class="buyer-disc-info">
        <span class="buyer-disc-cat">${offering.category}</span>
        <h3>${offering.title}</h3>
        <div class="buyer-disc-price">${formatCurrency(offering.price, "IRR", locale)}</div>
      </div>
      <div class="buyer-disc-action">
        <a class="button button-ghost" href="/discover?item=${encodeURIComponent(offering.id)}" data-nav>${t("بررسی")}</a>
      </div>
    </article>
  `).join("");

  const discoverySection = `
    <section class="buyer-section buyer-discovery-section" aria-labelledby="discovery-title">
      <div class="section-header">
        <div>
          <span class="section-kicker">Priority 4 · Discover</span>
          <h2 id="discovery-title">${t("پیشنهادهای کشف و خرید مجدد")}</h2>
        </div>
        <a class="button button-ghost" href="/discover" data-nav>${t("کاوش بازار")}</a>
      </div>
      <div class="buyer-discovery-grid">
        ${discoveryCardsHtml}
      </div>
    </section>
  `;

  return `
    <div class="phoenix-buyer-dashboard" dir="${globalLocaleService.getDirection()}">
      <!-- Welcome Header -->
      <section class="buyer-welcome-banner">
        <div class="buyer-welcome-copy">
          <span class="eyebrow"><i></i> ${t("داشبورد خریدار ققنوس")}</span>
          <h1>${t("خوش آمدید،")} <em>${options.profile.name || options.profile.username}</em></h1>
          <p>${t("وضعیت سفارش‌های فعال، رهگیری زنده محموله‌ها و مدیریت حساب شما در یک نمای یکپارچه.")}</p>
        </div>
        <div class="buyer-welcome-actions">
          <a class="button button-ghost" href="/profile" data-nav>${t("پروفایل من")}</a>
          <a class="button button-primary" href="/discover" data-nav>${t("خرید جدید <span>←</span>")}</a>
        </div>
      </section>

      ${priorityAlertHtml}
      ${activeOrdersHtml}
      ${kpiRowHtml}
      
      <div class="buyer-dashboard-columns">
        <div class="buyer-col-main">
          ${discoverySection}
        </div>
        <div class="buyer-col-side">
          ${recentActivitySection}
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Phase 7: Order Tracking Card (Used in Dashboard & Orders list)
// ----------------------------------------------------------------------------

export function renderOrderTrackingCard(
  order: BuyerOrderSummary,
  locale: "fa" | "ar" | "en" = "fa",
): string {
  const t = (persianText: string) => translateUiText(persianText, locale);
  const isDelivered = order.state === "delivered";
  const badgeTone = isDelivered ? "success" : order.hasIssue ? "danger" : "info";

  return `
    <article class="glass-card buyer-order-card" data-order-id="${order.id}">
      <div class="buyer-order-card-header">
        <div>
          <span class="buyer-order-store">${order.businessName}</span>
          <h3 class="buyer-order-id">#${order.id}</h3>
        </div>
        ${uiBadge(order.state, badgeTone)}
      </div>

      <div class="buyer-order-card-body">
        <div class="buyer-order-item-peek">
          <span class="buyer-order-item-icon">📦</span>
          <div>
            <strong>${order.firstItemTitle}</strong>
            ${order.itemCount > 1 ? `<small class="ds-caption">+${order.itemCount - 1} ${t("قلم دیگر")}</small>` : ""}
          </div>
        </div>

        <div class="buyer-order-meta-grid">
          <div>
            <span class="ds-caption">${t("مبلغ:")}</span>
            <strong>${formatCurrency(order.grandTotalMinor, order.currency || "IRR", locale)}</strong>
          </div>
          <div>
            <span class="ds-caption">${t("کد رهگیری:")}</span>
            <code>${order.trackingNumber || "—"}</code>
          </div>
          ${order.etaDate ? `
            <div>
              <span class="ds-caption">${t("تحویل تقریبی:")}</span>
              <span>${formatDate(order.etaDate, locale)}</span>
            </div>
          ` : ""}
        </div>
      </div>

      <div class="buyer-order-card-footer">
        <button class="button button-ghost" type="button" data-track-order="${order.id}">
          ${t("رهگیری گام‌به‌گام")}
        </button>
        ${isDelivered ? `
          <a class="button button-ghost" href="/discover?reorder=${encodeURIComponent(order.id)}" data-nav>${t("خرید مجدد")}</a>
        ` : `
          <a class="button button-ghost" href="/messages?topic=${encodeURIComponent(order.id)}" data-nav>${t("گفتگو با فروشنده")}</a>
        `}
      </div>
    </article>
  `;
}

// ----------------------------------------------------------------------------
// Phase 7: Interactive Order Tracking Timeline Drawer
// ----------------------------------------------------------------------------

export function renderOrderTrackingTimelineView(options: {
  orderId: string;
  businessName: string;
  state: string;
  timelineSteps: UiTimelineStep[];
  trackingNumber?: string;
  carrierName?: string;
  deliveryAddress?: string;
  eta?: string;
  items: { title: string; quantity: number; unitPrice: number }[];
  grandTotal: number;
  currency: string;
  locale?: "fa" | "ar" | "en";
}): string {
  const loc = options.locale ?? globalLocaleService.getLocale();
  const t = (persianText: string) => translateUiText(persianText, loc);

  return `
    <div class="buyer-tracking-drawer-inner">
      <div class="buyer-tracking-header">
        <div>
          <span class="ds-caption">${t("فروشنده:")} ${options.businessName}</span>
          <h2>${t("رهگیری سفارش")} #${options.orderId}</h2>
        </div>
        ${uiBadge(options.state, options.state === "delivered" ? "success" : "info")}
      </div>

      <!-- Carrier & Delivery Meta -->
      <div class="glass-card buyer-tracking-carrier-box">
        <div class="carrier-box-row">
          <span>${t("شرکت حمل:")} <strong>${options.carrierName || "پست پیشتاز ققنوس"}</strong></span>
          <span>${t("کد رهگیری:")} <code>${options.trackingNumber || "—"}</code></span>
        </div>
        ${options.eta ? `
          <div class="carrier-box-row">
            <span>${t("زمان تقریبی تحویل:")} <strong>${formatDateTime(options.eta, loc)}</strong></span>
          </div>
        ` : ""}
        ${options.deliveryAddress ? `
          <div class="carrier-box-row">
            <span>${t("آدرس گیرنده:")} <p class="ds-caption">${options.deliveryAddress}</p></span>
          </div>
        ` : ""}
      </div>

      <!-- Interactive Stepped Timeline -->
      <section class="buyer-timeline-section" aria-label="${t("مراحل رهگیری")}">
        <h3>${t("مراحل پیشرفت سفارش")}</h3>
        ${uiTimeline(options.timelineSteps)}
      </section>

      <!-- Items Summary in Tracking -->
      <section class="buyer-tracking-items">
        <h3>${t("اقلام این سفارش")}</h3>
        <div class="buyer-tracking-items-list">
          ${options.items.map((it) => `
            <div class="buyer-tracking-item-row">
              <div>
                <strong>${it.title}</strong>
                <small class="ds-caption">× ${formatNumber(it.quantity, loc)}</small>
              </div>
              <span>${formatCurrency(it.unitPrice * it.quantity, options.currency, loc)}</span>
            </div>
          `).join("")}
        </div>
        <div class="buyer-tracking-total-row">
          <strong>${t("مبلغ کل:")}</strong>
          <strong>${formatCurrency(options.grandTotal, options.currency, loc)}</strong>
        </div>
      </section>

      <div class="buyer-tracking-drawer-actions">
        <button class="button button-ghost" type="button" data-drawer-close="order-tracking-drawer">${t("بستن")}</button>
        <a class="button button-primary" href="/messages?order=${encodeURIComponent(options.orderId)}" data-nav>${t("گزارش مشکل یا مرجوعی")}</a>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Phase 5: Buyer Profile Foundation (Extensible Profile Surface)
// ----------------------------------------------------------------------------

export function renderBuyerProfileView(options: {
  profile: BuyerProfileData;
  orders: BuyerOrderSummary[];
  savedCount: number;
}): string {
  const locale = globalLocaleService.getLocale();
  const t = (persianText: string) => translateUiText(persianText, locale);

  return `
    <div class="phoenix-buyer-profile" dir="${globalLocaleService.getDirection()}">
      <!-- Profile Header / Cover -->
      <section class="buyer-profile-card glass-card">
        <div class="buyer-profile-cover">
          <div class="buyer-profile-avatar-wrap">
            <img class="buyer-avatar" src="${options.profile.avatarUrl || "/phoenix-mark.svg?v=1"}" alt="${options.profile.name}" />
            <button class="button ds-button-icon buyer-avatar-edit" type="button" aria-label="${t("تغییر تصویر")}">📷</button>
          </div>
        </div>

        <div class="buyer-profile-details">
          <div class="buyer-profile-headings">
            <h1>${options.profile.name}</h1>
            <span class="buyer-username">@${options.profile.username}</span>
            <p class="buyer-bio">${options.profile.bio || t("هنوز بیوگرافی ثبت نشده است.")}</p>
          </div>

          <div class="buyer-profile-stats">
            <div><strong>${formatNumber(options.orders.length, locale)}</strong><span>${t("سفارش‌ها")}</span></div>
            <div><strong>${formatNumber(options.profile.followingCount, locale)}</strong><span>${t("دنبال‌شده")}</span></div>
            <div><strong>${formatNumber(options.savedCount, locale)}</strong><span>${t("نشان‌شده")}</span></div>
          </div>
        </div>
      </section>

      <!-- Profile Tabs: Preferences, Activity, Privacy, Addresses -->
      <section class="buyer-profile-sections">
        <div class="ds-tabs" role="tablist" aria-label="${t("بخش‌های پروفایل")}">
          <button class="ds-tab active" type="button" role="tab" id="tab-pref" data-buyer-tab="preferences" aria-selected="true">${t("علاقه‌مندی‌ها و سلیقه")}</button>
          <button class="ds-tab" type="button" role="tab" id="tab-orders" data-buyer-tab="orders" aria-selected="false">${t("تاریخچه سفارش‌ها")}</button>
          <button class="ds-tab" type="button" role="tab" id="tab-privacy" data-buyer-tab="privacy" aria-selected="false">${t("حریم خصوصی و داده‌ها")}</button>
          <button class="ds-tab" type="button" role="tab" id="tab-settings" data-buyer-tab="settings" aria-selected="false">${t("تنظیمات حساب")}</button>
        </div>

        <!-- Tab 1: Preferences & Interests -->
        <div class="buyer-tab-pane active" id="pane-preferences">
          <div class="glass-card buyer-pane-card">
            <h3>${t("زمینه‌های مورد علاقه شما")}</h3>
            <p class="ds-caption">${t("این برچسب‌ها به ققنوس کمک می‌کنند تا محصولات و کسب‌وکارهای متناسب با شما را بدون نشت داده پیشنهاد دهد.")}</p>
            <div class="buyer-interests-tags">
              ${options.profile.interests.map((interest) => `<span class="ds-pill">${interest} <button type="button" aria-label="حذف">✕</button></span>`).join("")}
              <button class="button button-ghost" type="button">+ ${t("افزودن برچسب علاقه")}</button>
            </div>
          </div>
        </div>

        <!-- Tab 2: Orders Summary -->
        <div class="buyer-tab-pane" id="pane-orders" style="display:none;">
          <div class="buyer-orders-history-list">
            ${options.orders.map((ord) => renderOrderTrackingCard(ord, locale)).join("")}
          </div>
        </div>

        <!-- Tab 3: Privacy & User Controls (Phase 11) -->
        <div class="buyer-tab-pane" id="pane-privacy" style="display:none;">
          <div class="glass-card buyer-pane-card">
            <h3>${t("کنترل‌های حریم خصوصی خریدار")}</h3>
            <div class="buyer-privacy-toggles">
              <label class="buyer-toggle-row">
                <div>
                  <strong>${t("شخصی‌سازی هوشمند پیشنهادها")}</strong>
                  <p class="ds-caption">${t("استفاده از سیگنال‌های جستجو برای پیشنهاد محصولات مرتبط.")}</p>
                </div>
                <input type="checkbox" ${options.profile.privacy.personalizationEnabled ? "checked" : ""} />
              </label>

              <label class="buyer-toggle-row">
                <div>
                  <strong>${t("ذخیره تاریخچه جستجو")}</strong>
                  <p class="ds-caption">${t("امکان مرور عبارت‌های جستجوشده قبلی در دستگاه شما.")}</p>
                </div>
                <input type="checkbox" ${options.profile.privacy.searchHistoryEnabled ? "checked" : ""} />
              </label>

              <label class="buyer-toggle-row">
                <div>
                  <strong>${t("نمایش پروفایل برای سایر کاربران")}</strong>
                  <p class="ds-caption">${t("نمایش نام و تصویر شما در بخش نظرات محصولات.")}</p>
                </div>
                <input type="checkbox" ${options.profile.privacy.profileVisibility === "public" ? "checked" : ""} />
              </label>
            </div>
          </div>
        </div>

        <!-- Tab 4: Account Settings -->
        <div class="buyer-tab-pane" id="pane-settings" style="display:none;">
          <div class="glass-card buyer-pane-card">
            <h3>${t("زبان و فرمت‌های نمایشی")}</h3>
            <p class="ds-caption">${t("زبان و تقویم در منوی بالای صفحه و در سطح کل سامانه تنظیم می‌شود.")}</p>
            <div class="buyer-settings-summary">
              <div><span>${t("زبان فعال:")}</span> <strong>${locale.toUpperCase()}</strong></div>
              <div><span>${t("نوع تقویم:")}</span> <strong>${locale === "fa" ? "شمسی / جلالی" : locale === "ar" ? "قمری / Hijri" : "میلادی / Gregorian"}</strong></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}
