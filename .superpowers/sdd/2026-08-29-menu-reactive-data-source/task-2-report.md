# Task 2 Report — Reactive menu/menubar data-source registry wiring

Date: 2026-08-29

Scope completed:
- Created `libs/core/menu/src/lib/menu/menu-item-registry.ts`
- Created `libs/core/menu/src/lib/menu/menubar-item-registry.ts`
- Created `libs/core/menu/src/lib/menu/menu-item-registry.spec.ts`
- Modified `libs/core/menu/src/lib/menu/menu.ts`
- Modified `libs/core/menu/src/lib/menu/menu-item.ts`
- Modified `libs/core/menu/src/lib/menu/menu-trigger.ts`
- Modified `libs/core/menu/src/lib/menu/menubar.ts`

Task 1 files and public data contracts were not modified.

## Files changed

- `libs/core/menu/src/lib/menu/menu-item-registry.spec.ts`
- `libs/core/menu/src/lib/menu/menu-item-registry.ts`
- `libs/core/menu/src/lib/menu/menu-item.ts`
- `libs/core/menu/src/lib/menu/menu-trigger.ts`
- `libs/core/menu/src/lib/menu/menu.ts`
- `libs/core/menu/src/lib/menu/menubar-item-registry.ts`
- `libs/core/menu/src/lib/menu/menubar.ts`

## Decisions

1. Replaced direct `contentChildren(...)` item discovery in `MlvMenu` and `MlvMenubar` with injected signal-backed registries so projected rows and future generated rows share one ordered source of truth.
2. Kept the existing projected API intact by registering existing `MlvMenuItem` and menubar-child `MlvMenuTrigger` instances on creation and unregistering them through `DestroyRef`.
3. Limited menubar registration to triggers inside a menubar by checking the existing menubar context, so ordinary menu triggers keep their current behavior.
4. Made registration idempotent and removal instance-based to match the brief and support repeated reactive re-renders safely.
5. Preserved DOM order in the registry stores so keyboard management keeps the same navigation assumptions as the projected implementation.
6. Wrote focused tests for:
   - duplicate registration / instance-based unregister
   - conditional projected menu item removal
   - conditional projected menubar trigger removal
   - roving tabindex validity after removal

## Exact commands and outputs

### `yarn nx test core-menu`

Raw full output: [task2-core-menu-test.log](/tmp/task2-core-menu-test.log)

Terminal result summary:

```text
> nx run core-menu:test
...
✓ |core-menu| src/lib/menu/menu.spec.ts (43 tests) 1628ms

Test Files  5 passed (5)
     Tests  75 passed (75)
  Start at  23:09:23
  Duration  5.02s (transform 827ms, setup 803ms, import 9.28s, tests 2.68s, environment 688ms)

NX   Successfully ran target test for project core-menu
```

Notes from the full output:
- Existing jsdom `Could not parse CSS stylesheet` noise is still emitted during overlay tests.
- Existing Angular `NG0953: Unexpected emit for destroyed OutputRef` noise is still emitted in the current suite.
- Neither warning stream caused the run to fail.

### `yarn nx lint core-menu`

Raw full output: [task2-core-menu-lint.log](/tmp/task2-core-menu-lint.log)

Terminal result summary:

```text
> nx run core-menu:lint
...
Linting "core-menu"...

✔ All files pass linting

NX   Successfully ran target lint for project core-menu
```

### `git add libs/core/menu/src/lib/menu/menu.ts libs/core/menu/src/lib/menu/menu-item.ts libs/core/menu/src/lib/menu/menu-trigger.ts libs/core/menu/src/lib/menu/menubar.ts libs/core/menu/src/lib/menu/menu-item-registry.ts libs/core/menu/src/lib/menu/menubar-item-registry.ts libs/core/menu/src/lib/menu/menu-item-registry.spec.ts && git commit -m "refactor(menu): register projected and generated items"`

Output:

```text
[STARTED] Backing up original state...
[COMPLETED] Backed up original state in git stash (367bde72)
[STARTED] Running tasks for staged files...
[STARTED] lint-staged.config.mjs — 7 files
[STARTED] *.ts — 7 files
[STARTED] *.{ts,html,scss,json,md} — 7 files
[STARTED] eslint --fix
[STARTED] prettier --write
[COMPLETED] prettier --write
[COMPLETED] *.{ts,html,scss,json,md} — 7 files
[COMPLETED] eslint --fix
[COMPLETED] *.ts — 7 files
[COMPLETED] lint-staged.config.mjs — 7 files
[COMPLETED] Running tasks for staged files...
[STARTED] Applying modifications from tasks...
[COMPLETED] Applying modifications from tasks...
[STARTED] Cleaning up temporary files...
[COMPLETED] Cleaning up temporary files...
[main c3c3c19d] refactor(menu): register projected and generated items
 7 files changed, 510 insertions(+), 33 deletions(-)
 create mode 100644 libs/core/menu/src/lib/menu/menu-item-registry.spec.ts
 create mode 100644 libs/core/menu/src/lib/menu/menu-item-registry.ts
 create mode 100644 libs/core/menu/src/lib/menu/menubar-item-registry.ts
```

