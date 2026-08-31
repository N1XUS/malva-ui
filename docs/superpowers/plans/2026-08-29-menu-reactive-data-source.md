# Reactive menu and menubar data sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add typed reactive data-source rendering to `mlv-menu` and `mlv-menubar`, with lazy observable submenus, localized loading feedback, automatic submenu indicators, and root-level dividers while preserving projected menus.

**Architecture:** Keep the existing CDK overlay and manual `FocusKeyManager`. Add a source adapter, registry-backed item reconciliation, and a shared internal overlay controller. Render data rows recursively through `NgTemplateOutlet` with an injector-provided context so `MlvMenuItem` can provide automatic submenu behavior without changing `MlvListItem`.

**Tech Stack:** Angular 22 components/directives, signals, CDK `FocusKeyManager`, `MlvPopupService`, RxJS, `MlvDataSource`, `MlvLoader`, Vitest through Nx, and Malva SCSS tokens.

**Spec:** `docs/superpowers/specs/2026-08-29-menu-reactive-data-source-design.md`

## Global Constraints

- Preserve the existing projected menu/menubar API and behavior.
- Keep the public source shape exactly `T[] | MlvDataSource<T>`; child sources emit `MlvMenuItemData<T>[]` through `Observable`.
- Do not modify `MlvListItem` source, template, or styles.
- Use `MlvLoader`'s existing `MLV_LOADER_I18N` fallback; add no hardcoded loading label or second menu i18n token.
- Dividers are root-level menubar entries only and never enter roving tabindex or type-ahead.
- Use `Mlv` prefixes for public names, `_` for private members, `OnPush`, and `ViewEncapsulation.None`; do not add `standalone: true`.
- Apply the accessibility and BEM SCSS rules to all interactive/style changes.
- Use `yarn nx test core-menu` and `yarn nx lint core-menu`; do not invoke Vitest or ESLint directly.
- Preserve the unrelated dirty working-tree changes; each commit names only that task's files.

---

## File map

Create:

- `libs/core/menu/src/lib/menu/menu-data.types.ts` — public item/source/divider/context types.
- `libs/core/menu/src/lib/menu/menu-item-def.ts` — typed `[mlvMenuItemDef]` directive.
- `libs/core/menu/src/lib/menu/menu-data-source.ts` — internal root adapter and lazy child source.
- `libs/core/menu/src/lib/menu/menu-item-registry.ts` — internal menu-row registry.
- `libs/core/menu/src/lib/menu/menubar-item-registry.ts` — internal top-level registry.
- `libs/core/menu/src/lib/menu/menu-overlay-controller.ts` — shared overlay and hover-intent controller.
- `libs/core/menu/src/lib/menu/menu-data-item.ts` — recursive data row host.
- `libs/core/menu/src/lib/menu/menu-data-renderer.ts` — menu/menubar collection renderer.
- `libs/core/menu/src/lib/menu/menu-data-renderer.scss` — renderer layout rules.
- `libs/core/menu/src/lib/menu/menu-data-source.spec.ts` — source lifecycle tests.
- `libs/core/menu/src/lib/menu/menu-data.spec.ts` — data menu/lazy submenu tests.
- `libs/core/menu/src/lib/menu/menubar-data.spec.ts` — data menubar/divider tests.

Modify:

- `libs/core/menu/src/lib/menu/menu.ts`, `menu-item.ts`, `menu-trigger.ts`, `menubar.ts` — component/directive integration.
- `libs/core/menu/src/lib/menu/menu.types.ts`, `menubar.types.ts` — internal/public contracts.
- `libs/core/menu/src/lib/menu/menu.scss`, `menubar.scss` — indicator/divider styles.
- `libs/core/menu/src/index.ts` — public exports.
- `libs/core/menu/CLAUDE.md` — library documentation.
- `apps/docs/src/app/pages/menu/index.ts` and new examples `6`/`7` — showcase documentation.

`MlvListItem` files are deliberately not modified.

## Tasks

### Task 1: Add public contracts and source adapters

**Files:** Create `menu-data.types.ts`, `menu-data-source.ts`, `menu-item-def.ts`, and `menu-data-source.spec.ts`; modify `src/index.ts`.

**Interfaces:**

