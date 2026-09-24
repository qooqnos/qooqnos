import { brandId, type EntityId, type RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type LoyaltyProgramStatus = "draft" | "active" | "paused" | "retired";
export type LoyaltyMembershipStatus = "invited" | "active" | "suspended" | "expired";
export type LoyaltyRewardStatus = "defined" | "available" | "reserved" | "redeemed" | "expired" | "revoked";

export interface LoyaltyProgramRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly businessId: EntityId | null;
  readonly name: string;
  readonly status: LoyaltyProgramStatus;
  readonly currentVersionId: EntityId | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LoyaltyProgramVersionRecord {
  readonly id: EntityId;
  readonly programId: EntityId;
  readonly version: number;
  readonly rules: Readonly<Record<string, unknown>>;
  readonly status: "draft" | "active" | "retired";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LoyaltyMembershipRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly programId: EntityId;
  readonly customerId: EntityId;
  readonly status: LoyaltyMembershipStatus;
  readonly tierKey: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LoyaltyLedgerEntryRecord {
  readonly id: EntityId;
  readonly membershipId: EntityId;
  readonly entryType: "earn" | "adjustment" | "expire" | "reverse" | "redeem";
  readonly pointsDelta: number;
  readonly referenceType: string | null;
  readonly referenceId: string | null;
  readonly idempotencyKey: string;
  readonly provenance: Readonly<Record<string, unknown>> | null;
  readonly createdAt: string;
}

export interface LoyaltyRewardRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly programId: EntityId;
  readonly name: string;
  readonly pointsCost: number;
  readonly rewardReference: string;
  readonly status: LoyaltyRewardStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LoyaltyRedemptionRecord {
  readonly id: EntityId;
  readonly rewardId: EntityId;
  readonly membershipId: EntityId;
  readonly ledgerEntryId: EntityId;
  readonly pointsCost: number;
  readonly benefitReference: string;
  readonly idempotencyKey: string;
  readonly createdAt: string;
}

export class LoyaltyRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async createProgram(context: RequestContext, input: {
    readonly id: EntityId;
    readonly name: string;
    readonly businessId?: EntityId;
    readonly now: string;
  }): Promise<LoyaltyProgramRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    if (!input.name.trim()) throw new DatabaseError("Loyalty program name is required");
    await this.database.run(
      "INSERT INTO loyalty_programs (id, organization_id, workspace_id, business_id, name, status, current_version_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', NULL, ?, ?)",
      input.id, organizationId, workspaceId, input.businessId ?? null, input.name.trim(), input.now, input.now,
    );
    return this.getProgram(context, input.id);
  }

  async getProgram(context: RequestContext, id: EntityId): Promise<LoyaltyProgramRecord> {
    const row = await this.database.first<LoyaltyProgramRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, name, status, current_version_id AS currentVersionId, created_at AS createdAt, updated_at AS updatedAt FROM loyalty_programs WHERE id=? AND organization_id=? AND workspace_id=? LIMIT 1",
      id, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    if (!row) throw new DatabaseError("Loyalty program not found");
    return row;
  }

  async createProgramVersion(context: RequestContext, input: {
    readonly id: EntityId;
    readonly programId: EntityId;
    readonly version: number;
    readonly rules: Readonly<Record<string, unknown>>;
    readonly now: string;
  }): Promise<LoyaltyProgramVersionRecord> {
    await this.getProgram(context, input.programId);
    if (!Number.isSafeInteger(input.version) || input.version < 1) throw new DatabaseError("Loyalty program version must be positive");
    await this.database.run(
      "INSERT INTO loyalty_program_versions (id, program_id, version, rules_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?)",
      input.id, input.programId, input.version, JSON.stringify(input.rules), input.now, input.now,
    );
    return this.getProgramVersion(context, input.id);
  }

  async getProgramVersion(context: RequestContext, id: EntityId): Promise<LoyaltyProgramVersionRecord> {
    const row = await this.database.first<LoyaltyProgramVersionRow>(
      "SELECT pv.id, pv.program_id AS programId, pv.version, pv.rules_json AS rulesJson, pv.status, pv.created_at AS createdAt, pv.updated_at AS updatedAt FROM loyalty_program_versions pv INNER JOIN loyalty_programs p ON p.id=pv.program_id WHERE pv.id=? AND p.organization_id=? AND p.workspace_id=? LIMIT 1",
      id, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    if (!row) throw new DatabaseError("Loyalty program version not found");
    return {
      id: row.id,
      programId: row.programId,
      version: row.version,
      rules: parseJson(row.rulesJson),
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async activateProgram(context: RequestContext, programId: EntityId, versionId: EntityId, now: string): Promise<LoyaltyProgramRecord> {
    const program = await this.getProgram(context, programId);
    const version = await this.getProgramVersion(context, versionId);
    if (version.programId !== program.id) throw new DatabaseError("Loyalty version does not belong to program");
    await this.database.transaction([
      { sql: "UPDATE loyalty_program_versions SET status='retired', updated_at=? WHERE program_id=? AND status='active' AND id<>?", params: [now, programId, versionId] },
      { sql: "UPDATE loyalty_program_versions SET status='active', updated_at=? WHERE id=? AND program_id=?", params: [now, versionId, programId] },
      { sql: "UPDATE loyalty_programs SET status='active', current_version_id=?, updated_at=? WHERE id=? AND organization_id=? AND workspace_id=?", params: [versionId, now, programId, program.organizationId, program.workspaceId] },
    ]);
    return this.getProgram(context, programId);
  }

  async enroll(context: RequestContext, input: {
    readonly id: EntityId;
    readonly programId: EntityId;
    readonly customerId: EntityId;
    readonly now: string;
  }): Promise<LoyaltyMembershipRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    await this.getProgram(context, input.programId);
    const existing = await this.database.first<LoyaltyMembershipRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, program_id AS programId, customer_id AS customerId, status, tier_key AS tierKey, created_at AS createdAt, updated_at AS updatedAt FROM loyalty_memberships WHERE organization_id=? AND workspace_id=? AND program_id=? AND customer_id=? LIMIT 1",
      organizationId, workspaceId, input.programId, input.customerId,
    );
    if (existing) return existing;
    await this.database.run(
      "INSERT INTO loyalty_memberships (id, organization_id, workspace_id, program_id, customer_id, status, tier_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', NULL, ?, ?)",
      input.id, organizationId, workspaceId, input.programId, input.customerId, input.now, input.now,
    );
    return this.getMembership(context, input.id);
  }

  async getMembership(context: RequestContext, id: EntityId): Promise<LoyaltyMembershipRecord> {
    const row = await this.database.first<LoyaltyMembershipRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, program_id AS programId, customer_id AS customerId, status, tier_key AS tierKey, created_at AS createdAt, updated_at AS updatedAt FROM loyalty_memberships WHERE id=? AND organization_id=? AND workspace_id=? LIMIT 1",
      id, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    if (!row) throw new DatabaseError("Loyalty membership not found");
    return row;
  }

  async balance(context: RequestContext, membershipId: EntityId): Promise<number> {
    await this.getMembership(context, membershipId);
    const row = await this.database.first<{ balance: number }>(
      "SELECT COALESCE(SUM(points_delta), 0) AS balance FROM loyalty_ledger_entries WHERE membership_id=? AND organization_id=? AND workspace_id=?",
      membershipId, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    return Number(row?.balance ?? 0);
  }

  async postLedger(context: RequestContext, input: {
    readonly id: EntityId;
    readonly membershipId: EntityId;
    readonly entryType: LoyaltyLedgerEntryRecord["entryType"];
    readonly pointsDelta: number;
    readonly referenceType?: string;
    readonly referenceId?: string;
    readonly idempotencyKey: string;
    readonly provenance?: Readonly<Record<string, unknown>>;
    readonly now: string;
  }): Promise<LoyaltyLedgerEntryRecord> {
    const membership = await this.getMembership(context, input.membershipId);
    const existing = await this.database.first<LoyaltyLedgerEntryRecord>(
      "SELECT id, membership_id AS membershipId, entry_type AS entryType, points_delta AS pointsDelta, reference_type AS referenceType, reference_id AS referenceId, idempotency_key AS idempotencyKey, provenance_json AS provenanceJson, created_at AS createdAt FROM loyalty_ledger_entries WHERE organization_id=? AND workspace_id=? AND idempotency_key=? LIMIT 1",
      membership.organizationId, membership.workspaceId, input.idempotencyKey.trim(),
    ) as (LoyaltyLedgerEntryRecord & { provenanceJson?: string | null }) | null;
    if (existing) return { ...existing, provenance: existing.provenanceJson ? parseJson(existing.provenanceJson) : null };
    if (input.entryType === "redeem" && input.pointsDelta >= 0) throw new DatabaseError("Redeem ledger entries must decrease points");
    const balance = await this.balance(context, membership.id);
    if (balance + input.pointsDelta < 0) throw new DatabaseError("Insufficient loyalty points");
    await this.database.run(
      "INSERT INTO loyalty_ledger_entries (id, organization_id, workspace_id, membership_id, entry_type, points_delta, reference_type, reference_id, idempotency_key, provenance_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id, membership.organizationId, membership.workspaceId, input.membershipId, input.entryType, input.pointsDelta,
      input.referenceType?.trim() || null, input.referenceId?.trim() || null, input.idempotencyKey.trim(),
      input.provenance ? JSON.stringify(input.provenance) : null, input.now,
    );
    const row = await this.database.first<LoyaltyLedgerEntryRow>(
      "SELECT id, membership_id AS membershipId, entry_type AS entryType, points_delta AS pointsDelta, reference_type AS referenceType, reference_id AS referenceId, idempotency_key AS idempotencyKey, provenance_json AS provenanceJson, created_at AS createdAt FROM loyalty_ledger_entries WHERE id=? LIMIT 1",
      input.id,
    );
    if (!row) throw new DatabaseError("Loyalty ledger entry not found after creation");
    return { ...row, provenance: row.provenanceJson ? parseJson(row.provenanceJson) : null };
  }

  async listLedger(context: RequestContext, membershipId: EntityId): Promise<readonly LoyaltyLedgerEntryRecord[]> {
    await this.getMembership(context, membershipId);
    const rows = await this.database.all<LoyaltyLedgerEntryRow>(
      "SELECT id, membership_id AS membershipId, entry_type AS entryType, points_delta AS pointsDelta, reference_type AS referenceType, reference_id AS referenceId, idempotency_key AS idempotencyKey, provenance_json AS provenanceJson, created_at AS createdAt FROM loyalty_ledger_entries WHERE membership_id=? AND organization_id=? AND workspace_id=? ORDER BY created_at DESC, id DESC",
      membershipId, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    return rows.map((row) => ({ ...row, provenance: row.provenanceJson ? parseJson(row.provenanceJson) : null }));
  }

  async createReward(context: RequestContext, input: {
    readonly id: EntityId;
    readonly programId: EntityId;
    readonly name: string;
    readonly pointsCost: number;
    readonly rewardReference: string;
    readonly now: string;
  }): Promise<LoyaltyRewardRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    await this.getProgram(context, input.programId);
    if (!input.name.trim() || input.pointsCost <= 0) throw new DatabaseError("Reward name and positive points cost are required");
    await this.database.run(
      "INSERT INTO loyalty_rewards (id, organization_id, workspace_id, program_id, name, points_cost, reward_reference, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?, ?)",
      input.id, organizationId, workspaceId, input.programId, input.name.trim(), input.pointsCost, input.rewardReference.trim(), input.now, input.now,
    );
    return this.getReward(context, input.id);
  }

  async getReward(context: RequestContext, id: EntityId): Promise<LoyaltyRewardRecord> {
    const row = await this.database.first<LoyaltyRewardRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, program_id AS programId, name, points_cost AS pointsCost, reward_reference AS rewardReference, status, created_at AS createdAt, updated_at AS updatedAt FROM loyalty_rewards WHERE id=? AND organization_id=? AND workspace_id=? LIMIT 1",
      id, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    if (!row) throw new DatabaseError("Loyalty reward not found");
    return row;
  }

  async listRewards(context: RequestContext, programId: EntityId): Promise<readonly LoyaltyRewardRecord[]> {
    await this.getProgram(context, programId);
    return this.database.all<LoyaltyRewardRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, program_id AS programId, name, points_cost AS pointsCost, reward_reference AS rewardReference, status, created_at AS createdAt, updated_at AS updatedAt FROM loyalty_rewards WHERE program_id=? AND organization_id=? AND workspace_id=? ORDER BY created_at DESC",
      programId, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
  }

  async redeemReward(context: RequestContext, input: {
    readonly id: EntityId;
    readonly rewardId: EntityId;
    readonly membershipId: EntityId;
    readonly benefitReference: string;
    readonly idempotencyKey: string;
    readonly now: string;
  }): Promise<LoyaltyRedemptionRecord> {
    const reward = await this.getReward(context, input.rewardId);
    const membership = await this.getMembership(context, input.membershipId);
    if (reward.programId !== membership.programId) throw new DatabaseError("Reward does not belong to membership program");
    if (reward.status !== "available") throw new DatabaseError("Only available loyalty rewards can be redeemed");

    const existing = await this.database.first<LoyaltyRedemptionRecord>(
      "SELECT id, reward_id AS rewardId, membership_id AS membershipId, ledger_entry_id AS ledgerEntryId, points_cost AS pointsCost, benefit_reference AS benefitReference, idempotency_key AS idempotencyKey, created_at AS createdAt FROM loyalty_reward_redemptions WHERE organization_id=? AND workspace_id=? AND idempotency_key=? LIMIT 1",
      membership.organizationId,
      membership.workspaceId,
      input.idempotencyKey.trim(),
    );
    if (existing) return existing;

    const ledgerId = brandId<"EntityId">(input.id + ":ledger");
    const ledgerIdempotencyKey = input.idempotencyKey.trim() + ":ledger";
    const results = await this.database.transaction([
      {
        sql: `INSERT INTO loyalty_ledger_entries
          (id, organization_id, workspace_id, membership_id, entry_type, points_delta, reference_type, reference_id, idempotency_key, provenance_json, created_at)
          SELECT ?, ?, ?, ?, 'redeem', ?, 'loyalty_reward', ?, ?, ?, ?
          WHERE EXISTS (
            SELECT 1 FROM loyalty_memberships
            WHERE id=? AND organization_id=? AND workspace_id=?
          )
          AND (
            SELECT COALESCE(SUM(points_delta), 0)
            FROM loyalty_ledger_entries
            WHERE membership_id=? AND organization_id=? AND workspace_id=?
          ) >= ?`,
        params: [
          ledgerId,
          membership.organizationId,
          membership.workspaceId,
          membership.id,
          -reward.pointsCost,
          reward.id,
          ledgerIdempotencyKey,
          JSON.stringify({ benefitReference: input.benefitReference, rewardId: reward.id }),
          input.now,
          membership.id,
          membership.organizationId,
          membership.workspaceId,
          membership.id,
          membership.organizationId,
          membership.workspaceId,
          reward.pointsCost,
        ],
      },
      {
        sql: `INSERT INTO loyalty_reward_redemptions
          (id, organization_id, workspace_id, reward_id, membership_id, ledger_entry_id, points_cost, benefit_reference, idempotency_key, created_at)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE EXISTS (
            SELECT 1 FROM loyalty_ledger_entries
            WHERE id=? AND organization_id=? AND workspace_id=? AND idempotency_key=?
          )`,
        params: [
          input.id,
          membership.organizationId,
          membership.workspaceId,
          reward.id,
          membership.id,
          ledgerId,
          reward.pointsCost,
          input.benefitReference.trim(),
          input.idempotencyKey.trim(),
          input.now,
          ledgerId,
          membership.organizationId,
          membership.workspaceId,
          ledgerIdempotencyKey,
        ],
      },
    ]);

    const ledgerInserted = (results[0]?.meta?.changes ?? 0) === 1;
    const redemptionInserted = (results[1]?.meta?.changes ?? 0) === 1;
    if (!ledgerInserted || !redemptionInserted) {
      throw new DatabaseError("Insufficient loyalty points or redemption concurrency rejected");
    }

    return {
      id: input.id,
      rewardId: reward.id,
      membershipId: membership.id,
      ledgerEntryId: ledgerId,
      pointsCost: reward.pointsCost,
      benefitReference: input.benefitReference.trim(),
      idempotencyKey: input.idempotencyKey.trim(),
      createdAt: input.now,
    };
  }
}

interface LoyaltyProgramVersionRow { readonly id: EntityId; readonly programId: EntityId; readonly version: number; readonly rulesJson: string; readonly status: "draft" | "active" | "retired"; readonly createdAt: string; readonly updatedAt: string; }
interface LoyaltyLedgerEntryRow { readonly id: EntityId; readonly membershipId: EntityId; readonly entryType: LoyaltyLedgerEntryRecord["entryType"]; readonly pointsDelta: number; readonly referenceType: string | null; readonly referenceId: string | null; readonly idempotencyKey: string; readonly provenanceJson: string | null; readonly createdAt: string; }

function parseJson(value: string): Readonly<Record<string, unknown>> {
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new DatabaseError("Stored loyalty JSON is invalid");
  return parsed as Readonly<Record<string, unknown>>;
}
