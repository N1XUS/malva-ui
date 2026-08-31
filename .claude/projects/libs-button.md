---
# Library: button

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Button library (`@malva-ui/core/button`) provides accessible button primitives: styled native buttons, close buttons, connected button groups, split-button layouts, and two-state toggle buttons. Groups, split buttons, and toggles can provide a shared visual variant so consumers do not have to repeat it on every child button.

> **Sizing is density-driven — there is no `size` input.** Button height/padding/font-size come from the `@malva-ui/cdk/density` system (`mlvDensity` host directive → `density-tight | density-compact | density-comfortable | density-spacious | density-airy`). A vestigial `size`/`ButtonSize` input existed but was never wired to any class or style (it silently did nothing) and was **removed**. Use `mlvDensity` to size a button (e.g. `<button mlvButton mlvDensity="compact">`), or set density on an ancestor.

## Public API

Exported from `libs/core/button/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvButton` | Component | Main button with disabled and loading states — selector `button[mlvButton], a[mlvButton]` |
| `MlvButtonClose` | Component | X-icon close action with transparent/circle defaults and standard density support — selector `mlv-button-close` |
| `MlvButtonGroup` | Component | Connected set of related buttons — selector `mlv-button-group` |
| `MlvButtonSplit` | Component | Joined primary action and related trigger — selector `mlv-button-split` |
| `MlvButtonToggle` | Component | Two-state button with `aria-pressed` and two-way `pressed` state — selector `mlv-button-toggle` |
| `MlvButtonVariant` | Type | `'primary' \| 'secondary' \| 'outlined' \| 'accent' \| 'transparent' \| 'elevated' \| 'error' \| 'warning' \| 'info'` |
| `MlvButtonShape` | Type | `'default' \| 'circle' \| 'square' \| 'pill'` |
| `MlvButtonVariantAccessor` | Interface | Contract used by button containers to provide an inherited variant |
| `MLV_BUTTON_VARIANT` | Injection token | Optional ancestor-provided button variant context |
| `MlvButtonBefore` | Directive | Template slot rendered before button text |
| `MlvButtonAfter` | Directive | Template slot rendered after button text |
| `MlvButtonIcon` | Directive | Marks a projected icon (`[mlvButtonIcon]` → `.mlv-button__icon`); optional since icon-only buttons are also inferred |

---

## Components

### `MlvButton`

**File:** `libs/core/button/src/lib/button/button.ts`

- **Selector:** `button[mlvButton], a[mlvButton]` — applies to native `<button>` and `<a>` elements
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Template:** `libs/core/button/src/lib/button/button.html`
- **Styles:** `libs/core/button/src/lib/button/button.scss`
- **Imports:** `NgTemplateOutlet`

#### Inputs

