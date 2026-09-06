---
# Library: split-pane

> **Keep this file up to date.** Whenever this library's components, directives, services, or public API change, update this document.

## Overview

`@malva-ui/core/split-pane` provides a resizable split-pane container for dividing screen space into two or more panels separated by draggable handles. Panels are declared as `<mlv-split-pane-panel>` children; the parent automatically inserts drag handles between each adjacent pair and manages sizes via CSS `grid-template-columns` / `grid-template-rows` in fractional units.

Key features:
- Horizontal (side-by-side) and vertical (top/bottom) orientations
- Any number of panels (2+)
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

#### Content Children

| Query     | Type                                 | Description                                                                                                |
| --------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `_panels` | `contentChildren(MlvSplitPanePanel)` | All direct `mlv-split-pane-panel` children, queried after content init to compute and apply initial sizes. |

#### Behaviour

- `ngAfterContentInit`: reads `_panels()`, calls `_computeInitialSizes()` to distribute percentages, then inserts a `div.mlv-split-pane__handle` DOM node after every panel except the last via `Renderer2`.
- **Drag**: each handle wires a `pointerdown → pointermove → pointerup` RxJS chain using `fromEvent` + `switchMap` + `takeUntilDestroyed`. Pointer capture is set on `pointerdown` to track the pointer even when it leaves the element. Only the two panels adjacent to the dragged handle resize; all others are unaffected. **The stream runs via `NgZone.runOutsideAngular`**: each `pointermove` writes the grid template imperatively (`_applyGridTemplate`) and buffers the running sizes in `_dragSizes` **without touching a signal**, so a fast drag no longer schedules an OnPush change-detection pass per move. Only `_isDragging` (a host-class binding) and the single final `_sizes` commit re-enter the zone (`NgZone.run`) — `_isDragging` on `pointerdown`, and both `_isDragging=false` + `_sizes.set(_dragSizes)` once on `pointerup`. There are no per-move outputs, so no emission-timing contract is affected.
- **Keyboard**: `keydown` listeners on each handle handle `ArrowLeft`/`ArrowRight` (horizontal) and `ArrowUp`/`ArrowDown` (vertical) for ±1% steps, and `Home`/`End` to snap to min-size boundaries.
- **Grid template**: sizes are stored as `number[]` in `fr` units (≈ percentage). `_applyGridTemplate()` rebuilds `grid-template-columns` (or `grid-template-rows`) with `0.125rem` fixed tracks for handles between panel tracks.

#### Template Summary

Inline template — renders `<ng-content />` only. All handles are inserted imperatively into the DOM by `ngAfterContentInit` via `Renderer2`.

---

### `MlvSplitPanePanel`

```
Selector:          mlv-split-pane-panel
Template:          inline — <ng-content />
Change Detection:  OnPush
Encapsulation:     None (BEM scoping)
```

#### Inputs

| Input     | Type                  | Default     | Description                                                                                                                  |
| --------- | --------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `size`    | `number \| undefined` | `undefined` | Initial size of this panel as a percentage of the container. Panels without a `size` share the remaining percentage equally. |
| `minSize` | `number`              | `5`         | Minimum size of this panel as a percentage. Drag and keyboard resize cannot reduce this panel below this value.              |

#### Outputs

None.

#### Host Bindings

| Binding | Value                              |
| ------- | ---------------------------------- |
| `class` | `'mlv-split-pane__panel'` (static) |

#### Internal API

| Member        | Description                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `_elementRef` | `ElementRef<HTMLElement>` injected and exposed as `readonly` so the parent `MlvSplitPane` can read `getBoundingClientRect()` during drag. |

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
      <mlv-split-pane-panel [size]="sidebarSize()" [minSize]="15">
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
  readonly sidebarSize = signal(25);
}
```

---

## Accessibility

- **Direction (RTL): scoped, not per-document.** The divider's `_onKeydown` passes the cached `_direction` signal to `MlvRtlService.normalizeArrowKey(event, direction)`, so a horizontal split inside a `[dir="rtl"]` subtree mirrors its resize stepping while the document stays LTR; a vertical split is on the block axis and never mirrors. The same signal feeds the pointer maths. Regressions in `split-pane.spec.ts`.
- Each drag handle has `role="separator"`, `tabindex="0"`, and an `aria-label` (`"Resize panels horizontally"` or `"Resize panels vertically"`).
- Because the separator is focusable it is a **window splitter** and carries `aria-valuenow` / `aria-valuemin` / `aria-valuemax` (WAI-ARIA required attrs). `aria-valuenow` is the leading panel's size (%), bounded by the two adjacent panels' `minSize`; `_updateHandleAria()` refreshes these whenever sizes change (initial layout, drag, keyboard).
- `aria-orientation` is set to `"vertical"` on horizontal handles and `"horizontal"` on vertical handles (reflects the axis being split, matching the ARIA spec for separators).
- Keyboard operation:
  - `ArrowLeft` / `ArrowRight` (horizontal) or `ArrowUp` / `ArrowDown` (vertical): resize by ±1%
  - `Home`: collapse the left/top panel to its `minSize`
  - `End`: expand the left/top panel to its maximum (`pairTotal − rightPanel.minSize`)
- `:focus-visible` ring uses `--mlv-border-focus` token with `outline-offset: 0.125rem`.
- The `.mlv-split-pane__handle-grip` span is `aria-hidden="true"` — decorative only.

---

## Dependencies

### Angular / third-party

- `@angular/core` — `Component`, `contentChildren`, `signal`, `inject`, `DestroyRef`, `Renderer2`, `ElementRef`, `NgZone`
- `@angular/core/rxjs-interop` — `takeUntilDestroyed`
- `rxjs` — `fromEvent`, `switchMap`, `filter`, `map`, `tap`, `takeUntil`

### Internal Malva UI packages

- `@malva-ui/styles` — CSS design tokens via `--mlv-*` custom properties
