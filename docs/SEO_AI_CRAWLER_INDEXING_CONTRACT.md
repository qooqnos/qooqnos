# Phoenix SEO / AI Crawler & Indexing Contract

## Purpose

This contract defines how Phoenix exposes public SEO/GEO pages to search crawlers, AI-search crawlers and freshness-discovery protocols without creating a second content source.

The canonical source remains the published SEO representation generated from Business, Catalog, Commerce, Location and other owning modules.

## AI crawler policy

Phoenix keeps the existing wildcard robots policy unless an explicit environment setting is configured.

The runtime can independently control these crawler tokens:

- OAI-SearchBot — ChatGPT search discovery.
- GPTBot — OpenAI training crawler.
- Google-Extended — Google Gemini training/grounding control token.
- ClaudeBot — Anthropic crawler.
- PerplexityBot — Perplexity crawler.

Configuration:

- `SEO_ALLOW_OAI_SEARCHBOT`
- `SEO_ALLOW_GPTBOT`
- `SEO_ALLOW_GOOGLE_EXTENDED`
- `SEO_ALLOW_CLAUDEBOT`
- `SEO_ALLOW_PERPLEXITYBOT`
- `SEO_CRAWL_DELAY_SECONDS`

Boolean values accept `true/false`, `1/0` and `yes/no`.

An unset crawler setting does not add a bot-specific directive. This preserves the existing wildcard behavior instead of silently changing a publisher's data-use policy.

`Crawl-delay` is emitted only when explicitly configured.

## IndexNow

Phoenix supports optional IndexNow notification after a canonical SEO representation is published successfully.

Configuration:

- `SEO_INDEXNOW_KEY` — required to activate the notifier.
- `SEO_INDEXNOW_KEY_LOCATION` — optional public key-location URL.
- `SEO_INDEXNOW_ENDPOINT` — optional endpoint override; defaults to the IndexNow API endpoint.
- `SEO_INDEXNOW_BATCH_LIMIT` — optional batch size, capped at the protocol maximum.

IndexNow is a discovery hint. A successful notification does not imply that a search engine indexed the URL, and an unavailable IndexNow provider must not turn a successful canonical SEO publication into a failed publication.

The notification payload is derived only from the published canonical URL. Same-host validation prevents accidental cross-site submission.

## Evidence and truth rules

Phoenix must not:

1. manufacture AI citations;
2. interpret unavailable provider data as zero visibility;
3. use robots.txt as a substitute for `noindex`;
4. emit structured-data properties without canonical source facts;
5. add AI-only markup merely because an AI search product exists;
6. claim that IndexNow guarantees indexing.

Google AI Search guidance is therefore treated as an extension of normal technical SEO rather than as a separate markup system. The engine continues to prioritize crawlability, indexability, canonical identity, useful visible content, internal links, valid structured data, freshness and provenance.

## External provider gates

The following remain provider/API activation boundaries rather than synthetic implementation targets:

- Google Search Console multimodal-search measurement when the public Search Analytics API exposes the required dimension.
- Bing Webmaster AI Performance ingestion when an official machine-readable API surface is available.

Until those APIs exist, Phoenix records only evidence that can be obtained from supported provider interfaces.

## Verification

Production verification must cover:

1. `/robots.txt` from the deployed canonical Worker.
2. `/sitemap.xml` and sitemap shards.
3. public Entity Page initial HTML.
4. canonical URL, robots metadata and JSON-LD consistency.
5. optional AI crawler directives when explicitly configured.
6. IndexNow notification behavior when the key is activated.
7. `/api/v1/seo/health` for publication/crawler/measurement failures.

## Canonical references

- Google Search Central — AI features and website controls.
- Google Search Central — robots.txt and crawling.
- Google Search Central — sitemap guidelines.
- IndexNow — official protocol and API documentation.
- OpenAI — OAI-SearchBot / GPTBot crawler documentation.
- Anthropic — ClaudeBot documentation.
