---
# Library: sidebar

Collapsed item overlay links render their own `:focus-visible` ring because
DOM focus belongs to the link rather than the sidebar-item host.

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The `@malva-ui/core/sidebar` library provides a navigation sidebar shell with collapsible group support, four layout modes (`icon`, `offcanvas`, `floating`, `fixed`), drag-to-resize rail, structural slot directives (header/content/footer), a workspace switcher, and a toggle trigger component. It exports a root container (`mlv-sidebar`), a styled workspace selector (`mlv-sidebar-workspace`), a collapsible group component (`mlv-sidebar-group`), a standalone item component (`mlv-sidebar-item`), a drag-to-resize rail (`mlv-sidebar-rail`), a toggle button (`mlv-sidebar-trigger`), and supporting directives for logo/text/icon/title/structural slots. The library handles both expanded and collapsed layouts transparently, sharing state via the `SIDEBAR_CONTEXT` injection token.

## Public API

Exported from `libs/core/sidebar/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvSidebar` | Component | Root sidebar container — `mlv-sidebar` |
| `MlvSidebarGroup` | Component | Collapsible group with `mlv-expand` accordion + `mlv-popup` flyout — `mlv-sidebar-group` |
| `MlvSidebarItem` | Component | Individual navigation item — `mlv-sidebar-item` |
| `MlvSidebarRail` | Component | Drag-to-resize rail with snap-to-collapse — `mlv-sidebar-rail` |
| `MlvSidebarTrigger` | Component | Toggle button for collapsing/expanding the sidebar, exposing `focusTarget()`, `offcanvasFocusTarget()`, and a disposal-time `restoreFocusResolver` — `mlv-sidebar-trigger` |
| `MlvSidebarWorkspace` | Component | Styled active-workspace row and multi-workspace menu — `mlv-sidebar-workspace` |
| `MlvSidebarWorkspaceLogo` | Structural directive | Custom logo template reused by the trigger and menu options — `[mlvSidebarWorkspaceLogo]` |
| `MlvSidebarWorkspaceText` | Structural directive | Custom text template reused by the trigger and menu options — `[mlvSidebarWorkspaceText]` |
| `MlvSidebarWorkspaceOption` | Interface | Workspace data contract (`id`, accessible `label`, optional `description`) |
| `MlvSidebarWorkspaceTemplateContext` | Interface | Logo/text template context exposing `$implicit` workspace and `selected` state |
| `MlvSidebarItemIcon` | Directive | Marks the icon slot inside a sidebar item or group — `[mlvSidebarItemIcon]` |
| `MlvSidebarItemHost` | Directive | Legacy attribute directive that applies sidebar item styling — `[mlvSidebarItem]` |
| `MlvSidebarItemTitle` | Directive | Marks a custom title template inside `mlv-sidebar-item` — `[mlvSidebarItemTitle]` |
| `MlvSidebarHeader` | Directive | Marks a sticky top region — `[mlvSidebarHeader]` |
| `MlvSidebarFooter` | Directive | Marks a sticky bottom region — `[mlvSidebarFooter]` |
| `MlvSidebarContent` | Component | Scrollable main content region backed by `mlv-scrollbar` — `[mlvSidebarContent]` |
| `SidebarContentDirective` | Compatibility alias | Backwards-compatible export alias for `MlvSidebarContent` |
| `MlvSidebarMode` | Type | `'icon' \| 'offcanvas' \| 'floating' \| 'fixed'` |
| `MlvSidebarAppearance` | Type | `'raised' \| 'flat'` outer surface treatment for an inline Sidebar |
| `MlvSidebarContextValue` | Interface | Shape of the value provided via `SIDEBAR_CONTEXT` |
| `SIDEBAR_CONTEXT` | Injection Token | `InjectionToken<MlvSidebarContextValue>` — carries collapsed/mode/toggle/setWidth to descendants |

---

## Components

### `MlvSidebar`

**File:** `libs/core/sidebar/src/lib/sidebar/sidebar.ts`
**Template:** `libs/core/sidebar/src/lib/sidebar/sidebar.html`
**Styles:** `libs/core/sidebar/src/lib/sidebar/sidebar.scss`

- **Selector:** `mlv-sidebar`
- **Change Detection:** `ChangeDetectionStrategy.OnPush`
- **Encapsulation:** `ViewEncapsulation.None`
- **Implements:** `MlvSidebarContextValue`

#### Inputs / Models

| Name                | Kind      | Type                    | Default     | Description                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | --------- | ----------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collapsed`         | `model()` | `boolean`               | `false`     | Two-way bindable collapsed state. In `fixed` mode this is always treated as false. **Intentionally named `collapsed`, not `opened`** — it models rail collapse/expand (a persistent layout state), a distinct concept from the transient open/close of overlay surfaces (`mlv-drawer`/`mlv-popup`/`mlv-expand`, and the dialog's `[(mlvDialog)]`). It is deliberately excluded from the `opened` naming normalization. |
| `width`             | `model()` | `string`                | `'260px'`   | Total expanded host width, including border and padding. Two-way bindable and updated by `setWidth()` during rail drag.                                                                                                                                                                                                                                                                                                |
| `collapsedWidth`    | `input()` | `string`                | `'56px'`    | Total collapsed host width, including border and padding.                                                                                                                                                                                                                                                                                                                                                              |
| `mode`              | `input()` | `MlvSidebarMode`        | `'icon'`    | Layout mode requested by the author: `'icon'`, `'offcanvas'`, `'floating'`, or `'fixed'`. Read `effectiveMode()` for the mode actually in effect.                                                                                                                                                                                                                                                                      |
| `appearance`        | `input()` | `MlvSidebarAppearance`  | `'raised'`  | Outer surface treatment for an inline Sidebar. `'flat'` removes only the outer radius and shadow; the border and background remain.                                                                                                                                                                                                                                                                                    |
| `collapseBelow`     | `input()` | `MlvBreakpoint \| null` | `null`      | Viewport breakpoint below which the sidebar behaves as an offcanvas drawer regardless of `mode`. See **Responsive usage**.                                                                                                                                                                                                                                                                                             |
| `closeOnActivation` | `input()` | `BooleanInput`          | `false`     | When opted in, activating an enabled projected button, link, `role="button"`, or menu item closes an open offcanvas Sidebar. Inline modes and non-interactive projected content are unaffected.                                                                                                                                                                                                                        |
| `ariaLabel`         | `input()` | `string \| undefined`   | `undefined` | Accessible name for the `navigation` landmark. Falls back to `MLV_SIDEBAR_I18N.navigation`. A plain `aria-label` **attribute** on `<mlv-sidebar>` does not work — the host binding owns that attribute — so use this input when a page has more than one sidebar.                                                                                                                                                      |
| `fullHeight`        | `input()` | `BooleanInput`          | `false`     | When true, sidebar uses `position: sticky` at full viewport height.                                                                                                                                                                                                                                                                                                                                                    |
| `minWidth`          | `input()` | `number`                | `200`       | Minimum width in px during drag resize.                                                                                                                                                                                                                                                                                                                                                                                |
| `maxWidth`          | `input()` | `number`                | `480`       | Maximum width in px during drag resize.                                                                                                                                                                                                                                                                                                                                                                                |

The two models emit `collapsedChange` and `widthChange` (the `model()` change outputs — there are no separate `output()` declarations).

#### Public computed signals

| Signal          | Type                     | Description                                                                                                                       |
| --------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `effectiveMode` | `Signal<MlvSidebarMode>` | `mode()`, unless `collapseBelow` is set and the viewport is narrower than it — then `'offcanvas'`. Bind against this, not `mode`. |

#### Host Bindings

```ts
host: {
  class: 'mlv-sidebar',
  '[class.mlv-sidebar--collapsed]': '_effectiveCollapsed()',
  '[class]': '"mlv-sidebar--" + effectiveMode()',
  '[class.mlv-sidebar--raised]': 'appearance() === "raised"',
  '[class.mlv-sidebar--flat]': 'appearance() === "flat"',
  '[class.mlv-sidebar--full-height]': 'fullHeight()',
  '[style.--mlv-sidebar-expanded-width]': 'width()',
  '[style.--mlv-sidebar-collapsed-width]': 'collapsedWidth()',
  role: 'navigation',
  '[attr.aria-label]': '_resolvedAriaLabel()',
}
```

#### Providers

Provides itself as `SIDEBAR_CONTEXT` so all descendant groups and items can inject the collapsed state:

```ts
{ provide: SIDEBAR_CONTEXT, useExisting: forwardRef(() => MlvSidebar) }
```

#### Key Methods

| Method     | Signature            | Description                                                                                    |
| ---------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `toggle`   | `(): void`           | Toggles the sidebar between collapsed and expanded. No-op when `effectiveMode()` is `'fixed'`. |
| `setWidth` | `(px: number): void` | Sets the sidebar width in pixels, clamped to the `[minWidth, maxWidth]` range.                 |

#### Protected handlers (template-facing, not public API)

| Method                      | Signature                   | Description                                                                                                                                                                                                                                               |
| --------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onContainerKeydown`        | `(event: Event): void`      | Handles `ArrowDown`/`ArrowUp` on the container to move focus between `mlv-sidebar-item`, `.mlv-sidebar-group__header`, `.mlv-sidebar-group__icon-btn`, and `button` elements in DOM order (wraps around). Skips elements inside `.cdk-overlay-container`. |
| `_onContainerClick`         | `(event: MouseEvent): void` | With `closeOnActivation`, closes an open offcanvas Sidebar after a real enabled projected action bubbles through the shared container.                                                                                                                    |
| `_onDrawerOpenedChange`     | `(opened: boolean): void`   | Syncs the drawer's open/close state back to the `collapsed` model (offcanvas mode).                                                                                                                                                                       |
| `_shouldRestoreDrawerFocus` | `(): boolean`               | Restores the external trigger for normal activation, but lets a newly opened `dialog` or `alertdialog` retain focus.                                                                                                                                      |
| `_onDrawerAfterClosed`      | `(): void`                  | Clears activation-specific state and reasserts focus inside a still-open modal after Drawer disposal removes the projected opener.                                                                                                                        |

