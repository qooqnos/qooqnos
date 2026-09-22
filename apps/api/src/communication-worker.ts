import {
  CommunicationRepository,
  createCommunicationProviderRegistry,
  dispatchQueuedNotifications,
  inAppCommunicationProvider,
} from "@qooqnos/communication";
import { getDatabase } from "./database";
import type { ApiEnv } from "./env";

export async function processCommunicationDispatch(
  env: ApiEnv,
  now = new Date().toISOString(),
  limit = 50,
): Promise<{ processed: number; delivered: number; failed: number; skipped: number }> {
  const database = getDatabase(env);
  if (!database) return { processed: 0, delivered: 0, failed: 0, skipped: 0 };

  return dispatchQueuedNotifications(
    new CommunicationRepository(database),
    createCommunicationProviderRegistry([inAppCommunicationProvider]),
    now,
    limit,
  );
}
