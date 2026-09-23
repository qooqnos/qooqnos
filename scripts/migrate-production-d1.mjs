#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const databaseName = required("PHOENIX_PROD_D1_DATABASE_NAME");
const expectedDatabaseId = required("PHOENIX_PROD_D1_DATABASE_ID");
const configPath = process.env.PHOENIX_PROD_WRANGLER_CONFIG?.trim() || ".wrangler/production.wrangler.toml";

const lock = JSON.parse(await readFile(path.join(root, "migrations", "migration-lock.json"), "utf8"));
if (!Array.isArray(lock.migrations) || lock.migrations.length === 0) {
  throw new Error("Migration lock is missing or empty.");
}

validateUuid(expectedDatabaseId);

const configured = await wranglerJson([
  "d1", "info", databaseName,
  "--config", configPath,
  "--env", "production",
]);

const remoteId = findUuid(configured);
if (!remoteId) {
  throw new Error("Cloudflare did not return a D1 UUID for the requested production database.");
}
if (remoteId.toLowerCase() !== expectedDatabaseId.toLowerCase()) {
  throw new Error(
    "Production D1 identity mismatch: expected " + expectedDatabaseId + ", Cloudflare returned " + remoteId,
  );
}

const registryRows = await readAppliedMigrations();
validateAppliedHistory(registryRows, lock.migrations);

const appliedByVersion = new Map(registryRows.map((row) => [row.version, row]));
const tempDir = await mkdtemp(path.join(os.tmpdir(), "phoenix-d1-"));

try {
  let appliedNow = 0;

  for (const definition of [...lock.migrations].sort((a, b) => a.version - b.version)) {
    const sqlPath = path.join(root, "migrations", definition.filename);
    const sql = await readFile(sqlPath, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");

    if (checksum !== definition.checksum) {
      throw new Error("Migration checksum drift for " + definition.filename);
    }

    const existing = appliedByVersion.get(definition.version);
    if (existing) {
      if (
        existing.id !== definition.id ||
        existing.module_id !== definition.moduleId ||
        existing.checksum !== definition.checksum
      ) {
        throw new Error("Applied migration " + definition.version + " does not match the canonical lock.");
      }
      continue;
    }

    const migrationSql = [
      "-- Phoenix canonical migration transport: generated from migrations/*.sql + migration-lock.json",
      sql.trimEnd(),
      "",
      "INSERT INTO schema_migrations (id, version, checksum, module_id, applied_at) VALUES (",
      "  " + sqlLiteral(definition.id) + ", " + definition.version + ", " +
        sqlLiteral(definition.checksum) + ", " + sqlLiteral(definition.moduleId) + ", " +
        sqlLiteral(new Date().toISOString()),
      ");",
      "",
    ].join("\n");

    const tempPath = path.join(tempDir, definition.filename);
    await writeFile(tempPath, migrationSql, "utf8");

    await runWrangler([
      "d1", "execute", databaseName,
      "--remote",
      "--config", configPath,
      "--env", "production",
      "--file", tempPath,
      "--yes",
    ]);

    const verified = await readAppliedMigrations();
    const row = verified.find((candidate) => candidate.version === definition.version);
    if (!row || row.id !== definition.id || row.checksum !== definition.checksum || row.module_id !== definition.moduleId) {
      throw new Error("Cloudflare D1 verification failed after applying " + definition.filename);
    }

    appliedNow += 1;
    process.stdout.write("Applied " + definition.filename + " (version " + definition.version + ").\n");
  }

  const finalRows = await readAppliedMigrations();
  validateAppliedHistory(finalRows, lock.migrations);
  const finalVersion = finalRows.length ? Math.max(...finalRows.map((row) => row.version)) : 0;

  process.stdout.write(
    "Phoenix canonical D1 migration complete: version " + finalVersion +
      ", applied now " + appliedNow + ", database " + databaseName + " (" + expectedDatabaseId + ").\n",
  );
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

async function readAppliedMigrations() {
  const tableCheck = await wranglerJson([
    "d1", "execute", databaseName,
    "--remote",
    "--config", configPath,
    "--env", "production",
    "--command",
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
  ]);

  const tableRows = extractRows(tableCheck).filter((row) => row && row.name === "schema_migrations");
  if (tableRows.length === 0) return [];

  const result = await wranglerJson([
    "d1", "execute", databaseName,
    "--remote",
    "--config", configPath,
    "--env", "production",
    "--command",
    "SELECT id, version, checksum, module_id, applied_at FROM schema_migrations ORDER BY version",
  ]);

  return extractRows(result).map((row) => ({
    id: String(row.id),
    version: Number(row.version),
    checksum: String(row.checksum),
    module_id: String(row.module_id),
    applied_at: String(row.applied_at),
  }));
}

async function wranglerJson(args) {
  const result = await runWrangler([...args, "--json"]);
  return parseJsonOutput(result.stdout);
}

async function runWrangler(args) {
  return execFileAsync(
    "npx",
    ["--yes", "wrangler@4.136.2", ...args],
    {
      cwd: root,
      env: process.env,
      maxBuffer: 32 * 1024 * 1024,
    },
  );
}

function validateAppliedHistory(rows, definitions) {
  const byVersion = new Map();
  for (const row of rows) {
    if (byVersion.has(row.version)) {
      throw new Error("Duplicate applied migration version: " + row.version);
    }
    const definition = definitions.find((candidate) => candidate.version === row.version);
    if (!definition) {
      throw new Error("Database contains migration " + row.id + " that is absent from the canonical lock.");
    }
    if (row.id !== definition.id || row.checksum !== definition.checksum || row.module_id !== definition.moduleId) {
      throw new Error("Applied migration " + row.id + " does not match the canonical lock.");
    }
    byVersion.set(row.version, row);
  }

  const versions = [...byVersion.keys()].sort((a, b) => a - b);
  for (let index = 0; index < versions.length; index += 1) {
    const expected = index + 1;
    if (versions[index] !== expected) {
      throw new Error(
        "Applied migration history is not contiguous: expected " + expected + ", found " + versions[index],
      );
    }
  }
}

function extractRows(value) {
  const candidates = [];
  visit(value, candidates);
  return candidates.find((rows) => rows.some((row) => row && typeof row === "object")) || [];
}

function visit(value, candidates) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    if (value.length === 0 || value.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      candidates.push(value);
    }
    for (const item of value) visit(item, candidates);
    return;
  }
  for (const child of Object.values(value)) visit(child, candidates);
}

function parseJsonOutput(stdout) {
  const trimmed = stdout.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    for (let index = trimmed.lastIndexOf("{"); index >= 0; index = trimmed.lastIndexOf("{", index - 1)) {
      try {
        return JSON.parse(trimmed.slice(index));
      } catch {
        // Continue searching.
      }
    }
    throw new Error("Unable to parse Wrangler JSON output: " + trimmed.slice(-2000));
  }
}

function findUuid(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value === "string" && isUuid(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUuid(item);
      if (found) return found;
    }
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    if (/id|uuid/i.test(key) && typeof child === "string" && isUuid(child)) {
      return child;
    }
    const found = findUuid(child);
    if (found) return found;
  }
  return null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sqlLiteral(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("Missing required production configuration: " + name);
  return value;
}

function validateUuid(value) {
  if (!isUuid(value)) {
    throw new Error("PHOENIX_PROD_D1_DATABASE_ID is not a valid UUID");
  }
}
