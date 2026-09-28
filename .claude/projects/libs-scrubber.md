# Library: scrubber

> **Keep this file up to date.** Update this file whenever you change any component, directive, public API, template, styling, or dependency wiring in this library.

## Overview

`@malva-ui/core/scrubber` provides `mlv-scrubber` — a **one-dimensional
scroll-snap selector**, the "drum roll" primitive. It renders a scrolling strip
of items behind a centre stripe and a pair of fade masks; whatever sits on the
stripe is the selected value.

Extracted from `mlv-time-picker`'s private drum column (#129), which was a
general control wearing time-picker clothes. Generalised on three axes:

| Was                                    | Is                                                                   |
| -------------------------------------- | -------------------------------------------------------------------- |
| vertical only (four hardcoded places)  | `orientation` — `'vertical'` (block axis) or `'horizontal'` (inline) |
| `items: number[]`, zero-padded 2-digit | generic `T` + a `displayWith` format hook                            |
| never mirrored (block axis never does) | horizontal mirrors under `dir="rtl"`, scoped or global               |
| `--mlv-tp-*`                           | `--mlv-scrubber-*`                                                   |

- **Leaf project (Nx):** `core-scrubber` at `libs/core/scrubber`
- **Secondary entry point:** `@malva-ui/core/scrubber` (also re-exported from the grouped `@malva-ui/core` barrel)
- **Package tags:** `scope:ui`, `family:core`, `type:ui`

Consumers today: `mlv-time-picker` (hours / minutes / seconds, vertical) and
`mlv-calendar-sheet` (the year strip, **horizontal** — #130 is the first
horizontal consumer, and the first to override `--mlv-scrubber-item-size` on the
inline axis).

## Public API

Exported from `libs/core/scrubber/src/index.ts`:

| Symbol                   | Kind      | Selector       | Description                  |
| ------------------------ | --------- | -------------- | ---------------------------- |
| `MlvScrubber<T>`         | Component | `mlv-scrubber` | The scroll-snap strip.       |
| `MlvScrubberOrientation` | Type      | —              | `'vertical' \| 'horizontal'` |

## Component

### `MlvScrubber<T>` — `mlv-scrubber`

- **Change detection:** `OnPush` · **Encapsulation:** `None`
- **Files:** `libs/core/scrubber/src/lib/scrubber/scrubber.{ts,html,scss}`

#### Inputs

| Name            | Type                          | Default            | Description                                                                                                                                                                                   |
| --------------- | ----------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`         | `string` (**required**)       | —                  | Accessible name of the listbox (`aria-label`), e.g. `"Hours"`, `"Year"`.                                                                                                                      |
| `items`         | `readonly T[]` (**required**) | —                  | The values, in scroll order. Must be **distinct** — they are both the `@for` track key and aria's option identity.                                                                            |
| `selectedValue` | `T \| null` (**required**)    | —                  | The value on the centre stripe. Compared with `indexOf` (reference / `===` equality). `null` = **no selection** (#348) — see _No selection_; `null` is therefore not usable as an item value. |
| `orientation`   | `MlvScrubberOrientation`      | `'vertical'`       | The scroll axis. `'horizontal'` is on the **inline** axis and mirrors in RTL.                                                                                                                 |
| `displayWith`   | `(item: T) => string`         | `(v) => String(v)` | Formats an item for the visible text **and** for aria's type-ahead (`ngOption`'s `label`). The zero-padded two-digit numeral is the time picker's own format, passed in here.                 |
| `disabled`      | `boolean` (coerced)           | `false`            | Blocks aria keydown/click and the scroll→value sync, and forces `tabindex="-1"` on the listbox.                                                                                               |

#### Outputs

| Name          | Type | Description                                                     |
| ------------- | ---- | --------------------------------------------------------------- |
| `valueChange` | `T`  | Emitted when the user selects a value via scroll, click or key. |

#### Methods

| Member        | Description                                                                               |
| ------------- | ----------------------------------------------------------------------------------------- |
| `focusList()` | Focuses the strip's `<ul>` listbox. For a parent that moves focus between several strips. |

#### Properties

| Member        | Type                  | Description                                                                                                                                                                |
| ------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listElement` | `HTMLElement \| null` | Getter — the `<ul>` listbox element, or `null` before view init. Lets a parent identify which strip holds focus (`=== document.activeElement`) without a class-name query. |

