import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export interface ScheduleRecord {
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly locationId: EntityId | null;
  readonly resourceId: EntityId | null;
  readonly timezone: string;
  readonly recurrenceDefinition: string;
  readonly bookingHorizonMinutes: number | null;
  readonly leadTimeMinutes: number | null;
  readonly bufferBeforeSeconds: number | null;
  readonly bufferAfterSeconds: number | null;
  readonly status: "active" | "inactive" | "archived";
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AvailabilityRuleRecord {
  readonly id: EntityId;
  readonly scheduleId: EntityId;
  readonly ruleType: string;
  readonly recurrencePayload: string;
  readonly startConstraint: string | null;
  readonly endConstraint: string | null;
  readonly capacity: number | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AvailabilityExceptionRecord {
  readonly id: EntityId;
  readonly scheduleId: EntityId;
  readonly effectiveStart: string;
  readonly effectiveEnd: string;
  readonly exceptionType: string;
  readonly capacity: number | null;
  readonly closureReason: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}


export interface AvailabilityRuleDefinition {
  readonly version: 1;
  readonly weekdays: readonly number[];
  readonly start: string;
  readonly end: string;
  readonly capacity?: number | undefined;
}

export interface ScheduleGenerationDefinition {
  readonly version: 1;
  readonly slotGranularityMinutes: number;
}

export interface AvailabilityAppointmentCommitment {
  readonly id: EntityId;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly quantity: number;
}

export interface AvailabilityContext {
  readonly schedule: ScheduleRecord;
  readonly generation: ScheduleGenerationDefinition;
  readonly rules: readonly AvailabilityRuleRecord[];
  readonly exceptions: readonly AvailabilityExceptionRecord[];
  readonly appointments: readonly AvailabilityAppointmentCommitment[];
  readonly activeHoldSlotReferences: ReadonlySet<string>;
  readonly resourceCapacity: number | null;
}

export interface CreateScheduleInput {
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly locationId?: EntityId | undefined;
  readonly resourceId?: EntityId | undefined;
  readonly timezone: string;
  readonly recurrenceDefinition: string;
  readonly bookingHorizonMinutes?: number | undefined;
  readonly leadTimeMinutes?: number | undefined;
  readonly bufferBeforeSeconds?: number | undefined;
  readonly bufferAfterSeconds?: number | undefined;
  readonly now: string;
}

export interface CreateAvailabilityRuleInput {
  readonly id: EntityId;
  readonly scheduleId: EntityId;
  readonly ruleType: string;
  readonly recurrencePayload: string;
  readonly startConstraint?: string | undefined;
  readonly endConstraint?: string | undefined;
  readonly capacity?: number | undefined;
  readonly now: string;
}

export interface CreateAvailabilityExceptionInput {
  readonly id: EntityId;
  readonly scheduleId: EntityId;
  readonly effectiveStart: string;
  readonly effectiveEnd: string;
  readonly exceptionType: string;
  readonly capacity?: number | undefined;
  readonly closureReason?: string | undefined;
  readonly now: string;
}

export class AvailabilityRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async getSchedule(context: RequestContext, id: EntityId): Promise<ScheduleRecord | null> {
    return this.database.first<ScheduleRecord>(
      "SELECT s.id, s.business_id AS businessId, s.location_id AS locationId, s.resource_id AS resourceId, s.timezone, s.recurrence_definition AS recurrenceDefinition, s.booking_horizon_minutes AS bookingHorizonMinutes, s.lead_time_minutes AS leadTimeMinutes, s.buffer_before_seconds AS bufferBeforeSeconds, s.buffer_after_seconds AS bufferAfterSeconds, s.status, s.version, s.created_at AS createdAt, s.updated_at AS updatedAt FROM schedules s INNER JOIN businesses b ON b.id = s.business_id WHERE s.id = ? AND b.organization_id = ? AND b.workspace_id = ? LIMIT 1",
      id,
      this.requireOrganization({ organizationId: context.tenantId }),
      this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
  }


  async getAvailabilityContext(
    context: RequestContext,
    scheduleId: EntityId,
    from: string,
    to: string,
    resourceId?: EntityId,
  ): Promise<AvailabilityContext> {
    const schedule = await this.getSchedule(context, scheduleId);
    if (!schedule) throw new DatabaseError("Schedule not found");
    if (schedule.status !== "active") throw new DatabaseError("Schedule is not active");
    if (from >= to) throw new DatabaseError("Availability range must end after it starts");

    const generation = parseGenerationDefinition(schedule.recurrenceDefinition);
    const rules = await this.database.all<AvailabilityRuleRecord>(
      "SELECT id, schedule_id AS scheduleId, rule_type AS ruleType, recurrence_payload AS recurrencePayload, start_constraint AS startConstraint, end_constraint AS endConstraint, capacity, version, created_at AS createdAt, updated_at AS updatedAt FROM availability_rules WHERE schedule_id = ? ORDER BY version DESC, id ASC",
      scheduleId,
    );
    const exceptions = await this.database.all<AvailabilityExceptionRecord>(
      "SELECT id, schedule_id AS scheduleId, effective_start AS effectiveStart, effective_end AS effectiveEnd, exception_type AS exceptionType, capacity, closure_reason AS closureReason, version, created_at AS createdAt, updated_at AS updatedAt FROM availability_exceptions WHERE schedule_id = ? AND effective_start < ? AND effective_end > ? ORDER BY effective_start ASC, effective_end ASC, version DESC",
      scheduleId,
      to,
      from,
    );

    const effectiveResourceId = resourceId ?? schedule.resourceId ?? undefined;
    if (schedule.resourceId && effectiveResourceId !== schedule.resourceId) {
      throw new DatabaseError("Schedule is bound to a different resource");
    }

    let resourceCapacity: number | null = null;
    if (effectiveResourceId) {
      const resource = await this.database.first<{ capacity: number }>(
        "SELECT capacity FROM resources WHERE id = ? AND business_id = ? AND status = 'active' LIMIT 1",
        effectiveResourceId,
        schedule.businessId,
      );
      if (!resource) throw new DatabaseError("Availability resource not found");
      resourceCapacity = resource.capacity;
    }

    const appointmentSql = effectiveResourceId
      ? "SELECT a.id, a.starts_at AS startsAt, a.ends_at AS endsAt, COALESCE(SUM(bi.quantity), 0) + CASE WHEN COUNT(bi.id) = 0 THEN 1 ELSE 0 END AS quantity FROM appointments a INNER JOIN bookings b ON b.id = a.booking_id INNER JOIN appointment_resources ar ON ar.appointment_id = a.id LEFT JOIN booking_items bi ON bi.booking_id = a.booking_id WHERE b.business_id = ? AND a.status IN ('scheduled','confirmed') AND a.starts_at < ? AND a.ends_at > ? AND ar.resource_id = ? GROUP BY a.id, a.starts_at, a.ends_at ORDER BY a.starts_at ASC, a.id ASC"
      : "SELECT a.id, a.starts_at AS startsAt, a.ends_at AS endsAt, COALESCE(SUM(bi.quantity), 0) + CASE WHEN COUNT(bi.id) = 0 THEN 1 ELSE 0 END AS quantity FROM appointments a INNER JOIN bookings b ON b.id = a.booking_id LEFT JOIN booking_items bi ON bi.booking_id = a.booking_id WHERE b.business_id = ? AND a.status IN ('scheduled','confirmed') AND a.starts_at < ? AND a.ends_at > ? GROUP BY a.id, a.starts_at, a.ends_at ORDER BY a.starts_at ASC, a.id ASC";

    const appointmentRows = await this.database.all<AvailabilityAppointmentCommitment>(
      appointmentSql,
      schedule.businessId,
      to,
      from,
      ...(effectiveResourceId ? [effectiveResourceId] : []),
    );

    const holdRows = await this.database.all<{ slotReference: string }>(
      "SELECT slot_reference AS slotReference FROM booking_holds WHERE business_id = ? AND status = 'active' AND expires_at > ? AND organization_id = ? AND workspace_id = ? AND (resource_id IS NULL OR resource_id = ?)",
      schedule.businessId,
      new Date().toISOString(),
      this.requireOrganization({ organizationId: context.tenantId }),
      this.requireWorkspace({ workspaceId: context.workspaceId }),
      effectiveResourceId ?? null,
    );

    return {
      schedule,
      generation,
      rules,
      exceptions,
      appointments: appointmentRows,
      activeHoldSlotReferences: new Set(holdRows.map((row) => row.slotReference)),
      resourceCapacity,
    };
  }

  async createSchedule(context: RequestContext, input: CreateScheduleInput): Promise<ScheduleRecord> {
    await this.database.run(
      "INSERT INTO schedules (id, business_id, location_id, resource_id, timezone, recurrence_definition, booking_horizon_minutes, lead_time_minutes, buffer_before_seconds, buffer_after_seconds, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)",
      input.id,
      input.businessId,
      input.locationId ?? null,
      input.resourceId ?? null,
      input.timezone,
      input.recurrenceDefinition,
      input.bookingHorizonMinutes ?? null,
      input.leadTimeMinutes ?? null,
      input.bufferBeforeSeconds ?? null,
      input.bufferAfterSeconds ?? null,
      input.now,
      input.now,
    );
    const schedule = await this.getSchedule(context, input.id);
    if (!schedule) throw new DatabaseError("Schedule not available after creation");
    return schedule;
  }

  async createRule(context: RequestContext, input: CreateAvailabilityRuleInput): Promise<AvailabilityRuleRecord> {
    const schedule = await this.getSchedule(context, input.scheduleId);
    if (!schedule) throw new DatabaseError("Schedule not found");
    if (!input.ruleType.trim()) throw new DatabaseError("Availability rule type is required");
    await this.database.run(
      "INSERT INTO availability_rules (id, schedule_id, rule_type, recurrence_payload, start_constraint, end_constraint, capacity, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
      input.id,
      input.scheduleId,
      input.ruleType.trim(),
      input.recurrencePayload,
      input.startConstraint ?? null,
      input.endConstraint ?? null,
      input.capacity ?? null,
      input.now,
      input.now,
    );
    const record = await this.database.first<AvailabilityRuleRecord>(
      "SELECT id, schedule_id AS scheduleId, rule_type AS ruleType, recurrence_payload AS recurrencePayload, start_constraint AS startConstraint, end_constraint AS endConstraint, capacity, version, created_at AS createdAt, updated_at AS updatedAt FROM availability_rules WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!record) throw new DatabaseError("Availability rule not found after creation");
    return record;
  }

  async createException(context: RequestContext, input: CreateAvailabilityExceptionInput): Promise<AvailabilityExceptionRecord> {
    const schedule = await this.getSchedule(context, input.scheduleId);
    if (!schedule) throw new DatabaseError("Schedule not found");
    if (input.effectiveEnd <= input.effectiveStart) throw new DatabaseError("Availability exception end must be after start");
    await this.database.run(
      "INSERT INTO availability_exceptions (id, schedule_id, effective_start, effective_end, exception_type, capacity, closure_reason, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
      input.id,
      input.scheduleId,
      input.effectiveStart,
      input.effectiveEnd,
      input.exceptionType,
      input.capacity ?? null,
      input.closureReason ?? null,
      input.now,
      input.now,
    );
    const record = await this.database.first<AvailabilityExceptionRecord>(
      "SELECT id, schedule_id AS scheduleId, effective_start AS effectiveStart, effective_end AS effectiveEnd, exception_type AS exceptionType, capacity, closure_reason AS closureReason, version, created_at AS createdAt, updated_at AS updatedAt FROM availability_exceptions WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!record) throw new DatabaseError("Availability exception not found after creation");
    return record;
  }
}

function parseGenerationDefinition(value: string): ScheduleGenerationDefinition {
  try {
    const parsed = JSON.parse(value) as Partial<ScheduleGenerationDefinition>;
    if (parsed.version !== 1) throw new Error("version");
    const slotGranularityMinutes = parsed.slotGranularityMinutes ?? 15;
    if (!Number.isSafeInteger(slotGranularityMinutes) || slotGranularityMinutes < 1 || slotGranularityMinutes > 1440) {
      throw new Error("slotGranularityMinutes");
    }
    return { version: 1, slotGranularityMinutes };
  } catch {
    throw new DatabaseError("Schedule recurrence definition is invalid");
  }
}

export function parseAvailabilityRuleDefinition(value: string): AvailabilityRuleDefinition {
  try {
    const parsed = JSON.parse(value) as Partial<AvailabilityRuleDefinition>;
    if (parsed.version !== 1 || !Array.isArray(parsed.weekdays)) throw new Error("shape");
    if (!parsed.weekdays.every((day) => Number.isSafeInteger(day) && day >= 1 && day <= 7)) throw new Error("weekday");
    if (typeof parsed.start !== "string" || !TIME_RE.test(parsed.start)) throw new Error("start");
    if (typeof parsed.end !== "string" || !TIME_RE.test(parsed.end)) throw new Error("end");
    if (parsed.end <= parsed.start) throw new Error("overnight");
    if (parsed.capacity !== undefined && (!Number.isSafeInteger(parsed.capacity) || parsed.capacity <= 0)) throw new Error("capacity");
    return {
      version: 1,
      weekdays: [...new Set(parsed.weekdays)].sort((a, b) => a - b),
      start: parsed.start,
      end: parsed.end,
      ...(parsed.capacity !== undefined ? { capacity: parsed.capacity } : {}),
    };
  } catch {
    throw new DatabaseError("Availability rule recurrence payload is invalid");
  }
}

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
