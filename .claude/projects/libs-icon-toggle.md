# Library: icon-toggle

> **Keep this file up to date.** Update this file whenever you change any component, directive, public API, template, styling, or dependency wiring in this library.

## Overview

`@malva-ui/core/icon-toggle` provides a **chromeless, glyph-only** WAI-ARIA
toggle button (`button[mlvIconToggle]`) — visual-language spec **AB-R7**. It
wraps exactly one projected Lucide `<svg>` and expresses `pressed` purely
through the glyph itself: an outlined icon at rest, a "tiny fill" on hover,
and a full `fill: currentColor` when pressed. There is **no background in any
state** — the defining constraint. An optional `tone` recolours only the
pressed glyph to a matching semantic text token (e.g. a favourite star).

Built to replace ad hoc "tinted circle behind a glyph" treatments — see the
support-inbox star (exhibit B), which adopts this component in the showcase
sweep, not here.

- **Leaf project (Nx):** `core-icon-toggle` at `libs/core/icon-toggle`
- **Secondary entry point:** `@malva-ui/core/icon-toggle` (also re-exported from the grouped `@malva-ui/core` barrel)
- **Package tag:** `scope:ui`

## Public API

Exported from `libs/core/icon-toggle/src/index.ts`:

| Symbol          | Kind      | Selector                | Description                          |
| --------------- | --------- | ----------------------- | ------------------------------------ |
| `MlvIconToggle` | Component | `button[mlvIconToggle]` | Chromeless glyph-only toggle button. |

