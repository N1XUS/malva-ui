# 2026-09 — `mlv-popup` resolves full-screen mode once per open

**Packages:** `@malva-ui/core/popup` (`MlvPopup`), and every consumer that opts into `mobileMode`.
**Kind:** breaking, **behaviour only**. Nothing was renamed, removed or retyped. `MlvPopup.isFullscreen()` is still public and still a `Signal<boolean>` — what changed is _when_ it is allowed to change. Fixes #126 and #144.

---

## Why

`MlvPopup` decided "full-screen sheet or trigger-anchored panel" **twice**, and only one of the two answers was reactive.

- The **panel** half was a `computed()` over `MlvBreakpointService` and the `mobileMode` / `mobileBreakpoint` inputs. It re-resolved the instant the viewport crossed the breakpoint, taking `.mlv-popup--fullscreen`, the header, the close button and the focus trap with it.
- The **overlay** half is a plain `fullscreen` boolean read once, inside `MlvPopupService.open()`, and handed to `Overlay.create()`. It never re-resolved.

A popup that stayed open across the flip ended up half-converted. Observed in the docs app on the time-picker page — open the picker at 375px (`mobileMode="auto"`, so it opens as a sheet), then widen to 1280px without closing it:

|                                  | at 375px, open                               | after the flip to 1280px                                       |
| -------------------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| `.mlv-popup` classes             | `mlv-popup--fullscreen mlv-popup--enter`     | `mlv-popup--enter mlv-popup--shadow` — **`--fullscreen` gone** |
| `.mlv-popup__header` / `__close` | present                                      | **gone**                                                       |
| CDK pane classes                 | `cdk-overlay-pane mlv-popup-fullscreen-pane` | **unchanged**                                                  |
| pane rect                        | 375×812 at (0,0)                             | **1280×812 at (0,0)**                                          |
| `.mlv-popup-fullscreen-backdrop` | present                                      | **still present**                                              |

An anchored-looking panel in the corner of a viewport-filling pane, behind a solid modal scrim, **with its close button removed** — the affordance deleted by the half that followed the viewport, the scrim that made it necessary kept by the half that did not. (Escape and a backdrop click still dismissed it, so it was never a trap; nothing on screen said so.) Narrowing an anchored dropdown is the mirror image: a panel painted as a sheet inside a content-sized, trigger-anchored pane with no scrim and no scroll lock.

### Why the panel holds still instead of the overlay catching up

`MlvPopupService.open`'s `fullscreen` flag selects **four** overlay-level things, all at `Overlay.create()` time:

| Chosen at create                                                  | Changeable on an attached overlay?             |
| ----------------------------------------------------------------- | ---------------------------------------------- |
| Global (viewport-filling) vs flexible-connected position strategy | yes — `OverlayRef.updatePositionStrategy()`    |
| The `mlv-popup-fullscreen-pane` pane class                        | yes — `addPanelClass()` / `removePanelClass()` |
| The **block** scroll strategy (page lock, no layout shift)        | yes — `updateScrollStrategy()`                 |
| The forced solid scrim (`mlv-popup-fullscreen-backdrop`)          | **no**                                         |

The scrim is the one that cannot follow. In `@angular/cdk/overlay`, `OverlayRef._attachBackdrop()` is private and is called from exactly one place — `attach()` — and `detachBackdrop()` is one-way. An overlay created without a backdrop therefore cannot grow one while attached, and `mlv-combobox` opens exactly that way (anchored, `hasBackdrop` false). The only way to add it is a detach and re-attach, which loses focus position and replays the enter animation under the user's hands.

So three of the four could chase the viewport and the fourth could not, which is not a fixable subset — a sheet without its scrim, or a scrim that outlives its sheet, is the same defect wearing different clothes. #144's suggested fix (drive the four individually from an `effect`) founders on that row of the table. The decision went the other way: **the mode is fixed for the lifetime of one open**, and the panel chrome holds still with the overlay rather than walking away from it. A sheet the user opened stays a sheet until it closes; an anchored dropdown stays anchored.

---

## What changed

### 1. `isFullscreen()` is latched while an overlay is attached

The live resolution moved into a private `_liveFullscreen` computed. `isFullscreen()` now reads a per-open latch and falls back to the live value only while the popup is closed:

```ts
// before
readonly isFullscreen = computed<boolean>(() => {
  const mode = this.mobileMode();
  if (mode === 'off') return false;
  if (mode === 'fullscreen') return true;
  return this._breakpoint.isDown(this.mobileBreakpoint())();
});

// after
private readonly _lockedFullscreen = signal<boolean | null>(null);

readonly isFullscreen = computed<boolean>(
  () => this._lockedFullscreen() ?? this._liveFullscreen(),
);
```

| State                                     | What `isFullscreen()` reports                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| Closed                                    | the live viewport and inputs, exactly as before                                |
| Open (overlay attached)                   | the mode that overlay was **built** with                                       |
| Leaving (overlay attached, animating out) | still the mode it was built with — the panel is on screen and keeps its chrome |
| Closed again                              | the live viewport and inputs again                                             |

### 2. Two `@internal` methods on `MlvPopup`

| Member                             | Visibility                  | Behaviour                                                     |
| ---------------------------------- | --------------------------- | ------------------------------------------------------------- |
| `isFullscreen(): Signal<boolean>`  | **public**, unchanged shape | latched while attached, live while closed                     |
| `lockFullscreenForOpen(): boolean` | `@internal`                 | resolves the live value (`untracked`), latches it, returns it |
| `releaseFullscreenLock(): void`    | `@internal`                 | clears the latch                                              |

