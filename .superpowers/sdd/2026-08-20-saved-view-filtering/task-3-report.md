# Task 3 report — controlled view navigation and status actions

## Delivered

- Added standalone, OnPush generic `MlvViewVariantList<TState>` and
  `MlvViewVariantStatus<TState>` components to
  `@malva-ui/core/view-variant` and exported both from the public entry point.
- List navigation is controlled: it groups System, Team, and Personal views in
  fixed order, applies local case- and diacritic-insensitive matching, emits
  selection before writing `activeId`, and never persists or confirms changes.
- List rows use grouped native button lists, `aria-current="page"`, accessible
  read-only text, tabular result counts, capability-gated overflow operations,
  and only expose a creation action for allowed non-system scopes.
- Status resolves all five internal modes. It visibly renders unsaved,
  locked-clean, locked-dirty, and editable-dirty; editable-clean intentionally
  renders no band. Actions are capability- and dirty-state-aware.
- Busy state is isolated to the matching create/clone/update action, uses the
  existing `mlvButton` loading pattern, and marks only relevant status work as
  `aria-busy`. Host errors are polite `role="status"` content with retry and
  dismiss events.
- Added BEM/token-only SCSS for the requested quiet 17rem list, 2.5rem rows,
  pale selected state, separators, full-width bordered status band, and the
  48rem stacked layout.

## TDD evidence

### RED

`yarn nx test core-view-variant --skipNxCache` initially produced 13 failing
new list/status tests while the components did not exist; the previous
`view-variant-state` suite still passed (3 tests).

During self-review, two extra busy-isolation tests were added first and failed:
the row overflow trigger was disabled by an unrelated action, and a rename
operation marked the status region busy. The implementation was narrowed to
the matching action after that RED run.

### GREEN

The final uncached leaf run reports 3 test files and 18 tests passed, including
axe checks for the default list, locked-dirty/error status, and error content.

## Verification

All commands exited 0:

```sh
yarn nx test core-view-variant --skipNxCache
yarn nx lint core-view-variant --skipNxCache
yarn nx typecheck core-view-variant --skipNxCache
yarn tsc --noEmit -p libs/core/view-variant/tsconfig.spec.json
yarn nx run styles:check-padding-tokens --skipNxCache
yarn nx run docs:check-doc-api --skipNxCache
yarn nx typecheck core --skipNxCache
yarn nx build core --skipNxCache
git diff --check
```

`docs:check-doc-api` completed with the workspace's pre-existing documentation
warnings (0 failures). The grouped core build explicitly built
`@malva-ui/core/view-variant`.

## Accessibility review

- Native button rows are keyboard-operable and selected rows expose
  `aria-current="page"`.
- Locked rows include visually-hidden `Read-only` text in addition to the lock
  icon; icons remain `aria-hidden`.
- Lists are semantic grouped unordered lists and overflow actions use the
  existing keyboard-accessible Malva menu primitive.
- Recoverable errors use polite `role="status"`, never assertive alerts.
- Axe tests pass. JSDOM logs its known unimplemented canvas warning while axe
  evaluates contrast; it does not produce an axe violation or test failure.

## Self-review

- Public exports are limited to `MlvViewVariantList` and
  `MlvViewVariantStatus`; internal group/mode types remain private.
- Inputs, models, and outputs match the Task 3 contract. The host remains the
  owner of persistence, authorization, confirmation, dirty calculation, and
  error lifecycle.
- Permission matrix checks cover creation visibility, clone/update conditions,
  editable-clean omission, and busy isolation. The UI also gates rename,
  delete, and share in each row's overflow menu.
- No unrelated files are included in the Task 3 change set.

## Concerns

- The Nx/Vite test invocation emits existing deprecation and missing
  `tsconfig.app.json` warnings; tests, typechecks, lint, and grouped build all
  completed successfully.
- Full visual/browser regression coverage is outside this leaf task; the
  components have focused axe coverage and token/style gate coverage.

## Fix Round 1/5 — controlled action contracts

### Review findings addressed

- **P1a:** Selecting the current row now returns before it emits or writes the
  `activeId` model. A real button re-click regression verifies both outcomes.
- **P1b:** Reset is a host-controlled request and remains available while an
  update is busy. The status component no longer silently suppresses that
  event, and a real button-click test verifies it.
- **P2:** List tests now open the CDK overlay and click the permitted Rename,
  Share, and Delete menu items, asserting the exact variant payload. They also
  verify capability omissions and that a busy Rename disables only Rename.
  Status tests invoke Reset, Duplicate, Update, Save as new, Retry, and
  Dismiss controls in their corresponding modes, including denied and busy
  non-emission assertions. Overlay menus are closed after every interaction
  and destroyed during teardown.
- **P3:** `MlvViewVariantStatus` now always supplies the
  `mlv-view-variant-status` host block class. Its conditional visible content
  is the `__surface` element, so editable-clean has an empty block host and no
  persistent status surface.

### TDD evidence

**RED:** Before source changes,
`yarn nx test core-view-variant --skipNxCache` ran 25 tests with 5 failures:
the active-row re-click emitted; Reset was suppressed during update busy; and
the status host/surface structure did not meet the BEM assertions (including
the unrelated-busy surface check). The newly added real menu and status action
tests passed on that run, establishing that P2 was missing interaction
coverage rather than existing action behavior.

**GREEN:** After the minimal behavior and BEM changes, the same uncached leaf
suite passed all 25 tests across 3 files, including axe checks.

### Fix-round verification

All commands exited 0:

```sh
yarn nx test core-view-variant --skipNxCache
yarn nx lint core-view-variant --skipNxCache
yarn nx typecheck core-view-variant --skipNxCache
yarn tsc --noEmit -p libs/core/view-variant/tsconfig.spec.json
yarn nx run styles:check-padding-tokens --skipNxCache
yarn nx build core --skipNxCache
git diff --check
```

The grouped core build explicitly built `@malva-ui/core/view-variant`.

### Accessibility and self-review

- The host block is present even when there is no visible status content; the
  visible surface preserves the existing polite busy/error semantics.
- Action assertions exercise native controls and the real keyboard-accessible
  Malva menu overlay, rather than inspecting a closed trigger template.
- Rechecked the controlled contract: selection, Reset, and every persistence
  action merely emit; the host continues to own persistence, dirty state,
  confirmation, permissions, and error lifecycle.

### Fix-round concerns

- CDK overlay setup makes JSDOM log an unsupported CSS `@layer` parse warning;
  axe additionally logs its known unimplemented canvas warning. Neither
  produces a test failure or an axe violation.
