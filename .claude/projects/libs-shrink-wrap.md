# @malva-ui/cdk/shrink-wrap

> **Keep this file up to date.** Whenever the directive/component API, behavior, or styling changes, update this file.

> ⚠️ **EXPERIMENTAL — no adoptions.** This is a spec-only reference
> implementation and is stable under headless `getComputedStyle` polling (15
> forced-recalc samples over ~14s, idle and post-resize, on both `/chat` and
> `/showcases/support-inbox` — zero drift observed). It nonetheless caused a
> **continuous-relayout jitter and a renderer hang** on the chat surface in a
> genuinely foregrounded Chromium tab (interaction tools timed out repeatedly;
> console showed an `ErrorEvent` notification-loop error) — a failure mode the
> headless/hidden-tab sampling above did not and structurally could not catch
> (scroll-driven-animation recomputation is tied to the compositor pipeline,
> which is paused/throttled on a hidden page; `getComputedStyle` forces a
> style/layout recalc but apparently not the same feedback path that broke in
> the foreground). `@malva-ui/core/chat`'s `mlv-chat-message` adoption was
> reverted (see the `revert(chat)` commit dropping shrink-wrap adoption
> pending stability investigation) back to its pre-adoption `text-wrap:
pretty` sizing. Suspect interaction: many bubbles × per-bubble
> `timeline-scope`/`animation-timeline`
> pairs compounding in a real render loop. **Do not adopt this primitive on any
> other component until that interaction is understood and fixed** — treat it
> as a spec-only reference implementation for now, not a production-ready
> primitive.

**Path:** `libs/cdk/shrink-wrap`
**Import path:** `@malva-ui/cdk/shrink-wrap` (also re-exported from `@malva-ui/cdk`)
**Nx project:** `cdk-shrink-wrap` — `lint` + `test` targets

Pure-CSS primitive that hugs a box's inline size to the widest actually-rendered
line of its (`text-wrap: balance`d) content. `text-wrap: balance` alone only
chooses which words land on which line — it runs _inside_ a box whose width was
already resolved by ordinary shrink-to-fit, so a shorter balanced wrap leaves a
dead gap on the trailing side. This primitive closes that gap with **CSS scroll-driven
animations** (`@property`, `timeline-scope`, `view-timeline`, `animation-timeline`)
— no `ResizeObserver`, no `MutationObserver`, no JavaScript layout measurement
of any kind.

---

## Public API

| Export                 | Kind      | Selector          | Description                                                                     |
| ---------------------- | --------- | ----------------- | ------------------------------------------------------------------------------- |
| `MlvShrinkWrap`        | Directive | `[mlvShrinkWrap]` | Goes on the **outer box** being shrunk; writes the `max-inline-size` correction |
| `MlvShrinkWrapContent` | Component | `mlv-shrink-wrap` | Goes **inside** it, wrapping the text content being measured                    |

The two are always used **as a pair** — the directive alone has nothing to
measure, and the component alone has nothing to shrink.

---

## `MlvShrinkWrap`

**File:** `libs/cdk/shrink-wrap/src/lib/shrink-wrap.ts`
**Selector:** `[mlvShrinkWrap]`

### Inputs

| Input           | Type     | Default | Description                                                                                                                                                         |
| --------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mlvShrinkWrap` | `string` | `''`    | Upper bound the correction is subtracted from — a plain CSS length/percentage (e.g. `'20rem'`). Empty defaults to `'100%'`, matching ordinary shrink-to-fit sizing. |

### Host contract

- Writes the **static** attribute `mlvShrinkWrap=""` unconditionally (independent of whether the input is bound) — this is what the plain CSS attribute selector `[mlvShrinkWrap]` in `shrink-wrap.scss` matches. Angular does not otherwise reflect an attribute-selector directive's own selector onto the DOM.
- Writes `[style.max-inline-size]` to `calc(${mlvShrinkWrap() || "100%"} + var(--mlv-shrink-wrap, 0px))` — an inline style, so it beats the `max-width`/`max-inline-size` of any class-based stylesheet rule regardless of specificity.

---

## `MlvShrinkWrapContent`

**File:** `libs/cdk/shrink-wrap/src/lib/shrink-wrap.ts`
**Selector:** `mlv-shrink-wrap`
**Template:** `<span><ng-content /></span>` · `ViewEncapsulation.None` · OnPush

Holds no TypeScript logic — pure CSS drives the whole effect. It exists only so
the `::before` marker and the `view-timeline`-carrying `<span>` land in the DOM
at the right relative position (something a CSS-only mechanism cannot inject
into a consumer's own template on its own).

---

## Usage

```html
<p [mlvShrinkWrap] class="bubble">
  <mlv-shrink-wrap>
    <span>{{ message }}</span>
  </mlv-shrink-wrap>
</p>
```

```ts
import { MlvShrinkWrap, MlvShrinkWrapContent } from '@malva-ui/cdk/shrink-wrap';

@Component({
  imports: [MlvShrinkWrap, MlvShrinkWrapContent],
  // ...
})
```

### Via `hostDirectives` (applying `[mlvShrinkWrap]` to a component's own host)

A component whose own host element is the box to shrink (rather than a plain
template element) applies the directive through `hostDirectives` instead of
template markup — this is how `@malva-ui/core/chat`'s `mlv-chat-message` bubble
adopts it (see **Consumers** below):

```ts
@Component({
  selector: 'mlv-my-bubble',
  hostDirectives: [MlvShrinkWrap],
  // ...
})
export class MlvMyBubble {}
```

```html
<!-- inside mlv-my-bubble's own template -->
<mlv-shrink-wrap>
  <span class="mlv-my-bubble__text">{{ text() }}</span>
