# 2026-09 — a destroyed container trigger stops governing its container

**Packages:** `@malva-ui/core/popup` (`MlvPopupContainer`, `MlvPopupTrigger`, `MlvPopupContainerRef`); `@malva-ui/core/items-more` (internal only, no visible change).
**Kind:** breaking, **behaviour only**. No exported symbol was renamed or removed, and no signature was narrowed. Additive: `MlvPopupContainer.unregisterTrigger(origin)` and the **optional** `MlvPopupContainerRef.unregisterTrigger?(origin)`. Fixes #230.

---

## Why

`MlvPopupContainer.registerTrigger(origin, hasBackdrop)` wrote two plain fields and had no counterpart:

- **Registration outlived the trigger.** A container-mode `mlvPopupTrigger` inside an `@if` kept governing the container after it was destroyed. The container kept referencing its detached element, and kept its backdrop preference. A hover trigger registers `hasBackdrop: false`, so once it was gone every later open of a popup with `hasBackdrop` unset stayed **backdrop-less** — contradicting `MlvPopup.hasBackdrop`'s own contract ("when `undefined`, the trigger decides"). #225's `isConnected` fallback repaired the origin half only.
- **No arbitration.** Two triggers in one container overwrote each other; destroying the later one could not hand control back to the earlier one.

## What changed

- `registerTrigger` pushes onto a **stack**. The top entry supplies the origin and the `hasBackdrop` fallback of the next attach.
  - Latest registration wins — unchanged from before. With two live triggers that is the one that registered last, not the one the user activated (#282).
  - An element that registers again **moves to the top** with its new `hasBackdrop` (never a duplicate). `MlvPopupTrigger` re-registers when `triggerOn` changes — unchanged outcome.
  - Keyed by `nativeElement`, not by `ElementRef` identity.
  - **Nothing is pruned.** Every distinct element stays referenced until it is unregistered or the container is destroyed. The single slot this replaces held only the latest element. Pruning disconnected entries was rejected: a view that is alive but detached (an inactive tab panel, a CDK virtual-scroll view cache) registered once and never registers again.
- New `unregisterTrigger(origin)` removes that element's entry wherever it sits. Unknown element: no-op.
- `MlvPopupTrigger` (container mode) calls it from its `DestroyRef`.
- Resolution still happens **per attach**: an overlay already open is **not re-anchored**. An open overlay whose origin trigger is destroyed keeps that origin, and CDK re-measures the detached node on its next reposition (scroll, resize) — an all-zero rect, so the panel jumps to the viewport's top-left corner. Not new in #230; tracked in #283.
- Unchanged: a top entry whose element has left the document without being unregistered still falls back to the container host (#225), and its backdrop still applies. Only the top entry is consulted — a detached top does not fall through to an earlier registration.

## Before / after

Popup with `hasBackdrop` unset, trigger(s) written as bare `mlvPopupTrigger` inside `<mlv-popup-container>`:

| Arrangement, then the next open                              | Before (on `main` after #237)          | After                                                                                                 |
| ------------------------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| One hover trigger in an `@if`, destroyed; `container.open()` | host origin, **no backdrop** (latched) | host origin, **backdrop**                                                                             |
| One click trigger in an `@if`, destroyed                     | host origin, backdrop                  | host origin, backdrop — no change                                                                     |
| Triggers A then B, B destroyed                               | **host** origin, **B's** backdrop      | **A's** origin, **A's** backdrop                                                                      |
| Triggers A then B, A destroyed                               | B's origin and backdrop                | B's origin and backdrop — no change                                                                   |
| Either trigger destroyed while the popup is open             | not re-anchored (0,0 on reposition)    | not re-anchored (0,0 on reposition) — no change, #283                                                 |
| Direct `registerTrigger` caller, never unregisters           | latest call wins; only it is retained  | latest call wins; **every distinct element is kept until unregistered or the container is destroyed** |

With `[hasBackdrop]` set on `<mlv-popup>`, only the origin row for "A then B, B destroyed" changes.

**On the last release, `0.1.15`** (which predates #237): rows 1–3 did not fall back to the host. The container handed CDK the destroyed trigger's detached element, which measures as an all-zero rect, so those opens rendered at the viewport's top-left corner (0,0). The backdrop column was as above. Upgrading from `0.1.15`, rows 1 and 2 change from 0,0 to the host, and row 3 from 0,0 to trigger A.

## Who is affected

- **Affected:**
  - A consumer template with a container-mode `mlvPopupTrigger` whose lifetime is shorter than its `<mlv-popup-container>` — inside `@if` / `@for` / `@switch`, or inside a component destroyed while the container lives — **and** a later open of that container. **Zero occurrences in `libs/` or `apps/`.**
  - Code that calls `registerTrigger` directly with elements that are destroyed or re-created while the container lives (for example one fresh element per open) and never unregisters: it now retains every one of them. Nothing is anchored differently. `mlv-items-more` was the one in-repo caller of this shape and now unregisters.
- **Not affected:**
  - Container-mode consumers with no trigger directive (`mlv-select`, `mlv-combobox`, `mlv-day-picker`, `mlv-date-range-picker`, `mlv-time-picker`, `mlv-color-picker-popup`, `mlv-editor-ai-menu`, `mlv-sidebar-item`'s tooltip) — they never register.
  - `mlv-sidebar-group` — its flyout trigger and both containers share one `@if`, so trigger and container die together; its tooltip registration is imperative and never withdrawn, as before.
  - `mlv-items-more` — now withdraws its opener on close and before registering a different one, so the container never accumulates re-created in-row triggers; every open still registers the clicked opener with `hasBackdrop: false`.
  - Standalone `[mlvPopupTrigger]="popup"`, `mlv-menu`, `[mlvContextMenuTrigger]`, every service-opened overlay.
  - A consumer class implementing `MlvPopupContainerRef` — the new member is optional; omitting it keeps a destroyed trigger's registration in force, i.e. the old behaviour.

## What you have to do

**Almost certainly nothing.** Edits are owed only in these cases:

| Case                                                                               | Edit                                                                                |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| You call `registerTrigger` directly with elements that are destroyed or re-created | Call `unregisterTrigger(origin)` when each one goes, or before registering the next |
| You relied on no backdrop after a hover trigger left the view                      | Set `[hasBackdrop]="false"` on `<mlv-popup>`                                        |
| You relied on host anchoring after the later of two triggers left the view         | See _Keeping the host anchor_ below                                                 |
| You have your own `POPUP_CONTAINER` implementation that should pop back            | Implement `unregisterTrigger(origin)`                                               |

### Keeping the host anchor

Take `mlvPopupTrigger` off the earlier button, so it never registers, and drive the container through a template reference. The directive also wrote `aria-expanded` and `aria-haspopup` and handled hover/focus opening (`triggerOn`), so write those yourself:

```html
<mlv-popup-container #c>
  <button type="button" aria-haspopup="dialog" [attr.aria-expanded]="c.isOpen()" (click)="c.toggle()">Open</button>
  <mlv-popup>…</mlv-popup>
</mlv-popup-container>
```

- `aria-haspopup`: use the value you passed to `[ariaHasPopup]` (the directive's default is `"dialog"`), or leave it out where you passed `null`.
- Hover/focus opening is gone with the directive. If the button used `triggerOn` with `'hover'` or `'focus'`, bind `(mouseenter)` / `(focus)` to `c.open()` and `(mouseleave)` / `(blur)` to `c.close()`. The directive's short hover-close delay is not reproduced by this.
