import { getVerticalModuleBlueprint, getVerticalModuleCapabilityContract, getVerticalModuleRoleFit, getVerticalModuleUiContract, resolveVerticalRoleLens, VERTICAL_MODULE_SLUGS, type VerticalModuleBlueprint, type VerticalModuleLayout } from "./business-module-ui.js";
import { defaultI18n, translateUiText } from "./i18n-runtime.js";
import { getVerticalWorkflowStageContext, getVerticalWorkflowStageModule, getVerticalWorkflowSteps } from "./business-workflow-ui.js";

type VerticalWorkflowEntityRecord = Record<string, unknown>;

export type VerticalWorkflowCanvasModel = {
  readonly vertical: string;
  readonly module: string;
  readonly blueprint: VerticalModuleBlueprint;
  readonly businessId?: string;
  /**
   * Resolve a canonical surface link inside the current Workspace context.
   * The caller owns routing policy; the canvas only renders the resolved href.
   */
  readonly contextualHref?: (path: string) => string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Authored UI copy uses the shared locale dictionary; domain identifiers remain unchanged. */
function authoredText(value: string): string {
  return escapeHtml(translateUiText(value, defaultI18n.getLanguage()));
}

function uiCopy(key: string, fallback: string): string {
  const translated = defaultI18n.t(key);
  return escapeHtml(translated === key ? fallback : translated);
}

const layoutCopy: Record<VerticalModuleLayout, { label: string; description: string }> = {
  command: {
    label: "Command",
    description: "سطح فرمان؛ اقدام‌های اصلی و صف کاری بدون ساختن state موازی.",
  },
  calendar: {
    label: "Calendar",
    description: "سطح زمان و ظرفیت؛ slot و schedule فقط از Availability/Booking تغذیه می‌شوند.",
  },
  catalog: {
    label: "Supply",
    description: "سطح عرضه؛ محصول و خدمت در Catalog/Seller AI منبع حقیقت باقی می‌مانند.",
  },
  people: {
    label: "People",
    description: "سطح رابطه و تیم؛ هویت، نقش و رابطه مشتری از domainهای canonical می‌آیند.",
  },
  commerce: {
    label: "Commerce",
    description: "سطح معامله؛ Order، Billing و Fulfillment دوباره در Workspace ذخیره نمی‌شوند.",
  },
  operations: {
    label: "Operations",
    description: "سطح اجرای عملیات؛ صف‌های عملیاتی به Cases/Fulfillment متصل می‌شوند.",
  },
  communication: {
    label: "Communication",
    description: "سطح ارتباط؛ گفتگو و notification از Communication boundary خوانده می‌شوند.",
  },
};

export type VerticalWorkflowUiContext = {
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly workspaceId?: string;
  readonly tenantId?: string;
};

type VerticalWorkflowContextCache = {
  readonly key: string;
  readonly promise: Promise<VerticalWorkflowUiContext>;
};

let verticalWorkflowContextCache: VerticalWorkflowContextCache | null = null;

export function invalidateVerticalWorkflowContextCache(): void {
  verticalWorkflowContextCache = null;
}

export async function getVerticalWorkflowUiContext(): Promise<VerticalWorkflowUiContext | null> {
  const token = sessionStorage.getItem("phoenix-access-token")?.trim();
  const workspaceId = localStorage.getItem("phoenix-workspace-id")?.trim();
  if (!token || !workspaceId) {
    verticalWorkflowContextCache = null;
    return null;
  }

  const key = workspaceId + "|" + token;
  if (verticalWorkflowContextCache?.key === key) {
    return verticalWorkflowContextCache.promise;
  }

  const headers = new Headers({
    Accept: "application/json",
    Authorization: "Bearer " + token,
    "x-workspace-id": workspaceId,
  });

  const promise = fetch("/api/v1/context", { headers })
    .then(async (response) => {
      const body = await response.json().catch(() => null) as {
        roles?: string[];
        permissions?: string[];
        workspaceId?: string;
        tenantId?: string;
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Context unavailable");
      }
      return {
        roles: Array.isArray(body?.roles) ? body.roles : [],
        permissions: Array.isArray(body?.permissions) ? body.permissions : [],
        ...(body?.workspaceId ? { workspaceId: body.workspaceId } : { workspaceId }),
        ...(body?.tenantId ? { tenantId: body.tenantId } : {}),
      };
    });

  verticalWorkflowContextCache = { key, promise };
  try {
    return await promise;
  } catch (error) {
    if (verticalWorkflowContextCache?.promise === promise) {
      verticalWorkflowContextCache = null;
    }
    throw error;
  }
}

function workflowModuleHref(model: VerticalWorkflowCanvasModel, module: string): string {
  const route = getVerticalModuleUiContract(model.vertical, module).route;
  const params = new URLSearchParams();
  if (model.businessId) params.set("business", model.businessId);
  params.set("fromModule", model.module);
  return params.toString() ? route + "?" + params.toString() : route;
}

function contextualHref(model: VerticalWorkflowCanvasModel, path?: string): string {
  if (!path) return "";
  return model.contextualHref ? model.contextualHref(path) : path;
}

function emptyState(message: string, eyebrow = "Canonical data"): string {
  return '<div class="phoenix-vwf-empty"><span class="phoenix-vwf-empty-mark">◌</span><strong>' + uiCopy("messages.noResults", "داده نمایشی در این سطح ساخته نمی‌شود") + '</strong><p>' +
    escapeHtml(message) +
    '</p><small>' + authoredText(eyebrow) + '</small></div>';
}

function viewState(label: string): string {
  return '<span class="phoenix-vwf-view-state" data-vwf-view-state>' + uiCopy("ui.vertical_currentStage", "نمای فعال") + ': ' + escapeHtml(label) + '</span>';
}

function renderCommand(model: VerticalWorkflowCanvasModel): string {
  const action = model.blueprint.primaryAction
    ? '<a class="button button-primary" href="' + escapeHtml(contextualHref(model, model.blueprint.primaryAction.path)) + '" data-nav>' + escapeHtml(model.blueprint.primaryAction.label) + ' →</a>'
    : '<span class="pill">منبع canonical</span>';
  const bookingLookup = ["نوبت‌ها", "رزرو", "وقت‌های امروز"].includes(model.module)
    ? renderBookingLookupSurface()
    : "";
  return bookingLookup + '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="' + uiCopy("ui.vertical_overviewView", "نمای فرمان") + '">' +
      '<button type="button" role="tab" tabindex="0" class="active" aria-selected="true" data-vwf-tab="overview">' + uiCopy("ui.vertical_overviewView", "نمای کلی") + '</button>' +
      '<button type="button" role="tab" tabindex="-1" aria-selected="false" data-vwf-tab="queue">' + uiCopy("ui.vertical_workQueue", "صف کار") + '</button>' +
      '<button type="button" role="tab" tabindex="-1" aria-selected="false" data-vwf-tab="actions">' + uiCopy("ui.vertical_actions", "اقدام‌ها") + '</button>' +
    '</div>' +
    viewState("نمای کلی") +
    '</div>' +
    '<div class="phoenix-vwf-command-grid">' +
      '<article class="phoenix-vwf-command-primary" data-vwf-item>' +
        '<span class="section-kicker">Primary flow</span><h3>' + escapeHtml(model.blueprint.primaryAction?.label ?? "منبع canonical") + '</h3><p>اقدام اصلی این ماژول باید از مسیر canonical اجرا شود؛ این Canvas فقط composition و context را فراهم می‌کند.</p>' +
        '<div class="phoenix-vwf-action-row"><span class="phoenix-vwf-source-chip">Vertical: ' + escapeHtml(model.vertical) + '</span><span class="phoenix-vwf-source-chip">Module: ' + escapeHtml(model.module) + '</span>' + action + '</div>' +
      '</article>' +
      '<article class="phoenix-vwf-command-secondary" data-vwf-item>' +
        '<div class="phoenix-vwf-command-live" data-vwf-business-live>' +
          '<div class="phoenix-vwf-live-head"><div><span class="section-kicker">Canonical Business Context</span><h3>وضعیت این Workspace</h3><p>هویت و publication فقط از Business management خوانده می‌شود؛ صف یا metric محلی ساخته نمی‌شود.</p></div><span class="pill">live when connected</span></div>' +
          '<div class="phoenix-vwf-command-live-grid" data-vwf-command-live-content><div class="slot-loading">در حال خواندن Business context…</div></div>' +
        '</div>' +
      '</article>' +
    '</div>';
}

function renderCalendar(model: VerticalWorkflowCanvasModel): string {
  const first = model.blueprint.blocks[0];
  const bookingLookup = ["نوبت‌ها", "رزرو", "وقت‌های امروز"].includes(model.module)
    ? renderBookingLookupSurface()
    : "";
  return bookingLookup + '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="' + uiCopy("ui.vertical_calendarView", "نمای تقویم") + '">' +
      '<button type="button" role="tab" tabindex="0" class="active" aria-selected="true" data-vwf-tab="day">' + uiCopy("ui.vertical_day", "روز") + '</button>' +
      '<button type="button" role="tab" tabindex="-1" aria-selected="false" data-vwf-tab="week">' + uiCopy("ui.vertical_week", "هفته") + '</button>' +
      '<button type="button" role="tab" tabindex="-1" aria-selected="false" data-vwf-tab="month">' + uiCopy("ui.vertical_month", "ماه") + '</button>' +
    '</div>' +
    '<button type="button" class="button button-ghost" data-vwf-action="today">' + uiCopy("ui.vertical_today", "امروز") + '</button>' +
    '</div>' +
    '<div class="phoenix-vwf-calendar-head"><span>بازه زمانی</span><span>Resource lanes</span><span>Availability</span></div>' +
    '<div class="phoenix-vwf-calendar-grid" data-vwf-calendar-live>' +
      '<div class="phoenix-vwf-calendar-axis"><span>08:00</span><span>10:00</span><span>12:00</span><span>14:00</span><span>16:00</span><span>18:00</span></div>' +
      '<div class="phoenix-vwf-calendar-lanes" data-vwf-calendar-lanes>' +
        '<div class="phoenix-vwf-calendar-lane" data-vwf-item><span>Availability</span><div>' + emptyState((first?.title ?? "Availability") + " · برای این Canvas هنوز schedule واقعی hydrate نشده است.", "Availability") + '</div></div>' +
      '</div>' +
    '</div>';
}

function renderCatalog(model: VerticalWorkflowCanvasModel): string {
  const variantSurface = (model.module === "مدل‌ها و تنوع" || model.module === "سایز و رنگ")
    ? '<div class="phoenix-vwf-live-variants" data-vwf-variants-live>' +
        '<div class="phoenix-vwf-live-head"><div><span class="section-kicker">Canonical Catalog Variants</span><h3>' + (model.module === "سایز و رنگ" ? "سایز، رنگ و Attributeها" : "مدل‌ها و تنوع محصول") + '</h3><p>Variant و Attribute فقط از Catalog خوانده می‌شوند؛ این Canvas هیچ نسخه محلی از محصول ایجاد نمی‌کند.</p></div><span class="pill">live when connected</span></div>' +
        '<div class="phoenix-vwf-live-variants-grid" data-vwf-variant-items><div class="slot-loading">در حال آماده‌سازی Variantهای واقعی…</div></div>' +
      '</div>'
    : "";
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="' + uiCopy("ui.vertical_supplyView", "نمای عرضه") + '">' +
      '<button type="button" role="tab" tabindex="0" class="active" aria-selected="true" data-vwf-tab="grid">' + uiCopy("ui.vertical_cards", "کارت‌ها") + '</button>' +
      '<button type="button" role="tab" tabindex="-1" aria-selected="false" data-vwf-tab="table">' + uiCopy("ui.vertical_tableView", "جدول") + '</button>' +
      '<button type="button" role="tab" tabindex="-1" aria-selected="false" data-vwf-tab="drafts">' + uiCopy("ui.vertical_drafts", "پیش‌نویس‌ها") + '</button>' +
    '</div>' +
    viewState("کارت‌ها") +
    '</div>' +
    '<div class="phoenix-vwf-filter-row">' +
      '<input class="studio-input-line" data-vwf-filter placeholder="فیلتر محلی این Canvas…" aria-label="فیلتر محلی" />' +
      '<span class="phoenix-vwf-local-note">Local UI filter · canonical data unchanged</span>' +
    '</div>' +
    variantSurface +
    '<div class="phoenix-vwf-supply-grid" data-vwf-supply-live>' +
      '<div class="phoenix-vwf-live-supply" data-vwf-catalog-live>' +
        '<div class="phoenix-vwf-live-supply-head"><div><span class="section-kicker">Canonical supply</span><h3>عرضه‌های این کسب‌وکار</h3><p>فقط Offeringهای متعلق به همین Business و Workspace در این بخش hydrate می‌شوند.</p></div><span class="pill">live when connected</span></div>' +
        '<div class="phoenix-vwf-live-supply-grid" data-vwf-catalog-items><div class="slot-loading">در حال آماده‌سازی منبع Catalog…</div></div>' +
      '</div>' +
      model.blueprint.blocks.map((item) => '<article class="phoenix-vwf-supply-card" data-vwf-item><span class="phoenix-module-blueprint-index">' + escapeHtml(item.label) + '</span><div><strong>' + escapeHtml(item.title) + '</strong><p>' + escapeHtml(item.description) + '</p>' + (item.path ? '<a class="text-link" href="' + escapeHtml(contextualHref(model, item.path)) + '" data-nav>باز کردن منبع ←</a>' : '<span class="phoenix-vwf-source-chip">canonical source</span>') + '</div></article>').join("") +
    '</div>';
}

function renderPeople(model: VerticalWorkflowCanvasModel): string {
  const resourceType = (model.module === "پزشکان" || model.module === "متخصصان") ? "person" : "";
  const resourceSurface = resourceType
    ? '<div class="phoenix-vwf-live-resources" data-vwf-resources-live data-vwf-resource-type="' + resourceType + '">'+
        '<div class="phoenix-vwf-live-head"><div><span class="section-kicker">Canonical Booking Resources</span><h3>' + (model.module === "پزشکان" ? "منابع/پزشکان قابل زمان‌بندی" : "متخصصان قابل زمان‌بندی") + '</h3><p>منابع زمان‌بندی فقط از Booking خوانده می‌شوند و UI نام یا ظرفیت جدیدی ایجاد نمی‌کند.</p></div><span class="pill">live when connected</span></div>'+
        '<div class="phoenix-vwf-live-resources-grid" data-vwf-resource-items><div class="slot-loading">در حال آماده‌سازی منابع زمان‌بندی…</div></div>'+
      '</div>'
    : "";
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="' + uiCopy("ui.vertical_teamMembers", "نمای افراد") + '">' +
      '<button type="button" role="tab" tabindex="0" class="active" aria-selected="true" data-vwf-tab="people">' + uiCopy("ui.vertical_teamMembers", "اعضا / افراد") + '</button>' +
      '<button type="button" role="tab" tabindex="-1" aria-selected="false" data-vwf-tab="roles">' + uiCopy("ui.vertical_roles", "نقش‌ها") + '</button>' +
      '<button type="button" role="tab" tabindex="-1" aria-selected="false" data-vwf-tab="relationships">' + uiCopy("ui.vertical_relationships", "رابطه‌ها") + '</button>' +
    '</div>' +
    viewState("اعضا / افراد") +
    '</div>' +
    '<div class="phoenix-vwf-filter-row phoenix-vwf-lookup-row">' +
      '<input class="studio-input-line" data-vwf-filter placeholder="جستجوی نمایشی…" aria-label="جستجو" />' +
      '<input class="studio-input-line" data-vwf-customer-id placeholder="Customer ID برای مشاهده context…" aria-label="شناسه مشتری" />' +
      '<button type="button" class="button button-secondary" data-vwf-load-customer>خواندن Customer</button>' +
      '<span class="phoenix-vwf-local-note">Lookup فقط از Customer canonical می‌خواند؛ داده محلی ذخیره نمی‌شود.</span>' +
    '</div>' +
    resourceSurface +
    '<div class="phoenix-vwf-live-people" data-vwf-members-live>' +
      '<div class="phoenix-vwf-live-head"><div><span class="section-kicker">Canonical Workspace Team</span><h3>اعضای Workspace</h3><p>فهرست اعضا مستقیماً از Workspace می‌آید؛ این Canvas نقش یا دسترسی جدیدی ایجاد نمی‌کند.</p></div><span class="pill">live when connected</span></div>' +
      '<div class="phoenix-vwf-live-people-grid" data-vwf-member-items><div class="slot-loading">در حال خواندن اعضای واقعی…</div></div>' +
    '</div>' +
    '<div class="phoenix-vwf-people-grid" data-vwf-people-items>' +
      model.blueprint.blocks.map((item) => '<article class="phoenix-vwf-people-card" data-vwf-item><span class="section-kicker">People surface</span><h3>' + escapeHtml(item.title) + '</h3>' + emptyState(item.description, item.path ? item.path : "Capability") + (item.path ? '<a class="text-link" href="' + escapeHtml(contextualHref(model, item.path)) + '" data-nav>باز کردن منبع ←</a>' : '') + '</article>').join("") +
    '</div>' +
    '<div class="phoenix-vwf-live-detail" data-vwf-customer-detail hidden></div>' +
    '<section class="phoenix-vwf-customer-history" data-vwf-customer-history hidden>' +
      '<div class="phoenix-vwf-live-head"><div><span class="section-kicker">Canonical CRM Timeline</span><h3>تاریخچه رابطه</h3><p>رویدادهای Customer فقط از projection canonical خوانده می‌شوند.</p></div><span class="pill">read-only</span></div>' +
      '<div class="phoenix-vwf-customer-history-list" data-vwf-customer-history-items></div>' +
    '</section>';
}
function renderCommerce(model: VerticalWorkflowCanvasModel): string {
  const inventorySurface = model.module === "موجودی"
    ? '<div class="phoenix-vwf-live-inventory" data-vwf-inventory-live>' +
        '<div class="phoenix-vwf-live-head"><div><span class="section-kicker">Canonical Inventory</span><h3>موجودی واقعی این کسب‌وکار</h3><p>موجودی فقط از Catalog خوانده می‌شود؛ این Canvas هیچ stock state محلی ایجاد نمی‌کند.</p></div><span class="pill">live when connected</span></div>' +
        '<div class="phoenix-vwf-live-inventory-grid" data-vwf-inventory-items><div class="slot-loading">در حال آماده‌سازی منبع Inventory…</div></div>' +
      '</div>'
    : "";
  const billingSurface = model.module === "پرداخت"
    ? '<div class="phoenix-vwf-live-billing" data-vwf-billing-live>' +
        '<div class="phoenix-vwf-live-head"><div><span class="section-kicker">Canonical Billing</span><h3>صورتحساب‌های این کسب‌وکار</h3><p>Invoice state مستقیماً از Billing خوانده می‌شود؛ این Canvas دفتر مالی موازی ایجاد نمی‌کند.</p></div><span class="pill">live when connected</span></div>' +
        '<div class="phoenix-vwf-live-billing-grid" data-vwf-invoice-items><div class="slot-loading">در حال خواندن صورتحساب‌های واقعی…</div></div>' +
      '</div>'
    : "";
  const ordersSurface = ["فروش امروز", "سفارش‌ها", "سفارش‌های امروز"].includes(model.module)
    ? '<div class="phoenix-vwf-live-orders" data-vwf-orders-live>' +
        '<div class="phoenix-vwf-live-head"><div><span class="section-kicker">Canonical Commerce Orders</span><h3>سفارش‌های این کسب‌وکار</h3><p>وضعیت سفارش‌ها مستقیماً از Commerce خوانده می‌شود؛ این Canvas فهرست سفارش یا وضعیت موازی ایجاد نمی‌کند.</p></div><span class="pill">live when connected</span></div>' +
        '<div class="phoenix-vwf-live-orders-grid" data-vwf-order-items><div class="slot-loading">در حال خواندن سفارش‌های واقعی…</div></div>' +
      '</div>'
    : "";
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="' + uiCopy("ui.vertical_commerceOrders", "نمای معاملات") + '">' +
      '<button type="button" role="tab" tabindex="0" class="active" aria-selected="true" data-vwf-tab="all">' + uiCopy("ui.vertical_all", "همه") + '</button>' +
      '<button type="button" role="tab" tabindex="-1" aria-selected="false" data-vwf-tab="open">' + uiCopy("ui.vertical_open", "باز") + '</button>' +
      '<button type="button" role="tab" tabindex="-1" aria-selected="false" data-vwf-tab="action">' + uiCopy("ui.vertical_needsAction", "نیازمند اقدام") + '</button>' +
    '</div>' +
    viewState("همه") +
    '</div>' +
    '<div class="phoenix-vwf-lookup-row">' +
      '<input class="studio-input-line" data-vwf-order-id placeholder="Order ID برای مشاهده وضعیت…" aria-label="شناسه سفارش" />' +
      '<button type="button" class="button button-secondary" data-vwf-load-order>خواندن Order</button>' +
      '<span class="phoenix-vwf-local-note">Order state مستقیماً از Commerce خوانده می‌شود؛ این Canvas منبع دوم نمی‌سازد.</span>' +
    '</div>' +
    inventorySurface +
    billingSurface +
    ordersSurface +
    '<div class="phoenix-vwf-commerce-grid">' +
      model.blueprint.blocks.map((item) => '<article class="phoenix-vwf-commerce-card" data-vwf-item><span class="section-kicker">Commerce surface</span><h3>' + escapeHtml(item.title) + '</h3>' + emptyState(item.description, item.path ?? "Commerce") + (item.path ? '<a class="text-link" href="' + escapeHtml(contextualHref(model, item.path)) + '" data-nav>باز کردن منبع ←</a>' : '') + '</article>').join("") +
    '</div>' +
    '<div class="phoenix-vwf-status-rail"><span>Order</span><i></i><span>Billing</span><i></i><span>Fulfillment</span></div>' +
    '<div class="phoenix-vwf-live-detail" data-vwf-order-detail hidden></div>';
}
function renderBookingLookupSurface(): string {
  return '<div class="phoenix-vwf-live-booking" data-vwf-booking-live>' +
    '<div class="phoenix-vwf-live-head"><div><span class="section-kicker">Canonical Booking</span><h3>جزئیات نوبت</h3><p>Appointment state مستقیماً از Booking خوانده می‌شود؛ این Canvas نوبت موازی ایجاد نمی‌کند.</p></div><span class="pill">read-only</span></div>' +
    '<div class="phoenix-vwf-booking-lookup">' +
      '<input class="studio-input-line" data-vwf-booking-id placeholder="Booking ID" aria-label="شناسه نوبت" autocomplete="off" />' +
      '<button type="button" class="button button-secondary" data-vwf-load-booking>خواندن نوبت</button>' +
    '</div>' +
    '<div class="phoenix-vwf-live-detail" data-vwf-booking-detail hidden></div>' +
  '</div>';
}

function renderFulfillmentLookupSurface(): string {
  return '<div class="phoenix-vwf-live-fulfillment" data-vwf-fulfillment-live>' +
    '<div class="phoenix-vwf-live-head"><div><span class="section-kicker">Canonical Fulfillment</span><h3>وضعیت اجرای سفارش / خدمت</h3><p>برای دیدن وضعیت اجرایی، شناسه Fulfillment را وارد کنید؛ این Canvas فقط داده خواندنی canonical را نمایش می‌دهد.</p></div><span class="pill">read-only</span></div>' +
    '<div class="phoenix-vwf-fulfillment-lookup">' +
      '<input class="studio-input-line" data-vwf-fulfillment-id placeholder="Fulfillment ID" aria-label="شناسه Fulfillment" autocomplete="off" />' +
      '<button type="button" class="button button-secondary" data-vwf-load-fulfillment>خواندن وضعیت</button>' +
    '</div>' +
    '<div class="phoenix-vwf-live-detail" data-vwf-fulfillment-detail hidden></div>' +
  '</div>';
}

function renderOperations(model: VerticalWorkflowCanvasModel): string {
  const resourceSurface = model.module === "میزها"
    ? '<div class="phoenix-vwf-live-resources" data-vwf-resources-live data-vwf-resource-type="">' +
        '<div class="phoenix-vwf-live-head"><div><span class="section-kicker">Canonical Booking Resources</span><h3>میزها و منابع رزرو</h3><p>منابع قابل رزرو مستقیماً از Booking خوانده می‌شوند؛ این Canvas برای میزها state موازی ایجاد نمی‌کند.</p></div><span class="pill">live when connected</span></div>' +
        '<div class="phoenix-vwf-live-resources-grid" data-vwf-resource-items><div class="slot-loading">در حال آماده‌سازی منابع رزرو…</div></div>' +
      '</div>'
    : "";

  const fulfillmentSurface = renderFulfillmentLookupSurface();

  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="نمای عملیات">' +
      '<button type="button" role="tab" tabindex="0" class="active" aria-selected="true" data-vwf-tab="board">Board</button>' +
      '<button type="button" role="tab" tabindex="-1" aria-selected="false" data-vwf-tab="list">List</button>' +
      '<button type="button" role="tab" tabindex="-1" aria-selected="false" data-vwf-tab="attention">نیازمند اقدام</button>' +
    '</div>' +
    viewState("Board") +
    '</div>' +
    resourceSurface +
    '<div class="phoenix-vwf-live-operations" data-vwf-case-live>' +
      '<div class="phoenix-vwf-live-head"><div><span class="section-kicker">Canonical Operations</span><h3>صف عملیات</h3><p>Case state مستقیماً از Case Support خوانده می‌شود.</p></div><span class="pill">live when connected</span></div>' +
      '<div class="phoenix-vwf-live-case-grid" data-vwf-case-items><div class="slot-loading">در حال خواندن Caseهای واقعی…</div></div>' +
    '</div>' +
    fulfillmentSurface +
    '<div class="phoenix-vwf-kanban">' +
      model.blueprint.blocks.map((item, index) => '<article class="phoenix-vwf-kanban-column" data-vwf-item><div class="phoenix-vwf-kanban-title"><strong>' + escapeHtml(item.title) + '</strong><span class="pill">' + String(index + 1).padStart(2, "0") + '</span></div>' + emptyState(item.description, item.path ?? "Operations") + (item.path ? '<a class="text-link" href="' + escapeHtml(contextualHref(model, item.path)) + '" data-nav>باز کردن منبع ←</a>' : '') + '</article>').join("") +
    '</div>';
}

function renderCommunication(model: VerticalWorkflowCanvasModel): string {
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="نمای ارتباطات">' +
      '<button type="button" role="tab" tabindex="0" class="active" aria-selected="true" data-vwf-tab="inbox">Inbox</button>' +
      '<button type="button" role="tab" tabindex="-1" aria-selected="false" data-vwf-tab="followup">Follow-up</button>' +
      '<button type="button" role="tab" tabindex="-1" aria-selected="false" data-vwf-tab="compose">Compose</button>' +
    '</div>' +
    viewState("Inbox") +
    '</div>' +
    '<div class="phoenix-vwf-communication-live" data-vwf-notification-live>' +
      '<div class="phoenix-vwf-live-head"><div><span class="section-kicker">Canonical Communication</span><h3>رویدادهای ارتباطی</h3><p>فهرست اعلان‌های معتبر از Communication خوانده می‌شود؛ این Canvas گفتگو را جعل نمی‌کند.</p></div><span class="pill">live when connected</span></div>' +
      '<div class="phoenix-vwf-live-notification-list" data-vwf-notification-items><div class="slot-loading">در حال خواندن اعلان‌های واقعی…</div></div>' +
    '</div>' +
    '<div class="phoenix-vwf-inbox">' +
      model.blueprint.blocks.map((item) => '<section data-vwf-item><span class="section-kicker">Communication surface</span><h3>' + escapeHtml(item.title) + '</h3>' + emptyState(item.description, item.path ?? "Communication") + (item.path ? '<a class="text-link" href="' + escapeHtml(contextualHref(model, item.path)) + '" data-nav>باز کردن منبع ←</a>' : '') + '</section>').join("") +
    '</div>';
}

function renderModuleSwitcher(model: VerticalWorkflowCanvasModel): string {
  const vertical = model.vertical.trim().toLowerCase();
  const modules = Object.keys(VERTICAL_MODULE_SLUGS[vertical] ?? {});
  if (!modules.length) return "";

  return '<nav class="phoenix-vwf-module-switcher" data-vwf-module-switcher aria-label="ماژول‌های این Workspace">' +
    '<div class="phoenix-vwf-module-switcher-head"><div><span class="section-kicker">Workspace modules</span><strong>ماژول‌های این حوزه</strong><small>' +
      escapeHtml(String(modules.length)) + ' ماژول · مسیرهای پایدار semantic' +
    '</small></div><span class="pill">Shared navigation</span></div>' +
    '<div class="phoenix-vwf-module-switcher-list">' +
      modules.map((module) => {
        const contract = getVerticalModuleUiContract(vertical, module);
        const active = module === model.module;
        const href = workflowModuleHref(model, module);
        const classes = 'phoenix-vwf-module-link' + (active ? ' active' : '');
        const content = '<span class="phoenix-vwf-module-index">' + String(modules.indexOf(module) + 1).padStart(2, "0") + '</span>' +
          '<span class="phoenix-vwf-module-copy"><strong>' + escapeHtml(module) + '</strong><small>' + escapeHtml(contract.blueprint.eyebrow) + '</small></span>';
        return active
          ? '<span class="' + classes + '" aria-current="page" data-vwf-module-state="current">' + content + '</span>'
          : '<a class="' + classes + '" href="' + escapeHtml(href) + '" data-nav data-vwf-module-state="available">' + content + '<span class="phoenix-vwf-module-arrow" aria-hidden="true">→</span></a>';
      }).join("") +
    '</div>' +
    '</nav>';
}

function renderLayout(layout: VerticalModuleLayout, model: VerticalWorkflowCanvasModel): string {
  switch (layout) {
    case "command": return renderCommand(model);
    case "calendar": return renderCalendar(model);
    case "catalog": return renderCatalog(model);
    case "people": return renderPeople(model);
    case "commerce": return renderCommerce(model);
    case "operations": return renderOperations(model);
    case "communication": return renderCommunication(model);
  }
}

export type VerticalWorkflowOverviewModel = {
  readonly vertical: string;
  readonly businessId?: string;
  readonly contextualHref?: (path: string) => string;
};

export function renderVerticalWorkflowOverview(model: VerticalWorkflowOverviewModel): string {
  const steps = getVerticalWorkflowSteps(model.vertical);
  const stageItems = steps.map((stage, index) => {
    const module = getVerticalWorkflowStageModule(model.vertical, stage) ?? stage;
    const moduleContract = getVerticalModuleUiContract(model.vertical, module);
    const blueprint = moduleContract.blueprint;
    const route = moduleContract.route;
    const params = new URLSearchParams();
    if (model.businessId) params.set("business", model.businessId);
    params.set("from", "workspace");
    const rawHref = route + "?" + params.toString();
    const href = model.contextualHref ? model.contextualHref(rawHref) : rawHref;
    return '<a class="phoenix-vwf-overview-stage" data-vwf-overview-stage data-vwf-overview-stage-module="' + authoredText(module) + '" data-vwf-overview-stage-index="' + String(index) + '" data-nav href="' + escapeHtml(href) + '">' +
      '<div class="phoenix-vwf-overview-stage-top"><span class="phoenix-vwf-overview-index">' + String(index + 1).padStart(2, "0") + '</span><span class="pill">' + escapeHtml(blueprint.layout) + '</span></div>' +
      '<strong>' + authoredText(stage) + '</strong>' +
      '<span class="phoenix-vwf-overview-module">' + authoredText(module) + '</span>' +
      '<small>' + authoredText(blueprint.eyebrow) + '</small>' +
      '<span class="phoenix-vwf-overview-access" data-vwf-overview-access>در انتظار Context</span>' +
      '<b aria-hidden="true">→</b>' +
    '</a>';
  }).join("");

  const layouts = Array.from(new Set(steps.map((stage) => {
    const module = getVerticalWorkflowStageModule(model.vertical, stage) ?? stage;
    return getVerticalModuleBlueprint(model.vertical, module).layout;
  })));

  return '<section class="glass-card phoenix-vwf-overview" data-vwf-overview data-vwf-overview-vertical="' + escapeHtml(model.vertical) + '">' +
    '<div class="phoenix-vwf-overview-head">' +
      '<div><span class="section-kicker">Vertical Workflow UI Framework</span><h2>نقشه اجرای این نوع کسب‌وکار</h2><p>همه Verticalها از یک Canvas مشترک استفاده می‌کنند؛ تفاوت فقط در ترتیب Workflow، ماژول و منبع canonical است.</p></div>' +
      '<div class="phoenix-vwf-overview-contract"><span class="pill">Shared UI</span><span class="pill">' + String(steps.length) + ' stage</span><span class="pill">' + String(layouts.length) + ' layout</span></div>' +
    '</div>' +
    '<div class="phoenix-vwf-overview-rail">' + stageItems + '</div>' +
    '<div class="phoenix-vwf-overview-footer">' +
      '<span>Backend authoritative</span><i></i><span>Role-aware emphasis</span><i></i><span>Canonical-only state</span><i></i><span>Responsive / RTL</span>' +
    '</div>' +
  '</section>';
}

export function bindVerticalWorkflowOverview(root: ParentNode = document): void {
  const overview = root.querySelector<HTMLElement>("[data-vwf-overview]");
  if (!overview) return;

  const stageNodes = Array.from(overview.querySelectorAll<HTMLElement>("[data-vwf-overview-stage]"));
  if (!stageNodes.length) return;

  const setStatus = (node: HTMLElement, label: string, state: "ready" | "warning" | "context"): void => {
    const marker = node.querySelector<HTMLElement>("[data-vwf-overview-access]");
    if (!marker) return;
    marker.textContent = label;
    marker.dataset.vwfOverviewAccess = state;
  };

  const vertical = overview.dataset.vwfOverviewVertical ?? "default";
  void getVerticalWorkflowUiContext()
    .then((context) => {
      if (!context) {
        stageNodes.forEach((node) => setStatus(node, "نیازمند Context", "context"));
        return;
      }
      const roles = context.roles;
      const permissions = context.permissions;
      const lens = resolveVerticalRoleLens(roles);

      stageNodes.forEach((node) => {
        const module = node.dataset.vwfOverviewStageModule ?? "";
        if (!module) {
          setStatus(node, "Capability", "context");
          return;
        }

        const blueprint = getVerticalModuleBlueprint(vertical, module);
        const fit = getVerticalModuleRoleFit(blueprint, lens.key);
        const contract = getVerticalModuleCapabilityContract(module);
        const required = contract.requiredPermissions;
        const missing = required.filter((permission) => !permissions.includes(permission));

        node.dataset.vwfOverviewRoleFit = fit;
        node.dataset.vwfOverviewPermissionState = required.length === 0 ? "undeclared" : missing.length === 0 ? "present" : "missing";

        if (!required.length) {
          setStatus(node, fit === "primary" ? "تمرکز نقش · Backend policy" : "مشترک · Backend policy", "context");
          return;
        }
        if (!missing.length) {
          setStatus(node, fit === "primary" ? "تمرکز نقش · آماده" : "مشترک · آماده", "ready");
          return;
        }
        setStatus(node, fit === "primary" ? "تمرکز نقش · Permission ناقص" : "مشترک · Permission ناقص", "warning");
      });
    })
    .catch((error) => {
      const label = error instanceof Error ? error.message : "Context خوانده نشد";
      stageNodes.forEach((node) => setStatus(node, label, "warning"));
    });
}

function renderWorkflowHandoff(
  model: VerticalWorkflowCanvasModel,
  stageContext: ReturnType<typeof getVerticalWorkflowStageContext>,
): string {
  const currentContract = getVerticalModuleUiContract(model.vertical, model.module);
  const previousModule = stageContext.previous?.module;
  const nextModule = stageContext.next?.module;
  const previousHref = previousModule ? workflowModuleHref(model, previousModule) : "";
  const nextHref = nextModule ? workflowModuleHref(model, nextModule) : "";
  const primaryLabel = currentContract.blueprint.primaryAction?.label ?? currentContract.blueprint.blocks[0]?.title ?? "جریان canonical";

  const cell = (
    tone: "input" | "current" | "next",
    eyebrow: string,
    title: string,
    description: string,
    href?: string,
  ): string =>
    '<article class="phoenix-vwf-handoff-card handoff-' + tone + '">' +
      '<div class="phoenix-vwf-handoff-top"><span class="phoenix-vwf-handoff-index">' + (tone === "input" ? "01" : tone === "current" ? "02" : "03") + '</span><span class="pill">' + authoredText(eyebrow) + '</span></div>' +
      '<strong>' + authoredText(title) + '</strong>' +
      '<p>' + authoredText(description) + '</p>' +
      (href ? '<a class="text-link" href="' + escapeHtml(href) + '" data-nav>باز کردن ←</a>' : '<span class="phoenix-vwf-handoff-muted">' + (tone === "input" ? "شروع Workflow" : "پایان Workflow") + '</span>') +
    '</article>';

  return '<section class="phoenix-vwf-handoff" data-vwf-handoff>' +
    '<div class="phoenix-vwf-handoff-head">' +
      '<div><span class="section-kicker">Workflow Handoff Contract</span><h3>ورودی، مرحله فعلی و خروجی بعدی</h3><p>این rail برای هر چهار Vertical یکسان است؛ فقط stage و module تغییر می‌کند. state اجرایی همچنان از domain canonical می‌آید.</p></div>' +
      '<span class="phoenix-vwf-handoff-position">' + (stageContext.index >= 0 ? String(stageContext.index + 1) + " / " + String(stageContext.total) : "—") + '</span>' +
    '</div>' +
    '<div class="phoenix-vwf-handoff-grid">' +
      cell(
        "input",
        stageContext.previous ? "Previous stage" : "Workflow entry",
        stageContext.previous?.module ?? "ورودی این Workflow",
        stageContext.previous
          ? "Context این مرحله از «" + stageContext.previous.stage + "» و ماژول «" + stageContext.previous.module + "» وارد می‌شود."
          : "اولین مرحله بدون نیاز به stage قبلی؛ داده اولیه باید از منبع canonical همین Business وارد شود.",
        previousHref,
      ) +
      cell(
        "current",
        "Current stage",
        model.module,
        "تمرکز فعلی: " + primaryLabel + "؛ این صفحه orchestration است و source of truth موازی نمی‌سازد.",
      ) +
      cell(
        "next",
        stageContext.next ? "Next stage" : "Workflow end",
        stageContext.next?.module ?? "پایان Workflow",
        stageContext.next
          ? "خروجی این مرحله باید به stage «" + stageContext.next.stage + "» تحویل شود؛ لینک بعدی context فعلی را حفظ می‌کند."
          : "این آخرین مرحله تعریف‌شده در Workflow است؛ ادامه فقط از command canonical دامنه انجام می‌شود.",
        nextHref,
      ) +
    '</div>' +
  '</section>';
}

export function renderVerticalWorkflowCanvas(model: VerticalWorkflowCanvasModel): string {
  const copy = layoutCopy[model.blueprint.layout];
  const stageContext = getVerticalWorkflowStageContext(model.vertical, model.module);
  const stagePosition = stageContext.index >= 0 ? String(stageContext.index + 1) + "/" + String(stageContext.total) : "—";
  const stageNav = [
    stageContext.previous
      ? '<a class="button button-ghost phoenix-vwf-stage-nav-button" href="' + escapeHtml(workflowModuleHref(model, stageContext.previous.module)) + '" data-nav><span>←</span> ' + escapeHtml(stageContext.previous.stage) + '</a>'
      : '<span class="phoenix-vwf-stage-nav-button is-disabled">← ابتدای Workflow</span>',
    stageContext.next
      ? '<a class="button button-primary phoenix-vwf-stage-nav-button" href="' + escapeHtml(workflowModuleHref(model, stageContext.next.module)) + '" data-nav>' + escapeHtml(stageContext.next.stage) + ' <span>→</span></a>'
      : '<span class="phoenix-vwf-stage-nav-button is-disabled">انتهای Workflow →</span>',
  ].join("");
  return '<section class="glass-card phoenix-vwf-canvas" data-vwf-root data-vwf-layout="' + escapeHtml(model.blueprint.layout) + '" data-vwf-active-view="overview" data-vwf-business-id="' + escapeHtml(model.businessId ?? "") + '" data-vwf-vertical="' + escapeHtml(model.vertical) + '" data-vwf-module="' + escapeHtml(model.module) + '" data-vwf-stage-index="' + String(stageContext.index) + '" data-vwf-stage-total="' + String(stageContext.total) + '">' +
    '<nav class="phoenix-vwf-stage-rail" aria-label="مراحل Workflow">' +
      getVerticalWorkflowSteps(model.vertical).map((stage, index) => {
        const stageModule = getVerticalWorkflowStageModule(model.vertical, stage);
        const active = stageModule === model.module;
        const completed = stageContext.index >= 0 && index < stageContext.index;
        const upcoming = stageContext.index >= 0 && index > stageContext.index;
        const stateClass = active ? " active" : completed ? " completed" : upcoming ? " upcoming" : "";
        const href = stageModule ? workflowModuleHref(model, stageModule) : "";
        const content = '<span class="phoenix-vwf-stage-number">' + String(index + 1).padStart(2, "0") + '</span><span class="phoenix-vwf-stage-copy"><strong>' + authoredText(stage) + '</strong><small>' + authoredText(stageModule ?? "Capability") + '</small></span>';
        return href
          ? '<a class="phoenix-vwf-stage' + stateClass + '" href="' + escapeHtml(href) + '" data-nav aria-current="' + (active ? "step" : "false") + '" data-vwf-stage-state="' + (active ? "current" : completed ? "completed" : "upcoming") + '">' + content + '</a>'
          : '<div class="phoenix-vwf-stage' + stateClass + '" data-vwf-stage-state="' + (active ? "current" : completed ? "completed" : "upcoming") + '">' + content + '</div>';
      }).join('<span class="phoenix-vwf-stage-connector" aria-hidden="true">→</span>') +
    '</nav>' +
    renderModuleSwitcher(model) +
    '<div class="phoenix-vwf-stage-context">' +
      '<div><span class="section-kicker">' + uiCopy("ui.vertical_currentStage", "Workflow stage") + '</span><strong>' + authoredText(stageContext.stage) + '</strong><span class="phoenix-vwf-stage-position">' + escapeHtml(stagePosition) + '</span></div>' +
      '<div class="phoenix-vwf-stage-context-actions">' + stageNav + '</div>' +
    '</div>' +
    '<div class="phoenix-vwf-header">' +
      '<div><span class="section-kicker">Vertical Workflow UI Framework</span><h2>' + authoredText(copy.label) + ' canvas</h2><p>' + authoredText(copy.description) + '</p></div>' +
      '<div class="phoenix-vwf-header-actions"><span class="pill">Shared component</span><span class="pill" data-vwf-state-label data-vwf-state="requires-input">نیازمند Context</span><button type="button" class="button button-ghost" data-vwf-action="refresh" aria-label="تازه‌سازی داده‌های این Canvas">↻ تازه‌سازی</button></div>' +
    '</div>' +
    '<div class="phoenix-vwf-role-lens" data-vwf-role-lens>' +
      '<div><span class="section-kicker">Role-aware emphasis</span><strong data-vwf-role-title>در انتظار Context</strong><small data-vwf-role-description>این لایه فقط تمرکز رابط را تعیین می‌کند؛ مجوز همچنان توسط Backend کنترل می‌شود.</small></div>' +
      '<span class="pill" data-vwf-role-fit>در انتظار احراز</span>' +
    '</div>' +
    renderCapabilityContract(model.blueprint) +
    renderWorkflowHandoff(model, stageContext) +
    '<div data-vwf-content>' + renderLayout(model.blueprint.layout, model) + '</div>' +
    '<div class="phoenix-vwf-contract"><span>state</span><strong>canonical-only</strong><span>layout</span><strong>' + escapeHtml(model.blueprint.layout) + '</strong><span>interaction</span><strong>' + escapeHtml(model.blueprint.interaction) + '</strong></div>' +
    '<div class="phoenix-vwf-mobile-actionbar" data-vwf-mobile-actions>' +
      (stageContext.previous
        ? '<a class="button button-ghost" href="' + escapeHtml(workflowModuleHref(model, stageContext.previous.module)) + '" data-nav>' + uiCopy("ui.vertical_previousStage", "مرحله قبلی") + '</a>'
        : '<span class="phoenix-vwf-mobile-action-spacer"></span>') +
      (stageContext.next
        ? '<a class="button button-primary" href="' + escapeHtml(workflowModuleHref(model, stageContext.next.module)) + '" data-nav>' + uiCopy("ui.vertical_nextStage", "مرحله بعدی") + ' →</a>'
        : model.blueprint.primaryAction
          ? '<a class="button button-primary" href="' + escapeHtml(contextualHref(model, model.blueprint.primaryAction.path)) + '" data-nav>' + authoredText(model.blueprint.primaryAction.label) + ' →</a>'
          : '<span class="phoenix-vwf-mobile-action-spacer"></span>') +
    '</div>' +
  '</section>';
}

type VerticalWorkflowCanvasState = "connected" | "requires-input" | "readonly" | "unavailable";

async function hydrateCanvasRoleLens(canvas: HTMLElement): Promise<void> {
  const title = canvas.querySelector<HTMLElement>("[data-vwf-role-title]");
  const description = canvas.querySelector<HTMLElement>("[data-vwf-role-description]");
  const fitNode = canvas.querySelector<HTMLElement>("[data-vwf-role-fit]");
  if (!title || !description || !fitNode) return;

  try {
    const context = await getVerticalWorkflowUiContext();
    if (!context) {
      title.textContent = "Context در دسترس نیست";
      description.textContent = "برای تعیین تمرکز این ماژول، Context احراز هویت لازم است.";
      fitNode.textContent = "نیازمند Context";
      fitNode.className = "pill warning";
      return;
    }

    const lens = resolveVerticalRoleLens(context.roles);
    const vertical = canvas.dataset.vwfVertical ?? "default";
    const module = canvas.dataset.vwfModule ?? "";
    // Resolve role fit without granting any authorization.
    const moduleBlueprint = getVerticalModuleBlueprint(vertical, module);
    const fit = getVerticalModuleRoleFit(moduleBlueprint, lens.key);
    const fitLabel = fit === "primary" ? "تمرکز این نقش" : "سطح مشترک";

    title.textContent = lens.title;
    description.textContent = lens.description;
    fitNode.textContent = fitLabel;
    fitNode.className = fit === "primary" ? "pill success" : "pill";
    canvas.dataset.vwfRoleFit = fit;
    canvas.dataset.vwfRoleLens = lens.key;
  } catch (error) {
    title.textContent = "Context خوانده نشد";
    description.textContent = error instanceof Error ? error.message : "Role context در دسترس نیست.";
    fitNode.textContent = "نامشخص";
    fitNode.className = "pill warning";
  }
}

function renderCapabilityContract(blueprint: VerticalModuleBlueprint): string {
  const contract = blueprint.capabilityContract;
  const capabilities = contract.requiredCapabilities.length
    ? contract.requiredCapabilities.map((item) => '<span class="phoenix-vwf-contract-chip" data-vwf-capability="' + escapeHtml(item) + '">' + escapeHtml(item) + '</span>').join("")
    : '<span class="phoenix-vwf-contract-empty">بدون Capability declaration</span>';
  const permissions = contract.requiredPermissions.length
    ? contract.requiredPermissions.map((item) => '<span class="phoenix-vwf-contract-chip" data-vwf-required-permission="' + escapeHtml(item) + '">' + escapeHtml(item) + '</span>').join("")
    : '<span class="phoenix-vwf-contract-empty">بدون Permission declaration</span>';
  return '<section class="phoenix-vwf-capability-contract" data-vwf-capability-contract>' +
    '<div class="phoenix-vwf-capability-head"><div><span class="section-kicker">Capability Contract</span><strong>' + uiCopy("ui.vertical_capabilityDependencies", "وابستگی‌های این ماژول") + '</strong><small>' + uiCopy("ui.vertical_capabilityDescription", "این declaration فقط dependency رابط است؛ Capability فعال و Authorization توسط backend تعیین می‌شود. Backend authoritative باقی می‌ماند.") + '</small></div><span class="pill" data-vwf-capability-status>' + uiCopy("ui.vertical_contractLoaded", "قرارداد بارگذاری شد") + '</span></div>' +
    '<div class="phoenix-vwf-capability-groups">' +
      '<div><span class="phoenix-vwf-capability-label">Capabilities</span><div class="phoenix-vwf-contract-chips" data-vwf-capability-items>' + capabilities + '</div></div>' +
      '<div><span class="phoenix-vwf-capability-label">Required permissions</span><div class="phoenix-vwf-contract-chips" data-vwf-permission-items>' + permissions + '</div></div>' +
    '</div>' +
    '<div class="phoenix-vwf-capability-access" data-vwf-capability-access>در انتظار بررسی Context…</div>' +
  '</section>';
}

async function hydrateCanvasCapabilityContract(canvas: HTMLElement): Promise<void> {
  const statusNode = canvas.querySelector<HTMLElement>("[data-vwf-capability-status]");
  const accessNode = canvas.querySelector<HTMLElement>("[data-vwf-capability-access]");
  if (!statusNode || !accessNode) return;

  try {
    const context = await getVerticalWorkflowUiContext();
    if (!context) {
      statusNode.textContent = "نیازمند Context";
      statusNode.className = "pill warning";
      accessNode.textContent = "برای بررسی Permissionهای این ماژول، session و Workspace context لازم است.";
      return;
    }

    const permissions = context.permissions;
    const required = canvas.querySelectorAll<HTMLElement>("[data-vwf-required-permission]");
    const requiredNames = Array.from(required).map((node) => node.dataset.vwfRequiredPermission ?? "").filter(Boolean);
    const missing = requiredNames.filter((permission) => !permissions.includes(permission));
    required.forEach((node) => {
      const permission = node.dataset.vwfRequiredPermission ?? "";
      const present = permission && permissions.includes(permission);
      node.dataset.vwfPermissionState = present ? "present" : "missing";
      node.title = present ? "Permission در Context موجود است." : "Permission در Context فعلی گزارش نشده است.";
    });

    if (!requiredNames.length) {
      statusNode.textContent = "بدون Permission declaration";
      statusNode.className = "pill";
      accessNode.textContent = "این ماژول Permission مشخصی در قرارداد UI اعلام نکرده است؛ Backend همچنان مرجع Authorization است.";
      return;
    }

    if (!missing.length) {
      statusNode.textContent = "Context aligned";
      statusNode.className = "pill success";
      accessNode.textContent = requiredNames.length + " Permission موردنیاز در Context فعلی گزارش شد.";
    } else if (missing.length < requiredNames.length) {
      statusNode.textContent = "Partial context";
      statusNode.className = "pill warning";
      accessNode.textContent = "بخشی از Permissionهای قرارداد در Context فعلی گزارش نشده است: " + missing.join(" · ");
    } else {
      statusNode.textContent = "Backend authoritative";
      statusNode.className = "pill warning";
      accessNode.textContent = "Permissionهای قرارداد در Context فعلی گزارش نشده‌اند؛ این UI دسترسی را خودش تعیین نمی‌کند.";
    }
  } catch (error) {
    statusNode.textContent = "Context unavailable";
    statusNode.className = "pill warning";
    accessNode.textContent = error instanceof Error ? error.message : "خواندن Context برای قرارداد Capability ناموفق بود.";
  }
}

function setCanvasState(canvas: HTMLElement, state: VerticalWorkflowCanvasState, label?: string): void {
  const node = canvas.querySelector<HTMLElement>("[data-vwf-state-label]");
  if (!node) return;
  const labels: Record<VerticalWorkflowCanvasState, string> = {
    connected: "متصل",
    "requires-input": "نیازمند Context",
    readonly: "فقط خواندنی",
    unavailable: "در دسترس نیست",
  };
  node.dataset.vwfState = state;
  node.textContent = label ?? labels[state];
  node.className = state === "connected"
    ? "pill success"
    : state === "readonly"
      ? "pill"
      : "pill warning";
}

async function hydrateResourceCanvas(canvas: HTMLElement, businessId: string): Promise<void> {
  const container = canvas.querySelector<HTMLElement>("[data-vwf-resource-items]");
  if (!container) return;
  const headers = vwfAuthHeaders();
  if (!headers) {
    setCanvasState(canvas, "requires-input");
    container.innerHTML = '<div class="phoenix-vwf-local-note">برای نمایش منابع زمان‌بندی، session و Workspace context لازم است.</div>';
    return;
  }
  const type = canvas.dataset.vwfResourceType?.trim();
  container.innerHTML = '<div class="slot-loading">در حال خواندن منابع زمان‌بندی واقعی از Booking…</div>';
  try {
    const params = new URLSearchParams({ businessId, limit: "48" });
    if (type) params.set("type", type);
    const response = await fetch("/api/v1/booking/resources?" + params.toString(), { headers });
    const body = await response.json().catch(() => null) as { data?: VerticalWorkflowResource[]; error?: { message?: string } } | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "Booking resources unavailable");
    const resources = Array.isArray(body?.data) ? body.data : [];
    if (!resources.length) {
      setCanvasState(canvas, "connected");
      container.innerHTML = emptyState("منبع زمان‌بندی فعالی برای این Business پیدا نشد.", "Booking");
      return;
    }
    container.innerHTML = resources.map((resource) => {
      const meta = resource.metadata ?? {};
      const label = typeof meta.name === "string" && meta.name.trim()
        ? meta.name.trim()
        : resource.id;
      const subtitle = typeof meta.title === "string" && meta.title.trim()
        ? meta.title.trim()
        : resource.resourceType;
      return '<article class="phoenix-vwf-live-resource-card" data-vwf-item>' +
        '<div class="phoenix-vwf-live-resource-top"><span class="pill ' + (resource.status === "active" ? "success" : "warning") + '">' + escapeHtml(resource.status) + '</span><span class="phoenix-vwf-source-chip">' + escapeHtml(resource.resourceType) + '</span></div>' +
        '<h4>' + escapeHtml(label) + '</h4>' +
        '<p>' + escapeHtml(subtitle) + '</p>' +
        '<div class="phoenix-vwf-live-resource-meta"><span>ظرفیت</span><strong>' + String(resource.capacity) + '</strong><span>شناسه</span><code>' + escapeHtml(resource.id) + '</code></div>' +
      '</article>';
    }).join("");
    setCanvasState(canvas, "connected");
  } catch (error) {
    setCanvasState(canvas, "unavailable");
    container.innerHTML = emptyState(error instanceof Error ? error.message : "خواندن منابع Booking ناموفق بود.", "Booking");
  }
}

