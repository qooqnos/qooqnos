import type { ApiEnv } from "./env";

export type SeoProductionState = "ready" | "partial" | "unconfigured" | "invalid";
export interface SeoProductionReadiness { readonly state: SeoProductionState; readonly canonical: { ready: boolean; reason?: string }; readonly providers: { searchConsole: { configured: boolean; ready: boolean }; bing: { configured: boolean; ready: boolean }; aiCitation: { configured: boolean; ready: boolean }; competitive: { configured: boolean; ready: boolean } }; readonly blockers: readonly string[]; readonly warnings: readonly string[]; }
function configured(...values: unknown[]): boolean { return values.some((value) => typeof value === "string" && value.trim().length > 0); }
export function evaluateSeoProductionReadiness(env: ApiEnv): SeoProductionReadiness {
  const blockers: string[] = []; const warnings: string[] = []; let canonicalReady = false; let canonicalReason: string | undefined;
  try { const url = new URL(env.SEO_CANONICAL_BASE_URL ?? ""); canonicalReady = url.protocol === "https:" && Boolean(url.hostname); if (!canonicalReady) canonicalReason = "SEO_CANONICAL_BASE_URL must be an HTTPS origin."; } catch { canonicalReason = "SEO_CANONICAL_BASE_URL is missing or invalid."; }
  if (!canonicalReady) blockers.push(canonicalReason!);
  const searchConsoleConfigured = configured(env.SEO_GSC_SITE_URL, env.SEO_GSC_ACCESS_TOKEN, env.SEO_GSC_SERVICE_ACCOUNT_EMAIL, env.SEO_GSC_PRIVATE_KEY);
  const searchConsoleReady = Boolean(env.SEO_GSC_SITE_URL && (env.SEO_GSC_ACCESS_TOKEN || (env.SEO_GSC_SERVICE_ACCOUNT_EMAIL && env.SEO_GSC_PRIVATE_KEY)));
  const bingConfigured = configured(env.SEO_BING_SITE_URL, env.SEO_BING_API_KEY); const bingReady = Boolean(env.SEO_BING_SITE_URL && env.SEO_BING_API_KEY);
  const aiConfigured = configured(env.SEO_AI_CITATION_ENDPOINT, env.SEO_AI_CITATION_API_KEY, env.SEO_AI_CITATION_MODEL); const aiReady = Boolean(env.SEO_AI_CITATION_ENDPOINT && env.SEO_AI_CITATION_API_KEY && env.SEO_AI_CITATION_MODEL);
  const competitiveConfigured = configured(env.SEO_COMPETITIVE_LOGIN, env.SEO_COMPETITIVE_PASSWORD, env.SEO_COMPETITIVE_LOCATION_CODE, env.SEO_COMPETITIVE_LOCATION_NAME, env.SEO_COMPETITIVE_LANGUAGE_CODE);
  const competitiveReady = Boolean(env.SEO_COMPETITIVE_LOGIN && env.SEO_COMPETITIVE_PASSWORD && (env.SEO_COMPETITIVE_LOCATION_CODE || env.SEO_COMPETITIVE_LOCATION_NAME) && env.SEO_COMPETITIVE_LANGUAGE_CODE);
  if (searchConsoleConfigured && !searchConsoleReady) warnings.push("Google Search Console is partially configured; it must not be interpreted as zero visibility.");
  if (bingConfigured && !bingReady) warnings.push("Bing Webmaster is partially configured; it must not be interpreted as zero visibility.");
  if (aiConfigured && !aiReady) warnings.push("AI citation measurement is partially configured; it must not be interpreted as zero visibility.");
  if (competitiveConfigured && !competitiveReady) warnings.push("Competitive intelligence is partially configured and is not production-ready.");
  const configuredProviders = [searchConsoleReady, bingReady, aiReady, competitiveReady].filter(Boolean).length;
  const state: SeoProductionState = blockers.length > 0 ? "invalid" : warnings.length > 0 ? "partial" : configuredProviders === 0 ? "unconfigured" : "ready";
  return { state, canonical: { ready: canonicalReady, ...(canonicalReason ? { reason: canonicalReason } : {}) }, providers: { searchConsole: { configured: searchConsoleConfigured, ready: searchConsoleReady }, bing: { configured: bingConfigured, ready: bingReady }, aiCitation: { configured: aiConfigured, ready: aiReady }, competitive: { configured: competitiveConfigured, ready: competitiveReady } }, blockers, warnings };
}
