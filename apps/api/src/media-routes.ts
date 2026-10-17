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
    method: "GET",
    path: "/api/v1/public/offerings/:offeringId/media",
    module: "media",
    operation: "media.public.offering.list",
    requireAuthentication: false,
    requireWorkspace: false,
    handler: async ({ context, params }) => {
      if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId: context.requestId });
      const offeringId = requiredParam(params.offeringId, context.requestId);
      const assets = await listPublishedOfferingMedia(database, offeringId);
      return json({
        data: assets.map((asset) => ({
          assetId: asset.assetId,
          purpose: asset.purpose,
          position: asset.position,
          mimeType: asset.mimeType,
          byteSize: asset.byteSize,
          width: asset.width,
          height: asset.height,
          src: publicOfferingMediaContentPath(offeringId, asset.assetId),
        })),
      }, 200, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/public/offerings/:offeringId/media/:assetId/content",
    module: "media",
    operation: "media.public.offering.content",
    requireAuthentication: false,
    requireWorkspace: false,
    handler: async ({ context, params }) => {
      if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId: context.requestId });
      if (!env.MEDIA_BUCKET) throw new AppError({ code: "NOT_READY", message: "R2 media bucket is not configured.", requestId: context.requestId });
      const offeringId = requiredParam(params.offeringId, context.requestId);
      const assetId = requiredParam(params.assetId, context.requestId);
      const asset = await getPublishedOfferingMedia(database, offeringId, assetId);
      if (!asset) throw new AppError({ code: "NOT_FOUND", message: "Published offering image not found.", requestId: context.requestId });
      const object = await env.MEDIA_BUCKET.get(asset.storageKey);
      if (!object || typeof object !== "object" || !("body" in object)) {
        throw new AppError({ code: "NOT_FOUND", message: "Published offering image content not found.", requestId: context.requestId });
      }
      const headers = new Headers();
      headers.set("Content-Type", asset.mimeType);
      headers.set("Content-Length", String(asset.byteSize));
      headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
      headers.set("X-Content-Type-Options", "nosniff");
      return new Response((object as { body: ReadableStream<Uint8Array> }).body, { status: 200, headers });
    },
  });

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
      const preparedImageVersion = form.get("preparedImage");
      let preparedDimensions: { width: number; height: number } | null = null;
      if (preparedImageVersion !== null) {
        if (preparedImageVersion !== "browser-webp-v1" || ownerType !== "business" || file.type.toLowerCase() !== "image/webp") {
          throw new AppError({ code: "VALIDATION_ERROR", message: "Prepared image declaration is invalid.", requestId: context.requestId });
        }
        const width = requiredDimension(form.get("imageWidth"), "imageWidth", context.requestId);
        const height = requiredDimension(form.get("imageHeight"), "imageHeight", context.requestId);
        if (file.size < 1 || file.size > 10 * 1024 * 1024) {
          throw new AppError({ code: "VALIDATION_ERROR", message: "Prepared image size is invalid.", requestId: context.requestId });
        }
        const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
        if (!hasValidWebpRiffHeader(header, file.size)) {
          throw new AppError({ code: "VALIDATION_ERROR", message: "Prepared image is not a valid WebP RIFF container.", requestId: context.requestId });
        }
        preparedDimensions = { width, height };
      }
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

      let responseAsset = asset;
      if (preparedDimensions) {
        const now = new Date().toISOString();
        await database.run(
          `INSERT INTO media_variants
           (id, asset_id, variant_key, storage_key, mime_type, byte_size, width, height, checksum, status, created_at, updated_at)
           VALUES (?, ?, 'detail', ?, 'image/webp', ?, ?, ?, ?, 'ready', ?, ?)`,
          crypto.randomUUID(),
          asset.id,
          storageKey,
          file.size,
          preparedDimensions.width,
          preparedDimensions.height,
          asset.checksum ?? null,
          now,
          now,
        );
        responseAsset = await service.setStatus(context, asset.id, "ready");
      }

      return json({ data: responseAsset }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/catalog/offers/:offeringId/media/:assetId",
    module: "media",
    operation: "media.asset.link_offering",
    permission: "media:upload",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, params }) => {
      if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId: context.requestId });
      const offeringId = brandId<EntityId>(requiredParam(params.offeringId, context.requestId));
      const assetId = brandId<EntityId>(requiredParam(params.assetId, context.requestId));
      const offering = await database.first<{ businessId: string }>(
        `SELECT o.business_id AS businessId
           FROM offerings o
           INNER JOIN businesses b ON b.id = o.business_id
          WHERE o.id = ? AND b.organization_id = ? AND b.workspace_id = ?
          LIMIT 1`,
        offeringId,
        context.tenantId,
        context.workspaceId,
      );
      if (!offering) throw new AppError({ code: "NOT_FOUND", message: "Offering is not available in the current workspace.", requestId: context.requestId });
      const asset = await database.first<{ id: string }>(
        `SELECT a.id
           FROM media_assets a
          WHERE a.id = ?
            AND a.organization_id = ?
            AND a.workspace_id = ?
            AND a.owner_type = 'business'
            AND a.owner_id = ?
            AND a.status = 'ready'
            AND a.mime_type = 'image/webp'
            AND EXISTS (
              SELECT 1 FROM media_variants v
               WHERE v.asset_id = a.id
                 AND v.variant_key = 'detail'
                 AND v.status = 'ready'
                 AND v.mime_type = 'image/webp'
            )
          LIMIT 1`,
        assetId,
        context.tenantId,
        context.workspaceId,
        offering.businessId,
      );
      if (!asset) throw new AppError({ code: "NOT_FOUND", message: "Prepared image is not available for this business.", requestId: context.requestId });

      const existing = await database.first<{ id: string; purpose: string; position: number }>(
        `SELECT id, purpose, position FROM media_links
          WHERE asset_id = ? AND owner_type = 'offering' AND owner_id = ? LIMIT 1`,
        assetId,
        offeringId,
      );
      if (existing) return json({ data: { id: existing.id, offeringId, assetId, purpose: existing.purpose, position: existing.position, reused: true } }, 200, context.requestId);

      const nextPositionRow = await database.first<{ nextPosition: number }>(
        `SELECT COALESCE(MAX(position) + 1, 0) AS nextPosition
           FROM media_links
          WHERE owner_type = 'offering' AND owner_id = ?`,
        offeringId,
      );
      const position = Number(nextPositionRow?.nextPosition ?? 0);
      if (!Number.isSafeInteger(position) || position < 0 || position >= 12) {
        throw new AppError({ code: "CONFLICT", message: "The offering has reached its image limit.", requestId: context.requestId });
      }
      const purpose = position === 0 ? "primary" : "gallery";
      const id = brandId<EntityId>(crypto.randomUUID());
      const now = new Date().toISOString();
      await database.run(
        `INSERT OR IGNORE INTO media_links
         (id, asset_id, owner_type, owner_id, purpose, position, created_at)
         VALUES (?, ?, 'offering', ?, ?, ?, ?)`,
        id,
        assetId,
        offeringId,
        purpose,
        position,
        now,
      );
      const link = await database.first<{ id: string; purpose: string; position: number }>(
        `SELECT id, purpose, position FROM media_links
          WHERE asset_id = ? AND owner_type = 'offering' AND owner_id = ? LIMIT 1`,
        assetId,
        offeringId,
      );
      if (!link) throw new AppError({ code: "INTERNAL_ERROR", message: "Offering media link could not be saved.", requestId: context.requestId });
      return json({ data: { id: link.id, offeringId, assetId, purpose: link.purpose, position: link.position, reused: link.id !== id } }, link.id === id ? 201 : 200, context.requestId);
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


