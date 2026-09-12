export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch(statements: D1PreparedStatementLike[]): Promise<D1ResultLike[]>;
}

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<D1ResultLike>;
}

export interface D1ResultLike {
  success: boolean;
  meta?: { changes?: number };
}

export class DatabaseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DatabaseError";
  }
}

export class D1Database {
  constructor(private readonly db: D1DatabaseLike) {}

  statement(sql: string, ...params: unknown[]): D1PreparedStatementLike {
    if (!sql.trim()) throw new DatabaseError("SQL statement cannot be empty");
    return this.db.prepare(sql).bind(...params);
  }

  async first<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    return this.statement(sql, ...params).first<T>();
  }

  async all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const result = await this.statement(sql, ...params).all<T>();
    return result.results;
  }

  async run(sql: string, ...params: unknown[]): Promise<D1ResultLike> {
    const result = await this.statement(sql, ...params).run();
    if (!result.success) throw new DatabaseError("Database operation failed");
    return result;
  }

  async transaction(statements: Array<{ sql: string; params?: unknown[] }>): Promise<D1ResultLike[]> {
    if (statements.length === 0) return [];
    const prepared = statements.map(({ sql, params = [] }) => this.statement(sql, ...params));
    const results = await this.db.batch(prepared);
    if (results.some((result) => !result.success)) {
      throw new DatabaseError("Database batch failed");
    }
    return results;
  }
}

export interface RepositoryContext {
  readonly organizationId?: string;
  readonly workspaceId?: string;
}

export abstract class Repository {
  constructor(protected readonly database: D1Database) {}

  protected requireOrganization(context: RepositoryContext): string {
    if (!context.organizationId) throw new DatabaseError("Organization context is required");
    return context.organizationId;
  }

  protected requireWorkspace(context: RepositoryContext): string {
    if (!context.workspaceId) throw new DatabaseError("Workspace context is required");
    return context.workspaceId;
  }
}

export * from "./migrations";
export * from "./migration-catalog";
export * from "./identity-repository";
export * from "./workspace-repository";
export * from "./services";
