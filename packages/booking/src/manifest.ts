import type { RuntimeModule } from "@qooqnos/runtime";
import { BOOKING_PERMISSIONS } from "./service";

export const BOOKING_MODULE: RuntimeModule = {
  id: "booking",
  version: "0.1.0",
  dependencies: ["business", "catalog"],
  permissions: [...BOOKING_PERMISSIONS],
  registerAuthorization(registry) {
    for (const permission of BOOKING_PERMISSIONS) registry.registerPermission(permission);
  },
};
