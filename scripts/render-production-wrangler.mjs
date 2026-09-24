#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "wrangler.toml");
const outputPath = path.join(root, ".wrangler", "production.wrangler.toml");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required production configuration: ${name}`);
  return value;
}

function validateD1Id(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("PHOENIX_PROD_D1_DATABASE_ID is not a valid UUID");
  }
}

function validateName(value, label) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(value)) {
    throw new Error(`${label} contains unsupported characters`);
  }
}

const databaseId = required("PHOENIX_PROD_D1_DATABASE_ID");
const databaseName = required("PHOENIX_PROD_D1_DATABASE_NAME");
const bucketName = required("PHOENIX_PROD_R2_BUCKET_NAME");
const queueName = required("PHOENIX_PROD_OUTBOX_QUEUE_NAME");
const modelId = required("PHOENIX_PROD_AI_MODEL_ID");
const modelVersion = process.env.PHOENIX_PROD_AI_MODEL_VERSION?.trim() || "1";
const gatewayId = process.env.PHOENIX_PROD_AI_GATEWAY_ID?.trim() || "";
const seoAiEndpoint = process.env.SEO_AI_CITATION_ENDPOINT?.trim() || "";
const seoAiModel = process.env.SEO_AI_CITATION_MODEL?.trim() || "";
const seoAiAuthMode = process.env.SEO_AI_CITATION_AUTH_MODE?.trim() || "";

validateD1Id(databaseId);
validateName(databaseName, "PHOENIX_PROD_D1_DATABASE_NAME");
validateName(bucketName, "PHOENIX_PROD_R2_BUCKET_NAME");
validateName(queueName, "PHOENIX_PROD_OUTBOX_QUEUE_NAME");

const source = await readFile(sourcePath, "utf8");
const marker = "# Queue and R2 resources are also environment-specific.";
const markerIndex = source.indexOf(marker);
if (markerIndex < 0) throw new Error("wrangler.toml production resource section marker is missing");

const prefix = source.slice(0, markerIndex);
const productionStart = prefix.indexOf("[env.production]");
if (productionStart < 0) throw new Error("wrangler.toml [env.production] section is missing");

const beforeProduction = source.slice(0, productionStart);
const productionBlock = `[env.production]
name = "qooqnos-production"

[env.production.vars]
APP_VERSION = "production"
ENVIRONMENT = "production"
SEO_CANONICAL_BASE_URL = "https://qooqnos.com"
SEO_CRAWLER_SAMPLE_LIMIT = "25"
SEO_MEASUREMENT_SAMPLE_LIMIT = "25"
SEO_COMPETITIVE_SAMPLE_LIMIT = "10"
SEO_COMPETITIVE_LOCATION_NAME = "United States"
SEO_COMPETITIVE_LANGUAGE_CODE = "en"
SEO_COMPETITIVE_DEPTH = "20"
SEO_GSC_SITE_URL = "https://qooqnos.com/"
SEO_GSC_LOOKBACK_DAYS = "7"
SEO_GSC_END_LAG_DAYS = "3"
SEO_BING_SITE_URL = "https://qooqnos.com/"${seoAiEndpoint ? `\nSEO_AI_CITATION_ENDPOINT = "${seoAiEndpoint}"` : ""}${seoAiModel ? `\nSEO_AI_CITATION_MODEL = "${seoAiModel}"` : ""}${seoAiAuthMode ? `\nSEO_AI_CITATION_AUTH_MODE = "${seoAiAuthMode}"` : ""}
AI_SELLER_EXTRACT_MODEL_ID = "${modelId}"
AI_SELLER_EXTRACT_MODEL_VERSION = "${modelVersion}"${gatewayId ? `\nAI_GATEWAY_ID = "${gatewayId}"` : ""}

[env.production.triggers]
crons = [ "17 * * * *", "41 2 * * *", "17 3 * * *" ]

[env.production.ai]
binding = "AI"

[[env.production.d1_databases]]
binding = "DB"
database_name = "${databaseName}"
database_id = "${databaseId}"

[[env.production.queues.producers]]
binding = "OUTBOX_QUEUE"
queue = "${queueName}"

[[env.production.queues.consumers]]
queue = "${queueName}"
max_batch_size = 50
max_batch_timeout = 30

[[env.production.r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "${bucketName}"
`;

const generated = beforeProduction + productionBlock + "\n";
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, generated, "utf8");
process.stdout.write("Generated .wrangler/production.wrangler.toml from real production environment values.\n");
