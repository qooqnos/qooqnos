import { DatabaseError } from "@qooqnos/database";

export type AutomationMisfirePolicy = "skip" | "catch_up_once" | "catch_up_all";

export interface AutomationSchedulePlan {
  readonly dueOccurrences: readonly string[];
  readonly nextRunAt: string | null;
}

export function parseAutomationRecurrenceMs(value: string): number {
  const normalized = value.trim();
  const match = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(normalized);
  if (!match) throw new DatabaseError("Automation recurrence must be an ISO-8601 duration");
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  const milliseconds = (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    throw new DatabaseError("Automation recurrence must be greater than zero");
  }
  return milliseconds;
}

export function nextAutomationOccurrence(
  recurrence: string,
  occurrence: string,
): string {
  const step = parseAutomationRecurrenceMs(recurrence);
  const timestamp = Date.parse(occurrence);
  if (Number.isNaN(timestamp)) throw new DatabaseError("Automation occurrence timestamp is invalid");
  return new Date(timestamp + step).toISOString();
}

export function planAutomationSchedule(
  recurrence: string,
  nextRunAt: string,
  now: string,
  misfirePolicy: AutomationMisfirePolicy,
  endAt: string | null,
  maxCatchUp = 100,
): AutomationSchedulePlan {
  const nowMs = Date.parse(now);
  let occurrence = Date.parse(nextRunAt);
  if (Number.isNaN(nowMs) || Number.isNaN(occurrence)) {
    throw new DatabaseError("Automation schedule timestamps are invalid");
  }
  if (occurrence > nowMs) {
    return { dueOccurrences: [], nextRunAt };
  }

  const occurrences: string[] = [];

  if (misfirePolicy === "skip") {
    while (occurrence <= nowMs) {
      occurrence += parseAutomationRecurrenceMs(recurrence);
    }
    const next = new Date(occurrence).toISOString();
    return { dueOccurrences: [], nextRunAt: isAfterEnd(next, endAt) ? null : next };
  }

  if (misfirePolicy === "catch_up_once") {
    occurrences.push(new Date(occurrence).toISOString());
    while (occurrence <= nowMs) {
      occurrence += parseAutomationRecurrenceMs(recurrence);
    }
    const next = new Date(occurrence).toISOString();
    return { dueOccurrences: occurrences, nextRunAt: isAfterEnd(next, endAt) ? null : next };
  }

  let iterations = 0;
  while (occurrence <= nowMs && iterations < maxCatchUp) {
    occurrences.push(new Date(occurrence).toISOString());
    occurrence += parseAutomationRecurrenceMs(recurrence);
    iterations += 1;
  }
  if (occurrence <= nowMs) {
    throw new DatabaseError("Automation schedule exceeded the maximum catch-up window");
  }
  const next = new Date(occurrence).toISOString();
  return { dueOccurrences: occurrences, nextRunAt: isAfterEnd(next, endAt) ? null : next };
}

function isAfterEnd(nextRunAt: string, endAt: string | null): boolean {
  return endAt !== null && Date.parse(nextRunAt) > Date.parse(endAt);
}
