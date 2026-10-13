import { installModalAccessibility } from "./a11y.js";

export type UiButtonVariant = "primary" | "ghost" | "danger";

export function uiButton(label: string, options: {
  variant?: UiButtonVariant;
  type?: "button" | "submit";
  disabled?: boolean;
  data?: string;
  ariaLabel?: string;
} = {}): string {
  const variant = options.variant ?? "ghost";
  const type = options.type ?? "button";
  const disabled = options.disabled ? " disabled" : "";
  const data = options.data ? " " + options.data : "";
  const aria = options.ariaLabel ? ` aria-label="${escapeUi(options.ariaLabel)}"` : "";
  return `<button class="button button-${variant}" type="${type}"${disabled}${data}${aria}>${escapeUi(label)}</button>`;
}

export function uiField(options: {
  id: string;
  label: string;
  value?: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}): string {
  return `<label class="field-label" for="${escapeUi(options.id)}">${escapeUi(options.label)}<input id="${escapeUi(options.id)}" class="ds-field" type="${escapeUi(options.type ?? "text")}" value="${escapeUi(options.value ?? "")}" placeholder="${escapeUi(options.placeholder ?? "")}"${options.disabled ? " disabled" : ""} /></label>`;
}

export function uiSelect(options: {
  id: string;
  label: string;
  items: readonly { value: string; label: string; selected?: boolean }[];
}): string {
  return `<label class="field-label" for="${escapeUi(options.id)}">${escapeUi(options.label)}<select id="${escapeUi(options.id)}" class="ds-field ds-select">${options.items.map((item) => `<option value="${escapeUi(item.value)}"${item.selected ? " selected" : ""}>${escapeUi(item.label)}</option>`).join("")}</select></label>`;
}

export function uiTabs(
  items: readonly { id: string; label: string; selected?: boolean }[],
  dataPrefix = "ds-tab",
  ariaLabel = "زبانه‌ها",
): string {
  const selectedIndex = Math.max(0, items.findIndex((item) => item.selected));
  return `<div class="ds-tabs" role="tablist" aria-label="${escapeUi(ariaLabel)}">${items.map((item, index) => `<button class="ds-tab${item.selected ? " active" : ""}" id="${escapeUi(dataPrefix + "-" + item.id)}" type="button" role="tab" aria-selected="${item.selected ? "true" : "false"}" tabindex="${index === selectedIndex ? "0" : "-1"}">${escapeUi(item.label)}</button>`).join("")}</div>`;
}

/** Pure keyboard-navigation primitive shared by every Phoenix tablist. */
export function nextTabIndex(current: number, count: number, key: "ArrowRight" | "ArrowLeft" | "Home" | "End"): number {
  if (count <= 0) return -1;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  const safeCurrent = current < 0 || current >= count ? 0 : current;
  return key === "ArrowRight"
    ? (safeCurrent + 1) % count
    : (safeCurrent - 1 + count) % count;
}

