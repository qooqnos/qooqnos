import { readFile } from "node:fs/promises";

const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

function requireBinding(pattern, name) {
  if (!pattern.test(wrangler)) {
    throw new Error(`Production binding is not configured: ${name}`);
  }
}

if (/<REAL_[A-Z0-9_]+>/.test(wrangler)) {
  throw new Error("wrangler.toml still contains a fabricated production resource placeholder");
}

requireBinding(/\[env\.production\.d1_databases\]/, "D1");
requireBinding(/\[env\.production\.queues\.producers\]/, "Outbox Queue producer");
requireBinding(/\[env\.production\.r2_buckets\]/, "Media R2 bucket");

if (!/database_id\s*=\s*["'][^"'<>\s]+["']/.test(wrangler)) {
  throw new Error("Production D1 database_id is missing");
}
if (!/queue\s*=\s*["'][^"'<>\s]+["']/.test(wrangler)) {
  throw new Error("Production Queue name is missing");
}
if (!/bucket_name\s*=\s*["'][^"'<>\s]+["']/.test(wrangler)) {
  throw new Error("Production R2 bucket name is missing");
}

console.log("Production Cloudflare bindings are configured.");
