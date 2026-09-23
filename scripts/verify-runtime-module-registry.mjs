import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const packagesDir = join(root, "packages");
const runtimePath = join(root, "apps/api/src/runtime.ts");
const runtimeSource = await readFile(runtimePath, "utf8");

const packages = await readdir(packagesDir, { withFileTypes: true });
const orphaned = [];

for (const entry of packages) {
  if (!entry.isDirectory()) continue;
  const manifestPath = join(packagesDir, entry.name, "src/manifest.ts");
  try {
    const source = await readFile(manifestPath, "utf8");
    const idMatch = source.match(/\bid:\s*"([^"]+)"/);
    if (!idMatch) continue;
    const moduleId = idMatch[1];
    if (!runtimeSource.includes(moduleId) && !runtimeSource.includes(entry.name.replaceAll("-", "_"))) {
      orphaned.push(`${entry.name} -> ${moduleId}`);
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
    throw error;
  }
}

if (orphaned.length > 0) {
  throw new Error(
    "Runtime module registry has orphaned manifests:\n" +
      orphaned.map((value) => `- ${value}`).join("\n"),
  );
}

console.log("Runtime module registry matches all canonical module manifests.");
