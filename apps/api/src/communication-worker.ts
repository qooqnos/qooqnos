import {
  CommunicationRepository,
  createCommunicationProviderRegistry,
  dispatchQueuedNotifications,
  inAppCommunicationProvider,
  createConfiguredCommunicationProviders,
  CommunicationRateLimiter,
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
    createCommunicationProviderRegistry([
      inAppCommunicationProvider,
      ...createConfiguredCommunicationProviders(env),
    ]),
    now,
    limit,
    new CommunicationRateLimiter([
      { scope: "tenant", max: 100, windowMs: 60_000 },
      { scope: "recipient", max: 10, windowMs: 60_000 },
      { scope: "channel", max: 500, windowMs: 60_000 },
      { scope: "provider", max: 300, windowMs: 60_000 },
      { scope: "platform", max: 1000, windowMs: 60_000 },
    ],
    Date.now,
    [
      { scope: "recipient", threshold: 25, windowMs: 10_000, cooldownMs: 30_000 },
      { scope: "tenant", threshold: 250, windowMs: 10_000, cooldownMs: 30_000 },
      { scope: "provider", threshold: 400, windowMs: 10_000, cooldownMs: 30_000 },
      { scope: "platform", threshold: 1000, windowMs: 10_000, cooldownMs: 30_000 },
    ]),
  );
}
