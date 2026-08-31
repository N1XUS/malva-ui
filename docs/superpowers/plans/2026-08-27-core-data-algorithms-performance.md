# Core Data and Algorithm Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace confirmed quadratic or unbounded core-library algorithms with bounded, linear, or constant-output implementations.

**Architecture:** Derive indexed state at Angular signal boundaries, use single-pass accumulators for trees and batches, and replace range-proportional UI allocations with direct arithmetic or CSS. Every optimization retains existing ordering, comparator, event, forms, and accessibility semantics.

**Tech Stack:** Angular signals/components, TypeScript, Vitest, CSS gradients, Nx.

**Spec:** `docs/superpowers/specs/2026-08-27-core-data-algorithms-performance-design.md`

## Global Constraints

- Read each affected library `CLAUDE.md`/`AGENTS.md` and `.claude/rules/angular-component.md`; apply accessibility rules to interactive components.
- No new public API or changed comparator contract.
- Preserve row/message/filter/token/tile ordering and emitted event sequences.
- Consumer-controlled page counts and slider steps must not allocate proportional arrays or DOM.
- Each cache retains only the latest signal revision or current operation.
- Update affected project documentation in the same task.

---

### Task 1: Cache calendar availability

**Files:**
- Modify: `libs/core/calendar/src/lib/calendar/calendar.ts`
- Test: `libs/core/calendar/src/lib/calendar/calendar.spec.ts`
- Modify: `libs/core/calendar/AGENTS.md`

**Interfaces:**
- Produces private computed `AvailabilityIndex` with `monthKeys`, `yearKeys`, `canNavigatePrevious`, and `canNavigateNext`.

- [ ] **Step 1: Add failing operation-count and parity tests**

```ts
it('builds disabled-date availability once per dependency revision', () => {
  const disabled = vi.fn(() => true);
  fixture.componentRef.setInput('disabledDates', disabled);
  fixture.detectChanges();
  const afterBuild = disabled.mock.calls.length;
  fixture.detectChanges();
  expect(disabled).toHaveBeenCalledTimes(afterBuild);
});
```

Add min/max-only tests proving zero disabled-date/day-loop calls, plus leap-year, month/year cell, and previous/next parity.

- [ ] **Step 2: Verify current repeated scanning**

Run: `yarn nx run core-calendar:test -- --run libs/core/calendar/src/lib/calendar/calendar.spec.ts`
Expected: FAIL because template reads rescan date ranges.

- [ ] **Step 3: Implement a computed availability index**

```ts
interface AvailabilityIndex {
  readonly selectableMonths: ReadonlySet<string>;
  readonly selectableYears: ReadonlySet<number>;
  readonly canNavigatePrevious: boolean;
  readonly canNavigateNext: boolean;
}
```

Use interval arithmetic when only min/max constrain dates. With a custom disabled callback, enumerate each needed date once for the active view revision and populate sets reused by all bindings.

- [ ] **Step 4: Run calendar tests**

Run: `yarn nx run core-calendar:test`
Expected: PASS with O(1) template lookup after one bounded build.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/calendar/src/lib/calendar/calendar.ts libs/core/calendar/src/lib/calendar/calendar.spec.ts libs/core/calendar/AGENTS.md
git commit -m "perf(calendar): cache date availability"
```

### Task 2: Bound chat live IDs and cache labels

**Files:**
- Modify: `libs/core/chat/src/lib/chat/chat.ts`
- Modify: `libs/core/chat/src/lib/chat/chat.html`
- Test: `libs/core/chat/src/lib/chat/chat.spec.ts`
- Test: `libs/core/chat/src/lib/chat/chat-a11y.spec.ts`
- Test: `libs/core/chat/src/lib/chat/chat-scroll.spec.ts`
- Modify: `libs/core/chat/CLAUDE.md`

**Interfaces:**
- Produces current-animation ID set and computed `ReadonlyMap<string, string>` for rendered message labels.

- [ ] **Step 1: Add failing lifetime/cache tests**

```ts
it('removes live IDs after their enter animation completes', () => {
  harness.append(message('m1'));
  expect(harness.liveIds()).toEqual(new Set(['m1']));
  harness.finishEnterAnimation('m1');
  expect(harness.liveIds()).toEqual(new Set());
});
```

Spy on label formatting and assert repeated template reads do not reformat; locale/user/status/message revisions rebuild once.

- [ ] **Step 2: Verify failure**

Run: `yarn nx run core-chat:test -- --run libs/core/chat/src/lib/chat/chat.spec.ts libs/core/chat/src/lib/chat/chat-a11y.spec.ts`
Expected: FAIL because live IDs accumulate and labels format per read.

- [ ] **Step 3: Implement current-window derived state**

Track the normal append edge from the previous last ID/length, intersect live IDs with the current render window, and remove each through an `animationend` template handler or cleanup fallback. Compute labels once from window, users, self ID, status, locale, and i18n dependencies. Template helpers perform map lookup only.

- [ ] **Step 4: Run chat tests**

Run: `yarn nx run core-chat:test`
Expected: PASS with unchanged labels and announcements.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/chat/src/lib/chat/chat.ts libs/core/chat/src/lib/chat/chat.html libs/core/chat/src/lib/chat/chat.spec.ts libs/core/chat/src/lib/chat/chat-a11y.spec.ts libs/core/chat/src/lib/chat/chat-scroll.spec.ts libs/core/chat/CLAUDE.md
git commit -m "perf(chat): bound live state and cache labels"
```

