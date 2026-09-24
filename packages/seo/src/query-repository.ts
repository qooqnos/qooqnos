import type { RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type SeoQueryIntent = "informational"|"navigational"|"local"|"transactional"|"comparison"|"recommendation"|"booking"|"product-discovery"|"problem-to-provider";

export interface UpsertSeoQueryInput {
  readonly id: string;
  readonly queryText: string;
  readonly locale: string;
  readonly intent: SeoQueryIntent;
  readonly locationId?: string;
  readonly entityId?: string;
  readonly entityType?: string;
}

export class SeoQueryRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async upsert(context: RequestContext, input: UpsertSeoQueryInput): Promise<void> {
    const scope=this.scope(context);
    const normalized=normalizeQuery(input.queryText);
    if (!normalized) throw new DatabaseError("SEO query cannot be empty");
    await this.database.run(
      `INSERT INTO seo_queries
       (id, organization_id, workspace_id, query_text, normalized_query, locale, intent, location_id, entity_id, entity_type, lifecycle_state, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
       ON CONFLICT(organization_id, workspace_id, normalized_query, locale, intent, location_id, entity_id)
       DO UPDATE SET query_text=excluded.query_text, entity_type=excluded.entity_type, lifecycle_state='active', updated_at=excluded.updated_at`,
      input.id,scope.organizationId,scope.workspaceId,input.queryText.trim(),normalized,input.locale,input.intent,
      input.locationId??null,input.entityId??null,input.entityType??null,new Date().toISOString(),new Date().toISOString()
    );
  }

  async list(context: RequestContext, locale: string, intent?: SeoQueryIntent): Promise<readonly Record<string,unknown>[]> {
    const scope=this.scope(context);
    return this.database.all(
      `SELECT id, query_text AS queryText, normalized_query AS normalizedQuery, locale, intent, location_id AS locationId,
       entity_id AS entityId, entity_type AS entityType, lifecycle_state AS lifecycleState, updated_at AS updatedAt
       FROM seo_queries WHERE organization_id=? AND workspace_id IS ? AND locale=? AND lifecycle_state='active'
       ${intent ? "AND intent=?" : ""} ORDER BY normalized_query ASC`,
      ...(intent ? [scope.organizationId,scope.workspaceId,locale,intent] : [scope.organizationId,scope.workspaceId,locale]),
    );
  }

  private scope(context: RequestContext){return {organizationId:this.requireOrganization({organizationId:context.tenantId}),workspaceId:context.workspaceId?this.requireWorkspace({workspaceId:context.workspaceId}):null};}
}

export function normalizeQuery(value:string):string{
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\\s+/g," ");
}