| Name       | Type                            | Default     | Description                                                                                                                                              |
| ---------- | ------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variant`  | `MlvButtonVariant \| undefined` | `undefined` | Local variant; inherits from a button container, then falls back to `secondary` for the icon-only `square`/`circle` shapes and `primary` for the rest    |
| `shape`    | `MlvButtonShape`                | `'default'` | Shape variant; `pill` keeps content width with a fully rounded stadium radius (`--mlv-radius-full`), matching the pill action bar and pill form controls |
| `disabled` | `BooleanInput`                  | `false`     | Disables the button; coerced to boolean                                                                                                                  |
| `loading`  | `BooleanInput`                  | `false`     | Shows a spinner, exposes busy state, and prevents duplicate activation                                                                                   |
| `selected` | `BooleanInput`                  | `false`     | Paints the pressed surface with no ARIA of its own — for a menu button reflecting an active state (see **Pressed state** below)                          |

#### Content Children (protected)

| Name        | Directive         | Description                              |
| ----------- | ----------------- | ---------------------------------------- |
| `beforeRef` | `MlvButtonBefore` | Template rendered before the button text |
| `afterRef`  | `MlvButtonAfter`  | Template rendered after the button text  |

#### Host Bindings

```ts
host: {
  'class': 'mlv-button',
  '[class]': '"mlv-button--variant-" + effectiveVariant() + " mlv-button--shape-" + shape()',
  '[class.mlv-button--disabled]': 'disabled()',
  '[class.mlv-button--loading]': 'loading()',
  '[class.mlv-button--selected]': 'selected()',
  '[class.mlv-button--icon-only]': '_iconOnly()',
  '[attr.disabled]': '(disabled() || loading()) || null',
  '[attr.aria-disabled]': '(disabled() || loading()) || null',
  '[attr.aria-busy]': 'loading() || null',
  '(click)': '_handleClick($event)',
}
```

> **Outlined vs. transparent label colour (AB-R1)** — `outlined` keeps the
> accent label (`--mlv-btn-text-color: var(--mlv-text-action)`): a bordered
> button is a call to action, not a routine per-row glyph. `transparent`
> instead resolves `--mlv-text-secondary` at rest, stepping to
> `--mlv-text-primary` on hover — a bare glyph (the row's configure/add/
> remove/reorder cluster, and per AB-R3 its destructive members too) is
> neutral chrome, never an accent mark, so a repeated unit never spends more
> than one accent-carrying mark. Both variants keep
> `--mlv-btn-bg-hover: var(--mlv-background-neutral-1-hover)` /
> `-active: var(--mlv-background-neutral-1-active)` on `transparent`, and
> `--mlv-background-accent-1-pale` / `--mlv-background-neutral-1-active` on
> `outlined`.

#### Template Structure (`button.html`)

```html
@if (loading()) {
<mlv-loader variant="circle" color="currentColor" indeterminate [size]="20" [strokeWidth]="2" />
} @else if (beforeRef()) {
<ng-container [ngTemplateOutlet]="beforeRef()!.templateRef" />
}
<span class="mlv-button__text"><ng-content /></span>
@if (!loading() && afterRef()) {
<ng-container [ngTemplateOutlet]="afterRef()!.templateRef" />
}
```

The loading state keeps the projected text visible, replaces optional before/after
content with an indeterminate `MlvLoader`, disables native button activation, and blocks
anchor activation through the component click guard. Consumers remain responsible
for changing the action label when a more specific in-progress label is useful.

#### Styles Summary (`button.scss`)

- Base: `display: inline-flex; align-items: center; gap: 0.25rem`
- `appearance: none; cursor: pointer; transition: 0.2s`
- Focus: Form A — `outline: var(--mlv-stroke-width-medium) solid transparent;` at rest, coloured `var(--mlv-border-focus)` (or a variant's own `focus-outline`) on `:focus-visible`, offset `var(--mlv-focus-ring-offset)` (SF-R3)
- Size presets (padding, height, font scale):
  - `xs`: xs padding, xs height, body-xs font
  - `s`: s padding, s height, body-s font
  - `m`: m padding, m height, body-m font
  - `l`: l padding, l height, body-l font
  - `xl`: xl padding, xl height, body-xl font
- Variant styles:
  - `primary`: `accent-1` background
  - `secondary`: `neutral-1` background
  - `accent`: `accent-2` background
  - `transparent`: no background, neutral `--mlv-text-secondary` label, neutral hover (AB-R1)
  - `outlined`: transparent with border, accent label kept
- Shape styles:
  - `default`: standard rectangular with radius
  - `square`: `padding: 0.25rem; width = height`
  - `circle`: `border-radius: var(--mlv-radius-full)`
- Disabled (SF-R4): a declared surface, not an opacity multiply — `--mlv-background-disabled` fill (transparent for `transparent`/`outlined`) + `--mlv-text-disabled` label; `cursor: not-allowed`, `pointer-events: none`
- Loading: current-colour `MlvLoader`, wait cursor, blocked pointer interaction, and inherited reduced-motion support
- Pressed (SF-R1): `[aria-pressed='true']` fills with `--mlv-background-selected` / `-hover` + `--mlv-text-on-selected` label, plus a `--mlv-stroke-width` inset `--mlv-border-normal` ring — never the pressed/`-active` fill, which means "the pointer is down right now"

**Canonical emission order (AB-R3).** The filled-variant loop and
`--variant-transparent`/`--variant-outlined` are plain single-class
selectors — specificity `(0,1,0)` — so both state selectors below always
outrank them regardless of source order. `[aria-pressed='true']` is
class+attribute (`(0,2,0)`). `--disabled` is deliberately emitted as a
doubled class (`&#{&}--disabled`, i.e. `.mlv-button.mlv-button--disabled`)
to match that same `(0,2,0)` specificity — a plain `&--disabled` is only
`(0,1,0)` and silently loses the specificity contest to `[aria-pressed]`
regardless of source order, which is exactly the bug this doubling fixes (a
disabled+pressed control — e.g. a disabled time-picker AM/PM button or
calendar month/year button — previously rendered as enabled-and-selected).
With both at `(0,2,0)`, source order decides, so disabled must stay
emitted **after** pressed. Emitted in this order, after the density blocks
and `&__*` parts: 1) base `:hover`/`:active`, 2) the filled-variant `@each`
loop, 3) `--variant-transparent`/`--variant-outlined` (AB-R1), 4)
`[aria-pressed='true']` (SF-R1 — outranks variant), 5) `--disabled` + its
two variant qualifiers (SF-R4 — outranks everything, including pressed, via
both the specificity tie and source order), 6) `--loading`, then the shape
modifiers.

