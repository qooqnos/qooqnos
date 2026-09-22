import { DatabaseError } from "@qooqnos/database";
import type {
  AvailabilityContext,
  AvailabilityRuleRecord,
  ScheduleRecord,
} from "./availability-repository";

export type AvailabilitySlotStatus = "available" | "held" | "booked" | "blocked" | "expired" | "unknown";

export interface AvailabilitySlot {
  readonly scheduleId: ScheduleRecord["id"];
  readonly resourceId: ScheduleRecord["resourceId"];
  readonly slotReference: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timezone: string;
  readonly capacity: number;
  readonly bookedQuantity: number;
  readonly heldQuantity: number;
  readonly remainingCapacity: number;
  readonly status: AvailabilitySlotStatus;
}

interface ParsedRule {
  readonly weekdays: readonly number[];
  readonly start: string;
  readonly end: string;
  readonly capacity?: number | undefined;
  readonly startConstraint?: string | null;
  readonly endConstraint?: string | null;
}

export function generateAvailabilitySlots(
  context: AvailabilityContext,
  from: string,
  to: string,
  durationSeconds: number,
  now: string,
): readonly AvailabilitySlot[] {
  assertIsoInstant(from);
  assertIsoInstant(to);
  assertIsoInstant(now);
  if (from >= to) throw new DatabaseError("Availability range must end after it starts");
  if (!Number.isSafeInteger(durationSeconds) || durationSeconds <= 0) {
    throw new DatabaseError("Availability duration must be a positive integer");
  }

  const requestedFrom = new Date(from);
  const requestedTo = new Date(to);
  if (requestedTo.getTime() - requestedFrom.getTime() > 31 * 24 * 60 * 60 * 1000) {
    throw new DatabaseError("Availability range cannot exceed 31 days");
  }

  const earliest = new Date(
    Math.max(
      requestedFrom.getTime(),
      new Date(now).getTime() + (context.schedule.leadTimeMinutes ?? 0) * 60_000,
    ),
  );
  const latest = new Date(
    Math.min(
      requestedTo.getTime(),
      context.schedule.bookingHorizonMinutes === null
        ? requestedTo.getTime()
        : new Date(now).getTime() + context.schedule.bookingHorizonMinutes * 60_000,
    ),
  );
  if (earliest >= latest) return [];

  const rules = context.rules
    .filter((rule) => rule.ruleType === "weekly_window")
    .map(parseRule);
  const unsupportedRule = context.rules.find((rule) => rule.ruleType !== "weekly_window");
  if (unsupportedRule) throw new DatabaseError("Unsupported availability rule type: " + unsupportedRule.ruleType);

  if (rules.length === 0) return [];

  const localStart = getLocalDateKey(earliest, context.schedule.timezone);
  const localEnd = getLocalDateKey(latest, context.schedule.timezone);
  const output = new Map<string, AvailabilitySlot>();

  for (const dateKey of dateKeys(localStart, localEnd)) {
    const weekday = isoWeekday(dateKey);

    for (const rule of rules) {
      if (!rule.weekdays.includes(weekday)) continue;

      const windowStart = zonedDateTimeToUtc(dateKey, rule.start, context.schedule.timezone);
      const windowEnd = zonedDateTimeToUtc(dateKey, rule.end, context.schedule.timezone);
      const stepMs = context.generation.slotGranularityMinutes * 60_000;
      const durationMs = durationSeconds * 1000;
      const bufferBeforeMs = (context.schedule.bufferBeforeSeconds ?? 0) * 1000;
      const bufferAfterMs = (context.schedule.bufferAfterSeconds ?? 0) * 1000;
      const firstStart = Math.max(windowStart.getTime() + bufferBeforeMs, earliest.getTime());
      const lastStart = Math.min(
        windowEnd.getTime() - durationMs - bufferAfterMs,
        latest.getTime() - durationMs,
      );

      for (let startMs = alignUp(firstStart, stepMs); startMs <= lastStart; startMs += stepMs) {
        const endMs = startMs + durationMs;
        const slotStart = new Date(startMs);
        const slotEnd = new Date(endMs);
        if (slotStart < earliest || slotEnd > latest) continue;

        const slotReference = buildSlotReference(
          context.schedule.id,
          context.schedule.resourceId,
          slotStart.toISOString(),
          slotEnd.toISOString(),
        );
        if (!passesConstraint(rule.startConstraint, slotStart) || !passesEndConstraint(rule.endConstraint, slotEnd)) {
          continue;
        }

        const exceptionCapacity = getExceptionCapacity(context, slotStart, slotEnd);
        if (exceptionCapacity === 0) {
          output.set(slotReference, makeSlot(
            context.schedule,
            slotReference,
            slotStart,
            slotEnd,
            0,
            0,
            0,
            "blocked",
          ));
          continue;
        }

        const baseCapacity = rule.capacity ?? context.resourceCapacity ?? 1;
        const capacity = Math.max(0, Math.min(baseCapacity, exceptionCapacity ?? baseCapacity));
        const bookedQuantity = context.appointments.reduce(
          (total, appointment) =>
            overlaps(
              slotStart.toISOString(),
              slotEnd.toISOString(),
              appointment.startsAt,
              appointment.endsAt,
            )
              ? total + appointment.quantity
              : total,
          0,
        );
        const heldQuantity = context.activeHoldSlotReferences.has(slotReference) ? 1 : 0;
        const remainingCapacity = Math.max(0, capacity - bookedQuantity - heldQuantity);

        const status: AvailabilitySlotStatus =
          capacity === 0
            ? "blocked"
            : bookedQuantity >= capacity
              ? "booked"
              : heldQuantity >= capacity
                ? "held"
                : remainingCapacity > 0
                  ? "available"
                  : "booked";

        const candidate = makeSlot(
          context.schedule,
          slotReference,
          slotStart,
          slotEnd,
          capacity,
          bookedQuantity,
          heldQuantity,
          status,
        );

        const previous = output.get(slotReference);
        output.set(
          slotReference,
          previous
            ? mergeSlots(previous, candidate)
            : candidate,
        );
      }
    }
  }

  return [...output.values()]
    .filter((slot) => slot.endsAt > earliest.toISOString() && slot.startsAt < latest.toISOString())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.slotReference.localeCompare(b.slotReference));
}