- `MlvMenuItemData<T>` has `id: string | number`, `label: string`, optional `data: T`, optional `disabled`, and optional `children: Observable<MlvMenuItemData<T>[]>`.
- `MlvMenuDataSource<T>` is `T[] | MlvDataSource<T>`.
- `MlvMenubarDividerData` has `kind: 'divider'` and an id; `MlvMenubarEntry<TItem>` is `TItem | MlvMenubarDividerData`.
- `MlvMenuItemDefContext<T>` has `$implicit`, `index`, `hasChildren`, and `loading`.
- Internal `MlvMenuDataSourceAdapter<T>` exposes `setSource`, `items: Signal<T[]>`, and `loading: Signal<boolean>`; internal `MlvMenuChildrenDataSource<T>` exposes `ensureLoaded`, `items`, and `loading`.

- [ ] **Step 1: Write failing tests.**

Use a test `MlvDataSource` whose `connect()` returns a signal and a `Subject<MlvMenuItemData<string>[]>` for children. Assert arrays render as-is, a data source is connected once per source identity, child subscription count is zero before `ensureLoaded()`, first emission ends loading, later emissions replace items, and errors become `[]` with loading false.

- [ ] **Step 2: Run the failing test.**

Run `yarn nx test core-menu`. Expected: FAIL because the types and adapters do not exist.

- [ ] **Step 3: Implement the contracts/adapters.**

Use these public signatures:

```ts
export interface MlvMenuItemData<T = unknown> {
  readonly id: string | number;
  readonly label: string;
  readonly data?: T;
  readonly disabled?: boolean;
  readonly children?: Observable<MlvMenuItemData<T>[]>;
}

export type MlvMenuDataSource<T> = T[] | MlvDataSource<T>;
```

Cache `connect()` by source identity, mirror `MlvDataSource.loading`, and make the child source subscribe once from `ensureLoaded()`, replace on later emissions, swallow errors into an empty collection, and unsubscribe on destruction. Implement `MlvMenuItemDef<T>` with `TemplateRef<MlvMenuItemDefContext<T>>` and the standard Angular context guard. Export only the public types/directive.

- [ ] **Step 4: Run `yarn nx test core-menu`; expected PASS.**

- [ ] **Step 5: Commit.**

```bash
git add libs/core/menu/src/lib/menu/menu-data.types.ts libs/core/menu/src/lib/menu/menu-data-source.ts libs/core/menu/src/lib/menu/menu-item-def.ts libs/core/menu/src/lib/menu/menu-data-source.spec.ts libs/core/menu/src/index.ts
git commit -m "feat(menu): add reactive menu data contracts"
```

### Task 2: Register projected and generated items

**Files:** Create `menu-item-registry.ts`, `menubar-item-registry.ts`, and `menu-item-registry.spec.ts`; modify `menu.ts`, `menu-item.ts`, `menu-trigger.ts`, and `menubar.ts`.

**Interfaces:** Internal `MlvMenuItemRegistry` exposes ordered `items: Signal<readonly MenuKeyItem[]>`, `register`, and `unregister`; `MlvMenubarItemRegistry` exposes the analogous `MlvMenubarItem[]` contract.

- [ ] **Step 1: Write failing tests.**

Add conditional projected rows, remove one, and assert the remaining row retains a valid roving tabindex. Unit-test idempotent registration and instance-based removal.

- [ ] **Step 2: Run `yarn nx test core-menu`; expected FAIL** until the parent components consume registries.

- [ ] **Step 3: Implement registries.**

Move the current private `MenuKeyItem` shape into the internal registry file. Use an ordered signal-backed collection; duplicate instances are ignored and mutations publish a new array. Replace `MlvMenu`'s `contentChildren(MlvMenuItem)` source with the registry signal, and register/unregister `MlvMenuItem` through `DestroyRef`. Preserve active-item restoration, disabled skipping, type-ahead, and roving-tabindex logic. Register `MlvMenuTrigger` only when it has `MENUBAR_TOKEN`; make `MlvMenubar` consume the top-level registry so generated rows can participate later.

- [ ] **Step 4: Run `yarn nx test core-menu`; expected PASS** for all current projected behavior.

- [ ] **Step 5: Commit.**