</mlv-shrink-wrap>
```

---

## Mechanism

`<mlv-shrink-wrap>` renders `overflow: hidden` plus a zero-footprint `::before`
marker and a wrapping `<span>` around its content, each carrying its own named
`view-timeline` (`inline` axis): `--mlv-shrink-wrap-host` on the marker,
`--mlv-shrink-wrap-item` on the content span. Two `@property`-registered custom
numbers (`inherits: true`, `initial-value: 0`) are driven from `0` to `1` by
`animation-timeline`-linked keyframes (`animation-range: entry 100% exit
100%`), so their live values encode how far each element's view has entered the
host's own scrollport — i.e. the ratio between the box's natural width and the
content's actual rendered width.

`[mlvShrinkWrap]`, applied to an ancestor box, declares `timeline-scope:
--mlv-shrink-wrap-host, --mlv-shrink-wrap-item` so its own `animation-timeline`
can reference those descendant-declared named timelines, and combines the two
live ratios into `--mlv-shrink-wrap` — a `calc()` that resolves to a negative
(or zero) length:

```css
--mlv-shrink-wrap: calc(-1px / (1 - var(--mlv-shrink-wrap-host)) * var(--mlv-shrink-wrap-item));
```

`[style.max-inline-size]` on `MlvShrinkWrap` adds that correction to the
directive's own max-width input (default `100%`), shrinking the box exactly as
far as the widest balanced line allows — never further, never less.

### Measurement epsilon

The `::before` marker's `padding-inline-start: 1px; margin-inline-end: -1px;`
pair is not spacing — it is the smallest possible probe width the
scroll-driven-animation trick can use to produce a measurable view-timeline
range without perturbing layout (the padding and margin cancel exactly, so the
marker occupies zero rendered space). It stays a raw `1px`/`-1px` length rather
than a `--mlv-spacing-*` token reference for that reason.

### Graceful degradation

Every piece here — `@property`, `timeline-scope`, `view-timeline`, and
scroll-driven `animation-timeline` — is currently Chromium-only. In an engine
that does not support them, the custom properties never leave their
unset/initial state, `var(--mlv-shrink-wrap, 0px)` falls back to `0px`, and the
box simply renders at its ordinary balanced-but-gapped width — the exact
pre-`mlvShrinkWrap` rendering, not a broken one. No `@supports` guard is
needed or used.

### Reduced motion

The `mlv-shrink-wrap-host`/`mlv-shrink-wrap-item` keyframes and the
`[mlvShrinkWrap]` animation-timeline wiring are **not** gated behind
`@media (prefers-reduced-motion: reduce)`, unlike every other animated block in
this codebase (see `.claude/rules/bem-scss.md` and
`libs/styles/src/lib/mixins.scss`'s `reduced-motion($block)` mixin). This is
deliberate: the animation drives no perceived motion — no transform, no
opacity, no visible transition — it only recomputes a static layout offset
once content settles. Disabling it under reduced motion would not remove any
motion; it would silently break the width correction and return every
shrink-wrapped box to the wider "balanced-with-gap" rendering. `shrink-wrap.scss`
carries a comment explaining this in place of a `reduced-motion` media block.

---

## Testing

The mechanism is pure CSS scroll-driven animations, which jsdom does not
implement (no `@property` registration, no animation timeline execution), so
`shrink-wrap.spec.ts` cannot observe the actual width correction taking
effect. It instead asserts:

- The compiled SCSS source contains every mechanism piece verbatim: both
  `@property` registrations, the keyframes, the `timeline-scope`/
  `animation-timeline`/`animation-range` wiring, the exact `calc()` formula,
  and `text-wrap: balance` + the view-timeline declarations on
  `.mlv-shrink-wrap`.
- `MlvShrinkWrap`'s host contract via `TestBed`: the static `mlvShrinkWrap`
  attribute is always present, and `style.max-inline-size` resolves to
  `calc(100% + var(--mlv-shrink-wrap, 0px))` by default or substitutes an
  explicit `mlvShrinkWrap` input into the calc base.
- `MlvShrinkWrapContent` renders `<span>` around projected content under the
  `mlv-shrink-wrap` host class.

Real cross-engine behaviour (multi-line bubbles hugging their balanced text in
Chromium, unsupported engines falling back gracefully) is verified visually,
not in this jsdom suite.

- `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run cdk-shrink-wrap:test`
- `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run cdk-shrink-wrap:lint`

---

## Consumers

**None currently.** `@malva-ui/core/chat`'s `mlv-chat-message` bubble adopted
`[mlvShrinkWrap]`/`<mlv-shrink-wrap>` briefly (via `hostDirectives`, wrapping
its `__text` span in the non-quote path) but the adoption was reverted after
it caused a foreground renderer hang — see the EXPERIMENTAL warning at the top
of this file. The bubble is back to its pre-adoption `text-wrap: pretty`
sizing (no width-hugging past the ordinary shrink-to-fit + `pretty` wrap
described in `libs-chat.md`).

---

## Dependencies

| Package         | Version   |
| --------------- | --------- |
| `@angular/core` | `^22.0.0` |
