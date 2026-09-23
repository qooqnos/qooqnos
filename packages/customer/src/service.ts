import type { EntityId, RequestContext } from "@qooqnos/core";
import {
  CustomerAddressRepository,
  CustomerRelationshipRepository,
  CustomerRepository,
  CrmTimelineRepository,
  type CustomerAddressRecord,
  type CustomerPreferenceRecord,
  type CustomerRecord,
  type CustomerRelationshipRecord,
  type CrmTimelineEventRecord,
  type CustomerStatus,
} from "@qooqnos/database";
import type { AuthorizationService } from "@qooqnos/runtime";

export interface CustomerServiceOptions {
  readonly repository: CustomerRepository;
  readonly addressRepository: CustomerAddressRepository;
  readonly relationshipRepository: CustomerRelationshipRepository;
  readonly timelineRepository: CrmTimelineRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export interface CustomerProfileView {
  readonly customer: CustomerRecord;
  readonly preferences: readonly CustomerPreferenceRecord[];
  readonly addresses: readonly CustomerAddressRecord[];
}

export class CustomerService {
  constructor(private readonly options: CustomerServiceOptions) {}

  async create(
    context: RequestContext,
    input: {
      readonly organizationId: EntityId;
      readonly userId?: EntityId;
      readonly locale?: string;
      readonly timezone?: string;
    },
  ): Promise<CustomerRecord> {
    await this.options.authorization.assert({
      context,
      permission: "customer.create",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.create(context, {
      id: this.options.id(),
      organizationId: input.organizationId,
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.locale ? { locale: input.locale } : {}),
      ...(input.timezone ? { timezone: input.timezone } : {}),
      now: this.options.now(),
    });
  }

  async get(context: RequestContext, customerId: EntityId): Promise<CustomerRecord> {
    await this.options.authorization.assert({
      context,
      permission: "customer.read",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    const customer = await this.options.repository.get(context, customerId);
    if (!customer) throw new Error("Customer not found");
    return customer;
  }

  async getProfile(
    context: RequestContext,
    customerId: EntityId,
  ): Promise<CustomerProfileView> {
    await this.options.authorization.assert({
      context,
      permission: "customer.read",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    const customer = await this.options.repository.get(context, customerId);
    if (!customer) throw new Error("Customer not found");
    const [preferences, addresses] = await Promise.all([
      this.options.repository.listPreferences(context, customerId),
      this.options.addressRepository.list(context, customerId),
    ]);
    return { customer, preferences, addresses };
  }

  async updateProfile(
    context: RequestContext,
    customerId: EntityId,
    input: {
      readonly locale?: string | null;
      readonly timezone?: string | null;
      readonly status?: CustomerStatus;
    },
  ): Promise<CustomerRecord> {
    await this.options.authorization.assert({
      context,
      permission: "customer.update_profile",
      resource: { tenantId: context.tenantId },
      requireAuthentication: true,
      requireWorkspace: false,
    });
    const current = await this.options.repository.get(context, customerId);
    if (!current) throw new Error("Customer not found");

    const nextStatus = input.status ?? current.status;
    const now = this.options.now();
    if (input.locale === undefined && input.timezone === undefined && input.status !== undefined) {
      return this.options.repository.setStatus(context, customerId, nextStatus, now);
    }

    const database = (this.options.repository as unknown as { database?: { run: (...args: unknown[]) => Promise<unknown> } }).database;
    if (!database) throw new Error("Customer database boundary unavailable");
    await database.run(
      "UPDATE customers SET locale = ?, timezone = ?, status = ?, updated_at = ? WHERE id = ? AND organization_id = ?",
      input.locale === undefined ? current.locale : input.locale,
      input.timezone === undefined ? current.timezone : input.timezone,
      nextStatus,
      now,
      customerId,
      current.organizationId,
    );
    const updated = await this.options.repository.get(context, customerId);
    if (!updated) throw new Error("Customer not found after profile update");
    return updated;
  }

  async setPreference(
    context: RequestContext,
    customerId: EntityId,
    input: {
      readonly attribute: string;
      readonly valueReference: string;
      readonly source: string;
      readonly confidence?: number;
      readonly persistence: string;
      readonly consentScope?: string;
      readonly expiresAt?: string;
    },
  ): Promise<CustomerPreferenceRecord> {
    await this.options.authorization.assert({
      context,
      permission: "customer.manage_preferences",
      resource: { tenantId: context.tenantId },
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.setPreference(context, {
      id: this.options.id(),
      customerId,
      ...input,
      now: this.options.now(),
    });
  }

  async listPreferences(context: RequestContext, customerId: EntityId): Promise<readonly CustomerPreferenceRecord[]> {
    await this.options.authorization.assert({
      context,
      permission: "customer.read",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.listPreferences(context, customerId);
  }

  async addAddress(
    context: RequestContext,
    input: {
      readonly customerId: EntityId;
      readonly countryCode: string;
      readonly administrativeArea?: string;
      readonly locality?: string;
      readonly district?: string;
      readonly postalCode?: string;
      readonly streetLine1?: string;
      readonly streetLine2?: string;
      readonly buildingNumber?: string;
      readonly unit?: string;
      readonly formatted?: string;
      readonly locale?: string;
    },
  ): Promise<CustomerAddressRecord> {
    await this.options.authorization.assert({
      context,
      permission: "customer.manage_address",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.addressRepository.create(context, {
      id: this.options.id(),
      ...input,
      now: this.options.now(),
    });
  }

  async updateAddress(
    context: RequestContext,
    addressId: EntityId,
    input: Omit<Parameters<CustomerAddressRepository["update"]>[2], "now">,
  ): Promise<CustomerAddressRecord> {
    await this.options.authorization.assert({
      context,
      permission: "customer.manage_address",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.addressRepository.update(context, addressId, {
      ...input,
      now: this.options.now(),
    });
  }

  async listAddresses(context: RequestContext, customerId: EntityId): Promise<readonly CustomerAddressRecord[]> {
    await this.options.authorization.assert({
      context,
      permission: "customer.read",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.addressRepository.list(context, customerId);
  }

  async createRelationship(
    context: RequestContext,
    input: {
      readonly customerId: EntityId;
      readonly businessId: EntityId;
      readonly relationshipType: string;
      readonly source: string;
      readonly firstInteractionAt?: string;
      readonly lastInteractionAt?: string;
    },
  ): Promise<CustomerRelationshipRecord> {
    await this.options.authorization.assert({
      context,
      permission: "customer.manage_relationship",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.relationshipRepository.create(context, {
      id: this.options.id(),
      ...input,
      now: this.options.now(),
    });
  }

  async setRelationshipStatus(
    context: RequestContext,
    relationshipId: EntityId,
    status: CustomerRelationshipRecord["status"],
  ): Promise<CustomerRelationshipRecord> {
    await this.options.authorization.assert({
      context,
      permission: "customer.manage_relationship",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.relationshipRepository.setStatus(context, relationshipId, status, this.options.now());
  }

  async getRelationshipHistory(
    context: RequestContext,
    relationshipId: EntityId,
    limit = 100,
  ): Promise<readonly CrmTimelineEventRecord[]> {
    await this.options.authorization.assert({
      context,
      permission: "customer.get_history",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    const relationship = await this.options.relationshipRepository.get(context, relationshipId);
    if (!relationship) throw new Error("Customer relationship not found");
    return this.options.timelineRepository.listRelationshipTimeline(context, relationshipId, limit);
  }
}

export const CUSTOMER_PERMISSIONS = [
  "customer.create",
  "customer.read",
  "customer.update_profile",
  "customer.manage_preferences",
  "customer.manage_address",
  "customer.manage_relationship",
  "customer.get_history",
] as const;
