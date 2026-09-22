import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import { AutomationRepository } from "./repository";

export interface AutomationServiceOptions {
  readonly repository: AutomationRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly traceId: () => string;
  readonly now: () => string;
}

export class AutomationService {
  constructor(private readonly options: AutomationServiceOptions) {}

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
