# Task 3 implementation report

## Status

DONE_WITH_CONCERNS — implemented locally after the dispatched worker was blocked by the host usage limit. The extracted controller preserves the existing trigger overlay, focus, menubar, and submenu hover-intent behavior.

## Files changed

- `libs/core/menu/src/lib/menu/menu-overlay-controller.ts`
- `libs/core/menu/src/lib/menu/menu-overlay-controller.spec.ts`
- `libs/core/menu/src/lib/menu/menu-trigger.ts`

## Implementation

- Added `MlvMenuOverlayController` with `isOpen`, open/close/toggle, first/last-focus opening, mouseenter/mouseleave, and destroy APIs.
- Moved popup creation, menu parent/controller registration, leave-animation cleanup, focus restoration, submenu triangle tracking, 150 ms grace close, and menubar notifications into the controller.
- Kept `MlvMenuTrigger` as the public façade with its existing inputs, outputs, host bindings, menubar registry behavior, keyboard handling, and MlvMenubarItem methods.
- Added a close-request callback so hover-intent closure still travels through the owning trigger façade, preserving existing observable behavior and tests.
- Added a test harness covering disabled/already-open no-op behavior, close lifecycle, submenu re-entry cancellation, and menubar open/close notifications.

## Verification

Command: `yarn nx test core-menu`

Result: PASS — 6 test files, 81 tests passed. The run still emits the existing jsdom `Could not parse CSS stylesheet` output and Angular `NG0953` output from the pre-existing menu tests; no test failed.

Command: `yarn nx lint core-menu`

Result: PASS — `Linting "core-menu"...`, `✔ All files pass linting`, `NX Successfully ran target lint for project core-menu`.

## Commit

- `c9d59cff` — `refactor(menu): share submenu overlay controller`

## Concern

The implementation and verification were completed by the controller because the assigned worker hit the host usage limit before returning. The task still requires the normal scoped review gate.

## Fix round 1

Added real Angular/CDK overlay integration coverage to `menu-overlay-controller.spec.ts`. The new tests exercise root connected-overlay creation with a backdrop and focus restoration, submenu connected-overlay creation without an additional backdrop, and menubar child opening while the menubar host remains a dismissal exclusion. Existing hand-rolled controller tests remain unchanged.

### Verification output

Command: `yarn nx test core-menu`

Complete result: PASS (exit code 0).

```text
> nx run core-menu:test
✓ |core-menu| src/lib/menu/submenu-aim.spec.ts (5 tests)
✓ |core-menu| src/lib/menu/menu-data-source.spec.ts (6 tests)
✓ |core-menu| src/lib/menu/menu-overlay-controller.spec.ts (6 tests)
✓ |core-menu| src/lib/menu/menu-item-registry.spec.ts (12 tests)
✓ |core-menu| src/lib/menu/menubar.spec.ts (16 tests)
✓ |core-menu| src/lib/menu/menu.spec.ts (43 tests)
Test Files  6 passed (6)
Tests       83 passed (83)
NX   Successfully ran target test for project core-menu
```

The run also emitted the pre-existing jsdom `Could not parse CSS stylesheet` diagnostics, Angular `NG0953` destroyed `OutputRef` diagnostics, and Nx deprecation warnings; these did not fail the run.

Command: `yarn nx lint core-menu`

Complete result: PASS (exit code 0).

```text
> nx run core-menu:lint
Linting "core-menu"...
✔ All files pass linting
NX   Successfully ran target lint for project core-menu
```

## Fix round 2

Added deterministic real-overlay assertions that capture the actual `MlvPopupService.open` configurations and compare root and submenu calls to `MENU_POSITIONS` and `SUBMENU_POSITIONS`. Added real menubar-child lifecycle coverage that verifies the no-backdrop configuration, menubar host exclusion behavior, and concrete `notifyItemOpened`/`notifyItemClosed` calls through open and Escape-close.

### Verification output

Command: `yarn nx test core-menu`

```text
TEST_STATUS=0
Test Files  6 passed (6)
Tests       83 passed (83)
NX   Successfully ran target test for project core-menu
```

The complete command output also contains the existing Nx deprecation warnings, jsdom `Could not parse CSS stylesheet` diagnostics, Angular `NG0953` diagnostics, and the successful Nx duration/recommendation block; no test failed.

Command: `yarn nx lint core-menu`

```text
TEST_STATUS=0 LINT_STATUS=0
> nx run core-menu:lint
Linting "core-menu"...
✔ All files pass linting
NX   Successfully ran target lint for project core-menu
```
