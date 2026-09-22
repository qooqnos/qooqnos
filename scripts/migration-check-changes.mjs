import { execFileSync } from "node:child_process";

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

if (lockChanged && migrationChanges.length === 0) {
  throw new Error(
    "Migration lock changed without a corresponding migration SQL change.",
  );
}

if (migrationChanges.length > 0 && !lockChanged) {
  throw new Error(
    "Migration SQL changed without a corresponding migration-lock.json change.",
  );
}

console.log(
  migrationChanges.length === 0
    ? "Migration history check: no migration SQL changed in this range."
    : `Migration history check: ${migrationChanges.length} migration SQL file(s) changed with lock update.`,
);