export function bindVerticalWorkflowCanvas(root: ParentNode = document): void {
  const canvases = Array.from(root.querySelectorAll<HTMLElement>("[data-vwf-root]"));
  canvases.forEach((canvas) => {
    void hydrateCanvasRoleLens(canvas);
    void hydrateCanvasCapabilityContract(canvas);
    const tabs = Array.from(canvas.querySelectorAll<HTMLButtonElement>("[data-vwf-tab]"));
    const viewStateNode = canvas.querySelector<HTMLElement>("[data-vwf-view-state]");

    tabs.forEach((tab) => tab.addEventListener("click", () => {
      const view = tab.dataset.vwfTab ?? "overview";
      tabs.forEach((candidate) => {
        const active = candidate === tab;
        candidate.classList.toggle("active", active);
        candidate.setAttribute("aria-selected", active ? "true" : "false");
      });
      canvas.dataset.vwfActiveView = view;
      canvas.dataset.vwfActiveTab = view;
      if (viewStateNode) {
        viewStateNode.textContent = "نمای فعال: " + (tab.textContent?.trim() || view);
      }
    }));

    const filter = canvas.querySelector<HTMLInputElement>("[data-vwf-filter]");
    let emptyNode: HTMLElement | null = null;
    filter?.addEventListener("input", () => {
      const query = filter.value.trim().toLocaleLowerCase();
      const items = Array.from(canvas.querySelectorAll<HTMLElement>("[data-vwf-item]"));
      let visible = 0;
      items.forEach((item) => {
        const matches = !query || (item.textContent ?? "").toLocaleLowerCase().includes(query);
        item.hidden = !matches;
        if (matches) visible += 1;
      });
      if (!visible && query) {
        if (!emptyNode) {
          emptyNode = document.createElement("div");
          emptyNode.className = "phoenix-vwf-local-empty";
          emptyNode.textContent = "در این Canvas موردی با این فیلتر پیدا نشد.";
          filter.closest(".phoenix-vwf-filter-row")?.insertAdjacentElement("afterend", emptyNode);
        }
        emptyNode.hidden = false;
      } else if (emptyNode) {
        emptyNode.hidden = true;
      }
    });

    canvas.querySelectorAll<HTMLButtonElement>("[data-vwf-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.vwfAction ?? "";
        const layout = canvas.dataset.vwfLayout ?? "";
        const businessId = canvas.dataset.vwfBusinessId?.trim();
        if (action === "refresh") {
          invalidateVerticalWorkflowContextCache();
          button.disabled = true;
          const finish = () => { button.disabled = false; };
          if (layout === "command" && businessId) {
            void hydrateCommandCanvas(canvas, businessId).finally(finish);
            return;
          }
          if (layout === "calendar" && businessId) {
            void hydrateCalendarCanvas(canvas, businessId).finally(finish);
            return;
          }
          if (layout === "catalog" && businessId && (canvas.dataset.vwfModule === "مدل‌ها و تنوع" || canvas.dataset.vwfModule === "سایز و رنگ")) {
            void hydrateVariantsCanvas(canvas, businessId).finally(finish);
            return;
          }
          if (layout === "commerce" && businessId && ["فروش امروز", "سفارش‌ها", "سفارش‌های امروز"].includes(canvas.dataset.vwfModule ?? "")) {
            void hydrateOrdersCanvas(canvas, businessId).finally(finish);
            return;
          }
          if (layout === "commerce" && businessId && canvas.dataset.vwfModule === "موجودی") {
            void hydrateInventoryCanvas(canvas, businessId).finally(finish);
            return;
          }
          if (layout === "commerce" && businessId && canvas.dataset.vwfModule === "پرداخت") {
            void hydrateBillingCanvas(canvas, businessId).finally(finish);
            return;
          }
          if (layout === "catalog" && businessId) {
            void hydrateCatalogCanvas(canvas, businessId).finally(finish);
            return;
          }
          if (layout === "people" && businessId && (canvas.dataset.vwfModule === "پزشکان" || canvas.dataset.vwfModule === "متخصصان")) {
            void hydrateResourceCanvas(canvas, businessId).finally(finish);
            return;
          }
          if (layout === "people") {
            void hydratePeopleCanvas(canvas).finally(finish);
            return;
          }
          if (layout === "operations" && businessId && canvas.dataset.vwfModule === "میزها") {
            void hydrateResourceCanvas(canvas, businessId).finally(finish);
            return;
          }
          if (layout === "operations") {
            void hydrateOperationsCanvas(canvas).finally(finish);
            return;
          }
          if (layout === "communication") {
            void hydrateCommunicationCanvas(canvas).finally(finish);
            return;
          }
          finish();
        }
        const label = action === "today"
          ? "بازه «امروز» برای hydrate شدن آماده است."
          : "این action فعلاً فقط state رابط را تغییر می‌دهد و mutation دامنه‌ای انجام نمی‌دهد.";
        const note = canvas.querySelector<HTMLElement>("[data-vwf-note]");
        if (note) note.textContent = label;
        else {
          const footer = document.createElement("div");
          footer.className = "phoenix-vwf-local-note phoenix-vwf-action-note";
          footer.dataset.vwfNote = "true";
          footer.textContent = label;
          canvas.appendChild(footer);
        }
      });
    });

    const customerLookup = canvas.querySelector<HTMLInputElement>("[data-vwf-customer-id]");
    const customerDetail = canvas.querySelector<HTMLElement>("[data-vwf-customer-detail]");
    canvas.querySelector<HTMLButtonElement>("[data-vwf-load-customer]")?.addEventListener("click", () => {
      const customerId = customerLookup?.value.trim();
      if (!customerDetail) return;
      if (!customerId) {
        customerDetail.hidden = false;
        customerDetail.innerHTML = '<div class="phoenix-vwf-local-note">Customer ID وارد نشده است.</div>';
        return;
      }
      void hydrateCustomerLookup(customerDetail, customerId);
    });

    const bookingLookup = canvas.querySelector<HTMLInputElement>("[data-vwf-booking-id]");
    const bookingDetail = canvas.querySelector<HTMLElement>("[data-vwf-booking-detail]");
    canvas.querySelector<HTMLButtonElement>("[data-vwf-load-booking]")?.addEventListener("click", () => {
      const bookingId = bookingLookup?.value.trim();
      if (!bookingDetail) return;
      if (!bookingId) {
        bookingDetail.hidden = false;
        bookingDetail.innerHTML = '<div class="phoenix-vwf-local-note">Booking ID وارد نشده است.</div>';
        return;
      }
      void hydrateBookingLookup(bookingDetail, bookingId);
    });

    canvas.querySelectorAll<HTMLButtonElement>("[data-vwf-open-order]").forEach((button) => {
      button.addEventListener("click", () => {
        const orderId = button.dataset.vwfOpenOrder?.trim();
        const detail = canvas.querySelector<HTMLElement>("[data-vwf-order-detail]");
        if (!orderId || !detail) return;
        const lookup = canvas.querySelector<HTMLInputElement>("[data-vwf-order-id]");
        if (lookup) lookup.value = orderId;
        void hydrateOrderLookup(detail, orderId);
      });
    });

    const fulfillmentLookup = canvas.querySelector<HTMLInputElement>("[data-vwf-fulfillment-id]");
    const fulfillmentDetail = canvas.querySelector<HTMLElement>("[data-vwf-fulfillment-detail]");
    canvas.querySelector<HTMLButtonElement>("[data-vwf-load-fulfillment]")?.addEventListener("click", () => {
      const fulfillmentId = fulfillmentLookup?.value.trim();
      if (!fulfillmentDetail) return;
      if (!fulfillmentId) {
        fulfillmentDetail.hidden = false;
        fulfillmentDetail.innerHTML = '<div class="phoenix-vwf-local-note">Fulfillment ID وارد نشده است.</div>';
        return;
      }
      void hydrateFulfillmentLookup(fulfillmentDetail, fulfillmentId);
    });

    const orderLookup = canvas.querySelector<HTMLInputElement>("[data-vwf-order-id]");
    const orderDetail = canvas.querySelector<HTMLElement>("[data-vwf-order-detail]");
    canvas.querySelector<HTMLButtonElement>("[data-vwf-load-order]")?.addEventListener("click", () => {
      const orderId = orderLookup?.value.trim();
      if (!orderDetail) return;
      if (!orderId) {
        orderDetail.hidden = false;
        orderDetail.innerHTML = '<div class="phoenix-vwf-local-note">Order ID وارد نشده است.</div>';
        return;
      }
      void hydrateOrderLookup(orderDetail, orderId);
    });

    const businessId = canvas.dataset.vwfBusinessId?.trim();
    if (canvas.dataset.vwfLayout === "command") {
      setCanvasState(canvas, businessId ? "readonly" : "requires-input");
      if (businessId) void hydrateCommandCanvas(canvas, businessId);
    }
    if (businessId && canvas.dataset.vwfLayout === "calendar") {
      void hydrateCalendarCanvas(canvas, businessId);
    }
    if (businessId && canvas.dataset.vwfLayout === "commerce" && ["فروش امروز", "سفارش‌ها", "سفارش‌های امروز"].includes(canvas.dataset.vwfModule ?? "")) {
      void hydrateOrdersCanvas(canvas, businessId);
    }
    if (businessId && canvas.dataset.vwfLayout === "commerce" && canvas.dataset.vwfModule === "موجودی") {
      void hydrateInventoryCanvas(canvas, businessId);
    }
    if (businessId && canvas.dataset.vwfLayout === "commerce" && canvas.dataset.vwfModule === "پرداخت") {
      void hydrateBillingCanvas(canvas, businessId);
    }
    if (businessId && canvas.dataset.vwfLayout === "catalog") {
      void hydrateCatalogCanvas(canvas, businessId);
    }
    if (businessId && canvas.dataset.vwfLayout === "catalog" && (canvas.dataset.vwfModule === "مدل‌ها و تنوع" || canvas.dataset.vwfModule === "سایز و رنگ")) {
      void hydrateVariantsCanvas(canvas, businessId);
    }
    if (businessId && canvas.dataset.vwfLayout === "people" && (canvas.dataset.vwfModule === "پزشکان" || canvas.dataset.vwfModule === "متخصصان")) {
      void hydrateResourceCanvas(canvas, businessId);
    }
    if (canvas.dataset.vwfLayout === "people") {
      void hydratePeopleCanvas(canvas);
    }
    if (businessId && canvas.dataset.vwfLayout === "operations" && canvas.dataset.vwfModule === "میزها") {
      void hydrateResourceCanvas(canvas, businessId);
    }
    if (canvas.dataset.vwfLayout === "operations") {
      void hydrateOperationsCanvas(canvas);
    }
    if (canvas.dataset.vwfLayout === "communication") {
      void hydrateCommunicationCanvas(canvas);
    }
  });
}


