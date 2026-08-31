# Editor, i18n, and CDK Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound editor hot-path work, coalesce upload/stream events, and deduplicate concurrent translations without changing public behavior.

**Architecture:** Keep every optimization private to its current service/component. Use revision-scoped indexes, one-frame schedulers, and in-flight maps with explicit invalidation and teardown; preserve all editor documents, events, and public APIs.

**Tech Stack:** Angular signals, Tiptap/ProseMirror transactions and decorations, Vitest, Nx, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-27-editor-i18n-cdk-performance-design.md`

## Global Constraints

- Read `libs/editor/CLAUDE.md`, `libs/i18n/CLAUDE.md`, `libs/cdk/data-source/CLAUDE.md`, and applicable `.claude/rules/*.md` before editing.
- Public exports, selectors, inputs, outputs, providers, and result shapes remain unchanged.
- Long streams use at most 300 scheduled reveal frames and retain constant active decoration state.
- Terminal upload state flushes synchronously; pending animation frames are cancelled on teardown.
- Evidence-gated P3 candidates are changed only after an operation-count regression is first demonstrated.
- Update the relevant project `CLAUDE.md` after implementation changes.

---

### Task 1: Bound AI stream transactions and decorations

**Files:**
- Modify: `libs/editor/src/lib/ai/editor-ai-stream.ts`
- Test: `libs/editor/src/lib/ai/editor-ai-stream.spec.ts`
- Modify: `libs/editor/CLAUDE.md`

**Interfaces:**
- Consumes: existing stream options, ProseMirror transaction metadata, and reveal scheduler.
- Produces: private `MLV_EDITOR_AI_MAX_REVEAL_FRAMES = 300` and `nextRevealBatchSize(remaining: number, framesRemaining: number, configuredBatch: number): number`.

- [ ] **Step 1: Write failing operation-count tests**

```ts
it('bounds a 10,000 character reveal to 300 scheduled frames', async () => {
  const harness = createStreamHarness({ response: 'x'.repeat(10_000), revealBatchSize: 4 });
  await harness.finishAllFrames();
  expect(harness.frameCount).toBeLessThanOrEqual(300);
  expect(harness.text()).toBe('x'.repeat(10_000));
});

it('keeps transient stream decorations bounded', async () => {
  const harness = createStreamHarness({ response: 'x'.repeat(10_000) });
  await harness.finishAllFrames();
  expect(Math.max(...harness.decorationCounts)).toBeLessThanOrEqual(2);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `yarn nx run editor:test -- --run libs/editor/src/lib/ai/editor-ai-stream.spec.ts`
Expected: FAIL because the current fixed batch creates about 2,500 frames and a growing decoration set.

- [ ] **Step 3: Implement the bounded reveal**

```ts
const MLV_EDITOR_AI_MAX_REVEAL_FRAMES = 300;

function nextRevealBatchSize(
  remaining: number,
  framesRemaining: number,
  configuredBatch: number,
): number {
  return Math.max(configuredBatch, Math.ceil(remaining / Math.max(1, framesRemaining)));
}
```

Track one active/recent decoration range instead of appending one permanent decoration per chunk. Clear it on completion, cancel, and error while preserving transaction metadata, undo grouping, and final document text.

- [ ] **Step 4: Run all stream tests**

Run: `yarn nx run editor:test -- --run libs/editor/src/lib/ai/editor-ai-stream.spec.ts`
Expected: PASS, including final content, Unicode, cancellation, error, and decoration cleanup.

- [ ] **Step 5: Document and commit**

Update the streaming internals section in `libs/editor/CLAUDE.md` with the private frame bound and decoration lifetime.

```bash
git add libs/editor/src/lib/ai/editor-ai-stream.ts libs/editor/src/lib/ai/editor-ai-stream.spec.ts libs/editor/CLAUDE.md
git commit -m "perf(editor): bound AI stream rendering"
```

### Task 2: Index block-handle geometry

**Files:**
- Modify: `libs/editor/src/lib/extensions/editor-block-handle.ts`
- Test: `libs/editor/src/lib/extensions/editor-block-handle.spec.ts`
- Modify: `libs/editor/CLAUDE.md`

**Interfaces:**
- Produces private `BlockGeometry` records and `findBlockAtY(blocks: readonly BlockGeometry[], y: number): BlockGeometry | null`.
- Cache owner: current editor view; invalidated by document/view remapping or resize; destroyed with the extension.

- [ ] **Step 1: Add failing lookup/coalescing tests**

```ts
it('indexes block positions once and binary-searches pointer frames', () => {
  const harness = createBlockHandleHarness(1_000);
  harness.move(10, 11, 12);
  harness.flushFrame();
  expect(harness.indexBuilds).toBe(1);
  expect(harness.lookups).toBe(1);
  expect(harness.measuredBlocks).toBe(1_000);
});
```

Also assert first/middle/last/outside results and one rebuild after document or resize invalidation.

- [ ] **Step 2: Verify the existing implementation fails the count test**

Run: `yarn nx run editor:test -- --run libs/editor/src/lib/extensions/editor-block-handle.spec.ts`
Expected: FAIL because every raw move scans/measures blocks and drag start remaps them again.

- [ ] **Step 3: Implement the revision-owned index**

```ts
interface BlockGeometry {
  readonly dom: HTMLElement;
  readonly index: number;
  readonly pos: number;
  readonly top: number;
  readonly bottom: number;
}

function findBlockAtY(blocks: readonly BlockGeometry[], y: number): BlockGeometry | null {
  let low = 0;
  let high = blocks.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const block = blocks[middle];
    if (y < block.top) high = middle - 1;
    else if (y >= block.bottom) low = middle + 1;
    else return block;
  }
  return null;
}
```

Build positions and normalized scroll-space bounds in one pass, coalesce moves with one RAF, reuse the table for drag snapshots, retain widget-category checks, and cancel observers/frames on destroy.

- [ ] **Step 4: Run block-handle tests**

Run: `yarn nx run editor:test -- --run libs/editor/src/lib/extensions/editor-block-handle.spec.ts`
Expected: PASS with O(n) builds and one O(log n) lookup per frame.

- [ ] **Step 5: Document and commit**

```bash
git add libs/editor/src/lib/extensions/editor-block-handle.ts libs/editor/src/lib/extensions/editor-block-handle.spec.ts libs/editor/CLAUDE.md
git commit -m "perf(editor): index block handle geometry"
```

### Task 3: Cache document statistics by content revision

**Files:**
- Modify: `libs/editor/src/lib/editor/editor.ts`
- Modify: `libs/editor/src/lib/status/editor-status.ts`
- Test: `libs/editor/src/lib/status/editor-status.spec.ts`
- Test: `libs/editor/src/lib/editor/editor.spec.ts`
- Modify: `libs/editor/CLAUDE.md`

**Interfaces:**
- Produces an internal content revision incremented only for `transaction.docChanged` and one computed `{ characters, words }` snapshot per revision.

- [ ] **Step 1: Add a failing selection-only regression**

```ts
it('does not rescan document counts for selection-only transactions', () => {
  const scan = vi.spyOn(harness.characterCount, 'characters');
  harness.readStatus();
  harness.moveSelection(1, 2, 3);
  harness.readStatus();
  expect(scan).toHaveBeenCalledTimes(1);
});
```

Add a companion assertion that one `docChanged` transaction invalidates once and updates both values.

- [ ] **Step 2: Verify failure**

Run: `yarn nx run editor:test -- --run libs/editor/src/lib/status/editor-status.spec.ts`
Expected: FAIL because the shared revision currently invalidates on selection changes.

- [ ] **Step 3: Implement content-only invalidation**

Expose a private/internal content revision from editor context and make one status computed read both counts after that revision changes. Keep selection-dependent effects on the existing editor revision.

- [ ] **Step 4: Run status and editor tests**

Run: `yarn nx run editor:test -- --run libs/editor/src/lib/status/editor-status.spec.ts libs/editor/src/lib/editor/editor.spec.ts`
Expected: PASS for selection, Unicode/whitespace, and document changes.

- [ ] **Step 5: Document and commit**

```bash
git add libs/editor/src/lib/editor/editor.ts libs/editor/src/lib/status/editor-status.ts libs/editor/src/lib/status/editor-status.spec.ts libs/editor/src/lib/editor/editor.spec.ts libs/editor/CLAUDE.md
git commit -m "perf(editor): cache document status counts"
```

### Task 4: Coalesce upload progress

**Files:**
- Modify: `libs/editor/src/lib/upload/editor-image-upload-coordinator.ts`
- Modify: `libs/editor/src/lib/extensions/editor-upload-placeholder.ts`
- Test: `libs/editor/src/lib/upload/editor-image-upload-coordinator.spec.ts`
- Modify: `libs/editor/CLAUDE.md`

**Interfaces:**
- Produces per-upload pending integer progress and one RAF handle; terminal calls use `flushProgress(id)` synchronously.

- [ ] **Step 1: Add failing burst/terminal tests**

```ts
it('publishes at most one non-terminal placeholder update per frame', () => {
  harness.progress(1.1, 1.2, 1.9, 2.1, 9.8);
  expect(harness.placeholderUpdates).toHaveLength(0);
  harness.flushFrame();
  expect(harness.placeholderUpdates).toEqual([10]);
});
```

Add tests for duplicate integer buckets, immediate 100%, success, failure, cancellation, and destroy cancellation.

- [ ] **Step 2: Verify failure**

Run: `yarn nx run editor:test -- --run libs/editor/src/lib/upload/editor-image-upload-coordinator.spec.ts`
Expected: FAIL because callbacks currently dispatch immediately.

- [ ] **Step 3: Implement quantized frame publication**

Normalize the provider's current progress scale using existing rules, round to the displayed integer, skip equality with the last published value, retain only the latest pending value, and schedule one RAF. Terminal paths cancel the RAF and publish the latest/terminal state before placeholder removal.

- [ ] **Step 4: Run upload/editor tests**

Run: `yarn nx run editor:test -- --run libs/editor/src/lib/upload/editor-image-upload-coordinator.spec.ts libs/editor/src/lib/toolbar/editor-image-upload.spec.ts`
Expected: PASS.

- [ ] **Step 5: Document and commit**

```bash
git add libs/editor/src/lib/upload/editor-image-upload-coordinator.ts libs/editor/src/lib/extensions/editor-upload-placeholder.ts libs/editor/src/lib/upload/editor-image-upload-coordinator.spec.ts libs/editor/CLAUDE.md
git commit -m "perf(editor): coalesce upload progress"
```

### Task 5: Deduplicate in-flight AI translations

**Files:**
- Modify: `libs/i18n/src/lib/ai/ai-translation.service.ts`
- Create: `libs/i18n/src/lib/ai/ai-translation.service.spec.ts`
- Modify: `libs/i18n/CLAUDE.md`

**Interfaces:**
- Produces private `_inFlight = new Map<string, Promise<string | null>>()` keyed by all provider-affecting request fields.

- [ ] **Step 1: Write failing concurrency tests**

```ts
it('shares one provider call for identical concurrent misses', async () => {
  const first = service.translate('ro', 'save', 'Save');
  const second = service.translate('ro', 'save', 'Save');
  provider.resolve('Salvează');
  await expect(Promise.all([first, second])).resolves.toEqual(['Salvează', 'Salvează']);
  expect(provider.translate).toHaveBeenCalledTimes(1);
});
```

Add non-collision and rejected-request retry tests.

- [ ] **Step 2: Verify failure**

Run: `yarn nx run i18n:test -- --run libs/i18n/src/lib/ai/ai-translation.service.spec.ts`
Expected: FAIL with two provider calls.

- [ ] **Step 3: Implement in-flight sharing**

```ts
const pending = this._inFlight.get(cacheKey);
if (pending) return pending;
const request = this._provider.translate(requestData)
  .then(value => { /* populate existing value cache */ return value; })
  .finally(() => this._inFlight.delete(cacheKey));