They are `@internal`: an application never calls them. They exist because the flag must be one read shared by both halves, and only the code that builds the overlay is in a position to take it.

### 3. All three overlay owners latch at attach

`MlvPopupContainer._attachOverlay()`, standalone `MlvPopupTrigger._attachOverlay()` and `MlvMenuOverlayController.open()` now pass the lock instead of a bare read:

```diff
-      fullscreen: popup.isFullscreen(),
+      fullscreen: popup.lockFullscreenForOpen(),
```

so the flag the CDK overlay is created with and the value `isFullscreen()` reports for that open are literally the same read and cannot drift apart. `mlv-menu`'s own popup never sets `mobileMode`, so its lock always resolves `false` today; it takes and releases it anyway, because the invariant is _every attach latches_ — an owner that opted out would reintroduce #126 silently the day a mobile menu opts in.

### 4. The release runs after `afterClosed`

Each owner's `onClose` releases the lock **last**, after `animationState`, `opened` and `afterClosed.emit()`:

```ts
popup.animationState.set('idle');
popup.opened.set(false);
popup.afterClosed.emit();
popup.releaseFullscreenLock();
```

An `afterClosed` handler still belongs to the open that just finished. `mlv-combobox._onPopupClosed()` branches on `isFullscreen()` to reset `aria-activedescendant`, resync the display text and restore focus; releasing first would make it skip all three after a sheet whose viewport had been widened mid-flight.

Note that the release is **not** what makes the next open correct — `lockFullscreenForOpen()` overwrites the latch unconditionally at every attach, so "stuck in the previous mode" is structurally impossible either way. The release exists so that a **closed** popup reports the live viewport again, for a consumer sizing a trigger or picking chrome ahead of opening.

---

## What you have to do

**Almost certainly nothing.** For every consumer this is a bug fix: a popup that used to half-convert now stays whole, and every path that resolves the mode at open time is unchanged.

Change something only if you were **deliberately** converting a popup mid-open — a demo or a playground that toggles `[mobileMode]` or `[mobileBreakpoint]` on a `<mlv-popup>` while it is open, and expects the panel to switch under the user:

```html
<!-- This no longer converts the open popup. -->
<mlv-select [mobileMode]="mode()" />
<button (click)="mode.set('fullscreen')">Go full-screen</button>
```

Close and reopen instead — the next open re-resolves from the current inputs and viewport:

```ts
mode.set('fullscreen');
this.select().isOpen.set(false);
// …then reopen, e.g. from the user's next interaction.
```

The same applies to a test that flips `MlvBreakpointService` while a popup is open and asserts on the panel's chrome: assert across a close/reopen instead. `libs/core/popup/src/lib/popup-container/popup-container.spec.ts` and `popup-trigger.spec.ts` carry the reference fixtures, including a `FakeBreakpointService` — jsdom's `matchMedia` never matches a `min-width` query, so the real service is pinned below every breakpoint and cannot express the anchored half at all.

---

## Consumers inside the library

Every `mobileMode="auto"` consumer is affected, and all of them **gain** consistency rather than losing behaviour:

| Component                                                    | `mobileMode`                                            |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| `mlv-select`, `mlv-combobox`                                 | `'auto'` by default, forwarded to the popup as an input |
| `mlv-day-picker`, `mlv-date-range-picker`, `mlv-time-picker` | `mobileMode="auto"` in their own templates              |
| `mlv-filter`                                                 | `mobileMode="off"` — never full-screen, unaffected      |
| `mlv-menu`                                                   | never sets it; latches `false` every open               |

Two of them read `isFullscreen()` directly and are the reason it is public:

- **`mlv-date-range-picker`** disables its own inner focus trap with `[cdkTrapFocus]="!rangePopup.isFullscreen()"` so two traps never nest inside the sheet. The popup's own trap is `[cdkTrapFocus]="modal() || isFullscreen()"`, so under the old behaviour a mid-open flip handed the trap from one element to the other while the pane kept its modal scrim. The assignment now holds for the whole open.
- **`mlv-combobox`** mirrors it into `_isFullscreen()`, which decides whether the outer trigger input or the in-sheet search input owns `role="combobox"`, drives the focus hand-off on open, and gates the reset/resync/restore on close. Because the value is now stable for the duration of an open, the panel body cannot be re-created under the user mid-interaction.

---

## Not changed

- Every `MlvPopup` input, output and public member, including `mobileMode`, `mobileBreakpoint`, `mobileTitle`, `mobileCloseLabel` and `isFullscreen`'s type. The two inputs are still read at each open; they simply no longer take effect on an open that is already running.
- `MlvPopupService.open`'s `MlvPopupOpenConfig.fullscreen` field and everything it selects. The flag's meaning and effects are untouched — only where the boolean comes from changed.
- All full-screen chrome: `.mlv-popup--fullscreen`, `.mlv-popup__header` / `__header-row` / `__title` / `__close` / `__header-content`, the `[mlvPopupHeaderContent]` / `[mlvPopupHeaderActions]` / `[mlvPopupPinnedContent]` slots, the slide-up animation and its reduced-motion fallback.
- The `MLV_POPUP_I18N` `close` string and `mobileCloseLabel`'s fallback chain.
- Breakpoint changes **between** opens. They were always picked up correctly, and still are.

## Known limits

The latch is a single tri-state per `MlvPopup`, not a refcount: it assumes **one attached overlay per popup instance**. Two owners over one `<mlv-popup>` — a `mlv-popup-container` plus a standalone `[mlvPopupTrigger]` bound to the same template reference — would already render two panels, and the first `onClose` would clear the latch while the second overlay is still attached. That configuration was never supported; it is called out here so the assumption is on the record rather than implicit.
