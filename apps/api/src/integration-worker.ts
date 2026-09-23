import {
  createIntegrationProviderRegistry,
  IntegrationRepository,
  processIntegrationWork,
} from "@qooqnos/integration";
import { getDatabase } from "./database";
import type { ApiEnv } from "./env";

export async function processIntegration(
  env: ApiEnv,
  now = new Date().toISOString(),
  limit = 50,
) {
  const database = getDatabase(env);
  if (!database) {
    return {
      webhooksSeen: 0,
      webhooksClaimed: 0,
      webhooksProcessed: 0,
      webhooksFailed: 0,
      syncJobsSeen: 0,
      syncJobsClaimed: 0,
      syncJobsCompleted: 0,
      syncJobsFailed: 0,
    };
  }

  return processIntegrationWork(
    new IntegrationRepository(database),
    createIntegrationProviderRegistry(),
    now,
    limit,
  );
}
