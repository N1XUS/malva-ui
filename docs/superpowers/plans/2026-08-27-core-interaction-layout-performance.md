# Core Interaction and Layout Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make continuous pointer, scroll, resize, and indicator updates frame-bounded and free of avoidable Angular change detection/layout thrashing.

**Architecture:** Each component owns a small outside-Angular listener plus latest-event RAF scheduler. Geometry is cached by resize/structure invalidation, reads precede writes, final values flush on interaction completion, and every listener/frame/observer is destroyed locally.

**Tech Stack:** Angular components/directives and NgZone, DOM observers, requestAnimationFrame, Vitest, Nx, SCSS.

**Spec:** `docs/superpowers/specs/2026-08-27-core-interaction-layout-performance-design.md`

## Global Constraints

- Read each affected project guide plus `.claude/rules/angular-component.md`, `.claude/rules/angular-directive.md`, and `.claude/rules/accessibility.md` before editing.
- No selector, input, output, CSS class, role, keyboard behavior, or public type changes.
- Continuous event handlers run outside Angular and publish at most once per animation frame.
- Interaction completion flushes the latest value synchronously; destroy cancels all pending work.
- Geometry caches state exact invalidation triggers and retain current elements only.
- Update project documentation with event-zone and cache behavior.

---

### Task 1: Coalesce color-picker pointer and canvas work

**Files:**
- Modify: `libs/core/color-picker/src/lib/color-picker/color-picker.ts`
- Test: `libs/core/color-picker/src/lib/color-picker/color-picker.spec.ts`
- Modify: `libs/core/color-picker/CLAUDE.md`

**Interfaces:**
- Produces private `_queueCanvasPointer`, `_flushCanvasPointer`, `_scheduleCanvasDraw`, latest pointer data, two RAF handles, and an internal-value origin guard.

- [ ] **Step 1: Add failing frame/origin tests**

```ts
it('coalesces canvas moves to the latest value in one frame', () => {
  harness.pointerMoves([point(1, 1), point(20, 20), point(40, 40)]);
  expect(harness.valueChanges).toHaveLength(0);
  harness.flushFrame();
  expect(harness.valueChanges).toHaveLength(1);
  expect(harness.valueChanges[0]).toBe(harness.colorAt(40, 40));
});
```

Add tests proving an internally emitted saturation/lightness value is not reparsed/redrawn, external input still is, hue/resize redraw once, and pointer-up flushes.

- [ ] **Step 2: Verify current per-event behavior**

Run: `yarn nx run core-color-picker:test -- --run libs/core/color-picker/src/lib/color-picker/color-picker.spec.ts`
Expected: FAIL with multiple emissions/redraws.

- [ ] **Step 3: Implement outside-zone latest-event scheduling**

Register window moves outside Angular, retain latest coordinates (not the event object after the handler), schedule one frame, and enter Angular once for the current value. Use an origin token/value to skip only the immediate internal model echo; genuine consumer rewrites still parse. Draw the canvas only for hue/size revisions.

- [ ] **Step 4: Run color-picker tests**

Run: `yarn nx run core-color-picker:test`
Expected: PASS for pointer, text channels, forms, opacity, destroy, and redraw behavior.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/color-picker/src/lib/color-picker/color-picker.ts libs/core/color-picker/src/lib/color-picker/color-picker.spec.ts libs/core/color-picker/CLAUDE.md
git commit -m "perf(color-picker): coalesce pointer updates"
```

### Task 2: Move drawer resizing outside Angular

**Files:**
- Modify: `libs/core/drawer/src/lib/drawer-resize.ts`
- Create: `libs/core/drawer/src/lib/drawer-resize.spec.ts`
- Modify: `libs/core/drawer/CLAUDE.md`

**Interfaces:**
- Produces private `_bindPointerEvents(handle: HTMLElement): void`; move/preview stays outside Angular and terminal commit re-enters.

- [ ] **Step 1: Add a failing zone/coalescing test**

```ts
it('handles pointermove outside Angular and commits pointerup inside', () => {
  harness.drag([10, 20, 30]);
  expect(harness.moveZoneStates).toEqual([false]);
  expect(harness.commitZoneState).toBe(true);
});
```

Stub RAF, pointer capture, panel bounds, and viewport dimensions; assert final bounds and ARIA value.

- [ ] **Step 2: Verify failure**

Run: `yarn nx run core-drawer:test -- --run libs/core/drawer/src/lib/drawer-resize.spec.ts`
Expected: FAIL because the subscription is established in Angular and moves are not frame-coalesced.

- [ ] **Step 3: Implement outside-zone binding**

Call `_bindPointerEvents` within `NgZone.runOutsideAngular`, retain the latest pointer coordinate, write panel size once per frame, and keep the current `_zone.run` terminal commit/output. Cancel the frame on up/cancel/destroy.

- [ ] **Step 4: Run drawer tests**

Run: `yarn nx run core-drawer:test`
Expected: PASS.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/drawer/src/lib/drawer-resize.ts libs/core/drawer/src/lib/drawer-resize.spec.ts libs/core/drawer/CLAUDE.md
git commit -m "perf(drawer): move resize work outside Angular"
```