#### Internal Computed Signals

| Signal                       | Description                                                                                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_isBelowCollapseBreakpoint` | Private. `true` when `collapseBelow` is set and `MlvBreakpointService.isDown()` reports the viewport below it. SSR-safe (CDK `BreakpointObserver`, never `matchMedia` directly). |
| `_effectiveCollapsed`        | Always `false` when `effectiveMode()` is `'fixed'`; otherwise returns `collapsed()`. Drives the `--collapsed` CSS modifier.                                                      |
| `_resolvedAriaLabel`         | `ariaLabel() ?? _i18n().navigation` — the host `aria-label`.                                                                                                                     |
| `_hasSlots`                  | `true` when at least one structural slot directive (`[mlvSidebarHeader]`, `[mlvSidebarFooter]`, `[mlvSidebarContent]`) is projected.                                             |

A constructor `effect` watches `_isBelowCollapseBreakpoint`: entering the responsive range stores the current `collapsed()` value and sets `collapsed` to `true` (the drawer must never pop open on a viewport change); leaving the range restores the stored value.

#### Template Summary

Uses `@if (effectiveMode() === 'offcanvas')` to branch between two layouts:

- **Shared body template:** The `.mlv-sidebar__container` (with the single `<ng-content />` projection slot) is declared once in a `#body` `<ng-template>` and rendered via `[ngTemplateOutlet]` in both branches. This avoids two default `<ng-content>` slots (Angular projects into only the last), which previously left the offcanvas drawer empty. The host owns width; the inner container remains `width: 100%` and clips trailing content during animation.
- **Offcanvas branch:** Wraps the shared body outlet in `<mlv-drawer>`'s **`<ng-template mlvDrawerContent>`** (required — `MlvDrawer` only renders content projected through `MlvDrawerContent`). Drawer is bound `[opened]="!_effectiveCollapsed()"`, `position="left"`, `[size]="width()"`, `[hasBackdrop]="true"`. The drawer's `openedChange` syncs back to `collapsed` via `_onDrawerOpenedChange`; its `cdkTrapFocusAutoCapture` moves focus into the panel on open and Escape/backdrop close it. With `closeOnActivation`, an enabled projected action also closes it; the external trigger regains focus unless that activation opened a `dialog` or `alertdialog`. In that composed case Drawer restoration is suppressed and focus is reasserted in the connected modal after the projected opener is disposed.
- **Default branch:** Renders the shared body directly. The host toggles between the expanded and collapsed width custom properties.

Both branches project `<ng-content />` and handle `(keydown)="onContainerKeydown($event)"` for arrow-key focus management.

#### Inline Style Summary

- **Block `.mlv-sidebar`:** owns the animated total width and exposes `--mlv-sidebar-expanded-width`, `--mlv-sidebar-collapsed-width`, `--mlv-sidebar-gutter`, `--mlv-sidebar-border-width`, derived `--mlv-sidebar-icon-column-width`, `--mlv-sidebar-row-height`, and the three state-surface variables (`--mlv-sidebar-hover-bg`, `--mlv-sidebar-active-bg`, `--mlv-sidebar-rail-color` — see **State surfaces**). The icon column is `collapsedWidth - (2 × gutter) - (2 × border)` and is shared by item, group, project-selector, header, and footer icon containers.
- **`--mlv-sidebar-row-height`** (default `2.25rem`) is the single source of truth for the height of every navigable row — `mlv-sidebar-item`, `.mlv-sidebar-group__header`, `.mlv-sidebar-group__icon-btn`, and `.mlv-sidebar-trigger__btn` all resolve `min-height: var(--mlv-sidebar-row-height, 2.25rem)`, so a mixed list keeps one rhythm. It is density-aware on the sidebar block: tight `var(--mlv-spacing-6)` (1.5rem/24px — off the height ramp by design, one step under compact so the order holds now that `--mlv-height-xs` is 28px), compact `--mlv-height-xs`, comfortable (default) `2.25rem`, spacious `--mlv-height-s`, airy `--mlv-height-m`. The icon column deliberately does **not** scale with density — it stays derived from `collapsedWidth`.
- **Element `.mlv-sidebar__container`:** flex column, `height: 100%`, `width: 100%`, `gap: 1px`, and `overflow: hidden`; it clips fading labels while the host's trailing edge contracts.
- **Element `.mlv-sidebar__header`:** `flex-shrink: 0` — stays pinned at top.
- **Element `.mlv-sidebar__content`:** `flex: 1 1 0`, `overflow: hidden`, `min-height: 0` — middle-region host whose internal `.mlv-sidebar__content-scrollbar` owns scrolling. Unslotted legacy content is wrapped by `.mlv-sidebar__scrollbar` at the sidebar level.
- **Element `.mlv-sidebar__footer`:** `flex-shrink: 0` — stays pinned at bottom.
- **Modifier `.mlv-sidebar--collapsed`:** switches only the host width. Descendant icon tracks remain start-anchored at the same derived width while labels fade and become `visibility: hidden` after the transition.
- **Modifier `.mlv-sidebar--flat`:** removes only the inline sidebar's outer radius and shadow (`--mlv-shadow-flat`); its border and raised background remain. Page Shell continues to own its chrome seam.
- **Modifier `.mlv-sidebar--offcanvas`:** removes border, shadow, and padding, and collapses the host to `width: 0` (`flex: 0 0 auto`, `overflow: hidden`). The panel lives in a CDK overlay, so the host is only an anchor in the page flow — it previously claimed `width: 100%` and squeezed the content beside it, which also broke the layout the moment `collapseBelow` crossed its breakpoint.
- **Modifier `.mlv-sidebar--floating`:** `position: absolute`, `z-index: 100`, elevated shadow (`--mlv-shadow-overlay` — a side overlay per SL-R3), `translateX(-100%)` when collapsed.
- **Modifier `.mlv-sidebar--full-height`:** `position: sticky`, full viewport height via `100dvh`, respects `--mlv-sidebar-offset-top` and `--mlv-sidebar-offset-bottom` CSS custom properties.
- **Drawer context** (`.mlv-drawer .mlv-sidebar`): fills drawer width, forces labels visible.
- **Reduced motion:** host, floating transform, label, badge, group heading, and trigger transitions use the instant duration when `prefers-reduced-motion: reduce` is active.

For a custom project selector or another consumer-owned header/footer row, keep all grid children in the same explicit row during collapse. Collapse trailing tracks to zero instead of removing them, for example `grid-template-columns: var(--mlv-sidebar-icon-column-width) minmax(0, 0fr) 0`; otherwise CSS auto-placement can move mounted fading text onto extra rows and add vertical spacing.

---

### `MlvSidebarWorkspace`

- **File:** `libs/core/sidebar/src/lib/sidebar-workspace/sidebar-workspace.ts`
- **Template:** `libs/core/sidebar/src/lib/sidebar-workspace/sidebar-workspace.html`
- **Styles:** `libs/core/sidebar/src/lib/sidebar-workspace/sidebar-workspace.scss`

- **Selector:** `mlv-sidebar-workspace`
- **Change Detection:** `ChangeDetectionStrategy.OnPush`
- **Encapsulation:** `ViewEncapsulation.None`

Styled workspace identity row intended for `[mlvSidebarHeader]`. It renders a non-interactive row for one workspace and upgrades to a native Malva button plus `mlv-menu` when `workspaces.length > 1`. Selecting a menu item updates the two-way `workspace` model, closes the menu, and restores focus to the trigger through the shared menu behavior.

#### Inputs / Models

| Name         | Kind               | Type                                   | Description                                                                  |
| ------------ | ------------------ | -------------------------------------- | ---------------------------------------------------------------------------- |
| `workspaces` | required `input()` | `readonly MlvSidebarWorkspaceOption[]` | Available workspace collection; two or more options enable the menu trigger. |
| `workspace`  | required `model()` | `MlvSidebarWorkspaceOption`            | Active workspace; emits `workspaceChange` after user selection.              |

#### Structural templates

| Selector                    | Context                                                     | Description                                                                                                             |
| --------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `[mlvSidebarWorkspaceLogo]` | `$implicit: MlvSidebarWorkspaceOption`, `selected: boolean` | Renders inside the fixed logo track for the active trigger and every menu option. Falls back to a generated monogram.   |
| `[mlvSidebarWorkspaceText]` | `$implicit: MlvSidebarWorkspaceOption`, `selected: boolean` | Renders the primary/secondary copy for the active trigger and every menu option. Falls back to `label` + `description`. |

The component consumes `SIDEBAR_CONTEXT.collapsed` automatically. Collapsed mode retains the logo track and accessible trigger name while fading/clipping the text and chevron tracks. The overlay menu stays fully expanded because it renders outside the collapsed sidebar ancestry.

The trigger uses the shared `button[mlvButton]` and `mlv-menu` primitives. The menu provides Arrow Up/Down, Home/End, type-ahead, Enter/Space activation, Escape/outside-click dismissal, and focus restoration. The active option carries `aria-current="true"` and a decorative check mark.

#### Styling

