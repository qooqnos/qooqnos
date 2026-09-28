// The Worker serves apps/web/public, but the design system is authored in
// apps/web/styles.css. Keeping two hand-edited copies let production drift
// behind the source (missing vertical-workflow/module-canvas styles).
// This copies the authored stylesheet into the served directory on every web
// build. Run with --check to fail instead of writing.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = root + "apps/web/styles.css";
const target = root + "apps/web/public/styles.css";

const authored = readFileSync(source);
let served = null;
try {
  served = readFileSync(target);
} catch {
  served = null;
}
const identical = served !== null && authored.equals(served);

if (process.argv.includes("--check")) {
  if (!identical) {
    process.stderr.write(
      "apps/web/public/styles.css is out of sync with apps/web/styles.css. Run: node scripts/sync-web-assets.mjs\n"
    );
    process.exit(1);
  }
  process.stdout.write("web assets in sync\n");
} else {
  if (!identical) writeFileSync(target, authored);
  process.stdout.write(
    identical
      ? "web assets already in sync\n"
      : "synced apps/web/styles.css -> apps/web/public/styles.css\n"
  );
}
