import { MediaRepository, MediaService, type MediaAssetStatus } from "@qooqnos/media";
import { AuthorizationRepository } from "@qooqnos/database";
import { createAuthorizationService, type AuthorizationRegistry } from "@qooqnos/runtime";
import { AppError, brandId, type EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiEnv } from "./env";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerMediaRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  env: ApiEnv,
  authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "POST",
    path: "/api/v1/media/assets",
    module: "media",
    operation: "media.asset.upload",
    permission: "media:upload",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId: context.requestId });
      if (!env.MEDIA_BUCKET) throw new AppError({ code: "NOT_READY", message: "R2 media bucket is not configured.", requestId: context.requestId });

      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        throw new AppError({ code: "VALIDATION_ERROR", message: "multipart field 'file' is required.", requestId: context.requestId });
      }

      const ownerType = requiredString(form.get("ownerType"), "ownerType", context.requestId);
      const ownerId = brandId<EntityId>(requiredString(form.get("ownerId"), "ownerId", context.requestId));
      const suppliedStorageKey = typeof form.get("storageKey") === "string" ? String(form.get("storageKey")).trim() : "";
      const extension = inferExtension(file.type, file.name);
      const storageKey = suppliedStorageKey || [
        context.tenantId,
        context.workspaceId,
        ownerType,
        ownerId,
        crypto.randomUUID() + extension,
      ].join("/");

      await env.MEDIA_BUCKET.put(storageKey, file.stream(), {
        httpMetadata: {
          contentType: file.type || "application/octet-stream",
          contentLength: file.size,
        },
      });

      const metadata = parseMetadata(form.get("metadata"), context.requestId);
      const service = createService(database, authorization, context.requestId);
      const asset = await service.register(context, {
        ownerType,
        ownerId,
        storageKey,
        mimeType: file.type || "application/octet-stream",
        byteSize: file.size,
        checksum: typeof form.get("checksum") === "string" ? String(form.get("checksum")).trim() || undefined : undefined,
        metadata: {
          ...(metadata ?? {}),
          originalFileName: file.name,
        },
      });

      return json({ data: asset }, 201, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/media/assets/:assetId",
    module: "media",
    operation: "media.asset.read",
    permission: "media:read",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId: context.requestId });
      const repository = new MediaRepository(database);
      const assetId = brandId<EntityId>(requiredParam(params.assetId, context.requestId));
      const asset = await repository.get(context, assetId);
      if (!asset) throw new AppError({ code: "NOT_FOUND", message: "Media asset not found.", requestId: context.requestId });
      return json({ data: asset }, 200, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/media/assets/:assetId/content",
    module: "media",
    operation: "media.asset.content",
    permission: "media:read",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId: context.requestId });
      if (!env.MEDIA_BUCKET) throw new AppError({ code: "NOT_READY", message: "R2 media bucket is not configured.", requestId: context.requestId });
      const repository = new MediaRepository(database);
      const asset = await repository.get(context, brandId<EntityId>(requiredParam(params.assetId, context.requestId)));
      if (!asset) throw new AppError({ code: "NOT_FOUND", message: "Media asset not found.", requestId: context.requestId });

      const object = await env.MEDIA_BUCKET.get(asset.storageKey);
      if (!object || typeof object !== "object" || !("body" in object)) {
        throw new AppError({ code: "NOT_FOUND", message: "Media content not found in R2.", requestId: context.requestId });
      }

      const headers = new Headers();
      headers.set("Content-Type", asset.mimeType);
      headers.set("Content-Length", String(asset.byteSize));
      headers.set("Cache-Control", "private, max-age=300");
      return new Response((object as { body: ReadableStream<Uint8Array> }).body, { status: 200, headers });
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/media/assets/:assetId/status",
    module: "media",
    operation: "media.asset.status",
    permission: "media:status",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId: context.requestId });
      const body = await request.json().catch(() => null) as Record<string, unknown> | null;
      const status = requiredStatus(body?.status, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const asset = await service.setStatus(
        context,
        brandId<EntityId>(requiredParam(params.assetId, context.requestId)),
        status,
      );
      return json({ data: asset }, 200, context.requestId);
    },
  });
}

function createService(
  database: D1Database,
  authorization: AuthorizationRegistry | undefined,
  requestId: EntityId,
): MediaService {
  if (!authorization) throw new AppError({ code: "INTERNAL_ERROR", message: "Authorization registry is not configured.", requestId });
  return new MediaService({
    repository: new MediaRepository(database),
    authorization: createAuthorizationService(new AuthorizationRepository(database), authorization),
    id: () => brandId<EntityId>(crypto.randomUUID()),
    now: () => new Date().toISOString(),
  });
}

function requiredString(value: FormDataEntryValue | unknown, field: string, requestId: EntityId): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " is required.", requestId });
  }
  return value.trim();
}

function requiredParam(value: string | undefined, requestId: EntityId): string {
  if (!value) throw new AppError({ code: "NOT_FOUND", message: "Route parameter is missing.", requestId });
  return value;
}

function requiredStatus(value: unknown, requestId: EntityId): MediaAssetStatus {
  if (value === "pending" || value === "ready" || value === "failed" || value === "deleted") return value;
  throw new AppError({ code: "VALIDATION_ERROR", message: "status is invalid.", requestId });
}

function parseMetadata(value: FormDataEntryValue | null, requestId: EntityId): Record<string, unknown> | undefined {
  if (value === null) return undefined;
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("metadata must be an object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new AppError({ code: "VALIDATION_ERROR", message: "metadata must be a valid JSON object.", requestId });
  }
}

function inferExtension(mimeType: string, filename: string): string {
  const lowerMime = mimeType.toLowerCase();
  const mapping: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
    "image/heic": ".heic",
    "video/mp4": ".mp4",
    "audio/mpeg": ".mp3",
  };
  if (mapping[lowerMime]) return mapping[lowerMime];
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).replace(/[^a-z0-9.]/gi, "").slice(0, 8) : "";
}
