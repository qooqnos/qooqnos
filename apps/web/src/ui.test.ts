import { describe, expect, it } from "vitest";
import { uiButton, uiField, uiSelect, uiTabs, uiTable, uiDropdown, uiDialog, uiEmpty, uiSkeleton, uiAlert, nextTabIndex } from "./ui";

describe("Phoenix shared UI primitives", () => {
  it("renders accessible button/input/select/tab primitives", () => {
    expect(uiButton("Save", { variant: "primary", ariaLabel: "Save changes" })).toContain('aria-label="Save changes"');
    expect(uiField({ id: "name", label: "Name", placeholder: "Business name" })).toContain('for="name"');
    expect(uiSelect({ id: "status", label: "Status", items: [{ value: "active", label: "Active", selected: true }] })).toContain('selected');
    expect(uiTabs([{ id: "overview", label: "Overview", selected: true }])).toContain('role="tablist"');
  });

  it("keeps shared tabs keyboard-navigable with roving focus", () => {
    expect(uiTabs([{ id: "one", label: "One", selected: true }, { id: "two", label: "Two" }], "test-tab", "Views")).toContain('aria-label="Views"');
    expect(uiTabs([{ id: "one", label: "One", selected: true }, { id: "two", label: "Two" }])).toContain('tabindex="0"');
    expect(nextTabIndex(0, 3, "ArrowRight")).toBe(1);
    expect(nextTabIndex(0, 3, "ArrowLeft")).toBe(2);
    expect(nextTabIndex(1, 3, "Home")).toBe(0);
    expect(nextTabIndex(1, 3, "End")).toBe(2);
    expect(nextTabIndex(0, 0, "ArrowRight")).toBe(-1);
  });

  it("renders data and feedback primitives", () => {
    expect(uiTable(["A", "B"], [["1", "2"]])).toContain("<th scope=\"col\">A</th>");
    expect(uiDropdown("menu", "More", ["One", "Two"])).toContain('role="menu"');
    expect(uiDialog("dialog", "Title", "<p>Body</p>")).toContain('aria-modal="true"');
    expect(uiEmpty("!", "Empty", "No items")).toContain("No items");
    expect(uiSkeleton(2)).toContain("skeleton line");
  });

  it("announces urgent alerts assertively and informational ones politely", () => {
    expect(uiAlert("Failed", "Try again", "danger")).toContain('role="alert"');
    expect(uiAlert("Heads up", "Check input", "warning")).toContain('role="alert"');
    expect(uiAlert("Saved", "Done", "success")).toContain('role="status"');
  });
});
