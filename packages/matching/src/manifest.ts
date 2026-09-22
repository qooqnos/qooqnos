import type { RuntimeModule } from "@qooqnos/runtime";
import { MATCHING_PERMISSIONS } from "./service";
export const MATCHING_MODULE:RuntimeModule={id:"matching",version:"0.1.0",dependencies:["catalog","business","discovery"],permissions:[...MATCHING_PERMISSIONS],registerAuthorization(registry){for(const permission of MATCHING_PERMISSIONS)registry.registerPermission(permission);}};
