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
  readonly lastPolicyEvaluatedAt: string | null;
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
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, recipient_reference AS recipientReference, intent, channel, template_reference AS templateReference, template_version AS templateVersion, locale, variables_json AS variablesJson, priority, status, idempotency_key AS idempotencyKey, scheduled_at AS scheduledAt, expires_at AS expiresAt, last_policy_evaluated_at AS lastPolicyEvaluatedAt, created_at AS createdAt, updated_at AS updatedAt FROM communication_notifications WHERE organization_id = ? AND idempotency_key = ? LIMIT 1",
      organizationId, input.idempotencyKey.trim(),
    );
    if (existing) return hydrateNotification(existing);
    await this.database.transaction([
      {
        sql: "INSERT INTO communication_notifications (id, organization_id, workspace_id, recipient_reference, intent, channel, template_reference, template_version, locale, variables_json, priority, status, idempotency_key, scheduled_at, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'created', ?, ?, ?, ?, ?)",
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
          input.idempotencyKey.trim(),
          input.scheduledAt ?? null,
          input.expiresAt ?? null,
          input.now,
          input.now,
        ],
      },
      {
        sql: "INSERT INTO outbox_events (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at, published_at) VALUES (?, 'communication.notification.created', 1, 'communication_notification', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)",
        params: [
          input.id + ':created',
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
        ],
      },
    ]);
    const row = await this.database.first<NotificationRow>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, recipient_reference AS recipientReference, intent, channel, template_reference AS templateReference, template_version AS templateVersion, locale, variables_json AS variablesJson, priority, status, idempotency_key AS idempotencyKey, scheduled_at AS scheduledAt, expires_at AS expiresAt, last_policy_evaluated_at AS lastPolicyEvaluatedAt, created_at AS createdAt, updated_at AS updatedAt FROM communication_notifications WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!row) throw new DatabaseError("Communication notification not found after creation");
    return hydrateNotification(row);
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
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, recipient_reference AS recipientReference, intent, channel, template_reference AS templateReference, template_version AS templateVersion, locale, variables_json AS variablesJson, priority, status, idempotency_key AS idempotencyKey, scheduled_at AS scheduledAt, expires_at AS expiresAt, last_policy_evaluated_at AS lastPolicyEvaluatedAt, created_at AS createdAt, updated_at AS updatedAt FROM communication_notifications WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) LIMIT 1",
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
function hydrateNotification(row: NotificationRow): NotificationRecord {
  return {...row, variables: parseObject(row.variablesJson)};
}
function hydrateDelivery(row: DeliveryRow): DeliveryAttemptRecord {
  return {...row, metadata: parseObject(row.metadataJson)};
}
function parseObject(value: string | null): Readonly<Record<string, unknown>> | null {
  if (!value) return null;
  try { const parsed=JSON.parse(value); return parsed && typeof parsed==="object" && !Array.isArray(parsed) ? parsed : null; }
  catch { throw new DatabaseError("Stored Communication JSON is invalid"); }
}
