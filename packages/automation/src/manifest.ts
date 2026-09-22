import type { RuntimeModule } from "@qooqnos/runtime";
import { AUTOMATION_PERMISSIONS } from "./service";
export const AUTOMATION_MODULE: RuntimeModule = {
  id: "automation", version: "0.1.0", dependencies: ["communication"],
  permissions: [...AUTOMATION_PERMISSIONS],
  registerAuthorization(registry) { for (const permission of AUTOMATION_PERMISSIONS) registry.registerPermission(permission); },
};
