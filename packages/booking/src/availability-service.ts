import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import {
  AvailabilityRepository,
  type CreateAvailabilityExceptionInput,
  type CreateAvailabilityRuleInput,
  type CreateScheduleInput,
  type ScheduleRecord,
} from "./availability-repository";

export interface AvailabilityServiceOptions {
  readonly repository: AvailabilityRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export class AvailabilityService {
  constructor(private readonly options: AvailabilityServiceOptions) {}

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
