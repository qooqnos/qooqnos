import { describe, expect, it, vi } from "vitest";
import {
  closeTopmostDialog,
  dialogCloseControl,
  ensureDialogLabel,
  nextFocusIndex,
  topmostDialog,
} from "./a11y";

function fakeElement(overrides: Record<string, unknown> = {}): HTMLElement {
  return {
    click: vi.fn(),
    querySelector: () => null,
    parentElement: null,
    ...overrides,
  } as unknown as HTMLElement;
}

describe("modal focus trap", () => {
  it("wraps forward and backward inside the dialog", () => {
    expect(nextFocusIndex(2, 3, false)).toBe(0);
    expect(nextFocusIndex(0, 3, true)).toBe(2);
    expect(nextFocusIndex(0, 3, false)).toBe(1);
    expect(nextFocusIndex(2, 3, true)).toBe(1);
  });

  it("pulls focus in from outside the dialog and handles empty dialogs", () => {
    expect(nextFocusIndex(-1, 3, false)).toBe(0);
    expect(nextFocusIndex(-1, 3, true)).toBe(2);
    expect(nextFocusIndex(0, 0, false)).toBe(-1);
  });
});

describe("dialog closing", () => {
  it("selects the last rendered dialog as topmost", () => {
    const first = fakeElement();
    const second = fakeElement();
    const root = {
      querySelectorAll: () => [first, second],
    } as unknown as ParentNode;
    expect(topmostDialog(root)).toBe(second);
    expect(
      topmostDialog({ querySelectorAll: () => [] } as unknown as ParentNode)
    ).toBeNull();
  });

  it("closes through the dialog's own close control so feature cleanup still runs", () => {
    const close = fakeElement();
    const dialog = fakeElement({ querySelector: () => close });
    const root = { querySelectorAll: () => [dialog] } as unknown as ParentNode;
    expect(closeTopmostDialog(root)).toBe(true);
    expect(close.click).toHaveBeenCalledOnce();
  });

  it("falls back to the backdrop and reports false when nothing can close it", () => {
    const backdrop = fakeElement();
    const withBackdrop = fakeElement({
      parentElement: { querySelector: () => backdrop },
    });
    expect(dialogCloseControl(withBackdrop)).toBe(backdrop);
    const stuck = fakeElement();
    expect(
      closeTopmostDialog({
        querySelectorAll: () => [stuck],
      } as unknown as ParentNode)
    ).toBe(false);
  });
});

describe("dialog naming", () => {
  it("names an unlabelled dialog from its heading and leaves labelled ones alone", () => {
    const attributes = new Map<string, string>();
    const heading = { id: "" } as unknown as HTMLElement;
    const dialog = fakeElement({
      hasAttribute: (name: string) => attributes.has(name),
      setAttribute: (name: string, value: string) =>
        attributes.set(name, value),
      querySelector: () => heading,
    });
    ensureDialogLabel(dialog);
    expect(heading.id).toMatch(/^phoenix-dialog-title-\d+$/);
    expect(attributes.get("aria-labelledby")).toBe(heading.id);

    const labelled = fakeElement({
      hasAttribute: (name: string) => name === "aria-label",
      setAttribute: vi.fn(),
    });
    ensureDialogLabel(labelled);
    expect(labelled.setAttribute).not.toHaveBeenCalled();
  });
});
