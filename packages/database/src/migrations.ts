/**
 * Database Migration System
 * 
 * Handles schema versioning and progressive application of database changes.
 * Migrations are SQL files executed in order with a tracking mechanism.
 */

import { DatabaseConnection, QueryResult } from "./postgres-adapter";

// ============================================================================
// TYPES
// ============================================================================

export interface Migration {
  readonly id: string; // e.g., "001_initial_schema"
  readonly version: number;
  readonly name: string;
  readonly up: string; // SQL to apply migration
  readonly down: string; // SQL to rollback migration
}

export interface MigrationStatus {
  readonly id: string;
  readonly name: string;
  readonly appliedAt: Date;
  readonly duration: number; // milliseconds
}

export class MigrationError extends Error {
  constructor(message: string, readonly id: string) {
    super(message);
    this.name = "MigrationError";
  }
}

// ============================================================================
// MIGRATION RUNNER
// ============================================================================

export class MigrationRunner {
  private db: DatabaseConnection;
  private migrations: Map<string, Migration> = new Map();
  private applied: Set<string> = new Set();

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * Register a migration
   */
  register(migration: Migration): void {
    if (this.migrations.has(migration.id)) {
      throw new MigrationError(`Migration ${migration.id} already registered`, migration.id);
    }
    this.migrations.set(migration.id, migration);
  }

  /**
   * Initialize migration tracking table
   */
  async initialize(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        duration_ms INTEGER NOT NULL
      );
    `;

    try {
      await this.db.query(createTableSQL);
    } catch (error) {
      // Table might already exist, which is fine
    }

    // Load already-applied migrations
    const result = await this.db.query<{ id: string }>(
      "SELECT id FROM schema_migrations ORDER BY applied_at"
    );
    result.rows.forEach((row) => {
      this.applied.add(row.id);
    });
  }

  /**
   * Get pending migrations
   */
  getPending(): Migration[] {
    return Array.from(this.migrations.values())
      .filter((m) => !this.applied.has(m.id))
      .sort((a, b) => a.version - b.version);
  }

  /**
   * Get applied migrations
   */
  getApplied(): Migration[] {
    return Array.from(this.migrations.values())
      .filter((m) => this.applied.has(m.id))
      .sort((a, b) => a.version - b.version);
  }

  /**
   * Apply a single migration
   */
  async apply(id: string): Promise<MigrationStatus> {
    const migration = this.migrations.get(id);
    if (!migration) {
      throw new MigrationError(`Migration ${id} not found`, id);
    }

    if (this.applied.has(id)) {
      throw new MigrationError(`Migration ${id} already applied`, id);
    }

    const startTime = Date.now();

    try {
      await this.db.transaction(async (tx) => {
        // Execute migration SQL
        const statements = migration.up.split(";").filter((s) => s.trim());
        for (const statement of statements) {
          if (statement.trim()) {
            await tx.query(statement);
          }
        }

        // Record in migrations table
        const duration = Date.now() - startTime;
        await tx.query(
          `INSERT INTO schema_migrations (id, name, duration_ms) VALUES ($1, $2, $3)`,
          [id, migration.name, duration]
        );

        await tx.commit();
      });

      this.applied.add(id);

      return {
        id,
        name: migration.name,
        appliedAt: new Date(),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      throw new MigrationError(
        `Failed to apply migration ${id}: ${error}`,
        id
      );
    }
  }

  /**
   * Apply all pending migrations
   */
  async migrateUp(): Promise<MigrationStatus[]> {
    const pending = this.getPending();
    const results: MigrationStatus[] = [];

    for (const migration of pending) {
      const status = await this.apply(migration.id);
      results.push(status);
    }

    return results;
  }

  /**
   * Rollback a migration
   */
  async rollback(id: string): Promise<void> {
    const migration = this.migrations.get(id);
    if (!migration) {
      throw new MigrationError(`Migration ${id} not found`, id);
    }

    if (!this.applied.has(id)) {
      throw new MigrationError(`Migration ${id} not applied`, id);
    }

    try {
      await this.db.transaction(async (tx) => {
        // Execute rollback SQL
        const statements = migration.down.split(";").filter((s) => s.trim());
        for (const statement of statements) {
          if (statement.trim()) {
            await tx.query(statement);
          }
        }

        // Remove from migrations table
        await tx.query("DELETE FROM schema_migrations WHERE id = $1", [id]);

        await tx.commit();
      });

      this.applied.delete(id);
    } catch (error) {
      throw new MigrationError(
        `Failed to rollback migration ${id}: ${error}`,
        id
      );
    }
  }

  /**
   * Get migration status
   */
  async status(): Promise<{
    readonly total: number;
    readonly applied: number;
    readonly pending: number;
    readonly migrations: Array<{
      readonly id: string;
      readonly name: string;
      readonly status: "pending" | "applied";
    }>;
  }> {
    const migrations = Array.from(this.migrations.values())
      .sort((a, b) => a.version - b.version)
      .map((m) => ({
        id: m.id,
        name: m.name,
        status: this.applied.has(m.id) ? ("applied" as const) : ("pending" as const),
      }));

    return {
      total: this.migrations.size,
      applied: this.applied.size,
      pending: this.migrations.size - this.applied.size,
      migrations,
    };
  }
}

// ============================================================================
// BUILT-IN MIGRATIONS
// ============================================================================

export const BUILTIN_MIGRATIONS: readonly Migration[] = [
  {
    id: "001_initial_schema",
    version: 1,
    name: "Create initial schema",
    up: `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Workspaces table
      CREATE TABLE IF NOT EXISTS workspaces (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_id VARCHAR(36) NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Services table
      CREATE TABLE IF NOT EXISTS services (
        id VARCHAR(36) PRIMARY KEY,
        workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'USD',
        provider_id VARCHAR(36) NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Bookings table
      CREATE TABLE IF NOT EXISTS bookings (
        id VARCHAR(36) PRIMARY KEY,
        service_id VARCHAR(36) NOT NULL REFERENCES services(id),
        buyer_id VARCHAR(36) NOT NULL REFERENCES users(id),
        provider_id VARCHAR(36) NOT NULL REFERENCES users(id),
        workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        total_price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Workspace members table
      CREATE TABLE IF NOT EXISTS workspace_members (
        workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id),
        user_id VARCHAR(36) NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workspace_id, user_id)
      );

      -- Create indexes for common queries
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
      CREATE INDEX IF NOT EXISTS idx_services_workspace_id ON services(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_services_provider_id ON services(provider_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_service_id ON bookings(service_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_buyer_id ON bookings(buyer_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_provider_id ON bookings(provider_id);
      CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
    `,
    down: `
      DROP TABLE IF EXISTS workspace_members;
      DROP TABLE IF EXISTS bookings;
      DROP TABLE IF EXISTS services;
      DROP TABLE IF EXISTS workspaces;
      DROP TABLE IF EXISTS users;
    `,
  },
];