## Commit hash

- `c3c3c19d67e5f4dbd315b86c1aa7f5ddc557d116`

## Concerns

1. The passing test run still emits pre-existing noisy jsdom stylesheet parse errors and `NG0953` stderr lines; they appear unrelated to Task 2 but can obscure real failures in future runs.
2. Registry ordering currently relies on DOM queries against the nearest `mlv-menu` / `mlv-menubar`, which is appropriate for projected items and future generated rows that render into the same DOM tree, but any future non-DOM-backed item source would need an explicit ordering strategy.

## Fix round 1 — reorder resync follow-up

Review findings addressed:
- Registries now re-sync after reorder events instead of only sorting on register/unregister.
- Tests now assert real order rather than sorted membership, including tracked-row reorders.

### Additional decisions

1. Added `syncOrder(...)` to both registries so the parent menu/menubar can publish Angular’s projected order directly when the same tracked instances move.
2. Kept `register` / `unregister` instance-based so future generated rows can still join the registry without changing the projected API.
3. Kept `resync()` plus mutation-observer support so non-query-driven moves still have a fallback path.
4. For menu items specifically, the registry now treats projected host order and open-panel order differently because `mlv-menu` projection can differ from raw light-DOM order.

### Additional files changed in fix round 1

- `libs/core/menu/src/lib/menu/menu-item-registry.spec.ts`
- `libs/core/menu/src/lib/menu/menu-item-registry.ts`
- `libs/core/menu/src/lib/menu/menu-item.ts`
- `libs/core/menu/src/lib/menu/menu-trigger.ts`
- `libs/core/menu/src/lib/menu/menu.ts`
- `libs/core/menu/src/lib/menu/menubar-item-registry.ts`
- `libs/core/menu/src/lib/menu/menubar.ts`

### Exact commands and outputs

#### `yarn nx test core-menu`

Raw full output: [task2-fix1-core-menu-test.log](/tmp/task2-fix1-core-menu-test.log)

Terminal result summary:

```text
> nx run core-menu:test
...
✓ |core-menu| src/lib/menu/menu.spec.ts (43 tests) 1654ms

Test Files  5 passed (5)
     Tests  77 passed (77)
  Start at  23:21:37
  Duration  5.28s (transform 1.05s, setup 794ms, import 10.11s, tests 2.75s, environment 720ms)

NX   Successfully ran target test for project core-menu
```

Notes from the full output:
- Existing jsdom stylesheet parse noise is still present during overlay tests.
- Existing Angular `NG0953` stderr noise is still present in the suite.
- The captured run also included pre-existing Analog/Vite tsconfig resolution warnings while reconstructing cached task output:
  - `Unable to resolve tsconfig at /Users/denisseverin/Projects/claude-test/angular-ui-lib/libs/core/tsconfig.app.json`
  - `Unable to resolve tsconfig at /Users/denisseverin/Projects/claude-test/angular-ui-lib/libs/core/table/tsconfig.app.json`

#### `yarn nx lint core-menu`

Raw full output: [task2-fix1-core-menu-lint.log](/tmp/task2-fix1-core-menu-lint.log)

Terminal result summary:

```text
> nx run core-menu:lint
...
Linting "core-menu"...

✔ All files pass linting

NX   Successfully ran target lint for project core-menu
```

## Fix round 2 — `toSorted()` compatibility follow-up

Review finding addressed:
- Replaced ES2023 `toSorted()` calls in both Task 2 registries with non-mutating array copies followed by `.sort(...)`, preserving the existing DOM-order behavior while remaining compatible with the project TypeScript target.

### Additional files changed in fix round 2

- `libs/core/menu/src/lib/menu/menu-item-registry.ts`
- `libs/core/menu/src/lib/menu/menubar-item-registry.ts`

### Exact commands and outputs

#### `yarn nx test core-menu`

Captured full output: [core-menu-test-20260830-followup.log](/tmp/core-menu-test-20260830-followup.log)

Terminal result summary:

```text
> nx run core-menu:test
...
✓ |core-menu| src/lib/menu/menu.spec.ts (43 tests) 1610ms
Test Files  6 passed (6)
     Tests  83 passed (83)
  Start at  10:35:43
  Duration  5.25s (transform 839ms, setup 998ms, import 13.49s, tests 2.81s, environment 902ms)

NX   Successfully ran target test for project core-menu
```