- BEM block: `.mlv-sidebar-workspace`.
- Reuses `--mlv-sidebar-icon-column-width` so its logo aligns with sidebar items/groups.
- Stable three-track grid (`logo`, text, trailing affordance) prevents mounted content from reflowing during collapse.
- Popup options reuse the same structural templates and have a `14rem` minimum width.
- Motion is limited to short transform/opacity/color transitions and becomes instant under `prefers-reduced-motion: reduce`.

---

### `MlvSidebarGroup`

**File:** `libs/core/sidebar/src/lib/sidebar-group/sidebar-group.ts`
**Template:** `libs/core/sidebar/src/lib/sidebar-group/sidebar-group.html`
**Styles:** `libs/core/sidebar/src/lib/sidebar-group/sidebar-group.scss`

- **Selector:** `mlv-sidebar-group`
- **Change Detection:** `ChangeDetectionStrategy.OnPush`
- **Encapsulation:** `ViewEncapsulation.None`
- **Implements:** `OnDestroy`

#### Inputs

| Name         | Type                       | Default      | Description                                                                                                                                                                                                   |
| ------------ | -------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`      | `string`                   | _(required)_ | Display label for the group header, flyout title, and collapsed icon button `aria-label`/`title`.                                                                                                             |
| `badge`      | `string \| number \| null` | `null`       | Optional badge/count. Rendered as a trailing `mlv-badge` in the expanded accordion header, next to the flyout title (collapsed), and as a decorative `mlv-status-indicator` dot on the collapsed icon button. |
| `badgeTone`  | `MlvBadgeTone`             | `'default'`  | Semantic tone applied to the group badge and the collapsed status dot.                                                                                                                                        |
| `badgePulse` | `boolean` / `BooleanInput` | `false`      | When true, the collapsed-mode status dot pulses.                                                                                                                                                              |

#### Internal Signals

| Signal               | Type            | Description                                                                                                                                    |
| -------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `expanded`           | `signal(false)` | Whether the accordion panel is open (expanded sidebar mode). Public and writable — see `_accordionOpen` for what actually drives `mlv-expand`. |
| `_accordionOpen`     | `computed`      | Protected. `expanded() && !isSidebarCollapsed()` — bound to `mlv-expand`'s `[opened]`. See **Accordion never opens in the rail** below.        |
| `flyoutOpen`         | `computed`      | Derived from the `mlv-popup` component's `opened()` signal — `true` while the flyout is open (collapsed sidebar mode).                         |
| `isSidebarCollapsed` | `computed`      | `true` when the parent `SIDEBAR_CONTEXT.collapsed()` is true.                                                                                  |
| `hasActiveChild`     | `computed`      | `true` when any descendant `MlvSidebarItem` has `computedActive() === true`. Drives the active highlight on the group header and icon button.  |

**Accordion never opens in the rail.** `expanded` is public, so a host that
auto-expands the group owning the active route can write it while the sidebar is
collapsed. The accordion stays mounted in that state (its header fades but keeps
the icon column in place), so honouring the write opened an empty panel inside
the icon rail — a ghost tree line plus reserved height — and, because
`#childrenRef` can only project once, it also pulled the children out of the
open flyout, leaving it showing just its header. `mlv-expand` is therefore bound
to `_accordionOpen()`, which gates on the collapsed state regardless of write
order. The constructor `effect` still resets `expanded` when collapse begins, so
the guard is purely presentational: a pending `expanded` write takes effect the
moment the sidebar expands again.

#### Content Children

| Query        | Type                                                     | Description                                                                               |
| ------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `iconRef`    | `contentChild(MlvSidebarItemIcon)`                       | Optional icon slot to display in both the accordion header and the collapsed icon button. |
| `childItems` | `contentChildren(MlvSidebarItem, { descendants: true })` | All nested `mlv-sidebar-item` components; used to compute `hasActiveChild`.               |

#### View Children

| Query              | Type                                                      | Description                                                                                                                                       |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `childrenTpl`      | `viewChild.required<TemplateRef<unknown>>('childrenRef')` | Template reference capturing projected `<ng-content>` once; reused in both accordion and flyout to avoid double-rendering.                        |
| `triggerBtn`       | `viewChild<ElementRef<HTMLButtonElement>>('triggerBtn')`  | Reference to the collapsed icon button trigger; focus is restored here after flyout closes.                                                       |
| `_flyoutContainer` | `viewChild<MlvPopupContainer>('flyoutContainer')`         | Protected. Reference to the `mlv-popup-container` wrapping the flyout trigger and popup. Used for imperative `toggle()`/`open()`/`close()` calls. |
| `_flyoutPopup`     | `viewChild<MlvPopup>('flyoutPopup')`                      | Protected. Reference to the `mlv-popup` component; its `opened()` signal drives `flyoutOpen`.                                                     |

#### Providers

Re-provides `SIDEBAR_CONTEXT` for descendants, setting `inFlyout: group.flyoutOpen` so child items inside the flyout render in expanded (non-collapsed) mode even while the parent sidebar is collapsed.

#### Key Methods

| Method   | Signature  | Description                                          |
| -------- | ---------- | ---------------------------------------------------- |
| `toggle` | `(): void` | Flips `expanded` signal to open/close the accordion. |

#### Protected handlers (template-facing, not public API)

| Method             | Signature              | Description                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onFlyoutKeydown`  | `(event: Event): void` | Roving keyboard nav inside the open flyout menu: `ArrowDown`/`ArrowUp` cycles focus, `Home`/`End` jumps to first/last item, `Escape`/`ArrowLeft` closes the flyout via `_flyoutContainer.close()` and restores focus to the trigger.                                                                                                                                                                                             |
| `onTriggerKeydown` | `(event: Event): void` | `Enter`/`Space` toggle via `_flyoutContainer.toggle()`; `ArrowRight` opens (or, if already open, focuses the first item); `ArrowDown` on an **open** trigger enters the flyout (`preventDefault` + `stopPropagation`) instead of bubbling to the sidebar container's roving nav (which would skip past and orphan the flyout).                                                                                                   |
| `onFlyoutClick`    | `(event: Event): void` | Closes the flyout and returns focus to the icon trigger when a child item is activated inside it — the menu-button pattern. Bubbling `click` on the panel, gated on `target.closest('.mlv-sidebar-item')`, so the flyout header and empty panel space are ignored. Enter/Space are covered too: `MlvSidebarItem` activates a button-style row by calling `.click()` on its host, and a projected anchor dispatches a real click. |
| `onFlyoutFocusOut` | `(event: Event): void` | Closes the flyout when keyboard focus leaves it entirely (Tab out, or moving to another trigger) — via the `(focusout)` `relatedTarget`; focus moving between items or back to the owning trigger is ignored.                                                                                                                                                                                                                    |

On open, an `effect` on `flyoutOpen()` moves focus to the first flyout item on the next animation frame (WAI-ARIA menu-button pattern), resolving the panel through its generated `_flyoutId` (`mlvNextId`) since it renders in a CDK overlay. `_focusFirstFlyoutItem()` queries `a[href], button:not([disabled]), [tabindex="0"]` inside that panel.

#### Template Summary

- `#childrenRef` ng-template: captures `<ng-content>` once and is referenced by both the accordion and flyout via `ngTemplateOutlet`.
- **Persistent accordion header:** `.mlv-sidebar-group` remains mounted in both states, becomes inert/`aria-hidden` immediately on collapse, and fades its label/badge/chevron while preserving the icon column. Its `<mlv-expand>` closes when collapse begins.
- **Collapsed sidebar branch** (`@if (isSidebarCollapsed())`): renders `<mlv-popup-container #flyoutContainer>` wrapping a `<button #triggerBtn mlvPopupTrigger triggerOn="click" class="mlv-sidebar-group__icon-btn">` (its `aria-label` is `_resolvedAriaLabel()` — the label with the badge count folded in, e.g. `"Projects, 3 notifications"`; a decorative `.mlv-sidebar-group__status` dot overlays its top-right) and a `<mlv-popup #flyoutPopup position="right-start">`. The flyout content is a `.mlv-sidebar-group__flyout` div with a header (`.mlv-sidebar-group__flyout-title` + optional `.mlv-sidebar-group__flyout-badge`) and the `childrenTpl` outlet.

#### Inline Style Summary

**Accordion (`.mlv-sidebar-group`):**

- `__header`: grid with the shared fixed icon column followed by label, badge, and chevron tracks; hover/focus-visible background from `--mlv-sidebar-hover-bg` + 2px focus outline; modifier `--active` sets action color + bold and deliberately **no** pill (see **State surfaces**).
- `__icon`: centers the icon within the shared fixed-width column.
- `__label`: truncates with ellipsis and fades/translates without being removed during collapse.
- `__arrow`: transitions `transform`, modifier `--open` rotates 180°.
- `__content` (applied to `mlv-expand`): tree-line left border at `1.25rem` (coloured from `--mlv-sidebar-rail-color`) and the `0.125rem` top padding are both applied **only** via the `.mlv-expand--open` modifier — a closed `mlv-expand` still occupies its padding box, so the unconditional padding used to make every group 2px taller than a plain item. Expand/collapse animation handled by `mlv-expand`; `padding-top` eases with the border colour and goes instant under `prefers-reduced-motion`.

**Collapsed trigger (`.mlv-sidebar-group__icon-btn`):**

- Fixed-width button using `--mlv-sidebar-icon-column-width`; hover/focus-visible fill from `--mlv-sidebar-hover-bg` (the same tint a plain item uses — it previously reached for the stronger `--mlv-background-neutral-1-hover` step); modifier `--active` sets `--mlv-sidebar-active-bg` plus action text color, written against the block class so it survives `:hover`.
- `mlv-popup` provides the tooltip and flyout without requiring overflow outside the clipping container.
- `__status`: `position: absolute`, top-right (`0.125rem`), clear of the bottom-right group chevron glyph — collapsed-rail status dot.

