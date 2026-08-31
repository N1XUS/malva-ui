# Core interaction and layout performance remediation — design

Date: 2026-08-27
Status: approved
Scope: pointer-, scroll-, resize-, and layout-heavy production TypeScript under `libs/core`

## Problem

Several interactive components process browser-frequency events inside Angular, mix layout reads with style writes, or repeat geometry/style measurement for every event. Color picking, drawer resizing, page snapping, custom scrollbars, split panes, segmented controls, sidebar rails, tabs, and textarea autosizing can consequently cause excess change detection and layout thrashing during continuous interaction.

## Goals

- Process raw pointer, scroll, and resize events outside Angular.
- Coalesce visual work to at most one animation frame.
- Batch layout reads before DOM writes.
- Cache geometry until a specific invalidation signal occurs.
- Re-enter Angular only for semantically observable state changes.
- Preserve pointer capture, keyboard access, final emitted values, and visual geometry.

## Non-goals

- No visual redesign, animation timing redesign, or new public option.
- No removal of live feedback.
- No global event loop or shared scheduler across unrelated components.
- No geometry cache without resize/scroll/structure invalidation.

## Shared interaction pattern

Each affected component uses the same lifecycle pattern where applicable:

1. Register high-frequency listeners outside Angular.
2. Store the latest raw event data and schedule at most one `requestAnimationFrame`.
3. In the frame, perform all geometry/style reads first, calculate pure state second, and write styles/signals last.
4. Re-enter Angular only when publishing a value/output required by consumers.
5. Flush the last interaction synchronously on pointer-up/end where needed.
6. Cancel frames, observers, and listeners through `DestroyRef`.

Implementation remains local to each library so ownership and cleanup stay explicit.

## 1. Color picker pointer and canvas pipeline

Affected implementation: `libs/core/color-picker/src/lib/color-picker/color-picker.ts`.

- Move raw pointer tracking outside Angular and coalesce it to one frame.
- Separate internal color-origin updates from external input/model updates so a pointer change is not reparsed and reapplied through the same effect.
- Redraw the saturation/value canvas only when hue, dimensions, or rendering scale changes. Position-only changes move the marker without repainting the canvas.
- Replace queued zero-delay/redundant redraws with one cancelable animation-frame request.
- Pointer-up flushes the latest coordinate and emits the same final color synchronously.

### Tests

- A pointer burst produces one visual update per frame and one final committed value.
- Internal updates do not run the external parse path again.
- Saturation/value changes move the marker without repainting; hue/resize repaints once.
- Destroy and pointer-cancel release capture/listeners and cancel frames.

## 2. Drawer resizing and section bookkeeping

Affected implementation: `libs/core/drawer/src/lib/drawer-resize.ts`.

Register pointer move/up subscriptions outside Angular. Coalesce width/height style updates to one frame and enter Angular only for the final bound size/output. Preserve bounds, direction, pointer capture, and cancellation.

The section-service clone/sort path is evidence-gated: replace deep clone/sort with shallow immutable map updates and a linear maximum only if an operation-count regression demonstrates repeated avoidable work in `drawer-sections.service.ts`.

## 3. Page snap geometry

Affected implementation: `libs/core/page/src/lib/page/page.ts`.

Cache snap anchors and container geometry. Refresh them through `ResizeObserver`, relevant content changes, and explicit layout invalidation. Scroll events store the latest position and schedule one frame; the frame reads no geometry unless the cache is invalid. Snap decisions and CSS/state writes happen after the read phase.

### Tests

- Scroll bursts perform one snap calculation per frame.
- Stable scrolling performs no repeated `getBoundingClientRect` calls.
- Resize/content invalidation refreshes anchors before the next decision.
- Existing snap thresholds and resulting state remain identical.

## 4. Custom scrollbar

Affected implementation: `libs/core/scrollbar/src/lib/scrollbar/scrollbar.ts`.

- Cache viewport/content/thumb geometry from resize and structure invalidation instead of reading computed style/layout on every scroll.
- Scroll listeners run outside Angular and update thumb transforms once per frame.
- Signal/output publication is skipped when the derived position is unchanged.
- Install the MutationObserver used for automatic viewport tabindex only while automatic mode is active. An explicit `viewportTabIndex` bypasses mutation scanning.