Notes from the full output:
- Existing jsdom `Could not parse CSS stylesheet` noise is still present during overlay-related tests.
- Existing Angular `NG0953: Unexpected emit for destroyed OutputRef` stderr noise is still present in the suite.
- The compatibility change did not introduce new test failures.

#### `yarn nx lint core-menu`

Captured full output: [core-menu-lint-20260830-followup.log](/tmp/core-menu-lint-20260830-followup.log)

Terminal result summary:

```text
> nx run core-menu:lint

Linting "core-menu"...
✔ All files pass linting

NX   Successfully ran target lint for project core-menu
```

#### `git add libs/core/menu/src/lib/menu/menu-item-registry.ts libs/core/menu/src/lib/menu/menubar-item-registry.ts .superpowers/sdd/2026-08-29-menu-reactive-data-source/task-2-report.md && git commit -m "fix(menu): replace registry toSorted usage"`

Output:

```text
[main <pending>] fix(menu): replace registry toSorted usage
```

## Fix round 3 — strict typecheck compatibility follow-up

Date: 2026-08-30

Diagnosis:
- `MlvMenuItem` could not satisfy `MenuKeyItem` during library typecheck because `MenuKeyItem` extended CDK `FocusableOption`, which brings in `disabled?: boolean`. The directive already exposes a public `disabled` input signal, so structural typing compared that signal against a plain boolean and rejected registration/unregistration.
- `MlvMenuTrigger` still used non-standard boolean input generics, so its read side widened to `BooleanInput` where the menubar/controller paths expect plain booleans.
- `menu-item-registry.ts` returned raw `Element | null` from `closest()` in one helper while promising `HTMLElement | null`.

Files changed in fix round 3:

- `libs/core/menu/src/lib/menu/menu-item-registry.spec.ts`
- `libs/core/menu/src/lib/menu/menu-item-registry.ts`
- `libs/core/menu/src/lib/menu/menu-item.ts`
- `libs/core/menu/src/lib/menu/menu-trigger.ts`

### TDD red step

Added the smallest compile-time regression coverage in `menu-item-registry.spec.ts` for:
- `MlvMenuItem['disabled']`
- `MlvMenuTrigger['isSubmenuTrigger']`
- `MlvMenuTrigger['menuTriggerDisabled']`
- `MenuKeyItem['_elementRef']`

#### Focused red verification

Command:

```text
yarn nx test core-menu --skipNxCache -- --run src/lib/menu/menu-item-registry.spec.ts
```

Output summary:

```text
✓ |core-menu| src/lib/menu/menu.spec.ts (43 tests) 1628ms
Test Files  6 passed (6)
     Tests  85 passed (85)

NX   Successfully ran target test for project core-menu
```

Note:
- The extra Vitest argument did not narrow execution in this Nx setup; the full `core-menu` suite still ran.

Command:

```text
yarn nx run core-menu:typecheck --skipNxCache
```

Complete failure output:

```text
> nx run core-menu:typecheck

> tsc --noEmit -p tsconfig.lib.json

src/lib/menu/menu-item-registry.ts(189,52): error TS2740: Type 'Element' is missing the following properties from type 'HTMLElement': accessKey, accessKeyLabel, autocapitalize, autocorrect, and 131 more.
src/lib/menu/menu-item.ts(71,30): error TS2345: Argument of type 'this' is not assignable to parameter of type 'MenuKeyItem'.
  Type 'MlvMenuItem' is not assignable to type 'MenuKeyItem'.
    Types of property 'disabled' are incompatible.
      Type 'InputSignalWithTransform<BooleanInput, string | boolean>' is not assignable to type 'boolean | undefined'.
src/lib/menu/menu-item.ts(73,67): error TS2345: Argument of type 'this' is not assignable to parameter of type 'MenuKeyItem'.
  Type 'MlvMenuItem' is not assignable to type 'MenuKeyItem'.
    Types of property 'disabled' are incompatible.
      Type 'InputSignalWithTransform<BooleanInput, string | boolean>' is not assignable to type 'boolean | undefined'.
src/lib/menu/menu-trigger.ts(165,22): error TS2322: Type 'BooleanInput' is not assignable to type 'boolean'.
  Type 'undefined' is not assignable to type 'boolean'.
src/lib/menu/menu-trigger.ts(167,23): error TS2322: Type 'BooleanInput' is not assignable to type 'boolean'.
  Type 'undefined' is not assignable to type 'boolean'.
Warning: command "tsc --noEmit -p tsconfig.lib.json" exited with non-zero status code


 NX   Running target typecheck for project core-menu failed

Failed tasks:

- core-menu:typecheck

Hint: run the command with --verbose for more details.

  Run duration:      667ms
  Cache:             Skipped (--skip-nx-cache)
  Critical path:     660ms (1 task)
  Recoverable time:  <1ms

  Recommendations:
    - Cache: drop --skip-nx-cache to restore unchanged tasks instantly.
    - Speed up or split the longest tasks on the critical path:
        core-menu:typecheck    660ms
```

