import type { RuntimeModule } from "@qooqnos/runtime";

export const SOCIAL_ENGAGEMENT_MODULE: RuntimeModule = {
  id: "social-engagement",
  version: "0.1.0",
  dependencies: ["identity", "business", "catalog", "discovery", "trust"],
  permissions: ["social.follow.manage", "social.engagement.manage", "social.comment.manage"],
};