function parseRule(rule: AvailabilityRuleRecord): ParsedRule {
  try {
    const parsed = JSON.parse(rule.recurrencePayload) as {
      readonly version?: number;
      readonly weekdays?: unknown;
      readonly start?: unknown;
      readonly end?: unknown;
      readonly capacity?: unknown;
    };
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.weekdays) ||
      !parsed.weekdays.every((day) => Number.isSafeInteger(day) && day >= 1 && day <= 7) ||
      typeof parsed.start !== "string" ||
      typeof parsed.end !== "string" ||
      !TIME_RE.test(parsed.start) ||
      !TIME_RE.test(parsed.end) ||
      parsed.end <= parsed.start
    ) {
      throw new Error("invalid rule");
    }
    if (parsed.capacity !== undefined && (!Number.isSafeInteger(parsed.capacity) || (parsed.capacity as number) <= 0)) {
      throw new Error("invalid capacity");
    }
    return {
      weekdays: [...new Set(parsed.weekdays as number[])],
      start: parsed.start,
      end: parsed.end,
      ...(parsed.capacity !== undefined ? { capacity: parsed.capacity as number } : {}),
      startConstraint: rule.startConstraint,
      endConstraint: rule.endConstraint,
    };
  } catch {
    throw new DatabaseError("Availability rule recurrence payload is invalid");
  }
}

function makeSlot(
  schedule: ScheduleRecord,
  slotReference: string,
  startsAt: Date,
  endsAt: Date,
  capacity: number,
  bookedQuantity: number,
  heldQuantity: number,
  status: AvailabilitySlotStatus,
): AvailabilitySlot {
  return {
    scheduleId: schedule.id,
    resourceId: schedule.resourceId,
    slotReference,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    timezone: schedule.timezone,
    capacity,
    bookedQuantity,
    heldQuantity,
    remainingCapacity: Math.max(0, capacity - bookedQuantity - heldQuantity),
    status,
  };
}

