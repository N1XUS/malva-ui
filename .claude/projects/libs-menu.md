---
# Library: menu

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Menu library (`@malva-ui/core/menu`) provides a dropdown action menu system with keyboard navigation, grouped items, separators, and nested submenu support. Submenus include triangle pointer tracking to prevent accidental closure when the user moves the cursor diagonally toward a submenu panel. The library also provides `mlv-menubar` — a horizontal File / Edit / View application menu bar that composes a row of `mlv-menu` dropdowns per the WAI-ARIA Menubar pattern.

The menu panel is rendered inside a `mlv-popup` overlay using `[mlvPopupContent]` — no DOM manipulation is needed. `MlvMenuTrigger` uses `MlvPopupService.open()` with the popup's template, which naturally includes the `mlv-list` panel and projected `mlv-menu-item` children.

## Public API

Exported from `libs/core/menu/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvMenu` | Component | Menu panel — `mlv-menu` |
| `MlvMenuItem` | Directive | Menu action item — `mlv-list-item[mlvMenuItem]` |
| `MlvMenuSeparator` | Component | Visual separator — `mlv-menu-separator` |
| `MlvMenuGroup` | Component | Group container — `mlv-menu-group` |
| `MlvMenuGroupLabel` | Directive | Group label slot — `[mlvMenuGroupLabel]` |
| `MlvMenuTrigger` | Directive | Opens a menu on click/hover — `[mlvMenuTrigger]` |
| `MlvMenuItemData` | Interface | Typed reactive menu item data with optional lazy `children` |
| `MlvMenuDataSource` | Type | Array or `MlvDataSource` accepted by reactive menus |
| `MlvMenuItemDef` | Directive | Typed projected row template — `[mlvMenuItemDef]` |
| `MlvMenuItemDefContext` | Interface | `$implicit`, `index`, `hasChildren`, and `loading` template context |
| `MlvMenubarDividerData` | Interface | Root-level data divider discriminator and stable id |
| `MlvMenubarEntry` | Type | Menubar item-or-divider entry type |
| `MlvMenubarDataSource` | Type | Array or `MlvDataSource` accepted by reactive menubars |
| `MlvMenubar` | Component | Horizontal application menu bar — `mlv-menubar` |
| `MlvMenuAccessor` | Interface | Parent menu accessor interface (via `MENU_TOKEN`) |
| `MENU_TOKEN` | Token | `InjectionToken<MlvMenuAccessor>` |
| `MlvMenubarItem` | Interface | Subset of `MlvMenuTrigger` a menubar coordinates (roving/open) |
| `MlvMenubarAccessor` | Interface | Parent menubar accessor interface (via `MENUBAR_TOKEN`) |
| `MlvMenubarMenuController` | Interface | Controller a menubar dropdown uses to cross to sibling menus |
| `MENUBAR_TOKEN` | Token | `InjectionToken<MlvMenubarAccessor>` |

---

## Components

### `MlvMenu`

**File:** `libs/core/menu/src/lib/menu/menu.ts`
**Styles:** `libs/core/menu/src/lib/menu/menu.scss`

- **Selector:** `mlv-menu`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`

#### Inputs

| Name         | Type                      | Default     | Description                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------ | ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`      | `string`                  | `''`        | `aria-label` for the menu panel                                                                                                                                                                                                                                                                                                                                                                                     |
| `mlvDensity` | `MlvDensity \| undefined` | `undefined` | Density for the panel's item rows. The panel is portaled to the CDK overlay container, outside the trigger's density cascade — forwarded to the inner `mlv-popup`, which stamps `mlv--{density}` on the detached panel; row padding responds via the `mlv-list-item` density ladder. Omitted → global `MlvDensityService`. Submenus are separate `mlv-menu` instances — set per menu when overriding a nested tree. |
| `dataSource`  | `MlvMenuDataSource<TItem> \| undefined` | `undefined` | Reactive item collection. Accepts an array or `MlvDataSource<TItem>`; when set, the menu renders the projected `[mlvMenuItemDef]` row template instead of projected menu rows. |

#### Outputs

