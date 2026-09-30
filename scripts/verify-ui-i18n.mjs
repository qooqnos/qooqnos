#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const locales = ["fa", "en", "ar"];
const dictionaries = Object.fromEntries(locales.map((locale) => [
  locale,
  JSON.parse(readFileSync(resolve(root, "packages/i18n/src/locales", locale + ".json"), "utf8")),
]));

const flatten = (value, prefix = "") => {
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    const fullKey = prefix ? prefix + "." + key : key;
    if (typeof child === "string") out[fullKey] = child;
    else if (child && typeof child === "object") Object.assign(out, flatten(child, fullKey));
  }
  return out;
};

const flat = Object.fromEntries(locales.map((locale) => [locale, flatten(dictionaries[locale])]));
const baseKeys = Object.keys(flat.fa).sort();

for (const locale of locales.slice(1)) {
  const keys = Object.keys(flat[locale]).sort();
  const missing = baseKeys.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !baseKeys.includes(key));
  if (missing.length || extra.length) {
    console.error(locale + ": locale key parity failed");
    if (missing.length) console.error("missing:", missing.join(", "));
    if (extra.length) console.error("extra:", extra.join(", "));
    process.exit(1);
  }
}

const required = [
  "ui.vertical_verticalFramework","ui.vertical_workflowMapTitle","ui.vertical_workflowCommonDescription",
  "ui.vertical_sharedComponent","ui.vertical_liveWhenConnected","ui.vertical_primaryFlow","ui.vertical_canonicalSource",
  "ui.vertical_canonicalBusinessContext","ui.vertical_canonicalData","ui.vertical_handoffContract","ui.vertical_handoffDescription",
  "ui.vertical_currentStage","ui.vertical_previousStage","ui.vertical_nextStage","ui.vertical_workflowEntry","ui.vertical_canonicalOnly",
  "ui.vertical_backendAuthoritative","ui.vertical_localFilterNote","ui.vertical_canvas","ui.vertical_stateContract","ui.vertical_interactionMode",
  "ui.vertical_primaryAction","ui.vertical_capabilityDependencies","ui.vertical_capabilityDescription","ui.vertical_contractLoaded","ui.vertical_layoutCommand","ui.vertical_layoutCalendar","ui.vertical_layoutSupply","ui.vertical_layoutPeople","ui.vertical_layoutCommerce","ui.vertical_layoutOperations","ui.vertical_layoutCommunication","ui.vertical_layoutCommandDescription","ui.vertical_layoutCalendarDescription","ui.vertical_layoutSupplyDescription","ui.vertical_layoutPeopleDescription","ui.vertical_layoutCommerceDescription","ui.vertical_layoutOperationsDescription","ui.vertical_layoutCommunicationDescription","ui.vertical_handoffTitle","language.label","language.persian","language.english","language.arabic"
];

const missingRequired = [];
for (const locale of locales) {
  for (const key of required) {
    if (typeof flat[locale][key] !== "string" || !flat[locale][key].trim()) {
      missingRequired.push(locale + ":" + key);
    }
  }
}
if (missingRequired.length) {
  console.error("Required UI i18n keys missing:");
  console.error(missingRequired.join("\n"));
  process.exit(1);
}
console.log("UI i18n verification passed: locale parity + shared VWF/language-switcher keys.");