type VerticalWorkflowResource = {
  id: string;
  businessId: string;
  locationId?: string | null;
  resourceType: "person" | "room" | "equipment" | "vehicle" | "service_area" | "other";
  status: "active" | "inactive" | "archived";
  capacity: number;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type VerticalWorkflowBusinessRecord = {
  id?: string;
  name?: string;
  displayName?: string;
  status?: string;
  publicationStatus?: string;
  businessType?: string;
  defaultLocale?: string;
  defaultCurrency?: string;
};

async function hydrateCommandCanvas(canvas: HTMLElement, businessId: string): Promise<void> {
  const host = canvas.querySelector<HTMLElement>("[data-vwf-command-live-content]");
  if (!host) return;
  const headers = vwfAuthHeaders();
  if (!headers) {
    setCanvasState(canvas, "requires-input");
    host.innerHTML = '<div class="phoenix-vwf-local-note">برای نمایش Business context، session و Workspace context لازم است.</div>';
    return;
  }
  host.innerHTML = '<div class="slot-loading">در حال خواندن Business management…</div>';
  try {
    const response = await fetch("/api/v1/businesses/" + encodeURIComponent(businessId) + "/management", { headers });
    const body = await response.json().catch(() => null) as { data?: { business?: VerticalWorkflowBusinessRecord }; error?: { message?: string } } | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "Business context unavailable");
    const business = body?.data?.business;
    if (!business) throw new Error("Business record not returned");
    const displayName = String(business.displayName ?? business.name ?? businessId);
    const publication = String(business.publicationStatus ?? "unpublished");
    const status = String(business.status ?? "—");
    const verticalLabel = String(business.businessType ?? "—");
    const locale = String(business.defaultLocale ?? "—");
    const currency = String(business.defaultCurrency ?? "—");
    const publicationClass = publication === "published" ? "pill success" : "pill warning";
    host.innerHTML =
      '<div class="phoenix-vwf-command-live-item"><span>Business</span><strong>' + escapeHtml(displayName) + '</strong><small>' + escapeHtml(businessId) + '</small></div>' +
      '<div class="phoenix-vwf-command-live-item"><span>Status</span><strong>' + escapeHtml(status) + '</strong><small>' + escapeHtml(verticalLabel) + '</small></div>' +
      '<div class="phoenix-vwf-command-live-item"><span>Publication</span><strong><span class="' + publicationClass + '">' + escapeHtml(publication) + '</span></strong><small>Business policy</small></div>' +
      '<div class="phoenix-vwf-command-live-item"><span>Locale / Currency</span><strong>' + escapeHtml(locale) + '</strong><small>' + escapeHtml(currency) + '</small></div>';
    setCanvasState(canvas, "connected");
  } catch (error) {
    setCanvasState(canvas, "unavailable");
    host.innerHTML = emptyState(error instanceof Error ? error.message : "خواندن Business context ناموفق بود.", "Business management");
  }
}

