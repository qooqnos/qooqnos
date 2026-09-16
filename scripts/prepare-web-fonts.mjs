import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const FONT = {
  name: "Vazirmatn-RD[wght].woff2",
  output: resolve("apps/web/public/fonts/Vazirmatn-RD[wght].woff2"),
  url: "https://raw.githubusercontent.com/rastikerdar/vazirmatn/6e553e33489a8f9dfaccc76860a2e3f3c1e66de7/Round-Dots/fonts/webfonts/Vazirmatn-RD%5Bwght%5D.woff2",
  gitBlobSha: "21a200934d46169089833cd4c79d10a3340c3bad",
};

function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.byteLength}\0`);
  return createHash("sha1").update(Buffer.concat([header, buffer])).digest("hex");
}

const existing = await readFile(FONT.output).catch(() => null);
if (existing && gitBlobSha(existing) === FONT.gitBlobSha) {
  console.log(`Web font ready: ${FONT.output}`);
  process.exit(0);
}

console.log(`Downloading pinned ${FONT.name}...`);
const response = await fetch(FONT.url);
if (!response.ok) {
  throw new Error(`Failed to download ${FONT.name}: HTTP ${response.status}`);
}

const buffer = Buffer.from(await response.arrayBuffer());
const actualSha = gitBlobSha(buffer);
if (actualSha !== FONT.gitBlobSha) {
  throw new Error(`Unexpected Vazirmatn font content: expected Git blob ${FONT.gitBlobSha}, got ${actualSha}`);
}

await mkdir(dirname(FONT.output), { recursive: true });
await writeFile(FONT.output, buffer);
console.log(`Installed ${FONT.name} (${buffer.byteLength} bytes).`);
