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
    await this.options.authorization.assert({context,permission:"communication.notification.send",requireAuthentication:true,requireWorkspace:false});
    return this.options.repository.createNotification(context,{
      ...input,id:this.options.id(),now:this.options.now(),
    });
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
  "communication.delivery.manage",
] as const;
