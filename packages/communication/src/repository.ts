import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type CommunicationChannel = "in_app" | "whatsapp" | "sms" | "email";
export type CommunicationPriority = "low" | "normal" | "high" | "urgent";
export type CommunicationMessageStatus =
  | "created" | "policy_checked" | "queued" | "provider_accepted" | "sent"
  | "delivered" | "read" | "failed" | "rejected" | "expired" | "cancelled" | "suppressed";

export interface ConversationRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly customerId: EntityId | null;
  readonly status: "open" | "closed" | "archived";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MessageRecord {
  readonly id: EntityId;
  readonly conversationId: EntityId;
  readonly senderReference: string;
  readonly content: string;
  readonly classification: string;
  readonly status: CommunicationMessageStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NotificationRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly recipientReference: string;
  readonly intent: string;
  readonly channel: CommunicationChannel;
  readonly templateReference: string | null;
  readonly templateVersion: string | null;
  readonly locale: string | null;
  readonly variables: Readonly<Record<string, unknown>> | null;
  readonly priority: CommunicationPriority;
  readonly status: CommunicationMessageStatus;
  readonly idempotencyKey: string;
  readonly scheduledAt: string | null;
  readonly expiresAt: string | null;
  readonly policyVersion: string | null;
  readonly lastPolicyEvaluatedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CommunicationTemplateRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId | null;
  readonly workspaceId: EntityId | null;
  readonly templateKey: string;
  readonly intent: string;
  readonly channel: CommunicationChannel;
  readonly ownerReference: string;
  readonly status: "draft" | "active" | "retired";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CommunicationTemplateVersionRecord {
  readonly id: EntityId;
  readonly templateId: EntityId;
  readonly version: number;
  readonly locale: string;
  readonly variablesSchema: Readonly<Record<string, unknown>>;
  readonly contentReference: string;
  readonly contentChecksum: string;
  readonly approvalState: "not_required" | "pending" | "approved" | "rejected" | "expired";
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DeliveryAttemptRecord {
  readonly id: EntityId;
  readonly notificationId: EntityId;
  readonly provider: string;
  readonly channel: CommunicationChannel;
  readonly status: "accepted" | "queued" | "sent" | "delivered" | "read" | "failed" | "rejected" | "expired";
  readonly attemptedAt: string;
  readonly providerReference: string | null;
  readonly retryCount: number;
  readonly nextRetryAt: string | null;
  readonly failureCode: string | null;
  readonly failureClass: "transient" | "permanent" | null;
  readonly metadata: Readonly<Record<string, unknown>> | null;
  readonly createdAt: string;
}

export class CommunicationRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async createTemplate(context: RequestContext, input: {
    readonly id: EntityId;
    readonly templateKey: string;
    readonly intent: string;
    readonly channel: CommunicationChannel;
    readonly ownerReference: string;
    readonly status?: "draft" | "active" | "retired";
    readonly now: string;
  }): Promise<CommunicationTemplateRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = context.workspaceId ?? null;
    if (!input.templateKey.trim() || !input.intent.trim() || !input.ownerReference.trim()) {
      throw new DatabaseError("Communication template key, intent and owner reference are required");
    }
    await this.database.run(
      "INSERT INTO communication_templates (id, organization_id, workspace_id, template_key, intent, channel, owner_reference, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      organizationId,
      workspaceId,
      input.templateKey.trim(),
      input.intent.trim(),
      input.channel,
      input.ownerReference.trim(),
      input.status ?? "draft",
      input.now,
      input.now,
    );
    return this.getTemplate(context, input.id);
  }

  async getTemplate(context: RequestContext, id: EntityId): Promise<CommunicationTemplateRecord> {
    const row = await this.database.first<CommunicationTemplateRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, template_key AS templateKey, intent, channel, owner_reference AS ownerReference, status, created_at AS createdAt, updated_at AS updatedAt FROM communication_templates WHERE id=? AND organization_id=? AND (workspace_id IS NULL OR workspace_id=?) LIMIT 1",
      id,
      this.requireOrganization({ organizationId: context.tenantId }),
      context.workspaceId ?? null,
    );
    if (!row) throw new DatabaseError("Communication template not found");
    return row;
  }

  async createTemplateVersion(context: RequestContext, input: {
    readonly id: EntityId;
    readonly templateId: EntityId;
    readonly version: number;
    readonly locale: string;
    readonly variablesSchema: Readonly<Record<string, unknown>>;
    readonly contentReference: string;
    readonly contentChecksum: string;
    readonly approvalState?: CommunicationTemplateVersionRecord["approvalState"];
    readonly effectiveFrom?: string;
    readonly effectiveTo?: string;
    readonly now: string;
  }): Promise<CommunicationTemplateVersionRecord> {
    const template = await this.getTemplate(context, input.templateId);
    if (!Number.isSafeInteger(input.version) || input.version < 1) {
      throw new DatabaseError("Communication template version must be a positive integer");
    }
    if (!input.locale.trim() || !input.contentReference.trim() || !input.contentChecksum.trim()) {
      throw new DatabaseError("Communication template version metadata is incomplete");
    }
    await this.database.run(
      "INSERT INTO communication_template_versions (id, template_id, version, locale, variables_schema_json, content_reference, content_checksum, approval_state, effective_from, effective_to, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      template.id,
      input.version,
      input.locale.trim(),
      JSON.stringify(input.variablesSchema),
      input.contentReference.trim(),
      input.contentChecksum.trim(),
      input.approvalState ?? "pending",
      input.effectiveFrom ?? null,
      input.effectiveTo ?? null,
      context.actorId ?? "system",
      input.now,
      input.now,
    );
    return this.getTemplateVersion(context, input.id);
  }

  async getTemplateVersion(context: RequestContext, id: EntityId): Promise<CommunicationTemplateVersionRecord> {
    const row = await this.database.first<CommunicationTemplateVersionRow>(
      "SELECT v.id,v.template_id AS templateId,v.version,v.locale,v.variables_schema_json AS variablesSchemaJson,v.content_reference AS contentReference,v.content_checksum AS contentChecksum,v.approval_state AS approvalState,v.effective_from AS effectiveFrom,v.effective_to AS effectiveTo,v.created_by AS createdBy,v.created_at AS createdAt,v.updated_at AS updatedAt FROM communication_template_versions v INNER JOIN communication_templates t ON t.id=v.template_id WHERE v.id=? AND t.organization_id=? AND (t.workspace_id IS NULL OR t.workspace_id=?) LIMIT 1",
      id,
      this.requireOrganization({ organizationId: context.tenantId }),
      context.workspaceId ?? null,
    );
    if (!row) throw new DatabaseError("Communication template version not found");
    return hydrateTemplateVersion(row);
  }

  async approveTemplateVersion(
    context: RequestContext,
    templateVersionId: EntityId,
    now: string,
  ): Promise<CommunicationTemplateVersionRecord> {
    const version = await this.getTemplateVersion(context, templateVersionId);
    if (version.approvalState === "approved") return version;
    if (version.approvalState === "rejected" || version.approvalState === "expired") {
      throw new DatabaseError("Rejected or expired Communication template version cannot be approved");
    }
    await this.database.run(
      "UPDATE communication_template_versions SET approval_state='approved', updated_at=? WHERE id=? AND approval_state IN ('pending','not_required')",
      now,
      templateVersionId,
    );
    return this.getTemplateVersion(context, templateVersionId);
  }

  async getApprovedTemplateVersion(
    context: RequestContext,
    input: {
      readonly templateKey: string;
      readonly version: number;
      readonly channel: CommunicationChannel;
      readonly locale: string;
      readonly intent: string;
      readonly now: string;
    },
  ): Promise<CommunicationTemplateVersionRecord> {
    const row = await this.database.first<CommunicationTemplateVersionRow>(
      "SELECT v.id,v.template_id AS templateId,v.version,v.locale,v.variables_schema_json AS variablesSchemaJson,v.content_reference AS contentReference,v.content_checksum AS contentChecksum,v.approval_state AS approvalState,v.effective_from AS effectiveFrom,v.effective_to AS effectiveTo,v.created_by AS createdBy,v.created_at AS createdAt,v.updated_at AS updatedAt FROM communication_template_versions v INNER JOIN communication_templates t ON t.id=v.template_id WHERE t.organization_id=? AND (t.workspace_id IS NULL OR t.workspace_id=?) AND t.template_key=? AND t.channel=? AND t.intent=? AND t.status='active' AND v.version=? AND v.locale=? AND v.approval_state='approved' AND (v.effective_from IS NULL OR v.effective_from <= ?) AND (v.effective_to IS NULL OR v.effective_to > ?) LIMIT 1",
      this.requireOrganization({ organizationId: context.tenantId }),
      context.workspaceId ?? null,
      input.templateKey.trim(),
      input.channel,
      input.intent.trim(),
      input.version,
      input.locale.trim(),
      input.now,
      input.now,
    );
    if (!row) throw new DatabaseError("Approved Communication template version not found");
    return hydrateTemplateVersion(row);
  }

  async createConversation(context: RequestContext, input: {
    id: EntityId; customerId?: EntityId; now: string;
  }): Promise<ConversationRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = context.workspaceId ?? null;
    await this.database.run(
      "INSERT INTO communication_conversations (id, organization_id, workspace_id, customer_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'open', ?, ?)",
      input.id, organizationId, workspaceId, input.customerId ?? null, input.now, input.now,
    );
    const record = await this.getConversation(context, input.id);
    if (!record) throw new DatabaseError("Communication conversation not found after creation");
    return record;
  }

  async getConversation(context: RequestContext, id: EntityId): Promise<ConversationRecord | null> {
    return this.database.first<ConversationRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, customer_id AS customerId, status, created_at AS createdAt, updated_at AS updatedAt FROM communication_conversations WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) LIMIT 1",
      id, this.requireOrganization({ organizationId: context.tenantId }), context.workspaceId ?? null,
    );
  }

  async sendMessage(context: RequestContext, input: {
    id: EntityId; conversationId: EntityId; senderReference: string;
    content: string; classification: string; now: string;
  }): Promise<MessageRecord> {
    const conversation = await this.getConversation(context, input.conversationId);
    if (!conversation) throw new DatabaseError("Communication conversation not found");
    if (!input.content.trim()) throw new DatabaseError("Communication message content is required");
    await this.database.run(
      "INSERT INTO communication_messages (id, conversation_id, sender_reference, content, classification, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'created', ?, ?)",
      input.id, input.conversationId, input.senderReference.trim(), input.content, input.classification.trim(), input.now, input.now,
    );
    return this.getMessage(context, input.id);
  }

  async getMessage(context: RequestContext, id: EntityId): Promise<MessageRecord> {
    const row = await this.database.first<MessageRecord>(
      "SELECT m.id, m.conversation_id AS conversationId, m.sender_reference AS senderReference, m.content, m.classification, m.status, m.created_at AS createdAt, m.updated_at AS updatedAt FROM communication_messages m INNER JOIN communication_conversations c ON c.id = m.conversation_id WHERE m.id = ? AND c.organization_id = ? AND (c.workspace_id IS NULL OR c.workspace_id = ?) LIMIT 1",
      id, this.requireOrganization({ organizationId: context.tenantId }), context.workspaceId ?? null,
    );
    if (!row) throw new DatabaseError("Communication message not found");
    return row;
  }

  async evaluateNotificationPolicy(
    context: RequestContext,
    input: {
      readonly recipientReference: string;
      readonly intent: string;
      readonly channel: CommunicationChannel;
      readonly now: string;
    },
  ): Promise<{
    readonly result: "allowed" | "denied" | "suppressed";
    readonly reasonCode: string | null;
    readonly policyVersion: string;
    readonly preferenceReference: EntityId | null;
    readonly suppressionReference: EntityId | null;
  }> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = context.workspaceId ?? null;

    const policy = await this.database.first<CommunicationIntentPolicyRow>(
      "SELECT id, intent_key AS intentKey, category, requires_opt_in AS requiresOptIn, allowed_channels_json AS allowedChannelsJson, policy_version AS policyVersion, status FROM communication_intents WHERE intent_key = ? AND status = 'active' LIMIT 1",
      input.intent.trim(),
    );
    if (!policy) {
      return {
        result: "denied",
        reasonCode: "intent_policy_not_active",
        policyVersion: "unknown",
        preferenceReference: null,
        suppressionReference: null,
      };
    }

    const allowedChannels = parseStringArray(policy.allowedChannelsJson);
    if (!allowedChannels.includes(input.channel)) {
      return {
        result: "denied",
        reasonCode: "channel_not_allowed",
        policyVersion: policy.policyVersion,
        preferenceReference: null,
        suppressionReference: null,
      };
    }

    const suppression = await this.database.first<{ id: EntityId }>(
      "SELECT id FROM communication_suppression_records WHERE organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) AND recipient_reference = ? AND status = 'active' AND effective_from <= ? AND (expires_at IS NULL OR expires_at > ?) AND ((scope = 'global') OR (scope = 'category' AND category = ?) OR (scope = 'channel' AND channel = ?) OR (scope = 'intent' AND intent = ?)) ORDER BY CASE WHEN workspace_id = ? THEN 0 ELSE 1 END, created_at DESC, id DESC LIMIT 1",
      organizationId,
      workspaceId,
      input.recipientReference.trim(),
      input.now,
      input.now,
      policy.category,
      input.channel,
      input.intent.trim(),
      workspaceId,
    );
    if (suppression) {
      return {
        result: "suppressed",
        reasonCode: "recipient_suppressed",
        policyVersion: policy.policyVersion,
        preferenceReference: null,
        suppressionReference: suppression.id,
      };
    }

    const preference = await this.database.first<{
      id: EntityId;
      status: "allowed" | "denied";
    }>(
      "SELECT id, status FROM communication_preferences WHERE organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) AND recipient_reference = ? AND category = ? AND (channel IS NULL OR channel = ?) AND effective_from <= ? AND (effective_to IS NULL OR effective_to > ?) ORDER BY CASE WHEN workspace_id = ? THEN 0 ELSE 1 END, CASE WHEN channel = ? THEN 0 ELSE 1 END, created_at DESC, id DESC LIMIT 1",
      organizationId,
      workspaceId,
      input.recipientReference.trim(),
      policy.category,
      input.channel,
      input.now,
      input.now,
      workspaceId,
      input.channel,
    );

    if (policy.requiresOptIn && (!preference || preference.status !== "allowed")) {
      return {
        result: "denied",
        reasonCode: "opt_in_required",
        policyVersion: policy.policyVersion,
        preferenceReference: preference?.id ?? null,
        suppressionReference: null,
      };
    }

    if (preference?.status === "denied") {
      return {
        result: "suppressed",
        reasonCode: "preference_denied",
        policyVersion: policy.policyVersion,
        preferenceReference: preference.id,
        suppressionReference: null,
      };
    }

    return {
      result: "allowed",
      reasonCode: null,
      policyVersion: policy.policyVersion,
      preferenceReference: preference?.id ?? null,
      suppressionReference: null,
    };
  }

  async createNotification(context: RequestContext, input: {
    id: EntityId; recipientReference: string; intent: string; channel: CommunicationChannel;
    templateReference?: string; templateVersion?: string; locale?: string;
    variables?: Readonly<Record<string, unknown>>; priority?: CommunicationPriority;
    idempotencyKey: string; scheduledAt?: string; expiresAt?: string; now: string;
  }): Promise<NotificationRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    if (!input.recipientReference.trim()) throw new DatabaseError("Communication recipient is required");
    if (!input.intent.trim()) throw new DatabaseError("Communication intent is required");
    if (!input.idempotencyKey.trim()) throw new DatabaseError("Communication idempotency key is required");

    const existing = await this.database.first<NotificationRow>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, recipient_reference AS recipientReference, intent, channel, template_reference AS templateReference, template_version AS templateVersion, locale, variables_json AS variablesJson, priority, status, idempotency_key AS idempotencyKey, scheduled_at AS scheduledAt, expires_at AS expiresAt, policy_version AS policyVersion, last_policy_evaluated_at AS lastPolicyEvaluatedAt, created_at AS createdAt, updated_at AS updatedAt FROM communication_notifications WHERE organization_id = ? AND idempotency_key = ? LIMIT 1",
      organizationId,
      input.idempotencyKey.trim(),
    );
    if (existing) return hydrateNotification(existing);

    const policy = await this.evaluateNotificationPolicy(context, {
      recipientReference: input.recipientReference,
      intent: input.intent,
      channel: input.channel,
      now: input.now,
    });

    const transactionStatements = [
      {
        sql: "INSERT INTO communication_notifications (id, organization_id, workspace_id, recipient_reference, intent, channel, template_reference, template_version, locale, variables_json, priority, status, idempotency_key, scheduled_at, expires_at, policy_version, last_policy_evaluated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params: [
          input.id,
          organizationId,
          context.workspaceId ?? null,
          input.recipientReference.trim(),
          input.intent.trim(),
          input.channel,
          input.templateReference?.trim() || null,
          input.templateVersion?.trim() || null,
          input.locale ?? null,
          input.variables ? JSON.stringify(input.variables) : null,
          input.priority ?? "normal",
          policy.result === "allowed" ? "created" : "suppressed",
          input.idempotencyKey.trim(),
          input.scheduledAt ?? null,
          input.expiresAt ?? null,
          policy.policyVersion,
          input.now,
          input.now,
          input.now,
        ],
      },
      {
        sql: "INSERT INTO communication_policy_decisions (id, notification_id, organization_id, workspace_id, result, reason_code, policy_version, preference_reference, suppression_reference, evaluated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params: [
          input.id + ":policy",
          input.id,
          organizationId,
          context.workspaceId ?? null,
          policy.result,
          policy.reasonCode,
          policy.policyVersion,
          policy.preferenceReference,
          policy.suppressionReference,
          input.now,
          input.now,
        ],
      },
    ];

    if (policy.result === "allowed") {
      transactionStatements.push({
        sql: "INSERT INTO outbox_events (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at, published_at) VALUES (?, 'communication.notification.created', 1, 'communication_notification', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)",
        params: [
          input.id + ":created",
          input.id,
          organizationId,
          context.workspaceId ?? null,
          JSON.stringify({
            notificationId: input.id,
            intent: input.intent.trim(),
            channel: input.channel,
          }),
          input.now,
          input.now,
          input.now,
        ],
      });
    }

    await this.database.transaction(transactionStatements);

    const row = await this.database.first<NotificationRow>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, recipient_reference AS recipientReference, intent, channel, template_reference AS templateReference, template_version AS templateVersion, locale, variables_json AS variablesJson, priority, status, idempotency_key AS idempotencyKey, scheduled_at AS scheduledAt, expires_at AS expiresAt, policy_version AS policyVersion, last_policy_evaluated_at AS lastPolicyEvaluatedAt, created_at AS createdAt, updated_at AS updatedAt FROM communication_notifications WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!row) throw new DatabaseError("Communication notification not found after creation");
    return hydrateNotification(row);
  }

  async listCommunicationPreferences(
    context: RequestContext,
    recipientReference: string,
  ): Promise<readonly CommunicationPreferenceRecord[]> {
    return this.database.all<CommunicationPreferenceRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, recipient_reference AS recipientReference, category, channel, status, source, consent_reference AS consentReference, effective_from AS effectiveFrom, effective_to AS effectiveTo, created_at AS createdAt, updated_at AS updatedAt FROM communication_preferences WHERE organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) AND recipient_reference = ? ORDER BY created_at DESC, id DESC",
      this.requireOrganization({ organizationId: context.tenantId }),
      context.workspaceId ?? null,
      recipientReference.trim(),
    );
  }

  async setCommunicationPreference(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly recipientReference: string;
      readonly category: "transactional" | "security" | "marketing" | "reminders" | "product_updates";
      readonly channel?: CommunicationChannel;
      readonly status: "allowed" | "denied";
      readonly source: string;
      readonly consentReference?: string;
      readonly effectiveFrom: string;
      readonly effectiveTo?: string;
      readonly now: string;
    },
  ): Promise<CommunicationPreferenceRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    await this.database.run(
      "INSERT INTO communication_preferences (id, organization_id, workspace_id, recipient_reference, category, channel, status, source, consent_reference, effective_from, effective_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      organizationId,
      context.workspaceId ?? null,
      input.recipientReference.trim(),
      input.category,
      input.channel ?? null,
      input.status,
      input.source.trim(),
      input.consentReference ?? null,
      input.effectiveFrom,
      input.effectiveTo ?? null,
      input.now,
      input.now,
    );
    const row=await this.database.first<CommunicationPreferenceRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, recipient_reference AS recipientReference, category, channel, status, source, consent_reference AS consentReference, effective_from AS effectiveFrom, effective_to AS effectiveTo, created_at AS createdAt, updated_at AS updatedAt FROM communication_preferences WHERE id=? LIMIT 1",
      input.id,
    );
    if(!row) throw new DatabaseError("Communication preference not found after creation");
    return row;
  }

  async createSuppression(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly recipientReference: string;
      readonly scope: "global" | "category" | "channel" | "intent";
      readonly category?: "transactional" | "security" | "marketing" | "reminders" | "product_updates";
      readonly channel?: CommunicationChannel;
      readonly intent?: string;
      readonly reasonCode: string;
      readonly source: string;
      readonly effectiveFrom: string;
      readonly expiresAt?: string;
      readonly now: string;
    },
  ): Promise<EntityId> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    await this.database.run(
      "INSERT INTO communication_suppression_records (id, organization_id, workspace_id, recipient_reference, scope, category, channel, intent, reason_code, source, status, effective_from, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)",
      input.id,
      organizationId,
      context.workspaceId ?? null,
      input.recipientReference.trim(),
      input.scope,
      input.category ?? null,
      input.channel ?? null,
      input.intent ?? null,
      input.reasonCode.trim(),
      input.source.trim(),
      input.effectiveFrom,
      input.expiresAt ?? null,
      input.now,
      input.now,
    );
    return input.id;
  }

  async releaseSuppression(context: RequestContext, id: EntityId, now: string): Promise<EntityId> {
    await this.database.run(
      "UPDATE communication_suppression_records SET status = 'released', updated_at = ? WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) AND status = 'active'",
      now,
      id,
      this.requireOrganization({ organizationId: context.tenantId }),
      context.workspaceId ?? null,
    );
    return id;
  }

  async queueNotificationFromSystem(input: {
    readonly organizationId: EntityId;
    readonly workspaceId: EntityId | null;
    readonly notificationId: EntityId;
    readonly now: string;
  }): Promise<boolean> {
    const result = await this.database.run(
      "UPDATE communication_notifications SET status = 'queued', updated_at = ? WHERE id = ? AND organization_id = ? AND ((workspace_id IS NULL AND ? IS NULL) OR workspace_id = ?) AND status = 'created'",
      input.now,
      input.notificationId,
      input.organizationId,
      input.workspaceId,
      input.workspaceId,
    );
    return (result.meta?.changes ?? 0) === 1;
  }

  async listDispatchableNotifications(now: string, limit = 50): Promise<readonly NotificationRecord[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const rows = await this.database.all<NotificationRow>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, recipient_reference AS recipientReference, intent, channel, template_reference AS templateReference, template_version AS templateVersion, locale, variables_json AS variablesJson, priority, status, idempotency_key AS idempotencyKey, scheduled_at AS scheduledAt, expires_at AS expiresAt, policy_version AS policyVersion, last_policy_evaluated_at AS lastPolicyEvaluatedAt, created_at AS createdAt, updated_at AS updatedAt FROM communication_notifications WHERE status = 'queued' AND (scheduled_at IS NULL OR scheduled_at <= ?) AND (expires_at IS NULL OR expires_at > ?) ORDER BY priority DESC, created_at ASC, id ASC LIMIT ?",
      now,
      now,
      safeLimit,
    );
    return rows.map(hydrateNotification);
  }

  async claimQueuedNotification(
    notificationId: EntityId,
    organizationId: EntityId,
    workspaceId: EntityId | null,
    now: string,
  ): Promise<boolean> {
    const result = await this.database.run(
      "UPDATE communication_notifications SET status = 'provider_accepted', updated_at = ? WHERE id = ? AND organization_id = ? AND ((workspace_id IS NULL AND ? IS NULL) OR workspace_id = ?) AND status = 'queued'",
      now,
      notificationId,
      organizationId,
      workspaceId,
      workspaceId,
    );
    return (result.meta?.changes ?? 0) === 1;
  }

  async requeueNotification(
    notificationId: EntityId,
    organizationId: EntityId,
    workspaceId: EntityId | null,
    nextAttemptAt: string,
    now: string,
  ): Promise<boolean> {
    const result = await this.database.run(
      "UPDATE communication_notifications SET status = 'queued', scheduled_at = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND ((workspace_id IS NULL AND ? IS NULL) OR workspace_id = ?) AND status = 'provider_accepted'",
      nextAttemptAt,
      now,
      notificationId,
      organizationId,
      workspaceId,
      workspaceId,
    );
    return (result.meta?.changes ?? 0) === 1;
  }

  async markDispatchResult(
    notificationId: EntityId,
    organizationId: EntityId,
    workspaceId: EntityId | null,
    status: CommunicationMessageStatus,
    now: string,
  ): Promise<boolean> {
    const result = await this.database.run(
      "UPDATE communication_notifications SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND ((workspace_id IS NULL AND ? IS NULL) OR workspace_id = ?) AND status = 'provider_accepted'",
      status,
      now,
      notificationId,
      organizationId,
      workspaceId,
      workspaceId,
    );
    return (result.meta?.changes ?? 0) === 1;
  }

  async setNotificationStatus(context: RequestContext, id: EntityId, status: CommunicationMessageStatus, now: string): Promise<NotificationRecord> {
    const current = await this.getNotification(context, id);
    if (!current) throw new DatabaseError("Communication notification not found");
    await this.database.run(
      "UPDATE communication_notifications SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND ((workspace_id IS NULL AND ? IS NULL) OR workspace_id = ?)",
      status, now, id, current.organizationId, current.workspaceId, current.workspaceId,
    );
    const updated = await this.getNotification(context, id);
    if (!updated) throw new DatabaseError("Communication notification not found after status update");
    return updated;
  }

  async getNotification(context: RequestContext, id: EntityId): Promise<NotificationRecord | null> {
    const row = await this.database.first<NotificationRow>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, recipient_reference AS recipientReference, intent, channel, template_reference AS templateReference, template_version AS templateVersion, locale, variables_json AS variablesJson, priority, status, idempotency_key AS idempotencyKey, scheduled_at AS scheduledAt, expires_at AS expiresAt, policy_version AS policyVersion, last_policy_evaluated_at AS lastPolicyEvaluatedAt, created_at AS createdAt, updated_at AS updatedAt FROM communication_notifications WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) LIMIT 1",
      id, this.requireOrganization({ organizationId: context.tenantId }), context.workspaceId ?? null,
    );
    return row ? hydrateNotification(row) : null;
  }

  async appendDeliveryAttempt(context: RequestContext, input: {
    id: EntityId; notificationId: EntityId; provider: string; channel: CommunicationChannel;
    status: DeliveryAttemptRecord["status"]; attemptedAt: string; providerReference?: string;
    retryCount?: number; nextRetryAt?: string; failureCode?: string;
    failureClass?: "transient" | "permanent"; metadata?: Readonly<Record<string, unknown>>;
    now: string;
  }): Promise<DeliveryAttemptRecord> {
    const notification = await this.getNotification(context, input.notificationId);
    if (!notification) throw new DatabaseError("Communication notification not found");
    await this.database.run(
      "INSERT INTO communication_delivery_attempts (id, notification_id, provider, channel, status, attempted_at, provider_reference, retry_count, next_retry_at, failure_code, failure_class, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id, input.notificationId, input.provider.trim(), input.channel, input.status, input.attemptedAt, input.providerReference?.trim() || null,
      input.retryCount ?? 0, input.nextRetryAt ?? null, input.failureCode?.trim() || null, input.failureClass ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null, input.now,
    );
    const row = await this.database.first<DeliveryRow>(
      "SELECT id, notification_id AS notificationId, provider, channel, status, attempted_at AS attemptedAt, provider_reference AS providerReference, retry_count AS retryCount, next_retry_at AS nextRetryAt, failure_code AS failureCode, failure_class AS failureClass, metadata_json AS metadataJson, created_at AS createdAt FROM communication_delivery_attempts WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!row) throw new DatabaseError("Communication delivery attempt not found after creation");
    return hydrateDelivery(row);
  }

  private async getDelivery(context: RequestContext, id: EntityId): Promise<DeliveryAttemptRecord | null> {
    const row = await this.database.first<DeliveryRow>(
      "SELECT d.id, d.notification_id AS notificationId, d.provider, d.channel, d.status, d.attempted_at AS attemptedAt, d.provider_reference AS providerReference, d.retry_count AS retryCount, d.next_retry_at AS nextRetryAt, d.failure_code AS failureCode, d.failure_class AS failureClass, d.metadata_json AS metadataJson, d.created_at AS createdAt FROM communication_delivery_attempts d INNER JOIN communication_notifications n ON n.id = d.notification_id WHERE d.id = ? AND n.organization_id = ? AND (n.workspace_id IS NULL OR n.workspace_id = ?) LIMIT 1",
      id, this.requireOrganization({ organizationId: context.tenantId }), context.workspaceId ?? null,
    );
    return row ? hydrateDelivery(row) : null;
  }
}

