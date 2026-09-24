import type { RuntimeModule } from "@qooqnos/runtime";
import { AI_MEMORY_PERMISSIONS } from "./memory-service";

export const AI_PERMISSIONS = [
  "ai.seller_product.create_session",
  "ai.seller_product.add_input",
  "ai.seller_product.generate_draft",
  "ai.seller_product.read_draft",
  "ai.seller_product.confirm_draft",
  "ai.seller_product.cancel_session",
  "ai.seller_product.retry_operation",
] as const;

export const AI_MODULE: RuntimeModule = {
  id: "ai",
  version: "0.1.0",
  dependencies: [],
  permissions: [...AI_PERMISSIONS, ...AI_MEMORY_PERMISSIONS],
  registerAuthorization(registry) {
    for (const permission of [...AI_PERMISSIONS, ...AI_MEMORY_PERMISSIONS]) registry.registerPermission(permission);
  },
};