function mergeSlots(a: AvailabilitySlot, b: AvailabilitySlot): AvailabilitySlot {
  const capacity = Math.min(a.capacity || Number.MAX_SAFE_INTEGER, b.capacity || Number.MAX_SAFE_INTEGER);
  const bookedQuantity = Math.max(a.bookedQuantity, b.bookedQuantity);
  const heldQuantity = Math.max(a.heldQuantity, b.heldQuantity);
  const remainingCapacity = Math.max(0, capacity - bookedQuantity - heldQuantity);
  return {
    ...a,
    capacity,
    bookedQuantity,
    heldQuantity,
    remainingCapacity,
    status:
      capacity === 0
        ? "blocked"
        : bookedQuantity >= capacity
          ? "booked"
          : heldQuantity >= capacity
            ? "held"
            : "available",
  };
}

function getExceptionCapacity(
  context: AvailabilityContext,
  slotStart: Date,
  slotEnd: Date,
): number | null {
  let capacity: number | null = null;
  for (const exception of context.exceptions) {
    if (!overlaps(slotStart.toISOString(), slotEnd.toISOString(), exception.effectiveStart, exception.effectiveEnd)) {
      continue;
    }
    if (exception.exceptionType === "closure") return 0;
    if (exception.exceptionType === "capacity_override") {
      if (exception.capacity === null) return 0;
      capacity = capacity === null ? exception.capacity : Math.min(capacity, exception.capacity);
    }
  }
  return capacity;
}

function passesConstraint(value: string | null, instant: Date): boolean {
  if (!value) return true;
  assertIsoInstant(value);
  return instant.getTime() >= new Date(value).getTime();
}

function passesEndConstraint(value: string | null, instant: Date): boolean {
  if (!value) return true;
  assertIsoInstant(value);
  return instant.getTime() <= new Date(value).getTime();
}

function overlaps(
  startsAt: string,
  endsAt: string,
  otherStartsAt: string,
  otherEndsAt: string,
): boolean {
  return startsAt < otherEndsAt && endsAt > otherStartsAt;
}

function buildSlotReference(
  scheduleId: string,
  resourceId: string | null,
  startsAt: string,
  endsAt: string,
): string {
  return [
    "schedule",
    scheduleId,
    "resource",
    resourceId ?? "any",
    "start",
    startsAt,
    "end",
    endsAt,
  ].join(":");
}

function alignUp(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function assertIsoInstant(value: string): void {
  if (!value || Number.isNaN(Date.parse(value)) || !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
    throw new DatabaseError("Availability timestamps must be ISO instants");
  }
}

function getLocalDateKey(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  return valueOf(parts, "year") + "-" + valueOf(parts, "month") + "-" + valueOf(parts, "day");
}

function zonedDateTimeToUtc(dateKey: string, time: string, timezone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  let candidate = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i += 1) {
    const offset = timezoneOffsetMinutes(new Date(candidate), timezone);
    candidate = Date.UTC(year, month - 1, day, hour, minute, 0) - offset * 60_000;
  }
  return new Date(candidate);
}

function timezoneOffsetMinutes(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const asUtc = Date.UTC(
    Number(valueOf(parts, "year")),
    Number(valueOf(parts, "month")) - 1,
    Number(valueOf(parts, "day")),
    Number(valueOf(parts, "hour")),
    Number(valueOf(parts, "minute")),
    Number(valueOf(parts, "second")),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

function isoWeekday(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dayOfWeek === 0 ? 7 : dayOfWeek;
}

function dateKeys(start: string, end: string): readonly string[] {
  const keys: string[] = [];
  let current = start;
  while (current <= end) {
    keys.push(current);
    current = addLocalDay(current);
  }
  return keys;
}

function addLocalDay(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

function valueOf(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const part = parts.find((entry) => entry.type === type);
  if (!part) throw new DatabaseError("Timezone conversion failed");
  return part.value;
}

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
