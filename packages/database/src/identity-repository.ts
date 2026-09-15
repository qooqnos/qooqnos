import { DatabaseError, D1Database, Repository } from "./client";

export type UserStatus = "active" | "suspended" | "deleted";

export interface UserRecord {
  readonly id: string;
  readonly status: UserStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ExternalIdentityRecord {
  readonly id: string;
  readonly userId: string;
  readonly provider: string;
  readonly subject: string;
  readonly createdAt: string;
}

export interface CreateUserInput {
  readonly id: string;
  readonly status?: UserStatus;
  readonly now: string;
}

export interface AddExternalIdentityInput {
  readonly id: string;
  readonly userId: string;
  readonly provider: string;
  readonly subject: string;
  readonly now: string;
}

export class IdentityRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const status = input.status ?? "active";
    await this.database.run(
      "INSERT INTO users (id, status, created_at, updated_at) VALUES (?, ?, ?, ?)",
      input.id,
      status,
      input.now,
      input.now,
    );
    return {
      id: input.id,
      status,
      createdAt: input.now,
      updatedAt: input.now,
    };
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    return this.database.first<UserRecord>(
      "SELECT id, status, created_at AS createdAt, updated_at AS updatedAt FROM users WHERE id = ? LIMIT 1",
      userId,
    );
  }

  async addExternalIdentity(input: AddExternalIdentityInput): Promise<ExternalIdentityRecord> {
    const user = await this.getUserById(input.userId);
    if (!user) throw new DatabaseError("Cannot attach identity to an unknown user");

    await this.database.run(
      "INSERT INTO external_identities (id, user_id, provider, subject, created_at) VALUES (?, ?, ?, ?, ?)",
      input.id,
      input.userId,
      input.provider,
      input.subject,
      input.now,
    );

    return {
      id: input.id,
      userId: input.userId,
      provider: input.provider,
      subject: input.subject,
      createdAt: input.now,
    };
  }

  async getExternalIdentity(provider: string, subject: string): Promise<ExternalIdentityRecord | null> {
    return this.database.first<ExternalIdentityRecord>(
      "SELECT id, user_id AS userId, provider, subject, created_at AS createdAt FROM external_identities WHERE provider = ? AND subject = ? LIMIT 1",
      provider,
      subject,
    );
  }

  async getUserByExternalIdentity(provider: string, subject: string): Promise<UserRecord | null> {
    return this.database.first<UserRecord>(
      "SELECT u.id, u.status, u.created_at AS createdAt, u.updated_at AS updatedAt FROM users u INNER JOIN external_identities e ON e.user_id = u.id WHERE e.provider = ? AND e.subject = ? LIMIT 1",
      provider,
      subject,
    );
  }
}
