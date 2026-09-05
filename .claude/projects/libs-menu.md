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
| `MlvContextMenuTrigger` | Directive | Opens a menu at the pointer on right-click — `[mlvContextMenuTrigger]` |
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

| Name         | Type                                    | Default     | Description                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------ | --------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`      | `string`                                | `''`        | `aria-label` for the menu panel                                                                                                                                                                                                                                                                                                                                                                                     |
| `mlvDensity` | `MlvDensity \| undefined`               | `undefined` | Density for the panel's item rows. The panel is portaled to the CDK overlay container, outside the trigger's density cascade — forwarded to the inner `mlv-popup`, which stamps `mlv--{density}` on the detached panel; row padding responds via the `mlv-list-item` density ladder. Omitted → global `MlvDensityService`. Submenus are separate `mlv-menu` instances — set per menu when overriding a nested tree. |
| `dataSource` | `MlvMenuDataSource<TItem> \| undefined` | `undefined` | Reactive item collection. Accepts an array or `MlvDataSource<TItem>`; when set, the menu renders the projected `[mlvMenuItemDef]` row template instead of projected menu rows.                                                                                                                                                                                                                                      |

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
  <mlv-list-item mlvMenuItem *mlvMenuItemDef="let item; let hasChildren = hasChildren">
    {{ item.label }} @if (hasChildren) {
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

| Name         | Type                                                                             | Default     | Description                                                                                                                                                   |
| ------------ | -------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`      | `string`                                                                         | `''`        | `aria-label` for the `role="menubar"` host                                                                                                                    |
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

### `MlvContextMenuTrigger`

**File:** `libs/core/menu/src/lib/menu/context-menu-trigger.ts`
**Selector:** `[mlvContextMenuTrigger]`

Opens an ordinary `mlv-menu` at the pointer on right-click. It replaces **only the trigger half** of `MlvMenuTrigger` — `contextmenu` instead of `click`, a cursor point instead of the host's bounding box — and reuses `MlvMenuOverlayController` verbatim, so the panel, items, `role="menu"`/`role="menuitem"`, keyboard model, Escape/Tab close, click-outside close, submenus, disabled items, separators and router-link items are the existing `mlv-menu` behaviour, unchanged.

#### Inputs

| Name                    | Type                          | Default | Description                                                              |
| ----------------------- | ----------------------------- | ------- | ------------------------------------------------------------------------ |
| `mlvContextMenuTrigger` | `MlvMenuOverlayTarget` (req.) | —       | The `mlv-menu` panel to open at the pointer                              |
| `contextMenuDisabled`   | `BooleanInput`                | `false` | Opens nothing and leaves the **native** browser menu alone               |
| `global`                | `BooleanInput`                | `false` | Listens on the document instead of the host — right-click anywhere opens |

#### Outputs

| Name         | Description                      |
| ------------ | -------------------------------- |
| `menuOpened` | Emits when the menu panel opens  |
| `menuClosed` | Emits when the menu panel closes |

#### Methods

| Method               | Description                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `openAt(x, y)`       | Opens at a viewport point; **moves** an already-open panel instead of stacking a second one |
| `openFromKeyboard()` | Opens anchored to the host element with the first item focused                              |
| `close()`            | Closes the panel                                                                            |

#### Host bindings

- `aria-haspopup="menu"` — always. It is a global attribute, allowed on any element.
- `[attr.aria-expanded]` / `[attr.aria-controls]` — **only when the host carries a `role` attribute.** Neither is allowed on `role="generic"`, which is what the bare `<div>` in every documented usage resolves to; axe's `aria-allowed-attr` rule fails such a host, and the project requires every component to pass axe. `MlvMenuTrigger` emits them unconditionally because its own documented hosts (`<button>`, `mlv-list-item[role="menuitem"]`) always allow them. The host's role is read once at construction — it is part of how the consumer wrote the element, not runtime state.
- `(contextmenu)` — skipped while `global` is set, because the document listener already sees the same event as it bubbles; handling both would open twice per right-click.

