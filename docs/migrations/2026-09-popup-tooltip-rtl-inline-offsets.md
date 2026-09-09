# 2026-09 — `mlv-popup` / `[mlvTooltip]`: `offsetX` is logical, and mirrors in RTL

**Packages:** `@malva-ui/core/popup` (`MlvPopupService`, `MlvPopupOpenConfig`, `MlvPopup`), `@malva-ui/core/tooltip` (`MlvTooltip`), `@malva-ui/cdk/utils` (new export).
**Kind:** breaking, **behaviour only**. Nothing renamed, removed or retyped. `POPUP_POSITION_MAP` and `TOOLTIP_POSITIONS` are unchanged in value — the diff on `popup-positions.ts` is JSDoc only. Resolves #180.

---

## Why

CDK's `FlexibleConnectedPositionStrategy` mirrors `originX` / `overlayX` against the pane's direction. It does **not** mirror `offsetX`. In CDK 22.0.5, `_getOffset()` returns `position.offsetX` verbatim, and it is applied twice — `x += offsetX` while scoring a candidate in `_getOverlayFit`, and `transform: translateX(${offsetX}px)` on the pane — with no `_isRtl()` anywhere on that path.

So an entry expressing "an 8px gap between the panel and the trigger" keeps pushing the panel the same way on screen once mirroring has moved it to the trigger's other side. The gap becomes an overlap of the same size: a 2x error relative to intent.

Measured before the fix, a `right-start` popup opened from an origin under a scoped `[dir="rtl"]`:

```
LTR  top: 0px; left: 0px;  transform: translateX(8px);
RTL  top: 0px; right: 0px; transform: translateX(8px);
```

The anchor moved (`left` → `right`) and the offset did not.

`POPUP_POSITION_MAP`'s `left-*` entries carried `offsetX: -8` and its `right-*` entries `+8`; `TOOLTIP_POSITIONS` the same shape at `±6`.

---

## What changed

New in `@malva-ui/cdk/utils`:

```ts
export function mlvMirrorInlineOffsets(positions: ConnectedPosition[], direction: MlvDirection): ConnectedPosition[];
```

`MlvPopupService.open()` and `MlvTooltip._show()` pass their position list through it with **the same direction they create the pane with**, so the half CDK mirrors and the half it does not resolve against one value. `MlvPopupService` re-applies it whenever the direction changes under an open overlay, and when `setPositionOrigin` swaps the list — `updatePosition()` alone would faithfully re-apply the list the strategy still holds, mirrored for the direction the popup opened with.

`offsetY` is the block axis and is never touched, in any direction.

The helper returns its input **by reference** when mirroring changes nothing, and preserves entry identity for entries it does not touch. That is not a micro-optimisation: CDK deduplicates `positionChanges` by the _identity_ of the chosen `ConnectedPosition` (`_lastPosition` is compared with `!==`, and `withPositions` nulls it when the old entry is absent from the new list), so a gratuitous copy would report a position change on every direction flip.

---

## Why not a logical margin on the panel

The alternative — deleting `offsetX` and expressing the gap as `margin-inline-*` on the panel class — was rejected, but **not** for the reason that first suggests itself.

A margin is _not_ invisible to CDK. Measured in a real browser against the shipped pane CSS (`position: absolute; display: flex; box-sizing: border-box`), a `margin-inline-start: 8px` on the panel inflates the `.cdk-overlay-pane` rect that `_getOverlayFit` scores by exactly its own size — 200px wide becomes 208px. And `margin-inline-*` mirrors on its own, being the logical form. Both halves of the obvious objection are false, and any earlier note in this repository saying otherwise was wrong.

The real reasons:

- **The gap belongs to whichever side the _resolved_ position put the panel on.** `left-start` and `right-start` are fallback twins in a single list; one margin cannot serve both.
- **A per-position `panelClass` cannot rescue it**, because `_applyPosition` adds that class _after_ `_getOverlayFit` has already scored the un-margined rect.
- **A symmetric `margin-inline`** inflates the pane on both sides, making fit scoring pessimistic and adding a spurious gap to every `top-*` / `bottom-*` entry that wants no inline gap at all.
- On a popup panel the margin is also a transparent strip **of the pane**, which click-outside dismissal counts as inside.

---

## Who is affected

**No in-repo markup changes, but shipped chrome moves in RTL.** These surfaces carry a non-zero inline offset and therefore render differently in RTL than they did:

- **`mlv-sidebar-group`** (`position="right-start"` and `position="right"`) and **`mlv-sidebar-item`** (`position="right-start"`) — `+8`, so a 16px correction in RTL. This is the most likely thing a reader will actually notice, because it is permanent navigation chrome rather than a transient overlay.
- **`mlv-day-picker`, `mlv-date-range-picker`, `mlv-time-picker`, `mlv-color-picker-popup`** — none of these writes a position input, so `MlvPopup.resolvedPositions()` falls back to **all twelve** map entries, including the `±8` `left-*` / `right-*` ones. Their RTL geometry changes whenever a side placement wins the fallback.
- **Submenus.** `SUBMENU_POSITIONS` is `['right-start', 'left-start']` at `+8 / -8` — the worst case, because the _side_ itself flips. It reaches the fix through `MlvPopupService.open()`, and its re-anchor path re-mirrors too.

**Unaffected, worth stating so nobody goes looking:** `DROPDOWN_POSITIONS` (so `mlv-select`, `mlv-combobox`, `[mlvAutocomplete]`), `MENU_POSITIONS`, `CONTEXT_MENU_POSITIONS`, `mlv-speed-dial` and the scheduler's month popover carry **no** `offsetX` at all. Most consumers see nothing. `MlvDialogService`, `MlvDrawer` and `MlvSearchField` use global position strategies and take no `ConnectedPosition`.

### The one shape that regresses: a consumer who already worked around this

`MlvPopupOpenConfig.positions` and `MlvPopup.positions` are public, and a consumer's own list is mirrored too — deliberately, because a half-logical position (mirrored alignment, physical offset) is precisely the defect. So a consumer who noticed #180 first and compensated by hand:

```ts
// Before — a hand-rolled workaround. Now double-flips.
positions: [{ ...map['right-start'], offsetX: direction === 'rtl' ? -8 : 8 }];
```

now gets a **second** flip in RTL and lands back on the original bug. The remediation strictly simplifies their code — delete the conditional and write the LTR sign:

```ts
positions: [{ ...map['right-start'], offsetX: 8 }];
```

There is deliberately **no opt-out flag**. One would re-legalise the half-logical position this change exists to remove, and give two spellings for one thing.

For a gap that genuinely must stay on one **physical** side regardless of direction, use `margin-left` / `margin-right` on the panel — **not** `margin-inline-*`, which is the logical form and mirrors.

### Coverage limitation, stated honestly

`providePopupPositions()` and the `POPUP_POSITIONS` token have **zero in-repo callers**, and no in-repo `positions` literal carries a hand-written `offsetX`. The token-override path therefore has no in-repo test coverage against the new semantics.

---

## Not affected

`offsetY` in any list; `MlvPopupPositionName` and `MlvTooltipPlacement` values and meanings; every `--mlv-*` token; every BEM class; the arrow-side derivation, which already resolved a logical pair to a physical side after CDK's collision handling. `@malva-ui/cdk/utils` gains one additive export and changes no existing one.
