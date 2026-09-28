import type { VerticalModuleBlueprint, VerticalModuleLayout } from "./business-module-ui.js";

export type VerticalWorkflowCanvasModel = {
  readonly vertical: string;
  readonly module: string;
  readonly blueprint: VerticalModuleBlueprint;
  readonly businessId?: string;
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

function viewState(label: string): string {
  return '<span class="phoenix-vwf-view-state" data-vwf-view-state>نمای فعال: ' + escapeHtml(label) + '</span>';
}

function renderCommand(model: VerticalWorkflowCanvasModel): string {
  const action = model.blueprint.primaryAction
    ? '<a class="button button-primary" href="' + escapeHtml(model.blueprint.primaryAction.path) + '" data-nav>' + escapeHtml(model.blueprint.primaryAction.label) + ' →</a>'
    : '<span class="pill">منبع canonical</span>';
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="Command views">' +
      '<button type="button" class="active" aria-selected="true" data-vwf-tab="overview">نمای کلی</button>' +
      '<button type="button" aria-selected="false" data-vwf-tab="queue">صف کار</button>' +
      '<button type="button" aria-selected="false" data-vwf-tab="actions">اقدام‌ها</button>' +
    '</div>' +
    viewState("نمای کلی") +
    '</div>' +
    '<div class="phoenix-vwf-command-grid">' +
      '<article class="phoenix-vwf-command-primary" data-vwf-item>' +
        '<span class="section-kicker">Primary flow</span><h3>' + escapeHtml(model.blueprint.primaryAction?.label ?? "منبع canonical") + '</h3><p>اقدام اصلی این ماژول باید از مسیر canonical اجرا شود؛ این Canvas فقط composition و context را فراهم می‌کند.</p>' +
        '<div class="phoenix-vwf-action-row"><span class="phoenix-vwf-source-chip">Vertical: ' + escapeHtml(model.vertical) + '</span><span class="phoenix-vwf-source-chip">Module: ' + escapeHtml(model.module) + '</span>' + action + '</div>' +
      '</article>' +
      '<article class="phoenix-vwf-command-secondary" data-vwf-item><span class="section-kicker">Queue</span>' +
        emptyState("صف واقعی بعد از اتصال endpoint دامنه در همین ناحیه hydrate می‌شود.") +
      '</article>' +
    '</div>';
}

function renderCalendar(model: VerticalWorkflowCanvasModel): string {
  const first = model.blueprint.blocks[0];
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="Calendar views">' +
      '<button type="button" class="active" data-vwf-tab="day">روز</button>' +
      '<button type="button" data-vwf-tab="week">هفته</button>' +
      '<button type="button" data-vwf-tab="month">ماه</button>' +
    '</div>' +
    '<button type="button" class="button button-ghost" data-vwf-action="today">امروز</button>' +
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
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="Supply views">' +
      '<button type="button" class="active" aria-selected="true" data-vwf-tab="grid">کارت‌ها</button>' +
      '<button type="button" aria-selected="false" data-vwf-tab="table">جدول</button>' +
      '<button type="button" aria-selected="false" data-vwf-tab="drafts">پیش‌نویس‌ها</button>' +
    '</div>' +
    viewState("کارت‌ها") +
    '</div>' +
    '<div class="phoenix-vwf-filter-row">' +
      '<input class="studio-input-line" data-vwf-filter placeholder="فیلتر محلی این Canvas…" aria-label="فیلتر محلی" />' +
      '<span class="phoenix-vwf-local-note">Local UI filter · canonical data unchanged</span>' +
    '</div>' +
    '<div class="phoenix-vwf-supply-grid" data-vwf-supply-live>' +
      '<div class="phoenix-vwf-live-supply" data-vwf-catalog-live>' +
        '<div class="phoenix-vwf-live-supply-head"><div><span class="section-kicker">Canonical supply</span><h3>عرضه‌های این کسب‌وکار</h3><p>فقط Offeringهای متعلق به همین Business و Workspace در این بخش hydrate می‌شوند.</p></div><span class="pill">live when connected</span></div>' +
        '<div class="phoenix-vwf-live-supply-grid" data-vwf-catalog-items><div class="slot-loading">در حال آماده‌سازی منبع Catalog…</div></div>' +
      </div>' +
      model.blueprint.blocks.map((item) => '<article class="phoenix-vwf-supply-card" data-vwf-item><span class="phoenix-module-blueprint-index">' + escapeHtml(item.label) + '</span><div><strong>' + escapeHtml(item.title) + '</strong><p>' + escapeHtml(item.description) + '</p>' + (item.path ? '<a class="text-link" href="' + escapeHtml(item.path) + '" data-nav>باز کردن منبع ←</a>' : '<span class="phoenix-vwf-source-chip">canonical source</span>') + '</div></article>').join("") +
    '</div>';
}
function renderPeople(model: VerticalWorkflowCanvasModel): string {
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="People views">' +
      '<button type="button" class="active" aria-selected="true" data-vwf-tab="people">اعضا / افراد</button>' +
      '<button type="button" aria-selected="false" data-vwf-tab="roles">نقش‌ها</button>' +
      '<button type="button" aria-selected="false" data-vwf-tab="relationships">رابطه‌ها</button>' +
    '</div>' +
    viewState("اعضا / افراد") +
    '</div>' +
    '<div class="phoenix-vwf-filter-row">' +
      '<input class="studio-input-line" data-vwf-filter placeholder="جستجوی نمایشی…" aria-label="جستجو" />' +
      '<span class="phoenix-vwf-local-note">فقط روی محتوای همین Canvas اعمال می‌شود.</span>' +
    '</div>' +
    '<div class="phoenix-vwf-people-grid">' +
      model.blueprint.blocks.map((item) => '<article class="phoenix-vwf-people-card" data-vwf-item><span class="section-kicker">People surface</span><h3>' + escapeHtml(item.title) + '</h3>' + emptyState(item.description, item.path ? item.path : "Capability") + (item.path ? '<a class="text-link" href="' + escapeHtml(item.path) + '" data-nav>باز کردن منبع ←</a>' : '') + '</article>').join("") +
    '</div>';
}

function renderCommerce(model: VerticalWorkflowCanvasModel): string {
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="Commerce views">' +
      '<button type="button" class="active" aria-selected="true" data-vwf-tab="all">همه</button>' +
      '<button type="button" aria-selected="false" data-vwf-tab="open">باز</button>' +
      '<button type="button" aria-selected="false" data-vwf-tab="action">نیازمند اقدام</button>' +
    '</div>' +
    viewState("همه") +
    '</div>' +
    '<div class="phoenix-vwf-commerce-grid">' +
      model.blueprint.blocks.map((item) => '<article class="phoenix-vwf-commerce-card" data-vwf-item><span class="section-kicker">Commerce surface</span><h3>' + escapeHtml(item.title) + '</h3>' + emptyState(item.description, item.path ?? "Commerce") + (item.path ? '<a class="text-link" href="' + escapeHtml(item.path) + '" data-nav>باز کردن منبع ←</a>' : '') + '</article>').join("") +
    '</div>' +
    '<div class="phoenix-vwf-status-rail"><span>Order</span><i></i><span>Billing</span><i></i><span>Fulfillment</span></div>';
}

function renderOperations(model: VerticalWorkflowCanvasModel): string {
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="Operations views">' +
      '<button type="button" class="active" aria-selected="true" data-vwf-tab="board">Board</button>' +
      '<button type="button" aria-selected="false" data-vwf-tab="list">List</button>' +
      '</div>' +
    viewState("Board") +
    '</div>' +
    '<div class="phoenix-vwf-kanban">' +
      model.blueprint.blocks.map((item, index) => '<article class="phoenix-vwf-kanban-column" data-vwf-item><div class="phoenix-vwf-kanban-title"><strong>' + escapeHtml(item.title) + '</strong><span class="pill">' + String(index + 1).padStart(2, "0") + '</span></div>' + emptyState(item.description, item.path ?? "Operations") + (item.path ? '<a class="text-link" href="' + escapeHtml(item.path) + '" data-nav>باز کردن منبع ←</a>' : '') + '</article>').join("") +
    '</div>';
}

function renderCommunication(model: VerticalWorkflowCanvasModel): string {
  return '<div class="phoenix-vwf-toolbar">' +
    '<div class="phoenix-vwf-tabs" role="tablist" aria-label="Communication views">' +
      '<button type="button" class="active" aria-selected="true" data-vwf-tab="inbox">Inbox</button>' +
      '<button type="button" aria-selected="false" data-vwf-tab="followup">Follow-up</button>' +
      '<button type="button" aria-selected="false" data-vwf-tab="compose">Compose</button>' +
    '</div>' +
    viewState("Inbox") +
    '</div>' +
    '<div class="phoenix-vwf-inbox">' +
      model.blueprint.blocks.map((item) => '<section data-vwf-item><span class="section-kicker">Communication surface</span><h3>' + escapeHtml(item.title) + '</h3>' + emptyState(item.description, item.path ?? "Communication") + (item.path ? '<a class="text-link" href="' + escapeHtml(item.path) + '" data-nav>باز کردن منبع ←</a>' : '') + '</section>').join("") +
    '</div>';
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

export function renderVerticalWorkflowCanvas(model: VerticalWorkflowCanvasModel): string {
  const copy = layoutCopy[model.blueprint.layout];
  return '<section class="glass-card phoenix-vwf-canvas" data-vwf-root data-vwf-layout="' + escapeHtml(model.blueprint.layout) + '" data-vwf-active-view="overview" data-vwf-business-id="' + escapeHtml(model.businessId ?? "") + '" data-vwf-vertical="' + escapeHtml(model.vertical) + '" data-vwf-module="' + escapeHtml(model.module) + '">' +
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
    const items = Array.from(canvas.querySelectorAll<HTMLElement>("[data-vwf-item]"));
    let emptyNode: HTMLElement | null = null;
    filter?.addEventListener("input", () => {
      const query = filter.value.trim().toLocaleLowerCase();
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
        const label = action === "today" ? "بازه «امروز» برای hydrate شدن آماده است." : "این action فعلاً فقط state رابط را تغییر می‌دهد و mutation دامنه‌ای انجام نمی‌دهد.";
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

    if (canvas.dataset.vwfLayout === "calendar") {
      const businessId = canvas.dataset.vwfBusinessId?.trim();
      if (businessId) void hydrateCalendarCanvas(canvas, businessId);
    }
  });
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
      lanes.innerHTML = emptyState("برای این Business هنوز schedule فعال/ثبت‌شده‌ای در Availability پیدا نشد.", "Booking");
      return;
    }
    const active = schedules.filter((item) => item.status === "active").slice(0, 4);
    if (!active.length) {
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
            (slots.length ? '<div class="phoenix-vwf-live-slots">' + slots.slice(0, 12).map((slot) => '<button type="button" class="phoenix-vwf-slot" data-vwf-slot-reference="' + escapeHtml(slot.slotReference) + '" title="' + escapeHtml(slot.status) + '"><span>' + escapeHtml(new Date(slot.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) + '</span><small>' + String(Math.max(slot.remainingCapacity, 0)) + ' ظرفیت</small></button>').join("") + '</div>' : emptyState("در این بازه slot قابل رزرو برنگشت.", "Availability")) +
          '</div></div>';
      } catch (error) {
        return '<div class="phoenix-vwf-calendar-lane" data-vwf-item><span>Resource ' + String(index + 1).padStart(2, "0") + '</span><div>' + emptyState(error instanceof Error ? error.message : "خواندن Slot ناموفق بود.", "Availability") + '</div></div>';
      }
    }));
    lanes.innerHTML = laneResults.join("");
  } catch (error) {
    lanes.innerHTML = emptyState(error instanceof Error ? error.message : "خواندن Availability ناموفق بود.", "Availability");
  }
}