`MlvTone` (the `tone` input's type) is not re-exported here — import it from `@malva-ui/cdk/utils`.

## Component

### `MlvIconToggle` — `button[mlvIconToggle]`

- **Change detection:** `OnPush` · **Encapsulation:** `None`
- **Template:** `<ng-content />` — the host **is** the native `<button>`;
  the consumer projects exactly one Lucide `<svg>` and nothing else. Follows
  the repo's `button[mlvButton]` attribute-selector-on-native-element pattern
  (`.claude/rules/angular-component.md` § Selectors): native `disabled`,
  `type`, and click/keyboard activation semantics all work unmodified — no
  custom keydown handling is added, so Enter/Space activate through the
  browser's native button semantics exactly like a plain `<button>`.

#### Inputs / Model

| Name       | Type                   | Default     | Description                                                                                                                                                                                                                                               |
| ---------- | ---------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pressed`  | `model<boolean>`       | `false`     | Two-way bindable pressed state, reflected as `aria-pressed`. Bind one-way (`[pressed]` + `(pressedChange)`) when a caller owns the source of truth — same convention as `mlv-button-toggle`.                                                              |
| `tone`     | `MlvTone \| undefined` | `undefined` | Recolours only the **pressed** glyph to the matching semantic text token (`info` → `--mlv-text-info`, `success` → `--mlv-text-positive`, `warning` → `--mlv-text-warning`, `danger` → `--mlv-text-negative`). Rest/hover stay neutral regardless of tone. |
| `disabled` | `boolean` (coerced)    | `false`     | Native `disabled` + `aria-disabled`.                                                                                                                                                                                                                      |

#### Host bindings

```ts
host: {
  class: 'mlv-icon-toggle',
  '[class.mlv-icon-toggle--pressed]': 'pressed()',
  '[class]': '_toneClass()',                 // "mlv-icon-toggle--tone-<tone>" or ''
  '[attr.aria-pressed]': 'pressed()',
  '[attr.disabled]': 'disabled() || null',
  '[attr.aria-disabled]': 'disabled() || null',
  '(click)': '_handleClick()',
}
```

`hostDirectives: [MlvDensityDirective]` (exposing `mlvDensity`) with
`MLV_DENSITY_ELEMENT: 'icon-toggle'` — same pattern as `MlvButton`. Emits
`mlv-icon-toggle--{tight,compact,comfortable,spacious,airy}` directly on the
host.

## Accessibility

WAI-ARIA toggle button pattern. `aria-pressed` always reflects `pressed()`
regardless of `disabled`. Every consumer must supply an accessible name —
`aria-label` on the button (the projected `<svg>` should carry
`aria-hidden="true"`), matching every other icon-only control in the library
(`.claude/rules/accessibility.md` § Icon Buttons and Ambiguous Controls).

The pointer target is held at a minimum of `1.5rem` (24px — WCAG 2.2 SC
2.5.8) via `min-inline-size`/`min-block-size` plus density-aware padding,
**never** by inflating the glyph — "chromeless does not mean
tap-target-less" (AB-R7). Focus ring is Form A (SF-R3): `outline:
var(--mlv-stroke-width-medium) solid var(--mlv-border-focus)` with
`outline-offset: var(--mlv-focus-ring-offset)` on `:focus-visible`.

## Styling

- BEM block `.mlv-icon-toggle`. **No background in any state** — this is the
  component's defining constraint; a design that needs a filled/tinted
  toggle affordance should reach for `mlv-button-toggle` instead.
- **Fill-state mechanism** (Lucide ships no separate filled icon set, so
  "pressed" is a CSS `fill` on the _same_ outlined glyph — correct only for
  icons with an enclosed shape such as a star, heart, bookmark, or pin, not
  for open-stroke glyphs):
  - rest: `color: var(--mlv-text-secondary)`; `svg { fill: transparent; }`
  - hover (not pressed): `color: var(--mlv-text-primary)`; `svg { fill: color-mix(in srgb, currentColor 15%, transparent); }`
  - pressed: `color: var(--mlv-text-primary)`; `svg { fill: currentColor; }`
  - pressed + `tone`: `color` overridden to the matching semantic text token; fill stays `currentColor`, so the glyph itself carries the tone
  - the hover rule is scoped `:not(.mlv-icon-toggle--pressed):hover` so it can never fight the tone-pressed color rule for the same element
  - focus-visible: Form A (SF-R3)
  - disabled: native `:disabled` — `opacity: var(--mlv-disabled-opacity)`, `cursor: not-allowed`, `pointer-events: none` (no dedicated `--disabled` class needed; the host is always a real `<button>`). The one control allowed a disabled opacity: chromeless, no surface to declare, pressed state is a `fill` of the consumer's tone — listed on `OPACITY_ALLOWED` in `scripts/check-disabled-surface.mjs` (#366)
- **Sizing** — `min-inline-size`/`min-block-size: 1.5rem` unconditionally
  (WCAG 2.5.8 floor), plus density-aware `padding` from `--mlv-spacing-*`:
  tight `-1` (4px), compact `-1-5` (6px), comfortable `-2` (8px, default),
  spacious `-2-5` (10px), airy `-3` (12px). The projected `<svg>`'s own size
  is entirely author-controlled via its `[size]` attribute — the component
  never resizes it.
- **Motion** — `fill` transitions at `var(--mlv-duration-fast)` `var(--mlv-ease-default)`; `@include mixins.reduced-motion($block);` collapses it to `var(--mlv-duration-instant)` under `prefers-reduced-motion: reduce` (MO-R1/MO-R4).

## Usage

```html
<!-- Neutral toggle, no tone -->
<button mlvIconToggle type="button" [(pressed)]="bookmarked" aria-label="Bookmark">
  <svg lucideBookmark [size]="16" aria-hidden="true" />
</button>

<!-- `tone` recolours only the pressed glyph — the exhibit-B star pattern -->
<button mlvIconToggle type="button" tone="warning" [pressed]="ticket.starred" aria-label="Star conversation" (pressedChange)="toggleStar()">
  <svg lucideStar [size]="16" aria-hidden="true" />
</button>

<!-- Disabled -->
<button mlvIconToggle type="button" disabled [pressed]="true" aria-label="Star (disabled)">
  <svg lucideStar [size]="16" aria-hidden="true" />
</button>
```

```ts
import { MlvIconToggle } from '@malva-ui/core/icon-toggle';

@Component({
  imports: [MlvIconToggle],
})
```

## Dependencies

- `@angular/cdk/coercion` — `BooleanInput`, `coerceBooleanProperty`
- `@malva-ui/cdk/density` — `MlvDensityDirective`, `MLV_DENSITY_ELEMENT`
- `@malva-ui/cdk/utils` — `MlvTone` (type-only import)
- Malva UI CSS design tokens (`--mlv-*`)

## Tests

`icon-toggle.spec.ts`: creation; default unpressed state (`aria-pressed`,
no pressed class); click toggles `pressed`/`aria-pressed`/the pressed class;
a documented native-`<button>`-semantics test proving no custom keydown
handling intercepts activation (real Enter/Space coverage lives in Playwright
e2e, following the `libs/core/button/e2e` precedent); disabled gates the
toggle and reflects native `disabled` + `aria-disabled`; tone modifier class
reflection across all four `MlvTone` values, independent of pressed state;
disabled+pressed+tone renders together (the host keeps `--pressed` and
`--tone-*` alongside `disabled`/`aria-disabled`, so a disabled toggle still
shows its dimmed pressed styling rather than losing state); two-way
`[(pressed)]` binding through a host component (writes back on click,
reflects an externally-set value); and a Sass-compiled fill-state assertion
(rest `transparent`, hover-not-pressed `color-mix(...)`, pressed
`currentColor`, and that no rule ever declares a `background`/`background-color`
other than `transparent`) — the same source-text-assertion technique
`button.spec.ts` / `button-toggle.spec.ts` use for cascade-sensitive CSS that
jsdom cannot resolve.
