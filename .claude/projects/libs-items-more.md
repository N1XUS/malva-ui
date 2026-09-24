# Library: items-more

> **Keep this file up to date.** Update this file whenever you change any component, directive, public API, template, styling, or dependency wiring in this library.

## Overview

`@malva-ui/core/items-more` provides `mlv-items-more` — a single-line row that
**withholds the items that do not fit** and offers them behind a "show more"
control, in an overlay panel.

- Generic: any projected controls (page-header actions, toolbar buttons, filter chips).
- Declarative: each item says how it looks **in the row** and, optionally, **collapsed** — two structural templates, not one template restyled.
- Same split logic family as `mlv-tab-group`'s overflow (measured widths, cached, `ResizeObserver` on row **and** items — the #232 lesson), generalised and made exact.
- **Leaf project (Nx):** `core-items-more` at `libs/core/items-more`
- **Secondary entry point:** `@malva-ui/core/items-more` (also re-exported from the grouped `@malva-ui/core` barrel)
- **Package tags:** `scope:ui`, `family:core`, `type:ui`
- **Docs page:** `/items-more` (Layout group, icon `list-collapse`) — 4 examples: basic, pinned items, collapsed form + counting trigger, external `+N more` trigger. Each example frame is `resize: horizontal`.

```html
<mlv-items-more ariaLabel="More actions">
  <mlv-items-more-item pinned>
    <ng-template mlvItemsMoreVisible><mlv-segmented … /></ng-template>
  </mlv-items-more-item>
  <mlv-items-more-item>
    <ng-template mlvItemsMoreVisible><button mlvButton>Share</button></ng-template>
    <ng-template mlvItemsMoreHidden><button mlvButton variant="transparent">Share</button></ng-template>
  </mlv-items-more-item>

  <ng-template mlvItemsMoreTriggerDef let-count>
    <button mlvButton shape="square" mlvItemsMoreTrigger [attr.aria-label]="'More actions (' + count + ')'">
      <svg lucideEllipsis [size]="16" />
    </button>
  </ng-template>
</mlv-items-more>
```

## Public API

Exported from `libs/core/items-more/src/index.ts`:

| Symbol                       | Kind                 | Selector                   | Description                                                                                              |
| ---------------------------- | -------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `MlvItemsMore`               | Component            | `mlv-items-more`           | The row, the split, the overflow panel.                                                                  |
| `MlvItemsMoreItem`           | Component (def node) | `mlv-items-more-item`      | One entry; `display: none`, carries the two templates.                                                   |
| `MlvItemsMoreVisibleDef`     | Structural directive | `[mlvItemsMoreVisible]`    | **Required** in-row template.                                                                            |
| `MlvItemsMoreHiddenDef`      | Structural directive | `[mlvItemsMoreHidden]`     | Optional in-panel template. Absent → item is pinned.                                                     |
| `MlvItemsMoreTriggerDef`     | Structural directive | `[mlvItemsMoreTriggerDef]` | "Show more" appearance; context `$implicit` = withheld count.                                            |
| `MlvItemsMoreTrigger`        | Attribute directive  | `[mlvItemsMoreTrigger]`    | "Show more" behaviour: click, `aria-expanded`, `aria-controls`.                                          |
| `MlvItemsMoreTriggerContext` | Interface            | —                          | `{ $implicit: number }`.                                                                                 |
| `MLV_ITEMS_MORE`             | Injection token      | —                          | Nearest row, as `MlvItemsMoreAccessor`.                                                                  |
| `MlvItemsMoreAccessor`       | Interface            | —                          | What a trigger needs: `hiddenItems`, `panelOpened`, `panelId`, `openPanel`, `closePanel`, `togglePanel`. |

Internal, not exported: `MlvItemsMoreService` (registry + split), `MlvItemsMoreSlot` (per-rendered-item measuring hook), `computeHiddenFlags` / `overflow-fit.ts` (pure fit arithmetic).

## `MlvItemsMore` — `mlv-items-more`

- **Change detection:** `OnPush` · **Encapsulation:** `None`
- **Files:** `libs/core/items-more/src/lib/items-more/items-more.{ts,html,scss}`
- **Providers:** `MlvItemsMoreService` (per instance), `MLV_ITEMS_MORE` → itself

### Inputs

| Name        | Type                  | Default     | Description                                                                                  |
| ----------- | --------------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `ariaLabel` | `string \| undefined` | `undefined` | Names the panel. Set → panel is `role="group"` + `aria-label`; unset → plain `div`, no role. |

### Outputs

None.

### Public members

