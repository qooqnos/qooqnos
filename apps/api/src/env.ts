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

export interface ApiEnv {
  readonly APP_VERSION?: string;
  readonly DB?: D1DatabaseLike;
}

export function requireDatabase(env: ApiEnv): D1DatabaseLike {
  if (!env.DB) throw new Error("D1 database binding is not configured");
  return env.DB;
}
