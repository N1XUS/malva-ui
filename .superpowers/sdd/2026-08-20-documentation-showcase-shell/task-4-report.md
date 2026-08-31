# Task 4 report — composed Page shell sidebars

## Scope delivered

- Formalized the Page shell's direct-child geometry for zero to two repeated
  `[mlvPageSidebar]` hosts and one end `[mlvPageEndSidebar]` host.
- Kept projected start sidebars in DOM/projection order, with no wrapper nodes,
  numbered sidebar selectors, or column-count input.
- Added the tokenized adjacent-start-sidebar separator using
  `var(--mlv-stroke-width)` and the existing `var(--mlv-border-subtle)` token.
- Reworked Page example 2 into an icon rail, expanded navigation, central Page
  canvas, and labelled end inspector. Navigation and inspector now collapse
  independently, with external named reopen controls that remain tabbable.
- Documented the supported shell projection contract in the tracked backing
  target for `libs/core/page/CLAUDE.md`.

## TDD evidence

### RED

`yarn nx test core-page` was run after the new tests and before the shell CSS
contract. Result: 49 passing tests and one expected failure in
`page-shell.spec.ts`:

> keeps adjacent start sidebars as compact tracks separated by the subtle
> border token — received no `flex` declaration for the second start sidebar.

The new DOM-order test already passed, confirming that repeated projection was
present before the geometry contract; the style assertion was the intended
missing behavior.

### GREEN

- `yarn nx test core-page` — passed: 8 files, 50 tests.
- `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/pages/page/examples/2/index.spec.ts` — passed: 1 file, 8 tests.

## Verification

- `yarn nx run styles:check-padding-tokens` — passed; 695 files scanned.
- `yarn nx lint core-page` — passed.
- `yarn nx typecheck docs` — passed.
- `yarn nx run docs:check-doc-api` — passed with the repository's existing
  non-fatal documentation warnings (240 warnings, 0 failures).
- `git diff --check` — passed.

`yarn nx lint docs` was also run. It fails on ten pre-existing selector-prefix
violations in Task 2 showcase and existing app test files; none are in this
task's changed files.

## Files changed

- `.claude/projects/libs-page.md` (`libs/core/page/CLAUDE.md` backing target)
- `libs/core/page/src/lib/page-shell/page-shell.scss`
- `libs/core/page/src/lib/page-shell/page-shell.spec.ts`
- `apps/docs/src/app/pages/page/examples/2/index.{ts,html,scss,spec.ts}`

## Self-review

- BEM: new styles stay within the existing `app-shell-preview` block and the
  shell's existing `mlv-page-shell` block.
- Accessibility: all controls are native Malva buttons, expose state through
  `aria-expanded`, and retain explicit accessible names when their controlled
  panels are collapsed.
- Signals: all template signal reads are invoked.
- Tokens: the separator uses only existing Malva style tokens; no `color-mix`
  was introduced for the adjacent-sidebar seam.

## Concern

The focused docs Vitest run logs the existing jsdom `@layer` CSS parse warning
from Angular CDK overlay styles but exits successfully. The docs-wide lint
failure described above remains outside this task's ownership.

## Fix Round 1 — inert collapsed panels

### Review findings addressed

- The zero-width navigation and inspector hosts remained mounted with tabbable
  descendants after collapse.
- The original reopen-control test mutated internal signals instead of proving
  the UI interaction contract.

### TDD evidence

**RED:** Added two UI-driven tests, one per panel. Each clicks the visible
external collapse control, asserts the control's `aria-expanded` transition,
the collapsed host's native `inert` and `aria-hidden` state, and the other
panel's unchanged state; it then clicks the same external control to assert
restoration. Before implementation, the focused suite failed exactly on the
missing `inert` attributes (2 failures, 7 passing tests).

**GREEN:** Bound native `inert` and `aria-hidden="true"` directly on the
collapsed navigation and inspector projection hosts. The rail navigation
control and topbar inspector control remain outside those hosts, so both stay
available to reopen their respective panel. The focused suite then passed 9/9
tests.

### Fix verification and self-review

- `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/pages/page/examples/2/index.spec.ts` — passed, 9 tests.
- `yarn nx typecheck docs` — passed.
- `yarn nx run docs:lint --lintFilePatterns=apps/docs/src/app/pages/page/examples/2/index.ts --lintFilePatterns=apps/docs/src/app/pages/page/examples/2/index.spec.ts` — passed.
- `git diff --check` — passed.

The fix uses the browser-native inert attribute rather than descendant
`tabindex` mutation. It preserves offcanvas operation because the navigation
host ceases to be inert before its drawer is reopened. Each test drives only
its named control and asserts that the other panel remains active.