/** Installs roving-focus keyboard behaviour for every Phoenix tablist. */
export function installTabAccessibility(doc: Document): void {
  const view = doc.defaultView;
  if (!view) return;
  const marker = doc as Document & { __phoenixTabsInstalled?: boolean };
  if (marker.__phoenixTabsInstalled) return;
  marker.__phoenixTabsInstalled = true;

  const sync = (tablist: HTMLElement): HTMLButtonElement[] => {
    const tabs = Array.from(tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'));
    if (!tabs.length) return tabs;
    const selected = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
    const focused = tabs.indexOf(doc.activeElement as HTMLButtonElement);
    const index = selected >= 0 ? selected : focused >= 0 ? focused : 0;
    tabs.forEach((tab, tabIndex) => { tab.tabIndex = tabIndex === index ? 0 : -1; });
    return tabs;
  };

  doc.addEventListener("click", (event) => {
    const target = event.target instanceof view.HTMLElement ? event.target : null;
    const tab = target?.closest<HTMLButtonElement>('[role="tab"]');
    const tablist = tab?.closest<HTMLElement>('[role="tablist"]');
    if (!tab || !tablist) return;
    tablist.querySelectorAll<HTMLElement>('[role="tab"]').forEach((candidate) => {
      candidate.tabIndex = candidate === tab ? 0 : -1;
    });
  });

  doc.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return;
    const target = doc.activeElement instanceof view.HTMLElement ? doc.activeElement : null;
    const tab = target?.matches('[role="tab"]') ? target as HTMLButtonElement : null;
    const tablist = tab?.closest<HTMLElement>('[role="tablist"]');
    if (!tab || !tablist) return;
    const tabs = sync(tablist);
    const next = nextTabIndex(tabs.indexOf(tab), tabs.length, event.key as "ArrowRight" | "ArrowLeft" | "Home" | "End");
    if (next < 0) return;
    event.preventDefault();
    tabs.forEach((candidate, index) => { candidate.tabIndex = index === next ? 0 : -1; });
    tabs[next]?.focus();
  });

  const observer = new view.MutationObserver(() => {
    doc.querySelectorAll<HTMLElement>('[role="tablist"]').forEach(sync);
  });
  if (doc.body) observer.observe(doc.body, { childList: true, subtree: true });
}