| Name     | Description                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `closed` | Emits when the menu requests to be closed. **Intentionally a bare `closed` output with no `opened` model** — the menu is trigger-driven (opened imperatively via `MlvMenuTrigger`), so it is deliberately excluded from the `opened` two-way-model normalization applied to `mlv-drawer`/`mlv-popup` (the dialog's equivalent is `[(mlvDialog)]` on `ng-template[mlvDialog]`). |

#### Public methods

| Method                           | Description                                                                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `focusFirstItem()`               | Focuses the first non-disabled item (keyboard open ArrowDown)                                                                                                   |
| `focusLastItem()`                | Focuses the last non-disabled item (keyboard open ArrowUp)                                                                                                      |
| `close()`                        | Closes the menu and emits `closed`                                                                                                                              |
| `closeAll()`                     | Closes this menu and any ancestor menus                                                                                                                         |
| `registerParentMenu(parentMenu)` | Internal API used by submenu triggers to connect a submenu to its opener                                                                                        |
| `registerMenubarController(ctl)` | Internal API used by menubar-child triggers so the panel's top-level ArrowRight/ArrowLeft cross to sibling menubar menus (`null` for standalone menus/submenus) |

#### Internal signals

- `_isOpen: WritableSignal<boolean>` — managed by `MlvMenuTrigger`
- `_popup: Signal<MlvPopup>` — accessed by `MlvMenuTrigger` for overlay management

#### Reactive data mode

`dataSource` accepts either `MlvMenuItemData<T>[]` or an `MlvDataSource`
instance. Project one typed row definition with `[mlvMenuItemDef]`; the
template receives the item as `$implicit` plus `index`, `hasChildren`, and
`loading`:

```html
<mlv-menu [dataSource]="items">
  <mlv-list-item
    mlvMenuItem
    *mlvMenuItemDef="let item; let hasChildren = hasChildren"
  >
    {{ item.label }}
    @if (hasChildren) {
      <mlv-spacer />
      <svg mlvListItemSuffix lucideChevronRight [size]="16" />
    }
  </mlv-list-item>
</mlv-menu>
```

An item with `children: Observable<MlvMenuItemData<T>[]>` becomes a submenu
trigger automatically. The child stream is subscribed to on first open and
the submenu displays the localized loader while it is pending. A generated
submenu arrow is supplied by menu styling; an explicit suffix in a custom row
template takes precedence.

#### Key-manager lifecycle (roving tabindex)

The `FocusKeyManager` is reconciled from a constructor `effect()` reading `_items()`, and the reconciliation is deliberately **`untracked`**:

- `_syncTabIndices()` reads `FocusKeyManager.activeItem`, which CDK backs with a **signal** (`ListKeyManager._activeItem`). Reading it inside the effect's reactive context made the effect depend on the active item, so **every** arrow key re-ran the effect → new manager → `activeItemIndex` reset to `-1`. Symptoms: ArrowDown always returned to the first item, ArrowUp to the last, and no `role="menuitem"` ever held `tabindex="0"`. Home/End/type-ahead hid the bug because they are absolute moves. **`_items()` must stay the effect's only dependency.**
- `_syncKeyManager(items)` bails when the item set is member-identical to `_managedItems` (a snapshot), so a change-detection pass that re-runs the content query never rebuilds the manager.
- A real item change rebuilds and carries the active item over with `updateActiveItem()` (no focus steal). If the active item was removed/disabled, `mlvNearestEnabledItem()` picks the closest enabled item to its old index — the tab stop never falls back to "nothing".
- `_teardownKeyManager()` unsubscribes the `change` stream and calls `FocusKeyManager.destroy()`; also wired to `DestroyRef.onDestroy`.
- `_syncTabIndices()` invariant: **exactly one enabled item carries `tabindex="0"` while the panel is open.** That is the active item once navigation started; before then (pointer-opened panel, focus on the `role="menu"` list) the first enabled item is the tab stop. The key manager's index stays `-1` in that state, so the first ArrowDown still lands on the **first** item.
- CDK's `ListKeyManager.onKeydown` switches on `event.keyCode`, which jsdom leaves at `0` — specs must set it explicitly (`fireNavKey` helper in `menu.spec.ts` / `fireKey` in `menubar.spec.ts`).

---

### `MlvMenuItem`

**File:** `libs/core/menu/src/lib/menu/menu-item.ts`
**Selector:** `mlv-list-item[mlvMenuItem]`

Applied to `mlv-list-item` to give it menu-item semantics. Overrides `role="listitem"` → `role="menuitem"`, wires into the parent `FocusKeyManager`, and closes the parent menu stack on leaf activation. When the same row is an enabled `[mlvMenuTrigger]` with `[isSubmenuTrigger]="true"`, the trigger owns click/Enter/Space activation so opening the child menu does not select the row or dismiss its ancestor. A disabled submenu trigger falls back to the item's leaf `itemClick` and close-all behavior.

Users must import both `MlvListItem` (from `@malva-ui/core/list`) and `MlvMenuItem` (from `@malva-ui/core/menu`).

#### Inputs

| Name       | Type           | Default | Description                                  |
| ---------- | -------------- | ------- | -------------------------------------------- |
| `disabled` | `BooleanInput` | `false` | Disables the item; supports attribute syntax |

#### Outputs

| Name        | Description                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------- |
| `itemClick` | Emits when the item is activated (click or Enter/Space); parent menu stack closes automatically |

#### Public methods

| Method       | Description                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `focus()`    | Focuses the host element (CDK `FocusableOption`)                                                                                 |
| `getLabel()` | Returns the item's trimmed visible text; used by the parent `FocusKeyManager` type-ahead (`withTypeAhead()`) to match keystrokes |

---

### `MlvMenuSeparator`

**File:** `libs/core/menu/src/lib/menu/menu-separator.ts`
**Selector:** `mlv-menu-separator`

Renders a horizontal `<hr role="separator" />` between item groups.

---

### `MlvMenuGroup`

**File:** `libs/core/menu/src/lib/menu/menu-group.ts`
**Selector:** `mlv-menu-group`

Groups related menu items with `role="group"`. Use `[mlvMenuGroupLabel]` on a child element for an accessible label.

---

### `MlvMenubar`

**File:** `libs/core/menu/src/lib/menu/menubar.ts`
**Styles:** `libs/core/menu/src/lib/menu/menubar.scss`

- **Selector:** `mlv-menubar`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`

A horizontal File / Edit / View style application menu bar implementing the [WAI-ARIA Menubar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/). Wrap a row of `[mlvMenuTrigger]` elements; each opens a standard `mlv-menu` dropdown and the bar coordinates roving focus and open state across them. It discovers its top-level items via `contentChildren(MlvMenuTrigger)` and provides itself through `MENUBAR_TOKEN` so those triggers switch into menubar-child mode.

> **Declare the `mlv-menu` panels as siblings of the menubar** (outside its projected content). That way the bar's `contentChildren` query only sees the top-level triggers — never the items or submenu triggers inside the (sibling, overlay-rendered) dropdown panels.

#### Inputs

| Name    | Type     | Default | Description                                |
| ------- | -------- | ------- | ------------------------------------------ |
| `label` | `string` | `''`    | `aria-label` for the `role="menubar"` host |
| `dataSource` | `MlvMenubarEntry<TItem>[] \| MlvDataSource<MlvMenubarEntry<TItem>> \| undefined` | `undefined` | Reactive top-level items. Entries may be item data or `MlvMenubarDividerData`; dividers are visual root separators and are excluded from keyboard navigation. |

#### Host bindings

- `role="menubar"`, `aria-orientation="horizontal"`, `[attr.aria-label]`
- `(keydown)` — horizontal `FocusKeyManager` navigation (ArrowLeft/Right, Home/End, type-ahead) across top-level items; opening keys (Enter/Space/ArrowDown/ArrowUp) are left to the focused trigger.

#### Behavior (APG menubar)

- **Roving tabindex** — only the active top-level item has `tabindex="0"` (`FocusKeyManager` horizontal, wrap, Home/End, type-ahead; disabled items skipped).
- **Open** — `ArrowDown` / `Enter` / `Space` opens the focused item's menu with focus on its first item; `ArrowUp` opens with focus on the last item (handled by `MlvMenuTrigger`).
- **Open-follow** — while any dropdown is open, arrowing or **hovering** to another top-level item closes the current menu and opens the sibling. Hover-follow is only active _while a menu is already open_ (a cold hover does nothing).
- **In-menu crossing** — `ArrowRight` / `ArrowLeft` at the top level of an open dropdown crosses to the adjacent menubar menu (focusing its first item); a focused submenu-trigger item's own `ArrowRight` opens the submenu instead — **submenu wins** (it stops propagation before the panel's handler runs).
- **Escape** — closes the menu and restores focus to its top-level item (via `MlvMenuTrigger`'s focus-restore).

#### Reactive data mode

Menubars accept the same typed item definition as menus. Set `dataSource` to an
array or `MlvDataSource` and use `MlvMenubarDividerData` entries for root-level
vertical separators. Dividers render with `role="separator"` and
`aria-orientation="vertical"`; they never receive a tabindex or participate in
roving navigation. Lazy `children` streams create generated dropdown menus and
use the localized pending loader.

#### `MlvMenubarAccessor` methods (used by child triggers via `MENUBAR_TOKEN`)

| Method                            | Description                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `hostElement`                     | Menubar host element — passed as the backdrop-less click-outside exclusion       |
| `notifyItemOpened(item)`          | Records the open item; closes any previously-open sibling; syncs roving tabindex |
| `notifyItemClosed(item)`          | Clears the open-item record                                                      |
| `onItemPointerEnter(item)`        | Hover-follow (opens the hovered item only while another menu is already open)    |
| `hasOpenMenu()`                   | Whether any dropdown in the bar is open                                          |
| `openAdjacentItemMenu(from, dir)` | Crosses to the next/previous item's menu with focus on its first item            |

---

## Directives

### `MlvMenuTrigger`

**File:** `libs/core/menu/src/lib/menu/menu-trigger.ts`
**Selector:** `[mlvMenuTrigger]`

#### Inputs

| Name                  | Type                 | Default | Description                                        |
| --------------------- | -------------------- | ------- | -------------------------------------------------- |
| `mlvMenuTrigger`      | `MlvMenu` (required) | —       | The menu panel to open                             |
| `isSubmenuTrigger`    | `BooleanInput`       | `false` | Activates submenu mode (hover + triangle tracking) |
| `menuTriggerDisabled` | `BooleanInput`       | `false` | Disables the trigger                               |

#### Outputs

| Name         | Description                      |
| ------------ | -------------------------------- |
| `menuOpened` | Emits when the menu panel opens  |
| `menuClosed` | Emits when the menu panel closes |

#### Host bindings

- `aria-haspopup="menu"`
- `[attr.aria-expanded]` — bound to `_isOpen()`
- `[attr.aria-controls]` — panel id while open
- `[attr.role]` — `"menuitem"` when the trigger is a **menubar child**, otherwise `null` (standalone/submenu triggers keep their native/`MlvMenuItem` role)
- `[attr.tabindex]` — roving tabindex (`_tabIndex()`) when a menubar child, otherwise `null`
- `(click)` — toggles the menu (non-submenu mode)
- `(mouseenter)` — menubar child: delegates to the bar's hover-follow; submenu trigger: opens the menu
- `(mouseleave)` — schedules close with triangle check (submenu mode only)
- `(keydown)` — Enter/Space, ArrowDown/Up, ArrowRight (submenu), Escape keyboard support

#### Methods

| Method     | Description      |
| ---------- | ---------------- |
| `open()`   | Opens the menu   |
| `close()`  | Closes the menu  |
| `toggle()` | Toggles the menu |

#### Menubar-child mode

When a `[mlvMenuTrigger]` is a **direct child of a `mlv-menubar`** it can inject `MENUBAR_TOKEN` and switches into menubar-child mode: it exposes `role="menuitem"` + a roving tabindex, opens its dropdown **without a backdrop** (so sibling top-level items stay hoverable/clickable — the menubar host is passed as `dismissExcludeElements`), reports open/close via `MlvMenubarAccessor.notifyItemOpened/Closed`, and registers a `MlvMenubarMenuController` on the menu so the panel's top-level ArrowRight/ArrowLeft cross to sibling menus. It additionally implements the `MlvMenubarItem` shape (`disabledBoolean`, `_tabIndex`, `focus()`, `getLabel()`, `isMenuOpen()`, `openMenu()`, `closeMenu()`, `openMenuWithFirstItemFocused()`, `openMenuWithLastItemFocused()`). **Standalone and submenu triggers are completely unaffected** — they never inject the token, so role/tabindex stay `null` and backdrop/behavior are unchanged.

---

## Generated submenu overlay origin

`MlvMenuDataItem` anchors a generated submenu to the row that `ngTemplateOutlet`
stamps, which does not exist yet when the overlay controller is constructed. The
origin is therefore a real `ElementRef` instance whose `nativeElement` is
redefined as a lazy getter, **not** a plain object with the same shape.

The instance matters: CDK's `FlexibleConnectedPositionStrategy._getOriginRect()`
only calls `getBoundingClientRect()` when the origin passes
`instanceof ElementRef` (or `instanceof Element`). Anything else is read as an
`{x, y}` point — `undefined` coordinates propagate to `NaN`, the pane's `top`
and `left` are dropped as invalid, and every generated submenu renders at the
viewport's top-left corner instead of beside its row. Covered by
"anchors a generated submenu to the rendered row through a real ElementRef
origin" in `menu-data.spec.ts`.

---

## Submenu Hover Intent

When `isSubmenuTrigger="true"`, the directive installs a document-level `mousemove`
listener. Intent is resolved by **what the pointer is over**, with geometry used
only for the ambiguous space between the item and its panel:

| Pointer is over                  | Result                                                                                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| The trigger item itself          | Stays open, whatever the trajectory. Resting the cursor makes no horizontal progress, so a cone-only rule would close it.                            |
| A different row of the same menu | Closes. Unambiguous intent that no cone can express — the panel is tall, so from the far edge of the item the safe area covers most downward travel. |
| Anything in between              | The safe cone decides, backed by a 150 ms grace timer.                                                                                               |

The cone requires at least `MIN_HORIZONTAL_PROGRESS` (2px) of travel **toward**
the panel. Without it, `deltaX === 0` is not movement "away", so sliding straight
down the item column registered as aiming at the submenu and held it open over a
sibling row.

The grace timer — not the cone — is what tolerates a 1px wobble and the 8px
`SUBMENU_POSITIONS` gap between item and panel. Both re-entry points (the panel's
`mouseenter` and the trigger's) cancel it, so crossing that gap in either
direction is safe; the panel's `mouseleave` schedules rather than forces a close,
because on the way back to the parent item the cursor traverses the gap where
`relatedTarget` is the overlay container, never the trigger.

This prevents the submenu from closing when the user moves the cursor diagonally from the parent item toward the submenu — a common UX problem in nested menus.

The geometry calculation lives in the pure internal `submenu-aim.ts` module;
the trigger directive owns event subscription and timer orchestration only.

---

## CSS Classes

| Class                              | Description                                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `.mlv-menu`                        | Host block                                                                                           |
| `.mlv-menu__panel`                 | Floating panel with `role="menu"`                                                                    |
| `.mlv-list-item` (in menu context) | Menu item — styled with compact padding and a small rounded hover/focus surface inside popup padding |
| `.mlv-menu-separator`              | Host block for separator                                                                             |
| `.mlv-menu-separator__line`        | The `<hr>` element                                                                                   |
| `.mlv-menu-group`                  | Host block for group                                                                                 |
| `.mlv-menu-group__label`           | Applied by `[mlvMenuGroupLabel]`                                                                     |

---

## Usage Examples

```html
<!-- Basic menu -->
<button [mlvMenuTrigger]="menu">Open</button>
<mlv-menu #menu>
  <mlv-list-item mlvMenuItem (itemClick)="onEdit()">Edit</mlv-list-item>
  <mlv-menu-separator />
  <mlv-list-item mlvMenuItem (itemClick)="onDelete()">Delete</mlv-list-item>
</mlv-menu>

<!-- With icon prefix -->
<mlv-list-item mlvMenuItem (itemClick)="onEdit()">
  <svg mlvListItemPrefix lucideEdit [size]="14" />
  Edit
</mlv-list-item>

<!-- With chevron suffix (submenu indicator) -->
<mlv-list-item mlvMenuItem [mlvMenuTrigger]="subMenu" [isSubmenuTrigger]="true">
  More options
  <svg mlvListItemSuffix lucideChevronRight [size]="12" />
</mlv-list-item>

<!-- Grouped menu -->
<mlv-menu #menu>
  <mlv-menu-group>
    <span mlvMenuGroupLabel>File</span>
    <mlv-list-item mlvMenuItem>New</mlv-list-item>
    <mlv-list-item mlvMenuItem>Open</mlv-list-item>
  </mlv-menu-group>
</mlv-menu>
```

**Required imports** (consumer component):

```ts
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import { MlvListItem } from '@malva-ui/core/list'; // always needed for mlv-list-item
```

---

## File Structure

```
libs/core/menu/src/
  index.ts                                  — public API barrel
  lib/
    menu/
      menu.ts                     — MlvMenu (mlv-menu)
      menu.scss                   — BEM styles
      menu-item.ts                — MlvMenuItem (mlv-list-item[mlvMenuItem])
      menu-separator.ts           — MlvMenuSeparator (mlv-menu-separator)
      menu-group.ts               — MlvMenuGroup (mlv-menu-group)
      menu-group-label.ts         — MlvMenuGroupLabel ([mlvMenuGroupLabel])
      menu-trigger.ts             — MlvMenuTrigger ([mlvMenuTrigger])
      menubar.ts                  — MlvMenubar (mlv-menubar)
      menubar.scss                — BEM styles
      menubar.types.ts                      — MlvMenubarItem, MlvMenubarAccessor, MlvMenubarMenuController, MENUBAR_TOKEN
      menu.types.ts                         — MlvMenuAccessor, MENU_TOKEN
      menu.spec.ts                — MlvMenu / item / trigger / separator unit tests
      menubar.spec.ts             — MlvMenubar unit tests
```

---

## Dependencies

| Package                 | Version   | Role                                     |
| ----------------------- | --------- | ---------------------------------------- |
| `@angular/core`         | `^22.0.0` | Signals, DI, component                   |
| `@angular/cdk/a11y`     | `^22.0.0` | `FocusKeyManager`, `FocusableOption`     |
| `@angular/cdk/overlay`  | `^22.0.0` | CDK overlay positioning                  |
| `@angular/cdk/portal`   | `^22.0.0` | `TemplatePortal` (via `MlvPopupService`) |
| `@angular/cdk/coercion` | `^22.0.0` | `BooleanInput`, `coerceBooleanProperty`  |

---

## Accessibility notes (updated)

- The menu panel is wrapped by `mlv-popup` which no longer applies `role="dialog"`/`aria-modal`/focus-trap; the `mlv-list` inside owns `role="menu"`.
- `MlvMenu.panelId` — stable id on the panel (now `mlvNextId('mlv-menu-panel')` from `@malva-ui/cdk/utils`, replacing a hand-rolled module counter); `MlvMenuTrigger` wires `aria-controls` (trigger → panel) while open, alongside `aria-haspopup="menu"`.
- `MlvMenuItem._tabIndex` is now a `signal` (OnPush-safe roving tabindex).
- Focus is returned to the trigger on **all** close reasons (item activation, in-panel Escape, Tab, ArrowLeft on a submenu, backdrop) via `MlvMenuTrigger`; Tab-close calls `preventDefault()`.
- Submenu keyboard: `ArrowRight` on a submenu trigger opens the submenu and focuses its first item; `ArrowLeft` inside a submenu closes it and returns focus to the parent item.
- `MlvMenuGroup` names its `role="group"` via `aria-labelledby` pointing at the generated id of the projected `[mlvMenuGroupLabel]` (that id is now `mlvNextId('mlv-menu-group-label')` from `@malva-ui/cdk/utils`, replacing a hand-rolled counter).
- **Type-ahead** (added with `@angular/aria` migration Task 2.6): typing a printable letter while the menu is open moves focus to the first item whose visible text starts with the typed string (200 ms debounce, wraps). Implemented via CDK `FocusKeyManager.withTypeAhead()`; `MlvMenuItem.getLabel()` returns the item's trimmed `textContent`. Disabled items are skipped. The key manager's `change` stream keeps the roving tabindex in sync when type-ahead moves the active item asynchronously.
- **Roving tabindex** — exactly one enabled `role="menuitem"` holds `tabindex="0"` while the panel is open, and it follows ArrowUp/ArrowDown/Home/End/type-ahead. See "Key-manager lifecycle" under `MlvMenu` for the rebuild rules that keep this true (a rebuilt `FocusKeyManager` would otherwise reset the active index to `-1`).

## `@angular/aria` migration status (Task 2.6) — deviation

**The `@angular/aria` `Menu`/`MenuItem`/`MenuTrigger`/`MenuContent` (`ngMenu*`) primitives were evaluated and NOT adopted; `mlv-menu` keeps its custom `FocusKeyManager` + CDK-overlay implementation.** The aria `Menu` pattern is architecturally incompatible with this component's design and adopting it would break the public API. Precise reason:

- The aria `Menu` directive requires **one single element** to simultaneously (a) be the DI parent that provides `MENU_COMPONENT` to its items — `ngMenuItem` resolves its parent via `inject(MENU_COMPONENT)`; (b) be the rendered, focusable DOM element that receives the `keydown`/`focusin`/`focusout`/`mouseover` host listeners aria binds; and (c) observe its own DOM children for item ordering (`_collection.startObserving(this.element)`).
- `mlv-menu` deliberately splits these: menu items are **consumer-content-projected** into `<mlv-menu>` (so their DI parent is the `<mlv-menu>` host, where `MENU_TOKEN` lives), while the rendered panel is a **detached CDK-overlay `TemplatePortal`** (`mlv-list`) at document root (where focus, keyboard and item DOM live), and the `<mlv-menu>` host element itself stays empty/detached.
- Placing `ngMenu` on the `<mlv-menu>` host satisfies DI but its keyboard/focus/order handling lands on the empty detached host — dead. Placing `ngMenu` on the internal overlay `mlv-list` satisfies keyboard/focus/DOM but projected items cannot `inject(MENU_COMPONENT)` across the `<ng-content>` boundary — DI dead. No single element satisfies all three without either abandoning CDK-overlay positioning (the plan requires keeping it) or replacing consumer content-projection with a data-driven `items` input (a public API break).
- Contrast with the completed list migration (Task 2.1): there `Listbox`/`Option` sit on the consumer's own `<mlv-list>`/`<mlv-list-item>` elements in the same lexical scope, rendered in place — DI, DOM and keyboard all coincide.

Per the plan's fallback clause and risk register ("if a pattern doesn't fit, keep the manual implementation"), only the aria-parity **type-ahead** behavior was added (via CDK `FocusKeyManager`, since aria's own type-ahead cannot be used here). Roving focus, roles, submenu hover/triangle tracking, ArrowLeft/ArrowRight submenu handling, and focus-restore-to-trigger all remain the existing custom implementation.

## `mlv-menubar` — `@angular/aria` `ngMenuBar` evaluation (NOT adopted)

`@angular/aria` exports `MenuBar` (`[ngMenuBar]`) alongside `Menu`/`MenuItem`/`MenuTrigger`. It was evaluated for `mlv-menubar` and **not adopted**, for the same architectural reason `ngMenu` was rejected, propagated through the top-level dropdowns:

- `ngMenuBar` is a `List`-based pattern whose top-level items must be `ngMenuItem` (required `value`), and each item's `submenu` input must reference an **`ngMenu`** that the menubar pattern opens/closes/focuses. `mlv-menubar`'s dropdowns are existing `mlv-menu` panels — **detached CDK-overlay `TemplatePortal`s with consumer-content-projected items** — not `ngMenu` directives. Wiring `ngMenuBar`'s item→submenu coordination to a `mlv-menu` overlay is exactly the DI-parent + focus-host + DOM-order-observer mismatch documented above for `ngMenu`, so the whole open/close/focus chain would land on empty detached hosts.
- Adopting `ngMenuBar` would therefore force either (a) replacing every `mlv-menu` panel with an `ngMenu` (dropping CDK-overlay positioning + the content-projection public API — a breaking change), or (b) keeping `mlv-menu` panels and re-implementing the coordination anyway, at which point `ngMenuBar` adds nothing.

So `mlv-menubar` keeps a custom implementation consistent with `mlv-menu`: a CDK `FocusKeyManager` (horizontal, wrap, Home/End, type-ahead) for the roving tabindex over the top-level `MlvMenuTrigger` children, and explicit open-follow / in-menu-crossing coordination via the small `MlvMenubarAccessor` / `MlvMenubarMenuController` contracts. This reuses `mlv-menu` + `MlvMenuTrigger` unchanged for the dropdown panels — the sanctioned "keep the manual implementation" fallback.