function vwfAuthHeaders(): Headers | null {
  const token = sessionStorage.getItem("phoenix-access-token");
  const workspace = localStorage.getItem("phoenix-workspace-id");
  if (!token || !workspace) return null;
  return new Headers({
    Accept: "application/json",
    Authorization: "Bearer " + token,
    "x-workspace-id": workspace,
  });
}

function displayMinorAmount(value: unknown, currency: unknown): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "—";
  const normalized = amount / 100;
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(normalized) + (currency ? " " + String(currency) : "");
}

type VerticalWorkflowWorkspaceMember = {
  id: string;
  userId: string;
  status: string;
  displayName?: string | null;
  name?: string | null;
};

async function hydratePeopleCanvas(canvas: HTMLElement): Promise<void> {
  const container = canvas.querySelector<HTMLElement>("[data-vwf-member-items]");
  if (!container) return;
  const headers = vwfAuthHeaders();
  if (!headers) {
    setCanvasState(canvas, "requires-input");
    container.innerHTML = '<div class="phoenix-vwf-local-note">برای نمایش اعضای واقعی، session و Workspace context لازم است.</div>';
    return;
  }
  const workspaceId = localStorage.getItem("phoenix-workspace-id")?.trim();
  if (!workspaceId) {
    setCanvasState(canvas, "requires-input");
    container.innerHTML = '<div class="phoenix-vwf-local-note">Workspace context پیدا نشد؛ فهرست اعضا قابل خواندن نیست.</div>';
    return;
  }
  container.innerHTML = '<div class="slot-loading">در حال خواندن اعضای واقعی Workspace…</div>';
  try {
    const response = await fetch("/api/v1/workspaces/" + encodeURIComponent(workspaceId) + "/members", { headers });
    const body = await response.json().catch(() => null) as { data?: VerticalWorkflowWorkspaceMember[]; error?: { message?: string } } | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "Workspace members unavailable");
    const members = Array.isArray(body?.data) ? body.data : [];
    if (!members.length) {
      setCanvasState(canvas, "connected");
      container.innerHTML = emptyState("برای این Workspace عضو قابل نمایش پیدا نشد.", "Workspace");
      return;
    }
    container.innerHTML = members.map((member) => {
      const label = String(member.displayName ?? member.name ?? member.userId ?? member.id);
      const status = String(member.status ?? "unknown");
      return '<article class="phoenix-vwf-live-people-card" data-vwf-item>' +
        '<div class="phoenix-vwf-live-people-top"><div><span class="section-kicker">Workspace member</span><h4>' + escapeHtml(label) + '</h4></div><span class="pill">' + escapeHtml(status) + '</span></div>' +
        '<div class="phoenix-vwf-live-people-meta"><span>User</span><strong>' + escapeHtml(member.userId) + '</strong></div>' +
        '<div class="phoenix-vwf-live-people-meta"><span>Member</span><strong>' + escapeHtml(member.id) + '</strong></div>' +
        '<small>Role و Permission همچنان از Context/Authorization backend تعیین می‌شود.</small>' +
      '</article>';
    }).join("");
    setCanvasState(canvas, "connected");
  } catch (error) {
    setCanvasState(canvas, "unavailable");
    container.innerHTML = emptyState(error instanceof Error ? error.message : "خواندن اعضای Workspace ناموفق بود.", "Workspace");
  }
}

