import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import { CommunicationRepository, type CommunicationChannel, type CommunicationMessageStatus } from "./repository";

export interface CommunicationServiceOptions {
  readonly repository: CommunicationRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export class CommunicationService {
  constructor(private readonly options: CommunicationServiceOptions) {}

  async createTemplate(context: RequestContext, input: {
    readonly templateKey: string;
    readonly intent: string;
    readonly channel: CommunicationChannel;
    readonly ownerReference: string;
    readonly status?: "draft" | "active" | "retired";
  }) {
    await this.options.authorization.assert({
      context,
      permission: "communication.template.manage",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.createTemplate(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async createTemplateVersion(context: RequestContext, input: {
    readonly templateId: EntityId;
    readonly version: number;
    readonly locale: string;
    readonly variablesSchema: Readonly<Record<string, unknown>>;
    readonly contentReference: string;
    readonly contentChecksum: string;
    readonly approvalState?: "not_required" | "pending";
    readonly effectiveFrom?: string;
    readonly effectiveTo?: string;
  }) {
    await this.options.authorization.assert({
      context,
      permission: "communication.template.manage",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.createTemplateVersion(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async approveTemplateVersion(context: RequestContext, templateVersionId: EntityId) {
    await this.options.authorization.assert({
      context,
      permission: "communication.template.manage",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.approveTemplateVersion(
      context,
      templateVersionId,
      this.options.now(),
    );
  }

  async createConversation(context: RequestContext, input: { readonly customerId?: EntityId | undefined }) {
    await this.options.authorization.assert({
      context,
      permission: "communication.conversation.manage",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.createConversation(context, {
      id: this.options.id(),
      ...(input.customerId ? { customerId: input.customerId } : {}),
      now: this.options.now(),
    });
  }

  async sendMessage(context: RequestContext, input: {
    readonly conversationId: EntityId; readonly content: string; readonly classification: string;
  }) {
    await this.options.authorization.assert({context,permission:"communication.message.send",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.sendMessage(context,{
      id:this.options.id(),conversationId:input.conversationId,senderReference:context.actorId ?? "system",
      content:input.content,classification:input.classification,now:this.options.now(),
    });
  }

  async sendNotification(context: RequestContext, input: {
    readonly recipientReference: string; readonly intent: string; readonly channel: CommunicationChannel;
    readonly templateReference?: string; readonly templateVersion?: string; readonly locale?: string;
    readonly variables?: Readonly<Record<string, unknown>>; readonly idempotencyKey: string;
    readonly priority?: "low"|"normal"|"high"|"urgent"; readonly scheduledAt?: string; readonly expiresAt?: string;
  }) {
    await this.options.authorization.assert({
      context,
      permission: "communication.notification.send",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    if (input.templateReference || input.templateVersion) {
      if (!input.templateReference || !input.templateVersion) {
        throw new Error("Approved Communication template reference and version are required together");
      }
      const version = Number(input.templateVersion);
      if (!Number.isSafeInteger(version) || version < 1) {
        throw new Error("Communication template version must be a positive integer");
      }
      await this.options.repository.getApprovedTemplateVersion(context, {
        templateKey: input.templateReference,
        version,
        channel: input.channel,
        locale: input.locale ?? context.locale ?? "en",
        intent: input.intent,
        now: this.options.now(),
      });
    }
    return this.options.repository.createNotification(context,{
      ...input,
      ...(input.templateReference ? { templateReference: input.templateReference.trim() } : {}),
      ...(input.templateVersion ? { templateVersion: String(Number(input.templateVersion)) } : {}),
      id:this.options.id(),
      now:this.options.now(),
    });
  }
  async listPreferences(
    context: RequestContext,
    recipientReference: string,
  ) {
    await this.options.authorization.assert({
      context,
      permission: "communication.preference.read",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.listCommunicationPreferences(context, recipientReference);
  }

  async setPreference(
    context: RequestContext,
    input: {
      readonly recipientReference: string;
      readonly category: "transactional" | "security" | "marketing" | "reminders" | "product_updates";
      readonly channel?: CommunicationChannel;
      readonly status: "allowed" | "denied";
      readonly source: string;
      readonly consentReference?: string;
      readonly effectiveFrom: string;
      readonly effectiveTo?: string;
    },
  ) {
    await this.options.authorization.assert({
      context,
      permission: "communication.preference.manage",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.setCommunicationPreference(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async suppressRecipient(
    context: RequestContext,
    input: {
      readonly recipientReference: string;
      readonly scope: "global" | "category" | "channel" | "intent";
      readonly category?: "transactional" | "security" | "marketing" | "reminders" | "product_updates";
      readonly channel?: CommunicationChannel;
      readonly intent?: string;
      readonly reasonCode: string;
      readonly source: string;
      readonly appliesToRequired?: boolean;
      readonly effectiveFrom: string;
      readonly expiresAt?: string;
    },
  ) {
    await this.options.authorization.assert({
      context,
      permission: "communication.suppression.manage",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.createSuppression(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async releaseSuppression(context: RequestContext, id: EntityId) {
    await this.options.authorization.assert({
      context,
      permission: "communication.suppression.manage",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.releaseSuppression(context, id, this.options.now());
  }

  async listOwnNotifications(context: RequestContext, limit = 20) {
    await this.options.authorization.assert({
      context,
      permission: "communication.notification.read",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    if (!context.actorId) return [];
    return this.options.repository.listNotificationsForRecipient(context, context.actorId, limit);
  }

  async updateDeliveryStatus(context: RequestContext, notificationId: EntityId, status: CommunicationMessageStatus) {
    await this.options.authorization.assert({context,permission:"communication.delivery.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.setNotificationStatus(context,notificationId,status,this.options.now());
  }

  async recordDeliveryAttempt(context: RequestContext, input: {
    readonly notificationId: EntityId; readonly provider: string; readonly channel: CommunicationChannel;
    readonly status: "accepted"|"queued"|"sent"|"delivered"|"read"|"failed"|"rejected"|"expired";
    readonly attemptedAt: string; readonly providerReference?: string; readonly retryCount?: number;
    readonly nextRetryAt?: string; readonly failureCode?: string; readonly failureClass?: "transient"|"permanent";
    readonly metadata?: Readonly<Record<string, unknown>>;
  }) {
    await this.options.authorization.assert({context,permission:"communication.delivery.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.appendDeliveryAttempt(context,{...input,id:this.options.id(),now:this.options.now()});
  }
}

export const COMMUNICATION_PERMISSIONS = [
  "communication.conversation.read",
  "communication.conversation.manage",
  "communication.message.send",
  "communication.notification.send",
  "communication.preference.read",
  "communication.preference.manage",
  "communication.suppression.manage",
  "communication.template.manage",
  "communication.delivery.manage",
] as const;
