import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [
  "apps/web/src/business-vertical-ui.ts",
  "apps/web/src/business-module-ui.ts",
  "apps/web/src/business-workflow-ui.ts",
];
for (const file of files) {
  if (!fs.existsSync(path.join(root, file))) throw new Error("Missing Vertical UI contract file: " + file);
}

const registry = fs.readFileSync(path.join(root, files[0]), "utf8");
const modules = fs.readFileSync(path.join(root, files[1]), "utf8");
const workflow = fs.readFileSync(path.join(root, files[2]), "utf8");
const verticals = ["clinic", "retail", "restaurant", "salon"];

for (const vertical of verticals) {
  const start = registry.indexOf("  " + vertical + ": {");
  if (start < 0) throw new Error("Missing vertical registry block: " + vertical);
  const end = registry.indexOf("\n  },", start);
  if (end < 0) throw new Error("Malformed vertical registry block: " + vertical);
  const block = registry.slice(start, end);
  const match = block.match(/modules:\s*\[([\s\S]*?)\]/);
  if (!match) throw new Error("Missing module list: " + vertical);
  const registeredModules = [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
  if (registeredModules.length < 8) throw new Error(vertical + " has too few registered modules.");

  for (const module of registeredModules) {
    const marker = '  "' + module + '":';
    if (!modules.includes(marker)) throw new Error(vertical + " module has no module contract: " + module);
    const capabilityMarker = '  "' + module + '": { requiredCapabilities:';
    if (!modules.includes(capabilityMarker)) throw new Error(vertical + " module has no capability contract: " + module);
  }

  if (!workflow.includes('"' + vertical + '"')) throw new Error("Workflow registry does not reference: " + vertical);
}

console.log("Vertical Workflow UI registry audit: OK");
console.log("Checked: " + verticals.join(", "));