async function hydrateCustomerLookup(host: HTMLElement, customerId: string): Promise<void> {
  const headers = vwfAuthHeaders();
  host.hidden = false;
  const historySection = host.parentElement?.querySelector<HTMLElement>("[data-vwf-customer-history]");
  const historyItems = historySection?.querySelector<HTMLElement>("[data-vwf-customer-history-items]");
  if (historySection) historySection.hidden = false;
  if (!headers) {
    host.innerHTML = '<div class="phoenix-vwf-local-note">برای خواندن Customer، session و Workspace context لازم است.</div>';
    if (historyItems) historyItems.innerHTML = '<div class="phoenix-vwf-local-note">برای خواندن Timeline، session و Workspace context لازم است.</div>';
    return;
  }
  host.innerHTML = '<div class="slot-loading">در حال خواندن Customer و CRM Timeline canonical…</div>';
  if (historyItems) historyItems.innerHTML = '<div class="slot-loading">در حال خواندن تاریخچه رابطه…</div>';

  try {
    const [profileResponse, historyResponse] = await Promise.all([
      fetch("/api/v1/customers/" + encodeURIComponent(customerId) + "/profile", { headers }),
      fetch("/api/v1/customers/" + encodeURIComponent(customerId) + "/history?limit=12", { headers }),
    ]);

    const profileBody = await profileResponse.json().catch(() => null) as { data?: VerticalWorkflowEntityRecord; error?: { message?: string } } | null;
    const historyBody = await historyResponse.json().catch(() => null) as { data?: Array<Record<string, unknown>>; error?: { message?: string } } | null;

    if (!profileResponse.ok) throw new Error(profileBody?.error?.message ?? "Customer profile unavailable");
    const profile = profileBody?.data ?? {};
    const displayName = String(profile.displayName ?? profile.fullName ?? profile.name ?? customerId);
    const email = profile.email ? String(profile.email) : "—";
    const phone = profile.phone ? String(profile.phone) : "—";
    const locale = profile.locale ? String(profile.locale) : "—";

    host.innerHTML =
      '<div class="phoenix-vwf-live-detail-head"><div><span class="section-kicker">Canonical Customer</span><h3>' + escapeHtml(displayName) + '</h3><p>' + escapeHtml(customerId) + '</p></div><span class="pill success">live</span></div>' +
      '<div class="phoenix-vwf-live-detail-grid">' +
        '<div><span>Email</span><strong>' + escapeHtml(email) + '</strong></div>' +
        '<div><span>Phone</span><strong>' + escapeHtml(phone) + '</strong></div>' +
        '<div><span>Locale</span><strong>' + escapeHtml(locale) + '</strong></div>' +
      '</div>';

    if (!historyItems) return;
    if (!historyResponse.ok) {
      historyItems.innerHTML = emptyState(historyBody?.error?.message ?? "خواندن CRM Timeline ناموفق بود.", "CRM Timeline");
      return;
    }
    const history = Array.isArray(historyBody?.data) ? historyBody.data : [];
    if (!history.length) {
      historyItems.innerHTML = emptyState("برای این Customer هنوز رویداد قابل نمایش در Timeline ثبت نشده است.", "CRM Timeline");
      return;
    }
    historyItems.innerHTML = history.map((event) => {
      const eventType = String(event.eventType ?? "crm.event");
      const sourceModule = String(event.sourceModule ?? "customer");
      const occurredAtRaw = String(event.occurredAt ?? event.receivedAt ?? "");
      const date = occurredAtRaw ? new Date(occurredAtRaw) : null;
      const occurredAt = date && !Number.isNaN(date.getTime())
        ? date.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" })
        : "—";
      const payload = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
        ? Object.entries(event.payload as Record<string, unknown>).slice(0, 2).map(([key, value]) => escapeHtml(key) + ": " + escapeHtml(String(value))).join(" · ")
        : "";
      return '<article class="phoenix-vwf-customer-history-item" data-vwf-item>' +
        '<div class="phoenix-vwf-customer-history-icon">◇</div>' +
        '<div><div class="phoenix-vwf-customer-history-top"><strong>' + escapeHtml(eventType) + '</strong><span class="pill">' + escapeHtml(sourceModule) + '</span></div>' +
        '<small>' + escapeHtml(occurredAt) + '</small>' + (payload ? '<p>' + payload + '</p>' : "") + '</div>' +
      '</article>';
    }).join("");
  } catch (error) {
    host.innerHTML = emptyState(error instanceof Error ? error.message : "خواندن Customer ناموفق بود.", "Customer");
    if (historyItems) historyItems.innerHTML = emptyState("Timeline به‌دلیل خطای Customer قابل خواندن نیست.", "CRM Timeline");
  }
}

