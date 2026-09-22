import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type ReviewTargetType = "business" | "offering" | "booking" | "appointment" | "service" | "product" | "location";

export interface ReviewRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly customerId: EntityId;
  readonly ratingValue: number;
  readonly content: string | null;
  readonly moderationState: string;
  readonly businessId: EntityId | null;
  readonly offeringId: EntityId | null;
  readonly bookingId: EntityId | null;
  readonly appointmentId: EntityId | null;
  readonly serviceId: EntityId | null;
  readonly productId: EntityId | null;
  readonly locationId: EntityId | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class TrustReviewRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async createReview(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly customerId: EntityId;
      readonly ratingValue: number;
      readonly content?: string;
      readonly moderationState?: string;
  readonly businessId?: EntityId;
  readonly offeringId?: EntityId;
  readonly bookingId?: EntityId;
  readonly appointmentId?: EntityId;
  readonly serviceId?: EntityId;
  readonly productId?: EntityId;
  readonly locationId?: EntityId;
      readonly now: string;
    },
  ): Promise<ReviewRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const targetCount = (input.businessId ? 1 : 0) + (input.offeringId ? 1 : 0) + (input.bookingId ? 1 : 0) + (input.appointmentId ? 1 : 0) + (input.serviceId ? 1 : 0) + (input.productId ? 1 : 0) + (input.locationId ? 1 : 0);
    if (targetCount !== 1) throw new DatabaseError("Review must target exactly one canonical typed target");
    if (input.ratingValue < 1 || input.ratingValue > 5) throw new DatabaseError("Review rating must be between 1 and 5");

    await this.database.run(
      "INSERT INTO reviews (id, organization_id, workspace_id, customer_id, rating_value, content, moderation_state, business_id, offering_id, booking_id, appointment_id, service_id, product_id, location_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id, organizationId, context.workspaceId ?? null, input.customerId, input.ratingValue,
      input.content ?? null, input.moderationState ?? "pending", input.businessId ?? null, input.offeringId ?? null, input.bookingId ?? null, input.appointmentId ?? null, input.serviceId ?? null, input.productId ?? null, input.locationId ?? null, input.now, input.now,
    );

    return this.getReview(context, input.id);
  }

  async moderateReview(
    context: RequestContext,
    id: EntityId,
    moderationState: string,
    now: string,
  ): Promise<ReviewRecord> {
    const current = await this.getReview(context, id);
    await this.database.run(
      "UPDATE reviews SET moderation_state = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?)",
      moderationState.trim(),
      now,
      current.id,
      current.organizationId,
      current.workspaceId ?? context.workspaceId,
    );
    return this.getReview(context, id);
  }

  async getReview(context: RequestContext, id: EntityId): Promise<ReviewRecord> {
    const row = await this.database.first<ReviewRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, customer_id AS customerId, rating_value AS ratingValue, content, moderation_state AS moderationState, business_id AS businessId, offering_id AS offeringId, booking_id AS bookingId, appointment_id AS appointmentId, service_id AS serviceId, product_id AS productId, location_id AS locationId, created_at AS createdAt, updated_at AS updatedAt FROM reviews WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) LIMIT 1",
      id,
      this.requireOrganization({ organizationId: context.tenantId }),
      context.workspaceId ?? null,
    );
    if (!row) throw new DatabaseError("Review not found");
    return row;
  }
}