#### Host bindings

```ts
host: {
  class: 'mlv-scrubber',
  '[class]': '"mlv-scrubber--" + orientation()',
}
```

## `@angular/aria` backing

The `<ul>` is a headless **`ngListbox`** and each `<li>` an **`ngOption`**
(`@angular/aria/listbox`), applied in the template (not as `hostDirectives`) so
their inputs bind freely. aria owns the roles (`listbox`/`option`),
`aria-selected`, `aria-activedescendant`, roving tabindex, keyboard navigation
and selection. Pinned configuration:

| aria input      | Value              | Why                                                                                                                                                                                                   |
| --------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `focusMode`     | `activedescendant` | Focus stays on the `<ul>`, so a parent's inter-strip navigation and `focusList()` keep working. aria moves neither DOM focus nor scroll in this mode, so it cannot fight scroll-snap.                 |
| `selectionMode` | `_selectionMode()` | `follow` — drum-roll semantic = "centred is selected" → an arrow key moves **and** selects. `explicit` only while `selectedValue` is `null` and the strip has never had focus (#348, _No selection_). |
| `orientation`   | `orientation()`    | Decides aria's arrow pair (and emits `aria-orientation`).                                                                                                                                             |
| `wrap`          | `true`             | Navigation wraps from last to first.                                                                                                                                                                  |
| `disabled`      | `disabled()`       | A disabled strip blocks aria keydown/click.                                                                                                                                                           |
| `tabindex`      | `-1` when disabled | A disabled listbox leaves the tab order (aria would keep it focusable at `0`).                                                                                                                        |

**Value bridging:** the public scalar `selectedValue` / `valueChange` are
preserved. Internally `[value]="_ariaValue()"` (`[selectedValue()]`, or `[]` for `null`) bridges the scalar into
aria's array (`V[]`) single-select model, and `(valueChange)` collapses
`V[]` → scalar (guarding no-op echoes).

**Active-item sync (the scroll-snap coexistence gotcha):** aria's
`setDefaultState` auto-activates the selected option only until first
interaction — but a consumer's open handler focusing the list (`focusin`)
defeats it. So the strip seeds aria's active item via `Listbox.gotoIndex()` in
`ngAfterViewInit` (options are registered synchronously by `ngOption.ngOnInit`),
re-syncs it from the scroll handler, and re-syncs from the `selectedValue`
effect on external writes. Without the seed the first Arrow key navigates from a
stale / `undefined` active item.

**Option ids** are `mlv-scrubber-<instance>-<index>`, from a module-level
counter — the value cannot serve as an id once `T` is generic. Before #129 the
ids were `tp-col-item-<labelKey>-<value>` and got cross-column uniqueness from
the label key for free; the counter has to supply it now, and nothing else will:
aria validates duplicate option ids **within** one listbox only, so three
sibling strips colliding is invisible to it and would leave every
`aria-activedescendant` resolving into the first strip. Pinned by
`scrubber-a11y.spec.ts`, which renders three strips and checks both the ids and
where each `aria-activedescendant` resolves.

#### Keyboard (owned by aria)

- Vertical: ArrowUp / ArrowDown navigate + select (wrapping).
- Horizontal: ArrowLeft / ArrowRight, **mirrored in RTL**.
- Home / End: first / last. Arrows, Home and End select as they move (`follow`); Enter / Space are **not bound** in `follow` mode — `@angular/aria` binds them only when selection does not follow focus. (This line said "Enter / Space: select the active item" before #348, which was never true in `follow`.)
- With no selection and no focus yet, arrows only move the active item (`explicit` mode; see _No selection_).
- Type-ahead: matches `displayWith`'s output, case-insensitively, by prefix.

### No selection (2026-09, #348)

`selectedValue` widened `T` → `T | null` (row 115) so `mlv-time-picker` can render an empty value as empty drums.

- **Rendering:** `_ariaValue` is `[]` → no option `aria-selected`, no `__item--selected`. aria still has an active descendant (the first item, seeded in `ngAfterViewInit` from index `-1` → `0`), so Arrow / Home / type-ahead have somewhere to start.
- **No self-selection:** aria's `setDefaultStateEffect` (an `afterRenderEffect` running until the listbox's first `focusin`) calls `select()` on the first item of a `follow` listbox with nothing selected — the strip would emit a value nobody chose. So `_selectionMode` is `'explicit'` while `selectedValue` is `null` **and** `_interacted` is false; `explicit` makes that pass only activate. `_interacted` latches on the host's first `focusin`, from a constructor `fromEvent(…, 'focusin').pipe(take(1))` — registered on the host, not the `<ul>`, and from the constructor, because a parent may focus the list mid-render (the time picker's open handler does).
- **Keys in `explicit`:** arrows move without selecting; Enter / Space and a click select. Focus flips the strip to `follow` before any key arrives in real use (a key needs focus), so a keyboard user gets the drum-roll semantic from the first Arrow; only a script dispatching a keydown at an unfocused strip sees the difference.
- **Known limitation:** aria's third post-render effect runs `setDefaultState()` when the active option leaves `items`, with no interaction gate. On a latched (`follow`) strip whose `selectedValue` is `null`, that pass selects the first item and `_onAriaValueChange` emits it — an emission no user caused. It takes an item-list change on a focused, empty strip (in-repo: `mlv-time-picker`'s `mode` switch while open). Not fixed (#348 review M1).
- **Activation emits:** `_onAriaValueChange` guards echoes against `selectedValue`, and `null` matches no item — so activating the resting (first) item emits it, as a choice.
- **No scroll on `null`:** the `selectedValue` sync effect returns early; the strip stays where it is, and a read-back still pending from an earlier scroll is cancelled (a flick, then a form reset inside the 150 ms debounce, would otherwise commit the landed item after the reset). Scrolling it back to the start would come back through the 150 ms read-back and select the item it lands on. A value arriving later scrolls to it as usual; a user scroll from empty emits the item it settles on.
- Specs: `scrubber-empty.spec.ts` (10) — ablating the explicit mode, the latch or the scroll guard each turns specs red there and in `time-picker-empty.spec.ts`; `_ariaValue`'s `[]` is defensive (aria prunes an unmatched `[null]` itself) and ablating it turns nothing red.

## Scroll behaviour

The scroll listener is registered outside the template on the `<ul>` — as
`fromEvent(listEl, 'scroll', { passive: true })` from `afterNextRender`, inside
`runOutsideAngular`, torn down with `takeUntilDestroyed(this._destroyRef)` (the
`DestroyRef` is passed explicitly because an `afterNextRender` callback is not
an injection context) — not as a `(scroll)` binding. A template listener runs
inside Angular's `wrapListenerIn_markDirtyAndPreventDefault` wrapper, which
marks the ancestor view chain dirty and notifies the change-detection scheduler
on **every** event; this handler only resets a debounce timer and writes nothing
reactive, so each of those passes was pure waste at momentum-scroll frequency
(20 scroll events: 0 passes, was 20).

The handler is debounced 150 ms so it does not fight CSS scroll-snap during a
large swipe. On a scroll-driven change the aria active item is re-aligned via
`gotoIndex` so a following Arrow key moves from the centred value. Programmatic
smooth scrolling is used only for keyboard / click / external-value changes.

**Reduced motion is resolved in TypeScript, not in CSS.**
`@include mixins.reduced-motion($block)` emits `scroll-behavior: auto !important`
across the block, but per CSSOM-View an explicit `behavior` passed to
`scrollTo()` **overrides** the computed `scroll-behavior` — the property is only
consulted for `behavior: 'auto'`. A hardcoded `'smooth'` therefore animates the
drum however loudly the stylesheet says otherwise, so `_scrollToIndex()` reads
`matchMedia('(prefers-reduced-motion: reduce)')` at the call site and downgrades
to `'instant'`. (The read is guarded with `typeof matchMedia === 'function'` for
SSR, the same shape `mlv-tiles` uses; `ngAfterViewInit` does run on the server.)
This was carried over verbatim from `MlvTimePickerColumn`, where the claim was
equally untrue.

## Direction (RTL)

A **vertical** strip is on the block axis and never mirrors. A **horizontal**
one is on the inline axis and must, so the two halves are split:

- **CSS is logical and mirrors on its own** — `scroll-padding-inline`,
  `padding-inline`, the stripe's `inset-inline-start`. No `[dir='rtl']` twin
  exists in the stylesheet, and `scrubber-styles.spec.ts` asserts that no
  physical inline-axis property is emitted. The fade mask's `to right` is the
  one physical keyword: the gradient is its own mirror image.
- **`scrollLeft` is physical** and converted once at the boundary. Per
  CSSOM-View an RTL scroller reports `0` at its inline-start (right) edge and
  counts **down** toward the end, so `_scrollOffset()` negates it and
  `_scrollToIndex()` negates back. Read raw, index 4 would come out as −4 and
  clamp to 0 — the strip would look stuck on the first item.
- **The direction is a dependency of the scroll-sync effect.** Mirroring moves
  the content without resizing it, so no `ResizeObserver` fires and no query
  changes; nothing else would tell the strip that its physical offset now points
  at the wrong item.

Direction comes from `MlvRtlService.elementDirection(host)`, so a `[dir]` scope
on any ancestor is honoured, not only the document's.

### Scoped `Directionality` for `Listbox`

`@angular/aria`'s `Listbox` injects the CDK `Directionality` to decide which
horizontal arrow key means _next_, and the root-provided one only ever reports
the **document** direction. A strip inside a `[dir="rtl"]` wrapper on an
otherwise-LTR page would therefore take its arrow keys from one direction and
its scroll maths from another. `MlvScrubber` provides
`provideMlvScopedDirectionality()` (`@malva-ui/cdk/utils`, `@internal`) in its
`providers`, backed by the same `elementDirection(host)` signal, so the two
agree. Nothing is projected, so `providers` and `viewProviders` reach the same
nodes here. The scrubber was the first such host and carried its own factory;
#339 moved it into the shared helper, used by five more `@angular/aria` hosts.
`.claude/rules/rtl.md` § _Sanctioned `Directionality` providers_ lists every
host, why CDK's `Dir` directive is not an alternative, and the conditions for
adding another.

**The one spec that pins it** is `mirrors the horizontal pair under a scoped
[dir="rtl"] ancestor`. The global-RTL case is _not_ evidence:
`MlvRtlService.setDirection()` also writes the root CDK `Directionality`, so it
passes with the provider removed. Ablated, exactly the scoped spec goes red
(`expected 2 to be 4`).

## Styling

Block `.mlv-scrubber`, with `.mlv-scrubber--vertical` / `--horizontal`
carrying **everything axis-dependent**, so no declaration has to be undone for
the other axis. Elements: `__track` (relative box, `overflow: hidden`, the
centre stripe as `::before`, the fade mask), `__list` (the scroller), `__item`.

### CSS custom properties

| Variable                      | Default                                                                  | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--mlv-scrubber-item-size`    | `2.25rem`                                                                | One item's extent **along the scroll axis** — height when vertical, width when horizontal.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `--mlv-scrubber-cross-size`   | `3.5rem` vertical, `var(--mlv-scrubber-item-size)` horizontal            | Extent **across** the scroll axis — the strip's width when vertical, its height when horizontal.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `--mlv-scrubber-visible-rows` | `5`                                                                      | Strip depth, including the selected item. Must be **odd** so exactly one item sits on the centre stripe. Consumed only as a `var()` fallback on `.mlv-scrubber`, never declared there — a declaration would shadow an ancestor's override for the whole subtree.                                                                                                                                                                                                                                           |
| `--mlv-scrubber-side-rows`    | `calc((var(--mlv-scrubber-visible-rows, 5) - 1) / 2)`                    | Derived, not set directly — set `--mlv-scrubber-visible-rows` instead. Drives the centre stripe's offset, the scroll-snap port and the list padding, so all three follow the row count. It **is** declared on `.mlv-scrubber`, so an ancestor override is shadowed; a consumer that must pin it needs a rule on the strip itself with higher specificity (this is what `mlv-time-picker`'s `.mlv-time-picker__panel mlv-scrubber` alias layer does, to keep the published `--mlv-tp-side-rows` name live). |
| `--mlv-scrubber-track-size`   | `calc(var(--mlv-scrubber-item-size) * var(--mlv-scrubber-visible-rows))` | The viewport extent along the scroll axis. **Re-declare it wherever `--mlv-scrubber-item-size` is overridden:** a custom property's `var()`s are substituted on the declaring element, so an inherited value keeps the ancestor's item size.                                                                                                                                                                                                                                                               |
| `--mlv-scrubber-font-size`    | `var(--mlv-font-size-m)`                                                 | Item label size. Read by the block, `__list` and `__item` as `var(--mlv-scrubber-font-size, var(--mlv-font-size-m))` — re-stating the raw `m` token through `mixins.base` shadows it for every descendant, so a consumer's density ramp reaches nothing.                                                                                                                                                                                                                                                   |

Depth is a **single knob**: the track extent, the stripe offset, the snap port
and the list padding are each a multiple of `--mlv-scrubber-item-size` and one
of the two row counts, so setting `--mlv-scrubber-visible-rows` alone moves all
four together.

## Testing

| File                      | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scrubber.spec.ts`        | The scroll listener's wiring: native events at the `<ul>`, disabled, teardown, zero change-detection passes for a burst, passive registration.                                                                                                                                                                                                                                                                                           |
| `scrubber-api.spec.ts`    | Item type and `displayWith` (including through aria's type-ahead), and the orientation → `aria-orientation` + modifier class.                                                                                                                                                                                                                                                                                                            |
| `scrubber-rtl.spec.ts`    | Horizontal `scrollLeft` maths, the RTL sign, a scoped `[dir]` ancestor, programmatic scroll, re-alignment on a live flip, and the arrow-key pair in all three direction cases.                                                                                                                                                                                                                                                           |
| `scrubber-a11y.spec.ts`   | The guarantees the primitive owns rather than borrows from the time picker: option-id uniqueness across three sibling strips (and where each `aria-activedescendant` resolves), the seeded active item under a focus-on-open, the reduced-motion downgrade, and axe sweeps — selected, disabled, horizontal, three strips (no selection is swept in `scrubber-empty.spec.ts`). `core-scrubber` left `ROLLOUT_PENDING` with these (#348). |
| `scrubber-empty.spec.ts`  | `null` `selectedValue` (#348): nothing selected and nothing emitted on render, an active descendant to start from, Home / click / user scroll emitting, a later value scrolling in, removing the selection clearing it without a programmatic scroll, a scroll read-back pending at that moment dropped, axe.                                                                                                                            |
| `scrubber-styles.spec.ts` | The geometry, against the **compiled stylesheet** — jsdom implements no layout, so `getComputedStyle` would read nothing. Wrapped in `stripCssLayersFromText()` from `@malva-ui/internal-testing`.                                                                                                                                                                                                                                       |

## Dependencies

### Internal

- `@malva-ui/cdk/utils` — `clamp`, `MlvRtlService`, `provideMlvScopedDirectionality`

### Angular

- `@angular/aria/listbox` — `Listbox`, `Option`
- `@angular/cdk/coercion` — `coerceBooleanProperty`
- `rxjs` — `fromEvent`

### Styles

- `libs/styles/src/lib/mixins` — `base`, `reduced-motion`
