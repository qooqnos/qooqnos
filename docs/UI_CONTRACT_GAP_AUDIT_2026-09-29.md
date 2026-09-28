# UI Contract Gap Audit — 2026-09-29

Scope: `apps/web` against `docs/PHOENIX_MASTER_UI_PRODUCT_CONTRACT.md`,
`docs/HOMEPAGE_PRODUCT_CONTRACT.md` and `docs/SOCIAL_COMMERCE_UI_PRODUCT_CONTRACT.md`.
Method: read the contracts and ledger, cloned `main` (`1493f38`), ran typecheck, the
web unit tests and eslint, and inspected `apps/web/src/main.ts` (5,728 lines),
`ui.ts`, both stylesheets and the CI/deploy workflows.

## Verified baseline

- `tsc -p apps/web` passes; 18 web unit tests passed before this change.
- The ledger's "verification pending" note for the 2026-09-29 slices was accurate:
  nothing had been executed. Typecheck and tests are green; lint is not (see below).

## Fixed in this change

1. **Production served a stale stylesheet.** The Worker serves `apps/web/public`,
   but the authored file is `apps/web/styles.css`. `public/styles.css` was missing
   ~190 lines (vertical-workflow header actions, module context strip, module
   workbench/surface grids), so those Business module screens shipped unstyled.
   `npm --workspace=@qooqnos/web run build` (used by both CI workflows) now runs
   `scripts/sync-web-assets.mjs` first; `--check` mode fails on drift.
2. **Escape closed only the command palette.** About a dozen other
   `role="dialog" aria-modal="true"` overlays had no Escape handling, no focus
   trap and no focus restore (contract section 39). `apps/web/src/a11y.ts` now
   provides all three for every dialog, closes via each dialog's existing close
   control so feature cleanup still runs, and names unlabelled dialogs (the
   Create Post dialog had no accessible name) from their first heading.
3. `uiAlert` now uses `role="alert"` for `danger`/`warning` tones.

## Open findings (not changed here)

Product decisions that conflict with the ledger and need an owner decision:

- **Mobile primary navigation.** Contract section 7: Home, Discover, Create,
  Activity/Notifications, Profile. Shipped: Home, Content, Transactions,
  Notifications, Profile (recorded in the ledger as intentional). Discover is not
  reachable from the mobile bar on non-social pages, and Home (`/`) renders no
  mobile nav at all.
- **Home (`/`) shape.** Section 6 describes an individual Home with greeting,
  Ask Phoenix, quick intent actions (create, buy, sell, consult, learn, deals),
  suggestions and recent activity. The Homepage contract describes a public
  landing page. `/` currently implements the landing page only.

Missing routes named by the contract (section 42/45): `/activity` (Activity is a
modal today), `/orders`, `/saved`, `/messages`, `/settings`, a welcome/onboarding
flow, and semantic business routes such as `/business/products`,
`/business/team`, `/business/bookings` (business modules use
`/business?module=...`).

Engineering:

- `eslint .` fails on `main` with 6 unused-symbol errors: five in `apps/web/src/main.ts`
  (`discoveryKey`, `saveSearch`, `businessModuleSlug`, `moduleStatus`,
  `loadHomeState`) and one in `apps/api/src/index.ts`
  (`buildSeoMerchantCenterConfig`). CI lint cannot be green until these are removed.
- `main.ts` is a 427 KB single module with no unit coverage; contract section 40
  asks for route-level code splitting.
- `render()` replaces the whole shell on every navigation and does not move focus
  or announce the route change; unknown internal paths fall back to a full page
  load.
- `uiTabs` has no arrow-key navigation, no `aria-controls`, and a hard-coded
  English `aria-label`.
- `apps/web/index.html` and `apps/web/public/index.html` differ (meta order only).

## Verification of this change

`npm --workspace=@qooqnos/web run build`, `vitest run apps/web` (25 tests) and
eslint on the changed files pass. The dialog behaviour is unit-tested for its
logic only; it has not been exercised in a real browser (no jsdom/Playwright
browser available here), so the `web-ui-verification` E2E run should be observed.
