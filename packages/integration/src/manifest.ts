import type { RuntimeModule } from "@qooqnos/runtime";
import { INTEGRATION_PERMISSIONS } from "./service";
export const INTEGRATION_MODULE:RuntimeModule={id:"integration",version:"0.1.0",dependencies:[],permissions:[...INTEGRATION_PERMISSIONS],registerAuthorization(registry){for(const permission of INTEGRATION_PERMISSIONS)registry.registerPermission(permission);}};
