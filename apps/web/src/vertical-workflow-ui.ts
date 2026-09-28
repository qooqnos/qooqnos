import type { VerticalModuleBlueprint, VerticalModuleLayout } from "./business-module-ui.js";

export type VerticalWorkflowCanvasModel = {
  readonly vertical: string;
  readonly module: string;
  readonly blueprint: VerticalModuleBlueprint;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function emptyState(message: string, eyebrow = "Canonical data"): string {
  return '<div class="phoenix-vwf-empty"><span class="phoenix-vwf-empty-mark">◌</span><strong>داده نمایشی در این سطح ساخته نمی‌شود</strong><p>' +
    escapeHtml(message) +
    '</p><small>' + escapeHtml(eyebrow) + '</small></div>';
}

function renderCommand(model: VerticalWorkflowCanvasModel): string {
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="Command views">' +
      '<button type="button" class="active" data-vwf-tab="overview">نمای کلی</button>' +
      '<button type="button" data-vwf-tab="queue">صف کار</button>' +
      '<button type="button" data-vwf-tab="actions">اقدام‌ها</button>' +
    '</div>' +
    '<span class="pill">No fabricated metrics</span>' +
    '</div>' +
    '<div class="phoenix-vwf-command-grid">' +
      '<article class="phoenix-vwf-command-primary"><span class="section-kicker">Primary flow</span><h3>' + escapeHtml(model.blueprint.primaryAction?.label ?? "منبع canonical") + '</h3><p>اقدام اصلی این ماژول باید از مسیر canonical اجرا شود؛ این Canvas فقط composition و context را فراهم می‌کند.</p>' +
        '<div class="phoenix-vwf-action-row"><span class="phoenix-vwf-source-chip">Vertical: ' + escapeHtml(model.vertical) + '</span><span class="phoenix-vwf-source-chip">Module: ' + escapeHtml(model.module) + '</span></div>' +
      '</article>' +
      '<article class="phoenix-vwf-command-secondary"><span class="section-kicker">Queue</span>' +
        emptyState("صف واقعی بعد از اتصال endpoint دامنه در همین ناحیه hydrate می‌شود.") +
      '</article>' +
    '</div>';
}

function renderCalendar(): string {
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="Calendar views">' +
      '<button type="button" class="active" data-vwf-tab="day">روز</button>' +
      '<button type="button" data-vwf-tab="week">هفته</button>' +
      '<button type="button" data-vwf-tab="month">ماه</button>' +
    '</div>' +
    '<button type="button" class="button button-ghost" data-vwf-action="today">امروز</button>' +
    '</div>' +
    '<div class="phoenix-vwf-calendar-head"><span>بازه زمانی</span><span>Resource lanes</span><span>Availability</span></div>' +
    '<div class="phoenix-vwf-calendar-grid">' +
      '<div class="phoenix-vwf-calendar-axis"><span>08:00</span><span>10:00</span><span>12:00</span><span>14:00</span><span>16:00</span><span>18:00</span></div>' +
      '<div class="phoenix-vwf-calendar-lanes">' +
        '<div class="phoenix-vwf-calendar-lane"><span>Resource 01</span><div>' + emptyState("slotهای واقعی پس از خواندن Availability در این lane قرار می‌گیرند.", "Availability") + '</div></div>' +
        '<div class="phoenix-vwf-calendar-lane"><span>Resource 02</span><div>' + emptyState("ظرفیت این resource از backend authoritative hydrate می‌شود.", "Booking") + '</div></div>' +
      '</div>' +
    '</div>';
}

function renderCatalog(): string {
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="Supply views">' +
      '<button type="button" class="active" data-vwf-tab="grid">کارت‌ها</button>' +
      '<button type="button" data-vwf-tab="table">جدول</button>' +
      '<button type="button" data-vwf-tab="drafts">پیش‌نویس‌ها</button>' +
    '</div>' +
    '<a class="button button-primary" href="/catalog" data-nav>باز کردن Catalog →</a>' +
    '</div>' +
    '<div class="phoenix-vwf-filter-row">' +
      '<input class="studio-input-line" data-vwf-filter placeholder="فیلتر محلی این Canvas…" aria-label="فیلتر محلی" />' +
      '<span class="phoenix-vwf-local-note">Local UI filter · canonical data unchanged</span>' +
    '</div>' +
    '<div class="phoenix-vwf-supply-grid">' +
      modelBlocks('عرضه', "سه slot برای Product / Service / Offering طراحی شده‌اند؛ داده‌ها باید مستقیماً از Catalog خوانده شوند.", "Catalog") +
    '</div>';
}

function renderPeople(): string {
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="People views">' +
      '<button type="button" class="active" data-vwf-tab="people">اعضا / افراد</button>' +
      '<button type="button" data-vwf-tab="roles">نقش‌ها</button>' +
      '<button type="button" data-vwf-tab="relationships">رابطه‌ها</button>' +
    '</div>' +
    '<span class="pill">RBAC remains backend authoritative</span>' +
    '</div>' +
    '<div class="phoenix-vwf-filter-row">' +
      '<input class="studio-input-line" data-vwf-filter placeholder="جستجوی نمایشی…" aria-label="جستجو" />' +
      '<span class="phoenix-vwf-local-note">فقط روی محتوای همین Canvas اعمال می‌شود.</span>' +
    '</div>' +
    '<div class="phoenix-vwf-people-grid">' +
      peopleSlot("Workspace members", "Team / Access") +
      peopleSlot("Customer relationship", "Customer") +
      peopleSlot("Provider / Specialist lens", "Role + Capability") +
    '</div>';
}

function renderCommerce(): string {
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="Commerce views">' +
      '<button type="button" class="active" data-vwf-tab="all">همه</button>' +
      '<button type="button" data-vwf-tab="open">باز</button>' +
      '<button type="button" data-vwf-tab="action">نیازمند اقدام</button>' +
    '</div>' +
    '<a class="button button-primary" href="/transactions" data-nav>باز کردن معاملات →</a>' +
    '</div>' +
    '<div class="phoenix-vwf-commerce-grid">' +
      commerceSlot("Order queue", "Commerce / Orders") +
      commerceSlot("Billing state", "Billing") +
      commerceSlot("Fulfillment", "Operations") +
    '</div>' +
    '<div class="phoenix-vwf-status-rail"><span>Order</span><i></i><span>Billing</span><i></i><span>Fulfillment</span></div>';
}

function renderOperations(): string {
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="Operations views">' +
      '<button type="button" class="active" data-vwf-tab="board">Board</button>' +
      '<button type="button" data-vwf-tab="list">List</button>' +
      '</div>' +
    '<a class="button button-primary" href="/operations" data-nav>باز کردن Operations →</a>' +
    '</div>' +
    '<div class="phoenix-vwf-kanban">' +
      kanbanColumn("در انتظار", "Queue") +
      kanbanColumn("در حال اجرا", "In progress") +
      kanbanColumn("تحویل / پایان", "Fulfillment") +
    '</div>';
}

function renderCommunication(): string {
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="Communication views">' +
      '<button type="button" class="active" data-vwf-tab="inbox">Inbox</button>' +
      '<button type="button" data-vwf-tab="followup">Follow-up</button>' +
      '<button type="button" data-vwf-tab="compose">Compose</button>' +
    '</div>' +
    '<a class="button button-primary" href="/communication" data-nav>باز کردن Communication →</a>' +
    '</div>' +
    '<div class="phoenix-vwf-inbox">' +
      '<aside>' +
        '<span class="section-kicker">Conversation list</span>' +
        emptyState("گفتگوهای واقعی از Communication hydrate می‌شوند.", "Communication") +
      '</aside>' +
      '<section>' +
        '<span class="section-kicker">Context pane</span>' +
        emptyState("پروفایل، Business relation و permission در این پنل قرار می‌گیرند.", "Customer + Context") +
      '</section>' +
    '</div>';
}

function modelBlocks(prefix: string, description: string, source: string): string {
  return Array.from({ length: 3 }, (_, index) =>
    '<article class="phoenix-vwf-supply-card"><span class="phoenix-module-blueprint-index">0' + String(index + 1) + '</span><div><strong>' + escapeHtml(prefix) + ' surface ' + String(index + 1) + '</strong><p>' + escapeHtml(description) + '</p><span class="phoenix-vwf-source-chip">' + escapeHtml(source) + '</span></div></article>',
  ).join("");
}

function peopleSlot(title: string, source: string): string {
  return '<article class="phoenix-vwf-people-card"><span class="section-kicker">People surface</span><h3>' + escapeHtml(title) + '</h3>' + emptyState("ردیف واقعی بعد از اتصال منبع اصلی این قابلیت نمایش داده می‌شود.", source) + '</article>';
}

function commerceSlot(title: string, source: string): string {
  return '<article class="phoenix-vwf-commerce-card"><span class="section-kicker">Commerce surface</span><h3>' + escapeHtml(title) + '</h3>' + emptyState("state واقعی بدون کپی کردن Order/Billing/Operations در این Canvas hydrate می‌شود.", source) + '</article>';
}

function kanbanColumn(title: string, source: string): string {
  return '<article class="phoenix-vwf-kanban-column"><div class="phoenix-vwf-kanban-title"><strong>' + escapeHtml(title) + '</strong><span class="pill">' + escapeHtml(source) + '</span></div>' + emptyState("Case یا task واقعی از Operations در این ستون قرار می‌گیرد.", "Operations") + '</article>';
}

function renderLayout(layout: VerticalModuleLayout, model: VerticalWorkflowCanvasModel): string {
  switch (layout) {
    case "command": return renderCommand(model);
    case "calendar": return renderCalendar();
    case "catalog": return renderCatalog();
    case "people": return renderPeople();
    case "commerce": return renderCommerce();
    case "operations": return renderOperations();
    case "communication": return renderCommunication();
  }
}

export function renderVerticalWorkflowCanvas(model: VerticalWorkflowCanvasModel): string {
  const copy = layoutCopy[model.blueprint.layout];
  return '<section class="glass-card phoenix-vwf-canvas" data-vwf-root data-vwf-layout="' + escapeHtml(model.blueprint.layout) + '">' +
    '<div class="phoenix-vwf-header">' +
      '<div><span class="section-kicker">Vertical Workflow UI Framework</span><h2>' + escapeHtml(copy.label) + ' canvas</h2><p>' + escapeHtml(copy.description) + '</p></div>' +
      '<span class="pill">Shared component</span>' +
    '</div>' +
    '<div data-vwf-content>' + renderLayout(model.blueprint.layout, model) + '</div>' +
    '<div class="phoenix-vwf-contract"><span>state</span><strong>canonical-only</strong><span>layout</span><strong>' + escapeHtml(model.blueprint.layout) + '</strong><span>interaction</span><strong>' + escapeHtml(model.blueprint.interaction) + '</strong></div>' +
  '</section>';
}

export function bindVerticalWorkflowCanvas(root: ParentNode = document): void {
  const canvases = Array.from(root.querySelectorAll<HTMLElement>("[data-vwf-root]"));
  canvases.forEach((canvas) => {
    const tabs = Array.from(canvas.querySelectorAll<HTMLButtonElement>("[data-vwf-tab]"));
    tabs.forEach((tab) => tab.addEventListener("click", () => {
      tabs.forEach((candidate) => candidate.classList.toggle("active", candidate === tab));
      canvas.dataset.vwfActiveTab = tab.dataset.vwfTab ?? "";
    }));

    canvas.querySelectorAll<HTMLButtonElement>("[data-vwf-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.vwfAction ?? "";
        const label = action === "today" ? "بازه «امروز» برای hydrate شدن آماده است." : "این action فعلاً فقط state رابط را تغییر می‌دهد و mutation دامنه‌ای انجام نمی‌دهد.";
        const note = canvas.querySelector<HTMLElement>("[data-vwf-note]");
        if (note) note.textContent = label;
        else {
          const footer = document.createElement("div");
          footer.className = "phoenix-vwf-local-note";
          footer.dataset.vwfNote = "true";
          footer.textContent = label;
          canvas.appendChild(footer);
        }
      });
    });
  });
}