| Name           | Type                                  | Description                                                |
| -------------- | ------------------------------------- | ---------------------------------------------------------- |
| `visibleItems` | `Signal<readonly MlvItemsMoreItem[]>` | Items in the row, declaration order.                       |
| `hiddenItems`  | `Signal<readonly MlvItemsMoreItem[]>` | Withheld items, declaration order.                         |
| `hiddenCount`  | `Signal<number>`                      | `hiddenItems().length`; `0` while everything fits.         |
| `panelOpened`  | `Signal<boolean>`                     | Panel open state.                                          |
| `panelId`      | `string`                              | Stable panel DOM id (`mlvNextId('mlv-items-more-panel')`). |

### Methods

| Name          | Signature                                   | Description                                                            |
| ------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| `openPanel`   | `(origin: ElementRef<HTMLElement>) => void` | Opens panel anchored on `origin`; remembers `origin` for focus return. |
| `closePanel`  | `() => void`                                | Closes panel; focus returns per _Focus_ below.                         |
| `togglePanel` | `(origin: ElementRef<HTMLElement>) => void` | Open or close, whichever state calls for.                              |

### Template structure

- `__defs` (`display: none`) — projects the `<mlv-items-more-item>` def nodes. Projected, not left unprojected: unprojected content is detached, and the registry orders items with `compareDocumentPosition`.
- `mlv-popup-container` (`display: contents`) wraps `__row`.
- `__row` — `@for (visibleItems)` → `__slot[mlvItemsMoreSlot]` rendering `visibleTemplate`; then `__trigger` rendering `mlvItemsMoreTriggerDef` with `$implicit: hiddenCount()` while `hiddenCount() > 0`.
- `__probe` (`inert`, `visibility: hidden`, 0×0 clip) — off-flow trigger copy with `$implicit: 1`, rendered while a trigger def exists and nothing is withheld, so the trigger's width is known **before** the first hide.
- `mlv-popup` → `__panel` (`[id]=panelId`, `mlvAutofocus`) → `__panel-item` per `hiddenItems` rendering `hiddenTemplate`.

## `MlvItemsMoreItem` — `mlv-items-more-item`

- Def node like `<mlv-tab>`: `template: ''`, host `display: none`. Identity = component instance (width cache + split keyed by it; no `value` input).
- Registers in `ngOnInit`, unregisters in `ngOnDestroy`. Registry keeps **DOM order**, not init order.

| Member            | Kind                                | Description                                                                |
| ----------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| `pinned`          | input `boolean` (coerced), `false`  | Never withheld; width reserved first. For items that _have_ a hidden form. |
| `visibleTemplate` | `contentChild.required(VisibleDef)` | In-row template. Required — unmeasurable item would block every split.     |
| `hiddenTemplate`  | `contentChild(HiddenDef)`           | In-panel template or `undefined`.                                          |
| `collapsible`     | `Signal<boolean>`                   | `!pinned() && hiddenTemplate() !== undefined`.                             |
| `elementRef`      | `ElementRef<HTMLElement>`           | Def node; document position only, never measured.                          |

## `MlvItemsMoreTrigger` — `[mlvItemsMoreTrigger]`

- `exportAs: 'mlvItemsMoreTrigger'`, host class `mlv-items-more-trigger`.
- Input `mlvItemsMoreTrigger: MlvItemsMoreAccessor | '' | undefined` — bind the row (`[mlvItemsMoreTrigger]="actions"`) only for a trigger **outside** `<mlv-items-more>`; bare attribute (`''`) falls through to `MLV_ITEMS_MORE` DI, which covers the `mlvItemsMoreTriggerDef` template.
- Host: `(click)` → `togglePanel(host)`; `aria-expanded` only when an owner resolves (no owner → no ARIA at all, click no-op); `aria-controls` only **while open** (the overlay panel is not in the DOM before).
- **No `aria-haspopup`** — every value promises a popup role (`true` = `menu`) and its keyboard model; the panel is a disclosure of the withheld controls, not a menu.
- No keyboard synthesis: put it on a `<button>`. Non-button hosts need `[mlvClick]`'s full contract.

External trigger shape:

```html
<mlv-items-more #actions>…</mlv-items-more>
@if (actions.hiddenCount(); as count) {
<button mlvButton [mlvItemsMoreTrigger]="actions">More ({{ count }})</button>
}
```

## Split algorithm

`computeHiddenFlags({ candidates, available, gap, triggerWidth })` — pure, `overflow-fit.ts`. `MLV_FIT_EPSILON_PX = 0.5`, always on the **keeping** side.

1. All fit (`laidOut(sum, count, gap) <= available + EPS`, trigger **excluded**) → nothing hidden.
2. Budget = `available − (triggerWidth > 0 ? triggerWidth + gap : 0) + EPS`.
3. Reserve every pinned (non-collapsible) width first.
4. Walk collapsibles in order; first one that does not fit and **every later collapsible** is hidden. Hidden set is always a suffix of the collapsibles.