type VerticalWorkflowFulfillmentRecord = {
  id: string;
  businessId: string;
  sourceType: string;
  sourceId: string;
  status: string;
  fulfillmentType: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
};

async function hydrateFulfillmentLookup(detail: HTMLElement, fulfillmentId: string): Promise<void> {
  const headers = vwfAuthHeaders();
  detail.hidden = false;
  if (!headers) {
    detail.innerHTML = '<div class="phoenix-vwf-local-note">برای خواندن Fulfillment، session و Workspace context لازم است.</div>';
    return;
  }
  detail.innerHTML = '<div class="slot-loading">در حال خواندن Fulfillment canonical…</div>';
  try {
    const response = await fetch("/api/v1/fulfillment/" + encodeURIComponent(fulfillmentId), { headers });
    const body = await response.json().catch(() => null) as { data?: { fulfillment?: VerticalWorkflowFulfillmentRecord; items?: Array<Record<string, unknown>> }; error?: { message?: string } } | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "Fulfillment unavailable");
    const fulfillment = body?.data?.fulfillment;
    const items = Array.isArray(body?.data?.items) ? body.data.items : [];
    if (!fulfillment) throw new Error("Fulfillment record not returned");
    const dateLabel = (value?: string | null): string => {
      if (!value) return "—";
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : date.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" });
    };
    detail.innerHTML = '<div class="phoenix-vwf-fulfillment-card">' +
      '<div class="phoenix-vwf-fulfillment-top"><span class="pill ' + (fulfillment.status === "completed" ? "success" : "") + '">' + escapeHtml(fulfillment.status) + '</span><span class="phoenix-vwf-source-chip">' + escapeHtml(fulfillment.fulfillmentType) + '</span></div>' +
      '<div class="phoenix-vwf-fulfillment-grid">' +
        '<div><span>Business</span><strong>' + escapeHtml(fulfillment.businessId) + '</strong></div>' +
        '<div><span>منبع</span><strong>' + escapeHtml(fulfillment.sourceType + " · " + fulfillment.sourceId) + '</strong></div>' +
        '<div><span>ایجاد</span><strong>' + escapeHtml(dateLabel(fulfillment.createdAt)) + '</strong></div>' +
        '<div><span>به‌روزرسانی</span><strong>' + escapeHtml(dateLabel(fulfillment.updatedAt)) + '</strong></div>' +
        '<div><span>تکمیل</span><strong>' + escapeHtml(dateLabel(fulfillment.completedAt)) + '</strong></div>' +
        '<div><span>اقلام</span><strong>' + String(items.length) + '</strong></div>' +
      '</div></div>';
  } catch (error) {
    detail.innerHTML = '<div class="phoenix-vwf-empty"><span class="phoenix-vwf-empty-mark">!</span><strong>Fulfillment خوانده نشد</strong><p>' + escapeHtml(error instanceof Error ? error.message : "خواندن Fulfillment ناموفق بود.") + '</p><small>Fulfillment API · read-only</small></div>';
  }
}

async function hydrateBookingLookup(host: HTMLElement, bookingId: string): Promise<void> {
  const headers = vwfAuthHeaders();
  host.hidden = false;
  if (!headers) {
    host.innerHTML = '<div class="phoenix-vwf-local-note">برای خواندن Booking، session و Workspace context لازم است.</div>';
    return;
  }
  host.innerHTML = '<div class="slot-loading">در حال خواندن Booking canonical…</div>';
  try {
    const response = await fetch("/api/v1/booking/" + encodeURIComponent(bookingId), { headers });
    const body = await response.json().catch(() => null) as {
      data?: {
        booking?: VerticalWorkflowEntityRecord;
        items?: unknown[];
        history?: unknown[];
      };
      error?: { message?: string };
    } | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "Booking unavailable");
    const booking = body?.data?.booking ?? {};
    const items = Array.isArray(body?.data?.items) ? body.data.items : [];
    const history = Array.isArray(body?.data?.history) ? body.data.history : [];
    const status = String(booking.status ?? "—");
    const businessId = String(booking.businessId ?? "—");
    const customerId = String(booking.customerId ?? "—");
    const offeringId = String(booking.offeringId ?? "—");
    const startsAt = String(booking.startsAt ?? "—");
    const endsAt = String(booking.endsAt ?? "—");
    host.innerHTML =
      '<div class="phoenix-vwf-live-detail-head"><div><span class="section-kicker">Canonical Booking</span><h3>' + escapeHtml(bookingId) + '</h3><p>Booking source of truth</p></div><span class="pill">' + escapeHtml(status) + '</span></div>' +
      '<div class="phoenix-vwf-live-detail-grid">' +
        '<div><span>Business</span><strong>' + escapeHtml(businessId) + '</strong></div>' +
        '<div><span>Customer</span><strong>' + escapeHtml(customerId) + '</strong></div>' +
        '<div><span>Offering</span><strong>' + escapeHtml(offeringId) + '</strong></div>' +
        '<div><span>شروع</span><strong>' + escapeHtml(startsAt) + '</strong></div>' +
        '<div><span>پایان</span><strong>' + escapeHtml(endsAt) + '</strong></div>' +
        '<div><span>اقلام</span><strong>' + String(items.length) + '</strong></div>' +
        '<div><span>تاریخچه وضعیت</span><strong>' + String(history.length) + '</strong></div>' +
      '</div>';
  } catch (error) {
    host.innerHTML = emptyState(error instanceof Error ? error.message : "خواندن Booking ناموفق بود.", "Booking");
  }
}

