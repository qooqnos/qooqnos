import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import {
  AvailabilityRepository,
  type CreateAvailabilityExceptionInput,
  type CreateAvailabilityRuleInput,
  type CreateScheduleInput,
  type ScheduleRecord,
} from "./availability-repository";
import { generateAvailabilitySlots, type AvailabilitySlot } from "./slot-generator";

export interface AvailabilityServiceOptions {
  readonly repository: AvailabilityRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export class AvailabilityService {
  constructor(private readonly options: AvailabilityServiceOptions) {}


  async getSlots(
    context: RequestContext,
    input: {
      readonly scheduleId: EntityId;
      readonly from: string;
      readonly to: string;
      readonly durationSeconds: number;
      readonly resourceId?: EntityId | undefined;
    },
  ): Promise<readonly AvailabilitySlot[]> {
    await this.options.authorization.assert({
      context,
      permission: "availability.read",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    const snapshot = await this.options.repository.getAvailabilityContext(
      context,
      input.scheduleId,
      input.from,
      input.to,
      input.resourceId,
    );
    return generateAvailabilitySlots(snapshot, input.from, input.to, input.durationSeconds, this.options.now());
  }

  async checkAvailability(
    context: RequestContext,
    input: {
      readonly scheduleId: EntityId;
      readonly startsAt: string;
      readonly endsAt: string;
      readonly durationSeconds: number;
      readonly resourceId?: EntityId | undefined;
    },
  ): Promise<AvailabilitySlot | null> {
    const slots = await this.getSlots(context, {
      scheduleId: input.scheduleId,
      from: input.startsAt,
      to: input.endsAt,
      durationSeconds: input.durationSeconds,
      ...(input.resourceId ? { resourceId: input.resourceId } : {}),
    });
    return slots.find((slot) => slot.startsAt === new Date(input.startsAt).toISOString() && slot.endsAt === new Date(input.endsAt).toISOString()) ?? null;
  }

  async createSchedule(
    context: RequestContext,
    command: Omit<CreateScheduleInput, "id" | "now">,
  ): Promise<ScheduleRecord> {
    await this.options.authorization.assert({
      context,
      permission: "availability.manage",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.repository.createSchedule(context, {
      ...command,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async createRule(
    context: RequestContext,
    command: Omit<CreateAvailabilityRuleInput, "id" | "now">,
  ) {
    await this.options.authorization.assert({
      context,
      permission: "availability.manage",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.repository.createRule(context, {
      ...command,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async createException(
    context: RequestContext,
    command: Omit<CreateAvailabilityExceptionInput, "id" | "now">,
  ) {
    await this.options.authorization.assert({
      context,
      permission: "availability.manage",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.repository.createException(context, {
      ...command,
      id: this.options.id(),
      now: this.options.now(),
    });
  }
}

export const AVAILABILITY_PERMISSIONS = [
  "availability.read",
  "availability.manage",
] as const;
