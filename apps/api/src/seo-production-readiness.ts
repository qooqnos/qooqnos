import type { ApiEnv } from "./env";

export type SeoProductionState = "ready" | "partial" | "unconfigured" | "invalid";
export interface SeoProductionReadiness { readonly state: SeoProductionState; readonly canonical: { ready: boolean; reason?: string }; readonly providers: { searchConsole: { configured: boolean; ready: boolean }; googleActions: { configured: boolean; ready: boolean }; bing: { configured: boolean; ready: boolean }; yandex: { configured: boolean; ready: boolean }; indexNow: { configured: boolean; ready: boolean }; aiCitation: { configured: boolean; ready: boolean }; competitive: { configured: boolean; ready: boolean }; searchIntelligence: { configured: boolean; ready: boolean }; googlePlaces: { configured: boolean; ready: boolean }; googleRoutes: { configured: boolean; ready: boolean }; youtube: { configured: boolean; ready: boolean } }; readonly blockers: readonly string[]; readonly warnings: readonly string[]; }
function configured(...values: unknown[]): boolean { return values.some((value) => typeof value === "string" && value.trim().length > 0); }
export function evaluateSeoProductionReadiness(env: ApiEnv): SeoProductionReadiness {
  const blockers: string[] = []; const warnings: string[] = []; let canonicalReady = false; let canonicalReason: string | undefined;
  try { const url = new URL(env.SEO_CANONICAL_BASE_URL ?? ""); canonicalReady = url.protocol === "https:" && Boolean(url.hostname); if (!canonicalReady) canonicalReason = "SEO_CANONICAL_BASE_URL must be an HTTPS origin."; } catch { canonicalReason = "SEO_CANONICAL_BASE_URL is missing or invalid."; }
  if (!canonicalReady) blockers.push(canonicalReason!);
  const searchConsoleConfigured = configured(env.SEO_GSC_SITE_URL, env.SEO_GSC_ACCESS_TOKEN, env.SEO_GSC_SERVICE_ACCOUNT_EMAIL, env.SEO_GSC_PRIVATE_KEY);
  const searchConsoleReady = Boolean(env.SEO_GSC_SITE_URL && (env.SEO_GSC_ACCESS_TOKEN || (env.SEO_GSC_SERVICE_ACCOUNT_EMAIL && env.SEO_GSC_PRIVATE_KEY)));
  const googleActionsConfigured = configured(env.SEO_GSC_SITE_URL, env.SEO_GSC_ACCESS_TOKEN, env.SEO_GSC_SERVICE_ACCOUNT_EMAIL, env.SEO_GSC_PRIVATE_KEY);
  const googleActionsReady = Boolean(env.SEO_GSC_SITE_URL && (env.SEO_GSC_ACCESS_TOKEN || (env.SEO_GSC_SERVICE_ACCOUNT_EMAIL && env.SEO_GSC_PRIVATE_KEY)));
  const bingConfigured = configured(env.SEO_BING_SITE_URL, env.SEO_BING_API_KEY, env.SEO_BING_ACCESS_TOKEN); const bingReady = Boolean(env.SEO_BING_SITE_URL && (env.SEO_BING_API_KEY || env.SEO_BING_ACCESS_TOKEN));
  const yandexConfigured = configured(env.SEO_YANDEX_USER_ID, env.SEO_YANDEX_HOST_ID, env.SEO_YANDEX_OAUTH_TOKEN);
  const yandexReady = Boolean(env.SEO_YANDEX_USER_ID && env.SEO_YANDEX_HOST_ID && env.SEO_YANDEX_OAUTH_TOKEN);
  const indexNowConfigured = configured(env.SEO_INDEXNOW_KEY, env.SEO_INDEXNOW_KEY_LOCATION, env.SEO_INDEXNOW_ENDPOINT);
  const indexNowReady = Boolean(env.SEO_INDEXNOW_KEY);
  const aiConfigured = configured(env.SEO_AI_CITATION_ENDPOINT, env.SEO_AI_CITATION_API_KEY, env.SEO_AI_CITATION_MODEL); const aiReady = Boolean(env.SEO_AI_CITATION_ENDPOINT && env.SEO_AI_CITATION_API_KEY && env.SEO_AI_CITATION_MODEL);
  const searchIntelligenceConfigured = configured(env.SEO_SEARCH_INTELLIGENCE_LOGIN, env.SEO_SEARCH_INTELLIGENCE_PASSWORD, env.SEO_SEARCH_INTELLIGENCE_ENDPOINT, env.SEO_COMPETITIVE_LOGIN, env.SEO_COMPETITIVE_PASSWORD);
  const searchIntelligenceReady = Boolean((env.SEO_SEARCH_INTELLIGENCE_LOGIN || env.SEO_COMPETITIVE_LOGIN) && (env.SEO_SEARCH_INTELLIGENCE_PASSWORD || env.SEO_COMPETITIVE_PASSWORD));
  const googlePlacesConfigured = configured(env.SEO_GOOGLE_PLACES_API_KEY);
  const googlePlacesReady = Boolean(env.SEO_GOOGLE_PLACES_API_KEY);
  const googleRoutesConfigured = configured(env.SEO_GOOGLE_ROUTES_API_KEY, env.SEO_GOOGLE_PLACES_API_KEY);
  const googleRoutesReady = Boolean(env.SEO_GOOGLE_ROUTES_API_KEY || env.SEO_GOOGLE_PLACES_API_KEY);
  const youtubeConfigured = configured(env.SEO_YOUTUBE_API_KEY);
  const youtubeReady = Boolean(env.SEO_YOUTUBE_API_KEY);
  const competitiveConfigured = configured(env.SEO_COMPETITIVE_LOGIN, env.SEO_COMPETITIVE_PASSWORD, env.SEO_COMPETITIVE_LOCATION_CODE, env.SEO_COMPETITIVE_LOCATION_NAME, env.SEO_COMPETITIVE_LANGUAGE_CODE);
  const competitiveReady = Boolean(env.SEO_COMPETITIVE_LOGIN && env.SEO_COMPETITIVE_PASSWORD && (env.SEO_COMPETITIVE_LOCATION_CODE || env.SEO_COMPETITIVE_LOCATION_NAME) && env.SEO_COMPETITIVE_LANGUAGE_CODE);
  if (searchConsoleConfigured && !searchConsoleReady) warnings.push("Google Search Console is partially configured; it must not be interpreted as zero visibility.");
  if (googleActionsConfigured && !googleActionsReady) warnings.push("Google Search Console action API is partially configured; it is not production-ready.");
  if (bingConfigured && !bingReady) warnings.push("Bing Webmaster is partially configured; it must not be interpreted as zero visibility.");
  if (yandexConfigured && !yandexReady) warnings.push("Yandex Webmaster is partially configured; it is not production-ready.");
  if (indexNowConfigured && !indexNowReady) warnings.push("IndexNow is partially configured; URL notifications remain disabled.");
  if (aiConfigured && !aiReady) warnings.push("AI citation measurement is partially configured; it must not be interpreted as zero visibility.");
  if (competitiveConfigured && !competitiveReady) warnings.push("Competitive intelligence is partially configured and is not production-ready.");
  if (searchIntelligenceConfigured && !searchIntelligenceReady) warnings.push("Search intelligence provider is partially configured and is not production-ready.");
  if (googlePlacesConfigured && !googlePlacesReady) warnings.push("Google Places is partially configured and is not production-ready.");
  if (googleRoutesConfigured && !googleRoutesReady) warnings.push("Google Routes is partially configured and is not production-ready.");
  if (youtubeConfigured && !youtubeReady) warnings.push("YouTube Data API is partially configured and is not production-ready.");
  const configuredProviders = [searchConsoleReady, googleActionsReady, bingReady, yandexReady, indexNowReady, aiReady, competitiveReady, searchIntelligenceReady, googlePlacesReady, googleRoutesReady, youtubeReady].filter(Boolean).length;
  const state: SeoProductionState = blockers.length > 0 ? "invalid" : warnings.length > 0 ? "partial" : configuredProviders === 0 ? "unconfigured" : "ready";
  return { state, canonical: { ready: canonicalReady, ...(canonicalReason ? { reason: canonicalReason } : {}) }, providers: { searchConsole: { configured: searchConsoleConfigured, ready: searchConsoleReady }, googleActions: { configured: googleActionsConfigured, ready: googleActionsReady }, bing: { configured: bingConfigured, ready: bingReady }, yandex: { configured: yandexConfigured, ready: yandexReady }, indexNow: { configured: indexNowConfigured, ready: indexNowReady }, aiCitation: { configured: aiConfigured, ready: aiReady }, competitive: { configured: competitiveConfigured, ready: competitiveReady }, searchIntelligence: { configured: searchIntelligenceConfigured, ready: searchIntelligenceReady }, googlePlaces: { configured: googlePlacesConfigured, ready: googlePlacesReady }, googleRoutes: { configured: googleRoutesConfigured, ready: googleRoutesReady }, youtube: { configured: youtubeConfigured, ready: youtubeReady } }, blockers, warnings };
}