### Task 3: Flatten data-table trees in one pass

**Files:**
- Modify: `libs/core/data-table/src/lib/data-table/data-table-layout.ts`
- Test: `libs/core/data-table/src/lib/data-table/data-table-layout.spec.ts`
- Modify: `libs/core/data-table/CLAUDE.md`

**Interfaces:**
- Preserves the existing `flattenRows` signature and `_mlvDepth` metadata.

- [ ] **Step 1: Add a failing degenerate-tree test**

```ts
it('appends each expanded row once for a deeply nested chain', () => {
  const chain = makeExpandedChain(10_000);
  const rows = flattenRows(chain.rows, chain.config);
  expect(rows).toHaveLength(10_000);
  expect(rows.map(row => row._mlvDepth)).toEqual(range(0, 10_000));
});
```

Add exact preorder/identity/parent metadata parity for flat and balanced trees.

- [ ] **Step 2: Verify the old recursive copying is exposed**

Run: `yarn nx run core-data-table:test -- --run libs/core/data-table/src/lib/data-table/data-table-layout.spec.ts`
Expected: FAIL by stack overflow or an explicit append/copy instrumentation assertion.

- [ ] **Step 3: Implement iterative DFS**

```ts
const stack = [...rootRows].reverse().map(row => ({ row, depth: 0 }));
while (stack.length) {
  const current = stack.pop()!;
  result.push(toFlatRow(current));
  if (isExpanded(current.row)) pushChildrenInReverse(stack, current);
}
```

Preserve preorder and source-row identity while avoiding recursive array spread.

- [ ] **Step 4: Run layout and table tests**

Run: `yarn nx run core-data-table:test`
Expected: PASS.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/data-table/src/lib/data-table/data-table-layout.ts libs/core/data-table/src/lib/data-table/data-table-layout.spec.ts libs/core/data-table/CLAUDE.md
git commit -m "perf(data-table): flatten tree rows linearly"
```

### Task 4: Compute pagination without full ranges

**Files:**
- Modify: `libs/core/pagination/src/lib/pagination/pagination.service.ts`
- Test: `libs/core/pagination/src/lib/pagination/pagination.spec.ts`
- Modify: `libs/core/pagination/CLAUDE.md`

**Interfaces:**
- Preserves `MlvPaginationService.pages` return shape and ellipsis markers.

- [ ] **Step 1: Add exhaustive parity and huge-count tests**

```ts
it('keeps output bounded for a billion pages', () => {
  const pages = service.pages({ page: 500_000_000, totalPages: 1_000_000_000 });
  expect(pages.length).toBeLessThanOrEqual(9);
  expect(pages).toEqual(expectedMiddleWindow);
});
```

Generate parity cases for every current page while `totalPages` is 0 through 30.

- [ ] **Step 2: Verify range allocation**

Run: `yarn nx run core-pagination:test -- --run libs/core/pagination/src/lib/pagination/pagination.spec.ts`
Expected: FAIL or exhaust memory/time with the billion-page case.

- [ ] **Step 3: Implement direct boundary arithmetic**

Return all pages only when total pages fit the display bound. Otherwise construct first/last boundaries, the current sibling window, and ellipses directly; never allocate `[1..totalPages]`.

- [ ] **Step 4: Run pagination tests**

Run: `yarn nx run core-pagination:test`
Expected: PASS with exact parity.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/pagination/src/lib/pagination/pagination.service.ts libs/core/pagination/src/lib/pagination/pagination.spec.ts libs/core/pagination/CLAUDE.md
git commit -m "perf(pagination): bound page generation"
```

### Task 5: Index smart-filter definitions and ordering

**Files:**
- Modify: `libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.ts`
- Modify if bindings change: `libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.html`
- Test: `libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.spec.ts`
- Modify: `libs/core/filter/CLAUDE.md`

**Interfaces:**
- Produces computed `definitionByKey`, `definitionRank`, `stateByKey`, `missingRequiredKeys`, and editor resolution maps or one equivalent row view model.

- [ ] **Step 1: Add failing lookup-count and ordering tests**