> **Pressed state** — any `button[mlvButton]` carrying `aria-pressed="true"`
> **or the `selected` input** gets the visible treatment, not just
> `mlv-button-toggle`. The two share one rule: `selected` renders
> `.mlv-button--selected` (doubled to `(0,2,0)` so it matches the attribute
> half's specificity and cannot lose to `--variant-transparent:hover`) and adds
> no ARIA. It exists for a **menu** button that reflects an active state — the
> editor's heading trigger while the caret sits in an H2 — which must not claim
> the toggle-button pattern on top of `aria-haspopup`/`aria-expanded`; its state
> reaches assistive technology through the level-bearing accessible name
> instead. A real toggle sets `aria-pressed` and paints identically. Toggles that render
> the attribute on a plain `mlvButton` — every editor toolbar command button —
> previously announced their state to assistive technology while looking
> identical to an inactive control. The rule pins `--mlv-btn-bg-hover` **and**
> `--mlv-btn-text-color` as well, because `.mlv-button:hover` and
> `.mlv-button--variant-transparent:hover` carry the same `(0,2,0)`
> specificity and would otherwise decide the background/label by Sass
> emission order. It writes `--mlv-btn-box-shadow` rather than `box-shadow`,
> keeping the base `box-shadow: var(--mlv-btn-box-shadow, none)` the single
> place the property is set. `--mlv-background-selected` / `-hover` back it
> in both themes (SF-R1), so a pressed control reads as a persistent
> selection, not a mouse-down affordance, against light and dark toolbar
> surfaces alike. `button.spec.ts` compiles `button.scss` through Sass and
> pins the selector's targeting and all three declarations.
>
> **Disabled state (SF-R4)** — `&#{&}--disabled` (doubled class,
> `.mlv-button.mlv-button--disabled`, specificity `(0,2,0)`) sits **last** in
> the canonical emission order (after `[aria-pressed='true']`), so a disabled
> control never shows a pressed fill. The doubling matters: a plain
> `&--disabled` is only `(0,1,0)` and loses to `[aria-pressed='true']`'s
> `(0,2,0)` outright, regardless of source order — `button.spec.ts` pins this
> against real cascade resolution via `getComputedStyle`, not just rule
> declarations in isolation. It sets `--mlv-btn-bg`/`-hover`/`-active` to the new
> `--mlv-background-disabled` token and `--mlv-btn-text-color` to
> `--mlv-text-disabled` — a declared pale surface with legible ink, not the
> old `opacity: var(--mlv-disabled-opacity)` multiply, which produced white
> text on a washed-out accent composite at ~1.9:1 contrast. Two qualifiers
> keep `transparent`/`outlined` disabled buttons background-free
> (`--variant-outlined.--disabled` also mutes its border to
> `--mlv-border-subtle`).

> **Icon-only inference & the shape-aware default variant** — see
> [docs/migrations/2026-08-button-icon-only-default-variant.md](../../docs/migrations/2026-08-button-icon-only-default-variant.md).
>
> - `.mlv-button--icon-only` no longer requires `mlvButtonIcon`. `_iconOnly()` is true when
>   `shape` is `square`/`circle` **and** either a `[mlvButtonIcon]` is projected **or** the
>   default slot renders no non-whitespace text. The slot is projected content, so its text
>   is read back from `.mlv-button__text` (view child `#textRef`) inside an
>   `afterRenderEffect` that re-runs on `shape`, `loading`, and `mlvButtonIcon` changes.
>   `_hasProjectedText` starts `true`, so SSR (where `afterRenderEffect` never runs) keeps
>   the directive-only behaviour. Text that appears/disappears inside an already-rendered
>   button is **not** observed — annotate the icon for that case.
> - `button.scss` sizes `.mlv-button--icon-only .mlv-button__text > svg:only-child` to
>   `var(--mlv-icon-font-size)`, so an unannotated Lucide icon stops rendering at its
>   intrinsic `24px` and overflowing the square at tight/compact density.

The public `effectiveVariant` computed signal resolves the local `variant`, the closest `MLV_BUTTON_VARIANT` provider, and finally a shape-aware fallback — `secondary` for `square`/`circle`, `primary` for everything else — in that order. Because `mlv-button-group`, `mlv-button-split`, and `mlv-button-toggle` always provide `MLV_BUTTON_VARIANT` (falling back to `primary` themselves), the shape-aware default only applies to a standalone button.

### `MlvButtonClose`

**File:** `libs/core/button/src/lib/button-close/button-close.ts`

- **Selector:** `mlv-button-close`
- Renders an inner native `<button type="button">` using `MlvButton`
- **Inputs:** `variant` (`transparent` by default), `shape` (`circle` by default), and required `ariaLabel`
- Attaches the standard `MlvDensityDirective` as a host directive and supports `tight`, `compact`, `comfortable`, `spacious`, and `airy`
- Forwards the directive's resolved density to the inner button, so dimensions match a regular icon-only `mlvButton` at every density
- Applies `ariaLabel` to the inner native button; the role-less custom-element host is not an accessible-name target
- For the transparent variant, uses `--mlv-text-secondary` at rest and `--mlv-text-primary` on hover/active, adapting automatically to light and dark themes
- Retains regular button background, focus, active, and motion behavior
- Glyph size uses a component-local `--mlv-button-close-icon-ratio: 0.6` (vs. the shared `--mlv-icon-in-container-ratio: 0.45` every other icon-only button uses), applied through a `.mlv-button--close.mlv-button--icon-only` override that outranks the base rule regardless of stylesheet order. `mlv-button-close` is most often seen at `compact` density or smaller (dialog/drawer headers, tile, inline clear affordances), where the shared 0.45 ratio rendered an illegibly small X (~12.6px at compact); 0.6 raises it to ~16.8px without touching the shared token or any other icon-only button
- Pins its own `:focus-visible` ring (`.mlv-button--close.mlv-button:focus-visible { outline-color: var(--mlv-border-focus) }`). The base `.mlv-button` neutralises the UA outline and only the per-variant rules restore a colour, so the close button previously depended entirely on the variant it happened to render with; the qualified selector also outranks those equally specific variant rules regardless of stylesheet order. Width/offset stay on the shared base so the ring matches every other button.

### `MlvButtonGroup`

**File:** `libs/core/button/src/lib/button-group/button-group.ts`

- **Selector:** `mlv-button-group`
- **Role:** `group`; name it with native `aria-label` or `aria-labelledby` when surrounding context is insufficient
- **Input:** `variant?: MlvButtonVariant`
- Projects ordinary `button[mlvButton]` and/or `mlv-button-toggle` children
- Joins adjacent corners and keeps focused buttons above their neighbors
- Provides its resolved variant through `MLV_BUTTON_VARIANT`; a child's local `variant` wins

### `MlvButtonSplit`

**File:** `libs/core/button/src/lib/button-split/button-split.ts`

- **Selector:** `mlv-button-split`
- **Role:** `group`
- **Input:** `variant?: MlvButtonVariant`
- Projects the primary action first and its related trigger second
- Owns connected layout, a vertically centered separator that is `0.25rem` shorter than the buttons, and shared variant injection; popup/menu behavior stays with the projected trigger

### `MlvButtonToggle`

**File:** `libs/core/button/src/lib/button-toggle/button-toggle.ts`

- **Selector:** `mlv-button-toggle`
- Renders an inner native `<button type="button">` using `MlvButton`
- **Inputs:** `variant?`, `shape`, `disabled`, `mlvDensity?`, `ariaLabel?`, `ariaLabelledBy?`
- **Model:** `pressed` (two-way bindable with `[(pressed)]`)
- Reflects state through native `aria-pressed` and a visible pressed treatment
- Forwards `mlvDensity` to the inner button
- Inherits a group/split variant when its local `variant` is omitted, then provides that resolved value to its inner button

---

## Directives

All defined in `libs/core/button/src/lib/button.directives.ts`.

### `MlvStructural` (abstract base, from `@malva-ui/cdk/utils`)

Base class extended by `MlvButtonBefore` and `MlvButtonAfter`. Provides `templateRef = inject(TemplateRef)`. It lives in `@malva-ui/cdk/utils`, not in this barrel.

### `MlvButtonBefore`

- **Selector:** `[mlvButtonBefore]`
- **Purpose:** Template slot for content rendered **before** the button text label.
- Use with `<ng-template mlvButtonBefore>` inside a button.

### `MlvButtonAfter`

- **Selector:** `[mlvButtonAfter]`
- **Purpose:** Template slot for content rendered **after** the button text label.
- Use with `<ng-template mlvButtonAfter>` inside a button.

---

## Services

None.

---

## Usage Examples

```html
<!-- Primary button (default) -->
<button mlvButton>Click me</button>

<!-- Variants -->
<button mlvButton variant="secondary">Secondary</button>
<button mlvButton variant="outlined">Outlined</button>
<button mlvButton variant="accent">Accent</button>
<button mlvButton variant="transparent">Transparent</button>
<button mlvButton variant="error">Error</button>
<button mlvButton variant="warning">Warning</button>
<button mlvButton variant="info">Info</button>

<!-- Sizing via density -->
<button mlvButton mlvDensity="compact">Small</button>
<button mlvButton mlvDensity="spacious">Large</button>

<!-- Close action; all five standard density values are supported -->
<mlv-button-close ariaLabel="Close dialog" mlvDensity="compact" />

<!-- Icon before text -->
<button mlvButton>
  <ng-template mlvButtonBefore>
    <svg><!-- search icon --></svg>
  </ng-template>
  Search
</button>

<!-- Icon after text -->
<button mlvButton variant="primary">
  Continue
  <ng-template mlvButtonAfter><span>→</span></ng-template>
</button>

<!-- Circle icon button — icon-only sizing and the neutral `secondary` default
     are inferred; `mlvButtonIcon` is optional -->
<button mlvButton shape="circle" aria-label="Add">
  <svg lucidePlus />
</button>

<!-- Explicit variant still wins over the shape-aware default -->
<button mlvButton shape="circle" variant="primary" aria-label="Add">
  <svg lucidePlus mlvButtonIcon />
</button>

<!-- Disabled -->
<button mlvButton [disabled]="true">Disabled</button>

<!-- Loading -->
<button mlvButton [loading]="saving()">{{ saving() ? 'Saving…' : 'Save changes' }}</button>

<!-- Link button -->
<a mlvButton href="/page" variant="transparent">Go to page</a>

<!-- One shared variant for a connected group -->
<mlv-button-group variant="secondary" aria-label="Text alignment">
  <button mlvButton>Left</button>
  <button mlvButton>Center</button>
  <button mlvButton>Right</button>
</mlv-button-group>

<!-- Split primary action and related trigger -->
<mlv-button-split variant="primary" aria-label="Save options">
  <button mlvButton>Save</button>
  <button mlvButton shape="square" aria-label="More save options">…</button>
</mlv-button-split>

<!-- Two-way toggle state; both toggles inherit the group variant -->
<mlv-button-group variant="secondary" aria-label="Formatting">
  <mlv-button-toggle [(pressed)]="bold">Bold</mlv-button-toggle>
  <mlv-button-toggle [(pressed)]="italic">Italic</mlv-button-toggle>
</mlv-button-group>
```

---

## Dependencies

- `@angular/core` ^22.0.0
- `@angular/common` — `NgTemplateOutlet`
- `@angular/cdk/coercion` — `BooleanInput`, `coerceBooleanProperty`
- `@lucide/angular` — close icon
- `@malva-ui/cdk/density` — standard five-level density directive
- `@malva-ui/core/loader` — indeterminate loading indicator
- Malva UI CSS design tokens (`--mlv-*`)
