import { readFile } from "node:fs/promises";
import process from "node:process";

const configPath = process.argv[2] || process.env.WRANGLER_CONFIG || "wrangler.toml";
const wrangler = await readFile(configPath, "utf8");

function fail(message) {
  throw new Error(`Production binding verification failed: ${message}`);
}

function requireBinding(pattern, name) {
  if (!pattern.test(wrangler)) fail(`${name} binding is not configured`);
}

if (/<REAL_[A-Z0-9_]+>|<UUID[0-9]+>|<YOUR_[A-Z0-9_]+>/i.test(wrangler)) {
  fail("the selected Wrangler config still contains a resource placeholder");
}

requireBinding(/\[env\.production\.d1_databases\]/, "D1");
requireBinding(/\[env\.production\.queues\.producers\]/, "Outbox Queue producer");
requireBinding(/\[env\.production\.queues\.consumers\]/, "Outbox Queue consumer");
requireBinding(/\[\[env\.production\.r2_buckets\]\]/, "Media R2 bucket");
requireBinding(/\[env\.production\.ai\]/, "Workers AI");

if (!/binding\s*=\s*"DB"/.test(wrangler)) fail("production D1 binding must be DB");
if (!/binding\s*=\s*"OUTBOX_QUEUE"/.test(wrangler)) fail("production queue binding must be OUTBOX_QUEUE");
if (!/binding\s*=\s*"MEDIA_BUCKET"/.test(wrangler)) fail("production R2 binding must be MEDIA_BUCKET");
if (!/\[env\.production\.vars\][\s\S]*ENVIRONMENT\s*=\s*"production"/.test(wrangler)) fail("production ENVIRONMENT variable is missing");
if (!/AI_SELLER_EXTRACT_MODEL_ID\s*=\s*"[^"<>\s]+"/.test(wrangler)) fail("production AI seller-extraction model id is missing");
if (!/database_id\s*=\s*"[^"<>\s]+"/.test(wrangler)) fail("production D1 database_id is missing");
if (!/queue\s*=\s*"[^"<>\s]+"/.test(wrangler)) fail("production Queue name is missing");
if (!/bucket_name\s*=\s*"[^"<>\s]+"/.test(wrangler)) fail("production R2 bucket name is missing");

process.stdout.write(`Production Cloudflare bindings verified in ${configPath}.\n`);
