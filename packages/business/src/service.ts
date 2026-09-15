import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import { BusinessRepository, type BusinessRecord, type CreateBusinessInput, type PublicationStatus } from "./repository";

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
    validateBusinessText(command.name, "name");
    validateBusinessText(command.displayName, "displayName");
    const input: CreateBusinessInput = {
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
    return this.options.repository.create(input);
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
