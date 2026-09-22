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
      now: this.options.now(),
    };
    return this.options.repository.create(context, input);
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
  "booking.confirm",
  "booking.complete",
] as const;