this._inFlight.set(cacheKey, request);
return request;
```

- [ ] **Step 4: Run i18n tests**

Run: `yarn nx run i18n:test`
Expected: PASS, including existing cache behavior.

- [ ] **Step 5: Document and commit**

```bash
git add libs/i18n/src/lib/ai/ai-translation.service.ts libs/i18n/src/lib/ai/ai-translation.service.spec.ts libs/i18n/CLAUDE.md
git commit -m "perf(i18n): deduplicate translation requests"
```

### Task 6: Evaluate lower-priority candidates and close the batch

**Files:**
- Test/modify only with evidence: `libs/cdk/data-source/src/lib/array-data-source.spec.ts`, `array-data-source.ts`
- Test/modify only with evidence: `libs/editor/src/lib/editor-toolbar-context.spec.ts`, `editor-toolbar-context.ts`, `toolbar/editor-toolbar-widget.ts`
- Test/modify only with evidence: `libs/editor/src/lib/ai/editor-ai-context.spec.ts`, `editor-ai-context.ts`
- Test/modify only with evidence: `libs/editor/src/lib/extensions/editor-block-handle.spec.ts`, `editor-block-handle.ts`
- Test/modify only with evidence: `libs/i18n/src/lib/i18n-resolver.service.spec.ts`, `i18n-resolver.service.ts`

**Interfaces:**
- Produces operation-count evidence and only the minimal fast path that makes a demonstrated regression pass.

- [ ] **Step 1: Add focused measurement tests**

Use spies/counters to measure constant filter normalization, toolbar sort calls, AI serialization calls per action, copied drag-ghost style properties, and compiled ICU entries under dynamic input. Each test records a fixed large input and an explicit count; do not assert wall-clock time.

- [ ] **Step 2: Run measurements on the unchanged candidates**

Run: `yarn nx run-many -t test -p editor,i18n,cdk-data-source`
Expected: Record which candidates exceed the spec's repeated-work condition. A candidate without repeat evidence remains unchanged.

- [ ] **Step 3: Implement proven fast paths only**

For proven cases, compile filter constants/sets once, share one toolbar computed ordered list, serialize once per AI action, copy a bounded style allowlist, or add an explicit-size LRU. Preserve custom comparator/ICU behavior and document cache ownership.

- [ ] **Step 4: Run batch verification**

Run: `yarn nx run-many -t test,lint,typecheck -p editor,i18n,cdk-data-source`
Expected: PASS for every available target; report any evidence-gated candidate deliberately left unchanged.

- [ ] **Step 5: Commit evidence-backed candidate changes**

```bash
git add libs/cdk/data-source/src/lib/array-data-source.ts libs/cdk/data-source/src/lib/array-data-source.spec.ts libs/editor/src/lib/editor-toolbar-context.ts libs/editor/src/lib/editor-toolbar-context.spec.ts libs/editor/src/lib/toolbar/editor-toolbar-widget.ts libs/editor/src/lib/ai/editor-ai-context.ts libs/editor/src/lib/ai/editor-ai-context.spec.ts libs/editor/src/lib/extensions/editor-block-handle.ts libs/editor/src/lib/extensions/editor-block-handle.spec.ts libs/i18n/src/lib/i18n-resolver.service.ts libs/i18n/src/lib/i18n-resolver.service.spec.ts
git commit -m "perf: optimize measured editor support paths"
```
