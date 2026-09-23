import type { RuntimeModule } from "@qooqnos/runtime";
import { FULFILLMENT_PERMISSIONS } from "./service";

export const FULFILLMENT_MODULE: RuntimeModule = {
  id: "fulfillment",
  version: "0.1.0",
  dependencies: ["commerce","booking","communication"],
  permissions: [...FULFILLMENT_PERMISSIONS],
  registerAuthorization(registry) {
    for (const permission of FULFILLMENT_PERMISSIONS) registry.registerPermission(permission);
  },
};