```bash
git add libs/core/menu/src/lib/menu/menu-item-registry.ts libs/core/menu/src/lib/menu/menubar-item-registry.ts libs/core/menu/src/lib/menu/menu-item-registry.spec.ts libs/core/menu/src/lib/menu/menu.ts libs/core/menu/src/lib/menu/menu-item.ts libs/core/menu/src/lib/menu/menu-trigger.ts libs/core/menu/src/lib/menu/menubar.ts
git commit -m "refactor(menu): register projected and generated items"
```

### Task 3: Extract the shared overlay/submenu controller

**Files:** Create `menu-overlay-controller.ts` and `menu-overlay-controller.spec.ts`; modify `menu-trigger.ts`.

**Interfaces:** Internal `MlvMenuOverlayController` exposes `isOpen`, `open`, `close`, `toggle`, `openWithFirstItemFocused`, `openWithLastItemFocused`, `onMouseEnter`, `onMouseLeave`, and `destroy`. Its config supplies `getMenu(): MlvMenu`, trigger origin, `ViewContainerRef`, parent menu, menubar, submenu/menubar flags, and `isDisabled()`.

- [ ] **Step 1: Write failing characterization tests** for disabled/already-open no-op, close lifecycle, submenu pointer re-entry canceling delayed close, and menubar open/close notification.

- [ ] **Step 2: Run `yarn nx test core-menu`; expected compile failure** because the controller is absent.

- [ ] **Step 3: Extract the current private overlay methods** (`_openOverlay`, `_closeOverlay`, focus restore, triangle tracking, timers, and subscription cleanup) without changing behavior. Preserve:

```ts
const positions = config.isSubmenu ? SUBMENU_POSITIONS : MENU_POSITIONS;
const hasBackdrop = !config.isSubmenu && !config.isMenubarChild;
```

Keep popup registration, `MlvPopupService` callbacks, focus restoration, the 150 ms grace timer, triangle aim behavior, and menubar notification. Make `MlvMenuTrigger` a façade that retains its public inputs/outputs/host bindings and mirrors controller state.

- [ ] **Step 4: Run `yarn nx test core-menu`; expected PASS** with no projected trigger regressions.

- [ ] **Step 5: Commit.**

```bash
git add libs/core/menu/src/lib/menu/menu-overlay-controller.ts libs/core/menu/src/lib/menu/menu-overlay-controller.spec.ts libs/core/menu/src/lib/menu/menu-trigger.ts
git commit -m "refactor(menu): share submenu overlay controller"
```

### Task 4: Render recursive data rows and automatic submenus

**Files:** Create `menu-data-item.ts`, `menu-data-renderer.ts`, `menu-data-renderer.scss`, and `menu-data.spec.ts`; modify `menu-item.ts` and `menu.types.ts`.

**Interfaces:** Internal `MlvMenuDataItemContext` exposes `hasChildren()`, `loading()`, `isOpen()`, `open`, `close`, `toggle`, first/last-focus open methods, and mouseenter/mouseleave delegation. `MlvMenuDataRenderer<TItem>` accepts `items`, `itemDef`, `mode: 'menu' | 'menubar'`, `parentMenu`, and `menubar`.

- [ ] **Step 1: Write failing desired-API tests** using:

```html
<mlv-menu [dataSource]="items">
  <mlv-list-item mlvMenuItem *mlvMenuItemDef="let item">
    {{ item.label }}
  </mlv-list-item>
</mlv-menu>
```

Assert array rows, typed `$implicit`, default label fallback, disabled semantics, automatic `aria-haspopup="menu"`, and no required `[mlvMenuTrigger]`. With a child `Subject`, assert mouseenter/ArrowRight opens a submenu, `mlv-loader` appears before the first emission with its i18n aria label, and the child row replaces it after `next()`.

- [ ] **Step 2: Run `yarn nx test core-menu`; expected FAIL** because the data branch/context is absent.

- [ ] **Step 3: Implement `MlvMenuDataItem` and renderer.**

Create one lazy child `MlvMenuChildrenDataSource` per item with children, render a recursive child `mlv-menu` with the same definition, and create an `NgTemplateOutlet` injector providing `MENU_TOKEN`, the parent menu registry, and `MENUBAR_TOKEN` as null or the root menubar. Use:

