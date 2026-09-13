import { D1Database, type D1ResultLike } from "./index";

export interface TransactionStatement {
  readonly sql: string;
  readonly params?: readonly unknown[];
}

export interface DatabaseTransaction {
  execute(statements: readonly TransactionStatement[]): Promise<readonly D1ResultLike[]>;
}

export class D1DatabaseTransaction implements DatabaseTransaction {
  constructor(private readonly database: D1Database) {}

  execute(statements: readonly TransactionStatement[]): Promise<readonly D1ResultLike[]> {
    return this.database.transaction(
      statements.map((statement) => ({
        sql: statement.sql,
        params: statement.params ? [...statement.params] : [],
      })),
    );
  }
}