interface CommunicationTemplateVersionRow {
  readonly id: EntityId;
  readonly templateId: EntityId;
  readonly version: number;
  readonly locale: string;
  readonly variablesSchemaJson: string;
  readonly contentReference: string;
  readonly contentChecksum: string;
  readonly approvalState: CommunicationTemplateVersionRecord["approvalState"];
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function hydrateTemplateVersion(row: CommunicationTemplateVersionRow): CommunicationTemplateVersionRecord {
  let variablesSchema: Readonly<Record<string, unknown>>;
  try {
    const parsed = JSON.parse(row.variablesSchemaJson);
    variablesSchema = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Readonly<Record<string, unknown>>
      : {};
  } catch {
    throw new DatabaseError("Stored Communication template variables schema is invalid");
  }
  return {
    id: row.id,
    templateId: row.templateId,
    version: row.version,
    locale: row.locale,
    variablesSchema,
    contentReference: row.contentReference,
    contentChecksum: row.contentChecksum,
    approvalState: row.approvalState,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

interface NotificationRow {
  readonly id: EntityId; readonly organizationId: EntityId; readonly workspaceId: EntityId | null;
  readonly recipientReference: string; readonly intent: string; readonly channel: CommunicationChannel;
  readonly templateReference: string | null; readonly templateVersion: string | null; readonly locale: string | null;
  readonly variablesJson: string | null; readonly priority: CommunicationPriority; readonly status: CommunicationMessageStatus;
  readonly idempotencyKey: string; readonly scheduledAt: string | null; readonly expiresAt: string | null;
  readonly lastPolicyEvaluatedAt: string | null; readonly createdAt: string; readonly updatedAt: string;
}
interface DeliveryRow {
  readonly id: EntityId; readonly notificationId: EntityId; readonly provider: string; readonly channel: CommunicationChannel;
  readonly status: DeliveryAttemptRecord["status"]; readonly attemptedAt: string; readonly providerReference: string | null;
  readonly retryCount: number; readonly nextRetryAt: string | null; readonly failureCode: string | null;
  readonly failureClass: "transient" | "permanent" | null; readonly metadataJson: string | null; readonly createdAt: string;
}
interface CommunicationIntentPolicyRow {
  readonly id: EntityId;
  readonly intentKey: string;
  readonly category: "transactional" | "security" | "marketing" | "reminders" | "product_updates";
  readonly requiresOptIn: number;
  readonly allowedChannelsJson: string;
  readonly policyVersion: string;
  readonly status: "active" | "retired";
}

export interface CommunicationPreferenceRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly recipientReference: string;
  readonly category: "transactional" | "security" | "marketing" | "reminders" | "product_updates";
  readonly channel: CommunicationChannel | null;
  readonly status: "allowed" | "denied";
  readonly source: string;
  readonly consentReference: string | null;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function hydrateNotification(row: NotificationRow): NotificationRecord {
  return {...row, variables: parseObject(row.variablesJson)};
}
function hydrateDelivery(row: DeliveryRow): DeliveryAttemptRecord {
  return {...row, metadata: parseObject(row.metadataJson)};
}
function parseStringArray(value: string): readonly string[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) throw new Error("invalid array");
    return parsed;
  } catch {
    throw new DatabaseError("Stored Communication allowed-channel policy is invalid");
  }
}

function parseObject(value: string | null): Readonly<Record<string, unknown>> | null {
  if (!value) return null;
  try { const parsed=JSON.parse(value); return parsed && typeof parsed==="object" && !Array.isArray(parsed) ? parsed : null; }
  catch { throw new DatabaseError("Stored Communication JSON is invalid"); }
}