interface PublicOfferingMediaRecord {
  readonly assetId: string;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly purpose: string;
  readonly position: number;
}

const publicOfferingMediaSelect = `
  SELECT a.id AS assetId,
         COALESCE((
           SELECT v.storage_key FROM media_variants v
           WHERE v.asset_id = a.id AND v.status = 'ready'
             AND v.variant_key IN ('detail', 'card', 'thumbnail')
             AND v.mime_type LIKE 'image/%'
           ORDER BY CASE v.variant_key WHEN 'detail' THEN 0 WHEN 'card' THEN 1 ELSE 2 END
           LIMIT 1
         ), '') AS storageKey,
         COALESCE((
           SELECT v.mime_type FROM media_variants v
           WHERE v.asset_id = a.id AND v.status = 'ready'
             AND v.variant_key IN ('detail', 'card', 'thumbnail')
             AND v.mime_type LIKE 'image/%'
           ORDER BY CASE v.variant_key WHEN 'detail' THEN 0 WHEN 'card' THEN 1 ELSE 2 END
           LIMIT 1
         ), '') AS mimeType,
         COALESCE((
           SELECT v.byte_size FROM media_variants v
           WHERE v.asset_id = a.id AND v.status = 'ready'
             AND v.variant_key IN ('detail', 'card', 'thumbnail')
             AND v.mime_type LIKE 'image/%'
           ORDER BY CASE v.variant_key WHEN 'detail' THEN 0 WHEN 'card' THEN 1 ELSE 2 END
           LIMIT 1
         ), 0) AS byteSize,
         (
           SELECT v.width FROM media_variants v
           WHERE v.asset_id = a.id AND v.status = 'ready'
             AND v.variant_key IN ('detail', 'card', 'thumbnail')
             AND v.mime_type LIKE 'image/%'
           ORDER BY CASE v.variant_key WHEN 'detail' THEN 0 WHEN 'card' THEN 1 ELSE 2 END
           LIMIT 1
         ) AS width,
         (
           SELECT v.height FROM media_variants v
           WHERE v.asset_id = a.id AND v.status = 'ready'
             AND v.variant_key IN ('detail', 'card', 'thumbnail')
             AND v.mime_type LIKE 'image/%'
           ORDER BY CASE v.variant_key WHEN 'detail' THEN 0 WHEN 'card' THEN 1 ELSE 2 END
           LIMIT 1
         ) AS height,
         COALESCE((
           SELECT l.purpose FROM media_links l
           WHERE l.asset_id = a.id AND l.owner_type = 'offering' AND l.owner_id = o.id
           ORDER BY l.position ASC, l.created_at ASC
           LIMIT 1
         ), 'primary') AS purpose,
         COALESCE((
           SELECT l.position FROM media_links l
           WHERE l.asset_id = a.id AND l.owner_type = 'offering' AND l.owner_id = o.id
           ORDER BY l.position ASC, l.created_at ASC
           LIMIT 1
         ), 0) AS position
    FROM offerings o
    INNER JOIN businesses b ON b.id = o.business_id
    INNER JOIN media_assets a
      ON a.organization_id = b.organization_id
     AND a.workspace_id = b.workspace_id
   WHERE o.id = ?
     AND o.status = 'active'
     AND o.publication_status = 'published'
     AND b.status = 'active'
     AND b.publication_status = 'published'
     AND a.status = 'ready'
     AND a.mime_type LIKE 'image/%'
     AND (
       (a.owner_type = 'offering' AND a.owner_id = o.id)
       OR EXISTS (
         SELECT 1 FROM media_links l
         WHERE l.asset_id = a.id AND l.owner_type = 'offering' AND l.owner_id = o.id
       )
     )
     AND EXISTS (
       SELECT 1 FROM media_variants v
       WHERE v.asset_id = a.id AND v.status = 'ready'
         AND v.variant_key IN ('detail', 'card', 'thumbnail')
         AND v.mime_type LIKE 'image/%'
     )
`;