Intermediate verification after the first source pass:

```text
> nx run core-menu:typecheck

> tsc --noEmit -p tsconfig.lib.json

src/lib/menu/menu-item.ts(71,30): error TS2345: Argument of type 'this' is not assignable to parameter of type 'MenuKeyItem'.
  Type 'MlvMenuItem' is not assignable to type 'MenuKeyItem'.
    Types of property 'disabled' are incompatible.
      Type 'InputSignalWithTransform<boolean, BooleanInput>' is not assignable to type 'boolean | undefined'.
src/lib/menu/menu-item.ts(73,67): error TS2345: Argument of type 'this' is not assignable to parameter of type 'MenuKeyItem'.
  Type 'MlvMenuItem' is not assignable to type 'MenuKeyItem'.
    Types of property 'disabled' are incompatible.
      Type 'InputSignalWithTransform<boolean, BooleanInput>' is not assignable to type 'boolean | undefined'.
Warning: command "tsc --noEmit -p tsconfig.lib.json" exited with non-zero status code


 NX   Running target typecheck for project core-menu failed
```

Root-cause conclusion:
- Swapping the input generic order fixed the trigger read types and the DOM helper fixed `closest()` typing, but the remaining failure proved the registry contract itself still accidentally required a boolean `disabled` property through `FocusableOption`. The minimal fix was to stop inheriting that whole CDK interface in `MenuKeyItem` and instead declare only the methods/properties this registry and key manager actually use (`focus`, `getLabel`, `disabledBoolean`, `_tabIndex`, `_elementRef`).

### Final verification commands and complete outputs

#### `yarn nx run core-menu:typecheck --skipNxCache`

Captured full output: [core-menu-typecheck-20260830-task2-fix2.log](/tmp/core-menu-typecheck-20260830-task2-fix2.log)

```text
> nx run core-menu:typecheck

> tsc --noEmit -p tsconfig.lib.json



 NX   Successfully ran target typecheck for project core-menu


  Run duration:      839ms
  Cache:             Skipped (--skip-nx-cache)
  Critical path:     831ms (1 task)
  Recoverable time:  <1ms

  Recommendations:
    - Cache: drop --skip-nx-cache to restore unchanged tasks instantly.
    - Speed up or split the longest tasks on the critical path:
        core-menu:typecheck    831ms
```

#### `yarn nx test core-menu --skipNxCache`

Captured full output: [core-menu-test-20260830-task2-fix2.log](/tmp/core-menu-test-20260830-task2-fix2.log)

```text
✓ |core-menu| src/lib/menu/menu.spec.ts (43 tests) 1634ms
Test Files  6 passed (6)
     Tests  85 passed (85)
   Start at  10:44:26
   Duration  5.35s (transform 1.14s, setup 989ms, import 13.41s, tests 2.82s, environment 1.51s)



 NX   Successfully ran target test for project core-menu


  Run duration:      7.5s
  Cache:             Skipped (--skip-nx-cache)
  Critical path:     7.5s (1 task)
  Recoverable time:  <1ms

  Recommendations:
    - Cache: drop --skip-nx-cache to restore unchanged tasks instantly.
    - Speed up or split the longest tasks on the critical path:
        core-menu:test    7.5s
```

Notes from the captured full output:
- Existing jsdom `Could not parse CSS stylesheet` noise is still present during overlay-related tests.
- Existing Angular `NG0953: Unexpected emit for destroyed OutputRef` stderr noise is still present in the suite.

#### `yarn nx lint core-menu --skipNxCache`

Captured full output: [core-menu-lint-20260830-task2-fix2.log](/tmp/core-menu-lint-20260830-task2-fix2.log)

```text
> nx run core-menu:lint

(node:63146) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
The `@nx/eslint:lint` executor is deprecated and will be removed in Nx v24. Run `nx g @nx/eslint:convert-to-inferred` to migrate to the `@nx/eslint/plugin` inferred targets. See https://nx.dev/docs/guides/tasks--caching/convert-to-inferred for details.
Linting "core-menu"...
✔ All files pass linting



 NX   Successfully ran target lint for project core-menu


  Run duration:      1.0s
  Cache:             Skipped (--skip-nx-cache)
  Critical path:     1.0s (1 task)
  Recoverable time:  <1ms

  Recommendations:
    - Cache: drop --skip-nx-cache to restore unchanged tasks instantly.
    - Speed up or split the longest tasks on the critical path:
        core-menu:lint    1.0s
```