export function uiTable(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  return `<div class="ds-table-wrap"><table class="ds-table"><thead><tr>${headers.map((header) => `<th scope="col">${escapeUi(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeUi(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

export function uiDropdown(id: string, label: string, items: readonly string[]): string {
  return `<details class="ds-dropdown" data-dropdown="${escapeUi(id)}"><summary class="button button-ghost">${escapeUi(label)}⌄</summary><div class="ds-dropdown-menu" role="menu">${items.map((item) => `<button class="ds-dropdown-item" type="button" role="menuitem">${escapeUi(item)}</button>`).join("")}</div></details>`;
}

export function uiDialog(id: string, title: string, body: string): string {
  return `<section id="${escapeUi(id)}" class="ds-dialog glass-card" role="dialog" aria-modal="true" aria-labelledby="${escapeUi(id)}-title"><h2 id="${escapeUi(id)}-title">${escapeUi(title)}</h2><div>${body}</div></section>`;
}

export function uiEmpty(icon: string, title: string, description: string): string {
  return `<div class="slot-empty"><span>${escapeUi(icon)}</span><strong>${escapeUi(title)}</strong><p>${escapeUi(description)}</p></div>`;
}

export function uiSkeleton(lines = 3): string {
  return `<div class="ds-skeleton-stack">${Array.from({ length: Math.max(1, lines) }, (_, index) => `<div class="skeleton line ${index === lines - 1 ? "medium" : "long"}"></div>`).join("")}</div>`;
}

function escapeUi(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);
}

export function uiIconButton(label: string, options: { icon: string; data?: string; disabled?: boolean }): string {
  const disabled = options.disabled ? " disabled" : "";
  const data = options.data ? " " + options.data : "";
  return `<button class="button ds-button-icon" type="button" aria-label="${escapeUi(label)}"${disabled}${data}>${escapeUi(options.icon)}</button>`;
}

export function uiStatus(label: string, tone: "success" | "warning" | "danger" | "info" | "neutral" = "neutral"): string {
  return `<span class="ds-pill ds-status ds-status-${tone}">${escapeUi(label)}</span>`;
}

export function uiAlert(title: string, message: string, tone: "success" | "warning" | "danger" | "info" = "info"): string {
  const role = tone === "danger" || tone === "warning" ? "alert" : "status";
  return `<div class="ds-alert ds-alert-${tone}" role="${role}"><div><strong>${escapeUi(title)}</strong><p class="ds-caption">${escapeUi(message)}</p></div></div>`;
}

export function uiCard(content: string, options: { interactive?: boolean; padded?: boolean; className?: string } = {}): string {
  const classes = ["ds-card", options.interactive ? "ds-card-interactive" : "", options.padded === false ? "" : "ds-card-pad", options.className ?? ""].filter(Boolean).join(" ");
  return `<article class="${classes}">${content}</article>`;
}

export function uiBadge(label: string, tone: "neutral" | "info" | "warning" | "success" | "danger" = "neutral", icon = ""): string {
  const iconPart = icon ? `<span class="ds-badge-icon">${escapeUi(icon)}</span> ` : "";
  return `<span class="ds-badge ds-badge-${tone}">${iconPart}${escapeUi(label)}</span>`;
}

export function uiDrawer(id: string, title: string, body: string, options: { width?: string; closeLabel?: string } = {}): string {
  const close = options.closeLabel ?? "بستن";
  return `
    <div id="${escapeUi(id)}" class="ds-drawer-backdrop" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="${escapeUi(id)}-title">
      <div class="ds-drawer glass-card">
        <header class="ds-drawer-header">
          <h2 id="${escapeUi(id)}-title">${escapeUi(title)}</h2>
          <button class="button ds-button-icon" type="button" data-drawer-close="${escapeUi(id)}" aria-label="${escapeUi(close)}">✕</button>
        </header>
        <div class="ds-drawer-body">${body}</div>
      </div>
    </div>
  `;
}

export function openDrawer(title: string, bodyHtml: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let drawerEl = document.querySelector<HTMLElement>("#phoenix-global-drawer");
  if (!drawerEl) {
    const wrap = document.createElement("div");
    wrap.innerHTML = uiDrawer("phoenix-global-drawer", title, bodyHtml);
    drawerEl = wrap.firstElementChild as HTMLElement;
    document.body.appendChild(drawerEl);
  } else {
    const titleEl = drawerEl.querySelector<HTMLElement>("#phoenix-global-drawer-title");
    const bodyEl = drawerEl.querySelector<HTMLElement>(".ds-drawer-body");
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = bodyHtml;
  }

  drawerEl.classList.add("open");
  drawerEl.setAttribute("aria-hidden", "false");

  const closeBtn = drawerEl.querySelector<HTMLButtonElement>("[data-drawer-close]");
  if (closeBtn) {
    closeBtn.onclick = () => closeActiveDrawer();
  }

  drawerEl.onclick = (e) => {
    if (e.target === drawerEl) closeActiveDrawer();
  };

  return drawerEl;
}

export function closeActiveDrawer(): void {
  if (typeof document === "undefined") return;
  const drawerEl = document.querySelector<HTMLElement>(".ds-drawer-backdrop.open");
  if (drawerEl) {
    drawerEl.classList.remove("open");
    drawerEl.setAttribute("aria-hidden", "true");
  }
}

export function uiLoadingState(title = "در حال بارگذاری…", description = "لطفاً چند لحظه شکیبا باشید."): string {
  return `
    <div class="slot-loading ds-loading-box" role="status">
      <div class="ds-spinner"></div>
      <strong>${escapeUi(title)}</strong>
      <p class="ds-caption">${escapeUi(description)}</p>
    </div>
  `;
}

export function uiErrorState(title: string, message: string, retryLabel = "تلاش مجدد", retryActionAttr = "data-retry"): string {
  return `
    <div class="slot-empty ds-error-box" role="alert">
      <span class="ds-error-icon">⚠</span>
      <strong>${escapeUi(title)}</strong>
      <p class="ds-caption">${escapeUi(message)}</p>
      <button class="button button-ghost" type="button" ${retryActionAttr}>${escapeUi(retryLabel)}</button>
    </div>
  `;
}

export interface UiTimelineStep {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly icon?: string;
  readonly status: "completed" | "current" | "upcoming" | "exception";
  readonly timestamp?: string;
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
      <div class="ds-kpi-footer">
        ${options.subtitle ? `<span class="ds-kpi-sub">${escapeUi(options.subtitle)}</span>` : ""}
        ${trendHtml}
      </div>
    </article>
  `;
}

// Every modal dialog in the shell gets Escape, focus trapping and focus restore.
// Guarded so the primitives stay importable in non-DOM environments (unit tests).
if (typeof document !== "undefined") installModalAccessibility(document);
