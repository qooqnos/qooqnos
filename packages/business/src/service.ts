import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AtomicCommandResult } from "@qooqnos/database";
import type { AuthorizationService } from "@qooqnos/runtime";
import { BusinessRepository, type BusinessRecord, type CreateBusinessInput, type AtomicBusinessCreateOptions, type PublicationStatus } from "./repository";

export interface BusinessServiceOptions {
  readonly repository: BusinessRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export interface CreateBusinessCommand {
  readonly name: string;
  readonly displayName: string;
  readonly businessType?: string | undefined;
  readonly primaryCategoryId?: string | undefined;
  readonly defaultLocale?: string | undefined;
  readonly timezone?: string | undefined;
  readonly defaultCurrency?: string | undefined;
}

export class BusinessService {
  constructor(private readonly options: BusinessServiceOptions) {}

  async create(context: RequestContext, command: CreateBusinessCommand): Promise<BusinessRecord> {
    const organizationId = requireContext(context.tenantId, "tenant");
    const workspaceId = requireContext(context.workspaceId, "workspace");
    await this.options.authorization.assert({
      context,
      permission: "business.create",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    const input = this.normalizeCreateInput(organizationId, workspaceId, command);
    return this.options.repository.create(input);
  }

  async createAtomic(
    context: RequestContext,
    command: CreateBusinessCommand,
    idempotency: Omit<AtomicBusinessCreateOptions, "auditId" | "requestId" | "correlationId"> & {
      readonly auditId: string;
    },
  ): Promise<AtomicCommandResult<BusinessRecord>> {
    const organizationId = requireContext(context.tenantId, "tenant");
    const workspaceId = requireContext(context.workspaceId, "workspace");
    await this.options.authorization.assert({
      context,
      permission: "business.create",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    const input = this.normalizeCreateInput(organizationId, workspaceId, command);
    return this.options.repository.createAtomic(context, input, {
      ...idempotency,
      requestId: context.requestId,
      correlationId: context.correlationId,
    });
  }

  async update(context: RequestContext, id: EntityId, patch: CreateBusinessCommand): Promise<BusinessRecord> {
    const current = await this.options.repository.get(context, id);
    if (!current) throw new Error("Business not found");
    await this.options.authorization.assert({
      context,
      permission: "business.update",
      resource: { tenantId: current.organizationId, workspaceId: current.workspaceId },
      requireAuthentication: true,
      requireWorkspace: true,
    });
    validateBusinessText(patch.name, "name");
    validateBusinessText(patch.displayName, "displayName");
    return this.options.repository.update(context, id, {
      ...patch,
      name: patch.name.trim(),
      displayName: patch.displayName.trim(),
      businessType: normalizeOptional(patch.businessType),
      primaryCategoryId: normalizeOptional(patch.primaryCategoryId),
      defaultLocale: normalizeOptional(patch.defaultLocale),
      timezone: normalizeOptional(patch.timezone),
      defaultCurrency: normalizeCurrency(patch.defaultCurrency),
    }, this.options.now());
  }

  async createLocation(context: RequestContext, input: {
    readonly businessId: EntityId;
    readonly name: string;
    readonly locationType: "physical" | "virtual" | "service_area";
    readonly timezone?: string;
    readonly address?: Readonly<Record<string, unknown>>;
    readonly geoPoint?: { readonly latitude: number; readonly longitude: number };
  }) {
    const business = await this.options.repository.get(context, input.businessId);
    if (!business) throw new Error("Business not found");
    await this.options.authorization.assert({ context, permission: "business.update", resource: { tenantId: business.organizationId, workspaceId: business.workspaceId }, requireAuthentication: true, requireWorkspace: true });
    if (!input.name.trim()) throw new Error("Location name is required");
    if (input.name.trim().length > 200) throw new Error("Location name exceeds the maximum length");
    validateGeoPoint(input.geoPoint);
    return this.options.repository.createLocation(context, { ...input, id: this.options.id(), name: input.name.trim(), timezone: normalizeOptional(input.timezone), now: this.options.now() });
  }

  async updateLocation(context: RequestContext, id: EntityId, patch: Parameters<BusinessRepository["updateLocation"]>[2]) {
    const location = await this.options.repository.getLocation(context, id);
    if (!location) throw new Error("Location not found");
    const business = await this.options.repository.get(context, location.businessId);
    if (!business) throw new Error("Business not found");
    await this.options.authorization.assert({ context, permission: "business.update", resource: { tenantId: business.organizationId, workspaceId: business.workspaceId }, requireAuthentication: true, requireWorkspace: true });
    if (patch.name !== undefined) { if (!patch.name.trim()) throw new Error("Location name is required"); if (patch.name.trim().length > 200) throw new Error("Location name exceeds the maximum length"); }
    validateGeoPoint(patch.geoPoint === undefined ? location.geoPoint ?? undefined : patch.geoPoint ?? undefined);
    return this.options.repository.updateLocation(context, id, { ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) }, this.options.now());
  }

  async setLocationStatus(context: RequestContext, id: EntityId, status: "active" | "inactive" | "archived") {
    const location = await this.options.repository.getLocation(context, id);
    if (!location) throw new Error("Location not found");
    const business = await this.options.repository.get(context, location.businessId);
    if (!business) throw new Error("Business not found");
    await this.options.authorization.assert({ context, permission: "business.update", resource: { tenantId: business.organizationId, workspaceId: business.workspaceId }, requireAuthentication: true, requireWorkspace: true });
    return this.options.repository.setLocationStatus(context, id, status, this.options.now());
  }

  async requestPublication(context: RequestContext, id: EntityId): Promise<BusinessRecord> {
    const current = await this.options.repository.get(context, id);
    if (!current) throw new Error("Business not found");
    await this.options.authorization.assert({
      context,
      permission: "business.publish",
      resource: { tenantId: current.organizationId, workspaceId: current.workspaceId },
      requireAuthentication: true,
      requireWorkspace: true,
    });
    if (current.status !== "active") throw new Error("Only active businesses can request publication");
    if (current.publicationStatus === "published") return current;
    return this.options.repository.setPublicationStatus(context, id, "pending", this.options.now());
  }

  async setPublicationStatus(context: RequestContext, id: EntityId, status: PublicationStatus): Promise<BusinessRecord> {
    const current = await this.options.repository.get(context, id);
    if (!current) throw new Error("Business not found");
    await this.options.authorization.assert({
      context,
      permission: "business.publish",
      resource: { tenantId: current.organizationId, workspaceId: current.workspaceId },
      requireAuthentication: true,
      requireWorkspace: true,
    });
    if (status === "published") throw new Error("Publication must pass the canonical publication policy before becoming published");
    return this.options.repository.setPublicationStatus(context, id, status, this.options.now());
  }

  private normalizeCreateInput(
    organizationId: EntityId,
    workspaceId: EntityId,
    command: CreateBusinessCommand,
  ): CreateBusinessInput {
    validateBusinessText(command.name, "name");
    validateBusinessText(command.displayName, "displayName");
    return {
      id: this.options.id(),
      organizationId,
      workspaceId,
      name: command.name.trim(),
      displayName: command.displayName.trim(),
      businessType: normalizeOptional(command.businessType),
      primaryCategoryId: normalizeOptional(command.primaryCategoryId),
      defaultLocale: normalizeOptional(command.defaultLocale),
      timezone: normalizeOptional(command.timezone),
      defaultCurrency: normalizeCurrency(command.defaultCurrency),
      now: this.options.now(),
    };
  }
}

export const BUSINESS_PERMISSIONS = ["business.create", "business.update", "business.publish"] as const;

function requireContext(value: EntityId | undefined, name: string): EntityId {
  if (!value) throw new Error(`${name} context is required`);
  return value;
}

function validateBusinessText(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required`);
  if (value.trim().length > 200) throw new Error(`${field} exceeds the maximum length`);
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeCurrency(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value)?.toUpperCase();
  if (normalized && !/^[A-Z]{3}$/.test(normalized)) throw new Error("defaultCurrency must be a 3-letter ISO currency code");
  return normalized;
}

function validateGeoPoint(value: { readonly latitude: number; readonly longitude: number } | undefined): void {
  if (!value) return;
  if (!Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || value.latitude < -90 || value.latitude > 90 || value.longitude < -180 || value.longitude > 180) throw new Error("Invalid geographic coordinates");
}