**Flyout content (`.mlv-sidebar-group__flyout`, rendered inside `mlv-popup`):**

- flex column with gap; panel chrome (background, shadow, border-radius) provided by `mlv-popup`.
- `__flyout-header`: flex row (bold secondary text, `border-bottom` separator) holding `__flyout-title` (`flex: 1`, ellipsis) and an optional trailing `__flyout-badge`.
- `__badge` (header): trailing badge between the label and chevron in the expanded accordion header.

---

### `MlvSidebarItem`

**File:** `libs/core/sidebar/src/lib/sidebar-item/sidebar-item.ts`
**Template:** `libs/core/sidebar/src/lib/sidebar-item/sidebar-item.html`
**Styles:** `libs/core/sidebar/src/lib/sidebar-item/sidebar-item.scss`

- **Selector:** `mlv-sidebar-item`
- **Change Detection:** `ChangeDetectionStrategy.OnPush`
- **Encapsulation:** `ViewEncapsulation.None`

#### Inputs

| Name         | Type (read / write)        | Default      | Description                                                                                                                                                                                                                                                                                                                 |
| ------------ | -------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`      | `string`                   | _(required)_ | Accessible label; used as `aria-label` on the host, fallback text when no `[mlvSidebarItemTitle]` is projected, and tooltip text when collapsed.                                                                                                                                                                            |
| `active`     | `boolean` / `BooleanInput` | `false`      | Explicit active state; combined via OR with router link active detection in `computedActive`.                                                                                                                                                                                                                               |
| `badge`      | `string \| number \| null` | `null`       | Optional badge/count. Rendered as a trailing `mlv-badge` when expanded and as a decorative `mlv-status-indicator` dot (top-right of the icon) when collapsed. `null`/`''` renders nothing. **Sanctioned way to attach a badge** — composes with a projected `[mlvSidebarItemTitle]` (badge renders after the custom title). |
| `badgeTone`  | `MlvBadgeTone`             | `'default'`  | Semantic tone applied to both the expanded badge and the collapsed status dot.                                                                                                                                                                                                                                              |
| `badgePulse` | `boolean` / `BooleanInput` | `false`      | When true, the collapsed-mode status dot pulses to draw attention.                                                                                                                                                                                                                                                          |

#### Computed Signals

| Signal           | Description                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `computedActive` | `true` if `active()` is `true` OR if the nested `RouterLinkActive` reports active. Drives the `--active` CSS modifier and is read by `MlvSidebarGroup.hasActiveChild`. |
| `isCollapsed`    | `true` when `SIDEBAR_CONTEXT.collapsed()` is `true` AND `SIDEBAR_CONTEXT.inFlyout()` is `false`. Drives the `--collapsed` CSS modifier.                                |

#### Content Children

| Query                   | Type                                                    | Description                                                                                                            |
| ----------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `iconRef`               | `contentChild(MlvSidebarItemIcon)`                      | Optional icon template projected via `[mlvSidebarItemIcon]`.                                                           |
| `titleRef`              | `contentChild(MlvSidebarItemTitle)`                     | Optional custom title template projected via `[mlvSidebarItemTitle]`. Rendered instead of plain `label()` text.        |
| `_routerLink` (private) | `contentChild(RouterLinkActive, { descendants: true })` | Detects Angular router active state from a projected `routerLinkActive` directive. Subscribed via `afterRenderEffect`. |

#### Host Bindings

```ts
host: {
  class: 'mlv-sidebar-item',
  '[class.mlv-sidebar-item--active]': 'computedActive()',
  '[class.mlv-sidebar-item--collapsed]': 'isCollapsed()',
  '[attr.role]': '_hostRole()',                 // 'menuitem' in a flyout, else 'button'; null when a focusable control is projected
  '[attr.tabindex]': '_interactiveHost() ? 0 : null',
  '[attr.aria-label]': '_resolvedAriaLabel()',   // label(), with the badge count folded in when set; null for a presentational wrapper
  '[attr.aria-current]': 'computedActive() ? "page" : null',
  '(keydown.enter)': '_onKeyActivate($event)',
  '(keydown.space)': '_onKeyActivate($event)',
  '(mouseenter)': '_onMouseEnter()',
  '(mouseleave)': '_onMouseLeave()',
  '(focusin)': '_onMouseEnter()',
  '(focusout)': '_onMouseLeave()',
}
```

**Interactive-host detection.** `_interactiveHost` is `true` unless the projected
content already contains its **own** focusable control. After each render an
`afterRenderEffect` scans the host subtree with
`querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')`
(descendants only — the host's own reactive `tabindex` is never matched) and
stores the result in `_hasProjectedFocusable`. So a `[mlvSidebarItemTitle]` that
projects a router `<a>` link makes the host a presentational wrapper (no
role/tabindex/aria-label — the `<a>` is the single interactive element), while a
title that projects only text + a badge keeps the host interactive
(`role="button"`, `tabindex="0"`, `aria-label`). `_hostRole` resolves to
`"menuitem"` when the item renders inside a collapsed-mode group flyout (a
`role="menu"`), `"button"` otherwise, or `null` for a presentational wrapper.
`aria-current="page"` is set on the host whenever `computedActive()` is true.

**Badge / status indicator.** The `badge` input renders a trailing muted
`mlv-badge` in the expanded row and a decorative (`aria-hidden`)
`mlv-status-indicator` dot (top-right of the icon) in the collapsed rail, where a
full badge does not fit. Both take their colour from `badgeTone` (and the dot
optionally pulses via `badgePulse`). Because the host `aria-label` overrides the
visible badge text, the count is folded into `_resolvedAriaLabel` in **both**
states — a pure-numeric badge via the `notifications` ICU key (e.g. `"Inbox, 3
notifications"`), any other value verbatim (e.g. `"Orders, New"`). The badge input
composes with a projected `[mlvSidebarItemTitle]` (badge renders after the custom
title). Edge case: when the projected content is itself a focusable control (a
router `<a>`) the host is a presentational wrapper with no `aria-label`, so the
count is not folded in — prefer the input-based path for full a11y of the count.

#### Protected handlers (template-facing, not public API)

| Method           | Signature              | Description                                                                                                                                |
| ---------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `_onKeyActivate` | `(event: Event): void` | Prevents default and programmatically `.click()`s the host element on Enter/Space, enabling keyboard activation of projected anchor links. |

#### Template Summary

1. Renders the icon template inside `.mlv-sidebar-item__icon`, a persistent container whose width is the shared derived icon column.
2. Renders `.mlv-sidebar-item__label` — either the custom `titleRef` template outlet or the plain `label()` string — followed by `.mlv-sidebar-item__badge` (`mlv-badge`, `aria-hidden`) when `badge` is set. Both remain mounted during collapse, are made inert/hidden from accessibility immediately, and visually fade within the clipped trailing tracks.
3. Renders `.mlv-sidebar-item__status` (`mlv-status-indicator`) when collapsed and `badge` is set — the icon-rail replacement for the badge.
4. Renders `.mlv-sidebar-item__tooltip` (`aria-hidden="true"`, always in DOM) showing `label()` for the collapsed tooltip.

#### Inline Style Summary

- **Block `.mlv-sidebar-item`:** three-column grid (`icon column`, `minmax(0, 1fr)` label, `auto` badge), full container width, zero horizontal padding, and stable row height.
- **Element `__icon`:** centers projected icon content inside `--mlv-sidebar-icon-column-width` in both states.
- **Element `__label`:** `min-width: 0`, ellipsis, opacity/translation fade, and delayed `visibility: hidden` in collapsed mode.
- **Element `__badge`:** trailing badge with the same opacity/delayed-visibility behavior.
- **Element `__status`:** `position: absolute`, top-right (`0.1875rem`), `pointer-events: none` — collapsed-rail status dot overlaying the icon.
- **Element `__tooltip`:** absolute, right of item, hidden (`opacity: 0`), shown on hover/focus-visible in collapsed mode.
- **Modifier `--active`:** `--mlv-text-on-selected` + `font-weight: 600` on the modifier, plus the active pill (`--mlv-sidebar-active-bg`, default `--mlv-background-selected`) written against the block class so it survives `:hover`. Selection is its own token (SF-R1) — never the pressed `-active` fill. See **State surfaces**.
- **Modifier `--collapsed`:** leaves the icon track unchanged; disables interaction on the label and fades trailing content while the sidebar container clips it.

---

### `MlvSidebarRail`

**File:** `libs/core/sidebar/src/lib/sidebar-rail/sidebar-rail.ts`
**Styles:** `libs/core/sidebar/src/lib/sidebar-rail/sidebar-rail.scss`

- **Selector:** `mlv-sidebar-rail`
- **Template:** empty (visual element only)
- **Change Detection:** `ChangeDetectionStrategy.OnPush`
- **Encapsulation:** `ViewEncapsulation.None`

Drag-to-resize rail that lives alongside the sidebar container. Supports pointer drag, snap-to-collapse, double-click toggle, and keyboard width adjustment.

#### Inputs

| Name            | Type     | Default | Description                                                                    |
| --------------- | -------- | ------- | ------------------------------------------------------------------------------ |
| `minWidth`      | `number` | `200`   | Minimum sidebar width in px during drag.                                       |
| `maxWidth`      | `number` | `480`   | Maximum sidebar width in px during drag.                                       |
| `snapThreshold` | `number` | `100`   | Width threshold below which the sidebar snaps to collapsed on pointer release. |

#### Host Bindings

```ts
host: {
  class: 'mlv-sidebar-rail',
  '[class.mlv-sidebar-rail--dragging]': '_isDragging()',
  role: 'separator',
  'aria-orientation': 'vertical',
  tabindex: '0',
  'aria-label': 'Resize sidebar',
  '[attr.aria-valuetext]': '_currentWidthPx() + "px"',
  '[attr.aria-valuenow]': '_currentWidthPx()',
  '[attr.aria-valuemin]': 'minWidth()',
  '[attr.aria-valuemax]': 'maxWidth()',
  '(pointerdown)': '_onPointerDown($event)',
  '(dblclick)': '_onDoubleClick()',
  '(keydown)': '_onKeydown($event)',
}
```

#### Protected handlers (template-facing, not public API)

| Method           | Signature                      | Description                                                                                                                               |
| ---------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `_onDoubleClick` | `(): void`                     | Toggles the sidebar collapsed state.                                                                                                      |
| `_onKeydown`     | `(event: KeyboardEvent): void` | `ArrowLeft`/`ArrowRight` adjust width by ±10px. `Home` collapses (no-op if already collapsed). `End` expands (no-op if already expanded). |
| `_onPointerDown` | `(event: PointerEvent): void`  | Starts the drag: captures pointer, disables container transition, attaches `pointermove`/`pointerup` listeners outside Angular zone.      |

#### Drag Behavior

- Runs `pointermove` handler outside Angular zone with `requestAnimationFrame` throttle for smooth 60fps resizing.
- On drag, computes `newWidth = event.clientX - sidebarRect.left`. If `newWidth < snapThreshold` and sidebar is not already collapsed, sets a snap flag. Otherwise clamps to `[minWidth, maxWidth]` and calls `setWidth()`.
- On pointer release, restores the container's CSS transition. If snap flag is set, calls `toggle()` to collapse.
- Cleans up document listeners and resets `user-select`/`cursor` overrides on destroy. `_cleanup()` is the single exit for both `pointerup` and `DestroyRef.onDestroy`, so a rail destroyed mid-drag leaves nothing bound (asserted in `sidebar-rail.spec.ts`).
- The listeners go on the **injected `DOCUMENT`**, not the ambient global: under server rendering the two are different objects and the global is defined, so an ambient binding would attach a per-render component to a process-wide object no teardown reaches, without throwing. Changed in #76.

#### Inline Style Summary

- **Block `.mlv-sidebar-rail`:** `position: absolute`, `right: -1px`, `width: 2px`, transparent background, `cursor: col-resize`, `z-index: 1`. `::before` pseudo-element provides a wider hit area (±4px).
- **`:hover`:** expands to `width: 4px`, shows `--mlv-background-accent-1`.
- **`:focus-visible`:** standard focus ring (`--mlv-border-focus`).
- **Modifier `--dragging`:** same visual as hover (4px accent bar).

---

### `MlvSidebarTrigger`

**File:** `libs/core/sidebar/src/lib/sidebar-trigger/sidebar-trigger.ts`
**Styles:** `libs/core/sidebar/src/lib/sidebar-trigger/sidebar-trigger.scss`

- **Selector:** `mlv-sidebar-trigger`
- **Change Detection:** `ChangeDetectionStrategy.OnPush`
- **Encapsulation:** `ViewEncapsulation.None`

Toggle button that collapses/expands the sidebar. Renders a plain transparent icon button styled to match collapsed sidebar items, so it sits flush with the rest of the sidebar chrome. Auto-hides in `fixed` mode, and turns into a hamburger/close menu button while the sidebar's **effective** mode is `'offcanvas'`.

#### Inputs

| Name      | Type                                  | Default     | Description                                                                                                                                                                                                                                                                                                                                                                      |
| --------- | ------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sidebar` | `MlvSidebarContextValue \| undefined` | `undefined` | The sidebar to control when the trigger is rendered **outside** `<mlv-sidebar>` — pass the sidebar's template reference (`<mlv-sidebar #nav />` → `[sidebar]="nav"`). Required for any sidebar that can become an offcanvas drawer: a closed drawer renders none of its projected content, so a nested trigger disappears with it. Falls back to the ancestor `SIDEBAR_CONTEXT`. |

#### Public focus helpers

| Member                   | Type                                | Description                                                                                                                                                                                             |
| ------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `focusTarget`            | `Signal<HTMLButtonElement \| null>` | The connected native trigger button, or `null` before its view exists. Pass it to an overlay's explicit restore-focus option when the activating offcanvas control disappears.                          |
| `offcanvasFocusTarget()` | `HTMLButtonElement \| null`         | Point-in-time connected native trigger only while the sidebar's effective mode is `offcanvas`; otherwise `null`. Connectivity and effective mode are checked on every call.                             |
| `restoreFocusResolver`   | `() => true \| HTMLButtonElement`   | Stable function for a dynamic Dialog restore option. At disposal it returns the connected external trigger in offcanvas mode, or `true` so Dialog uses its connected captured opener in an inline mode. |

#### Host Bindings

```ts
host: {
  class: 'mlv-sidebar-trigger',
  '[class.mlv-sidebar-trigger--hidden]': '_isHidden()',
  '[class.mlv-sidebar-trigger--menu]': '_isDrawerTrigger()',
}
```

#### Internal Computed Signals

| Signal               | Description                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `_context`           | Private. `sidebar() ?? inject(SIDEBAR_CONTEXT, { optional: true })` — the context this trigger drives. All reads are null-safe.        |
| `_mode`              | Private. `_context()?.effectiveMode?.() ?? _context()?.mode()` (defaults to `'icon'` when there is no context at all).                 |
| `_collapsed`         | Reads `collapsed()` from the resolved context. Drives icon swap and ARIA attributes.                                                   |
| `_isDrawerTrigger`   | `true` when `_mode()` is `'offcanvas'`. Swaps in the hamburger/close icons and adds the `--menu` modifier.                             |
| `_isHidden`          | `true` when `_mode()` is `'fixed'`. Hides the trigger via `display: none` — a `collapseBelow` override therefore unhides it on mobile. |
| `_resolvedAriaLabel` | Drawer mode: `openNavigation`/`closeNavigation`. Rail mode: `expand`/`collapse`. All four come from `MLV_SIDEBAR_I18N`.                |

#### Template Summary

Renders a plain `<button class="mlv-sidebar-trigger__btn">` with:

- `[attr.aria-label]` bound to `_resolvedAriaLabel()`.
- `[attr.aria-expanded]` bound to `!_collapsed()`.
- `(click)` calls the protected `_toggle()` method.
- Icons at `[size]="20"`: drawer mode swaps `lucideMenu` (closed) / `lucideX` (open); rail mode swaps `lucidePanelLeftOpen` (collapsed) / `lucidePanelLeftClose` (expanded).

#### Inline Style Summary

- **Block `.mlv-sidebar-trigger`:** `display: flex; width: 100%`.
- **Modifier `--hidden`:** `display: none`.
- **Modifier `--menu`:** `width: auto` and a square `__btn` sized from `--mlv-sidebar-row-height` — the drawer trigger usually lives outside the sidebar, where the rail's icon column does not exist.
- **Element `__btn`:** transparent icon button with `width: var(--mlv-sidebar-icon-column-width)`, zero padding, the shared `--mlv-sidebar-row-height`, secondary text color, hover background, focus-visible outline, and centered icon.
- **Element `__icon`:** smooth `transform` transition on the SVG.

---

## Directives

### `MlvSidebarHeader`

**File:** `libs/core/sidebar/src/lib/sidebar-header.ts`
**Selector:** `[mlvSidebarHeader]`

Marks a sticky top region inside the sidebar. Applied to a container element that should remain visible at the top when content scrolls.

#### Host Bindings

```ts
host: { class: 'mlv-sidebar__header' }
```

No inputs, outputs, or lifecycle hooks.

---

### `MlvSidebarFooter`

**File:** `libs/core/sidebar/src/lib/sidebar-footer.ts`
**Selector:** `[mlvSidebarFooter]`

Marks a sticky bottom region inside the sidebar. Applied to a container element that should remain visible at the bottom when content scrolls.

#### Host Bindings

```ts
host: { class: 'mlv-sidebar__footer' }
```

No inputs, outputs, or lifecycle hooks.

---

### `MlvSidebarContent` (`SidebarContentDirective` compatibility alias)

**File:** `libs/core/sidebar/src/lib/sidebar-content.ts`
**Selector:** `[mlvSidebarContent]`

Marks the scrollable middle region between header and footer inside the sidebar. It keeps the existing selector and import alias, fills the remaining space, and renders projected items inside the shared Malva scrollbar. When no named slots are present, `MlvSidebar` wraps its default projected content in the same scrollbar.

#### Host Bindings

```ts
host: { class: 'mlv-sidebar__content' }
template: `<mlv-scrollbar class="mlv-sidebar__content-scrollbar"><ng-content /></mlv-scrollbar>`
```

No inputs, outputs, or lifecycle hooks.

---

### `MlvSidebarItemIcon`

**File:** `libs/core/sidebar/src/lib/sidebar-item-icon.ts`
**Selector:** `[mlvSidebarItemIcon]`
**Extends:** `MlvStructural` (from `@malva-ui/core/form-utils`)

Marks an element or `ng-template` as the icon slot inside `mlv-sidebar-item` or `mlv-sidebar-group`. `MlvStructural` exposes `templateRef: TemplateRef<unknown>` used by the parent component via `ngTemplateOutlet`.

No inputs, outputs, or host bindings.

---

### `MlvSidebarItemHost`

**File:** `libs/core/sidebar/src/lib/sidebar-item-host.ts`
**Selector:** `[mlvSidebarItem]`

Legacy attribute directive that applies sidebar item CSS classes and ARIA attributes to any host element (e.g., an `<a>` tag).

#### Inputs

| Name     | Type      | Default | Description                                                 |
| -------- | --------- | ------- | ----------------------------------------------------------- |
| `active` | `boolean` | `false` | Whether the item is the currently active navigation target. |

#### Host Bindings

```ts
host: {
  class: 'mlv-sidebar-item',
  '[class.mlv-sidebar-item--active]': 'active()',
  role: 'treeitem',
  '[attr.aria-selected]': 'active()',
  tabindex: '0',
}
```

---

### `MlvSidebarItemTitle`

**File:** `libs/core/sidebar/src/lib/sidebar-item-host.ts`
**Selector:** `[mlvSidebarItemTitle]`
**Extends:** `MlvStructural` (from `@malva-ui/core/form-utils`)

Marks a custom title template inside `mlv-sidebar-item`. When present, its `templateRef` is rendered in the `.mlv-sidebar-item__label` slot instead of the plain `label()` string. Useful for projecting a router `<a>` link.

#### Inputs

| Name     | Type                                  | Default | Description                                                                                                                                                              |
| -------- | ------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `active` | `BooleanInput` (coerced to `boolean`) | `false` | Optional active state on the directive (available but not currently consumed by `MlvSidebarItem`). Supports attribute usage: `<ng-template mlvSidebarItemTitle active>`. |

No host bindings.

---

## Services

This library contains no standalone services. Group flyout behavior uses Angular CDK `Overlay` injected directly into `MlvSidebarGroup`.

---

## Interfaces & Types

### `MlvSidebarContextValue`

**File:** `libs/core/sidebar/src/lib/sidebar-context.ts`

```ts
export interface MlvSidebarContextValue {
  readonly collapsed: Signal<boolean>;
  readonly inFlyout?: Signal<boolean>;
  readonly mode: Signal<MlvSidebarMode>;
  readonly effectiveMode?: Signal<MlvSidebarMode>;
  toggle(): void;
  setWidth(px: number): void;
}
```

| Field           | Type                                  | Description                                                                                                                                                                                   |
| --------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collapsed`     | `Signal<boolean>`                     | Whether the parent sidebar is in collapsed (icon-only) mode.                                                                                                                                  |
| `inFlyout`      | `Signal<boolean> \| undefined`        | Set by `MlvSidebarGroup` to `true` when rendering inside the CDK overlay flyout. Causes child items to render in expanded mode despite the sidebar being collapsed.                           |
| `mode`          | `Signal<MlvSidebarMode>`              | The layout mode requested by the author (`'icon'`, `'offcanvas'`, `'floating'`, or `'fixed'`).                                                                                                |
| `effectiveMode` | `Signal<MlvSidebarMode> \| undefined` | The mode actually in effect — `'offcanvas'` while a `collapseBelow` override is active. **Optional** so externally implemented contexts stay valid; read it as `effectiveMode?.() ?? mode()`. |
| `toggle`        | `() => void`                          | Toggles the sidebar between collapsed and expanded. No-op when the effective mode is `fixed`.                                                                                                 |
| `setWidth`      | `(px: number) => void`                | Sets the sidebar width in pixels, clamped to `[minWidth, maxWidth]`. Used by `MlvSidebarRail` during drag.                                                                                    |

---

## Injection Tokens

### `SIDEBAR_CONTEXT`

**File:** `libs/core/sidebar/src/lib/sidebar-context.ts`

| Property    | Value                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Token name  | `SIDEBAR_CONTEXT`                                                                                                                |
| Type        | `InjectionToken<MlvSidebarContextValue>`                                                                                         |
| Description | Carries the sidebar's `collapsed` signal (and optionally `inFlyout`) down the component tree to all descendant groups and items. |

**Provided by:**

- `MlvSidebar` — provides itself (implements `MlvSidebarContextValue`); `collapsed` comes from its input signal.
- `MlvSidebarGroup` — re-provides a factory object that proxies the parent `collapsed`/`mode`/`effectiveMode` signals and adds `inFlyout: group.flyoutOpen`.

**Consumed by:**

- `MlvSidebarGroup` — reads `parentCtx?.collapsed()` to switch between accordion and icon-button layouts.
- `MlvSidebarItem` — reads `ctx?.collapsed()` and `ctx?.inFlyout?.()` to compute `isCollapsed`.
- `MlvSidebarRail` — reads `collapsed()`, calls `toggle()` and `setWidth()` during drag/keyboard interactions.
- `MlvSidebarTrigger` — reads `collapsed()` and `effectiveMode?.() ?? mode()`, calls `toggle()` on click, and exposes its native button through `focusTarget()`, the point-in-time `offcanvasFocusTarget()`, and the stable disposal-time `restoreFocusResolver`. Injects the token **optionally** so it can be pointed at a sidebar with its `sidebar` input from outside the sidebar tree.

---

## Styles

All components use `ViewEncapsulation.None`, so all classes are global. The BEM structure is:

### State surfaces (`--mlv-sidebar-hover-bg` / `-active-bg` / `-rail-color`)

Three component-scoped variables declared on `.mlv-sidebar` (`sidebar.scss`)
carry every state fill in the sidebar. They are the **only** supported seam for
a host that paints the sidebar on its own chrome.

| Variable                   | Default                           | Consumed by                                                                                                                                                                                                                 |
| -------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--mlv-sidebar-hover-bg`   | `var(--mlv-background-neutral-1)` | `mlv-sidebar-item:hover/:focus-visible`, `.mlv-sidebar-group__header:hover/:focus-visible`, `.mlv-sidebar-group__icon-btn:hover/:focus-visible`, `.mlv-sidebar-trigger__btn:hover`, `.mlv-sidebar-workspace__trigger:hover` |
| `--mlv-sidebar-active-bg`  | `var(--mlv-background-selected)`  | `.mlv-sidebar-item--active` and `.mlv-sidebar-group__icon-btn--active` (both including their `:hover`/`:focus-visible` states)                                                                                              |
| `--mlv-sidebar-rail-color` | `var(--mlv-border-normal)`        | `.mlv-sidebar-group__content.mlv-expand--open` tree line                                                                                                                                                                    |

**Why they exist.** The three globals resolve against the _page_ surface. A host
that renders the sidebar on an arbitrary background — `mlv-page-shell` puts the
rail on the brand colour — got a global grey hover pill and a global lavender
active pill floating on that background, the lavender one under a white icon
(1.16:1, effectively invisible). Remapping the globals wholesale is not an
option: they are also read by everything else the consumer projects.

**Every use site repeats the global as the `var()` fallback**
(`var(--mlv-sidebar-hover-bg, var(--mlv-background-neutral-1))`). The group
flyout is portalled into the CDK overlay container, outside `.mlv-sidebar`, so
the declarations never reach a row rendered there — the fallback is what
renders, and a bare `var(--mlv-sidebar-hover-bg)` would resolve to nothing.

**Specificity.** Both `--active` rules are written against the block class
(`.mlv-sidebar-item.mlv-sidebar-item--active`, and the same for
`__icon-btn`), including explicit `:hover`/`:focus-visible` variants. The
modifier alone is one class and loses to the sibling `:hover` rule (class +
pseudo-class), which used to drop the active row back to the hover tint on
hover.

**`.mlv-sidebar-group__header--active` stays text-only** (action colour + bold,
no pill) on purpose: the accordion is open when a child is active, that child
already carries the pill, and a second pill on the header would read as two
active destinations rather than one active section.

`mlv-page-shell` remaps all three (plus the `--mlv-background-neutral-1`
hover/active ramp) from its computed chrome foreground — see `libs-page.md` →
**Chrome token remap**. The compiled-Sass contract is pinned by
`libs/core/sidebar/src/lib/sidebar-state-tokens.spec.ts`.

### `mlv-sidebar` (block — `sidebar.scss`)

| Class                      | Type     | Description                                                                                                  |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `mlv-sidebar`              | Block    | Root sidebar element.                                                                                        |
| `mlv-sidebar__container`   | Element  | Inner flex column container; drives width animation and defines `--_label-w`.                                |
| `mlv-sidebar__header`      | Element  | Sticky top region (applied by `[mlvSidebarHeader]`). `flex-shrink: 0`.                                       |
| `mlv-sidebar__content`     | Element  | Scrollable middle region (applied by `[mlvSidebarContent]`). `flex: 1 1 0`.                                  |
| `mlv-sidebar__footer`      | Element  | Sticky bottom region (applied by `[mlvSidebarFooter]`). `flex-shrink: 0`.                                    |
| `mlv-sidebar--collapsed`   | Modifier | Applied when `_effectiveCollapsed()` is true; switches to icon-only layout.                                  |
| `mlv-sidebar--icon`        | Modifier | Applied when `mode()` is `'icon'` (default). No additional styles beyond base.                               |
| `mlv-sidebar--offcanvas`   | Modifier | Removes border, shadow, padding; container fills drawer width.                                               |
| `mlv-sidebar--floating`    | Modifier | `position: absolute`, elevated shadow, `translateX(-100%)` when collapsed.                                   |
| `mlv-sidebar--fixed`       | Modifier | Applied when `mode()` is `'fixed'`. No additional styles (collapse is suppressed via `_effectiveCollapsed`). |
| `mlv-sidebar--full-height` | Modifier | `position: sticky`, `height: 100dvh` minus offsets, `align-self: flex-start`.                                |

### `mlv-sidebar-group` (block — `sidebar-group.scss`)

| Class                                 | Type                      | Description                                                                    |
| ------------------------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| `mlv-sidebar-group`                   | Block                     | Accordion group wrapper (visible in expanded mode).                            |
| `mlv-sidebar-group__header`           | Element                   | Clickable button that toggles the accordion.                                   |
| `mlv-sidebar-group__header--active`   | Modifier                  | Applied when a child item is active; action color + bold.                      |
| `mlv-sidebar-group__icon`             | Element                   | Wraps the projected icon in the header.                                        |
| `mlv-sidebar-group__label`            | Element                   | Text label in the header; truncates with ellipsis.                             |
| `mlv-sidebar-group__arrow`            | Element                   | Chevron SVG icon.                                                              |
| `mlv-sidebar-group__arrow--open`      | Modifier                  | Rotates chevron 180° when expanded.                                            |
| `mlv-sidebar-group__content`          | Element                   | Collapsible content panel with tree-line left border.                          |
| `mlv-sidebar-group__content--enter`   | Modifier                  | Triggers `mlv-accordion--enter` animation on open.                             |
| `mlv-sidebar-group__content--leave`   | Modifier                  | Triggers `mlv-accordion--leave` animation on close.                            |
| `mlv-sidebar-group__icon-btn`         | Standalone element        | Icon-only button shown in collapsed sidebar mode.                              |
| `mlv-sidebar-group__icon-btn--active` | Modifier                  | Active pill (`--mlv-sidebar-active-bg`) + action color when a child is active. |
| `mlv-sidebar-group__tooltip`          | Element (of `__icon-btn`) | Hover tooltip label shown to the right of the icon button.                     |
| `mlv-sidebar-group__flyout`           | Standalone element        | CDK overlay flyout panel container (`role="menu"`).                            |
| `mlv-sidebar-group__flyout-header`    | Element                   | Flex heading row with bottom separator inside the flyout.                      |
| `mlv-sidebar-group__flyout-title`     | Element                   | Group label inside the flyout header (`flex: 1`, ellipsis).                    |
| `mlv-sidebar-group__flyout-badge`     | Element                   | Optional badge next to the flyout title.                                       |
| `mlv-sidebar-group__badge`            | Element                   | Trailing badge in the expanded accordion header.                               |
| `mlv-sidebar-group__status`           | Element (of `__icon-btn`) | Decorative collapsed-rail status dot (`mlv-status-indicator`).                 |

### `mlv-sidebar-item` (block — `sidebar-item.scss`)

| Class                         | Type     | Description                                                                           |
| ----------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `mlv-sidebar-item`            | Block    | Individual navigation item.                                                           |
| `mlv-sidebar-item__label`     | Element  | Text label; fixed width drives smooth collapse animation.                             |
| `mlv-sidebar-item__badge`     | Element  | Trailing badge (`mlv-badge`) shown after the label when expanded.                     |
| `mlv-sidebar-item__status`    | Element  | Decorative collapsed-rail status dot (`mlv-status-indicator`), top-right of the icon. |
| `mlv-sidebar-item__tooltip`   | Element  | Collapsed-mode tooltip; always in DOM, shown on hover/focus-visible.                  |
| `mlv-sidebar-item--active`    | Modifier | Active pill (`--mlv-sidebar-active-bg`), action text color, `font-weight: 600`.       |
| `mlv-sidebar-item--collapsed` | Modifier | Square icon-only layout; label shrinks to `width: 0; opacity: 0`.                     |

### `mlv-sidebar-rail` (block — `sidebar-rail.scss`)

| Class                        | Type     | Description                                                        |
| ---------------------------- | -------- | ------------------------------------------------------------------ |
| `mlv-sidebar-rail`           | Block    | Vertical resize handle positioned on the sidebar's right edge.     |
| `mlv-sidebar-rail--dragging` | Modifier | Applied during pointer drag; same visual as `:hover` (accent bar). |

### `mlv-sidebar-trigger` (block — `sidebar-trigger.scss`)

| Class                         | Type     | Description                                            |
| ----------------------------- | -------- | ------------------------------------------------------ |
| `mlv-sidebar-trigger`         | Block    | Wrapper for the toggle button. `display: inline-flex`. |
| `mlv-sidebar-trigger--hidden` | Modifier | `display: none`. Applied in `fixed` mode.              |
| `mlv-sidebar-trigger__icon`   | Element  | Icon SVG with smooth transform transition.             |

---

## Usage Examples

### Basic sidebar with items

```html
<mlv-sidebar>
  <mlv-sidebar-item label="Dashboard">
    <ng-template mlvSidebarItemIcon>
      <lucide-icon name="layout-dashboard" size="20" />
    </ng-template>
    <ng-template mlvSidebarItemTitle>
      <a routerLink="/dashboard" routerLinkActive>Dashboard</a>
    </ng-template>
  </mlv-sidebar-item>

  <mlv-sidebar-item label="Settings">
    <ng-template mlvSidebarItemIcon>
      <lucide-icon name="settings" size="20" />
    </ng-template>
    <ng-template mlvSidebarItemTitle>
      <a routerLink="/settings" routerLinkActive>Settings</a>
    </ng-template>
  </mlv-sidebar-item>
</mlv-sidebar>
```

### Collapsible sidebar with a toggle button

```typescript
// In your component
readonly sidebarCollapsed = signal(false);
```

```html
<mlv-sidebar [collapsed]="sidebarCollapsed()" width="260px" collapsedWidth="56px">
  <mlv-sidebar-item label="Home">
    <ng-template mlvSidebarItemIcon>
      <lucide-icon name="home" size="20" />
    </ng-template>
    <ng-template mlvSidebarItemTitle>
      <a routerLink="/home" routerLinkActive>Home</a>
    </ng-template>
  </mlv-sidebar-item>
</mlv-sidebar>

<button type="button" (click)="sidebarCollapsed.update(v => !v)">Toggle sidebar</button>
```

### Badges on items and groups

Use the `badge`/`badgeTone` inputs (the sanctioned path) instead of embedding a
badge inside a projected `[mlvSidebarItemTitle]`. When expanded the item/group
shows a trailing `mlv-badge`; when the sidebar collapses the badge is replaced by
a `mlv-status-indicator` dot on the icon rail (a full badge does not fit), and the
count is folded into the accessible name. Groups also show the badge next to the
flyout title when collapsed. `badgePulse` makes the collapsed dot pulse.

```html
<mlv-sidebar [collapsed]="collapsed()">
  <mlv-sidebar-item label="Inbox" badge="128" badgeTone="info">
    <ng-template mlvSidebarItemIcon><svg lucideInbox size="20" /></ng-template>
  </mlv-sidebar-item>

  <mlv-sidebar-item label="Orders" badge="New" badgeTone="success">
    <ng-template mlvSidebarItemIcon><svg lucidePackage size="20" /></ng-template>
  </mlv-sidebar-item>

  <mlv-sidebar-group label="Users & Access" badge="3" badgeTone="warning">
    <ng-template mlvSidebarItemIcon><svg lucideUsers size="20" /></ng-template>
    <mlv-sidebar-item label="Invitations" badge="3" badgeTone="warning" />
  </mlv-sidebar-group>
</mlv-sidebar>
```

### Sidebar with collapsible groups

When the sidebar is **expanded**, groups render as an accordion. When the sidebar is **collapsed**, each group renders as an icon button that opens a CDK overlay flyout on click — no extra configuration needed.

```html
<mlv-sidebar [collapsed]="isCollapsed()">
  <mlv-sidebar-group label="Analytics">
    <ng-template mlvSidebarItemIcon>
      <lucide-icon name="bar-chart-2" size="20" />
    </ng-template>

    <mlv-sidebar-item label="Overview">
      <ng-template mlvSidebarItemTitle>
        <a routerLink="/analytics/overview" routerLinkActive>Overview</a>
      </ng-template>
    </mlv-sidebar-item>

    <mlv-sidebar-item label="Reports">
      <ng-template mlvSidebarItemTitle>
        <a routerLink="/analytics/reports" routerLinkActive>Reports</a>
      </ng-template>
    </mlv-sidebar-item>
  </mlv-sidebar-group>

  <mlv-sidebar-group label="Settings">
    <ng-template mlvSidebarItemIcon>
      <lucide-icon name="settings" size="20" />
    </ng-template>

    <mlv-sidebar-item label="Profile">
      <ng-template mlvSidebarItemTitle>
        <a routerLink="/settings/profile" routerLinkActive>Profile</a>
      </ng-template>
    </mlv-sidebar-item>
  </mlv-sidebar-group>
</mlv-sidebar>
```

### Explicit active state (without router)

```html
<mlv-sidebar>
  <mlv-sidebar-item label="Dashboard" [active]="selectedItem() === 'dashboard'" (click)="selectedItem.set('dashboard')">
    <ng-template mlvSidebarItemIcon>
      <lucide-icon name="layout-dashboard" size="20" />
    </ng-template>
  </mlv-sidebar-item>
</mlv-sidebar>
```

### Legacy directive usage on anchor elements

`[mlvSidebarItem]` can be applied to native elements when the component-based approach is not needed:

```html
<mlv-sidebar>
  <a mlvSidebarItem [active]="currentRoute === '/home'" routerLink="/home">Home</a>
  <a mlvSidebarItem [active]="currentRoute === '/settings'" routerLink="/settings">Settings</a>
</mlv-sidebar>
```

---

## Internationalization (i18n)

The `mlv-sidebar` landmark `aria-label` resolves through `MLV_SIDEBAR_I18N` (`@malva-ui/i18n`) key `navigation` — unless the author sets the `ariaLabel` input, which wins. The badge count folded into a collapsed item/group accessible name resolves through the `notifications` ICU-plural key (`"{count, plural, one {# notification} other {# notifications}}"`). `mlv-sidebar-workspace` uses the `switchWorkspace` ICU key (parameter `{ workspace }`) for its trigger and `workspaceMenu` for its menu label. The sidebar trigger uses `expand`/`collapse` in rail mode and `openNavigation`/`closeNavigation` while it is a drawer (offcanvas) menu button. ICU values resolve through `MlvI18nResolverService`. Provide `provideMlvI18nTesting()` in specs that instantiate any sidebar component.

## Dependencies

### Workspace libraries

| Library                           | Usage                                                                                                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@malva-ui/core/form-utils`       | `MlvStructural` — base class for `MlvSidebarItemIcon` and `MlvSidebarItemTitle`; exposes `templateRef: TemplateRef<unknown>`.                                                                              |
| `@malva-ui/core/popup`            | `MlvPopup`, `MlvPopupContainer`, `MlvPopupTrigger`, `MlvPopupContent` — powers the group flyout (collapsed mode) and the item tooltip (collapsed mode).                                                    |
| `@malva-ui/core/expand`           | `MlvExpand` — animated accordion panel used by `MlvSidebarGroup` in expanded mode.                                                                                                                         |
| `@malva-ui/core/drawer`           | `MlvDrawer` — off-canvas panel used by `MlvSidebar` in `offcanvas` mode.                                                                                                                                   |
| `@malva-ui/core/scrollbar`        | `MlvScrollbar` — themed scrolling for named sidebar content and legacy unslotted content.                                                                                                                  |
| `@malva-ui/core/badge`            | `MlvBadge` (+ `MlvBadgeTone` type) — trailing badge on items/groups (expanded) and the flyout title.                                                                                                       |
| `@malva-ui/core/status-indicator` | `MlvStatusIndicator` — decorative status dot replacing the badge on the collapsed icon rail.                                                                                                               |
| `@malva-ui/core/button`           | `MlvButton` — accessible transparent workspace trigger styling/semantics.                                                                                                                                  |
| `@malva-ui/core/list`             | `MlvListItem` — workspace rows inside the switcher menu.                                                                                                                                                   |
| `@malva-ui/core/menu`             | `MlvMenu`, `MlvMenuTrigger`, `MlvMenuItem` — workspace overlay, roving focus, type-ahead, dismissal, and focus restoration.                                                                                |
| `@malva-ui/i18n`                  | `MLV_SIDEBAR_I18N` (`navigation`, `notifications`, `switchWorkspace`, `workspaceMenu`, `expand`, `collapse`, `openNavigation`, `closeNavigation`) + `MlvI18nResolverService` — localized accessible names. |
| `@malva-ui/styles`                | Design tokens (`--mlv-*` CSS custom properties), `mixins.base()`, `mlv-accordion--enter`/`mlv-accordion--leave` keyframes.                                                                                 |

### External packages

| Package                      | Usage                                                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@angular/cdk/coercion`      | `BooleanInput`, `coerceBooleanProperty` — boolean input coercion on `fullHeight` and `active`.                                                                                                                            |
| `@angular/router`            | `RouterLink`, `RouterLinkActive` — used by `MlvSidebarItem` to auto-detect active state from projected router links.                                                                                                      |
| `@lucide/angular`            | Sidebar group/trigger icons (`LucidePanelLeftOpen`/`LucidePanelLeftClose` for the rail toggle, `LucideMenu`/`LucideX` for the drawer menu button) plus `LucideChevronsUpDown` and `LucideCheck` in `MlvSidebarWorkspace`. |
| `@angular/common`            | `NgTemplateOutlet` — template rendering in `MlvSidebar` (shared body outlet), `MlvSidebarGroup`, and `MlvSidebarItem`; `DOCUMENT` — resolving the overlay-rendered flyout panel by id in `MlvSidebarGroup`.               |
| `@angular/core/rxjs-interop` | `takeUntilDestroyed` — manages `RouterLinkActive.isActiveChange` subscription lifecycle in `MlvSidebarItem`.                                                                                                              |
| `@malva-ui/cdk/utils`        | `clamp` (`MlvSidebar.setWidth`), `mlvNextId` (`MlvSidebarGroup` flyout id), `MlvBreakpointService` + `MlvBreakpoint` (`MlvSidebar.collapseBelow`).                                                                        |

---

## Accessibility notes (updated)

- **Direction (RTL): scoped, not per-document.** `MlvSidebarGroup`'s flyout keyboard handlers pass their host to `MlvRtlService.normalizeArrowKey(event, host)` — the group host is the flyout's popup origin, so host and pane agree by construction — and a group inside a `[dir="rtl"]` subtree mirrors while the document stays LTR. `MlvSidebar`'s own container nav omits the target on purpose: it answers only the vertical pair. Regressions in `sidebar.spec.ts`.
- `MlvSidebarItem` never uses an invalid `role="listitem"` (which requires a `role="list"` ancestor) on an interactive host. The host is interactive (`role="button"` — or `role="menuitem"` inside a collapsed-group flyout — with `tabindex="0"` + `aria-label`) **unless the projected content already contains its own focusable control** (detected after render by scanning for `a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])`), in which case the host is a presentational wrapper and that control (e.g. a router `<a>`) is the single interactive element. This keeps text/badge-only title rows named and keyboard-operable while never nesting two focusable controls. Container arrow-nav (`MlvSidebar`) and flyout arrow-nav (`MlvSidebarGroup`) resolve each item to its actual focus target.
- `aria-current="page"` is applied to the active item host. When the interactive element is a projected router link, also set `ariaCurrentWhenActive="page"` on its `routerLinkActive` for the current-page cue on the link itself.
- Collapsed-mode tooltips (item and group) use `panelRole="tooltip"` and open on keyboard focus (`focusin`/`focus`) as well as hover (WCAG 1.4.13).
- The collapsed group flyout is a proper menu: the trigger sets `[ariaHasPopup]="'menu'"`, the flyout panel is `role="menu"`, and its interactive item rows are `role="menuitem"`. Opening the flyout (click / Enter / Space / ArrowRight) moves focus to the first item; `Escape`/`ArrowLeft` close it and restore focus to the trigger; **activating a child item inside it** (click, or Enter/Space, which the item turns into a click) also closes it and restores focus to the trigger, as the menu-button pattern requires — without that a `routerLink` navigation left the flyout hanging over the new page; focus leaving the panel (Tab out) closes it so it is never left orphaned-open. A subtle `›` corner glyph on the collapsed group icon button distinguishes a group (opens a flyout) from a plain item.
- Badge counts stay announced without noise: the collapsed status dot is decorative (`aria-hidden`, no role/name), and the count is folded into the interactive host/trigger `aria-label` (numeric → the `notifications` ICU plural, e.g. `"Projects, 3 notifications"`; other values verbatim). The visible expanded badge is `aria-hidden` since the host `aria-label` already carries the count. When a projected router `<a>` is the interactive element the host has no `aria-label`, so use the `badge` input (not a badge inside a projected link) when the count must reach assistive tech.

---

## Responsive usage

Set **`collapseBelow`** (`MlvBreakpoint` = `'sm' | 'md' | 'lg'`, default `null` = off) and the sidebar owns the breakpoint itself — no `matchMedia` wiring, and the consumer never touches `mode`:

```html
<mlv-sidebar #nav collapseBelow="md" closeOnActivation [(collapsed)]="collapsed" ariaLabel="Product navigation">
  <div mlvSidebarContent>…</div>
</mlv-sidebar>

<!-- Outside the sidebar: a closed drawer renders none of its projected content. -->
<mlv-sidebar-trigger [sidebar]="nav" />
```

Below the breakpoint:

- `effectiveMode()` reports `'offcanvas'` regardless of `mode` (including `'fixed'`), so the host gets `.mlv-sidebar--offcanvas` and the drawer branch renders.
- The sidebar **closes itself** on entry (the previous `collapsed()` value is stored and restored when the viewport grows back past the breakpoint).
- `mlv-sidebar-trigger` becomes a hamburger (`lucideMenu`) / close (`lucideX`) menu button, is no longer hidden by `mode="fixed"`, and is named `openNavigation`/`closeNavigation`.
- Dismissal is the normal offcanvas behaviour inherited from `mlv-drawer`: Escape, backdrop click, or the trigger. The drawer captures focus on open and only mounts its content while open.
- `closeOnActivation` is optional and defaults to `false`. When enabled, a projected navigation or action activation also dismisses the compact drawer; desktop/inline behavior is unchanged. Focus returns to the external trigger for ordinary navigation. An activation-opened `dialog` or `alertdialog` retains focus through Drawer disposal; configure that modal with `restoreFocus: externalTrigger.restoreFocusResolver` (pass the function, do not invoke it). Because Dialog samples it at disposal, a dialog that survives either breakpoint direction restores to the connected external trigger in offcanvas mode or its reconnected projected opener in inline mode. Detached and hidden stale targets are never selected.

Thresholds come from `MLV_BREAKPOINT_CONFIG` (override with `provideMlvBreakpoints({ md, lg })`) so they stay in sync with the SCSS `breakpoint-*` mixins. Detection goes through `MlvBreakpointService` → CDK `BreakpointObserver`, which is SSR-safe: on the server it resolves to the initial `'sm'` tier instead of touching `matchMedia`.

Driving `mode` yourself from a `BreakpointObserver` signal still works and is the way to get a responsive behaviour other than offcanvas (for example `'icon'` ↔ `'floating'`).
