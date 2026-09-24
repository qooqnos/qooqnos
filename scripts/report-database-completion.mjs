#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationsDir = path.join(root, "migrations");
const catalogPath = path.join(root, "apps", "api", "src", "migrations.ts");
const lockPath = path.join(migrationsDir, "migration-lock.json");
const reconciliationPath = path.join(root, "docs", "DATABASE_PHYSICAL_RECONCILIATION.md");

const filenames = (await readdir(migrationsDir))
  .filter((name) => /^\d{4}_[a-z0-9-]+(?:_[a-z0-9-]+)*\.sql$/i.test(name))
  .sort();

const migrations = [];
let physicalTableCount = 0;
const physicalTables = new Map();

for (const filename of filenames) {
  const sql = await readFile(path.join(migrationsDir, filename), "utf8");
  const tables = [...sql.matchAll(/\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z_][A-Za-z0-9_]*)/gi)].map(
    (match) => match[1],
  );
  const rebuiltTables = new Set(
    [...sql.matchAll(/\bALTER\s+TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s+RENAME\s+TO\s+\1_legacy\b/gi)]
      .map((match) => match[1]),
  );
  const newlyDefinedTables = [];
  for (const table of tables) {
    if (physicalTables.has(table)) {
      if (!rebuiltTables.has(table)) {
        throw new Error(
          "Duplicate physical table definition: " + table +
          " in " + physicalTables.get(table) + " and " + filename,
        );
      }
      continue;
    }
    physicalTables.set(table, filename);
    newlyDefinedTables.push(table);
  }
  physicalTableCount += newlyDefinedTables.length;
  migrations.push({ filename, version: Number(filename.slice(0, 4)), tables: newlyDefinedTables.length });
}

const catalog = await readFile(catalogPath, "utf8");
const catalogEntries = [...catalog.matchAll(/\{\s*path:\s*"migrations\/[^"]+\.sql"/g)].length;

const lock = JSON.parse(await readFile(lockPath, "utf8"));
const lockEntries = Array.isArray(lock.migrations) ? lock.migrations.length : 0;

const reconciliation = await readFile(reconciliationPath, "utf8");
const totalMatch = reconciliation.match(/\*\*Total currently defined physical tables:\s*(\d+)\.\*\*/);
const documentedTables = totalMatch ? Number(totalMatch[1]) : null;

const migrationIntegrity = filenames.length > 0 && catalogEntries === filenames.length && lockEntries === filenames.length;
const schemaInventoryIntegrity = documentedTables === physicalTableCount;
const sequential = migrations.every((migration, index) => index === 0 || migration.version > migrations[index - 1].version);

const schemaScore = migrationIntegrity && schemaInventoryIntegrity && sequential ? 100 : 0;
const productionRemoteApplied = process.env.PHOENIX_PROD_D1_DATABASE_ID?.trim() ? "configured" : "not_verified";

const report = {
  schemaCompletionPercent: schemaScore,
  migrationCount: filenames.length,
  catalogCount: catalogEntries,
  lockCount: lockEntries,
  physicalTableCount,
  documentedPhysicalTableCount: documentedTables,
  sequential,
  migrationIntegrity,
  schemaInventoryIntegrity,
  productionRemoteD1: productionRemoteApplied,
};

process.stdout.write(JSON.stringify(report, null, 2) + "\n");
