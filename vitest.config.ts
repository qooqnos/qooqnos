import { defineConfig } from "vitest/config";
import path from "node:path";
import fs from "node:fs";

const packagesDir = path.resolve(__dirname, "packages");
const packageDirs = fs.existsSync(packagesDir) ? fs.readdirSync(packagesDir) : [];

const aliases: Record<string, string> = {};
for (const pkg of packageDirs) {
  const indexTs = path.join(packagesDir, pkg, "src", "index.ts");
  if (fs.existsSync(indexTs)) {
    aliases[`@qooqnos/${pkg}`] = indexTs;
  }
}

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.wrangler/**"],
  },
  resolve: {
    alias: aliases,
  },
});