```ts
it('resolves each definition once per state revision', () => {
  const harness = renderSmartFilterBar({ definitions: makeDefinitions(500) });
  harness.detectChangesTwice();
  expect(harness.definitionScans).toBeLessThanOrEqual(500);
});
```

Cover exact-editor-over-keyless fallback, missing required errors, hidden/unknown definitions, reordering, and live edits.

- [ ] **Step 2: Verify current nested scans**

Run: `yarn nx run core-filter:test -- --run libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.spec.ts`
Expected: FAIL because bindings and the sort comparator repeatedly scan arrays.

- [ ] **Step 3: Implement computed maps/direct rebuild**

Build maps once per immutable input revision. Replace `order.indexOf` in the comparator with rank lookup or rebuild state directly in definition order while preserving defensive value cloning and removal behavior.

- [ ] **Step 4: Run filter tests**

Run: `yarn nx run core-filter:test`
Expected: PASS with O(D + F + E) recomputation.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.ts libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.html libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.spec.ts libs/core/filter/CLAUDE.md
git commit -m "perf(filter): index smart filter state"
```

### Task 6: Make tokenizer bulk insertion linear

**Files:**
- Modify: `libs/core/tokenizer/src/lib/tokenizer/tokenizer.ts`
- Test: `libs/core/tokenizer/src/lib/tokenizer/tokenizer.spec.ts`
- Modify: `libs/core/tokenizer/AGENTS.md`

**Interfaces:**
- Preserves normalization, equality identity, maximum token behavior, and accepted/rejected event order.

- [ ] **Step 1: Add failing membership-count tests**

```ts
it('reads token identities linearly when duplicates are disabled', () => {
  const reads = { count: 0 };
  harness.addMany(makeTrackedTokens(1_000, reads), {
    existing: makeTrackedTokens(1_000, reads),
  });
  expect(reads.count).toBeLessThanOrEqual(4_000);
});
```

Add a duplicate-allowed case requiring zero membership scans and exact event/result parity for duplicates within the batch.

- [ ] **Step 2: Verify the nested scan**

Run: `yarn nx run core-tokenizer:test -- --run libs/core/tokenizer/src/lib/tokenizer/tokenizer.spec.ts`
Expected: FAIL with quadratic comparator calls.

- [ ] **Step 3: Implement the safe fast path**

Seed a `Set<T>` from existing `token.value` values and update it as candidates are accepted; duplicate-allowed mode appends directly. Preserve strict-`===` semantics by treating `NaN` values as always distinct instead of consulting/inserting them in the set; object identity and signed zero already match current behavior.

- [ ] **Step 4: Run tokenizer tests**

Run: `yarn nx run core-tokenizer:test`
Expected: PASS.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/tokenizer/src/lib/tokenizer/tokenizer.ts libs/core/tokenizer/src/lib/tokenizer/tokenizer.spec.ts libs/core/tokenizer/AGENTS.md
git commit -m "perf(tokenizer): optimize bulk insertion"
```

### Task 7: Reuse one tile-tree operation index

**Files:**
- Modify: `libs/core/tile/src/lib/tile-tree-coordinator.ts`
- Modify: `libs/core/tile/src/lib/tile-tree-state.ts`
- Modify: `libs/core/tile/src/lib/tiles/tiles.ts`
- Test: `libs/core/tile/src/lib/tile-tree-coordinator.spec.ts`
- Test: `libs/core/tile/src/lib/tile-tree-state.spec.ts`
- Modify: `libs/core/tile/CLAUDE.md`

**Interfaces:**
- Produces operation-local `TileTreeIndex<TProps>` containing node, parent ID, child index, descendant facts, and lock state; registration owns a direct ID map.

- [ ] **Step 1: Add failing traversal-count tests**

```ts
it('indexes the tree once for a remove operation', () => {
  const visit = vi.fn();
  coordinator.remove('deep-node', { onVisit: visit });
  expect(visit).toHaveBeenCalledTimes(nodeCount);
});
```

Cover cross-tree move structural sharing and all existing missing/locked/duplicate/self/descendant rejections.

- [ ] **Step 2: Verify repeated walks**

Run: `yarn nx run core-tile:test -- --run libs/core/tile/src/lib/tile-tree-coordinator.spec.ts libs/core/tile/src/lib/tile-tree-state.spec.ts`
Expected: FAIL because validation/mutation currently revisit the tree several times.

- [ ] **Step 3: Implement operation-local indexing**

Build the index once at operation entry, pass it through validation and mutation, rebuild only the ancestor path immutably, remove the duplicate lock check, and maintain the registration ID map on register/unregister.

- [ ] **Step 4: Run tile tests**

