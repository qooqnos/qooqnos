import { describe, expect, it } from "vitest";
import { brandId } from "@qooqnos/core";
import type {
  AvailabilityContext,
  AvailabilityRuleRecord,
  ScheduleRecord,
} from "./availability-repository";
import { generateAvailabilitySlots } from "./slot-generator";

const schedule: ScheduleRecord = {
  id: brandId<"EntityId">("schedule-1"),
  businessId: brandId<"EntityId">("business-1"),
  locationId: null,
  resourceId: brandId<"EntityId">("resource-1"),
  timezone: "America/New_York",
  recurrenceDefinition: JSON.stringify({ version: 1, slotGranularityMinutes: 60 }),
  bookingHorizonMinutes: null,
  leadTimeMinutes: 0,
  bufferBeforeSeconds: 0,
  bufferAfterSeconds: 0,
  status: "active",
  version: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const rule = (weekdays: number[], start: string, end: string, capacity = 1): AvailabilityRuleRecord => ({
  id: brandId<"EntityId">("rule-1"),
  scheduleId: brandId<"EntityId">("schedule-1"),
  ruleType: "weekly_window",
  recurrencePayload: JSON.stringify({ version: 1, weekdays, start, end, capacity }),
  startConstraint: null,
  endConstraint: null,
  capacity,
  version: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

function availability(
  overrides: Partial<AvailabilityContext> = {},
): AvailabilityContext {
  return {
    schedule,
    generation: { version: 1, slotGranularityMinutes: 60 },
    rules: [rule([6, 7, 1], "09:00", "11:00")],
    exceptions: [],
    appointments: [],
    activeHoldSlotReferences: new Set(),
    resourceCapacity: 1,
    ...overrides,
  };
}

describe("generateAvailabilitySlots", () => {
  it("keeps local booking hours stable across a DST transition", () => {
    const slots = generateAvailabilitySlots(
      availability(),
      "2026-03-07T00:00:00.000Z",
      "2026-03-10T23:59:59.000Z",
      3600,
      "2026-03-06T00:00:00.000Z",
    );

    const starts = slots.map((slot) => slot.startsAt);
    expect(starts).toContain("2026-03-07T14:00:00.000Z");
    expect(starts).toContain("2026-03-08T13:00:00.000Z");
    expect(starts).toContain("2026-03-09T13:00:00.000Z");
  });

  it("blocks a slot covered by a closure exception", () => {
    const slots = generateAvailabilitySlots(
      availability({
        exceptions: [{
          id: brandId<"EntityId">("exception-1"),
          scheduleId: brandId<"EntityId">("schedule-1"),
          effectiveStart: "2026-03-07T14:30:00.000Z",
          effectiveEnd: "2026-03-07T15:30:00.000Z",
          exceptionType: "closure",
          capacity: 0,
          closureReason: "maintenance",
          version: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }],
      }),
      "2026-03-07T00:00:00.000Z",
      "2026-03-08T23:59:59.000Z",
      3600,
      "2026-03-06T00:00:00.000Z",
    );

    const slot = slots.find((candidate) => candidate.startsAt === "2026-03-07T14:00:00.000Z");
    expect(slot?.status).toBe("blocked");
    expect(slot?.remainingCapacity).toBe(0);
  });

  it("subtracts committed appointments and active holds from capacity", () => {
    const slotReference = [
      "schedule",
      "schedule-1",
      "resource",
      "resource-1",
      "start",
      "2026-03-07T14:00:00.000Z",
      "end",
      "2026-03-07T15:00:00.000Z",
    ].join(":");

    const slots = generateAvailabilitySlots(
      availability({
        rules: [rule([6], "09:00", "11:00", 3)],
        resourceCapacity: 3,
        appointments: [{
          id: brandId<"EntityId">("appointment-1"),
          startsAt: "2026-03-07T14:00:00.000Z",
          endsAt: "2026-03-07T15:00:00.000Z",
          quantity: 1,
        }],
        activeHoldSlotReferences: new Set([slotReference]),
      }),
      "2026-03-07T00:00:00.000Z",
      "2026-03-07T23:59:59.000Z",
      3600,
      "2026-03-06T00:00:00.000Z",
    );

    const slot = slots.find((candidate) => candidate.slotReference === slotReference);
    expect(slot?.capacity).toBe(3);
    expect(slot?.bookedQuantity).toBe(1);
    expect(slot?.heldQuantity).toBe(1);
    expect(slot?.remainingCapacity).toBe(1);
    expect(slot?.status).toBe("available");
  });

  it("rejects availability ranges wider than the bounded read window", () => {
    expect(() => generateAvailabilitySlots(
      availability(),
      "2026-01-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
      3600,
      "2025-12-01T00:00:00.000Z",
    )).toThrow("31 days");
  });
});
