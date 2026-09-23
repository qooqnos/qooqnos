import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import { AutomationExecutor } from "./executor";
import { AutomationRepository } from "./repository";

export interface AutomationServiceOptions {
  readonly repository: AutomationRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly traceId: () => string;
  readonly now: () => string;
  readonly executor?: AutomationExecutor;
}

export class AutomationService {
  constructor(private readonly options: AutomationServiceOptions) {}

  async createSchedule(context: RequestContext, input: {
    readonly timezone: string;
    readonly recurrence: string;
    readonly startAt: string;
    readonly endAt?: string;
    readonly misfirePolicy: "skip" | "catch_up_once" | "catch_up_all";
  }) {
    await this.options.authorization.assert({
      context,
      permission: "automation.workflow.manage",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.createSchedule(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async attachScheduleTrigger(context: RequestContext, input: {
    readonly workflowId: EntityId;
    readonly workflowVersionId: EntityId;
    readonly scheduleId: EntityId;
    readonly enabled?: boolean;
  }): Promise<void> {
    await this.options.authorization.assert({
      context,
      permission: "automation.workflow.manage",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    await this.options.repository.createScheduleTrigger(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async execute(
    context: RequestContext,
    executionId: EntityId,
  ): Promise<"completed" | "failed" | "waiting"> {
    await this.options.authorization.assert({
      context,
      permission: "automation.execution.manage",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    if (!this.options.executor) throw new Error("Automation executor is not configured");
    return this.options.executor.execute(context, executionId);
  }

  async createWorkflow(context: RequestContext, input: {
    readonly name: string; readonly scope: "platform"|"organization"|"workspace"|"business"; readonly businessId?: EntityId;
  }) {
    await this.options.authorization.assert({context,permission:"automation.workflow.manage",requireAuthentication:true,requireWorkspace:input.scope==="workspace"||input.scope==="business"});
    return this.options.repository.createWorkflow(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async createVersion(context: RequestContext, input: {
    readonly workflowId: EntityId; readonly version: number; readonly definition: Readonly<Record<string, unknown>>;
  }) {
    await this.options.authorization.assert({context,permission:"automation.workflow.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.createVersion(context,{...input,id:this.options.id(),now:this.options.now()});
  }

  async activateVersion(context: RequestContext, input: {
    readonly workflowId: EntityId;
    readonly versionId: EntityId;
  }) {
    await this.options.authorization.assert({
      context,
      permission:"automation.workflow.manage",
      requireAuthentication:true,
      requireWorkspace:false,
    });
    return this.options.repository.activateVersion(
      context,
      input.workflowId,
      input.versionId,
      this.options.now(),
    );
  }

  async pauseWorkflow(context: RequestContext, workflowId: EntityId) {
    await this.options.authorization.assert({
      context,
      permission:"automation.workflow.manage",
      requireAuthentication:true,
      requireWorkspace:false,
    });
    return this.options.repository.setWorkflowStatus(
      context,
      workflowId,
      "paused",
      this.options.now(),
    );
  }

  async retireWorkflow(context: RequestContext, workflowId: EntityId) {
    await this.options.authorization.assert({
      context,
      permission:"automation.workflow.manage",
      requireAuthentication:true,
      requireWorkspace:false,
    });
    return this.options.repository.setWorkflowStatus(
      context,
      workflowId,
      "retired",
      this.options.now(),
    );
  }

  async startExecution(context: RequestContext, input: {
    readonly workflowId: EntityId; readonly workflowVersionId: EntityId; readonly triggerId: EntityId; readonly correlationId: string; readonly inputReference?: string;
  }) {
    await this.options.authorization.assert({context,permission:"automation.execution.run",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.startExecution(context,{...input,id:this.options.id(),traceId:this.options.traceId(),now:this.options.now()});
  }
}

export const AUTOMATION_PERMISSIONS = [
  "automation.workflow.read",
  "automation.workflow.manage",
  "automation.execution.read",
  "automation.execution.run",
  "automation.execution.manage",
] as const;
