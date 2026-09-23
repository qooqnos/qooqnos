import { brandId, type EntityId, type RequestContext } from "@qooqnos/core";
import {
  IntegrationRepository,
  type IntegrationProviderRegistry,
  type IntegrationSyncJobRecord,
  type IntegrationWebhookRecord,
} from "./repository";
import type { IntegrationProviderAdapter, IntegrationWebhookRequest, IntegrationSyncRequest } from "./adapter";

export interface IntegrationWorkerResult {
  readonly webhooksSeen: number;
  readonly webhooksClaimed: number;
  readonly webhooksProcessed: number;
  readonly webhooksFailed: number;
  readonly syncJobsSeen: number;
  readonly syncJobsClaimed: number;
  readonly syncJobsCompleted: number;
  readonly syncJobsFailed: number;
}

export async function processIntegrationWork(
  repository: IntegrationRepository,
  registry: IntegrationProviderRegistry,
  now: string,
  limit = 50,
): Promise<IntegrationWorkerResult> {
  const webhooks = await repository.listProcessableWebhooks(now, limit);
  const syncJobs = await repository.listDueSyncJobs(now, limit);

  let webhooksClaimed = 0;
  let webhooksProcessed = 0;
  let webhooksFailed = 0;
  let syncJobsClaimed = 0;
  let syncJobsCompleted = 0;
  let syncJobsFailed = 0;

  for (const webhook of webhooks) {
    const claimed = await repository.claimWebhook(webhook.id, now);
    if (!claimed) continue;
    webhooksClaimed += 1;

    const accountContext = await buildContextForAccount(repository, webhook.integrationAccountId, webhook.correlationId);
    if (claimed.signatureStatus === "invalid" || claimed.signatureStatus === "missing") {
      await repository.finishWebhook(accountContext, {
        id: claimed.id,
        status: "ignored",
        errorReference: "webhook_signature_invalid_or_missing",
        now,
      });
      continue;
    }

    const account = await repository.getAccount(accountContext, webhook.integrationAccountId);
    const adapter = registry.resolve(account.providerId);
    if (!adapter || !adapter.supportedWebhookTypes.includes(claimed.eventType)) {
      await repository.finishWebhook(accountContext, {
        id: claimed.id,
        status: "failed",
        errorReference: "integration_webhook_adapter_unconfigured",
        now,
      });
      webhooksFailed += 1;
      continue;
    }

    try {
      const result = await adapter.processWebhook(
        {
          account,
          eventId: claimed.externalEventId,
          eventType: claimed.eventType,
          payloadReference: claimed.payloadReference,
          correlationId: claimed.correlationId,
          now,
          context: accountContext,
        },
        repository,
      );
      for (const reference of result.externalReferences ?? []) {
        await repository.upsertExternalReference(accountContext, {
          id: brandId<"EntityId">(crypto.randomUUID()),
          resourceType: reference.resourceType,
          resourceId: brandId<"EntityId">(reference.resourceId),
          externalType: reference.externalType,
          externalReference: reference.externalReference,
          integrationAccountId: account.id,
          ...(reference.status !== undefined ? { status: reference.status } : {}),
          ...(reference.metadata !== undefined ? { metadata: reference.metadata } : {}),
          now,
        });
      }
      await repository.finishWebhook(accountContext, {
        id: claimed.id,
        status: result.status,
        now,
      });
      if (result.status === "processed") webhooksProcessed += 1;
    } catch (error) {
      const retry = claimed.retryCount < 4;
      await repository.finishWebhook(accountContext, {
        id: claimed.id,
        status: retry ? "queued" : "failed",
        errorReference: error instanceof Error ? error.name : "integration_webhook_processing_failed",
        now,
      });
      if (!retry) webhooksFailed += 1;
    }
  }

  for (const sync of syncJobs) {
    const claimed = await repository.claimSyncJob(sync.id, now);
    if (!claimed) continue;
    syncJobsClaimed += 1;

    const accountContext = await buildContextForAccount(repository, claimed.integrationAccountId, claimed.correlationId);
    const account = await repository.getAccount(accountContext, claimed.integrationAccountId);
    const adapter = registry.resolve(account.providerId);
    if (!adapter || !adapter.supportedSyncTypes.includes(claimed.syncType)) {
      await repository.finishSyncJob(accountContext, {
        id: claimed.id,
        status: "failed",
        errorCount: 1,
        now,
      });
      syncJobsFailed += 1;
      continue;
    }

    try {
      const result = await adapter.processSync(
        {
          account,
          syncType: claimed.syncType,
          direction: claimed.direction,
          cursorReference: claimed.cursorReference,
          checkpointReference: claimed.checkpointReference,
          correlationId: claimed.correlationId,
          now,
          context: accountContext,
        },
        repository,
      );
      for (const reference of result.externalReferences ?? []) {
        await repository.upsertExternalReference(accountContext, {
          id: brandId<"EntityId">(crypto.randomUUID()),
          resourceType: reference.resourceType,
          resourceId: brandId<"EntityId">(reference.resourceId),
          externalType: reference.externalType,
          externalReference: reference.externalReference,
          integrationAccountId: account.id,
          ...(reference.status !== undefined ? { status: reference.status } : {}),
          ...(reference.metadata !== undefined ? { metadata: reference.metadata } : {}),
          now,
        });
      }
      await repository.finishSyncJob(accountContext, {
        id: claimed.id,
        status: "completed",
        ...(result.cursorReference !== undefined ? { cursorReference: result.cursorReference } : {}),
        ...(result.checkpointReference !== undefined ? { checkpointReference: result.checkpointReference } : {}),
        itemCount: result.itemCount ?? 0,
        errorCount: result.errorCount ?? 0,
        now,
      });
      syncJobsCompleted += 1;
    } catch {
      const retryAt = new Date(Date.parse(now) + retryDelayMs(claimed));
      await repository.finishSyncJob(accountContext, {
        id: claimed.id,
        status: "queued",
        errorCount: 1,
        nextRunAt: retryAt.toISOString(),
        now,
      });
      if (claimed.errorCount >= 4) {
        await repository.finishSyncJob(accountContext, {
          id: claimed.id,
          status: "failed",
          errorCount: 0,
          nextRunAt: null,
          now,
        });
        syncJobsFailed += 1;
      }
    }
  }

  return {
    webhooksSeen: webhooks.length,
    webhooksClaimed,
    webhooksProcessed,
    webhooksFailed,
    syncJobsSeen: syncJobs.length,
    syncJobsClaimed,
    syncJobsCompleted,
    syncJobsFailed,
  };
}