#### No backdrop

Context menus open with `hasBackdrop: false` (via the controller's new `getHasBackdrop` override), unlike every other `mlv-menu`. This is load-bearing, not a style choice: the CDK backdrop is `inset: 0` with `pointer-events: auto`, so it becomes the hit-test target for the entire viewport. With it, a **second right-click never reaches the trigger** — nothing calls `preventDefault()` and the native browser menu opens on top of the panel — and the backdrop does not even close the panel in exchange, because a right-click fires no `click` and so never triggers `backdropClick()`. `MlvPopupService` keeps click-outside dismissal working without a backdrop through its deferred document `click` listener.

#### Positioning

The panel is anchored to a `{ x, y }` point via `MlvPopupOpenConfig.positionOrigin`, using `CONTEXT_MENU_POSITIONS` — a module-local, **unexported** const in `context-menu-trigger.ts`. It is hand-written rather than resolved from `POPUP_POSITION_MAP` because every entry in that map carries the 8 px trigger gap, which is right beside an element and wrong at a pointer; all four offsets are zero. It lives here rather than beside `MENU_POSITIONS` / `SUBMENU_POSITIONS` in `@malva-ui/core/popup` precisely because it is _not_ derived from the popup position map and has exactly one consumer.

The **host element** stays `origin`, so RTL scoping and focus restoration keep working — a point has no `[dir]` ancestry of its own.

A second right-click while open calls `MlvPopupHandle.setPositionOrigin` through `MlvMenuOverlayController.updatePositionOrigin()`, moving the panel rather than replaying the leave/enter animations. Close-then-reopen is not merely uglier, it does not work: `close()` only _starts_ the leave animation and leaves `isOpen` `true` until it finishes, so the immediately following `open()` bails and the panel just disappears.

`updatePositionOrigin()` carries the position list along with the origin, because the two change kind together — a panel re-anchored from its host element (element-anchored `MENU_POSITIONS`, `offsetY: ±8`) to a cursor must also drop that gap, or it hangs 8px below the pointer.

#### Keyboard access (WCAG 2.1.1)

Right-click is pointer-only, but browsers dispatch the **same `contextmenu` event** for the ContextMenu key and Shift+F10, so keyboard users reach the menu through this directive — **provided the host is focusable**. Put the directive on a natively focusable element or give it a `tabindex`.

A keyboard-initiated open anchors to the **host element** (element-anchored positions) and moves focus to the first item; anchoring to the coordinates such an event reports would drop the panel in the viewport corner. Pressing the key while the panel is already open re-anchors it to the host and moves focus in, rather than closing it.

**`event.button === 2` is not how the two are told apart**, despite looking like the obvious test: macOS dispatches `contextmenu` for Ctrl+click with `button: 0`, and Android does the same for a touch long-press, so a button check sends two ordinary pointer gestures down the keyboard path — anchoring to the element instead of the finger and stealing focus. What actually separates them is the input device. Firefox reports it outright as `MouseEvent.mozInputSource === 6` (`MOZ_SOURCE_KEYBOARD`); elsewhere a keyboard-synthesised event has no click count and no cursor to report, so `detail === 0 && clientX === 0 && clientY === 0` identifies it. The one false positive is a genuine right-click on the exact top-left pixel, which degrades to a usable element-anchored menu.

A visible affordance — an ellipsis button with the regular `[mlvMenuTrigger]` on the same `mlv-menu` — remains the more discoverable pattern and is recommended whenever the context menu holds actions available nowhere else.

#### `global` mode

The `contextmenu` listener moves to the document, so a right-click anywhere opens the menu. Three cases are handed back to the browser:

| Right-click on…                                                | Why it is skipped                                                                                                                                                                                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anything inside `.cdk-overlay-container`                       | The menu's own panel is portaled to `<body>`, outside the host's subtree — a right-click on a menu item must not re-open the menu on top of itself.                                                                                                |
| `input`, `textarea`, `select`, `[contenteditable]`             | Spell-check, paste and undo beat an application menu. Without this, a single global trigger removes the native menu from every text field on the page.                                                                                             |
| An event a nearer trigger already handled (`defaultPrevented`) | The event still bubbles to the document after a host handler runs — the propagation path is fixed at dispatch — so a **targeted trigger nested inside a global one** would otherwise open both panels, stacked at the same point, per right-click. |

Direction and focus restoration still come from the host element, so keep the directive on an element inside the region it serves, and give that element a `tabindex` if focus should land somewhere sensible on close (`_restoreFocusToTrigger()` calls `.focus()`, a no-op on a `<div>` without one, so focus otherwise falls to `<body>`).

With more than one _global_ trigger on a page every one of them responds to the same right-click; scope them with `contextMenuDisabled` rather than relying on registration order. Nesting a targeted trigger inside a global one is the supported composition — the nearest one wins.

#### Not a menubar item

The controller config's `getMenubarItem` throws. A context-menu trigger is never a menubar child (`isMenubarChild: false`, `menubar: null`), so the only paths that call it are unreachable; throwing surfaces a wiring mistake instead of silently handing the menubar an object that is not a `MlvMenubarItem`.

```html
<!-- Targeted -->
<div [mlvContextMenuTrigger]="rowMenu" tabindex="0">Right-click this row</div>

<!-- Global -->
<div [mlvContextMenuTrigger]="pageMenu" global tabindex="0"></div>

<mlv-menu #rowMenu>
  <mlv-list-item mlvMenuItem (itemClick)="rename()">Rename</mlv-list-item>
  <mlv-menu-separator />
  <mlv-list-item mlvMenuItem (itemClick)="remove()">Delete</mlv-list-item>
</mlv-menu>
```

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

## Item registry ordering

`MlvMenuItemRegistryStore` / `MlvMenubarItemRegistryStore` (`menu-item-registry.ts`,
`menubar-item-registry.ts`) hold the ordered item list the `FocusKeyManager`
navigates. Order is reconciled from two directions: `resync()` sorts the held
items into DOM order, and `syncOrder(items)` re-seats them against the order a
`contentChildren` query reports.

### `syncOrder` no-change guard

`syncOrder` runs from an `effect` over the projected item set (`menu.ts`,
`menubar.ts`) — on projection change, not per frame. Its general path filters the
incoming order down to registered items, filters the registry down to the ones
the query did not report, sorts that remainder into DOM order, and returns the
existing array when the rebuilt sequence matches. Once a projection settles, the
query keeps reporting the order the registry already holds, so every one of those
calls paid two `includes`-inside-`filter` scans (O(n x m)), a spread and a sort
only to conclude nothing moved.

That case is now detected up front in one pass — equal length **and**
element-wise `===` — and returns `currentItems` untouched. Returning the same
reference is what leaves the signal's version alone and suppresses a
notification, so the guard preserves identity, not just value.

Comparing length as well as elements is load-bearing. The rebuilt-sequence check
(`mlvMenuItemsMatchOrder`) is deliberately length-blind, so on its own it would
also accept an incoming array carrying a duplicate — whose filtered result is
_longer_ than the registry and therefore not a no-op. Guarding on the full
sequence keeps that input on the general path.

The guard fires on nearly every call. Counting real `syncOrder` invocations
across the menu/menubar integration suites gives 166 hits out of 169 calls
(98.2%) — the effect does re-run on a settled projection, so the no-change path
is the overwhelmingly common one, not an edge case.

Measured in jsdom on a settled projection, it saves a near-constant ~300-500 ns
per call: ~12% at 3 items, ~11% at 5, ~3% at 12-20. The relative gain shrinks
with size because the remaining cost is dominated by `_syncObservedContainer()`,
which re-resolves every item's container through `closest()` on each call
regardless of the guard — the larger remaining win in this file.

Covered by `menu-item-registry.spec.ts`, including a differential suite that
replays a table of incoming orders against a verbatim copy of the pre-change
body and asserts both value and reference-identity agreement.

### Order observation is browser-only

`MlvMenubarItemRegistryStore` watches the shared `<mlv-menubar>` container with a
`MutationObserver` so an item inserted or removed after registration still lands
in DOM order. `MutationObserver` is a browser global that Node does not define,
and the registry is reachable from server rendering — a data-driven menubar
registers its rows from an `effect`, by which point the row elements are already
attached to the bar and `_syncObservedContainer()` resolves a real container. On
a server that construction is a `ReferenceError`.

The observer is therefore gated behind `enableOrderObservation()`, which
`mlv-menubar` calls from **`afterNextRender`** — a hook that never runs on the
server. Until it is called, `_syncObservedContainer()` resolves no container and
constructs nothing; sorting still works, because the comparator is a plain
`compareDocumentPosition` that every server DOM implements. Server rendering
therefore emits DOM-ordered items and subscribes to no mutations, which is
correct for a tree that is rendered once and never mutated.

`mlvGetSharedMenubarContainer` narrows `closest()`'s result with a null check
rather than `instanceof HTMLElement`. `closest()` returns an element or `null`
and nothing else, so `instanceof` narrowed nothing the null check does not,
while carrying one real failure mode: `instanceof` is realm-bound, so a menubar
rendered into a same-origin iframe answers `false` against the parent frame's
constructor and its items would silently stop being observed.

**It was not hiding the SSR bug**, and the fix does not depend on it.
`@angular/platform-server` runs `Object.assign(globalThis, domino.impl)`, so
during a server render domino's `HTMLElement` _is_ the global one and the check
passes (`globalThis.HTMLElement === domino.impl.HTMLElement` is `true`). With
the gate reverted but `instanceof` left in place the SSR smoke suite still
fails on the same `MutationObserver` error. The gate in
`_syncObservedContainer` is the whole of that fix — do not go looking at the
remaining `instanceof Element` narrowings for an SSR cause they do not have.

### The sibling `MlvMenuItemRegistryStore` is not gated

`MlvMenuItemRegistryStore` (`menu-item-registry.ts`) is structurally identical
and reaches the same unguarded `new MutationObserver(...)` from `register()`.
It is safe only because `mlv-menu` renders its items inside
`<ng-template mlvPopupContent>`, which never instantiates on the server — the
same "overlay-only" reasoning that turned out to be wrong for
`MlvDrawerSectionsService`, whose SSR exclusions were dropped in the same
change.

It was left ungated deliberately, not overlooked. The token has two provider
sites — `menu.ts` (`useFactory`) and `menu-data-item.ts` (`useValue`, for a
nested submenu's own registry) — so a gate needs a matching enable call on
every path that can own a registry, and no path is reachable on a server today.
That is a change no test in this repo can turn red, which is the bar every
other fix in this area was held to. If `mlv-menu`'s items ever render outside
the overlay template, gate it exactly as the menubar store is gated.

Covered by `menu-item-registry.spec.ts` (`orders items on a platform with no
MutationObserver`, which removes the global to reproduce Node) and by the SSR
smoke suite's data-driven menubar host.

---

## Submenu Hover Intent

When `isSubmenuTrigger="true"`, the directive installs a document-level `mousemove`
listener. It is a **capture-phase** listener on the **injected `DOCUMENT`** and is
a `fromEvent(document, 'mousemove', { capture: true })` stream (converted in #76).
The capture phase is load-bearing — the tracker must see the move before a menu
item's own handlers can stop it — and `fromEvent` forwards the options object to
the identical `addEventListener` call, so the phase and the ordering among
capture listeners are unchanged. The subscription belongs to one submenu-open
generation and is released by `_removeMousemoveListener()` from the popup's
`onClose` and from `destroy()` (wired to `DestroyRef.onDestroy`) rather than by
`takeUntilDestroyed`, which would hold one listener per open for the
controller's whole life. Intent is resolved by **what the pointer is
over**, with geometry used only for the ambiguous space between the item and its
panel:

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
      context-menu-trigger.ts     — MlvContextMenuTrigger ([mlvContextMenuTrigger])
      context-menu-trigger.spec.ts — right-click open, cursor anchoring, global mode, keyboard, RTL
      menu-overlay-controller.ts  — MlvMenuOverlayController (shared popup/focus/submenu-intent lifecycle)
      menubar.ts                  — MlvMenubar (mlv-menubar)
      menubar.scss                — BEM styles
      menu-item-registry.ts       — MlvMenuItemRegistryStore, MLV_MENU_ITEM_REGISTRY, MenuKeyItem
      menubar-item-registry.ts    — MlvMenubarItemRegistryStore, MLV_MENUBAR_ITEM_REGISTRY
      menubar.types.ts                      — MlvMenubarItem, MlvMenubarAccessor, MlvMenubarMenuController, MENUBAR_TOKEN
      menu.types.ts                         — MlvMenuAccessor, MENU_TOKEN
      menu.spec.ts                — MlvMenu / item / trigger / separator unit tests
      menu-rtl.spec.ts            — scoped [dir] arrow mirroring across menu / item / trigger / menubar
      menubar.spec.ts             — MlvMenubar unit tests
      menu-item-registry.spec.ts  — both registries: ordering, mutation relevance, syncOrder guard
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
- **Direction (RTL): horizontal arrows resolve per-element, never per-document.** `MlvMenuItem._onKeydown` and `MlvMenuTrigger._onKeydown` pass their own host to `MlvRtlService.normalizeArrowKey(event, host)` — their hosts are the rows and triggers inside the pane, so host and pane agree by construction. `MlvMenubar` builds its horizontal `FocusKeyManager` from `elementDirection(host)` and rebuilds it when that flips.
  - **`MlvMenu._onKeydown` passes `event.currentTarget`, not its own host** — the one place in the repo where the two genuinely differ. The handler is bound on the `<mlv-list>` panel inside `<ng-template mlvPopupContent>`, which is portaled into a pane whose `dir` comes from the **trigger** (`MlvPopupService` → `resolveDirection(config.origin)`), while `<mlv-menu>` itself stays wherever it was declared. Menus are routinely declared once at page level and triggered from elsewhere, so resolving from `<mlv-menu>`'s host would report the document's LTR while the pane is mirrored: the submenu would open on `ArrowLeft` (the row's own host is inside the pane, so that half was right) and then refuse to close on `ArrowRight`. `currentTarget` is the panel, always inside the pane.
  - So a menu opened from a trigger inside a scoped `[dir="rtl"]` subtree mirrors **even while the document is LTR** — which is the only correct reading, because `MlvPopupService` stamps the pane with `resolveDirection(origin)` and the panel's layout is already mirrored.
  - Mirrored: `ArrowLeft` opens a submenu / crosses to the **next** menubar menu, `ArrowRight` closes a submenu / crosses to the **previous** one, and `ArrowLeft`/`ArrowRight` swap in the menubar's roving tabindex. A `[dir="ltr"]` island inside an RTL document stays unmirrored, symmetrically.
  - Untouched by direction: vertical arrows, `Home`/`End`, `Enter`/`Space`, `Escape`, `Tab`, type-ahead. `MlvMenubar._onKeydown`'s own `normalizeArrowKey(event)` stays targetless on purpose — its switch matches only `ArrowDown`/`ArrowUp`/`Enter`/`Space`, so mirroring is a no-op there.
  - Regressions: `menu-rtl.spec.ts` — scoped `[dir]` ancestor with the document asserted still LTR, vertical + `Home`/`End` unchanged, and the LTR-island mirror image. Includes a `DetachedMenuHost` whose `<mlv-menu>`s are declared **outside** the trigger's `[dir]` scope, which is the only shape that distinguishes the pane's direction from the menu host's; it asserts that disagreement directly (`bounding box dir="rtl"`, host's nearest `[dir]` is `<html>`) before exercising the keys.
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
