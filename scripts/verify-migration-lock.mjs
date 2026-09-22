#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationDirectory = path.join(root, "migrations");
const lockPath = path.join(migrationDirectory, "migration-lock.json");
const migrationFilename = /^(\d+)_([a-z0-9-]+)(?:_[a-z0-9-]+)*\.sql$/i;

function fail(message) {
  throw new Error(`Migration lock verification failed: ${message}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function sourceMigrations() {
  const filenames = (await readdir(migrationDirectory)).filter((filename) => migrationFilename.test(filename)).sort();

  return Promise.all(
    filenames.map(async (filename) => {
      const match = migrationFilename.exec(filename);
      if (!match) fail(`invalid migration filename ${filename}`);
      const [, versionText, moduleId] = match;
      if (!versionText || !moduleId) fail(`invalid migration filename ${filename}`);
      return {
        id: filename.slice(0, -4),
        version: Number(versionText),
        moduleId,
        filename,
        checksum: sha256(await readFile(path.join(migrationDirectory, filename), "utf8")),
      };
    }),
  );
}

async function verify() {
  const sources = await sourceMigrations();
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  if (!Array.isArray(lock.migrations)) fail("manifest must contain a migrations array");

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const lockById = new Map(lock.migrations.map((entry) => [entry.id, entry]));
  if (lockById.size !== lock.migrations.length) fail("manifest contains duplicate migration ids");
  if (sourceById.size !== sources.length) fail("source contains duplicate migration ids");
  if (lockById.size !== sourceById.size) fail("manifest and source migration counts differ");

  let expectedVersion = 1;
  for (const source of sources) {
    if (source.version !== expectedVersion) fail(`expected source version ${expectedVersion}, found ${source.version}`);
    expectedVersion += 1;
    const entry = lockById.get(source.id);
    if (!entry) fail(`${source.filename} is missing from the manifest`);
    for (const field of ["version", "moduleId", "filename", "checksum"]) {
      if (entry[field] !== source[field]) fail(`${source.filename} ${field} differs from the manifest`);
    }
  }
  for (const entry of lock.migrations) {
    if (!sourceById.has(entry.id)) fail(`manifest entry ${entry.id} has no source migration`);
  }

  process.stdout.write(`Migration lock verified for ${sources.length} migrations.\n`);
}

await verify();