### Task 3: Coalesce page scrolling and observe snap geometry

**Files:**
- Modify: `libs/core/page/src/lib/page/page.ts`
- Test: `libs/core/page/src/lib/page/page.spec.ts`
- Modify: `libs/core/page/CLAUDE.md`

**Interfaces:**
- Produces `_queueScrollUpdate`, `_flushScrollUpdate`, `_snapHeights: Map<HTMLElement, number>`, and resize-observer update/publish helpers.

- [ ] **Step 1: Add failing scroll/geometry tests**

```ts
it('coalesces scroll bursts and uses the latest position', () => {
  harness.scrollTo(10, 20, 30);
  expect(harness.snapUpdates).toEqual([]);
  harness.flushFrame();
  expect(harness.snapUpdates).toEqual([30]);
});
```

Spy on `offsetHeight`; after observer-provided heights are cached, stable scroll frames must read it zero times and publish the summed custom property.

- [ ] **Step 2: Verify current repeated reads/writes**

Run: `yarn nx run core-page:test -- --run libs/core/page/src/lib/page/page.spec.ts`
Expected: FAIL because every scroll writes signals and the render effect reads layout.

- [ ] **Step 3: Implement RAF scroll and observer geometry**

Register scroll outside Angular, read latest `scrollTop` in one frame, update snap state once, and cache chrome heights from `ResizeObserverEntry.borderBoxSize` with `contentRect.height` fallback. Publish CSS only after reads and cancel on destroy.

- [ ] **Step 4: Run page tests**

Run: `yarn nx run core-page:test`
Expected: PASS with existing thresholds and descendant scroll state.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/page/src/lib/page/page.ts libs/core/page/src/lib/page/page.spec.ts libs/core/page/CLAUDE.md
git commit -m "perf(page): coalesce snap scrolling"
```

### Task 4: Cache custom-scrollbar geometry

**Files:**
- Modify: `libs/core/scrollbar/src/lib/scrollbar/scrollbar.ts`
- Test: `libs/core/scrollbar/src/lib/scrollbar/scrollbar.spec.ts`
- Modify: `libs/core/scrollbar/CLAUDE.md`

**Interfaces:**
- Produces current `ScrollbarGeometry`, one scroll RAF, and mode-dependent mutation-observer ownership.

- [ ] **Step 1: Add failing geometry/tabindex tests**

```ts
it('updates the thumb once per scroll frame without style recomputation', () => {
  harness.scrollTo(10, 20, 30);
  harness.flushFrame();
  expect(harness.thumbWrites).toHaveLength(1);
  expect(harness.computedStyleReads).toBe(0);
});
```

Add resize invalidation and explicit `viewportTabIndex` tests that require no MutationObserver until automatic mode is selected.

- [ ] **Step 2: Verify failure**

Run: `yarn nx run core-scrollbar:test -- --run libs/core/scrollbar/src/lib/scrollbar/scrollbar.spec.ts`
Expected: FAIL because scroll remeasures/recomputes styles and the observer runs in explicit mode.

- [ ] **Step 3: Implement observer-owned geometry and frame writes**

Cache viewport/content/thumb dimensions on resize/structure changes, process scrolling outside Angular, set transform once per frame, skip equal derived values, and install/remove the tabindex MutationObserver strictly with automatic-mode lifetime.

- [ ] **Step 4: Run scrollbar tests**

Run: `yarn nx run core-scrollbar:test`
Expected: PASS for keyboard, scrolling, tabindex, resize, and destruction.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/scrollbar/src/lib/scrollbar/scrollbar.ts libs/core/scrollbar/src/lib/scrollbar/scrollbar.spec.ts libs/core/scrollbar/CLAUDE.md
git commit -m "perf(scrollbar): cache scroll geometry"
```

### Task 5: Update only the active split-pane pair

**Files:**
- Modify: `libs/core/split-pane/src/lib/split-pane/split-pane.ts`
- Test: `libs/core/split-pane/src/lib/split-pane/split-pane.spec.ts`
- Modify: `libs/core/split-pane/CLAUDE.md`

**Interfaces:**
- Produces drag-session mutable size buffer, latest delta, one RAF, and terminal immutable publication.

