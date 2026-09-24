# SEO Competitive Intelligence Activation

Phoenix competitive intelligence uses an external SERP provider for observed search results. The production implementation currently uses DataForSEO Google Organic Live Advanced.

## Required credentials

- `SEO_COMPETITIVE_LOGIN` — DataForSEO API login.
- `SEO_COMPETITIVE_PASSWORD` — DataForSEO API password.

These are runtime secrets; do not put them in `wrangler.toml` or source control.

## Market context

- `SEO_COMPETITIVE_LOCATION_NAME` or `SEO_COMPETITIVE_LOCATION_CODE` — explicit search location.
- `SEO_COMPETITIVE_LANGUAGE_CODE` — search language.
- `SEO_COMPETITIVE_DEVICE` — `desktop` or `mobile`.
- `SEO_COMPETITIVE_DEPTH` — observed SERP depth, bounded by the provider adapter.
- `SEO_COMPETITIVE_SAMPLE_LIMIT` — tracked queries per scheduled run.

Location and language are mandatory for meaningful comparison because SERP composition and ranking vary by market and language.

## Scheduling

Production competitive intelligence runs daily at `03:17 UTC` after the visibility measurement window.

The scheduler selects the least-recently measured active SEO queries. It records the exact query, location, language, device, depth and provider timestamp in provenance.

## What is observed

- organic SERP result URLs/domains;
- rank group and absolute rank when supplied by the provider;
- title/snippet;
- AI Overview/reference URLs when the provider exposes them;
- new/lost result entries;
- rank movement;
- URL changes;
- AI citation gain/loss;
- same-run query gaps where competitor results exist but Phoenix is absent.

Phoenix does not infer revenue, market share, popularity, universal rank, or competitor quality from these observations.

## Manual endpoints

- `POST /api/v1/seo/competitive/measure/:entityId` runs a scoped measurement.
- `GET /api/v1/seo/competitive/:entityId` returns observed competitors, changes and gaps.
- `POST /api/v1/seo/competitive/competitors` registers a known competitor domain with an explicit classification.

All endpoints are organization/workspace scoped and require authentication.
## Page-level competitor snapshots

For the top observed competitor URLs, Phoenix also uses DataForSEO Instant Pages to record page-level SEO evidence such as title, description, canonical URL, H1 count, text-word count, internal/external links, images and SEO checks.

Page snapshot sampling is bounded by `SEO_COMPETITIVE_PAGE_SAMPLE_LIMIT` (default 5) and selects at most one URL per competitor domain per run.

## Keyword-gap evidence

Competitive runs also query DataForSEO Labs Domain Intersection with `intersections=false`, using competitor as `target1` and Phoenix as `target2`. This returns keywords for which the competitor has a SERP result and Phoenix does not, with keyword metrics and the competitor SERP element.

The production sample is bounded by `SEO_COMPETITIVE_KEYWORD_GAP_COMPETITOR_LIMIT` (default 3 competitors per tracked query) and `SEO_COMPETITIVE_KEYWORD_GAP_LIMIT` (default 15 keywords per competitor). DataForSEO Labs refreshes this underlying keyword dataset weekly, so these observations are provider-dated evidence rather than a minute-by-minute SERP snapshot.
