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
  return `<div class="ds-dropdown" data-dropdown="${escapeUi(id)}"><button class="button button-ghost" type="button" aria-haspopup="menu" aria-expanded="false">${escapeUi(label)}⌄</button><div class="ds-dropdown-menu" role="menu">${items.map((item) => `<button class="ds-dropdown-item" type="button" role="menuitem">${escapeUi(item)}</button>`).join("")}</div></div>`;
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