### Tests

- Scroll bursts create one transform update per frame with no style recomputation.
- Resize refreshes cached geometry and produces the correct thumb size/position.
- Explicit tabindex mode installs no mutation observer; switching modes installs/removes it correctly.
- Keyboard scrolling and accessibility attributes remain unchanged.

## 5. Split pane

Affected implementation: `libs/core/split-pane/src/lib/split-pane/split-pane.ts`.

During a drag, retain one mutable internal size buffer for the active session and update only the adjacent pane pair. Apply the grid template and active separator ARIA values once per frame. On pointer-up, materialize the public immutable sizes value once and emit the final event. External input changes still replace the internal buffer through the existing normalization path.

### Tests

- A pointer burst updates one adjacent pair and writes one grid template per frame.
- Inactive separator ARIA values are not rewritten during a drag.
- Final sizes, min/max constraints, collapse behavior, keyboard resizing, and emitted events remain identical.

## 6. Segmented control and tabs read/write batching

Affected implementation:

- `libs/core/segmented/src/lib/segmented/segmented.ts`
- `libs/core/tabs/src/lib/tabs/tabs.ts`

For segmented controls, read all segment offsets in one pass, compute the target geometry, then perform indicator writes. For tabs, consolidate manual and effect-triggered indicator scheduling into one invalidatable frame and batch tab/host measurements before writing indicator styles.

### Tests

- Multiple invalidations before a frame produce one measurement/write pass.
- Selection, resize, orientation, direction, add/remove, and hidden-to-visible transitions position indicators correctly.
- Tests assert the read phase completes before the first style write.

## 7. Sidebar rail dragging

Affected implementation: `libs/core/sidebar/src/lib/sidebar-rail/sidebar-rail.ts`.

Capture the relevant edge/host rect at drag start and refresh only on resize or a known layout invalidation. Pointer moves run outside Angular and update the preview CSS once per frame. Re-enter Angular on release to commit the final width/state. If current public behavior emits live resize values, keep that output live but emit at most once per frame.

## 8. Textarea autosize

Affected implementation: `libs/core/textarea/src/lib/textarea/textarea.ts`.

Read computed style once per autosize pass and cache stable box-model fields until resize/style-affecting input invalidation. Perform height reset, scroll-height read, and final height write in an explicit sequence. Coalesce multiple value changes in the same turn/frame.

### Tests

- One autosize pass performs one computed-style read.
- Multiple same-frame changes yield the final correct height with one scheduled pass.
- Min/max rows, external resize, disabled/read-only state, and form updates remain unchanged.

## 9. Evidence-gated menu geometry

`libs/core/menu/src/lib/menu/menu-trigger.ts` currently measures submenu geometry during document mouse movement. Cache trigger/submenu rectangles and invalidate them on open, overlay reposition, resize, and relevant scroll only if a focused browser regression shows repeated layout reads in a submenu traversal. Triangle-pointer behavior and nested-menu timing must have browser coverage before changing this path.

## Compatibility and documentation

- No selector, input, output, CSS class, accessibility role, or public type changes.
- The final public value/event is never delayed past interaction completion.
- Private scheduling state is destroyed deterministically.
- Update every affected library `CLAUDE.md` with event-zone, frame-coalescing, and invalidation behavior.

## Verification

- Run each affected project's `test`, `typecheck`, and `lint` targets through Nx.
- Use fake animation-frame schedulers for deterministic unit coverage.
- Run browser interaction coverage for pointer capture, drag completion, scroll, resize, and indicator positioning.
- Add read/write-order spies where layout thrashing is the regression being prevented.

## Acceptance criteria

- Confirmed P2 high-frequency paths run outside Angular and perform at most one visual update per frame.
- Stable geometry is not remeasured until a documented invalidation occurs.
- All pending work is flushed or cancelled on interaction end/destruction.
- Final values, accessibility state, and visible geometry remain compatible.
