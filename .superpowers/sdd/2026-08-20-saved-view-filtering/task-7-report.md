# Task 7 report — saved-view filtering reference examples

## Scope delivered

- Added Filter example 4: an accounts-renewal query surface that demonstrates
  natural-language Smart Filter chips, the built-in Add filter flow, explicit
  and live apply modes, and the emitted grouped expression.
- Added Data Table example 22: an in-memory account-renewal presentation
  capture, focused mutation, reapplication, and reset. It intentionally has
  no saved-view persistence, names, permissions, or dirty-state UI.
- Registered both examples, updated the docs application guidance and the two
  page backing documents, and added focused interaction smoke tests.

## TDD evidence

### RED

```sh
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- \
  src/app/pages/filter/examples/4/index.spec.ts \
  src/app/pages/data-table/examples/22/index.spec.ts
```

Failed as expected before implementation: both test suites could not resolve
their missing `./index` example component.

### GREEN

The same focused command passed after implementation: 2 files / 2 tests.

- Filter smoke test adds then removes a renewal-risk condition through the
  real Smart Filter Bar model and asserts its emitted grouped expression.
- Data Table smoke test captures the real table state, changes durable sort
  and visibility, reapplies the capture, and resets to the initial state.

## Verification

All commands below used `--skipNxCache` where the target supports it.

| Command | Result |
| --- | --- |
| `yarn nx test core-view-variant --skipNxCache` | Pass |
| `yarn nx test core-filter --skipNxCache` | Pass — 77 tests |
| `yarn nx test core-data-table --skipNxCache` | Pass — 101 tests |
| `yarn nx lint core-view-variant --skipNxCache` | Pass |
| `yarn nx lint core-filter --skipNxCache` | Pass |
| `yarn nx lint core-data-table --skipNxCache` | Pass |
| `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test --skipNxCache` | Pass — 25 files / 109 tests |
| `yarn nx typecheck docs --skipNxCache` | Pass |
| `yarn nx lint docs --skipNxCache` | Pass |
| `yarn nx run styles:check-padding-tokens --skipNxCache` | Pass — 703 files scanned |
| `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:extract-api --skipNxCache` | Pass — 81 entries / 909 symbols |
| `yarn nx run docs:check-doc-api --skipNxCache` | Pass — 0 failures; 240 existing repository-wide warnings |
| `yarn nx build core --skipNxCache` | Pass — includes `@malva-ui/core/view-variant` |
| `yarn nx build docs --skipNxCache` | Pass after the required font request was allowed; output includes both new example artifacts |
| `git diff --check` | Pass |

## Investigation notes

- The first docs build exposed a strict-template mismatch: the table input
  requires a mutable row array, so example 22 changed `readonly
  RenewalAccount[]` to `RenewalAccount[]`. Docs typecheck then passed.
- The sandbox-only docs build retry could not resolve `fonts.googleapis.com`
  for Angular font inlining. The authorized network rerun generated
  `dist/apps/docs/browser/filter/examples/4/index.html` and
  `dist/apps/docs/browser/data-table/examples/22/index.html`, with both new
  example strings present.
- Existing jsdom CSS parsing/canvas and Angular unused-import warnings remain
  non-fatal in core/docs suites and are unrelated to this task.

## Files

- `apps/docs/src/app/pages/filter/examples/4/`
- `apps/docs/src/app/pages/data-table/examples/22/`
- `apps/docs/src/app/pages/filter/index.ts`
- `apps/docs/src/app/pages/data-table/index.ts`
- `.claude/projects/app-docs.md`
- `.claude/projects/page-filter.md`
- `.claude/projects/page-data-table.md`

## Fix round 1/5 — interaction coverage

### Test-first result

Replaced both direct-instance smoke tests before changing production code.
The controlled focused run passed immediately because the existing public
examples and library controls already implement the required user flows; no
production-example adjustment was needed.

- Filter coverage now opens the rendered Add filter popup through its native
  button, selects **Renewal risk**, opens and explicitly applies the query-chip
  editor, proves no execute occurs before the top-level explicit Apply, then
  switches via the rendered Live mode control and removes the chip. It asserts
  the grouped payload and exact execution count (one explicit + one live).
- Data Table coverage now clicks the rendered capture/review/reapply/reset
  controls and the real **Sort by Account** header action. It subscribes to
  `presentationStateChange`, verifies the user sort emits one durable snapshot,
  and verifies programmatic review, reapply, and reset emit no echo while
  restoring the captured state and rendered status.
- Removed the duplicate `@malva-ui/core/button` dependency entry from the Data
  Table page backing documentation.

### Fix-round verification

```sh
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- \
  src/app/pages/filter/examples/4/index.spec.ts \
  src/app/pages/data-table/examples/22/index.spec.ts
```

Pass — 2 files / 2 interaction tests.

## Fix round 2/5 — reset restoration audit

The requested reset assertion was already present in the prior fix commit
(`fdc19d36`), directly after the rendered **Reset example** activation:

```ts
expect(table.getPresentationState()).toEqual(initial);
```

It is independent of the rendered status and no-echo checks that follow it.
No source change was required in this round. Verification against the committed
test passed:

```sh
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- \
  src/app/pages/data-table/examples/22/index.spec.ts
yarn nx lint docs --skipNxCache
yarn nx typecheck docs --skipNxCache
git diff --check
```

All commands passed; the worktree was clean before this report-only audit note.
