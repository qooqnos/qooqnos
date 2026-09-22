import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type BookingStatus =
  | "requested"
  | "pending_confirmation"
  | "confirmed"
  | "rescheduled"
  | "cancelled"
  | "completed"
  | "no_show";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export interface BookingRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly businessId: EntityId;
  readonly customerId: EntityId;
  readonly status: BookingStatus;
  readonly currency: string;
  readonly totalAmountMinor: number | null;
  readonly policySnapshot: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BookingItemRecord {
  readonly id: EntityId;
  readonly bookingId: EntityId;
  readonly offeringId: EntityId;
  readonly quantity: number;
  readonly titleSnapshot: string;
  readonly priceMinorSnapshot: number;
  readonly currencySnapshot: string;
  readonly durationSecondsSnapshot: number | null;
  readonly policySnapshot: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AppointmentRecord {
  readonly id: EntityId;
  readonly bookingId: EntityId;
  readonly status: AppointmentStatus;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timezone: string | null;
  readonly locationId: EntityId | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ResourceRecord {
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly locationId: EntityId | null;
  readonly resourceType: "person" | "room" | "equipment" | "vehicle" | "service_area" | "other";
  readonly status: "active" | "inactive" | "archived";
  readonly capacity: number;
  readonly metadata: Readonly<Record<string, unknown>> | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}



export interface BookingStatusHistoryRecord {
  readonly id: EntityId;
  readonly bookingId: EntityId;
  readonly fromStatus: BookingStatus | null;
  readonly toStatus: BookingStatus;
  readonly changedAt: string;
  readonly createdAt: string;
}

export interface BookingHoldRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly businessId: EntityId;
  readonly resourceId: EntityId | null;
  readonly slotReference: string;
  readonly actorReference: string | null;
  readonly status: "active" | "released" | "expired" | "consumed";
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateBookingInput {
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly customerId: EntityId;
  readonly currency: string;
  readonly totalAmountMinor?: number | undefined;
  readonly policySnapshot?: string | undefined;
  readonly idempotencyKey: string;
  readonly now: string;
}

export interface AddBookingItemInput {
  readonly id: EntityId;
  readonly bookingId: EntityId;
  readonly offeringId: EntityId;
  readonly quantity: number;
  readonly titleSnapshot: string;
  readonly priceMinorSnapshot: number;
  readonly currencySnapshot: string;
  readonly durationSecondsSnapshot?: number | undefined;
  readonly policySnapshot?: string | undefined;
  readonly now: string;
}

export interface CreateAppointmentInput {
  readonly id: EntityId;
  readonly bookingId: EntityId;
  readonly status?: AppointmentStatus | undefined;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timezone?: string | undefined;
  readonly locationId?: EntityId | undefined;
  readonly now: string;
}

export class BookingRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async create(context: RequestContext, input: CreateBookingInput): Promise<BookingRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });

    if (input.totalAmountMinor !== undefined && input.totalAmountMinor < 0) {
      throw new DatabaseError("Booking total cannot be negative");
    }

    await this.database.run(
      "INSERT INTO bookings (id, organization_id, workspace_id, business_id, customer_id, status, currency, total_amount_minor, policy_snapshot, idempotency_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'requested', ?, ?, ?, ?, ?, ?)",
      input.id,
      organizationId,
      workspaceId,
      input.businessId,
      input.customerId,
      input.currency.trim().toUpperCase(),
      input.totalAmountMinor ?? null,
      input.policySnapshot ?? null,
      input.idempotencyKey.trim(),
      input.now,
      input.now,
    );

    const booking = await this.get(context, input.id);
    if (!booking) throw new DatabaseError("Booking not found after creation");
    return booking;
  }

  async get(context: RequestContext, id: EntityId): Promise<BookingRecord | null> {
    return this.database.first<BookingRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, customer_id AS customerId, status, currency, total_amount_minor AS totalAmountMinor, policy_snapshot AS policySnapshot, created_at AS createdAt, updated_at AS updatedAt FROM bookings WHERE id = ? AND organization_id = ? AND workspace_id = ? LIMIT 1",
      id,
      this.requireOrganization({ organizationId: context.tenantId }),
      this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
  }

  async getByIdempotency(
    context: RequestContext,
    idempotencyKey: string,
  ): Promise<BookingRecord | null> {
    if (!idempotencyKey.trim()) return null;
    return this.database.first<BookingRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, customer_id AS customerId, status, currency, total_amount_minor AS totalAmountMinor, policy_snapshot AS policySnapshot, created_at AS createdAt, updated_at AS updatedAt FROM bookings WHERE organization_id = ? AND workspace_id = ? AND idempotency_key = ? LIMIT 1",
      this.requireOrganization({ organizationId: context.tenantId }),
      this.requireWorkspace({ workspaceId: context.workspaceId }),
      idempotencyKey.trim(),
    );
  }

  async finalize(
    context: RequestContext,
    input: {
      readonly bookingId: EntityId;
      readonly idempotencyKey: string;
      readonly businessId: EntityId;
      readonly customerId: EntityId;
      readonly offeringId: EntityId;
      readonly currency: string;
      readonly quantity: number;
      readonly titleSnapshot: string;
      readonly priceMinorSnapshot: number;
      readonly durationSecondsSnapshot?: number | undefined;
      readonly policySnapshot?: string | undefined;
      readonly holdId: EntityId;
      readonly startsAt: string;
      readonly endsAt: string;
      readonly timezone?: string | undefined;
      readonly locationId?: EntityId | undefined;
      readonly resourceId?: EntityId | undefined;
      readonly now: string;
    },
  ): Promise<BookingRecord> {
    const existing = await this.getByIdempotency(context, input.idempotencyKey);
    if (existing) return existing;

    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    if (input.endsAt <= input.startsAt) throw new DatabaseError("Appointment end must be after start");
    if (input.quantity < 1) throw new DatabaseError("Booking item quantity must be positive");
    if (input.priceMinorSnapshot < 0) throw new DatabaseError("Booking item price cannot be negative");
    if (!input.titleSnapshot.trim()) throw new DatabaseError("Booking item title snapshot is required");

    const statements: Array<{ sql: string; params?: readonly unknown[] }> = [
      {
        sql: "UPDATE booking_holds SET status = 'consumed', updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ? AND business_id = ? AND status = 'active' AND expires_at > ? AND (resource_id IS NULL OR resource_id = ?)",
        params: [
          input.now,
          input.holdId,
          organizationId,
          workspaceId,
          input.businessId,
          input.now,
          input.resourceId ?? null,
        ],
      },
      {
        sql: "INSERT INTO bookings (id, organization_id, workspace_id, business_id, customer_id, status, currency, total_amount_minor, policy_snapshot, idempotency_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?)",
        params: [
          input.bookingId,
          organizationId,
          workspaceId,
          input.businessId,
          input.customerId,
          input.currency.trim().toUpperCase(),
          input.priceMinorSnapshot * input.quantity,
          input.policySnapshot ?? null,
          input.idempotencyKey.trim(),
          input.now,
          input.now,
        ],
      },
      {
        sql: "INSERT INTO booking_items (id, booking_id, offering_id, quantity, title_snapshot, price_minor_snapshot, currency_snapshot, duration_seconds_snapshot, policy_snapshot, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params: [
          input.bookingId + ":item",
          input.bookingId,
          input.offeringId,
          input.quantity,
          input.titleSnapshot.trim(),
          input.priceMinorSnapshot,
          input.currency.trim().toUpperCase(),
          input.durationSecondsSnapshot ?? null,
          input.policySnapshot ?? null,
          input.now,
          input.now,
        ],
      },
      {
        sql: "INSERT INTO appointments (id, booking_id, status, starts_at, ends_at, timezone, location_id, created_at, updated_at) VALUES (?, ?, 'confirmed', ?, ?, ?, ?, ?, ?)",
        params: [
          input.bookingId + ":appointment",
          input.bookingId,
          input.startsAt,
          input.endsAt,
          input.timezone ?? null,
          input.locationId ?? null,
          input.now,
          input.now,
        ],
      },
    ];

    if (input.resourceId) {
      statements.push({
        sql: "INSERT INTO appointment_resources (appointment_id, resource_id, created_at) VALUES (?, ?, ?)",
        params: [input.bookingId + ":appointment", input.resourceId, input.now],
      });
    }

    statements.push({
      sql: "INSERT OR IGNORE INTO outbox_events (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at, published_at) VALUES (?, 'booking.confirmed', 1, 'booking', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)",
      params: [
        input.bookingId + ":confirmed",
        input.bookingId,
        organizationId,
        workspaceId,
        JSON.stringify({
          bookingId: input.bookingId,
          businessId: input.businessId,
          customerId: input.customerId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          resourceId: input.resourceId ?? null,
        }),
        input.now,
        input.now,
      ],
    });

    try {
      const results = await this.database.transaction(statements);
      const holdUpdate = results[0];
      if (!holdUpdate || (holdUpdate.meta?.changes ?? 0) !== 1) {
        throw new DatabaseError("Booking hold is unavailable or expired");
      }
    } catch (error) {
      const replay = await this.getByIdempotency(context, input.idempotencyKey);
      if (replay) return replay;
      throw error;
    }

    const booking = await this.get(context, input.bookingId);
    if (!booking) throw new DatabaseError("Booking not found after finalization");
    return booking;
  }

  async addItem(context: RequestContext, input: AddBookingItemInput): Promise<BookingItemRecord> {
    const booking = await this.get(context, input.bookingId);
    if (!booking) throw new DatabaseError("Booking not found");
    if (booking.status !== "requested" && booking.status !== "pending_confirmation") {
      throw new DatabaseError("Booking items are immutable after confirmation");
    }
    if (input.quantity < 1) throw new DatabaseError("Booking item quantity must be positive");
    if (input.priceMinorSnapshot < 0) throw new DatabaseError("Booking item price cannot be negative");
    if (!input.titleSnapshot.trim()) throw new DatabaseError("Booking item title snapshot is required");

    await this.database.run(
      "INSERT INTO booking_items (id, booking_id, offering_id, quantity, title_snapshot, price_minor_snapshot, currency_snapshot, duration_seconds_snapshot, policy_snapshot, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.bookingId,
      input.offeringId,
      input.quantity,
      input.titleSnapshot.trim(),
      input.priceMinorSnapshot,
      input.currencySnapshot.trim().toUpperCase(),
      input.durationSecondsSnapshot ?? null,
      input.policySnapshot ?? null,
      input.now,
      input.now,
    );

    const item = await this.database.first<BookingItemRecord>(
      "SELECT id, booking_id AS bookingId, offering_id AS offeringId, quantity, title_snapshot AS titleSnapshot, price_minor_snapshot AS priceMinorSnapshot, currency_snapshot AS currencySnapshot, duration_seconds_snapshot AS durationSecondsSnapshot, policy_snapshot AS policySnapshot, created_at AS createdAt, updated_at AS updatedAt FROM booking_items WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!item) throw new DatabaseError("Booking item not found after creation");
    return item;
  }

  async listItems(context: RequestContext, bookingId: EntityId): Promise<readonly BookingItemRecord[]> {
    const booking = await this.get(context, bookingId);
    if (!booking) throw new DatabaseError("Booking not found");
    return this.database.all<BookingItemRecord>(
      "SELECT id, booking_id AS bookingId, offering_id AS offeringId, quantity, title_snapshot AS titleSnapshot, price_minor_snapshot AS priceMinorSnapshot, currency_snapshot AS currencySnapshot, duration_seconds_snapshot AS durationSecondsSnapshot, policy_snapshot AS policySnapshot, created_at AS createdAt, updated_at AS updatedAt FROM booking_items WHERE booking_id = ? ORDER BY created_at ASC, id ASC",
      bookingId,
    );
  }

  async setStatus(
    context: RequestContext,
    id: EntityId,
    status: BookingStatus,
    now: string,
  ): Promise<BookingRecord> {
    const current = await this.get(context, id);
    if (!current) throw new DatabaseError("Booking not found");
    if (isTerminalBookingStatus(current.status) && current.status !== status) {
      throw new DatabaseError("Terminal booking state cannot be reopened");
    }

    await this.database.run(
      "UPDATE bookings SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ?",
      status,
      now,
      id,
      current.organizationId,
      current.workspaceId,
    );

    await this.database.run(
      "INSERT INTO booking_status_history (id, booking_id, from_status, to_status, changed_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      id + ":status:" + now,
      id,
      current.status,
      status,
      now,
      now,
    );

    const updated = await this.get(context, id);
    if (!updated) throw new DatabaseError("Booking not found after status update");
    return updated;
  }


  async listStatusHistory(
    context: RequestContext,
    bookingId: EntityId,
    limit = 100,
  ): Promise<readonly BookingStatusHistoryRecord[]> {
    const booking = await this.get(context, bookingId);
    if (!booking) throw new DatabaseError("Booking not found");
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
    return this.database.all<BookingStatusHistoryRecord>(
      "SELECT id, booking_id AS bookingId, from_status AS fromStatus, to_status AS toStatus, changed_at AS changedAt, created_at AS createdAt FROM booking_status_history WHERE booking_id = ? ORDER BY changed_at DESC, id DESC LIMIT ?",
      bookingId,
      safeLimit,
    );
  }

  async createHold(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly businessId: EntityId;
      readonly resourceId?: EntityId | undefined;
      readonly slotReference: string;
      readonly actorReference?: string | undefined;
      readonly expiresAt: string;
      readonly now: string;
    },
  ): Promise<BookingHoldRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    if (!input.slotReference.trim()) throw new DatabaseError("Booking hold slot reference is required");
    if (input.expiresAt <= input.now) throw new DatabaseError("Booking hold must expire in the future");

    await this.database.run(
      "INSERT INTO booking_holds (id, organization_id, workspace_id, business_id, resource_id, slot_reference, actor_reference, status, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)",
      input.id,
      organizationId,
      workspaceId,
      input.businessId,
      input.resourceId ?? null,
      input.slotReference.trim(),
      input.actorReference ?? null,
      input.expiresAt,
      input.now,
      input.now,
    );

    const hold = await this.getHold(context, input.id);
    if (!hold) throw new DatabaseError("Booking hold not found after creation");
    return hold;
  }

  async releaseHold(
    context: RequestContext,
    id: EntityId,
    status: "released" | "expired" | "consumed",
    now: string,
  ): Promise<BookingHoldRecord> {
    const current = await this.getHold(context, id);
    if (!current) throw new DatabaseError("Booking hold not found");
    if (current.status !== "active") return current;

    await this.database.run(
      "UPDATE booking_holds SET status = ?, updated_at = ? WHERE id = ? AND status = 'active'",
      status,
      now,
      id,
    );

    const updated = await this.getHold(context, id);
    if (!updated) throw new DatabaseError("Booking hold not found after release");
    return updated;
  }

  async getHold(context: RequestContext, id: EntityId): Promise<BookingHoldRecord | null> {
    return this.database.first<BookingHoldRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, resource_id AS resourceId, slot_reference AS slotReference, actor_reference AS actorReference, status, expires_at AS expiresAt, created_at AS createdAt, updated_at AS updatedAt FROM booking_holds WHERE id = ? AND organization_id = ? AND workspace_id = ? LIMIT 1",
      id,
      this.requireOrganization({ organizationId: context.tenantId }),
      this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
  }

  async listExpiredHolds(
    context: RequestContext,
    now: string,
    limit = 100,
  ): Promise<readonly BookingHoldRecord[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
    return this.database.all<BookingHoldRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, resource_id AS resourceId, slot_reference AS slotReference, actor_reference AS actorReference, status, expires_at AS expiresAt, created_at AS createdAt, updated_at AS updatedAt FROM booking_holds WHERE status = 'active' AND expires_at <= ? AND organization_id = ? AND workspace_id = ? ORDER BY expires_at ASC, id ASC LIMIT ?",
      now,
      this.requireOrganization({ organizationId: context.tenantId }),
      this.requireWorkspace({ workspaceId: context.workspaceId }),
      safeLimit,
    );
  }

  async recordAppointmentEvent(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly appointmentId: EntityId;
      readonly eventType: string;
      readonly eventVersion?: number | undefined;
      readonly payload?: Readonly<Record<string, unknown>> | undefined;
      readonly occurredAt: string;
      readonly now: string;
    },
  ): Promise<void> {
    const appointment = await this.getAppointment(context, input.appointmentId);
    if (!appointment) throw new DatabaseError("Appointment not found");

    await this.database.run(
      "INSERT INTO appointment_events (id, appointment_id, event_type, event_version, payload_json, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.appointmentId,
      input.eventType.trim(),
      input.eventVersion ?? 1,
      input.payload ? JSON.stringify(input.payload) : null,
      input.occurredAt,
      input.now,
    );
  }

  async createAppointment(context: RequestContext, input: CreateAppointmentInput): Promise<AppointmentRecord> {
    const booking = await this.get(context, input.bookingId);
    if (!booking) throw new DatabaseError("Booking not found");
    if (input.endsAt <= input.startsAt) throw new DatabaseError("Appointment end must be after start");

    await this.database.run(
      "INSERT INTO appointments (id, booking_id, status, starts_at, ends_at, timezone, location_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.bookingId,
      input.status ?? "scheduled",
      input.startsAt,
      input.endsAt,
      input.timezone ?? null,
      input.locationId ?? null,
      input.now,
      input.now,
    );

    const appointment = await this.getAppointment(context, input.id);
    if (!appointment) throw new DatabaseError("Appointment not found after creation");
    return appointment;
  }

  async getAppointment(context: RequestContext, id: EntityId): Promise<AppointmentRecord | null> {
    return this.database.first<AppointmentRecord>(
      "SELECT a.id, a.booking_id AS bookingId, a.status, a.starts_at AS startsAt, a.ends_at AS endsAt, a.timezone, a.location_id AS locationId, a.created_at AS createdAt, a.updated_at AS updatedAt FROM appointments a INNER JOIN bookings b ON b.id = a.booking_id WHERE a.id = ? AND b.organization_id = ? AND b.workspace_id = ? LIMIT 1",
      id,
      this.requireOrganization({ organizationId: context.tenantId }),
      this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
  }

  async addResource(
    context: RequestContext,
    appointmentId: EntityId,
    resourceId: EntityId,
    now: string,
  ): Promise<void> {
    const appointment = await this.getAppointment(context, appointmentId);
    if (!appointment) throw new DatabaseError("Appointment not found");
    await this.database.run(
      "INSERT INTO appointment_resources (appointment_id, resource_id, created_at) VALUES (?, ?, ?)",
      appointmentId,
      resourceId,
      now,
    );
  }

  private parseMetadata(value: string | null): Readonly<Record<string, unknown>> | null {
    if (!value) return null;
    try {
      return JSON.parse(value) as Readonly<Record<string, unknown>>;
    } catch {
      throw new DatabaseError("Stored resource metadata is invalid");
    }
  }

  async getResource(context: RequestContext, id: EntityId): Promise<ResourceRecord | null> {
    const row = await this.database.first<ResourceRecord & { metadataJson: string | null }>(
      "SELECT r.id, r.business_id AS businessId, r.location_id AS locationId, r.resource_type AS resourceType, r.status, r.capacity, r.metadata_json AS metadataJson, r.created_at AS createdAt, r.updated_at AS updatedAt FROM resources r INNER JOIN businesses b ON b.id = r.business_id WHERE r.id = ? AND b.organization_id = ? AND b.workspace_id = ? LIMIT 1",
      id,
      this.requireOrganization({ organizationId: context.tenantId }),
      this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    if (!row) return null;
    return { ...row, metadata: this.parseMetadata(row.metadataJson) };
  }
}

function isTerminalBookingStatus(status: BookingStatus): boolean {
  return status === "cancelled" || status === "completed" || status === "no_show";
}