Run: `yarn nx run core-tile:test`
Expected: PASS with identical roots/events and untouched branch references.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/tile/src/lib/tile-tree-coordinator.ts libs/core/tile/src/lib/tile-tree-state.ts libs/core/tile/src/lib/tiles/tiles.ts libs/core/tile/src/lib/tile-tree-coordinator.spec.ts libs/core/tile/src/lib/tile-tree-state.spec.ts libs/core/tile/CLAUDE.md
git commit -m "perf(tile): reuse tree operation index"
```

### Task 8: Render slider ticks in constant space

**Files:**
- Modify: `libs/core/slider/src/lib/slider/slider.ts`
- Modify: `libs/core/slider/src/lib/slider/slider.html`
- Modify: `libs/core/slider/src/lib/slider/slider.scss`
- Test: `libs/core/slider/src/lib/slider/slider.spec.ts`
- Modify: `libs/core/slider/AGENTS.md`

**Interfaces:**
- Produces private CSS percentage custom property for one tick interval; removes `_ticks` array and repeated tick nodes.

- [ ] **Step 1: Add failing constant-DOM and spacing tests**

```ts
it('does not create one element per tick for tiny steps', () => {
  setInputs({ min: 0, max: 1, step: 0.000001, showTicks: true });
  fixture.detectChanges();
  expect(element.querySelectorAll('.mlv-slider__tick')).toHaveLength(0);
  expect(track.style.getPropertyValue('--mlv-slider-tick-interval')).toBe('0.0001%');
});
```

Cover representative fractional ranges, invalid step, orientation, endpoints, fill/thumb/accessibility parity.

- [ ] **Step 2: Verify the unbounded loop**

Run: `yarn nx run core-slider:test -- --run libs/core/slider/src/lib/slider/slider.spec.ts`
Expected: FAIL or hang with the tiny-step input.

- [ ] **Step 3: Implement decorative gradients**

Compute `step / (max - min) * 100` once for finite positive inputs and bind it as a private custom property. Render one `aria-hidden` tick layer using orientation-specific `repeating-linear-gradient`; remove the `@for` loop and `_ticks` allocation.

- [ ] **Step 4: Run slider tests**

Run: `yarn nx run core-slider:test`
Expected: PASS for forms, pointer, keyboard, vertical/horizontal, density, and ticks.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/slider/src/lib/slider/slider.ts libs/core/slider/src/lib/slider/slider.html libs/core/slider/src/lib/slider/slider.scss libs/core/slider/src/lib/slider/slider.spec.ts libs/core/slider/AGENTS.md
git commit -m "perf(slider): bound tick rendering"
```

### Task 9: Evaluate comparator and metadata fast paths

**Files:**
- Test/modify with evidence: `libs/core/combobox/src/lib/combobox/combobox.spec.ts`, `combobox.ts`
- Test/modify with evidence: `libs/core/select/src/lib/select/select.spec.ts`, `select.ts`
- Test/modify with evidence: `libs/core/dropdown/src/lib/option-matcher.spec.ts`, `option-matcher.ts`, `reconciliation.spec.ts`, `reconciliation.ts`
- Test/modify with evidence: `libs/core/data-table/src/lib/data-table/data-table-layout.spec.ts`, `data-table-layout.ts`, `data-table.spec.ts`, `data-table.ts`
- Test/modify with evidence: `libs/core/view-variant/src/lib/view-variant-list/view-variant-list.spec.ts`, `view-variant-list.ts`

**Interfaces:**
- Default equality may use map/set indexes; custom comparator always retains exact fallback semantics.

- [ ] **Step 1: Add fixed-input comparator/allocation counters**

Measure 5,000 options/100 selections, repeated `MlvSelect.displayValue` reads, 10,000 normalized labels, and 300 resized/grouped columns. Assert custom comparator outputs separately.

- [ ] **Step 2: Run measurements before changing code**

Run: `yarn nx run-many -t test -p core-combobox,core-select,core-dropdown,core-data-table,core-view-variant`
Expected: Identify only candidates with demonstrated repeated work.

- [ ] **Step 3: Implement proven fast paths**

Use identity maps/sets only when the current default equality function is active; otherwise use the original comparator. Cache `displayValue` only when its formatting counter repeats within one state revision. Split static data-table metadata from live widths only when the resize counter proves the invalidation.

- [ ] **Step 4: Run batch verification**

Run: `yarn nx run-many -t test,lint,typecheck -p core-calendar,core-chat,core-data-table,core-pagination,core-filter,core-tokenizer,core-tile,core-slider,core-combobox,core-select,core-dropdown,core-view-variant`
Expected: PASS for available targets.

- [ ] **Step 5: Commit measured candidates separately**

Stage only files whose measurement justified a change, then commit them as `perf(core): optimize measured lookup paths`. Record unchanged candidates in the final implementation report.
