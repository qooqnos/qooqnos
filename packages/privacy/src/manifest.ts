import type { RuntimeModule } from "@qooqnos/runtime";
import { PRIVACY_PERMISSIONS } from "./service";
export const PRIVACY_MODULE:RuntimeModule={id:"privacy",version:"0.1.0",dependencies:[],permissions:[...PRIVACY_PERMISSIONS],registerAuthorization(registry){for(const permission of PRIVACY_PERMISSIONS)registry.registerPermission(permission);}};
