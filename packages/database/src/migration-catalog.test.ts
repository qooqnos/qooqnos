import { describe, expect, it } from "vitest";
import { splitSqlStatements } from "./migration-catalog";

describe("splitSqlStatements", () => {
  it("keeps SQLite trigger bodies together", () => {
    const sql = [
      "CREATE TABLE examples (id TEXT PRIMARY KEY);",
      "CREATE TRIGGER trg_examples AFTER INSERT ON examples",
      "FOR EACH ROW",
      "BEGIN",
      "  INSERT INTO examples (id) VALUES ('child;value');",
      "  SELECT 1;",
      "END;",
      "CREATE INDEX idx_examples_id ON examples(id);",
    ].join("\n");

    const statements = splitSqlStatements(sql);

    expect(statements).toHaveLength(3);
    expect(statements[0]).toContain("CREATE TABLE examples");
    expect(statements[1]).toContain("CREATE TRIGGER trg_examples");
    expect(statements[1]).toContain("INSERT INTO examples (id) VALUES ('child;value')");
    expect(statements[1]).toContain("END");
    expect(statements[2]).toContain("CREATE INDEX idx_examples_id");
  });

  it("ignores trigger keywords inside comments and quoted identifiers", () => {
    const sql = [
      "-- CREATE TRIGGER fake",
      "CREATE TABLE \"BEGIN;END\" (id TEXT PRIMARY KEY);",
      "/* CREATE TRIGGER fake2 */",
      "CREATE TRIGGER trg_real AFTER INSERT ON \"BEGIN;END\"",
      "BEGIN",
      "  SELECT 'BEGIN;END';",
      "END;",
    ].join("\n");

    const statements = splitSqlStatements(sql);

    expect(statements).toHaveLength(2);
    expect(statements[1]).toContain("CREATE TRIGGER trg_real");
  });

  it("rejects unterminated trigger blocks", () => {
    expect(() =>
      splitSqlStatements(
        "CREATE TRIGGER trg_real AFTER INSERT ON examples BEGIN SELECT 1;",
      ),
    ).toThrow("Unterminated SQLite trigger block");
  });
});