```html
<ng-container
  [ngTemplateOutlet]="itemDef() ?? _defaultItemDef"
  [ngTemplateOutletContext]="context()"
  [ngTemplateOutletInjector]="rowInjector()"
/>
```

The default definition is `mlv-list-item[mlvMenuItem]` with `item.label`. Extend `MlvMenuItem` only for the private data context: add submenu aria state, delegate pointer/ArrowRight events, call `ensureLoaded()` before opening, and use the shared controller with the row host as origin. Register generated rows through the menu registry.

- [ ] **Step 4: Run `yarn nx test core-menu`; expected PASS** for data rows, templates, disabled state, lazy loading, loader i18n, and projected behavior.

- [ ] **Step 5: Commit.**

```bash
git add libs/core/menu/src/lib/menu/menu-data-item.ts libs/core/menu/src/lib/menu/menu-data-renderer.ts libs/core/menu/src/lib/menu/menu-data-renderer.scss libs/core/menu/src/lib/menu/menu-data.spec.ts libs/core/menu/src/lib/menu/menu-item.ts libs/core/menu/src/lib/menu/menu.types.ts
git commit -m "feat(menu): render lazy data-driven submenus"
```

### Task 5: Integrate `dataSource` into `MlvMenu`

**Files:** Modify `menu.ts`, `menu-data-renderer.ts`, `menu.scss`, and `menu-data.spec.ts`.

**Interfaces:** `MlvMenu<TItem extends MlvMenuItemData<unknown> = MlvMenuItemData<unknown>>` exposes `dataSource: MlvMenuDataSource<TItem> | undefined`; it supplies the queried item definition and adapter items/loading signals to the renderer.

- [ ] **Step 1: Write failing tests** for projection→array switching, array replacement, one-time remote connection, clearing back to projection, active-item removal fallback, and source loading.

- [ ] **Step 2: Run `yarn nx test core-menu`; expected FAIL** because `MlvMenu` has no data input/branch.

- [ ] **Step 3: Add an exclusive panel branch.**

In data mode render `MlvMenuDataRenderer` with `mode="menu"` and the parent menu; while the adapter reports loading, render `<mlv-loader variant="circle" [indeterminate]="true" size="20" />`. In projection mode retain `<ng-content />`. Preserve panel role/id/label/keydown/popup behavior. Do not pass `ariaLabel`; `MlvLoader` must resolve `MLV_LOADER_I18N`. Cache source connections and pass the menu registry through the renderer injector.

- [ ] **Step 4: Run `yarn nx test core-menu` and `yarn nx lint core-menu`; expected PASS.**

- [ ] **Step 5: Commit.**

```bash
git add libs/core/menu/src/lib/menu/menu.ts libs/core/menu/src/lib/menu/menu-data-renderer.ts libs/core/menu/src/lib/menu/menu.scss libs/core/menu/src/lib/menu/menu-data.spec.ts
git commit -m "feat(menu): add reactive menu data-source mode"
```

### Task 6: Add data-driven menubar items and root dividers

**Files:** Modify `menubar.ts`, `menubar.types.ts`, `menu-data-renderer.ts`, `menu-data-item.ts`, and `menubar.scss`; create `menubar-data.spec.ts`.

**Interfaces:** `MlvMenubar<TItem extends MlvMenuItemData<unknown> = MlvMenuItemData<unknown>>` exposes `dataSource: MlvMenubarEntry<TItem>[] | MlvDataSource<MlvMenubarEntry<TItem>> | undefined`. Renderer `mode="menubar"` emits no registry item for dividers.

- [ ] **Step 1: Write failing tests** with two data items, one divider, and lazy child streams. Assert separator role/orientation/no tabindex, divider exclusion from Home/End/type-ahead/ArrowLeft/ArrowRight, generated root roving tabindex, opening keys, sibling open-follow, and focus restoration. Add projected `<mlv-divider orientation="vertical" />` coverage.

- [ ] **Step 2: Run `yarn nx test core-menu`; expected FAIL** because menubar only renders projected content.

- [ ] **Step 3: Implement the data branch.**

Mirror `MlvMenu` source selection. In data mode render the renderer with `mode="menubar"` and the menubar registry; otherwise render projected content. Root data rows set `isMenubarChild === true`, use the shared controller with `hasBackdrop === false`, notify `MlvMenubarAccessor`, and implement `MlvMenubarItem`. Nested injectors set `MENUBAR_TOKEN` to null. Render dividers as:

