import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import {
  BookingRepository,
  type BookingRecord,
  type CreateBookingInput,
  type BookingStatus,
  type AddBookingItemInput,
  type CreateAppointmentInput,
} from "./repository";

export interface BookingServiceOptions {
  readonly repository: BookingRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export interface CreateBookingCommand {
  readonly businessId: EntityId;
  readonly customerId: EntityId;
  readonly currency: string;
  readonly totalAmountMinor?: number | undefined;
  readonly policySnapshot?: string | undefined;
  readonly idempotencyKey: string;
}

export class BookingService {
  constructor(private readonly options: BookingServiceOptions) {}

  async create(context: RequestContext, command: CreateBookingCommand): Promise<BookingRecord> {
    await this.options.authorization.assert({
      context,
      permission: "booking.create",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    const input: CreateBookingInput = {
      id: this.options.id(),
      businessId: command.businessId,
      customerId: command.customerId,
      currency: command.currency.trim().toUpperCase(),
      totalAmountMinor: command.totalAmountMinor,
      policySnapshot: command.policySnapshot,
      idempotencyKey: command.idempotencyKey,
      now: this.options.now(),
    };
    return this.options.repository.create(context, input);
  }

  async createHold(context: RequestContext, input: {
    readonly businessId: EntityId;
    readonly resourceId?: EntityId | undefined;
    readonly slotReference: string;
    readonly actorReference?: string | undefined;
    readonly expiresAt: string;
  }) {
    await this.options.authorization.assert({
      context,
      permission: "booking.create",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.repository.createHold(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async releaseHold(
    context: RequestContext,
    id: EntityId,
    status: "released" | "expired" | "consumed" = "released",
  ) {
    await this.options.authorization.assert({
      context,
      permission: "booking.manage",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.repository.releaseHold(context, id, status, this.options.now());
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
    },
  ): Promise<BookingRecord> {
    await this.options.authorization.assert({
      context,
      permission: "booking.confirm",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.repository.finalize(context, {
      ...input,
      now: this.options.now(),
    });
  }

  async addItem(context: RequestContext, input: Omit<AddBookingItemInput, "id" | "now">) {
    const booking = await this.options.repository.get(context, input.bookingId);
    if (!booking) throw new Error("Booking not found");
    await this.options.authorization.assert({
      context,
      permission: "booking.manage",
      resource: { tenantId: booking.organizationId, workspaceId: booking.workspaceId },
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.repository.addItem(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async setStatus(context: RequestContext, id: EntityId, status: BookingStatus) {
    const booking = await this.options.repository.get(context, id);
    if (!booking) throw new Error("Booking not found");
    await this.options.authorization.assert({
      context,
      permission: status === "cancelled" ? "booking.cancel" : "booking.manage",
      resource: { tenantId: booking.organizationId, workspaceId: booking.workspaceId },
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.repository.setStatus(context, id, status, this.options.now());
  }

  async createAppointment(
    context: RequestContext,
    input: Omit<CreateAppointmentInput, "id" | "now">,
  ) {
    const booking = await this.options.repository.get(context, input.bookingId);
    if (!booking) throw new Error("Booking not found");
    await this.options.authorization.assert({
      context,
      permission: "booking.manage",
      resource: { tenantId: booking.organizationId, workspaceId: booking.workspaceId },
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.repository.createAppointment(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }
}

export const BOOKING_PERMISSIONS = [
  "booking.create",
  "booking.read",
  "booking.manage",
  "booking.cancel",
  "booking.reschedule",
  "booking.confirm",
  "booking.complete",
] as const;
