# Core lifecycle and bounded-cache performance remediation — design

Date: 2026-08-27
Status: approved
Scope: resource ownership and lifecycle-sensitive caching under `libs/core`

## Problem

Most audited lifecycle code cleans up correctly, but file-upload previews can retain component-owned blob URLs until explicit removal, and the shared focusable-group base can retain a stale key manager when its item list becomes empty. These are small per operation but accumulate across repeated component creation, file replacement, and dynamic group updates.

This batch also provides the common acceptance rules for any bounded cache introduced by the other performance batches.

## Goals

- Revoke every blob URL owned by file upload exactly once.
- Tear down focus managers before replacing them or transitioning to an empty collection.
- Give every new cache explicit ownership, invalidation, and size/lifetime bounds.
- Preserve public values and component behavior.

## Non-goals

- No upload API, preview UI, keyboard model, or public type changes.
- No global cache framework.
- No revocation of consumer-owned URLs.
- No cache introduced only to make code look faster.

## 1. File-upload preview ownership

Affected implementation: `libs/core/file-upload/src/lib/file-upload/file-upload.ts`.

Track blob URLs created by the component in a private `Set<string>`. Centralize creation/revocation through private helpers:

- creation records the URL as component-owned;
- file removal revokes and removes the corresponding owned URL;
- value replacement revokes URLs no longer referenced before creating replacements;
- clear/reset revokes all removed owned URLs;
- `DestroyRef` revokes every remaining owned URL;
- repeated cleanup is idempotent.

URLs supplied by consumers or produced by non-blob preview sources are never added to the ownership set and are never revoked by the component.

### Tests

- Add, remove, replace, clear/reset, and destroy each revoke the expected owned URL exactly once.
- Replacing the same retained file does not revoke its still-used preview prematurely.
- Consumer-provided URLs are never revoked.
- Upload completion/failure and forms behavior remain unchanged.

## 2. Focusable-group manager teardown

Affected implementation: `libs/core/form-utils/src/lib/focusable-group-base.ts`.

Whenever the queried item collection changes, destroy/unsubscribe the previous key manager before any early return. If the new collection is empty, store no manager. If non-empty, create one manager and bind it to the current collection. Component destruction follows the same idempotent teardown helper.

### Tests

- Non-empty to empty destroys the old manager and clears the reference.
- Empty to non-empty creates exactly one manager.
- Repeated query changes never leave more than one active subscription/manager.
- Existing orientation, wrapping, disabled-item, and focus behavior remain unchanged.

## 3. Cache ownership rules for all batches

Any cache or index added by the performance remediation must document and test:

- **Owner:** the component/service instance or operation that owns it;
- **Key:** all inputs that can change the derived value;
- **Invalidation:** the exact signal, transaction, observer, or lifecycle event that clears/rebuilds it;
- **Bound:** operation-local, current-view-only, explicit maximum entry count, or component-lifetime stable vocabulary;
- **Failure behavior:** in-flight entries are evicted after rejection/cancellation;
- **Cleanup:** observers, scheduled frames, object URLs, and retained DOM references are released on destroy.

Unbounded caches keyed by consumer-controlled strings, DOM nodes, document revisions, or historical events are prohibited. A cache that cannot state a safe bound uses recomputation or an explicit LRU with a tested limit.

## 4. Cross-batch lifecycle audit

Before each performance batch is considered complete, review its new long-lived state against the rules above:

- editor block indexes retain only the current view revision and release DOM references on invalidation/destroy;
- translation in-flight maps evict on settle and completed caches retain their existing documented bound;
- chat live IDs retain only active animations;
- calendar/filter/message indexes are signal-owned and retain only the latest computed revision;
- tile operation indexes are operation-local;
- geometry caches clear observers/listeners and contain only current elements;
- pending animation frames are cancelled or terminally flushed.

This audit is a review/test requirement, not a new shared abstraction.

## Compatibility and documentation

- No public API or visible behavior changes.
- Update `libs/core/file-upload/CLAUDE.md` and `libs/core/form-utils/CLAUDE.md` with ownership/teardown guarantees.
- Other project docs describe cache invalidation when their implementation changes.

## Verification

- Run `test`, `typecheck`, and `lint` for `core-file-upload` and `core-form-utils` through Nx.
- Use spies for `URL.createObjectURL`, `URL.revokeObjectURL`, manager destruction, subscriptions, observers, and scheduled-frame cancellation.
- Run the affected forms and keyboard integration tests.

## Acceptance criteria

- No component-owned blob URL survives removal, reset, replacement, or destruction.
- No stale focus manager survives an empty collection or manager replacement.
- Every new cache/index in all four batches has a documented key, invalidation trigger, bound, and cleanup path.
- Lifecycle cleanup is idempotent and covered by regression tests.
