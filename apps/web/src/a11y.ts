/**
 * Shared modal accessibility for the Phoenix web shell.
 *
 * The shell renders many hand-built dialogs (`role="dialog" aria-modal="true"`).
 * The Master UI Contract (section 39) requires keyboard navigation and visible,
 * managed focus. This module provides that behaviour once, for every dialog:
 *
 * - Escape closes the topmost dialog through its existing close control, so the
 *   owning feature's own cleanup handler still runs.
 * - Tab / Shift+Tab stay inside the topmost dialog.
 * - Focus moves into a dialog when it opens and returns to the element that
 *   opened it when it closes.
 * - A dialog without an accessible name is named from its first heading.
 *
 * It is presentation-only: it never grants, denies or persists anything.
 */

export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const DIALOG_SELECTOR = '[role="dialog"][aria-modal="true"]';
const CLOSE_CONTROL_SELECTOR = ".connection-close, [data-close-command]";
const BACKDROP_SELECTOR = ".connection-backdrop, .command-backdrop";

/** Index of the element that should receive focus next while trapping Tab. */
export function nextFocusIndex(
  current: number,
  count: number,
  backwards: boolean
): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return backwards ? count - 1 : 0;
  if (backwards) return current === 0 ? count - 1 : current - 1;
  return current === count - 1 ? 0 : current + 1;
}

/** The most recently rendered modal dialog, which is the one on top. */
export function topmostDialog(root: ParentNode): HTMLElement | null {
  const dialogs = Array.from(
    root.querySelectorAll<HTMLElement>(DIALOG_SELECTOR)
  );
  return dialogs.length > 0 ? (dialogs[dialogs.length - 1] ?? null) : null;
}

/** The control that already closes this dialog, or its backdrop as a fallback. */
export function dialogCloseControl(dialog: HTMLElement): HTMLElement | null {
  const own = dialog.querySelector<HTMLElement>(CLOSE_CONTROL_SELECTOR);
  if (own) return own;
  return (
    dialog.parentElement?.querySelector<HTMLElement>(BACKDROP_SELECTOR) ?? null
  );
}

/** Closes the topmost dialog via its own close control. Returns whether it did. */
export function closeTopmostDialog(root: ParentNode): boolean {
  const dialog = topmostDialog(root);
  const control = dialog ? dialogCloseControl(dialog) : null;
  if (!control) return false;
  control.click();
  return true;
}

let labelCounter = 0;

/** Names an unlabelled dialog from its first heading. */
export function ensureDialogLabel(dialog: HTMLElement): void {
  if (
    dialog.hasAttribute("aria-label") ||
    dialog.hasAttribute("aria-labelledby")
  )
    return;
  const heading = dialog.querySelector<HTMLElement>("h1, h2, h3");
  if (!heading) return;
  if (!heading.id) {
    labelCounter += 1;
    heading.id = "phoenix-dialog-title-" + labelCounter;
  }
  dialog.setAttribute("aria-labelledby", heading.id);
}

function focusableWithin(dialog: HTMLElement): HTMLElement[] {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter(
    (element) =>
      !element.hasAttribute("hidden") && element.getClientRects().length > 0
  );
}

let installed = false;

/** Installs the behaviour once for the whole document. Safe to call repeatedly. */
export function installModalAccessibility(doc: Document): void {
  if (installed) return;
  const view = doc.defaultView;
  if (!view) return;
  installed = true;

  let lastFocusOutsideDialog: HTMLElement | null = null;
  const open: { dialog: HTMLElement; opener: HTMLElement | null }[] = [];

  doc.addEventListener("focusin", (event) => {
    const target = event.target;
    if (
      target instanceof view.HTMLElement &&
      !target.closest('[role="dialog"]')
    ) {
      lastFocusOutsideDialog = target;
    }
  });

  doc.addEventListener(
    "keydown",
    (event) => {
      const dialog = topmostDialog(doc);
      if (!dialog) return;
      if (event.key === "Escape") {
        if (closeTopmostDialog(doc)) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusableWithin(dialog);
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const active =
        doc.activeElement instanceof view.HTMLElement
          ? doc.activeElement
          : null;
      const inside = active !== null && dialog.contains(active);
      const current = inside && active ? items.indexOf(active) : -1;
      const atEdge = event.shiftKey
        ? current <= 0
        : current === items.length - 1;
      if (!inside || atEdge) {
        event.preventDefault();
        items[
          nextFocusIndex(inside ? current : -1, items.length, event.shiftKey)
        ]?.focus();
      }
    },
    true
  );

  const sync = (): void => {
    for (let index = open.length - 1; index >= 0; index -= 1) {
      const entry = open[index];
      if (!entry || entry.dialog.isConnected) continue;
      open.splice(index, 1);
      const nothingFocused =
        !doc.activeElement || doc.activeElement === doc.body;
      if (nothingFocused && entry.opener?.isConnected) entry.opener.focus();
    }
    for (const dialog of Array.from(
      doc.querySelectorAll<HTMLElement>(DIALOG_SELECTOR)
    )) {
      if (open.some((entry) => entry.dialog === dialog)) continue;
      ensureDialogLabel(dialog);
      if (!dialog.hasAttribute("tabindex"))
        dialog.setAttribute("tabindex", "-1");
      open.push({ dialog, opener: lastFocusOutsideDialog });
      if (!dialog.contains(doc.activeElement))
        (focusableWithin(dialog)[0] ?? dialog).focus();
    }
  };

  const observer = new view.MutationObserver(sync);
  const start = (): void => {
    observer.observe(doc.body, { childList: true, subtree: true });
    sync();
  };
  if (doc.body) start();
  else doc.addEventListener("DOMContentLoaded", start, { once: true });
}
