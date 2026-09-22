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