async function listPublishedOfferingMedia(
  database: D1Database,
  offeringId: string,
): Promise<PublicOfferingMediaRecord[]> {
  return database.all<PublicOfferingMediaRecord>(
    publicOfferingMediaSelect + " ORDER BY position ASC, assetId ASC LIMIT 12",
    offeringId,
  );
}

async function getPublishedOfferingMedia(
  database: D1Database,
  offeringId: string,
  assetId: string,
): Promise<PublicOfferingMediaRecord | null> {
  return database.first<PublicOfferingMediaRecord>(
    publicOfferingMediaSelect + " AND a.id = ? LIMIT 1",
    offeringId,
    assetId,
  );
}

function publicOfferingMediaContentPath(offeringId: string, assetId: string): string {
  return "/api/v1/public/offerings/" + encodeURIComponent(offeringId)
    + "/media/" + encodeURIComponent(assetId) + "/content";
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

export function hasValidWebpRiffHeader(header: Uint8Array, totalSize: number): boolean {
  if (header.length < 12 || !Number.isSafeInteger(totalSize) || totalSize < 12) return false;
  const isRiff = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46;
  const isWebp = header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50;
  if (!isRiff || !isWebp) return false;
  const riffSize = (header[4]! | (header[5]! << 8) | (header[6]! << 16) | (header[7]! << 24)) >>> 0;
  return riffSize + 8 === totalSize;
}

function requiredDimension(value: FormDataEntryValue | null, field: string, requestId: EntityId): number {
  const text = requiredString(value, field, requestId);
  const dimension = Number(text);
  if (!Number.isSafeInteger(dimension) || dimension < 1 || dimension > 4096) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be an integer from 1 to 4096.", requestId });
  }
  return dimension;
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
