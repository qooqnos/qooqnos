import { DatabaseError, D1Database, Repository } from "./client";

export type SessionStatus = "active" | "revoked" | "expired";

export interface SessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly status: SessionStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly lastSeenAt: string | null;
}

export interface CreateSessionInput {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export class SessionRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async create(input: CreateSessionInput): Promise<SessionRecord> {
    const user = await this.database.first<{ id: string }>(
      "SELECT id FROM users WHERE id = ? AND status = 'active' LIMIT 1",
      input.userId,
    );
    if (!user) throw new DatabaseError("Cannot create a session for an inactive or unknown user");

    await this.database.run(
      "INSERT INTO sessions (id, user_id, token_hash, status, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, 'active', ?, ?, NULL)",
      input.id,
      input.userId,
      input.tokenHash,
      input.createdAt,
      input.expiresAt,
    );

    return {
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      status: "active",
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      lastSeenAt: null,
    };
  }

  async findActiveByTokenHash(tokenHash: string, now: string): Promise<SessionRecord | null> {
    const session = await this.database.first<SessionRecord>(
      "SELECT id, user_id AS userId, token_hash AS tokenHash, status, created_at AS createdAt, expires_at AS expiresAt, last_seen_at AS lastSeenAt FROM sessions WHERE token_hash = ? AND status = 'active' AND expires_at > ? LIMIT 1",
      tokenHash,
      now,
    );
    return session;
  }

  async touch(sessionId: string, now: string): Promise<void> {
    await this.database.run(
      "UPDATE sessions SET last_seen_at = ? WHERE id = ? AND status = 'active' AND expires_at > ?",
      now,
      sessionId,
      now,
    );
  }

  async revoke(sessionId: string): Promise<boolean> {
    const result = await this.database.run(
      "UPDATE sessions SET status = 'revoked' WHERE id = ? AND status = 'active'",
      sessionId,
    );
    return result.meta.changes > 0;
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.database.run(
      "UPDATE sessions SET status = 'revoked' WHERE user_id = ? AND status = 'active'",
      userId,
    );
    return result.meta.changes;
  }

  async expire(now: string): Promise<number> {
    const result = await this.database.run(
      "UPDATE sessions SET status = 'expired' WHERE status = 'active' AND expires_at <= ?",
      now,
    );
    return result.meta.changes;
  }
}
