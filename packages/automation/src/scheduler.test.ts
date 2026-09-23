import { describe, expect, it } from "vitest";
import {
  nextAutomationOccurrence,
  parseAutomationRecurrenceMs,
  planAutomationSchedule,
} from "./scheduler";

describe("Automation scheduler", () => {
  it("parses ISO-8601 duration recurrence deterministically", () => {
    expect(parseAutomationRecurrenceMs("PT15M")).toBe(15 * 60 * 1000);
    expect(parseAutomationRecurrenceMs("P1DT2H")).toBe(26 * 60 * 60 * 1000);
    expect(nextAutomationOccurrence("PT1H", "2026-09-23T00:00:00.000Z")).toBe("2026-09-23T01:00:00.000Z");
  });

  it("skips missed occurrences when policy is skip", () => {
    expect(planAutomationSchedule(
      "PT1H",
      "2026-09-23T00:00:00.000Z",
      "2026-09-23T03:10:00.000Z",
      "skip",
      null,
    )).toEqual({
      dueOccurrences: [],
      nextRunAt: "2026-09-23T04:00:00.000Z",
    });
  });

  it("fires one occurrence when policy is catch_up_once", () => {
    expect(planAutomationSchedule(
      "PT1H",
      "2026-09-23T00:00:00.000Z",
      "2026-09-23T03:10:00.000Z",
      "catch_up_once",
      null,
    )).toEqual({
      dueOccurrences: ["2026-09-23T00:00:00.000Z"],
      nextRunAt: "2026-09-23T04:00:00.000Z",
    });
  });

  it("replays bounded missed occurrences when policy is catch_up_all", () => {
    expect(planAutomationSchedule(
      "PT1H",
      "2026-09-23T00:00:00.000Z",
      "2026-09-23T03:10:00.000Z",
      "catch_up_all",
      null,
    )).toEqual({
      dueOccurrences: [
        "2026-09-23T00:00:00.000Z",
        "2026-09-23T01:00:00.000Z",
        "2026-09-23T02:00:00.000Z",
        "2026-09-23T03:00:00.000Z",
      ],
      nextRunAt: "2026-09-23T04:00:00.000Z",
    });
  });

  it("stops at the schedule end boundary", () => {
    expect(planAutomationSchedule(
      "PT1H",
      "2026-09-23T02:00:00.000Z",
      "2026-09-23T03:10:00.000Z",
      "catch_up_all",
      "2026-09-23T03:00:00.000Z",
    )).toEqual({
      dueOccurrences: [
        "2026-09-23T02:00:00.000Z",
        "2026-09-23T03:00:00.000Z",
      ],
      nextRunAt: null,
    });
  });
});
