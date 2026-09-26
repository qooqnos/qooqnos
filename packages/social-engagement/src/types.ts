import type { EntityId } from "@qooqnos/core";

export type SocialTargetType = "user" | "business" | "product" | "service" | "post";
export type SocialFollowTargetType = "user" | "business";
export type SocialEngagementType = "like" | "save";

export interface SocialFollowRecord {
  readonly id: EntityId; readonly actorUserId: EntityId; readonly targetType: SocialFollowTargetType; readonly targetId: EntityId;
  readonly organizationId: EntityId | null; readonly workspaceId: EntityId | null; readonly status: "active" | "removed";
  readonly createdAt: string; readonly updatedAt: string;
}
export interface SocialEngagementRecord {
  readonly id: EntityId; readonly actorUserId: EntityId; readonly targetType: Exclude<SocialTargetType,"user">;
  readonly targetId: EntityId; readonly engagementType: SocialEngagementType; readonly organizationId: EntityId | null;
  readonly workspaceId: EntityId | null; readonly status: "active" | "removed"; readonly createdAt: string; readonly updatedAt: string;
}
export interface SocialCommentRecord {
  readonly id: EntityId; readonly actorUserId: EntityId; readonly targetType: Exclude<SocialTargetType,"user">;
  readonly targetId: EntityId; readonly organizationId: EntityId | null; readonly workspaceId: EntityId | null;
  readonly body: string; readonly moderationStatus: "pending" | "visible" | "hidden" | "removed";
  readonly idempotencyKey: string; readonly createdAt: string; readonly updatedAt: string;
}