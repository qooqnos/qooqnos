import type { RuntimeModule } from "@qooqnos/runtime";

export const DISCOVERY_MODULE: RuntimeModule = {
  id: "discovery",
  version: "0.1.0",
  dependencies: ["catalog", "business"],
  permissions: [],
};
