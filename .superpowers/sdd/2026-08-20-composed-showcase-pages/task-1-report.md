# Task 1 — Data Operations showcase

## Result

Implemented the `/showcases/data-operations` product composition using public
Malva APIs only. The route now has a controlled saved-view host, deterministic
account data, query filters, durable table presentation state, responsive view
and inspector drawers, and recoverable local async operations.

## RED / GREEN evidence

- RED: `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test --skipNxCache -- src/app/showcases/pages/data-operations/data-operations.spec.ts`
  failed with 12 intended skeleton-route failures, including
  `component.activeVariant is not a function` and missing `New view` content.
- RED: added the primary-action regression; it failed with
  `component.accounts is not a function`.
- RED: added the controlled-list-selection regression; it failed because the
  active view changed to `my-follow-ups` before discard confirmation.
- GREEN: the focused command now passes 14/14 tests.

## Interaction matrix

| Interaction | Evidence |
| --- | --- |
| Saved-view URL selection, invalid replacement, history replacement | Focused route tests |
| Locked clone, editable update, failure preservation/retry state | Focused route tests |
| Capability-dependent New/Duplicate/Update surfaces | Focused route tests |
| Dirty switch confirmation and controlled list selection | Focused route tests |
| Query filter removal and table snapshot/reset | Focused route tests |
| Add account, export feedback, row details and focus return | Focused route tests |
| Default and dirty a11y structure | Focused axe tests |

## Files

- `apps/docs/src/app/showcases/shared/showcase-async.ts`
- `apps/docs/src/app/showcases/pages/data-operations/data-operations.data.ts`
- `apps/docs/src/app/showcases/pages/data-operations/data-operations.ts`
- `apps/docs/src/app/showcases/pages/data-operations/data-operations.html`
- `apps/docs/src/app/showcases/pages/data-operations/data-operations.scss`
- `apps/docs/src/app/showcases/pages/data-operations/data-operations.spec.ts`

## Verification

- Focused docs showcase test: 14/14 passed, uncached.
- Full docs test suite: 26 files / 122 tests passed, uncached.
- `yarn nx lint docs --skipNxCache`: passed.
- `yarn nx typecheck docs --skipNxCache`: passed.
- `yarn nx run styles:check-padding-tokens --skipNxCache`: passed (705 files).
- `yarn nx build docs --skipNxCache`: passed after allowing the configured
  Google Fonts fetch needed by Angular font inlining.
- `git diff --check`: passed.

## Concerns

- Vitest/jsdom logs existing CSS `@layer` parsing noise from the CDK overlay
  stylesheet. Axe disables only jsdom-unavailable colour contrast; all other
  axe rules are asserted for default and dirty states.
- The production build retains pre-existing unused-import and initial-budget
  warnings outside this task’s owned files.

## Fix round 1

### RED / GREEN evidence

- RED: the focused uncached route suite had 18 tests with 5 failures: delayed
  clone selection replaced a later view, desktop row activation opened the
  mobile drawer, cells lacked semantic badges, overflow import was absent, and
  axe reported the upstream search-field nested-interactive control.
- GREEN: `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test --skipNxCache -- src/app/showcases/pages/data-operations/data-operations.spec.ts`
  passes 19/19 tests.

### Completed workflows

- Async create/clone/update now capture the origin view and persist the correct
  variant without replacing a subsequently selected view, URL, baseline, or
  retry/error surface.
- The inspector uses an SSR-safe, cleaned-up 64rem `matchMedia` state: desktop
  stays in the static aside while compact viewports open the drawer.
- Sort, columns, and account overflow use public Malva menus; column `name`
  cannot be hidden. The overflow actions provide deterministic feedback.
- Dirty switching is a Malva three-way dialog: save as new personal view,
  discard, or cancel. The visible At-risk page now contains all eight named
  companies because Soylent meets the 60-day saved expression.
- Health cells use semantic `mlv-badge`; the route owns a table no-results
  projection with Clear filters. The search control is `mlv-input`, removing
  the upstream nested-interactive violation without disabling that axe rule.

### Fix-round verification

- `yarn nx typecheck docs --skipNxCache`: passed.
- `yarn nx lint docs --skipNxCache`: passed.
- `yarn nx run styles:check-padding-tokens --skipNxCache`: passed (705 files).
- `git diff --check`: passed.

### Fix-round concern

- jsdom cannot compute colour contrast, so only `color-contrast` remains
  disabled in axe. Existing test-suite CSS `@layer` parsing messages are
  non-fatal and outside the route.

## Custom-code budget audit

### Domain-only code retained

- The deterministic account fixtures, view variants, capability matrix, and
  account-to-filter expression matching remain route-owned domain data.
- URL selection, asynchronous fixture persistence, and view-state snapshots
  remain small orchestration glue around `MlvViewVariantList`,
  `MlvViewVariantStatus`, `MlvSmartFilterBar`, and `MlvDataTable` public APIs.
- The account health-to-badge semantic mapping and the deterministic add,
  import, and export feedback are domain actions rather than reusable UI
  primitives.

### Generic code removed

- Replaced the hand-styled account initial square with the public
  `mlv-avatar` component.
- Replaced showcase-owned shell background and viewport-height CSS with the
  public `mlv-page-shell` `color` input. This removes route styling while
  preserving the quiet page surface.

### Remaining library gaps / route cost

- `MlvPageShell` slot directives provide no responsive width, breakpoint, or
  off-canvas behaviour for arbitrary native page sidebars. The showcase keeps
  a small 17rem/20rem layout stylesheet plus SSR-safe `matchMedia` and public
  `MlvDrawer` composition. A minimal reusable API would be responsive start/
  end-sidebar slot configuration (width and breakpoint, with drawer fallback).
- `MlvDataTableNoData` intentionally supplies only a projection point. The
  route keeps its one message/action projection because restoring a saved view
  is domain-specific; no library API is proposed.

### Final verification

- Controller captured post-fix `yarn nx build docs --skipNxCache`: passed in
  26.9s. Existing NG8113 and bundle-budget warnings remain outside Task 1.
