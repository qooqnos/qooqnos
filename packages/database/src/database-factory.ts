/**
 * Database Factory
 * 
 * Creates and initializes database connections for different environments.
 * Handles configuration, connection pooling, and migration execution.
 */

import { DatabaseConnection, createDatabaseConnection, DatabaseConfig } from "./postgres-adapter";
import { MigrationRunner, BUILTIN_MIGRATIONS } from "./migrations";

// ============================================================================
// DATABASE FACTORY
// ============================================================================

export class DatabaseFactory {
  /**
   * Create a database connection for the given environment
   */
  static async create(config: DatabaseConfig): Promise<DatabaseConnection> {
    return createDatabaseConnection(config);
  }

  /**
   * Initialize database with migrations
   */
  static async initialize(db: DatabaseConnection): Promise<void> {
    const runner = new MigrationRunner(db);
    
    // Initialize tracking table
    await runner.initialize();
    
    // Register all built-in migrations
    for (const migration of BUILTIN_MIGRATIONS) {
      try {
        runner.register(migration);
      } catch {
        // Already registered, continue
      }
    }
    
    // Apply pending migrations
    const results = await runner.migrateUp();
    console.log(`Applied ${results.length} migrations`);
    
    for (const result of results) {
      console.log(`✅ ${result.name} (${result.duration}ms)`);
    }
  }

  /**
   * Create development/test database (in-memory or SQLite)
   */
  static async createDev(): Promise<DatabaseConnection> {
    const db = await this.create({
      database: ":memory:",
      dev: true,
    });
    
    // Initialize schema for development
    await this.initialize(db);
    
    return db;
  }

  /**
   * Create production database (PostgreSQL)
   */
  static async createProduction(
    host: string = process.env.DB_HOST || "localhost",
    port: number = parseInt(process.env.DB_PORT || "5432"),
    database: string = process.env.DB_NAME || "qooqnos",
    user: string = process.env.DB_USER || "postgres",
    password: string = process.env.DB_PASSWORD || ""
  ): Promise<DatabaseConnection> {
    const db = await this.create({
      host,
      port,
      database,
      user,
      password,
      ssl: process.env.DB_SSL === "true",
      dev: false,
    });
    
    // Initialize schema for production
    await this.initialize(db);
    
    return db;
  }
}
