import { describe, expect, it } from "vitest";
import { generateMigrationLock, verifyMigrationLock, MigrationLockError, type MigrationDefinition } from "./index";

function definition(overrides: Partial<MigrationDefinition> = {}): MigrationDefinition {
  return {
    id: "0001_foundation",
    version: 1,
    moduleId: "foundation",
    sql: "CREATE TABLE example (id TEXT PRIMARY KEY);",
    checksum: "checksum-0001",
    statements: ["CREATE TABLE example (id TEXT PRIMARY KEY);"],
    ...overrides,
  };
}

describe("generateMigrationLock", () => {
  it("produces one sorted entry per definition with a derived filename", () => {
    const manifest = generateMigrationLock([
      definition({ id: "0002_onboarding", version: 2, moduleId: "onboarding", checksum: "checksum-0002" }),
      definition(),
    ]);

    expect(manifest.migrations.map((entry) => entry.id)).toEqual(["0001_foundation", "0002_onboarding"]);
    expect(manifest.migrations[0]).toMatchObject({
      id: "0001_foundation",
      version: 1,
      moduleId: "foundation",
      checksum: "checksum-0001",
      filename: "0001_foundation.sql",
    });
  });
});

describe("verifyMigrationLock", () => {
  it("passes for definitions that exactly match the lock manifest", () => {
    const definitions = [definition()];
    const manifest = generateMigrationLock(definitions);
    expect(() => verifyMigrationLock(definitions, manifest)).not.toThrow();
  });

  it("rejects a definition whose checksum drifted from the committed lock (tampering / undisclosed edit)", () => {
    const definitions = [definition()];
    const manifest = generateMigrationLock(definitions);
    const tampered = [definition({ checksum: "checksum-different" })];

    expect(() => verifyMigrationLock(tampered, manifest)).toThrow(MigrationLockError);
  });

  it("rejects a migration definition with no entry in the lock manifest", () => {
    const manifest = generateMigrationLock([definition()]);
    const withExtraMigration = [
      definition(),
      definition({ id: "0002_onboarding", version: 2, moduleId: "onboarding", checksum: "checksum-0002" }),
    ];

    expect(() => verifyMigrationLock(withExtraMigration, manifest)).toThrow(MigrationLockError);
  });

  it("rejects a lock manifest entry with no matching migration definition", () => {
    const definitions = [
      definition(),
      definition({ id: "0002_onboarding", version: 2, moduleId: "onboarding", checksum: "checksum-0002" }),
    ];
    const manifest = generateMigrationLock(definitions);

    expect(() => verifyMigrationLock([definition()], manifest)).toThrow(MigrationLockError);
  });

  it("allows reserved gaps while rejecting duplicate or descending versions", () => {
    const definitions = [definition(), definition({ id: "0003_gap", version: 3, checksum: "checksum-0003" })];
    const manifest = generateMigrationLock(definitions);

    expect(() => verifyMigrationLock(definitions, manifest)).not.toThrow();
    expect(() => verifyMigrationLock(
      [definition(), definition({ id: "0001_duplicate-version", version: 1, checksum: "checksum-duplicate" })],
      generateMigrationLock([definition(), definition({ id: "0001_duplicate-version", version: 1, checksum: "checksum-duplicate" })]),
    )).toThrow(MigrationLockError);
  });

  it("rejects an identity mismatch (same id, different module/version) even if the checksum matches", () => {
    const definitions = [definition()];
    const manifest = generateMigrationLock(definitions);
    const renamedModule = [definition({ moduleId: "renamed" })];

    expect(() => verifyMigrationLock(renamedModule, manifest)).toThrow(MigrationLockError);
  });

  it("rejects a filename mismatch", () => {
    const definitions = [definition()];
    const manifest = generateMigrationLock(definitions);
    const invalid = {
      ...manifest,
      migrations: manifest.migrations.map((entry) => ({ ...entry, filename: "0001_changed.sql" })),
    };

    expect(() => verifyMigrationLock(definitions, invalid)).toThrow(MigrationLockError);
  });
});
