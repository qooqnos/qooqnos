import type { RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type SeoExperimentStatus = "draft" | "running" | "stopped" | "completed";
export type SeoExperimentArm = "control" | "variant";

export interface CreateSeoExperimentInput {
  readonly id: string;
  readonly name: string;
  readonly hypothesis: string;
  readonly targetPopulation: string;
  readonly control: unknown;
  readonly variant: unknown;
  readonly successMetric: string;
  readonly guardrails: unknown;
  readonly observationWindowStart: string;
  readonly observationWindowEnd: string;
  readonly status?: SeoExperimentStatus;
}

export class SeoExperimentRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async create(context: RequestContext, input: CreateSeoExperimentInput): Promise<void> {
    const scope = this.scope(context);
    if (!input.name.trim() || !input.hypothesis.trim() || !input.successMetric.trim()) throw new DatabaseError("SEO experiment requires name, hypothesis and success metric");
    await this.database.run(
      `INSERT INTO seo_experiments
       (id, organization_id, workspace_id, name, hypothesis, target_population, control_definition_json,
        variant_definition_json, success_metric, guardrails_json, observation_window_start, observation_window_end, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id, scope.organizationId, scope.workspaceId, input.name, input.hypothesis, input.targetPopulation,
      JSON.stringify(input.control), JSON.stringify(input.variant), input.successMetric, JSON.stringify(input.guardrails),
      input.observationWindowStart, input.observationWindowEnd, input.status ?? "draft", new Date().toISOString(), new Date().toISOString(),
    );
  }

  async assign(context: RequestContext, experimentId: string, subjectKey: string, now: string): Promise<SeoExperimentArm> {
    const scope = this.scope(context);
    const existing = await this.database.first<{ arm: SeoExperimentArm }>(
      `SELECT arm FROM seo_experiment_assignments WHERE experiment_id=? AND subject_key=? AND organization_id=? AND workspace_id IS ? LIMIT 1`,
      experimentId, subjectKey, scope.organizationId, scope.workspaceId,
    );
    if (existing) return existing.arm;
    const hash = await sha256(`${experimentId}:${subjectKey}`);
    const arm: SeoExperimentArm = Number.parseInt(hash.slice(0, 8), 16) % 2 === 0 ? "control" : "variant";
    await this.database.run(
      `INSERT INTO seo_experiment_assignments (id, organization_id, workspace_id, experiment_id, subject_key, arm, assigned_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      crypto.randomUUID(), scope.organizationId, scope.workspaceId, experimentId, subjectKey, arm, now,
    );
    return arm;
  }

  private scope(context: RequestContext): { organizationId: string; workspaceId: string | null } {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = context.workspaceId ? this.requireWorkspace({ workspaceId: context.workspaceId }) : null;
    return { organizationId, workspaceId };
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