- [ ] **Step 1: Add failing pair/write tests**

```ts
it('updates one adjacent pair and grid template per drag frame', () => {
  harness.dragSeparator(2, [1, 2, 3]);
  harness.flushFrame();
  expect(harness.changedPaneIndexes).toEqual([2, 3]);
  expect(harness.gridTemplateWrites).toBe(1);
  expect(harness.changedSeparatorIndexes).toEqual([2]);
});
```

Assert terminal sizes/events, constraints, collapse, keyboard, and cancellation parity.

- [ ] **Step 2: Verify failure**

Run: `yarn nx run core-split-pane:test -- --run libs/core/split-pane/src/lib/split-pane/split-pane.spec.ts`
Expected: FAIL because every move clones all sizes and rewrites all handles.

- [ ] **Step 3: Implement drag-session buffering**

Copy normalized sizes once at drag start, mutate only the two adjacent slots inside the private session, update the grid and active separator once per frame, then publish one immutable array on release.

- [ ] **Step 4: Run split-pane tests**

Run: `yarn nx run core-split-pane:test`
Expected: PASS.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/split-pane/src/lib/split-pane/split-pane.ts libs/core/split-pane/src/lib/split-pane/split-pane.spec.ts libs/core/split-pane/CLAUDE.md
git commit -m "perf(split-pane): bound drag updates"
```

### Task 6: Batch segmented and tab indicator layout

**Files:**
- Modify: `libs/core/segmented/src/lib/segmented/segmented.ts`
- Test: `libs/core/segmented/src/lib/segmented/segmented.spec.ts`
- Modify: `libs/core/segmented/CLAUDE.md`
- Modify: `libs/core/tabs/src/lib/tabs/tabs.ts`
- Test: `libs/core/tabs/src/lib/tabs/tabs.spec.ts`
- Modify: `libs/core/tabs/CLAUDE.md`

**Interfaces:**
- Each component produces one invalidatable indicator RAF; measurement returns a pure geometry record before styles are written.

- [ ] **Step 1: Add failing coalescing/read-before-write tests**

```ts
it('coalesces indicator invalidations and completes reads before writes', () => {
  harness.invalidateForSelectionResizeAndChildren();
  harness.flushFrame();
  expect(harness.measurePasses).toBe(1);
  expect(harness.operations.indexOf('write')).toBeGreaterThan(harness.operations.lastIndexOf('read'));
});
```

Cover selection, direction, orientation, resize, add/remove, and hidden-to-visible state for both components.

- [ ] **Step 2: Verify duplicate/interleaved behavior**

Run: `yarn nx run core-segmented:test -- --run libs/core/segmented/src/lib/segmented/segmented.spec.ts`, then `yarn nx run core-tabs:test -- --run libs/core/tabs/src/lib/tabs/tabs.spec.ts`
Expected: FAIL because scheduling paths duplicate and measurements interleave writes.

- [ ] **Step 3: Implement pure measure then apply**

Consolidate manual/effect invalidation into one RAF per component. Read all offsets/rectangles into a geometry record, then apply indicator styles. Cancel on destroy and retain existing fallback when an element is hidden.

- [ ] **Step 4: Run both projects**

Run: `yarn nx run-many -t test -p core-segmented,core-tabs`
Expected: PASS.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/segmented/src/lib/segmented/segmented.ts libs/core/segmented/src/lib/segmented/segmented.spec.ts libs/core/segmented/CLAUDE.md libs/core/tabs/src/lib/tabs/tabs.ts libs/core/tabs/src/lib/tabs/tabs.spec.ts libs/core/tabs/CLAUDE.md
git commit -m "perf: batch selection indicator layout"
```

### Task 7: Cache sidebar-rail drag geometry

**Files:**
- Modify: `libs/core/sidebar/src/lib/sidebar-rail/sidebar-rail.ts`
- Test: `libs/core/sidebar/src/lib/sidebar/sidebar.spec.ts`
- Modify: `libs/core/sidebar/CLAUDE.md`

**Interfaces:**
- Produces drag-start edge geometry, latest pointer coordinate, one preview RAF, and terminal size commit.

- [ ] **Step 1: Add failing geometry/zone tests**

```ts
it('measures the rail edge once and previews once per frame', () => {
  harness.dragRail([10, 20, 30]);
  harness.flushFrame();
  expect(harness.rectReads).toBe(1);
  expect(harness.previewWrites).toBe(1);
  expect(harness.previewZoneStates).toEqual([false]);
});
```

Assert resize invalidation and final public state/output.

- [ ] **Step 2: Verify current per-frame geometry/zone work**

