---
# Library: split-pane

> **Keep this file up to date.** Whenever this library's components, directives, services, or public API change, update this document.

## Overview

`@malva-ui/core/split-pane` provides a resizable split-pane container for dividing screen space into two or more panels separated by draggable handles. Panels are declared as `<mlv-split-pane-panel>` children; the parent automatically inserts drag handles between each adjacent pair and manages sizes via CSS `grid-template-columns` / `grid-template-rows` in fractional units.

Key features:
- Horizontal (side-by-side) and vertical (top/bottom) orientations
- Any number of panels (2+), added, removed or reordered at runtime (`@if` / `@for`); `orientation` may change at runtime too (#359)
- Pointer-capture drag resize using RxJS streams
- Keyboard resize via arrow keys (±1% per press) and Home/End (jump to min-size boundary)
- Per-panel `size` (initial %) and `minSize` (floor %) inputs
- `role="separator"` + `tabindex="0"` on each handle for WCAG AA compliance
- Fully CSS-driven grip visuals — no icon library dependency

---

## Public API

| Export                    | Kind       | Description                                                                            |
| ------------------------- | ---------- | -------------------------------------------------------------------------------------- | ----------- |
| `MlvSplitPane`            | Component  | Container that divides its children into resizable panels. Selector: `mlv-split-pane`. |
| `MlvSplitPanePanel`       | Component  | Individual panel inside a `mlv-split-pane`. Selector: `mlv-split-pane-panel`.          |
| `MlvSplitPaneOrientation` | Type alias | `'horizontal'                                                                          | 'vertical'` |

> **Note:** `MlvSplitPaneStart` (`[mlvSplitPaneStart]`) and `MlvSplitPaneEnd` (`[mlvSplitPaneEnd]`) exist as source files but are **not** exported from the public `index.ts`. They are internal slot markers only.

---

## Components

### `MlvSplitPane`

```
Selector:          mlv-split-pane
Template:          inline — <ng-content />
Change Detection:  OnPush
Encapsulation:     None (BEM scoping)
```

#### Inputs

| Input         | Type                      | Default        | Description                                                                         |
| ------------- | ------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| `orientation` | `MlvSplitPaneOrientation` | `'horizontal'` | `'horizontal'` renders panels side-by-side; `'vertical'` stacks them top-to-bottom. |

#### Outputs

None.

#### Host Bindings

| Binding                              | Value                                                |
| ------------------------------------ | ---------------------------------------------------- |
| `class`                              | `'mlv-split-pane'` (static)                          |
| `[class.mlv-split-pane--horizontal]` | `orientation() === 'horizontal'`                     |
| `[class.mlv-split-pane--vertical]`   | `orientation() === 'vertical'`                       |
| `[class.mlv-split-pane--dragging]`   | `_isDragging()` — set while a pointer drag is active |

#### Internal API

| Member                  | Description                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `ngAfterContentChecked` | Sets `_contentChecked`, runs `_syncStructure()` (see _Structure_ below). Lifecycle hook, not for consumer calls. |

#### Content Children

| Query     | Type                                 | Description                                                                                                                                    |
| --------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `_panels` | `contentChildren(MlvSplitPanePanel)` | All direct `mlv-split-pane-panel` children. Every change to the list rebuilds the handles, sizes and grid template (`_syncStructure()`, #359). |

#### Behaviour

- **Structure (#359)**: `_syncStructure()` runs `_layout()` — carry sizes, reconcile handles, write the grid template — whenever the panel list (`_panels()`, by array identity) or `orientation()` differs from what was last laid out (`_laidOutPanels` / `_laidOutOrientation`), on the first render and on every later change. Before, all of it ran once in `ngAfterContentInit`: a runtime `orientation` flip kept the old grid property and handle ARIA, a panel added at runtime fell into an implicit second grid row with no handle, and a removed panel left an orphan handle whose ArrowRight threw `TypeError … minSize`. Pinned by `split-pane-structure.spec.ts` (25 of its 34 specs red on `main`) and the pure `split-pane-sizes.spec.ts`.
  - **Two callers, one idempotent sync** — the second to see a change finds it laid out and does nothing. Each checks list identity and orientation first, so an unchanged pass does nothing else.
    - **`ngAfterContentChecked`** runs after the declaring view's embedded views, so every panel an `@if`, a `@for` or a structural directive stamped is there and bound. It takes the **first layout**, from the whole list at once, at exactly the point the former `ngAfterContentInit` took it (same hook slot, same pass), and every later change a refresh of that view brings. It lays out whatever it finds — no `_bound` check — so a panel whose embedded view is detached from change detection (never bound, no `ngOnInit`) is laid out with its input defaults, as before. Ablating it turns 21 specs red.
    - **A constructor `effect`** tracks the list, the orientation and the `_bound` of each panel it has not laid out yet. A view effect runs in the declaring view's refresh after that view's own bindings but **before its embedded views**: a panel nested in `@if { @for }`, or stamped by a directive's own effect (`*mlvBreakpointUp` already at its breakpoint), is not in `_panels()` yet, and a panel an `@if` / `@for` just stamped is there with its `[size]` unbound (`undefined` is also a valid bound value). So the effect **never takes the first layout** — it returns until `_contentChecked` is set (after every signal read, so the dependencies stay tracked; ablating that gate lays such a panel out as an _added_ one, 30 / 36.67 / 33.33 instead of 30 / 35 / 35, and turns exactly the two init-shape specs red) — and after it waits until every panel it has **not laid out yet** is `_bound` (set in the panel's `ngOnInit`); the flip re-runs it. Panels already laid out are never waited for, so a detached one cannot hold a later change back (guard over every panel instead: exactly that spec red). The effect is the only caller that sees a list change made while the declaring view is merely traversed — `*mlvBreakpointUp` stamping a panel from its own effect under an OnPush host (ablating the effect: 2 red). Ablating the `_bound` guard: 10 red; with the `_contentChecked` gate too: 21.
  - **First layout and server payload = `main`**, both callers running during change detection on the server as well — measured byte-identical, branch vs `main`, for six shapes (static + `@if`, static vertical, `@for` only, sizeless `@if { @for }` at init, sizeless `*mlvBreakpointUp` already at `lg`, a detached panel): the client markup seen from inside an embedded view's `ngOnInit`, at the host's `ngAfterViewInit` and after stability (18 captures), and the `renderApplication` payload (6).
  - **Sizes are carried by panel instance, never by index** (`mlvCarrySplitPaneSizes`, `split-pane-sizes.ts`, internal): a surviving panel keeps the size the user dragged it to. A **removed** panel's size goes to the nearest survivor before it, else after it. An **added** panel asks for its own `size`, else an equal share (current total ÷ new count), taken from survivors nearest first (before it, then after it), none below its `minSize`; if they cannot give it all, it gets what they gave — the donors' floors win over its own, so it can start **below its own `minSize`, at `0`** when every donor is at its floor. Heirs and donors are searched in the same order, so removing a panel and adding it back with the same `size` restores the layout exactly. The total is preserved. With fewer than two panels nothing is split — every handle and the inline template go — and a later second panel starts over from the `size` inputs. `size` is the initial size only: a change on a panel **already laid out** is not tracked. `minSize` is read live on every drag move and key press, so a change applies from the next interaction, but raising it does not re-clamp a panel that is already below the new floor (follow-up).
  - **Handles are reconciled by DOM gap, never moved** (moving a node blurs it): a handle belongs to the pair after the last panel before it. Each pair keeps one handle — the focused one, else the first — and a pair with none gets a new one inserted right after its first panel. Every other handle (before the first panel, after the last, a second one in one pair) is removed with its listeners (a per-handle `Subscription`). The pair a handle resizes is read from its position in `_handles` when a key or pointer arrives, not fixed at creation.
  - **Focus**: a focused handle that survives keeps focus. A focused handle that is removed hands focus to the nearest kept handle first — the first when it sat before the first panel, else the last — so it never drops to `<body>` while a handle remains; with one panel left nothing in the split pane can take it. Focus is read from the handle's own root (`getRootNode()`), not the ambient `document`.
  - **Orientation flip** removes the other axis's inline property before writing the new one (`_templateProperty`), so the host never carries both, and re-labels every handle in place (`aria-label`, `aria-orientation`, grip modifier) — the same nodes, focus kept.
- **Drag**: each handle wires a `pointerdown → pointermove → end` RxJS chain using `fromEvent` + `switchMap` + `takeUntilDestroyed` (last in the pipe, so a destroy tears down the active gesture). Pointer capture is set on `pointerdown` to track the pointer even when it leaves the element (a `setPointerCapture` that throws — an inactive pointer — is caught). Only the two panels adjacent to the dragged handle resize; all others are unaffected. **The stream runs via `NgZone.runOutsideAngular`**: each `pointermove` writes the grid template imperatively (`_applyGridTemplate`) and buffers the running sizes in `_dragSizes` **without touching a signal**, so a fast drag no longer schedules an OnPush change-detection pass per move. Only `_isDragging` (a host-class binding) and the single final `_sizes` commit re-enter the zone (`NgZone.run`) — `_isDragging` on `pointerdown`, and both `_isDragging=false` + `_sizes.set(_dragSizes)` once when the gesture ends. There are no per-move outputs, so no emission-timing contract is affected.
- **Gesture end (#338)**: a drag starts from a primary-button press while no drag is running, follows only its own `pointerId`, and ends on `pointerup`, `pointercancel` or the handle losing capture (`mlvPointerGestureEnd`, `@malva-ui/cdk/utils`, internal) — on any structure rebuild (`_dragInterrupted`, #359: the drag measured the old list and axis) and on destroy; removing the dragged handle also releases its drag subscription. Every end runs `_endDrag()` from `finalize`: clears the page-wide `cursor` / `user-select` (on the **injected `DOCUMENT`**'s root, not the ambient global), drops `--dragging`, commits `_dragSizes` once. An interrupted drag keeps the size it reached. A second pointer pressing any handle mid-drag starts nothing (no capture, no resize) and its release does not end the first drag. A handle removed from the document mid-drag also ends it, through the document-level lost-capture arm of `mlvPointerGestureEnd`. Before, only `pointerup` ended it: a cancelled touch drag or a destroy mid-drag left both styles on `<html>` and the class latched. Pinned by `split-pane-gesture-end.spec.ts`.
- **Keyboard**: a `fromEvent` `keydown` listener on each handle (released with the handle) handles `ArrowLeft`/`ArrowRight` (horizontal) and `ArrowUp`/`ArrowDown` (vertical) for ±1% steps, and `Home`/`End` to snap to min-size boundaries, on the pair the handle splits when the key arrives.
- **Grid template**: sizes are stored as `number[]` in `fr` units (≈ percentage). `_applyGridTemplate()` rebuilds `grid-template-columns` (or `grid-template-rows`) with `0.125rem` fixed tracks for handles between panel tracks.

#### Template Summary

Inline template — renders `<ng-content />` only. All handles are inserted, re-labelled and removed imperatively via `Renderer2` by `_syncStructure()`.

---

### `MlvSplitPanePanel`

```
Selector:          mlv-split-pane-panel
Template:          inline — <ng-content />
Change Detection:  OnPush
Encapsulation:     None (BEM scoping)
```

#### Inputs

| Input     | Type                  | Default     | Description                                                                                                                                                                                                                                                                                               |
| --------- | --------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `size`    | `number \| undefined` | `undefined` | Initial size of this panel as a percentage of the container. Panels without a `size` share the remaining percentage equally.                                                                                                                                                                              |
| `minSize` | `number`              | `5`         | Minimum size of this panel as a percentage. Drag and keyboard resize cannot reduce this panel below this value. Read on every resize; raising it does not grow a panel already below it. A panel added at runtime can start below its own `minSize` (at `0`) when every panel it takes from is at theirs. |

#### Outputs

None.

#### Host Bindings

| Binding | Value                              |
| ------- | ---------------------------------- |
| `class` | `'mlv-split-pane__panel'` (static) |

#### Internal API

| Member        | Description                                                                                                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_elementRef` | `ElementRef<HTMLElement>` injected and exposed as `readonly` so the parent `MlvSplitPane` can read `getBoundingClientRect()` during drag.                                                                                                      |
| `_bound`      | Read-only signal (`asReadonly()` of a private writable one), `false` until `ngOnInit` sets it once the inputs are bound. The parent's structure effect waits for it before laying out a panel it has not laid out yet (see _Structure_ above). |
| `ngOnInit`    | Sets `_bound`. Lifecycle hook, not for consumer calls.                                                                                                                                                                                         |

---

## Directives

### `MlvSplitPaneStart` _(internal — not in public index)_

```
Selector: [mlvSplitPaneStart]
Host class: mlv-split-pane__start
```

Slot marker for the **start** pane (left in horizontal, top in vertical). Not exported from the public `index.ts`.

### `MlvSplitPaneEnd` _(internal — not in public index)_

```
Selector: [mlvSplitPaneEnd]
Host class: mlv-split-pane__end
```

Slot marker for the **end** pane (right in horizontal, bottom in vertical). Not exported from the public `index.ts`.

---

## Interfaces & Types

### `MlvSplitPaneOrientation`

```ts
type MlvSplitPaneOrientation = 'horizontal' | 'vertical';
```

Controls the axis along which panels are arranged. `'horizontal'` → column-based grid (panels side by side); `'vertical'` → row-based grid (panels stacked).

---

## Usage Examples

### Basic 2-panel (horizontal, default)

```html
<mlv-split-pane style="height: 400px;">
  <mlv-split-pane-panel [size]="30">
    <p>Sidebar content</p>
  </mlv-split-pane-panel>
  <mlv-split-pane-panel>
    <p>Main content</p>
  </mlv-split-pane-panel>
</mlv-split-pane>
```

### Vertical split

```html
<mlv-split-pane orientation="vertical" style="height: 600px;">
  <mlv-split-pane-panel [size]="40" [minSize]="20">
    <p>Top pane</p>
  </mlv-split-pane-panel>
  <mlv-split-pane-panel>
    <p>Bottom pane</p>
  </mlv-split-pane-panel>
</mlv-split-pane>
```

### 3-panel layout

```html
<mlv-split-pane style="height: 500px;">
  <mlv-split-pane-panel [size]="20" [minSize]="10">Nav</mlv-split-pane-panel>
  <mlv-split-pane-panel>Editor</mlv-split-pane-panel>
  <mlv-split-pane-panel [size]="25" [minSize]="10">Properties</mlv-split-pane-panel>
</mlv-split-pane>
```

### With Angular component integration

```ts
import { MlvSplitPane, MlvSplitPanePanel } from '@malva-ui/core/split-pane';

@Component({
  imports: [MlvSplitPane, MlvSplitPanePanel],
  template: `
    <mlv-split-pane [orientation]="splitOrientation()" style="height: 100%;">
      <mlv-split-pane-panel [size]="25" [minSize]="15">
        <app-sidebar />
      </mlv-split-pane-panel>
      <mlv-split-pane-panel>
        <app-main-content />
      </mlv-split-pane-panel>
    </mlv-split-pane>
  `,
})
export class LayoutComponent {
  readonly splitOrientation = signal<MlvSplitPaneOrientation>('horizontal');
}
```

`orientation` can change at runtime; `size` is the initial share only, read at the first layout and when the panel is added, so it is written as a literal here rather than bound to a signal the pane would ignore.

---

## Accessibility

- **Direction (RTL): scoped, not per-document.** The divider's `_onHandleKeydown` passes the cached `_direction` signal to `MlvRtlService.normalizeArrowKey(event, direction)`, so a horizontal split inside a `[dir="rtl"]` subtree mirrors its resize stepping while the document stays LTR; a vertical split is on the block axis and never mirrors. The same signal feeds the pointer maths. Regressions in `split-pane.spec.ts`.
- Each drag handle has `role="separator"`, `tabindex="0"`, and an `aria-label` (`"Resize panels horizontally"` or `"Resize panels vertically"`).
- Because the separator is focusable it is a **window splitter** and carries `aria-valuenow` / `aria-valuemin` / `aria-valuemax` (WAI-ARIA required attrs). `aria-valuenow` is the leading panel's size (%), bounded by the two adjacent panels' `minSize`; `_updateHandleAria()` refreshes these whenever sizes change (initial layout, drag, keyboard).
- `aria-orientation` is set to `"vertical"` on horizontal handles and `"horizontal"` on vertical handles (reflects the axis being split, matching the ARIA spec for separators). Both it and `aria-label` follow a runtime `orientation` change (#359).
- Axe sweeps (`split-pane-structure.spec.ts`): after an add, a removal, a flip, with one panel, and static + `@if` panels in both orientations. `core-split-pane` left `ROLLOUT_PENDING` with #359.
- Keyboard operation:
  - `ArrowLeft` / `ArrowRight` (horizontal) or `ArrowUp` / `ArrowDown` (vertical): resize by ±1%
  - `Home`: collapse the left/top panel to its `minSize`
  - `End`: expand the left/top panel to its maximum (`pairTotal − rightPanel.minSize`)
- `:focus-visible` ring uses `--mlv-border-focus` token with `outline-offset: 0.125rem`.
- The `.mlv-split-pane__handle-grip` span is `aria-hidden="true"` — decorative only.

---

## Dependencies

### Angular / third-party

- `@angular/core` — `Component`, `contentChildren`, `signal`, `effect`, `untracked`, `inject`, `DestroyRef`, `Renderer2`, `ElementRef`, `NgZone`
- `@angular/core/rxjs-interop` — `takeUntilDestroyed`
- `@angular/common` — `DOCUMENT`
- `rxjs` — `fromEvent`, `switchMap`, `filter`, `map`, `finalize`, `takeUntil`, `merge`, `Subject`, `Subscription`

### Internal Malva UI packages

- `@malva-ui/cdk/utils` — `mlvPointerGestureEnd` (internal gesture-end stream), `MlvRtlService`

- `@malva-ui/styles` — CSS design tokens via `--mlv-*` custom properties
