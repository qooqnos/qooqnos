import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import { CatalogRepository, type CreateOfferingInput, type CreateProductInput, type CreateProductVariantInput, type OfferingRecord, type ProductRecord, type ProductVariantRecord } from "./repository";

export interface CatalogServiceOptions {
  readonly repository: CatalogRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export class CatalogService {
  constructor(private readonly options: CatalogServiceOptions) {}

  async createProduct(context: RequestContext, command: Omit<CreateProductInput, "id" | "now">): Promise<ProductRecord> {
    await this.authorize(context, "catalog.product.create");
    validateText(command.name, "name");
    return this.options.repository.createProduct({
      ...command,
      id: this.options.id(),
      name: command.name.trim(),
      description: command.description?.trim(),
      now: this.options.now(),
    });
  }

  async createProductVariant(context: RequestContext, command: Omit<CreateProductVariantInput, "id" | "now">): Promise<ProductVariantRecord> {
    await this.authorize(context, "catalog.product_variant.create");
    return this.options.repository.createProductVariant({ ...command, id: this.options.id(), now: this.options.now() });
  }

  async createOffering(context: RequestContext, command: Omit<CreateOfferingInput, "id" | "now">): Promise<OfferingRecord> {
    await this.authorize(context, "catalog.offering.create");
    validateText(command.title, "title");
    return this.options.repository.createOffering({
      ...command,
      id: this.options.id(),
      title: command.title.trim(),
      description: command.description?.trim(),
      now: this.options.now(),
    });
  }

  async requestOfferingPublication(context: RequestContext, id: EntityId): Promise<OfferingRecord> {
    const current = await this.options.repository.getOffering(context, id);
    if (!current) throw new Error("Offering not found");
    await this.options.authorization.assert({
      context,
      permission: "catalog.offering.publish",
      resource: { tenantId: context.tenantId, workspaceId: context.workspaceId },
      requireAuthentication: true,
      requireWorkspace: true,
    });
    if (current.status !== "active") throw new Error("Only active offerings can request publication");
    if (current.publicationStatus === "published") return current;
    return this.options.repository.setOfferingPublicationStatus(context, id, "pending", this.options.now());
  }

  private authorize(context: RequestContext, permission: string): Promise<void> {
    return this.options.authorization.assert({
      context,
      permission,
      requireAuthentication: true,
      requireWorkspace: true,
    });
  }
}

export const CATALOG_PERMISSIONS = [
  "catalog.product.create",
  "catalog.product_variant.create",
  "catalog.offering.create",
  "catalog.offering.publish",
] as const;

function validateText(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required`);
  if (value.trim().length > 500) throw new Error(`${field} exceeds the maximum length`);
}