async function hydrateOrderLookup(host: HTMLElement, orderId: string): Promise<void> {
  const headers = vwfAuthHeaders();
  host.hidden = false;
  if (!headers) {
    host.innerHTML = '<div class="phoenix-vwf-local-note">برای خواندن Order، session و Workspace context لازم است.</div>';
    return;
  }
  host.innerHTML = '<div class="slot-loading">در حال خواندن Order canonical…</div>';
  try {
    const response = await fetch("/api/v1/commerce/orders/" + encodeURIComponent(orderId), { headers });
    const body = await response.json().catch(() => null) as { data?: VerticalWorkflowEntityRecord; error?: { message?: string } } | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "Order unavailable");
    const order = body?.data ?? {};
    const status = String(order.status ?? "—");
    const businessId = String(order.businessId ?? "—");
    const customerId = String(order.customerId ?? "—");
    const total = displayMinorAmount(order.grandTotalMinor, order.currency);
    host.innerHTML =
      '<div class="phoenix-vwf-live-detail-head"><div><span class="section-kicker">Canonical Order</span><h3>' + escapeHtml(orderId) + '</h3><p>Commerce source of truth</p></div><span class="pill">' + escapeHtml(status) + '</span></div>' +
      '<div class="phoenix-vwf-live-detail-grid">' +
        '<div><span>Business</span><strong>' + escapeHtml(businessId) + '</strong></div>' +
        '<div><span>Customer</span><strong>' + escapeHtml(customerId) + '</strong></div>' +
        '<div><span>Grand total</span><strong>' + escapeHtml(total) + '</strong></div>' +
      '</div>';
  } catch (error) {
    host.innerHTML = emptyState(error instanceof Error ? error.message : "خواندن Order ناموفق بود.", "Commerce");
  }
}

type VerticalWorkflowOrder = {
  id: string;
  businessId: string;
  customerId: string;
  status: string;
  currency: string;
  grandTotalMinor: number;
  createdAt: string;
  sourceChannel?: string;
  fulfillmentStatusRef?: string | null;
};

async function hydrateOrdersCanvas(canvas: HTMLElement, businessId: string): Promise<void> {
  const container = canvas.querySelector<HTMLElement>("[data-vwf-order-items]");
  if (!container) return;
  const headers = vwfAuthHeaders();
  if (!headers) {
    setCanvasState(canvas, "requires-input");
    container.innerHTML = '<div class="phoenix-vwf-local-note">برای نمایش سفارش‌های واقعی، session و Workspace context لازم است.</div>';
    return;
  }

  container.innerHTML = '<div class="slot-loading">در حال خواندن Commerce Orders…</div>';
  try {
    const response = await fetch("/api/v1/commerce/orders?businessId=" + encodeURIComponent(businessId) + "&limit=24", { headers });
    const body = await response.json().catch(() => null) as { data?: VerticalWorkflowOrder[]; error?: { message?: string } } | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "Commerce orders unavailable");
    const orders = Array.isArray(body?.data) ? body.data : [];
    if (!orders.length) {
      setCanvasState(canvas, "connected");
      container.innerHTML = emptyState("برای این Business هنوز سفارشی در Commerce ثبت نشده است.", "Commerce Orders");
      return;
    }

    container.innerHTML = orders.map((order) => {
      const statusClass = order.status === "completed" ? "success" : order.status === "cancelled" || order.status === "refunded" ? "warning" : "";
      const total = displayMinorAmount(order.grandTotalMinor, order.currency);
      const createdAt = new Date(order.createdAt);
      const created = Number.isNaN(createdAt.getTime())
        ? "—"
        : createdAt.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" });
      return '<article class="phoenix-vwf-live-order-card" data-vwf-item>' +
        '<div class="phoenix-vwf-live-order-top"><strong>' + escapeHtml(order.id) + '</strong><span class="pill ' + statusClass + '">' + escapeHtml(order.status) + '</span></div>' +
        '<div class="phoenix-vwf-live-order-facts">' +
          '<div><span>مشتری</span><strong>' + escapeHtml(order.customerId) + '</strong></div>' +
          '<div><span>مبلغ</span><strong>' + escapeHtml(total) + '</strong></div>' +
          '<div><span>ثبت</span><strong>' + escapeHtml(created) + '</strong></div>' +
        '</div>' +
        '<div class="phoenix-vwf-live-order-meta"><span>کانال · ' + escapeHtml(order.sourceChannel ?? "—") + '</span><span>تحویل · ' + escapeHtml(order.fulfillmentStatusRef ?? "—") + '</span></div>' +
        '<button type="button" class="text-link" data-vwf-open-order="' + escapeHtml(order.id) + '">مشاهده جزئیات ←</button>' +
      '</article>';
    }).join("");
    setCanvasState(canvas, "connected");
  } catch (error) {
    setCanvasState(canvas, "unavailable");
    container.innerHTML = emptyState(error instanceof Error ? error.message : "خواندن سفارش‌های Commerce ناموفق بود.", "Commerce Orders");
  }
}

type VerticalWorkflowInvoice = {
  id: string;
  invoiceNumber?: string | null;
  businessId?: string | null;
  customerId?: string | null;
  orderId?: string | null;
  status: string;
  currency: string;
  totalMinor: number;
  amountPaidMinor: number;
  amountDueMinor: number;
  issueDate?: string | null;
  dueDate?: string | null;
};

async function hydrateBillingCanvas(canvas: HTMLElement, businessId: string): Promise<void> {
  const container = canvas.querySelector<HTMLElement>("[data-vwf-invoice-items]");
  if (!container) return;
  const headers = vwfAuthHeaders();
  if (!headers) {
    setCanvasState(canvas, "requires-input");
    container.innerHTML = '<div class="phoenix-vwf-local-note">برای نمایش صورتحساب‌های واقعی، session و Workspace context لازم است.</div>';
    return;
  }

  container.innerHTML = '<div class="slot-loading">در حال خواندن Billing canonical…</div>';
  try {
    const response = await fetch("/api/v1/billing/invoices?business_id=" + encodeURIComponent(businessId) + "&limit=12", { headers });
    const body = await response.json().catch(() => null) as { data?: VerticalWorkflowInvoice[]; error?: { message?: string } } | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "Billing invoices unavailable");
    const invoices = Array.isArray(body?.data) ? body.data : [];
    if (!invoices.length) {
      setCanvasState(canvas, "connected");
      container.innerHTML = emptyState("برای این Business هنوز صورتحساب قابل نمایش برنگشته است.", "Billing");
      return;
    }

    container.innerHTML = invoices.map((invoice) => {
      const total = displayMinorAmount(invoice.totalMinor, invoice.currency);
      const paid = displayMinorAmount(invoice.amountPaidMinor, invoice.currency);
      const due = displayMinorAmount(invoice.amountDueMinor, invoice.currency);
      const statusClass = invoice.status === "paid" || invoice.status === "settled" ? "success" : "";
      return '<article class="phoenix-vwf-live-invoice-card" data-vwf-item>' +
        '<div class="phoenix-vwf-live-invoice-top"><div><span class="section-kicker">Invoice</span><h4>' + escapeHtml(invoice.invoiceNumber ?? invoice.id) + '</h4></div><span class="pill ' + statusClass + '">' + escapeHtml(invoice.status) + '</span></div>' +
        '<div class="phoenix-vwf-live-invoice-meta">' +
          '<span>کل <strong>' + escapeHtml(total) + '</strong></span>' +
          '<span>پرداخت‌شده <strong>' + escapeHtml(paid) + '</strong></span>' +
          '<span>باقی‌مانده <strong>' + escapeHtml(due) + '</strong></span>' +
        '</div>' +
        '<div class="phoenix-vwf-live-invoice-foot"><span>' + escapeHtml(invoice.issueDate ?? "تاریخ صدور نامشخص") + '</span>' +
        (invoice.orderId ? '<a class="text-link" href="/transactions?order=' + encodeURIComponent(invoice.orderId) + '" data-nav>مشاهده سفارش ←</a>' : '<span class="phoenix-vwf-source-chip">Billing canonical</span>') +
        '</div>' +
      '</article>';
    }).join("");
    setCanvasState(canvas, "connected");
  } catch (error) {
    setCanvasState(canvas, "unavailable");
    container.innerHTML = emptyState(error instanceof Error ? error.message : "خواندن صورتحساب‌های Billing ناموفق بود.", "Billing");
  }
}

type VerticalWorkflowInventoryItem = {
  id: string;
  businessId: string;
  productId: string;
  productName: string;
  variantId: string;
  sku?: string | null;
  attributesJson?: string | null;
  variantStatus: string;
  locationId: string;
  locationName: string;
  quantityOnHand: number;
  quantityReserved: number;
  availableQuantity: number;
  version: number;
  updatedAt: string;
};

type VerticalWorkflowProductVariant = {
  id: string;
  productId: string;
  productName: string;
  sku?: string | null;
  attributes?: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type VerticalWorkflowOffering = {
  id: string;
  businessId: string;
  offeringType: "product" | "service";
  title: string;
  description?: string | null;
  serviceId?: string | null;
  productId?: string | null;
  status: string;
  publicationStatus: string;
  createdAt: string;
  updatedAt: string;
};

export function getVerticalWorkflowOfferingActionHref(
  offeringType: "product" | "service",
  offeringId: string,
  businessId?: string,
): string {
  if (offeringType === "service") {
    const params = new URLSearchParams({ offering: offeringId });
    if (businessId) params.set("business", businessId);
    return "/booking?" + params.toString();
  }
  return "/checkout?entity=" + encodeURIComponent(offeringId) + "&type=offering";
}

export function getVerticalWorkflowOfferingActionLabel(offeringType: "product" | "service"): string {
  return offeringType === "service" ? "رزرو خدمت" : "شروع خرید";
}

async function hydrateVariantsCanvas(canvas: HTMLElement, businessId: string): Promise<void> {
  const container = canvas.querySelector<HTMLElement>("[data-vwf-variant-items]");
  if (!container) return;
  const headers = vwfAuthHeaders();
  if (!headers) {
    setCanvasState(canvas, "requires-input");
    container.innerHTML = '<div class="phoenix-vwf-local-note">برای نمایش Variantهای واقعی، session و Workspace context لازم است.</div>';
    return;
  }
  container.innerHTML = '<div class="slot-loading">در حال خواندن Variantهای واقعی از Catalog…</div>';
  try {
    const response = await fetch("/api/v1/catalog/businesses/" + encodeURIComponent(businessId) + "/variants?limit=48", { headers });
    const body = await response.json().catch(() => null) as { data?: VerticalWorkflowProductVariant[]; error?: { message?: string } } | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "Catalog variants unavailable");
    const items = Array.isArray(body?.data) ? body.data : [];
    if (!items.length) {
      setCanvasState(canvas, "connected");
      container.innerHTML = emptyState("برای این Business هنوز Variant فعال و غیرآرشیوی برای نمایش پیدا نشد.", "Catalog Variants");
      return;
    }
    container.innerHTML = items.map((item) => {
      const attrs = item.attributes && typeof item.attributes === "object" && !Array.isArray(item.attributes)
        ? Object.entries(item.attributes).slice(0, 6)
        : [];
      const attrText = attrs.length
        ? attrs.map(([key, value]) => escapeHtml(key) + ": " + escapeHtml(Array.isArray(value) ? value.join("، ") : String(value))).join(" · ")
        : "Attribute ثبت نشده است";
      return '<article class="phoenix-vwf-live-variant-card" data-vwf-item>' +
        '<div class="phoenix-vwf-live-variant-top"><span class="pill ' + (item.status === "active" ? "success" : "") + '">' + escapeHtml(item.status) + '</span><span class="phoenix-vwf-source-chip">' + escapeHtml(item.sku ?? item.id) + '</span></div>' +
        '<h4>' + escapeHtml(item.productName) + '</h4>' +
        '<p>Variant · ' + escapeHtml(item.id) + '</p>' +
        '<div class="phoenix-vwf-live-variant-attributes">' + attrText + '</div>' +
      '</article>';
    }).join("");
    setCanvasState(canvas, "connected");
  } catch (error) {
    setCanvasState(canvas, "unavailable");
    container.innerHTML = emptyState(error instanceof Error ? error.message : "خواندن Variantهای Catalog ناموفق بود.", "Catalog Variants");
  }
}

async function hydrateInventoryCanvas(canvas: HTMLElement, businessId: string): Promise<void> {
  const container = canvas.querySelector<HTMLElement>("[data-vwf-inventory-items]");
  if (!container) return;
  const headers = vwfAuthHeaders();
  if (!headers) {
    setCanvasState(canvas, "requires-input");
    container.innerHTML = '<div class="phoenix-vwf-local-note">برای نمایش موجودی واقعی، session و Workspace context لازم است.</div>';
    return;
  }
  container.innerHTML = '<div class="slot-loading">در حال خواندن Inventory واقعی از Catalog…</div>';
  try {
    const response = await fetch("/api/v1/catalog/businesses/" + encodeURIComponent(businessId) + "/inventory?limit=48", { headers });
    const body = await response.json().catch(() => null) as { data?: VerticalWorkflowInventoryItem[]; error?: { message?: string } } | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "Inventory unavailable");
    const items = Array.isArray(body?.data) ? body.data : [];
    if (!items.length) {
      setCanvasState(canvas, "connected");
      container.innerHTML = emptyState("برای این Business هنوز رکورد موجودی فعالی پیدا نشد.", "Inventory");
      return;
    }
    container.innerHTML = items.map((item) => {
      const available = Number.isFinite(item.availableQuantity) ? item.availableQuantity : 0;
      const availabilityClass = available <= 0 ? "warning" : available <= 5 ? "" : "success";
      return '<article class="phoenix-vwf-live-inventory-card" data-vwf-item>' +
        '<div class="phoenix-vwf-live-inventory-top"><span class="pill ' + availabilityClass + '">' + (available <= 0 ? "ناموجود" : "موجود") + '</span><span class="phoenix-vwf-source-chip">' + escapeHtml(item.variantStatus) + '</span></div>' +
        '<h4>' + escapeHtml(item.productName) + '</h4>' +
        '<p>Variant: ' + escapeHtml(item.sku ?? item.variantId) + '</p>' +
        '<div class="phoenix-vwf-live-inventory-metrics">' +
          '<div><span>قابل فروش</span><strong>' + String(available) + '</strong></div>' +
          '<div><span>رزرو شده</span><strong>' + String(Math.max(item.quantityReserved, 0)) + '</strong></div>' +
          '<div><span>موجودی فیزیکی</span><strong>' + String(Math.max(item.quantityOnHand, 0)) + '</strong></div>' +
        '</div>' +
        '<small>' + escapeHtml(item.locationName) + ' · v' + String(item.version) + '</small>' +
      '</article>';
    }).join("");
    setCanvasState(canvas, "connected");
  } catch (error) {
    setCanvasState(canvas, "unavailable");
    container.innerHTML = emptyState(error instanceof Error ? error.message : "خواندن Inventory ناموفق بود.", "Inventory");
  }
}

