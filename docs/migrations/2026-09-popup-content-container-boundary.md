# 2026-09 — a popup's panel is outside its container's injector scope

**Packages:** `@malva-ui/core/popup` (`MlvPopup`, `MlvPopupContainer`, `MlvPopupTrigger`), and every component that composes them.
**Kind:** breaking, **behaviour only**. Nothing was renamed, removed or retyped — no export, selector, input, output, token or class name changed. What changed is which `[mlvPopupTrigger]`s resolve `POPUP_CONTAINER`, and which element an already-open container anchors its next open to. Fixes #225.

---

## Why

`MlvPopupTrigger` picks its mode in its constructor, from `inject(POPUP_CONTAINER, { optional: true })`:

- **Container mode** — a container is in scope. The trigger owns no overlay: it registers its own host as the container's origin (`registerTrigger`) and delegates `open` / `close` / `toggle` to the container.
- **Standalone mode** — no container. The trigger drives its own CDK overlay for the popup bound as `[mlvPopupTrigger]="somePopup"`.

`<ng-template mlvPopupContent>` is declared lexically **inside** `<mlv-popup-container>`, and portaling the panel into the CDK overlay moves DOM, not the node injector. A directive rendered in the panel therefore still resolved `POPUP_CONTAINER` up the _declaration_ tree and found the container the panel belongs to. So a `[mlvPopupTrigger]` inside a panel silently became a **container** trigger:

1. Its click ran `container.toggle()` — closing the popup it lives in — instead of opening its own.
2. Its `aria-expanded` kept reporting the popup it was bound to, which nothing was toggling.
3. It overwrote `MlvPopupContainer._triggerOrigin` with its own `ElementRef`.

(3) is what produced the reported symptom. `registerTrigger` has no unregister, so that element died with the panel on close and the container kept holding it. The next open handed CDK a detached `ElementRef`, and `FlexibleConnectedPositionStrategy._getOriginRect()` measures a detached node as an all-zero rect **without throwing** — so the position resolved against 0,0 and the panel rendered in the top-left corner of the viewport.

`mlv-color-picker-popup` reaches this through `mlv-color-picker` → `mlv-tab-group`: when the tab strip overflows, its overflow button is a `[mlvPopupTrigger]` inside the panel. The strip overflows by roughly a pixel at the docs page's width, which is why the bug reads as intermittent — the first open after a page load is anchored correctly and every later one is not.

---

## What changed

### 1. `MlvPopup` closes the injector boundary

```ts
@Component({
  selector: 'mlv-popup',
  providers: [{ provide: POPUP_CONTAINER, useValue: null }],
})
```

Nothing inside `<mlv-popup>` — panel chrome, projected `[mlvPopupContent]`, or any component rendered in there — resolves the container any more. `null` rather than omitting the provider: `inject(POPUP_CONTAINER, { optional: true })` has to stop **here** rather than keep walking to the container above.

A trigger declared as a **sibling** of `<mlv-popup>` sits above `MlvPopup` in the injector chain, is outside the boundary, and is unaffected. That is the ordinary container-mode arrangement, and it is the one every container-mode consumer in this library uses.

### 2. `MlvPopupContainer` refuses a detached origin

Each attach resolves the origin instead of reading the field:

```diff
-      origin: this._triggerOrigin ?? this._elementRef,
+      origin: this._resolveOrigin(),
```

`_resolveOrigin()` returns the registered trigger while its element is still in the document, and the container's own host otherwise. That covers the panel case above and, independently, any trigger removed while the popup was closed — an `@if` that stopped matching, a virtualised row.

The predicate is `isConnected`: still in the **document**, not still rendered. A trigger hidden with `display: none` on itself or an ancestor stays connected and still measures an all-zero rect, so the fallback does not fire for it. That boundary is deliberate — widening it to `getClientRects().length > 0` would silently relocate panels anchored to intentionally 0×0 elements, which is an established positioning pattern.

