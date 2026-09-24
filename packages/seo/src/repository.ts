import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";
import type { SeoProjectionPlan } from "./projection";
import type { SeoEntity } from "./types";
import { auditEntity } from "./audit";

export interface SeoRepresentationRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly entityId: string;
  readonly entityType: string;
  readonly locale: string;
  readonly canonicalUrl: string;
  readonly indexability: string;
  readonly contentHash: string;
  readonly generatedAt: string;
}

export interface SaveSeoRepresentationInput {
  readonly id: EntityId;
  readonly plan: SeoProjectionPlan;
  readonly contentHash: string;
  readonly sourceUpdatedAt: string;
  readonly sourceVersion: string;
  readonly now: string;
}

export interface SaveSeoArtifactInput {
  readonly id: EntityId;
  readonly representationId: EntityId;
  readonly artifactType: "metadata" | "structured-data" | "answer" | "sitemap" | "robots" | "internal-links";
  readonly artifactVersion: number;
  readonly payload: unknown;
  readonly contentHash: string;
  readonly now: string;
}

export class SeoRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async saveRepresentation(
    context: RequestContext,
    input: SaveSeoRepresentationInput,
  ): Promise<SeoRepresentationRecord> {
    const scope = this.scope(context);
    if (!input.id.trim() || !input.contentHash.trim()) throw new DatabaseError("SEO representation identity and content hash are required");
    await this.database.run(
      `INSERT INTO seo_entity_representations
        (id, organization_id, workspace_id, entity_id, entity_type, locale, source_module, source_version,
         publication_state, visibility, canonical_url, indexability, representation_json, source_updated_at,
         generated_at, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(organization_id, workspace_id, entity_id, entity_type, locale)
       DO UPDATE SET source_module=excluded.source_module, source_version=excluded.source_version,
         publication_state=excluded.publication_state, visibility=excluded.visibility,
         canonical_url=excluded.canonical_url, indexability=excluded.indexability,
         representation_json=excluded.representation_json, source_updated_at=excluded.source_updated_at,
         generated_at=excluded.generated_at, content_hash=excluded.content_hash
       WHERE seo_entity_representations.source_updated_at <= excluded.source_updated_at
         AND seo_entity_representations.source_version <= excluded.source_version`,
      input.id,
      scope.organizationId,
      scope.workspaceId,
      input.plan.entityId,
      input.plan.entityType,
      input.plan.locale,
      input.plan.sourceModule,
      input.sourceVersion,
      input.plan.publicationState,
      input.plan.visibility,
      input.plan.canonicalUrl,
      input.plan.policy.indexability,
      JSON.stringify({
        entity: input.plan.entity,
        metadata: input.plan.metadata,
        structuredData: input.plan.structuredData,
        answer: input.plan.answer,
        geoSignal: input.plan.geoSignal,
        audit: input.plan.audit,
        internalLinks: input.plan.internalLinks,
      }),
      input.sourceUpdatedAt,
      input.now,
      input.contentHash,
    );
    const row = await this.database.first<SeoRepresentationRecord>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
          entity_id AS entityId, entity_type AS entityType, locale, canonical_url AS canonicalUrl,
          indexability, content_hash AS contentHash, generated_at AS generatedAt
       FROM seo_entity_representations
       WHERE organization_id = ? AND workspace_id IS ? AND entity_id = ? AND entity_type = ? AND locale = ?
       LIMIT 1`,
      scope.organizationId,
      scope.workspaceId,
      input.plan.entityId,
      input.plan.entityType,
      input.plan.locale,
    );
    if (!row) throw new DatabaseError("SEO representation not found after save");
    return row;
  }

  async publishRepresentationBundle(
    context: RequestContext,
    input: SaveSeoRepresentationInput,
    artifacts: readonly SaveSeoArtifactInput[],
    dependencies: readonly { entityId: string; entityType: string; version: string }[],
  ): Promise<SeoRepresentationRecord> {
    const scope = this.scope(context);
    if (!input.id.trim() || !input.contentHash.trim()) throw new DatabaseError("SEO representation identity and content hash are required");
    if (artifacts.some((artifact) => artifact.representationId !== input.id)) {
      throw new DatabaseError("SEO artifact representation does not match publication bundle");
    }
    if (artifacts.some((artifact) => !Number.isInteger(artifact.artifactVersion) || artifact.artifactVersion < 1)) {
      throw new DatabaseError("SEO artifact version must be positive");
    }
    const representationJson = JSON.stringify({
      entity: input.plan.entity,
      metadata: input.plan.metadata,
      structuredData: input.plan.structuredData,
      answer: input.plan.answer,
      geoSignal: input.plan.geoSignal,
      audit: input.plan.audit,
      internalLinks: input.plan.internalLinks,
    });
    const statements = [
      {
        sql: `INSERT INTO seo_entity_representations
          (id, organization_id, workspace_id, entity_id, entity_type, locale, source_module, source_version,
           publication_state, visibility, canonical_url, indexability, representation_json, source_updated_at,
           generated_at, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(organization_id, workspace_id, entity_id, entity_type, locale)
         DO UPDATE SET source_module=excluded.source_module, source_version=excluded.source_version,
           publication_state=excluded.publication_state, visibility=excluded.visibility,
           canonical_url=excluded.canonical_url, indexability=excluded.indexability,
           representation_json=excluded.representation_json, source_updated_at=excluded.source_updated_at,
           generated_at=excluded.generated_at, content_hash=excluded.content_hash
         WHERE seo_entity_representations.source_updated_at <= excluded.source_updated_at
           AND seo_entity_representations.source_version <= excluded.source_version`,
        params: [input.id, scope.organizationId, scope.workspaceId, input.plan.entityId, input.plan.entityType,
          input.plan.locale, input.plan.sourceModule, input.sourceVersion, input.plan.publicationState,
          input.plan.visibility, input.plan.canonicalUrl, input.plan.policy.indexability, representationJson,
          input.sourceUpdatedAt, input.now, input.contentHash],
      },
      {
        sql: `DELETE FROM seo_artifacts
          WHERE representation_id = ? AND organization_id = ? AND workspace_id IS ?
            AND EXISTS (
              SELECT 1 FROM seo_entity_representations r
              WHERE r.id = seo_artifacts.representation_id
                AND r.organization_id = ? AND r.workspace_id IS ?
                AND r.source_updated_at = ? AND r.source_version = ? AND r.content_hash = ?
            )`,
        params: [input.id, scope.organizationId, scope.workspaceId, scope.organizationId, scope.workspaceId,
          input.sourceUpdatedAt, input.sourceVersion, input.contentHash],
      },
      ...artifacts.map((artifact) => ({
        sql: `INSERT INTO seo_artifacts
          (id, organization_id, workspace_id, representation_id, artifact_type, artifact_version,
           payload_json, content_hash, generated_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM seo_entity_representations r
           WHERE r.id = ? AND r.organization_id = ? AND r.workspace_id IS ?
             AND r.source_updated_at = ? AND r.source_version = ? AND r.content_hash = ?
         )`,
        params: [artifact.id, scope.organizationId, scope.workspaceId, artifact.representationId, artifact.artifactType,
          artifact.artifactVersion, JSON.stringify(artifact.payload), artifact.contentHash, artifact.now,
          artifact.representationId, scope.organizationId, scope.workspaceId, input.sourceUpdatedAt, input.sourceVersion, input.contentHash],
      })),
      {
        sql: `DELETE FROM seo_dependencies
          WHERE representation_id = ? AND organization_id = ? AND workspace_id IS ?
            AND EXISTS (
              SELECT 1 FROM seo_entity_representations r
              WHERE r.id = seo_dependencies.representation_id
                AND r.organization_id = ? AND r.workspace_id IS ?
                AND r.source_updated_at = ? AND r.source_version = ? AND r.content_hash = ?
            )`,
        params: [input.id, scope.organizationId, scope.workspaceId, scope.organizationId, scope.workspaceId,
          input.sourceUpdatedAt, input.sourceVersion, input.contentHash],
      },
      ...dependencies
        .filter((dependency) => dependency.entityId.trim() && dependency.entityType.trim() && dependency.version.trim())
        .map((dependency) => ({
          sql: `INSERT INTO seo_dependencies
            (organization_id, workspace_id, representation_id, dependency_entity_id, dependency_entity_type, dependency_version)
           SELECT ?, ?, ?, ?, ?, ?
           WHERE EXISTS (
             SELECT 1 FROM seo_entity_representations r
             WHERE r.id = ? AND r.organization_id = ? AND r.workspace_id IS ?
               AND r.source_updated_at = ? AND r.source_version = ? AND r.content_hash = ?
           )`,
          params: [scope.organizationId, scope.workspaceId, input.id, dependency.entityId, dependency.entityType, dependency.version,
            input.id, scope.organizationId, scope.workspaceId, input.sourceUpdatedAt, input.sourceVersion, input.contentHash],
        })),
    ];
    await this.database.transaction(statements);
    const row = await this.database.first<SeoRepresentationRecord>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId,
          entity_id AS entityId, entity_type AS entityType, locale, canonical_url AS canonicalUrl,
          indexability, content_hash AS contentHash, generated_at AS generatedAt
       FROM seo_entity_representations
       WHERE organization_id = ? AND workspace_id IS ? AND entity_id = ? AND entity_type = ? AND locale = ?
       LIMIT 1`,
      scope.organizationId, scope.workspaceId, input.plan.entityId, input.plan.entityType, input.plan.locale,
    );
    if (!row) throw new DatabaseError("SEO representation not found after atomic publication");
    return row;
  }

  async saveAudit(context: RequestContext, input: { id: EntityId; entity: SeoEntity; canonicalUrl: string; indexability: string; now: string }): Promise<void> {
    const scope = this.scope(context);
    const audit = auditEntity(input.entity, input.canonicalUrl, input.indexability, input.now);
    await this.database.run(`INSERT INTO seo_audits (id, organization_id, workspace_id, entity_id, entity_type, generated_at, scores_json, issues_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, input.id, scope.organizationId, scope.workspaceId, input.entity.id, input.entity.type, input.now, JSON.stringify(audit.scores), JSON.stringify(audit.issues));
  }

  async getLatestAudit(context: RequestContext, entityId: string): Promise<{ generatedAt: string; scores: Record<string, number>; issues: unknown[] } | null> {
    const scope = this.scope(context);
    const row = await this.database.first<{ generatedAt: string; scoresJson: string; issuesJson: string }>(`SELECT generated_at AS generatedAt, scores_json AS scoresJson, issues_json AS issuesJson FROM seo_audits WHERE organization_id=? AND workspace_id IS ? AND entity_id=? ORDER BY generated_at DESC LIMIT 1`, scope.organizationId, scope.workspaceId, entityId);
    return row ? { generatedAt: row.generatedAt, scores: JSON.parse(row.scoresJson) as Record<string, number>, issues: JSON.parse(row.issuesJson) as unknown[] } : null;
  }

  async getRepresentation(context: RequestContext, entityId: string, locale?: string): Promise<{ entity: SeoEntity; canonicalUrl: string; indexability: string } | null> {
    const scope = this.scope(context);
    const row = await this.database.first<{ representationJson: string; canonicalUrl: string; indexability: string }>(`SELECT representation_json AS representationJson, canonical_url AS canonicalUrl, indexability FROM seo_entity_representations WHERE organization_id=? AND workspace_id IS ? AND entity_id=?${locale ? " AND locale=?" : ""} ORDER BY generated_at DESC LIMIT 1`, ...(locale ? [scope.organizationId, scope.workspaceId, entityId, locale] : [scope.organizationId, scope.workspaceId, entityId]));
    if (!row) return null;
    const entity = (JSON.parse(row.representationJson) as { entity?: SeoEntity }).entity;
    return entity ? { entity, canonicalUrl: row.canonicalUrl, indexability: row.indexability } : null;
  }

  async saveArtifact(context: RequestContext, input: SaveSeoArtifactInput): Promise<void> {
    const scope = this.scope(context);
    if (!Number.isInteger(input.artifactVersion) || input.artifactVersion < 1) throw new DatabaseError("SEO artifact version must be positive");
    await this.database.run(
      `INSERT INTO seo_artifacts
        (id, organization_id, workspace_id, representation_id, artifact_type, artifact_version,
         payload_json, content_hash, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(representation_id, artifact_type, artifact_version)
       DO UPDATE SET payload_json=excluded.payload_json, content_hash=excluded.content_hash, generated_at=excluded.generated_at`,
      input.id, scope.organizationId, scope.workspaceId, input.representationId, input.artifactType,
      input.artifactVersion, JSON.stringify(input.payload), input.contentHash, input.now,
    );
  }

  async replaceDependencies(
    context: RequestContext,
    representationId: EntityId,
    dependencies: readonly { entityId: string; entityType: string; version: string }[],
  ): Promise<void> {
    const scope = this.scope(context);
    const statements = [
      {
        sql: "DELETE FROM seo_dependencies WHERE representation_id = ? AND organization_id = ? AND workspace_id IS ?",
        params: [representationId, scope.organizationId, scope.workspaceId],
      },
      ...dependencies
        .filter((dependency) => dependency.entityId.trim() && dependency.entityType.trim() && dependency.version.trim())
        .map((dependency) => ({
          sql: `INSERT INTO seo_dependencies
            (organization_id, workspace_id, representation_id, dependency_entity_id, dependency_entity_type, dependency_version)
           VALUES (?, ?, ?, ?, ?, ?)`,
          params: [
            scope.organizationId,
            scope.workspaceId,
            representationId,
            dependency.entityId,
            dependency.entityType,
            dependency.version,
          ],
        })),
    ];
    await this.database.transaction(statements);
  }

  private scope(context: RequestContext): { organizationId: string; workspaceId: string | null } {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = context.workspaceId ? this.requireWorkspace({ workspaceId: context.workspaceId }) : null;
    return { organizationId, workspaceId };
  }
}
