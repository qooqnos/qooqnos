import type { RuntimeModule } from "@qooqnos/runtime";
import { ADVERTISING_PERMISSIONS } from "./service";

export const ADVERTISING_MODULE: RuntimeModule = {
  id: "advertising",
  version: "0.1.0",
  dependencies: [],
  permissions: [...ADVERTISING_PERMISSIONS],
  registerAuthorization(registry) {
    for (const permission of ADVERTISING_PERMISSIONS) registry.registerPermission(permission);
  },
};
