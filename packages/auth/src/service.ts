import type { EntityId, RequestContext } from "@qooqnos/core";
import type { IdentityRepository, SessionRecord, SessionRepository } from "@qooqnos/database";

export interface AuthenticatedSession {
  readonly sessionId: string;
  readonly userId: EntityId;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly lastSeenAt: string | null;
}

export interface SessionCredentials {
  readonly session: AuthenticatedSession;
  /** Returned only when a session is created; it is never persisted in plaintext. */
  readonly accessToken: string;
}

export interface CreateSessionOptions {
  readonly userId: EntityId;
  readonly now?: string;
  readonly expiresAt?: string;
  readonly ttlSeconds?: number;
  readonly sessionId: string;
}

export interface AuthenticationService {
  createSession(options: CreateSessionOptions): Promise<SessionCredentials>;
  authenticate(accessToken: string, now?: string): Promise<AuthenticatedSession | null>;
  revokeSession(sessionId: string): Promise<boolean>;
  revokeAllSessions(userId: EntityId): Promise<number>;
  buildContext(context: RequestContext, session: AuthenticatedSession): RequestContext;
}

export function createAuthenticationService(
  sessions: SessionRepository,
  identities: IdentityRepository,
): AuthenticationService {
  return {
    async createSession(options) {
      const now = options.now ?? new Date().toISOString();
      const expiresAt = options.expiresAt ?? new Date(Date.parse(now) + (options.ttlSeconds ?? 60 * 60 * 24 * 30) * 1000).toISOString();
      if (Date.parse(expiresAt) <= Date.parse(now)) throw new Error("Session expiration must be in the future");
      const accessToken = createAccessToken();
      const tokenHash = await sha256(accessToken);
      const record = await sessions.create({
        id: options.sessionId,
        userId: options.userId,
        tokenHash,
        createdAt: now,
        expiresAt,
      });
      return { session: sanitize(record), accessToken };
    },

    async authenticate(accessToken, now = new Date().toISOString()) {
      if (!accessToken.trim()) return null;
      const tokenHash = await sha256(accessToken);
      const record = await sessions.findActiveByTokenHash(tokenHash, now);
      if (!record) return null;
      const user = await identities.getUserById(record.userId);
      if (!user || user.status !== "active") {
        await sessions.revoke(record.id);
        return null;
      }
      await sessions.touch(record.id, now);
      return sanitize({ ...record, lastSeenAt: now });
    },

    revokeSession(sessionId) {
      return sessions.revoke(sessionId);
    },

    revokeAllSessions(userId) {
      return sessions.revokeAllForUser(userId);
    },

    buildContext(context, session) {
      return { ...context, actorId: session.userId };
    },
  };
}

function sanitize(record: SessionRecord): AuthenticatedSession {
  return {
    sessionId: record.id,
    userId: record.userId as EntityId,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    lastSeenAt: record.lastSeenAt,
  };
}

function createAccessToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