`available` = row `getBoundingClientRect().width` − inline padding − inline border (`getComputedStyle`); `gap` = `columnGap`. External trigger (no def) reserves `0`.

## Guarantees

| Guarantee                   | Mechanism                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No false-positive hide      | Exact arithmetic over measured widths; `_computeSplit()` returns `null` (commit nothing, render everything) when: no row, row 0×0, any item unmeasured, trigger def present but its width unmeasured. Probe supplies the trigger width before the first hide — no guessed "100px for More".                                                                    |
| No hysteresis band          | A band = widths where a fitting item stays hidden = the defect. Oscillation handled by the guard below instead.                                                                                                                                                                                                                                                |
| Oscillation guard           | Reveal records `{at, available, hiddenCount}`. Hide within `_OSCILLATION_WINDOW_MS` (100) of it → `_revealGuard {available, hiddenCount}`. While set, reveals to `≤ hiddenCount` refused until `available > guard.available + EPS`. Engages only after a reveal provably undid itself (e.g. page scrollbar feedback).                                          |
| Frame-ok resize             | Hides commit immediately in the RO callback. Reveals trailing-debounced `_REVEAL_DEBOUNCE_MS` (64), recapture + recompute when the timer fires; a hide cancels a pending reveal. `__row` is `overflow: hidden`, so a late hide clips for ≤1 frame instead of spilling into neighbours. No synchronous `detectChanges` in the RO callback (RO loop-error risk). |
| Structure change same frame | `afterRenderEffect({ read })` tracks slots, trigger, probe, trigger def and every `collapsible()`; commits within the same `ApplicationRef.tick()`, before paint.                                                                                                                                                                                              |
| Cheap                       | Widths cached per item; zero or unchanged reads skipped; entries pruned on unregister. RO targets (row, slots, in-row trigger, probe) diffed, not re-observed. Service `commit()` no-ops on an equivalent set (identity kept).                                                                                                                                 |
| SSR-safe                    | Observer built in `afterRenderEffect` via `MlvResizeObserverFactory`; nothing measures on the server. Covered by `libs/core/src/ssr-smoke.spec.ts` (navigation host).                                                                                                                                                                                          |

## Focus

