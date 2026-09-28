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

export function uiTabs(items: readonly { id: string; label: string; selected?: boolean }[], dataPrefix = "ds-tab"): string {
  return `<div class="ds-tabs" role="tablist" aria-label="Tabs">${items.map((item) => `<button class="ds-tab${item.selected ? " active" : ""}" id="${escapeUi(dataPrefix + "-" + item.id)}" type="button" role="tab" aria-selected="${item.selected ? "true" : "false"}">${escapeUi(item.label)}</button>`).join("")}</div>`;
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

// Every modal dialog in the shell gets Escape, focus trapping and focus restore.
// Guarded so the primitives stay importable in non-DOM environments (unit tests).
if (typeof document !== "undefined") installModalAccessibility(document);