```html
<span
  class="mlv-menubar__divider"
  role="separator"
  aria-orientation="vertical"
></span>
```

Never assign a divider tabindex or register it.

- [ ] **Step 4: Run `yarn nx test core-menu`; expected PASS** for data roots, both divider forms, lazy child menus, and projected behavior.

- [ ] **Step 5: Commit.**

```bash
git add libs/core/menu/src/lib/menu/menubar.ts libs/core/menu/src/lib/menu/menubar.types.ts libs/core/menu/src/lib/menu/menu-data-renderer.ts libs/core/menu/src/lib/menu/menu-data-item.ts libs/core/menu/src/lib/menu/menubar.scss libs/core/menu/src/lib/menu/menubar-data.spec.ts
git commit -m "feat(menubar): support data items and root dividers"
```

### Task 7: Style indicators and document the feature

**Files:** Modify `menu.scss`, `menubar.scss`, `menu-data.spec.ts`, `menubar-data.spec.ts`, `libs/core/menu/CLAUDE.md`, and `apps/docs/src/app/pages/menu/index.ts`; create docs examples `6/index.ts`, `6/index.mdx`, `7/index.ts`, and `7/index.mdx`.

- [ ] **Step 1: Add failing style/accessibility assertions** for the submenu state selector, menu-owned decorative indicator, row-only focus target, vertical divider, and no `MlvListItem` change.

- [ ] **Step 2: Run `yarn nx test core-menu`; expected FAIL** until selectors/documented examples are wired.

- [ ] **Step 3: Implement styles and docs.**

Target `.mlv-menu__panel [mlvMenuItem][aria-haspopup='menu'] .mlv-list-item__surface::after`, with a decorative chevron using `display: inline-flex`, `flex: 0 0 auto`, `width`/`height: var(--form-ctrl-icon-size, 1.25rem)`, tertiary text color, and existing transition tokens. Add root-only `.mlv-menubar__divider` styling with existing border/stroke tokens. Add the two examples, update the menu page from five to seven examples, and document the exact `T[] | MlvDataSource<T>`, typed template, observable child collection, loader i18n, automatic arrow, projection compatibility, and root-divider behavior in `CLAUDE.md`.

- [ ] **Step 4: Run `yarn nx test core-menu` and `yarn nx lint core-menu`; expected PASS.**

- [ ] **Step 5: Commit.**

```bash
git add libs/core/menu/src/lib/menu/menu.scss libs/core/menu/src/lib/menu/menubar.scss libs/core/menu/src/lib/menu/menu-data.spec.ts libs/core/menu/src/lib/menu/menubar-data.spec.ts libs/core/menu/CLAUDE.md apps/docs/src/app/pages/menu/index.ts apps/docs/src/app/pages/menu/examples/6/index.ts apps/docs/src/app/pages/menu/examples/6/index.mdx apps/docs/src/app/pages/menu/examples/7/index.ts apps/docs/src/app/pages/menu/examples/7/index.mdx
git commit -m "docs(menu): document reactive data sources"
```

### Task 8: Final verification

**Files:** Only a feature file with a concrete failure from Tasks 1–7.

- [ ] **Step 1: Run `yarn nx test core-menu` and `yarn nx lint core-menu`; expected both PASS.** The current `core-menu/project.json` exposes `test` and `lint`, not a separate `typecheck`; Angular test compilation provides the available TypeScript check.

- [ ] **Step 2: Inspect scope with `git diff HEAD~7 --stat`, `git diff HEAD~7 -- libs/core/menu apps/docs/src/app/pages/menu docs/superpowers`, and `git status --short`.** Confirm no `MlvListItem` file changed, only intended barrel exports were added, unrelated dirty changes remain unstaged, and docs changes are menu-specific.

- [ ] **Step 3: Review the accessibility/lifecycle evidence.** Confirm only actionable rows receive roving tabindex; submenu rows expose `aria-haspopup`, `aria-expanded`, and stable `aria-controls`; the arrow is decorative; `MlvLoader` gets its label through `MLV_LOADER_I18N`; child subscriptions start on first open, update, end on error, and unsubscribe on destruction; and projected hover intent, sibling switching, and focus restoration remain covered.