async function hydrateCatalogCanvas(canvas: HTMLElement, businessId: string): Promise<void> {
  const container = canvas.querySelector<HTMLElement>("[data-vwf-catalog-items]");
  if (!container) return;
  const token = sessionStorage.getItem("phoenix-access-token");
  const workspace = localStorage.getItem("phoenix-workspace-id");
  if (!token || !workspace) {
    setCanvasState(canvas, "requires-input");
    container.innerHTML = '<div class="phoenix-vwf-local-note">برای نمایش عرضه‌های واقعی، session و Workspace context لازم است.</div>';
    return;
  }
  const headers = new Headers({ Accept: "application/json", Authorization: "Bearer " + token, "x-workspace-id": workspace });
  container.innerHTML = '<div class="slot-loading">در حال خواندن Offeringهای واقعی از Catalog…</div>';
  try {
    const response = await fetch("/api/v1/catalog/businesses/" + encodeURIComponent(businessId) + "/offers?limit=24", { headers });
    const body = await response.json().catch(() => null) as { data?: VerticalWorkflowOffering[]; error?: { message?: string } } | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "Catalog offerings unavailable");
    const offers = Array.isArray(body?.data) ? body.data : [];
    if (!offers.length) {
      setCanvasState(canvas, "connected");
      container.innerHTML = emptyState("برای این Business هنوز Offering ثبت‌شده‌ای پیدا نشد.", "Catalog");
      return;
    }
    container.innerHTML = offers.map((offer) => {
      const typeLabel = offer.offeringType === "service" ? "خدمت" : "محصول";
      const publicationLabel = offer.publicationStatus === "published" ? "منتشرشده" : offer.publicationStatus === "pending" ? "در انتظار انتشار" : offer.publicationStatus;
      return '<article class="phoenix-vwf-live-supply-card" data-vwf-item>' +
        '<div class="phoenix-vwf-live-supply-type"><span class="pill">' + escapeHtml(typeLabel) + '</span><span class="phoenix-vwf-source-chip">' + escapeHtml(offer.status) + '</span></div>' +
        '<h4>' + escapeHtml(offer.title) + '</h4>' +
        '<p>' + escapeHtml(offer.description ?? "توضیحی برای این عرضه ثبت نشده است.") + '</p>' +
        '<div class="phoenix-vwf-live-supply-meta"><span>Publication</span><strong>' + escapeHtml(publicationLabel) + '</strong></div>' +
        '<div class="phoenix-vwf-live-supply-meta"><span>Offering</span><strong>' + escapeHtml(offer.id) + '</strong></div>' +
        '<div class="phoenix-vwf-live-supply-actions">' +
          '<a class="button ' + (offer.offeringType === "service" ? "button-secondary" : "button-primary") + '" data-nav href="' + escapeHtml(getVerticalWorkflowOfferingActionHref(offer.offeringType, offer.id, businessId)) + '">' +
            escapeHtml(getVerticalWorkflowOfferingActionLabel(offer.offeringType)) + ' →' +
          '</a>' +
        '</div>' +
      '</article>';
    }).join("");
    setCanvasState(canvas, "connected");
  } catch (error) {
    setCanvasState(canvas, "unavailable");
    container.innerHTML = emptyState(error instanceof Error ? error.message : "خواندن Catalog ناموفق بود.", "Catalog");
  }
}

type VerticalWorkflowCase = {
  id: string;
  status: string;
  priority: string;
  severity: string;
  subjectType: string;
  subjectId: string;
  version?: number;
};

async function hydrateOperationsCanvas(canvas: HTMLElement): Promise<void> {
  const container = canvas.querySelector<HTMLElement>("[data-vwf-case-items]");
  if (!container) return;
  const headers = vwfAuthHeaders();
  if (!headers) {
    setCanvasState(canvas, "requires-input");
    container.innerHTML = '<div class="phoenix-vwf-local-note">برای نمایش Caseهای واقعی، session و Workspace context لازم است.</div>';
    return;
  }
  container.innerHTML = '<div class="slot-loading">در حال خواندن Caseهای واقعی…</div>';
  try {
    const response = await fetch("/api/v1/cases?limit=12", { headers });
    const body = await response.json().catch(() => null) as { data?: VerticalWorkflowCase[]; error?: { message?: string } } | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "Case list unavailable");
    const cases = Array.isArray(body?.data) ? body.data : [];
    if (!cases.length) {
      setCanvasState(canvas, "connected");
      container.innerHTML = emptyState("برای این Workspace هنوز Case قابل نمایش پیدا نشد.", "Case Support");
      return;
    }
    container.innerHTML = cases.map((item) => {
      const terminal = item.status === "resolved" || item.status === "closed";
      return '<article class="phoenix-vwf-live-case-card">' +
        '<div class="phoenix-vwf-live-case-top"><strong>' + escapeHtml(item.id) + '</strong><span class="pill ' + (terminal ? "success" : "") + '">' + escapeHtml(item.status) + '</span></div>' +
        '<p>' + escapeHtml(item.subjectType + " · " + item.subjectId) + '</p>' +
        '<div class="phoenix-vwf-live-case-meta"><span>Priority <b>' + escapeHtml(item.priority) + '</b></span><span>Severity <b>' + escapeHtml(item.severity) + '</b></span>' + (item.version !== undefined ? '<span>v' + String(item.version) + '</span>' : "") + '</div>' +
        '<a class="text-link" href="/operations" data-nav>باز کردن عملیات ←</a>' +
      '</article>';
    }).join("");
    setCanvasState(canvas, "connected");
  } catch (error) {
    setCanvasState(canvas, "unavailable");
    container.innerHTML = emptyState(error instanceof Error ? error.message : "خواندن Case ناموفق بود.", "Case Support");
  }
}

type VerticalWorkflowNotification = {
  id: string;
  intent?: string;
  channel?: string;
  priority?: string;
  status?: string;
  createdAt?: string;
};

async function hydrateCommunicationCanvas(canvas: HTMLElement): Promise<void> {
  const container = canvas.querySelector<HTMLElement>("[data-vwf-notification-items]");
  if (!container) return;
  const headers = vwfAuthHeaders();
  if (!headers) {
    setCanvasState(canvas, "requires-input");
    container.innerHTML = '<div class="phoenix-vwf-local-note">برای نمایش رویدادهای ارتباطی، session و Workspace context لازم است.</div>';
    return;
  }
  container.innerHTML = '<div class="slot-loading">در حال خواندن اعلان‌های واقعی…</div>';
  try {
    const response = await fetch("/api/v1/notifications?limit=12", { headers });
    const body = await response.json().catch(() => null) as { data?: VerticalWorkflowNotification[]; error?: { message?: string } } | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "Communication notifications unavailable");
    const items = Array.isArray(body?.data) ? body.data : [];
    if (!items.length) {
      setCanvasState(canvas, "connected");
      container.innerHTML = emptyState("برای این Actor هنوز اعلان ارتباطی برنگشته است.", "Communication");
      return;
    }
    container.innerHTML = items.map((item) => {
      const createdAt = item.createdAt ? new Date(item.createdAt) : null;
      const createdLabel = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" }) : "—";
      return '<article class="phoenix-vwf-live-notification">' +
        '<div class="phoenix-vwf-live-notification-icon">◇</div>' +
        '<div class="phoenix-vwf-live-notification-copy"><div class="phoenix-vwf-live-notification-top"><strong>' + escapeHtml(item.intent ?? "communication") + '</strong><span class="pill">' + escapeHtml(item.status ?? "—") + '</span></div>' +
        '<p>' + escapeHtml((item.channel ?? "in_app") + " · " + (item.priority ?? "normal")) + '</p><small>' + escapeHtml(createdLabel) + '</small></div>' +
      '</article>';
    }).join("");
    setCanvasState(canvas, "connected");
  } catch (error) {
    setCanvasState(canvas, "unavailable");
    container.innerHTML = emptyState(error instanceof Error ? error.message : "خواندن اعلان‌های ارتباطی ناموفق بود.", "Communication");
  }
}

type VerticalWorkflowSchedule = {
  id: string;
  businessId: string;
  locationId?: string | null;
  resourceId?: string | null;
  timezone: string;
  status: string;
};

type VerticalWorkflowSlot = {
  slotReference: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  remainingCapacity: number;
  status: string;
};

async function hydrateCalendarCanvas(canvas: HTMLElement, businessId: string): Promise<void> {
  const lanes = canvas.querySelector<HTMLElement>("[data-vwf-calendar-lanes]");
  if (!lanes) return;
  const token = sessionStorage.getItem("phoenix-access-token");
  const workspace = localStorage.getItem("phoenix-workspace-id");
  if (!token || !workspace) {
    setCanvasState(canvas, "requires-input");
    lanes.innerHTML = '<div class="phoenix-vwf-local-note">برای hydrate شدن Availability، session و Workspace context لازم است.</div>';
    return;
  }
  const headers = new Headers({ Accept: "application/json", Authorization: "Bearer " + token, "x-workspace-id": workspace });
  const from = new Date();
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  lanes.innerHTML = '<div class="slot-loading">در حال خواندن Schedule و Slotهای واقعی…</div>';
  try {
    const response = await fetch("/api/v1/availability/schedules?businessId=" + encodeURIComponent(businessId) + "&limit=6", { headers });
    const body = await response.json().catch(() => null) as { data?: VerticalWorkflowSchedule[]; error?: { message?: string } } | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "Availability schedules unavailable");
    const schedules = Array.isArray(body?.data) ? body.data : [];
    if (!schedules.length) {
      setCanvasState(canvas, "connected");
      lanes.innerHTML = emptyState("برای این Business هنوز schedule فعال/ثبت‌شده‌ای در Availability پیدا نشد.", "Booking");
      return;
    }
    const active = schedules.filter((item) => item.status === "active").slice(0, 4);
    if (!active.length) {
      setCanvasState(canvas, "connected");
      lanes.innerHTML = emptyState("Schedule ثبت شده است، اما هیچ Schedule فعالی برای نمایش پیدا نشد.", "Availability");
      return;
    }
    const laneResults = await Promise.all(active.map(async (schedule, index) => {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        durationSeconds: "1800",
      });
      if (schedule.resourceId) params.set("resourceId", schedule.resourceId);
      try {
        const slotResponse = await fetch("/api/v1/availability/schedules/" + encodeURIComponent(schedule.id) + "/slots?" + params.toString(), { headers });
        const slotBody = await slotResponse.json().catch(() => null) as { data?: VerticalWorkflowSlot[]; error?: { message?: string } } | null;
        if (!slotResponse.ok) throw new Error(slotBody?.error?.message ?? "Slots unavailable");
        const slots = Array.isArray(slotBody?.data) ? slotBody.data : [];
        return '<div class="phoenix-vwf-calendar-lane" data-vwf-item>' +
          '<span>Resource ' + String(index + 1).padStart(2, "0") + '</span>' +
          '<div class="phoenix-vwf-live-lane">' +
            '<div class="phoenix-vwf-live-meta"><strong>' + escapeHtml(schedule.timezone) + '</strong><small>' + escapeHtml(schedule.resourceId ?? "بدون Resource") + '</small><em>' + String(slots.length) + ' slot</em></div>' +
            (slots.length ? '<div class="phoenix-vwf-live-slots">' + slots.slice(0, 12).map((slot) => {
              const bookingParams = new URLSearchParams({
                scheduleId: schedule.id,
                businessId,
                from: slot.startsAt,
                to: slot.endsAt,
                duration: String(Math.max(Math.round((new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / 60000), 1)),
              });
              if (schedule.resourceId) bookingParams.set("resourceId", schedule.resourceId);
              return '<a class="phoenix-vwf-slot" data-nav href="/booking?' + escapeHtml(bookingParams.toString()) + '" data-vwf-slot-reference="' + escapeHtml(slot.slotReference) + '" title="' + escapeHtml(slot.status) + '"><span>' + escapeHtml(new Date(slot.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) + '</span><small>' + String(Math.max(slot.remainingCapacity, 0)) + ' ظرفیت · رزرو</small></a>';
            }).join("") + '</div>' : emptyState("در این بازه slot قابل رزرو برنگشت.", "Availability")) +
          '</div></div>';
      } catch (error) {
        return '<div class="phoenix-vwf-calendar-lane" data-vwf-item><span>Resource ' + String(index + 1).padStart(2, "0") + '</span><div>' + emptyState(error instanceof Error ? error.message : "خواندن Slot ناموفق بود.", "Availability") + '</div></div>';
      }
    }));
    lanes.innerHTML = laneResults.join("");
    setCanvasState(canvas, "connected");
  } catch (error) {
    setCanvasState(canvas, "unavailable");
    lanes.innerHTML = emptyState(error instanceof Error ? error.message : "خواندن Availability ناموفق بود.", "Availability");
  }
}
