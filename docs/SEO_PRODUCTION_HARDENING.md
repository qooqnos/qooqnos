# SEO Production Hardening

This layer closes the gap between implemented SEO/GEO capabilities and safe production activation.

## Readiness states

- **ready** — canonical origin is valid and configured providers have all required runtime configuration.
- **partial** — canonical origin is valid, but at least one provider has incomplete configuration.
- **unconfigured** — canonical origin is valid and no external visibility provider is activated.
- **invalid** — the canonical origin is missing or unsafe.

Partial and unconfigured providers are never converted into zero visibility.

## Provider gates

Google Search Console requires a site URL plus either an access token or service-account email/private key.

Bing requires both site URL and API key.

AI citation measurement requires endpoint, API key and model.

Competitive intelligence requires provider credentials, an explicit location and language.

## Production verification sequence

1. Validate canonical origin.
2. Verify D1 migrations are current.
3. Run production crawler against published canonical pages.
4. Run SEO Audit and confirm no blocking audit state.
5. Activate external visibility providers as applicable and collect real observations.
6. Activate competitive intelligence with explicit market context.
7. Inspect `/api/v1/seo/health` for publication, crawler, measurement and competitive failures.
8. Verify sitemap and robots responses from the deployed Worker.
9. Verify a real public entity page using fetched HTML, not only SPA-rendered DOM.

## Evidence rule

A provider that has not been activated, or that has failed authentication/configuration, is not evidence of zero search visibility. Dashboards and decisions must preserve that distinction.

## Completion criterion

Production SEO hardening is complete only when the deployed environment passes the verification sequence and provider evidence is being persisted over time. Source-code implementation alone does not manufacture external search evidence.
## AI crawler and freshness-discovery hardening — 2026-09-25

The production SEO surface now supports explicit policy control for major AI crawler identities without changing the default wildcard robots behavior. `SEO_AI_CRAWLER_INDEXING_CONTRACT.md` is the canonical operational contract.

Supported policy controls are `OAI-SearchBot`, `GPTBot`, `Google-Extended`, `ClaudeBot`, `PerplexityBot`, and optional `Crawl-delay`.

Canonical SEO publication can also emit an optional IndexNow notification after successful representation persistence. IndexNow failures are secondary discovery-provider failures and do not invalidate the canonical publication transaction.
