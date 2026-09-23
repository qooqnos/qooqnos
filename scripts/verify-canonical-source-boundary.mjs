import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const scanRoots = ["apps", "packages"];
const allowedPrefixes = [
  "packages/api/",
  "packages/database/src/legacy.ts",
  "packages/onboarding/src/legacy.ts",
  "packages/onboarding/src/index.test.ts",
  "packages/runtime/src/legacy-server.ts",
];

const forbidden = [
  { pattern: /@qooqnos\/database\/legacy/g, label: "legacy database import" },
  { pattern: /InMemoryDatabase/g, label: "in-memory database reference" },
  { pattern: /USE_POSTGRES/g, label: "PostgreSQL runtime selector" },
  { pattern: /postgres-(adapter|database)/g, label: "PostgreSQL compatibility source" },
];

const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const violations = [];

function isAllowed(path) {
  return allowedPrefixes.some((prefix) => path === prefix || path.startsWith(prefix));
}

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    const rel = relative(root, absolute).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      await walk(absolute);
      continue;
    }
    if (!textExtensions.has(rel.slice(rel.lastIndexOf(".")))) continue;
    if (isAllowed(rel)) continue;

    const source = await readFile(absolute, "utf8");
    for (const rule of forbidden) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(source)) {
        violations.push(`${rel}: ${rule.label}`);
      }
    }
  }
}

for (const scanRoot of scanRoots) {
  await walk(join(root, scanRoot));
}

if (violations.length > 0) {
  throw new Error(
    "Canonical-source legacy boundary violation(s):\n" +
      violations.map((value) => `- ${value}`).join("\n"),
  );
}

console.log("Canonical-source legacy boundary verified.");
