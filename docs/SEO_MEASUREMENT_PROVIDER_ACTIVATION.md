# SEO Measurement Provider Activation

This document defines the production activation contract for real SEO/GEO visibility measurement.

## Google Search Console

Required public configuration:
- SEO_GSC_SITE_URL=https://qooqnos.com/
- SEO_GSC_LOOKBACK_DAYS=7
- SEO_GSC_END_LAG_DAYS=3

Credential options:
- SEO_GSC_ACCESS_TOKEN for an already-issued OAuth2 access token; or
- SEO_GSC_SERVICE_ACCOUNT_EMAIL and SEO_GSC_PRIVATE_KEY for worker-side JWT token exchange.

The Google Search Console property must grant the service account read access when the service-account mode is used.

Phoenix queries Search Analytics with query and page dimensions and records provider-returned clicks, impressions, CTR and average position. The default 3-day end lag avoids treating freshly processed Search Console data as final.

## Bing Webmaster

Required:
- SEO_BING_SITE_URL=https://qooqnos.com/
- SEO_BING_API_KEY

The site must be verified in Bing Webmaster Tools and the API key must have read access. Phoenix uses the JSON/HTTP Webmaster endpoints and the query+page detail endpoint for entity-bound measurements. The legacy SOAP/POX protocol is intentionally not used.

## AI Web Citation Provider

Required:
- SEO_AI_CITATION_ENDPOINT
- SEO_AI_CITATION_API_KEY
- SEO_AI_CITATION_MODEL
- optional SEO_AI_CITATION_AUTH_MODE=bearer|api-key

The endpoint must implement a Responses-compatible web-search operation that returns message url_citation annotations. Phoenix records only the URLs explicitly returned as citations. It never infers an AI citation from wording, domain mentions, or model confidence.

## Scheduling

Production runs the real visibility measurement at 02:41 UTC daily. The default sample is 25 tracked active queries per run.

The existing production crawler continues hourly. These are intentionally separate because crawl/render verification and external visibility measurement answer different questions.

## Manual execution

Authenticated Control Plane endpoint:

POST /api/v1/seo/visibility/measure/:entityId?locale=fa-IR&query=<tracked-query>&limit=10

The endpoint is organization/workspace scoped.

## Observability

Each provider execution creates:
- a durable seo_measurement_runs row;
- normalized seo_measurements;
- provider error measurements on failed calls;
- seo_measurement_citations rows for explicit AI URL citations.

Unconfigured providers are omitted from the run. They are never recorded as zero visibility.
## Search-engine action APIs

The SEO core also exposes provider-specific operational APIs. These are separate from visibility measurement:

- Google Search Console: URL Inspection and sitemap submission.
- Bing Webmaster: URL submission.
- Yandex Webmaster v4: URL recrawl requests and indexing history.
- IndexNow: multi-engine freshness notification for canonical URL changes.

Environment configuration:
- `SEO_GSC_SITEMAP_URL` — canonical sitemap submitted to Google Search Console when the explicit Google sitemap action is invoked.
- `SEO_GSC_INSPECTION_LANGUAGE` — language code for Google URL Inspection; defaults to `en-US`.
- `SEO_BING_ACCESS_TOKEN` — optional OAuth bearer token for Bing write operations; `SEO_BING_API_KEY` remains supported.
- `SEO_YANDEX_USER_ID`, `SEO_YANDEX_HOST_ID`, `SEO_YANDEX_OAUTH_TOKEN` — Yandex Webmaster v4 credentials.
- `SEO_YANDEX_ENABLE_RECRAWL=true` — enables non-blocking Yandex recrawl notification after successful SEO publication.

Google URL Inspection and sitemap submission are exposed through authenticated SEO API routes rather than being executed for every publication job. Bing URL submission is wired to publication; Yandex recrawl is opt-in. External provider failure never rolls back canonical SEO publication.

## Google Search Console multimodal / Generative AI exports

Google Search Console now exposes a multimodal search type filter in Performance reporting, including Lens, Circle to Search, image uploads to Search, and Chrome “Search this image”; the report can be exported for analysis. Phoenix ingests those exports through:

- `POST /api/v1/seo/visibility/import/google-search-console` with `report=multimodal`
- the same endpoint with `report=generative-ai`

The current Search Analytics API does not expose the new multimodal report as a query type, so Phoenix does not fabricate an API result. The export importer records provider provenance and preserves the distinction between multimodal and Generative AI reporting.

## Bing AI Performance

Bing AI Performance exports are ingested through:

- `POST /api/v1/seo/visibility/import/bing-ai-performance`

Supported datasets are `pages`, `grounding-queries`, and `timeseries`. The importer accepts CSV or normalized JSON rows and records page citations, grounding-query citations, citation share, intents and topics when present.

The official Bing Webmaster API currently documents rank/traffic, links, keywords, crawl and submission capabilities, while AI Performance is documented as a Webmaster Tools reporting experience with CSV/Excel exports. Phoenix therefore uses the documented export path rather than an undocumented scraping endpoint.

## Merchant Center / Merchant API

The canonical XML feed is available at `/merchant-center/products.xml`. Feed items are generated only when canonical SEO data contains the required Merchant Center facts; missing facts are reported as skipped rather than invented.

When production configuration is available for a Merchant Center account, data source, feed label, content language and either an OAuth access token or service-account credentials, successful Product SEO publications are also synchronized through the current Google Merchant API `productInputs.insert` path. Merchant API failures are non-blocking for canonical SEO publication.

## ProductGroup / variants

ProductGroup markup now emits supported `variesBy` properties as full Schema.org URLs, ProductGroup aggregate ratings when canonical Trust data exists, variant-specific descriptions/names when available, stable variant identifiers and `inProductGroupWithID`, while preserving every canonical variant.

## Production crawler hardening

The production SEO crawler now validates public HTTPS canonical URLs, 200 responses, HTML/XHTML MIME type, a 4 MiB HTML safety bound, exactly one canonical link, title/description/robots presence and drift, JSON-LD parseability, SSR hydration markers, breadcrumb rendering and exact `X-Robots-Tag` consistency.

### Search-engine API reliability / control plane

The provider action layer uses one unified gateway and a bounded HTTP policy:
- \`SEO_SEARCH_ENGINE_MAX_ATTEMPTS\` — maximum attempts per provider request; default 3, hard-capped at 5.
- \`SEO_SEARCH_ENGINE_TIMEOUT_MS\` — per-attempt timeout; default 15 seconds, bounded to 1–60 seconds.
- \`SEO_SEARCH_ENGINE_BASE_DELAY_MS\` — exponential-backoff base delay; default 500 ms.
- \`SEO_SEARCH_ENGINE_MAX_DELAY_MS\` — maximum retry delay; default 10 seconds, bounded to 60 seconds.
- HTTP \`408\`, \`429\`, and \`5xx\` responses are retryable; \`Retry-After\` is honored when present.
- Each attempt produces a non-secret audit event through the runtime audit sink. Provider credentials are never emitted in audit payloads.
- \`GET /api/v1/seo/search-engines/status\` exposes provider capability/configuration state without returning credentials.
- \`GET /api/v1/seo/search-engines/yandex/indexing-history\` exposes the Yandex indexing-history action through the same authenticated control plane.

Publication-triggered Bing/Yandex actions use the same retry/timeout/audit contract as the authenticated control-plane routes.
