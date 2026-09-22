import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const base = process.env.MIGRATION_BASE_SHA || "HEAD~1";
const head = process.env.GITHUB_SHA || "HEAD";

const changed = execFileSync(
  "git",
  ["diff", "--name-only", base, head],
  { encoding: "utf8" },
)
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean);

const migrationChanges = changed.filter((path) => /^migrations\/\d{4}_.+\.sql$/.test(path));
const lockChanged = changed.includes("migrations/migration-lock.json");

if (!lockChanged && migrationChanges.length > 0) {
  throw new Error(
    "Migration SQL changed without a corresponding migration-lock.json change.",
  );
}

if (lockChanged && migrationChanges.length === 0) {
  const baseLock = JSON.parse(
    execFileSync("git", ["show", `${base}:migrations/migration-lock.json`], {
      encoding: "utf8",
    }),
  );
  const headLock = JSON.parse(readFileSync("migrations/migration-lock.json", "utf8"));

  const baseEntries = new Map(
    (baseLock.migrations || []).map((entry) => [entry.id, entry]),
  );
  const changedEntries = (headLock.migrations || []).filter((entry) => {
    const previous = baseEntries.get(entry.id);
    return previous && JSON.stringify(previous) !== JSON.stringify(entry);
  });

  if (changedEntries.length === 0) {
    throw new Error(
      "Migration lock changed without a recognized existing migration entry change.",
    );
  }

  for (const entry of changedEntries) {
    const previous = baseEntries.get(entry.id);
    if (
      previous.version !== entry.version ||
      previous.moduleId !== entry.moduleId ||
      previous.filename !== entry.filename
    ) {
      throw new Error(
        `Migration lock metadata changed without a migration SQL change: ${entry.filename}`,
      );
    }

    if (previous.checksum === entry.checksum) {
      throw new Error(
        `Migration lock changed without a checksum change: ${entry.filename}`,
      );
    }

    const sql = readFileSync(entry.filename);
    // A checksum-only correction is safe only when the lock now matches the
    // canonical SQL source exactly. Any semantic SQL change must still travel
    // with the migration file in the same commit range.
    const { createHash } = await import("node:crypto");
    const checksum = createHash("sha256").update(sql).digest("hex");
    if (checksum !== entry.checksum) {
      throw new Error(
        `Migration lock checksum does not match SQL source: ${entry.filename}`,
      );
    }
  }

  console.log(
    `Migration history check: ${changedEntries.length} existing migration lock checksum correction(s) validated.`,
  );
} else {
  console.log(
    migrationChanges.length === 0
      ? "Migration history check: no migration SQL or lock changes in this range."
      : `Migration history check: ${migrationChanges.length} migration SQL file(s) changed with lock update.`,
  );
}