- Panel opens with `mlvAutofocus` on `__panel`.
- On open→closed edge (any path: `closePanel()`, Escape, outside press) → `afterNextRender` → `_restoreFocus()`.
- Restores **only when focus was lost**: `activeElement` null, `<body>`, or inside `#panelId`. Focus the user moved elsewhere stays put.
- Target: opener if `isConnected`; else last visible slot's tabbable element (`MlvTabbableElementService.getTabbableElement(slot, true)`) — the case where the last item returned to the row and the in-row trigger vanished.
- `hiddenCount()` → `0` while open closes the panel. The popup container falls back to its own host as anchor when the registered origin left the document.
- Anchor registration (#230): `openPanel(origin)` withdraws the previous opener (`unregisterTrigger`) before `registerTrigger(origin, false)`; the open→closed edge withdraws it too. The container keeps registrations as a stack until withdrawn, and the in-row trigger is re-created every time items are withheld again — without this every one of them stays pinned. At most one registration from the row at any time. Usually none while closed, but not always: a click during the close animation runs `openPanel`, which registers, while `container.open()` returns early (the overlay handle is still set) — no open→closed edge follows, so that one registration stays until the next open replaces it.

### Focus across a split (#327)

A split that removes the focused **row** box destroys it; the browser drops focus to `<body>` (nothing announced, nothing focused, next Tab browser-dependent — WCAG 2.4.3). The row hands it on:

- **Detect** in `_commit()`, before `service.commit()`: `activeElement` inside the row **and** inside a box the next render removes — a slot whose item `hidden` holds, or the in-row trigger when `hidden` is empty. Read against rendered boxes, not the previous split.
- **Hand off** in `afterNextRender` (after the removing render), same policy as `_restoreFocus()`: **only when focus is on `<body>`/null**. A box that survived (reveal landed first) keeps it; focus placed elsewhere since stays. One queued hand-off per render; a later loss replaces the recorded one.
- **Target — item withheld →** in-row trigger's first tabbable: the control that now holds the item, at the end of the row, announcing its label (a count only where the trigger template renders one). No in-row trigger (consumer-placed or none) → nearest item still in the row: last tabbable of the closest item **before**, else first tabbable of the closest **after** (before wins: next Tab reaches what it would have from the withheld item). External trigger is unknown to the row.
- **Target — trigger left with the last item →** last item's last tabbable (the one that came back, where the trigger stood); same target as `_restoreFocus()`'s fallback.
- **Still drops to `<body>`** (follow-ups, not handled here): a reveal while the panel is open that returns the focused **panel** item — the panel stays open; no in-row trigger and nothing tabbable left in the row; a consumer-placed trigger under `@if (hiddenCount())` (docs example 4, the `MlvItemsMoreTrigger` JSDoc example) removed by a full reveal — the consumer's `@if` destroys it and the row cannot see it.
- **Consumer-visible (patch):** after a split that removed the focused box, `focus` / `focusin` now fire on the trigger or on a row item, where nothing was focused before. Modality carries over (Chrome, docs example 1): after a keyboard Tab onto the item the target matches `:focus-visible`; after a mouse click on it the target does not (no ring), and Enter on the trigger then opens the panel where it did nothing on `<body>`.
- **Rejected: pin the focused item for the split.** At a width where it cannot fit beside the trigger it overflows the clipping row — focused and invisible (2.4.11); where it can, the row reshuffles when focus moves on (Tab to the trigger withholds the item just left and returns another) — layout change caused by focus alone.

## Styling

Block `.mlv-items-more`, all rules in `@layer mlv.components`.

| Class                         | Notes                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `.mlv-items-more`             | `display: block; min-inline-size: 0; position: relative` — `min-inline-size: 0` is what lets a flex/grid parent shrink it. |
| `.mlv-items-more__defs`       | `display: none`.                                                                                                           |
| `.mlv-items-more__row`        | flex, `nowrap`, gap, `overflow: hidden`; focus-ring gutter `padding` given back by negative `margin`.                      |
| `.mlv-items-more__slot`       | `inline-flex; flex: 0 0 auto` — never shrinks (would invalidate its cached width).                                         |
| `.mlv-items-more__trigger`    | Same as slot.                                                                                                              |
| `.mlv-items-more__probe`      | Absolute 0×0 clip, `visibility: hidden`; inner `__trigger` `inline-size: max-content`.                                     |
| `.mlv-items-more__panel`      | Column, `gap: --mlv-spacing-1`, `padding: --mlv-padding-xs`.                                                               |
| `.mlv-items-more__panel-item` | Column, `align-items: stretch`.                                                                                            |
| `.mlv-items-more-trigger`     | Host class of `[mlvItemsMoreTrigger]`; no styles shipped.                                                                  |

### CSS custom properties

| Property                                 | Default           | Read by   |
| ---------------------------------------- | ----------------- | --------- |
| `--mlv-items-more-gap`                   | `--mlv-spacing-2` | `__row`   |
| `--mlv-items-more-panel-min-inline-size` | `10rem`           | `__panel` |

Gap feeds the arithmetic through computed `columnGap`, so overriding it is safe.

## Testing

`yarn nx test core-items-more` — 64 specs.

- `overflow-fit.spec.ts` (13) — pure arithmetic: epsilon, exact 256/255 boundary, trigger reserve, pinned reserve, suffix-only, purity.
- `items-more.service.spec.ts` (6) — DOM-order registry, detached append, partition order, equivalent-commit identity, unregister.
- `items-more-trigger.spec.ts` (4) — no-owner ARIA, bound input, DI fallback, axe.
- `items-more/items-more.spec.ts` (41) — stubbed `getBoundingClientRect` (row `rowWidth()`, others nearest `[data-w]`), `columnGap: 8px`, synchronous `FakeResizeObserver` with `notify()`; fit, measurement gating, resize timing, oscillation guard, focus across a split (9: resize / existing trigger / structure change → trigger, no-trigger before-wins, no-trigger after fallback, kept item, outside focus, focus moved before the render, reveal removing the focused trigger), panel/ARIA, focus return, anchor registration, external trigger, observer lifecycle, three axe sweeps (all-fit, withheld, open panel on `document.body`).
- Ablation-checked: removing the guard, box check, gap, recapture, hide immediacy, reveal debounce, focus-lost check, fallback focus or close-when-empty each fails ≥1 spec. Focus across a split: the hand-off's `<body>` check, trigger preference, before-wins, after fallback, trigger-removal detection and the `afterNextRender` deferral each turn exactly their specs red.

## Dependencies

### Internal

- `@malva-ui/core/popup` — `MlvPopup`, `MlvPopupContainer`, `MlvPopupContent`
- `@malva-ui/cdk/utils` — `MlvAutofocus`, `MlvResizeObserverFactory`, `mlvNextId`
- `@malva-ui/cdk/accessibility` — `MlvTabbableElementService`

### Angular

- `@angular/core`, `@angular/common` (`NgTemplateOutlet`), `@angular/cdk/coercion`

### Styles

- `libs/styles/src/lib/mixins`
