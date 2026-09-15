import type { EntityId, RequestContext } from "@qooqnos/core";
import type { CatalogCommandRepository, CreateProductCommandInput } from "@qooqnos/database";
import type { AuthorizationService } from "@qooqnos/runtime";
import { CatalogRepository, type CreateOfferingInput, type CreateProductInput, type CreateProductVariantInput, type OfferingRecord, type ProductRecord, type ProductVariantRecord } from "./repository";

export interface CatalogServiceOptions {
  readonly repository: CatalogRepository;
  readonly commands?: CatalogCommandRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly now: () => string;
  readonly idempotencyExpiresAt?: (now: string) => string;
}

export interface CreateProductCommand extends Omit<CreateProductInput, "id" | "now"> {
  readonly idempotencyKey?: string;
  readonly requestFingerprint?: string;
}

export class CatalogService {
  constructor(private readonly options: CatalogServiceOptions) {}

  async createProduct(context: RequestContext, command: CreateProductCommand): Promise<ProductRecord> {
    await this.authorize(context, "catalog.product.create");
    validateText(command.name, "name");
    const productId = this.options.id();
    const now = this.options.now();

    if (this.options.commands && command.idempotencyKey && command.requestFingerprint) {
      const expiresAt = this.options.idempotencyExpiresAt?.(now) ?? new Date(Date.parse(now) + 24 * 60 * 60 * 1000).toISOString();
      const result = await this.options.commands.createProduct({
        context,
        id: productId,
        businessId: command.businessId,
        name: command.name.trim(),
        ...(command.description !== undefined ? { description: command.description.trim() } : {}),
        now,
        expiresAt,
        idempotencyKey: command.idempotencyKey,
        requestFingerprint: command.requestFingerprint,
        auditId: this.options.id(),
        eventId: this.options.id(),
      } satisfies CreateProductCommandInput);
      return this.options.repository.getProduct(context, result.result.productId).then((product) => {
        if (!product) throw new Error("Product not found after transactional creation");
        return product;
      });
    }

    return this.options.repository.createProduct(context, {
      ...command,
      id: productId,
      name: command.name.trim(),
      ...(command.description !== undefined ? { description: command.description.trim() } : {}),
      now,
    });
  }

  async createProductVariant(context: RequestContext, command: Omit<CreateProductVariantInput, "id" | "now">): Promise<ProductVariantRecord> {
    await this.authorize(context, "catalog.product_variant.create");
    return this.options.repository.createProductVariant(context, { ...command, id: this.options.id(), now: this.options.now() });
  }

  async createOffering(context: RequestContext, command: Omit<CreateOfferingInput, "id" | "now">): Promise<OfferingRecord> {
    await this.authorize(context, "catalog.offering.create");
    validateText(command.title, "title");
    return this.options.repository.createOffering(context, {
      ...command,
      id: this.options.id(),
      title: command.title.trim(),
      ...(command.description !== undefined ? { description: command.description.trim() } : {}),
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
