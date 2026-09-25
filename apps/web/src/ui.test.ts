import { describe, expect, it } from "vitest";
import { uiButton, uiField, uiSelect, uiTabs, uiTable, uiDropdown, uiDialog, uiEmpty, uiSkeleton } from "./ui";

describe("Phoenix shared UI primitives", () => {
  it("renders accessible button/input/select/tab primitives", () => {
    expect(uiButton("Save", { variant: "primary", ariaLabel: "Save changes" })).toContain('aria-label="Save changes"');
    expect(uiField({ id: "name", label: "Name", placeholder: "Business name" })).toContain('for="name"');
    expect(uiSelect({ id: "status", label: "Status", items: [{ value: "active", label: "Active", selected: true }] })).toContain('selected');
    expect(uiTabs([{ id: "overview", label: "Overview", selected: true }])).toContain('role="tablist"');
  });

  it("renders data and feedback primitives", () => {
    expect(uiTable(["A", "B"], [["1", "2"]])).toContain("<th scope=\"col\">A</th>");
    expect(uiDropdown("menu", "More", ["One", "Two"])).toContain('role="menu"');
    expect(uiDialog("dialog", "Title", "<p>Body</p>")).toContain('aria-modal="true"');
    expect(uiEmpty("!", "Empty", "No items")).toContain("No items");
    expect(uiSkeleton(2)).toContain("skeleton line");
  });
});
