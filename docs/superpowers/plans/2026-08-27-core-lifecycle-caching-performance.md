# Core Lifecycle and Bounded Cache Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the confirmed preview-resource and focus-manager lifecycle leaks and audit every new performance cache for explicit ownership and cleanup.

**Architecture:** Component-created object URLs live in an ownership set with centralized idempotent revocation. Focus manager replacement uses one teardown helper before all early returns. Cross-batch review verifies each new map/index/frame/observer has a bounded lifetime.

**Tech Stack:** Angular DestroyRef/signals, CDK FocusKeyManager, browser URL APIs, Vitest, Nx.

**Spec:** `docs/superpowers/specs/2026-08-27-core-lifecycle-caching-performance-design.md`

## Global Constraints

- Read `libs/core/file-upload/CLAUDE.md`, `libs/core/form-utils/CLAUDE.md`, component/accessibility rules, and the two implementation files before editing.
- Revoke only URLs created by the component; never revoke consumer-provided URLs.
- Cleanup is idempotent across remove, replace, reset, and destroy.
- At most one focus manager/subscription exists; empty collections retain none.
- Every new cache across all batches states owner, key, invalidation, bound, failure behavior, and cleanup.
- No public API or visible behavior changes.

---

### Task 1: Own and revoke file preview URLs

**Files:**
- Modify: `libs/core/file-upload/src/lib/file-upload/file-upload.ts`
- Test: `libs/core/file-upload/src/lib/file-upload/file-upload.spec.ts`
- Test if cover behavior is affected: `libs/core/file-upload/src/lib/file-upload/file-upload-cover.spec.ts`
- Modify: `libs/core/file-upload/CLAUDE.md`

**Interfaces:**
- Produces `_ownedPreviewUrls`, `_createOwnedPreviewUrl`, `_revokeOwnedPreviewUrl`, and `_revokeAllOwnedPreviewUrls`.

- [ ] **Step 1: Add failing ownership/lifetime tests**

```ts
it('revokes only component-owned previews on destroy', () => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:owned-preview');
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  harness.addImage(imageFile);
  harness.seedExternalPreview('https://example.test/seed.png');
  harness.destroy();
  expect(revoke).toHaveBeenCalledTimes(1);
  expect(revoke).toHaveBeenCalledWith('blob:owned-preview');
});
```

Add remove-then-destroy, single replacement, clear/reset, retained file, and failure cases; every owned URL is revoked exactly once.

- [ ] **Step 2: Verify the destruction regression**

Run: `yarn nx run core-file-upload:test -- --run libs/core/file-upload/src/lib/file-upload/file-upload.spec.ts`
Expected: FAIL because surviving previews are not revoked on destroy.

- [ ] **Step 3: Implement centralized ownership**

```ts
private readonly _ownedPreviewUrls = new Set<string>();

private _revokeOwnedPreviewUrl(url: string | undefined): void {
  if (!url || !this._ownedPreviewUrls.delete(url)) return;
  URL.revokeObjectURL(url);
}
```

Route creation/removal/replacement/reset through the helpers and call `_revokeAllOwnedPreviewUrls` from `DestroyRef.onDestroy`. Retained previews remain valid until no selected item references them.

- [ ] **Step 4: Run file-upload tests**

Run: `yarn nx run core-file-upload:test`
Expected: PASS for previews, cover state, uploads, and forms.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/file-upload/src/lib/file-upload/file-upload.ts libs/core/file-upload/src/lib/file-upload/file-upload.spec.ts libs/core/file-upload/src/lib/file-upload/file-upload-cover.spec.ts libs/core/file-upload/CLAUDE.md
git commit -m "fix(file-upload): release owned preview URLs"
```

### Task 2: Tear down empty focusable groups

**Files:**
- Modify: `libs/core/form-utils/src/lib/focusable-group-base.ts`
- Create: `libs/core/form-utils/src/lib/focusable-group-base.spec.ts`
- Modify: `libs/core/form-utils/CLAUDE.md`

**Interfaces:**
- Produces private `_destroyKeyManager(): void` that clears the manager and its change subscription idempotently.

- [ ] **Step 1: Add a failing lifecycle test subclass**

```ts
it('destroys and clears the manager when items become empty', () => {
  const group = createTestGroup(twoItems());
  const manager = group.keyManager();
  const destroy = vi.spyOn(manager, 'destroy');
  group.setItems([]);
  flushEffects();
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(group.keyManager()).toBeUndefined();
});
```

Repopulate and assert one fresh manager/subscription plus exactly one roving `tabIndex = 0`; destroy remains idempotent.

- [ ] **Step 2: Verify the early-return leak**

Run: `yarn nx run core-form-utils:test -- --run libs/core/form-utils/src/lib/focusable-group-base.spec.ts`
Expected: FAIL because the empty-list return occurs before teardown.

- [ ] **Step 3: Implement one teardown path**

```ts
private _destroyKeyManager(): void {
  this._changeSub?.unsubscribe();
  this._changeSub = undefined;
  this._keyManager?.destroy();
  this._keyManager = undefined;
}
```

Call it at the start of the items effect, before constructing a replacement, and from `DestroyRef`; return only after teardown when items are empty.

- [ ] **Step 4: Run form-utils tests**

Run: `yarn nx run core-form-utils:test`
Expected: PASS for focus, orientation, wrapping, disabled items, rebuild, and destroy.

- [ ] **Step 5: Document and commit**

```bash
git add libs/core/form-utils/src/lib/focusable-group-base.ts libs/core/form-utils/src/lib/focusable-group-base.spec.ts libs/core/form-utils/CLAUDE.md
git commit -m "fix(form-utils): release empty focus managers"
```

### Task 3: Audit cross-batch cache ownership and verify lifecycle

**Files:**
- Review/update: all files changed by the other three performance plans
- Modify: affected `libs/*/CLAUDE.md` only when an ownership/invalidation guarantee is missing

**Interfaces:**
- Produces a completed review matrix for owner, key, invalidation, bound, failure, and cleanup; no shared cache abstraction.

- [ ] **Step 1: Build the review matrix from the actual diff**

For editor block geometry, stream/upload RAFs, translation promises, chat IDs/labels, calendar/filter indexes, tile snapshots, interaction geometry, and all observers, record the six required lifecycle properties from the spec. A missing property is a failing review item.

- [ ] **Step 2: Add a deterministic teardown test for every missing property**

Use fake RAF/observer/promise/DOM-reference spies. Examples: destroy cancels a scheduled frame, rejection removes an in-flight key, resize invalidates current geometry once, and operation-local indexes are unreachable after return.

- [ ] **Step 3: Implement only the missing cleanup/invalidation**

Keep fixes inside the owning component/service. Do not introduce a global cache manager or unbounded historical map.

- [ ] **Step 4: Run full performance-scope verification**

Run the four plans' complete Nx `test`, `typecheck`, and `lint` project sets. Expected: PASS for every available target, with no leaked fake timers/frames/observers after each test.

- [ ] **Step 5: Commit the lifecycle audit fixes**

Stage only files changed by this audit and commit them as `fix: complete performance cache cleanup`. If the review finds no gap, do not create an empty commit; record the clean audit in the final report.