async function buildContextForAccount(
  repository: IntegrationRepository,
  integrationAccountId: EntityId,
  correlationId: string,
): Promise<RequestContext> {
  const account = await repository.getAccount(platformContext(), integrationAccountId);
  return {
    requestId: brandId<"RequestId">("integration:" + integrationAccountId),
    correlationId: brandId<"CorrelationId">(correlationId),
    actorId: brandId<"EntityId">("system:" + account.organizationId),
    tenantId: account.organizationId,
    ...(account.workspaceId ? { workspaceId: account.workspaceId } : {}),
    module: "integration",
    operation: "integration.worker",
    locale: "en",
    timezone: "UTC",
    authenticated: true,
  };
}

function platformContext(): RequestContext {
  return {
    requestId: brandId<"RequestId">("integration:lookup"),
    correlationId: brandId<"CorrelationId">("integration:lookup"),
    actorId: brandId<"EntityId">("system"),
    tenantId: brandId<"EntityId">("system"),
    module: "integration",
    operation: "integration.worker.lookup",
    locale: "en",
    timezone: "UTC",
    authenticated: true,
  };
}

function retryDelayMs(job: IntegrationSyncJobRecord): number {
  return Math.min(60 * 60_000, 5 * 60_000 * 2 ** Math.min(job.errorCount, 6));
}