Run: `yarn nx run core-sidebar:test -- --run libs/core/sidebar/src/lib/sidebar/sidebar.spec.ts`
Expected: FAIL because the current loop reads the rect and re-enters Angular repeatedly.

- [ ] **Step 3: Implement cached-edge preview**

Capture edge geometry at drag start, refresh on resize only, apply CSS preview outside Angular once per frame, and enter Angular on release. If a public live output exists, emit it at the frame boundary only.

- [ ] **Step 4: Run sidebar tests**

Run: `yarn nx run core-sidebar:test`
Expected: PASS.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/sidebar/src/lib/sidebar-rail/sidebar-rail.ts libs/core/sidebar/src/lib/sidebar/sidebar.spec.ts libs/core/sidebar/CLAUDE.md
git commit -m "perf(sidebar): cache rail drag geometry"
```

### Task 8: Coalesce textarea autosizing

**Files:**
- Modify: `libs/core/textarea/src/lib/textarea/textarea.ts`
- Test: `libs/core/textarea/src/lib/textarea/textarea.spec.ts`
- Modify: `libs/core/textarea/CLAUDE.md`

**Interfaces:**
- Produces private box-model snapshot, invalidation flag, and one autosize RAF.

- [ ] **Step 1: Add failing style/read tests**

```ts
it('reads computed style once and autosizes once for same-frame values', () => {
  harness.setValues('a', 'a\nb', 'a\nb\nc');
  harness.flushFrame();
  expect(harness.computedStyleReads).toBe(1);
  expect(harness.heightWrites).toBe(2); // reset, then final height
});
```

Cover rows/min/max, external resize, form input, disabled/read-only, and destroy.

- [ ] **Step 2: Verify repeated computed-style reads**

Run: `yarn nx run core-textarea:test -- --run libs/core/textarea/src/lib/textarea/textarea.spec.ts`
Expected: FAIL because the current pass calls computed style repeatedly and schedules every value.

- [ ] **Step 3: Implement one scheduled autosize pass**

Cache stable padding/border/line-height fields until resize or style-affecting input invalidation. In one frame reset height, read `scrollHeight`, compute bounds, and write final height; cancel the frame on destroy.

- [ ] **Step 4: Run textarea tests**

Run: `yarn nx run core-textarea:test`
Expected: PASS.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/textarea/src/lib/textarea/textarea.ts libs/core/textarea/src/lib/textarea/textarea.spec.ts libs/core/textarea/CLAUDE.md
git commit -m "perf(textarea): coalesce autosizing"
```

### Task 9: Evaluate drawer-section and submenu geometry candidates

**Files:**
- Test/modify with evidence: `libs/core/drawer/src/lib/drawer-sections/drawer-sections.spec.ts`, `libs/core/drawer/src/lib/drawer-sections.service.ts`
- Test/modify with browser evidence: `libs/core/menu/src/lib/menu/menu-trigger.ts`
- Create if the candidate is proven: `libs/core/menu/src/lib/menu/menu-trigger.spec.ts`

**Interfaces:**
- A proven drawer fast path uses shallow immutable updates plus a linear maximum; a proven menu fast path caches rectangles and invalidates on open, overlay reposition, resize, and relevant scroll.

- [ ] **Step 1: Add deterministic candidate measurements**

Feed 200 drawer-section observer entries and count deep-clone/sort work. Separately open a submenu, dispatch a fixed diagonal mousemove sequence, and count `getBoundingClientRect` calls after initial positioning.

- [ ] **Step 2: Run both measurements unchanged**

Run the focused `core-drawer` test and the `core-menu` test/browser target containing submenu aim. Expected: change each candidate only when its counter demonstrates the repeated work.

- [ ] **Step 3: Implement the cache only with evidence**

For a proven drawer case, use shallow map updates and a one-pass maximum while preserving ratio/unregister behavior. For a proven menu case, use cached rectangles in mousemove and refresh them from overlay positioning plus resize/scroll invalidation. Preserve triangle-pointer timing.

- [ ] **Step 4: Verify all interaction projects**

Run: `yarn nx run-many -t test,lint,typecheck -p core-color-picker,core-drawer,core-page,core-scrollbar,core-split-pane,core-segmented,core-sidebar,core-tabs,core-textarea,core-menu`
Expected: PASS for available targets.

- [ ] **Step 5: Commit only proven candidates**

```bash
git add libs/core/drawer/src/lib/drawer-sections.service.ts libs/core/drawer/src/lib/drawer-sections/drawer-sections.spec.ts libs/core/menu/src/lib/menu/menu-trigger.ts libs/core/menu/src/lib/menu/menu-trigger.spec.ts
git commit -m "perf: optimize measured overlay geometry"
```