The two guards are independent: either one alone fixes #225.

---

## What you have to do

**Almost certainly nothing.** For every arrangement in this workspace this is a bug fix — a container-mode popup that used to drift to the corner now stays on its trigger, and a trigger inside a panel now drives the popup it is bound to.

One arrangement changes meaning, and it is the breaking half:

### A bare `mlvPopupTrigger` inside `<mlv-popup>` content is now a no-op

A **bare** attribute is how you write a container trigger — no value, the container holds the popup reference. Written inside the panel it used to toggle the enclosing container, so the realistic shape is a **close** button:

```html
<!-- BEFORE: this closed the surrounding container. It no longer does anything. -->
<mlv-popup-container>
  <button mlvPopupTrigger>Open</button>
  <mlv-popup>
    <ng-template mlvPopupContent>
      …
      <button mlvPopupTrigger>Done</button>
    </ng-template>
  </mlv-popup>
</mlv-popup-container>
```

It is now standalone with no popup bound, which is a directive that does nothing at all — no error, no overlay, no toggle. Nothing in `libs/` or `apps/` writes it, so nothing in this workspace changes; a downstream consumer of the published package can be doing it. Pick one of three edits:

| Fix                                                         | When                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------- |
| Give the trigger its own popup: `[mlvPopupTrigger]="inner"` | The button was meant to open a nested popup, not close the outer |
| Move it out of the `<ng-template>`, beside `<mlv-popup>`    | It really is the container's trigger and belongs in the anchor   |
| Call the container through a template reference             | It is a close button inside the panel — the common case          |

The third needs no DI at all and is the one to reach for:

```html
<mlv-popup-container #c>
  <button mlvPopupTrigger>Open</button>
  <mlv-popup>
    <ng-template mlvPopupContent>
      …
      <button (click)="c.close()">Done</button>
    </ng-template>
  </mlv-popup>
</mlv-popup-container>
```

`open()`, `close()` and `toggle()` are public on `MlvPopupContainer` and always were.

---

## Not affected

- **The sibling arrangement.** A `[mlvPopupTrigger]` declared next to `<mlv-popup>` inside the container — `mlv-select`, `mlv-combobox`, `mlv-day-picker`, `mlv-date-range-picker`, `mlv-time-picker`, `mlv-color-picker-popup`, `mlv-sidebar-item`'s tooltip and `mlv-sidebar-group`'s flyout. All of them keep container mode, keep registering their origin, and gain the detached-origin fallback for free.
- **`mlv-menu` and `[mlvContextMenuTrigger]`.** `mlv-menu` _does_ render `<mlv-popup>`, so the new provider **is** installed in every menu panel — that is not why menus are unaffected. They are unaffected because neither `MlvMenuTrigger` nor `MlvContextMenuTrigger` injects `POPUP_CONTAINER`: both go through `MlvPopupService` directly and never took part in container mode. A menu opened from inside another panel behaved correctly before this change and behaves the same after it.
- **Every service-opened overlay** — `MlvPopupService.open()`, `MlvDialogService`, `MlvDrawerService`, `MlvToastService`. No container is in the picture, and the origin comes from the config.
- **Every public member.** `MlvPopupContainer.open` / `close` / `toggle` / `registerTrigger`, `MlvPopupTrigger.open` / `close` / `toggle` and its `mlvPopupTrigger` / `triggerOn` / `ariaHasPopup` inputs, `POPUP_CONTAINER` and `MlvPopupContainerRef`, and every `MlvPopup` input and output. Signatures and semantics are untouched.

## Known limits

`MlvPopup`'s provider guards the **panel**, not the container's whole subtree. A trigger-bearing component placed inside `<mlv-popup-container>` but **outside** `<mlv-popup>` still resolves the container — correctly for a trigger written on purpose, incidentally for one that happens to be nested in some other component you dropped into the anchor area. There are zero occurrences of the second shape today; the detached-origin fallback is what keeps it from producing #225's symptom if one appears.
