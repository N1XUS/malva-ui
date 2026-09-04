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

Consumers today: `mlv-time-picker` (hours / minutes / seconds, vertical).

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

| Name            | Type                          | Default            | Description                                                                                                                                                                   |
| --------------- | ----------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`         | `string` (**required**)       | —                  | Accessible name of the listbox (`aria-label`), e.g. `"Hours"`, `"Year"`.                                                                                                      |
| `items`         | `readonly T[]` (**required**) | —                  | The values, in scroll order. Must be **distinct** — they are both the `@for` track key and aria's option identity.                                                            |
| `selectedValue` | `T` (**required**)            | —                  | The value on the centre stripe. Compared with `indexOf` (reference / `===` equality).                                                                                         |
| `orientation`   | `MlvScrubberOrientation`      | `'vertical'`       | The scroll axis. `'horizontal'` is on the **inline** axis and mirrors in RTL.                                                                                                 |
| `displayWith`   | `(item: T) => string`         | `(v) => String(v)` | Formats an item for the visible text **and** for aria's type-ahead (`ngOption`'s `label`). The zero-padded two-digit numeral is the time picker's own format, passed in here. |
| `disabled`      | `boolean` (coerced)           | `false`            | Blocks aria keydown/click and the scroll→value sync, and forces `tabindex="-1"` on the listbox.                                                                               |

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

| aria input      | Value              | Why                                                                                                                                                                                   |
| --------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `focusMode`     | `activedescendant` | Focus stays on the `<ul>`, so a parent's inter-strip navigation and `focusList()` keep working. aria moves neither DOM focus nor scroll in this mode, so it cannot fight scroll-snap. |
| `selectionMode` | `follow`           | Drum-roll semantic = "centred is selected" → an arrow key moves **and** selects.                                                                                                      |
| `orientation`   | `orientation()`    | Decides aria's arrow pair (and emits `aria-orientation`).                                                                                                                             |
| `wrap`          | `true`             | Navigation wraps from last to first.                                                                                                                                                  |
| `disabled`      | `disabled()`       | A disabled strip blocks aria keydown/click.                                                                                                                                           |
| `tabindex`      | `-1` when disabled | A disabled listbox leaves the tab order (aria would keep it focusable at `0`).                                                                                                        |

**Value bridging:** the public scalar `selectedValue` / `valueChange` are
preserved. Internally `[value]="[selectedValue()]"` bridges the scalar into
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
- Home / End: first / last. Enter / Space: select the active item.
- Type-ahead: matches `displayWith`'s output, case-insensitively, by prefix.

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

### The one place the CDK `Directionality` token is touched

`@angular/aria`'s `Listbox` injects the CDK `Directionality` to decide which
horizontal arrow key means _next_, and the root-provided one only ever reports
the **document** direction. A strip inside a `[dir="rtl"]` wrapper on an
otherwise-LTR page would therefore take its arrow keys from one direction and
its scroll maths from another. `MlvScrubber` provides a scope-aware
`Directionality` on the component (`scopedDirectionality()`), backed by the same
`elementDirection(host)` signal, so the two agree. Nothing else in the subtree
injects the token. `MlvRtlService` still owns the document `dir` and the global
CDK sync — this reads from it rather than around it.
`.claude/rules/rtl.md` § _The one sanctioned `Directionality` provider_ records
the exception and the conditions for adding another.

**Why not CDK's `Dir` directive**, which already provides `Directionality` for a
`[dir]` subtree: `Dir` is `[dir]`-selected and standalone, so it exists only
where a _consumer's_ component both writes `dir` and imports it — a `dir="rtl"`
on a plain wrapper, or one set by the host page outside Angular, provides
nothing. It also reads only its own `dir` **input**, so it does not follow an
ancestor attribute changing, which is what lets the strip re-mirror on a live
flip. Summoning it by writing `dir` on the strip's own host would mean the
component knowing its direction and re-emitting it — a `direction` input, which
`.claude/rules/rtl.md` forbids. A consumer who has imported `Dir` on a wrapper
ends up with two providers that agree; the nearer one (this) wins, so the extra
is inert.

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

| File                      | Covers                                                                                                                                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scrubber.spec.ts`        | The scroll listener's wiring: native events at the `<ul>`, disabled, teardown, zero change-detection passes for a burst, passive registration.                                                                                                                  |
| `scrubber-api.spec.ts`    | Item type and `displayWith` (including through aria's type-ahead), and the orientation → `aria-orientation` + modifier class.                                                                                                                                   |
| `scrubber-rtl.spec.ts`    | Horizontal `scrollLeft` maths, the RTL sign, a scoped `[dir]` ancestor, programmatic scroll, re-alignment on a live flip, and the arrow-key pair in all three direction cases.                                                                                  |
| `scrubber-a11y.spec.ts`   | The guarantees the primitive owns rather than borrows from the time picker: option-id uniqueness across three sibling strips (and where each `aria-activedescendant` resolves), the seeded active item under a focus-on-open, and the reduced-motion downgrade. |
| `scrubber-styles.spec.ts` | The geometry, against the **compiled stylesheet** — jsdom implements no layout, so `getComputedStyle` would read nothing. Wrapped in `stripCssLayersFromText()` from `@malva-ui/internal-testing`.                                                              |

## Dependencies

### Internal

- `@malva-ui/cdk/utils` — `clamp`, `MlvRtlService`

### Angular

- `@angular/aria/listbox` — `Listbox`, `Option`
- `@angular/cdk/coercion` — `coerceBooleanProperty`
- `@angular/cdk/bidi` — `Directionality` (provided, not injected; see above)
- `rxjs` — `fromEvent`

### Styles

- `libs/styles/src/lib/mixins` — `base`, `reduced-motion`
