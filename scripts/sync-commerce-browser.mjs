// Expose only the browser-safe account-tier/pricing surface to the classic
// TypeScript ESM frontend. The full @qooqnos/commerce barrel includes server
// dependencies that are not browser-loadable (D1, runtime authorization, etc.).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = join(root, "packages/commerce/dist/account-tiers.js");
const target = join(root, "apps/web/public/dist/commerce-account-tiers.js");

if (!existsSync(source)) {
  process.stderr.write(
    "Browser commerce surface is missing. Run the monorepo build first: packages/commerce/dist/account-tiers.js\n",
  );
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
process.stdout.write("Synced browser-safe commerce account-tier module\n");
